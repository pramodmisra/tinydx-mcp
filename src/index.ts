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
 * Architecture: Express + StreamableHTTPServerTransport per Prompt Opinion reference
 * SHARP context via HTTP headers (x-fhir-server-url, x-fhir-access-token, x-patient-id)
 *
 * Inspired by DeepRare (Nature, Feb 2026)
 * Built for Prompt Opinion's Agents Assemble Hackathon
 */
import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { loadConfig } from "./config/index.js";
import { assembleTimeline, getPatientFamilyHistory } from "./services/fhir.js";
import {
  extractHpoTerms,
  generateDifferential,
  suggestPathway,
  createNavigatorReport,
} from "./services/reasoning.js";
import { getSharpFhirContext, getSharpPatientId } from "./sharp-context.js";
import type { IncomingMessage } from "node:http";
import type { PhenopacketOutput } from "./types/index.js";

// ── Configuration ──

const config = loadConfig();
const PORT = config.port;

// ── MCP Server Instructions ──

const SERVER_INSTRUCTIONS = `TinyDx is a rare disease diagnostic navigator. To diagnose a patient, call tools in this order:
1. assemble_symptom_timeline — Get the complete clinical picture from FHIR
2. extract_phenotype_terms — Map symptoms to standardized HPO terms
3. analyze_family_history (optional) — Extract hereditary patterns
4. generate_differential — Rank rare disease candidates with AI reasoning
5. suggest_diagnostic_pathway — Get recommended tests and specialist referrals
6. create_navigator_report — Generate a family-friendly summary report
7. output_phenopacket — Export in GA4GH Phenopacket v2.0 format for interoperability

FHIR context (server URL, access token, patient ID) flows via SHARP headers automatically.`;

// FHIR extension declaration for Prompt Opinion marketplace
const FHIR_EXTENSION = {
  "ai.promptopinion/fhir-context": {
    scopes: [
      { name: "patient/Patient.rs", required: true },
      { name: "patient/Condition.rs", required: true },
      { name: "patient/Observation.rs", required: true },
      { name: "patient/Encounter.rs", required: false },
      { name: "patient/FamilyMemberHistory.rs", required: false },
    ],
  },
};

// ── Tool Registration ──
// Each tool is registered on a per-request McpServer with access to the Express request
// for SHARP header extraction. This follows the po-community-mcp stateless pattern.

// ── Zod Schemas (extracted to avoid TS2589 deep instantiation with MCP SDK) ──

// Schemas as raw Zod shapes (not z.object) per MCP SDK convention.
// TS2589 suppressed on registerTool calls — known SDK type depth issue with Zod generics.
const TimelineSchema = {
  patient_id: z.string().describe("FHIR Patient resource ID"),
};
const PhenotypeSchema = {
  patient_id: z.string().describe("FHIR Patient resource ID"),
  timeline_json: z.string().optional().describe("Pre-assembled timeline JSON (if already called assemble_symptom_timeline)"),
};
const DifferentialSchema = {
  patient_id: z.string().describe("FHIR Patient resource ID"),
  hpo_terms_json: z.string().describe("JSON array of HPO terms from extract_phenotype_terms"),
  family_history_summary: z.string().optional().describe("Summary of family history findings"),
};
const PathwaySchema = {
  patient_id: z.string().describe("FHIR Patient resource ID"),
  differential_json: z.string().describe("JSON from generate_differential"),
};
const ReportSchema = {
  patient_id: z.string().describe("FHIR Patient resource ID"),
  timeline_json: z.string().describe("JSON from assemble_symptom_timeline"),
  differential_json: z.string().describe("JSON from generate_differential"),
  pathway_json: z.string().describe("JSON from suggest_diagnostic_pathway"),
};
const FamilyHistorySchema = {
  patient_id: z.string().describe("FHIR Patient resource ID"),
};
const PhenopacketSchema = {
  patient_id: z.string().describe("FHIR Patient resource ID"),
  hpo_terms_json: z.string().describe("JSON array of HPO terms"),
  differential_json: z.string().optional().describe("JSON from generate_differential"),
  patient_sex: z.enum(["MALE", "FEMALE", "OTHER_SEX", "UNKNOWN_SEX"]).optional().describe("Patient sex"),
  patient_dob: z.string().optional().describe("Patient date of birth (ISO format)"),
};

