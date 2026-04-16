/**
 * AI Reasoning Service — The Brain of TinyDx
 *
 * Inspired by DeepRare's Central Host (Tier 1):
 * - Phenotype extraction from clinical data → HPO terms
 * - Differential diagnosis with transparent reasoning
 * - Self-reflection loop (verify → refine → confidence)
 * - Family-friendly report generation
 *
 * Power of 15: Rule 2 — Bounded agent loops (MAX_REASONING_STEPS)
 * Power of 15: Rule 7 — All API calls with retry + backoff
 * Power of 15: Rule 14 — No PHI in logs, API key from env
 */
import Anthropic from "@anthropic-ai/sdk";
import { batchValidateHpoTerms } from "./hpo.js";
import {
  searchDiseasesByHpoTerms,
  getNaturalHistory,
  calculatePhenotypeOverlap,
} from "./orphanet.js";
import type {
  TinyDxConfig,
  SymptomTimeline,
  HpoTerm,
  DifferentialDiagnosis,
  DiseaseCandidate,
  DiagnosticPathway,
  DiagnosticRecommendation,
  NavigatorReport,
} from "../types/index.js";

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 4096;
const MAX_REASONING_STEPS = 3; // Rule 2: bounded self-reflection

let _client: Anthropic | null = null;

function getClient(config: TinyDxConfig): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return _client;
}

// ── Phenotype Extraction ──

export async function extractHpoTerms(
  config: TinyDxConfig,
  timeline: SymptomTimeline
): Promise<ReadonlyArray<HpoTerm>> {
  if (timeline.entries.length === 0) {
    return [];
  }

  const client = getClient(config);

  const clinicalSummary = timeline.entries
    .map((e) => `[${e.date}] ${e.source}: ${e.description}`)
    .join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: `You are a clinical phenotyping specialist. Given the following patient clinical timeline, extract ALL phenotypic features and map each to the most specific Human Phenotype Ontology (HPO) term.

CLINICAL TIMELINE:
${clinicalSummary}

For each phenotypic feature found, provide:
1. The HPO term ID (format: HP:XXXXXXX)
2. The HPO term name
3. A confidence score (0.0-1.0) for how certain the mapping is

RESPOND ONLY with a JSON array. No other text.
Example: [{"id": "HP:0001250", "name": "Seizures", "confidence": 0.95}]

IMPORTANT: Focus on phenotypic ABNORMALITIES, not normal findings. Map clinical descriptions to the most specific HPO term available. If a condition has multiple phenotypic features, list each separately.`,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from phenotype extraction");
  }

  try {
    const parsed = JSON.parse(textContent.text) as HpoTerm[];
    // Rule 5: validate output shape
    if (!Array.isArray(parsed)) {
      throw new Error("Expected array of HPO terms");
    }
    // Rule 2: cap at maxHpoTerms
    const capped = parsed.slice(0, config.maxHpoTerms);

    // Validate against real HPO API — catches hallucinated IDs
    try {
      const validated = await batchValidateHpoTerms(capped);
      console.error(`HPO validation: ${capped.length} terms → ${validated.length} validated`);
      return validated;
    } catch {
      console.error("HPO validation failed — using AI-extracted terms as-is");
      return capped; // Graceful degradation
    }
  } catch {
    throw new Error(`Failed to parse HPO terms from AI response: ${textContent.text.substring(0, 200)}`);
  }
}

// ── Differential Diagnosis with Self-Reflection ──

