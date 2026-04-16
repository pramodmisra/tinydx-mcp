/**
 * TinyDx MCP Server — Rare Disease Diagnostic Navigator
 *
 * 7 MCP tools for rare disease diagnostic support:
 * 1. assemble_symptom_timeline — FHIR → unified chronological view
 * 2. extract_phenotype_terms — AI maps clinical data → HPO terms
 * 3. generate_differential — Ranked rare disease candidates with reasoning
 * 4. suggest_diagnostic_pathway — Recommends tests, specialists, next steps
 * 5. create_navigator_report — Family-friendly plain-language summary
 * 6. analyze_family_history — Hereditary pattern extraction from FHIR
 * 7. output_phenopacket — GA4GH Phenopacket v2.0 export
 *
 * Architecture inspired by DeepRare (Nature, Feb 2026)
 * Built for Prompt Opinion's Agents Assemble Hackathon
 *
 * Power of 15 Compliance:
 * - Rule 5: ≥2 assertions per tool handler
 * - Rule 7: All API calls with error handling
 * - Rule 14: No secrets in code, no PHI in logs
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config/index.js";
import { assembleTimeline, getPatientFamilyHistory } from "./services/fhir.js";
import {
  extractHpoTerms,
  generateDifferential,
  suggestPathway,
  createNavigatorReport,
} from "./services/reasoning.js";
import type { PhenopacketOutput, SharpContext } from "./types/index.js";

// ── Initialize ──

const config = loadConfig();

const server = new McpServer({
  name: "tinydx",
  version: "1.0.0",
  description:
    "TinyDx — Rare Disease Diagnostic Navigator. FHIR-native, HPO-powered diagnostic support for the pediatric rare disease diagnostic odyssey. Assembles scattered clinical records, maps symptoms to 7,000+ rare diseases, and generates family-friendly diagnostic reports.",
});

// ── Helper: Extract SHARP Context ──

function parseSharpContext(sharpJson?: string): SharpContext | null {
  if (!sharpJson) return null;
  try {
    const parsed = JSON.parse(sharpJson) as SharpContext;
    if (!parsed.patientId) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ── Tool 1: Assemble Symptom Timeline ──

server.tool(
  "assemble_symptom_timeline",
  "Pulls ALL clinical encounters, conditions, and observations from FHIR for a patient and assembles a unified chronological symptom timeline. This is what no single doctor has seen — the complete picture across all providers and visits.",
  {
    patient_id: z.string().describe("FHIR Patient resource ID"),
    fhir_base_url: z.string().optional().describe("FHIR server base URL (uses default if not provided)"),
    fhir_token: z.string().optional().describe("FHIR access token for authenticated servers"),
    sharp_context: z.string().optional().describe("SHARP extension context JSON for Prompt Opinion integration"),
  },
  async (params) => {
    const sharp = parseSharpContext(params.sharp_context);
    const patientId = sharp?.patientId ?? params.patient_id;
    const baseUrl = sharp?.fhirBaseUrl ?? params.fhir_base_url ?? config.fhirBaseUrl;
    const token = sharp?.fhirAccessToken ?? params.fhir_token;

    // Rule 5: Input validation
    if (!patientId) {
      return { content: [{ type: "text", text: "Error: patient_id is required" }] };
    }

    try {
      const effectiveConfig = { ...config, fhirBaseUrl: baseUrl };
      const timeline = await assembleTimeline(effectiveConfig, patientId, token);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(timeline, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: `Error assembling timeline: ${message}` }] };
    }
  }
);

// ── Tool 2: Extract Phenotype Terms ──

server.tool(
  "extract_phenotype_terms",
  "Uses AI to analyze a patient's symptom timeline and map each clinical finding to standardized HPO (Human Phenotype Ontology) terms. This is the bridge between messy clinical data and structured rare disease matching.",
  {
    patient_id: z.string().describe("FHIR Patient resource ID"),
    timeline_json: z.string().optional().describe("Pre-assembled timeline JSON (if already called assemble_symptom_timeline)"),
    fhir_base_url: z.string().optional().describe("FHIR server base URL"),
    fhir_token: z.string().optional().describe("FHIR access token"),
    sharp_context: z.string().optional().describe("SHARP extension context JSON"),
  },
  async (params) => {
    const sharp = parseSharpContext(params.sharp_context);
    const patientId = sharp?.patientId ?? params.patient_id;
    const baseUrl = sharp?.fhirBaseUrl ?? params.fhir_base_url ?? config.fhirBaseUrl;
    const token = sharp?.fhirAccessToken ?? params.fhir_token;

    if (!patientId) {
      return { content: [{ type: "text", text: "Error: patient_id is required" }] };
    }

    try {
      // Use pre-assembled timeline or build one
      let timeline;
      if (params.timeline_json) {
        timeline = JSON.parse(params.timeline_json);
      } else {
        const effectiveConfig = { ...config, fhirBaseUrl: baseUrl };
        timeline = await assembleTimeline(effectiveConfig, patientId, token);
      }

      const hpoTerms = await extractHpoTerms(config, timeline);

      return {
        content: [{ type: "text", text: JSON.stringify(hpoTerms, null, 2) }],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: `Error extracting phenotypes: ${message}` }] };
    }
  }
);

// ── Tool 3: Generate Differential Diagnosis ──

server.tool(
  "generate_differential",
  "Generates a ranked differential diagnosis of rare disease candidates based on HPO phenotype terms. Uses AI reasoning with a self-reflection loop (inspired by DeepRare) to verify and refine candidates. Each candidate includes transparent reasoning and evidence citations.",
  {
    patient_id: z.string().describe("FHIR Patient resource ID"),
    hpo_terms_json: z.string().describe("JSON array of HPO terms from extract_phenotype_terms"),
    family_history_summary: z.string().optional().describe("Summary of family history findings"),
  },
  async (params) => {
    if (!params.patient_id) {
      return { content: [{ type: "text", text: "Error: patient_id is required" }] };
    }
    if (!params.hpo_terms_json) {
      return { content: [{ type: "text", text: "Error: hpo_terms_json is required" }] };
    }

    try {
      const hpoTerms = JSON.parse(params.hpo_terms_json);
      if (!Array.isArray(hpoTerms) || hpoTerms.length === 0) {
        return { content: [{ type: "text", text: "Error: hpo_terms_json must be a non-empty array" }] };
      }

      const differential = await generateDifferential(
        config,
        params.patient_id,
        hpoTerms,
        params.family_history_summary
      );

      return {
        content: [{ type: "text", text: JSON.stringify(differential, null, 2) }],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: `Error generating differential: ${message}` }] };
    }
  }
);

// ── Tool 4: Suggest Diagnostic Pathway ──

server.tool(
  "suggest_diagnostic_pathway",
  "Based on the differential diagnosis, recommends specific next steps: which genetic test to order, which specialist to see, what clinical investigations to pursue. Prioritizes the least invasive, most informative options first.",
  {
    patient_id: z.string().describe("FHIR Patient resource ID"),
    differential_json: z.string().describe("JSON from generate_differential"),
  },
  async (params) => {
    if (!params.patient_id || !params.differential_json) {
      return { content: [{ type: "text", text: "Error: patient_id and differential_json are required" }] };
    }

    try {
      const differential = JSON.parse(params.differential_json);
      const pathway = await suggestPathway(config, params.patient_id, differential);

      return {
        content: [{ type: "text", text: JSON.stringify(pathway, null, 2) }],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: `Error suggesting pathway: ${message}` }] };
    }
  }
);

// ── Tool 5: Create Navigator Report ──

server.tool(
  "create_navigator_report",
  "Generates a compassionate, plain-language 'Diagnostic Navigator Report' that a family can hand to any new doctor. Explains findings, possible conditions, next steps, and provides questions to ask — all without medical jargon.",
  {
    patient_id: z.string().describe("FHIR Patient resource ID"),
    timeline_json: z.string().describe("JSON from assemble_symptom_timeline"),
    differential_json: z.string().describe("JSON from generate_differential"),
    pathway_json: z.string().describe("JSON from suggest_diagnostic_pathway"),
  },
  async (params) => {
    if (!params.patient_id || !params.timeline_json || !params.differential_json || !params.pathway_json) {
      return { content: [{ type: "text", text: "Error: all parameters are required" }] };
    }

    try {
      const timeline = JSON.parse(params.timeline_json);
      const differential = JSON.parse(params.differential_json);
      const pathway = JSON.parse(params.pathway_json);

      const report = await createNavigatorReport(config, params.patient_id, timeline, differential, pathway);

      return {
        content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: `Error creating navigator report: ${message}` }] };
    }
  }
);

// ── Tool 6: Analyze Family History ──

server.tool(
  "analyze_family_history",
  "Extracts and analyzes hereditary patterns from FHIR FamilyMemberHistory resources. Identifies conditions that recur across family members and inheritance patterns that may narrow the differential diagnosis.",
  {
    patient_id: z.string().describe("FHIR Patient resource ID"),
    fhir_base_url: z.string().optional().describe("FHIR server base URL"),
    fhir_token: z.string().optional().describe("FHIR access token"),
    sharp_context: z.string().optional().describe("SHARP extension context JSON"),
  },
  async (params) => {
    const sharp = parseSharpContext(params.sharp_context);
    const patientId = sharp?.patientId ?? params.patient_id;
    const baseUrl = sharp?.fhirBaseUrl ?? params.fhir_base_url ?? config.fhirBaseUrl;
    const token = sharp?.fhirAccessToken ?? params.fhir_token;

    if (!patientId) {
      return { content: [{ type: "text", text: "Error: patient_id is required" }] };
    }

    try {
      const effectiveConfig = { ...config, fhirBaseUrl: baseUrl };
      const familyHistory = await getPatientFamilyHistory(effectiveConfig, patientId, token);

      // Summarize family history for human-readable output
      const summary = familyHistory.map((fmh) => {
        const relationship = fmh.relationship.coding?.[0]?.display ?? "Unknown relative";
        const conditions = fmh.condition
          ?.map((c) => {
            const name = c.code.coding?.[0]?.display ?? c.code.text ?? "Unknown condition";
            const onset = c.onsetAge ? ` (onset: ${c.onsetAge.value} ${c.onsetAge.unit})` : "";
            return `${name}${onset}`;
          })
          .join(", ") ?? "No conditions recorded";

        return `${relationship}: ${conditions}`;
      });

      const result = {
        patientId,
        familyMembers: familyHistory.length,
        summary: summary.length > 0 ? summary : ["No family history records found in FHIR"],
        inheritanceHints: familyHistory.length > 0
          ? "Family history data available — consider autosomal dominant, recessive, and X-linked patterns when evaluating differential."
          : "No family history data — recommend collecting family history to refine diagnosis.",
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: `Error analyzing family history: ${message}` }] };
    }
  }
);

// ── Tool 7: Output Phenopacket ──

server.tool(
  "output_phenopacket",
  "Exports the diagnostic findings in GA4GH Phenopacket v2.0 format — the global standard for rare disease data exchange. This makes TinyDx's output interoperable with Exomiser, PhenoTips, research registries, and clinical genetics pipelines worldwide.",
  {
    patient_id: z.string().describe("FHIR Patient resource ID"),
    hpo_terms_json: z.string().describe("JSON array of HPO terms"),
    differential_json: z.string().optional().describe("JSON from generate_differential"),
    patient_sex: z.enum(["MALE", "FEMALE", "OTHER_SEX", "UNKNOWN_SEX"]).optional().describe("Patient sex"),
    patient_dob: z.string().optional().describe("Patient date of birth (ISO format)"),
  },
  async (params) => {
    if (!params.patient_id || !params.hpo_terms_json) {
      return { content: [{ type: "text", text: "Error: patient_id and hpo_terms_json are required" }] };
    }

    try {
      const hpoTerms = JSON.parse(params.hpo_terms_json);
      const differential = params.differential_json
        ? JSON.parse(params.differential_json)
        : null;

      const phenopacket: PhenopacketOutput = {
        id: `tinydx-${params.patient_id}-${Date.now()}`,
        subject: {
          id: params.patient_id,
          dateOfBirth: params.patient_dob,
          sex: params.patient_sex,
        },
        phenotypicFeatures: hpoTerms.map((term: { id: string; name: string }) => ({
          type: { id: term.id, label: term.name },
          excluded: false,
        })),
        interpretations: differential?.candidates?.slice(0, 3).map(
          (c: { diseaseName: string; orphaCode?: string; confidence: string }) => ({
            diagnosis: {
              disease: {
                id: c.orphaCode ?? "UNKNOWN",
                label: c.diseaseName,
              },
            },
            progressStatus: c.confidence === "HIGH" ? "SOLVED" : "IN_PROGRESS",
          })
        ) ?? [],
        metaData: {
          created: new Date().toISOString(),
          createdBy: "TinyDx MCP v1.0.0",
          phenopacketSchemaVersion: "2.0.0",
          resources: [
            {
              id: "hp",
              name: "Human Phenotype Ontology",
              url: "https://hpo.jax.org/",
              version: "2024-12-12",
              namespacePrefix: "HP",
            },
            {
              id: "orpha",
              name: "Orphanet Rare Disease Ontology",
              url: "https://www.orpha.net/",
              version: "2024",
              namespacePrefix: "ORPHA",
            },
          ],
        },
      };

      return {
        content: [{ type: "text", text: JSON.stringify(phenopacket, null, 2) }],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: `Error generating Phenopacket: ${message}` }] };
    }
  }
);

// ── Start Server ──

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("TinyDx MCP server started"); // Rule 14: stderr for logs, not stdout
}

main().catch((error: unknown) => {
  console.error("Fatal error starting TinyDx:", error);
  process.exit(1);
});