function registerTools(server: McpServer, req: IncomingMessage): void {
  registerAssembleTimeline(server, req);
  registerExtractPhenotypes(server, req);
  registerGenerateDifferential(server);
  registerSuggestPathway(server);
  registerNavigatorReport(server);
  registerFamilyHistory(server, req);
  registerPhenopacket(server);
}

// ── Tool 1: Assemble Symptom Timeline ──

function registerAssembleTimeline(server: McpServer, req: IncomingMessage): void {
  // @ts-expect-error — TS2589: MCP SDK + Zod type depth issue with single-field schemas
  server.registerTool(
    "assemble_symptom_timeline",
    {
      description: "Pulls ALL clinical encounters, conditions, and observations from FHIR for a patient and assembles a unified chronological symptom timeline. This is what no single doctor has seen — the complete picture across all providers and visits.",
      inputSchema: TimelineSchema,
    },
    async (params) => {
      const sharpFhir = getSharpFhirContext(req);
      const patientId = params.patient_id || getSharpPatientId(req);

      if (!patientId) {
        return { content: [{ type: "text" as const, text: "Error: patient_id is required (provide as parameter or via SHARP context)" }] };
      }

      const baseUrl = sharpFhir?.url ?? config.fhirBaseUrl;
      const token = sharpFhir?.token;

      try {
        const effectiveConfig = { ...config, fhirBaseUrl: baseUrl };
        const timeline = await assembleTimeline(effectiveConfig, patientId, token);
        return { content: [{ type: "text" as const, text: JSON.stringify(timeline, null, 2) }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error assembling timeline: ${message}` }] };
      }
    }
  );
}

// ── Tool 2: Extract Phenotype Terms ──

function registerExtractPhenotypes(server: McpServer, req: IncomingMessage): void {
  server.registerTool(
    "extract_phenotype_terms",
    {
      description: "Uses AI to analyze a patient's symptom timeline and map each clinical finding to standardized HPO (Human Phenotype Ontology) terms. This bridges messy clinical data and structured rare disease matching.",
      inputSchema: PhenotypeSchema,
    },
    async (params) => {
      const sharpFhir = getSharpFhirContext(req);
      const patientId = params.patient_id || getSharpPatientId(req);

      if (!patientId) {
        return { content: [{ type: "text" as const, text: "Error: patient_id is required" }] };
      }

      try {
        let timeline;
        if (params.timeline_json) {
          timeline = JSON.parse(params.timeline_json);
        } else {
          const baseUrl = sharpFhir?.url ?? config.fhirBaseUrl;
          const token = sharpFhir?.token;
          const effectiveConfig = { ...config, fhirBaseUrl: baseUrl };
          timeline = await assembleTimeline(effectiveConfig, patientId, token);
        }

        const hpoTerms = await extractHpoTerms(config, timeline);
        return { content: [{ type: "text" as const, text: JSON.stringify(hpoTerms, null, 2) }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error extracting phenotypes: ${message}` }] };
      }
    }
  );
}

// ── Tool 3: Generate Differential Diagnosis ──