export async function generateDifferential(
  config: TinyDxConfig,
  patientId: string,
  hpoTerms: ReadonlyArray<HpoTerm>,
  familyHistorySummary?: string
): Promise<DifferentialDiagnosis> {
  if (hpoTerms.length === 0) {
    throw new Error("At least one HPO term is required for differential diagnosis");
  }

  const client = getClient(config);

  const hpoList = hpoTerms
    .map((t) => `- ${t.id} ${t.name} (confidence: ${t.confidence})`)
    .join("\n");

  const familyCtx = familyHistorySummary
    ? `\nFAMILY HISTORY:\n${familyHistorySummary}`
    : "";

  // Step 1: Initial differential
  const initialResponse = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: `You are an expert rare disease diagnostician. Given the following HPO phenotype terms from a patient, generate a differential diagnosis of the top ${config.maxCandidates} rare disease candidates.

PATIENT PHENOTYPIC FEATURES:
${hpoList}
${familyCtx}

For each candidate disease, provide:
1. rank (1-${config.maxCandidates})
2. diseaseName — the full disease name
3. orphaCode — Orphanet code if known (e.g., "ORPHA:1234")
4. omimId — OMIM ID if known (e.g., "OMIM:123456")
5. matchingPhenotypes — which of the patient's HPO terms match this disease
6. unmatchedPhenotypes — which of the patient's HPO terms are NOT explained by this disease
7. phenotypeOverlapPercent — percentage of patient phenotypes matching (0-100)
8. confidence — "HIGH" (>70% overlap), "MODERATE" (40-70%), "LOW" (<40%)
9. reasoning — 2-3 sentences explaining WHY this disease is a candidate, linking specific phenotypes to known disease features. Be transparent about uncertainty.
10. evidence — array of evidence sources (e.g., "Orphanet: ORPHA:1234", "OMIM: 123456")

RESPOND ONLY with a JSON object: {"candidates": [...], "unexplainedSymptoms": [...]}
IMPORTANT: Consider the COMBINATION of phenotypes, not each individually. Rare diseases have characteristic phenotype PATTERNS.`,
      },
    ],
  });

  const initialText = initialResponse.content.find((c) => c.type === "text");
  if (!initialText || initialText.type !== "text") {
    throw new Error("No text response from differential diagnosis");
  }

  let parsed: { candidates: DiseaseCandidate[]; unexplainedSymptoms: string[] };
  try {
    parsed = JSON.parse(initialText.text);
  } catch {
    throw new Error(`Failed to parse differential from AI: ${initialText.text.substring(0, 200)}`);
  }

  // Step 2: Orphanet cross-reference (knowledge base validation)
  let orphanetContext = "";
  try {
    const patientHpoIds = hpoTerms.map((t) => t.id);
    const orphanetDiseases = await searchDiseasesByHpoTerms(patientHpoIds);

    if (orphanetDiseases.length > 0) {
      const orphaLines: string[] = [];
      for (const od of orphanetDiseases.slice(0, 5)) {
        const overlap = calculatePhenotypeOverlap(patientHpoIds, od);
        const history = await getNaturalHistory(od.orphaCode);
        const inheritance = history?.inheritanceTypes.join(", ") ?? "unknown";
        orphaLines.push(
          `- ORPHA:${od.orphaCode} ${od.name} (${overlap}% phenotype overlap, inheritance: ${inheritance})`
        );
      }
      orphanetContext = `\nORPHANET KNOWLEDGE BASE MATCHES:\n${orphaLines.join("\n")}`;
      console.error(`Orphanet: ${orphanetDiseases.length} diseases found, top: ${orphanetDiseases[0].name}`);
    }
  } catch {
    console.error("Orphanet cross-reference failed — proceeding with AI-only differential");
  }

  // Step 3: Self-reflection loop (DeepRare-inspired) with Orphanet evidence
  // Rule 2: bounded to MAX_REASONING_STEPS
  let refined = parsed;
  for (let step = 0; step < MAX_REASONING_STEPS; step++) {
    const topCandidate = refined.candidates[0];
    if (!topCandidate || topCandidate.confidence === "HIGH") {
      break; // No need to refine further
    }

    const reflectionResponse = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: "user",
          content: `SELF-REFLECTION STEP ${step + 1}: Review and refine this rare disease differential diagnosis.

PATIENT HPO TERMS: ${hpoList}
${orphanetContext}

CURRENT TOP CANDIDATE: ${topCandidate.diseaseName} (${topCandidate.confidence} confidence)
Matching: ${topCandidate.matchingPhenotypes.join(", ")}
Unmatched: ${topCandidate.unmatchedPhenotypes.join(", ")}
Reasoning: ${topCandidate.reasoning}

QUESTIONS TO CONSIDER:
1. Do the Orphanet knowledge base matches confirm or contradict the AI ranking?
2. Are there phenotypes in the patient that CONTRADICT this diagnosis?
3. Is there a BETTER candidate that explains MORE of the patient's phenotypes?
4. Are the unmatched phenotypes pointing to a DIFFERENT or ADDITIONAL condition?

Use the Orphanet phenotype overlap percentages and inheritance patterns as evidence.
If adjustments are needed, provide updated candidates. If the current ranking is sound, confirm it.
RESPOND with JSON: {"candidates": [...], "unexplainedSymptoms": [...], "reflectionNote": "brief note on what changed or why ranking held"}`,
        },
      ],
    });

    const refText = reflectionResponse.content.find((c) => c.type === "text");
    if (refText && refText.type === "text") {
      try {
        refined = JSON.parse(refText.text);
      } catch {
        break; // If reflection parse fails, keep current results
      }
    }
  }

  return {
    patientId,
    hpoTermsUsed: hpoTerms,
    candidates: refined.candidates.slice(0, config.maxCandidates),
    unexplainedSymptoms: refined.unexplainedSymptoms ?? [],
    generatedAt: new Date().toISOString(),
  };
}

