/**
 * Orphanet API Service — Rare Disease Knowledge Base
 *
 * Uses the Orphadata API for disease-phenotype matching, natural history,
 * and cross-referencing. Provides evidence-backed disease candidates to
 * complement AI-driven differential diagnosis.
 *
 * API: https://api.orphadata.com
 * No auth required. CC-BY-4.0 licensed.
 *
 * Power of 15: Rule 2 — Bounded results
 * Power of 15: Rule 7 — Retry with backoff
 */
import type {
  OrphanetDisease,
  OrphanetHpoAssociation,
  OrphanetNaturalHistory,
} from "../types/index.js";

const ORPHANET_API = "https://api.orphadata.com";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const MAX_DISEASES = 10;

// ── Helper ──

async function orphaFetch<T>(path: string): Promise<T | null> {
  const url = `${ORPHANET_API}${path}`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Orphanet API ${response.status}: ${response.statusText}`);
      }
      return (await response.json()) as T;
    } catch (error: unknown) {
      if (attempt === MAX_RETRIES - 1) {
        console.error(`Orphanet API failed after ${MAX_RETRIES} attempts: ${error}`);
        return null; // Graceful degradation
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }
  return null;
}

// ── Response Types (raw API shapes) ──

interface RawPhenotypeResponse {
  data: {
    __count: number;
    results: Array<{
      Disorder: {
        ORPHAcode: number;
        "Preferred term": string;
        OrphanetURL: string;
        HPODisorderAssociation: Array<{
          HPO: { HPOId: string; HPOTerm: string };
          HPOFrequency: string;
          DiagnosticCriteria: string | null;
        }>;
      };
    }>;
  };
}

interface RawNaturalHistoryResponse {
  data: {
    results: {
      ORPHAcode: number;
      "Preferred term": string;
      TypeOfInheritance: string[];
      AverageAgeOfOnset: string[];
    } | Array<{
      ORPHAcode: number;
      "Preferred term": string;
      TypeOfInheritance: string[];
      AverageAgeOfOnset: string[];
    }>;
  };
}

// ── Core Functions ──

/**
 * Search for diseases matching a set of HPO terms.
 * Returns diseases sorted by number of matching phenotypes (best match first).
 */
export async function searchDiseasesByHpoTerms(
  hpoIds: ReadonlyArray<string>
): Promise<ReadonlyArray<OrphanetDisease>> {
  if (hpoIds.length === 0) return [];

  const idsParam = hpoIds.join(",");
  const raw = await orphaFetch<RawPhenotypeResponse>(
    `/rd-phenotypes/hpoids/${idsParam}`
  );

  if (!raw?.data?.results) return [];

  const results = Array.isArray(raw.data.results) ? raw.data.results : [raw.data.results];

  const diseases: OrphanetDisease[] = results.map((entry) => {
    const d = entry.Disorder;
    const hpoAssociations: OrphanetHpoAssociation[] = (d.HPODisorderAssociation ?? []).map((a) => ({
      hpoId: a.HPO.HPOId,
      hpoTerm: a.HPO.HPOTerm,
      frequency: a.HPOFrequency,
      diagnosticCriteria: a.DiagnosticCriteria !== null,
    }));

    return {
      orphaCode: d.ORPHAcode,
      name: d["Preferred term"],
      orphanetUrl: d.OrphanetURL,
      hpoAssociations,
    };
  });

  // Score by how many of the INPUT HPO terms match the disease's phenotype profile
  const inputIdSet = new Set(hpoIds);
  const scored = diseases.map((disease) => {
    const matchCount = disease.hpoAssociations.filter(
      (a) => inputIdSet.has(a.hpoId)
    ).length;
    return { disease, matchCount };
  });

  // Sort: most matches first
  scored.sort((a, b) => b.matchCount - a.matchCount);

  return scored.slice(0, MAX_DISEASES).map((s) => s.disease);
}

/**
 * Get natural history for a disease (inheritance, age of onset).
 */
export async function getNaturalHistory(
  orphaCode: number
): Promise<OrphanetNaturalHistory | null> {
  const raw = await orphaFetch<RawNaturalHistoryResponse>(
    `/rd-natural_history/orphacodes/${orphaCode}`
  );

  if (!raw?.data?.results) return null;

  const r = Array.isArray(raw.data.results) ? raw.data.results[0] : raw.data.results;
  if (!r) return null;

  return {
    orphaCode: r.ORPHAcode,
    name: r["Preferred term"],
    inheritanceTypes: r.TypeOfInheritance ?? [],
    averageAgeOfOnset: r.AverageAgeOfOnset ?? [],
  };
}

/**
 * Calculate phenotype overlap between patient HPO terms and an Orphanet disease.
 * Returns percentage (0-100) of patient terms that match the disease.
 */
export function calculatePhenotypeOverlap(
  patientHpoIds: ReadonlyArray<string>,
  disease: OrphanetDisease
): number {
  if (patientHpoIds.length === 0) return 0;

  const diseaseHpoIds = new Set(disease.hpoAssociations.map((a) => a.hpoId));
  const matchCount = patientHpoIds.filter((id) => diseaseHpoIds.has(id)).length;

  return Math.round((matchCount / patientHpoIds.length) * 100);
}
