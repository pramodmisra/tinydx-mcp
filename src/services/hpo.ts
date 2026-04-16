/**
 * HPO API Service — Human Phenotype Ontology Validation
 *
 * Uses the NLM Clinical Tables API to validate and search HPO terms.
 * This catches AI hallucination of invalid HPO IDs by verifying each
 * term against the real ontology.
 *
 * API: https://clinicaltables.nlm.nih.gov/api/hpo/v3/search
 * No auth required. Response format: [totalMatches, [ids], null, [[id, name]...]]
 *
 * Power of 15: Rule 2 — Bounded batch size (maxHpoTerms)
 * Power of 15: Rule 7 — Retry with backoff
 */
import type { HpoSearchResult, HpoTerm } from "../types/index.js";

const HPO_API_BASE = "https://clinicaltables.nlm.nih.gov/api/hpo/v3";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const MAX_RESULTS = 5;

// ── Core Search ──

/**
 * Search HPO by term name. Returns matching HPO IDs and names.
 */
export async function searchHpoByName(
  query: string
): Promise<ReadonlyArray<HpoSearchResult>> {
  if (!query || query.length === 0) return [];

  const url = `${HPO_API_BASE}/search?terms=${encodeURIComponent(query)}&maxList=${MAX_RESULTS}`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HPO API ${response.status}: ${response.statusText}`);
      }

      // Response: [totalMatches, [ids], null, [[id, name]...]]
      const data = (await response.json()) as [number, string[], null, string[][]];
      const pairs = data[3] ?? [];

      return pairs.map(([id, name]) => ({ id, name }));
    } catch (error: unknown) {
      if (attempt === MAX_RETRIES - 1) {
        console.error(`HPO API search failed after ${MAX_RETRIES} attempts: ${error}`);
        return []; // Graceful degradation
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }
  return [];
}

// ── Validation ──

/**
 * Validate a single HPO term against the real API.
 * If the ID exists, returns the validated term.
 * If not, searches by name and returns the best match.
 */
export async function validateHpoTerm(
  term: HpoTerm
): Promise<HpoTerm> {
  // Search by name to find the correct ID
  const results = await searchHpoByName(term.name);

  if (results.length === 0) {
    // API returned nothing — keep the AI-generated term as-is
    return { ...term, validated: false } as HpoTerm & { validated: boolean };
  }

  // Check if AI's ID matches any result
  const exactMatch = results.find((r) => r.id === term.id);
  if (exactMatch) {
    return term; // AI got it right
  }

  // AI's ID was wrong — use the best match by name
  const bestMatch = results[0];
  return {
    id: bestMatch.id,
    name: bestMatch.name,
    confidence: term.confidence * 0.9, // Slightly reduce confidence for corrected terms
  };
}

/**
 * Batch validate AI-extracted HPO terms against the real API.
 * Corrects hallucinated IDs and returns validated terms.
 */
export async function batchValidateHpoTerms(
  terms: ReadonlyArray<HpoTerm>
): Promise<ReadonlyArray<HpoTerm>> {
  const validated: HpoTerm[] = [];

  // Process sequentially to avoid rate limiting (bounded by maxHpoTerms)
  for (const term of terms) {
    try {
      const result = await validateHpoTerm(term);
      validated.push(result);
    } catch {
      // If validation fails for one term, keep the original
      validated.push(term);
    }
  }

  return validated;
}