// ── Diagnostic Pathway ──

export async function suggestPathway(
  config: TinyDxConfig,
  patientId: string,
  differential: DifferentialDiagnosis
): Promise<DiagnosticPathway> {
  const client = getClient(config);
  const topCandidates = differential.candidates.slice(0, 3);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: `You are a clinical geneticist. Based on this rare disease differential diagnosis, recommend the optimal diagnostic pathway.

TOP CANDIDATES:
${topCandidates.map((c) => `${c.rank}. ${c.diseaseName} (${c.confidence}) — ${c.reasoning}`).join("\n")}

UNEXPLAINED SYMPTOMS: ${differential.unexplainedSymptoms.join(", ") || "None"}

For each recommendation, provide:
1. priority: "URGENT", "HIGH", or "STANDARD"
2. type: "genetic_test", "specialist_referral", "clinical_investigation", or "imaging"
3. description: specific test/referral (e.g., "Whole Exome Sequencing with trio analysis")
4. rationale: why this is recommended given the differential

Also provide estimatedTimeToAnswer (e.g., "4-8 weeks for genetic panel results").

RESPOND with JSON: {"recommendations": [...], "estimatedTimeToAnswer": "..."}
IMPORTANT: Prioritize tests that would differentiate between the top candidates. Start with the least invasive, most informative option.`,
      },
    ],
  });

  const text = response.content.find((c) => c.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("No response from pathway suggestion");
  }

  const parsed = JSON.parse(text.text) as {
    recommendations: DiagnosticRecommendation[];
    estimatedTimeToAnswer: string;
  };

  return {
    patientId,
    topCandidate: topCandidates[0]?.diseaseName ?? "Unknown",
    recommendations: parsed.recommendations,
    estimatedTimeToAnswer: parsed.estimatedTimeToAnswer,
  };
}

// ── Family Navigator Report ──

export async function createNavigatorReport(
  config: TinyDxConfig,
  patientId: string,
  timeline: SymptomTimeline,
  differential: DifferentialDiagnosis,
  pathway: DiagnosticPathway
): Promise<NavigatorReport> {
  const client = getClient(config);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: `You are a compassionate healthcare communicator. Create a family-friendly "Diagnostic Navigator Report" that a parent can hand to ANY new doctor.

PATIENT CONTEXT:
- ${timeline.totalEncounters} encounters over ${timeline.timeSpanMonths} months
- ${timeline.totalProviders} different providers
- ${differential.hpoTermsUsed.length} phenotypic features identified

TOP CANDIDATE CONDITIONS:
${differential.candidates.slice(0, 3).map((c) => `- ${c.diseaseName} (${c.confidence} confidence): ${c.reasoning}`).join("\n")}

RECOMMENDED NEXT STEPS:
${pathway.recommendations.map((r) => `- [${r.priority}] ${r.description}: ${r.rationale}`).join("\n")}

Generate a report with these sections (respond as JSON):
1. "summary" — 2-3 sentences overview in plain language a parent can understand
2. "whatWeFound" — Describe the symptoms assembled, using simple terms (not medical jargon)
3. "possibleConditions" — Explain the top 2-3 candidates in everyday language. What each condition means, why it might be relevant. Be honest about uncertainty.
4. "nextSteps" — What the family should do next, in clear action items
5. "questionsForYourDoctor" — Array of 5 specific questions the family can bring to their next appointment
6. "supportResources" — Array of relevant organizations/websites (e.g., NORD, Global Genes, specific disease foundations)

TONE: Compassionate, clear, empowering. Avoid medical jargon. If you must use a medical term, define it in parentheses. Acknowledge the family's journey and the difficulty of the diagnostic odyssey.`,
      },
    ],
  });

  const text = response.content.find((c) => c.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("No response from navigator report generation");
  }

  const parsed = JSON.parse(text.text) as Omit<NavigatorReport, "patientId" | "patientName" | "generatedAt">;

  return {
    patientId,
    patientName: `Patient ${patientId}`, // Synthetic data placeholder
    generatedAt: new Date().toISOString(),
    ...parsed,
  };
}