function registerGenerateDifferential(server: McpServer): void {
  server.registerTool(
    "generate_differential",
    {
      description: "Generates a ranked differential diagnosis of rare disease candidates based on HPO phenotype terms. Uses AI reasoning with a self-reflection loop (inspired by DeepRare) to verify and refine candidates. Each candidate includes transparent reasoning and evidence citations.",
      inputSchema: DifferentialSchema,
    },
    async (params) => {
      if (!params.patient_id) {
        return { content: [{ type: "text" as const, text: "Error: patient_id is required" }] };
      }
      if (!params.hpo_terms_json) {
        return { content: [{ type: "text" as const, text: "Error: hpo_terms_json is required" }] };
      }

      try {
        const hpoTerms = JSON.parse(params.hpo_terms_json);
        if (!Array.isArray(hpoTerms) || hpoTerms.length === 0) {
          return { content: [{ type: "text" as const, text: "Error: hpo_terms_json must be a non-empty array" }] };
        }

        const differential = await generateDifferential(
          config,
          params.patient_id,
          hpoTerms,
          params.family_history_summary
        );
        return { content: [{ type: "text" as const, text: JSON.stringify(differential, null, 2) }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error generating differential: ${message}` }] };
      }
    }
  );
}

// ── Tool 4: Suggest Diagnostic Pathway ──

function registerSuggestPathway(server: McpServer): void {
  server.registerTool(
    "suggest_diagnostic_pathway",
    {
      description: "Based on the differential diagnosis, recommends specific next steps: which genetic test to order, which specialist to see, what clinical investigations to pursue. Prioritizes the least invasive, most informative options first.",
      inputSchema: PathwaySchema,
    },
    async (params) => {
      if (!params.patient_id || !params.differential_json) {
        return { content: [{ type: "text" as const, text: "Error: patient_id and differential_json are required" }] };
      }

      try {
        const differential = JSON.parse(params.differential_json);
        const pathway = await suggestPathway(config, params.patient_id, differential);
        return { content: [{ type: "text" as const, text: JSON.stringify(pathway, null, 2) }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error suggesting pathway: ${message}` }] };
      }
    }
  );
}

// ── Tool 5: Create Navigator Report ──

function registerNavigatorReport(server: McpServer): void {
  server.registerTool(
    "create_navigator_report",
    {
      description: "Generates a compassionate, plain-language 'Diagnostic Navigator Report' that a family can hand to any new doctor. Explains findings, possible conditions, next steps, and provides questions to ask — all without medical jargon.",
      inputSchema: ReportSchema,
    },
    async (params) => {
      if (!params.patient_id || !params.timeline_json || !params.differential_json || !params.pathway_json) {
        return { content: [{ type: "text" as const, text: "Error: all parameters are required" }] };
      }

      try {
        const timeline = JSON.parse(params.timeline_json);
        const differential = JSON.parse(params.differential_json);
        const pathway = JSON.parse(params.pathway_json);

        const report = await createNavigatorReport(config, params.patient_id, timeline, differential, pathway);
        return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error creating navigator report: ${message}` }] };
      }
    }
  );
}

// ── Tool 6: Analyze Family History ──

function registerFamilyHistory(server: McpServer, req: IncomingMessage): void {
  server.registerTool(
    "analyze_family_history",
    {
      description: "Extracts and analyzes hereditary patterns from FHIR FamilyMemberHistory resources. Identifies conditions that recur across family members and inheritance patterns that may narrow the differential diagnosis.",
      inputSchema: FamilyHistorySchema,
    },
    async (params) => {
      const sharpFhir = getSharpFhirContext(req);
      const patientId = params.patient_id || getSharpPatientId(req);

      if (!patientId) {
        return { content: [{ type: "text" as const, text: "Error: patient_id is required" }] };
      }

      const baseUrl = sharpFhir?.url ?? config.fhirBaseUrl;
      const token = sharpFhir?.token;

      try {
        const effectiveConfig = { ...config, fhirBaseUrl: baseUrl };
        const familyHistory = await getPatientFamilyHistory(effectiveConfig, patientId, token);

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

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error analyzing family history: ${message}` }] };
      }
    }
  );
}

// ── Tool 7: Output Phenopacket ──

function registerPhenopacket(server: McpServer): void {
  // @ts-expect-error — TS2589: MCP SDK + Zod type depth issue with enum schemas
  server.registerTool(
    "output_phenopacket",
    {
      description: "Exports the diagnostic findings in GA4GH Phenopacket v2.0 format — the global standard for rare disease data exchange. This makes TinyDx's output interoperable with Exomiser, PhenoTips, research registries, and clinical genetics pipelines worldwide.",
      inputSchema: PhenopacketSchema,
    },
    async (params) => {
      if (!params.patient_id || !params.hpo_terms_json) {
        return { content: [{ type: "text" as const, text: "Error: patient_id and hpo_terms_json are required" }] };
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

        return { content: [{ type: "text" as const, text: JSON.stringify(phenopacket, null, 2) }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error generating Phenopacket: ${message}` }] };
      }
    }
  );
}

// ── Express App ──

const app = express();
app.use(cors());
app.use(express.json());

// API key validation middleware for /mcp endpoint
// Prompt Opinion sends the key via a custom header; name and value from env vars
const MCP_API_KEY = process.env.MCP_API_KEY;
const MCP_API_KEY_HEADER = (process.env.MCP_API_KEY_HEADER ?? "x-api-key").toLowerCase();

function validateApiKey(req: express.Request, res: express.Response, next: express.NextFunction): void {
  // Skip validation if no key configured (dev mode)
  if (!MCP_API_KEY) {
    next();
    return;
  }
  const provided = req.headers[MCP_API_KEY_HEADER];
  if (provided === MCP_API_KEY) {
    next();
    return;
  }
  res.status(401).json({
    jsonrpc: "2.0",
    error: { code: -32001, message: "Unauthorized: invalid or missing API key" },
    id: null,
  });
}

// Health check endpoint (required for Railway + Prompt Opinion)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "tinydx", version: "1.0.0" });
});

// Welcome endpoint
app.get("/", (_req, res) => {
  res.json({
    name: "TinyDx — Rare Disease Diagnostic Navigator",
    version: "1.0.0",
    description: "First MCP server for rare disease diagnostic support. FHIR-native, HPO-powered, family-facing.",
    mcp_endpoint: "/mcp",
    tools: [
      "assemble_symptom_timeline",
      "extract_phenotype_terms",
      "generate_differential",
      "suggest_diagnostic_pathway",
      "create_navigator_report",
      "analyze_family_history",
      "output_phenopacket",
    ],
  });
});

// ── MCP Endpoint (Streamable HTTP) ──
// Per po-community-mcp pattern: new McpServer per request (stateless)

app.post("/mcp", validateApiKey, async (req, res) => {
  const mcpServer = new McpServer(
    {
      name: "tinydx",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: SERVER_INSTRUCTIONS,
    }
  );

  // Register all 7 tools with access to this request's SHARP headers
  registerTools(mcpServer, req);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode
  });

  // Inject FHIR extension into initialize response
  // The SDK strips 'experimental' from capabilities during serialization,
  // so we patch the transport's send to add it back for Prompt Opinion.
  const originalSend = transport.send.bind(transport);
  transport.send = async (message, options) => {
    const msg = message as Record<string, unknown>;
    const result = msg.result as Record<string, unknown> | undefined;
    if (result?.capabilities) {
      const caps = result.capabilities as Record<string, unknown>;
      caps["experimental"] = FHIR_EXTENSION;
    }
    return originalSend(message, options);
  };

  res.on("close", () => {
    transport.close().catch(() => {});
    mcpServer.close().catch(() => {});
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// Handle GET /mcp for SSE streams (not needed in stateless mode)
app.get("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "TinyDx uses stateless mode. Use POST for all requests." },
    id: null,
  });
});

// Handle DELETE /mcp for session cleanup (not needed in stateless mode)
app.delete("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "TinyDx uses stateless mode. Session management is not supported." },
    id: null,
  });
});

// ── Start Server ──

const httpServer = app.listen(PORT, "0.0.0.0", () => {
  console.error(`TinyDx MCP server started on port ${PORT}`); // Rule 14: stderr for logs
  console.error(`Health: http://localhost:${PORT}/health`);
  console.error(`MCP endpoint: http://localhost:${PORT}/mcp`);
});

// Graceful shutdown
function shutdown(): void {
  console.error("Shutting down TinyDx...");
  httpServer.close(() => {
    process.exit(0);
  });
  // Force exit after 5 seconds if graceful shutdown hangs
  setTimeout(() => process.exit(1), 5000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
