/**
 * Full end-to-end smoke test against the live Railway deployment.
 * Tests all 7 TinyDx tools in sequence with Lily Chen patient.
 *
 * Usage: npx tsx scripts/smoke-test.ts [base-url]
 */

const BASE_URL = process.argv[2] ?? "https://diplomatic-freedom-production.up.railway.app";
const API_KEY = process.argv[3] ?? "4fXiHHDg99JJuP4@";
const PATIENT_ID = "lily-chen-001";

interface McpResponse {
  result?: { content?: Array<{ type: string; text: string }> };
  error?: { code: number; message: string };
}

async function callTool(name: string, args: Record<string, string>): Promise<string> {
  const body = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: { name, arguments: args },
    id: Date.now(),
  };

  const res = await fetch(`${BASE_URL}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      pmi: API_KEY,
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  // Parse SSE response: "event: message\ndata: {...}\n\n"
  const dataLine = rawText.split("\n").find((l) => l.startsWith("data: "));
  if (!dataLine) throw new Error(`No data in response (status ${res.status}): ${rawText.substring(0, 300)}`);

  const parsed = JSON.parse(dataLine.replace("data: ", "")) as McpResponse;
  if (parsed.error) throw new Error(`MCP error: ${parsed.error.message}`);

  const toolText = parsed.result?.content?.[0]?.text ?? "";
  if (toolText.startsWith("Error")) throw new Error(`Tool error: ${toolText}`);
  return toolText;
}

async function main(): Promise<void> {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`TinyDx Production Smoke Test`);
  console.log(`Server: ${BASE_URL}`);
  console.log(`Patient: ${PATIENT_ID}`);
  console.log(`${"=".repeat(50)}\n`);

  // Tool 1: assemble_symptom_timeline
  console.log("1/7 — assemble_symptom_timeline");
  const timelineRaw = await callTool("assemble_symptom_timeline", { patient_id: PATIENT_ID });
  const timeline = JSON.parse(timelineRaw);
  console.log(`  OK: ${timeline.entries.length} entries, ${timeline.totalEncounters} encounters, ${timeline.totalProviders} providers, ${timeline.timeSpanMonths} months`);

  // Tool 6: analyze_family_history
  console.log("\n2/7 — analyze_family_history");
  const fmhRaw = await callTool("analyze_family_history", { patient_id: PATIENT_ID });
  const fmh = JSON.parse(fmhRaw);
  console.log(`  OK: ${fmh.familyMembers} family members`);
  for (const s of fmh.summary) console.log(`  - ${s}`);

  // Tool 2: extract_phenotype_terms
  console.log("\n3/7 — extract_phenotype_terms (AI + HPO validation, ~10s)");
  const hpoRaw = await callTool("extract_phenotype_terms", { patient_id: PATIENT_ID });
  const hpoTerms = JSON.parse(hpoRaw) as Array<{ id: string; name: string; confidence: number }>;
  console.log(`  OK: ${hpoTerms.length} HPO terms extracted`);
  for (const t of hpoTerms.slice(0, 6)) console.log(`  - ${t.id} ${t.name} (${t.confidence})`);
  if (hpoTerms.length > 6) console.log(`  ... and ${hpoTerms.length - 6} more`);

  // Tool 3: generate_differential
  console.log("\n4/7 — generate_differential (AI + Orphanet + self-reflection, ~20-30s)");
  const diffRaw = await callTool("generate_differential", {
    patient_id: PATIENT_ID,
    hpo_terms_json: JSON.stringify(hpoTerms),
    family_history_summary: "Father: tall (6'4\"), mild scoliosis, glasses since age 10, double-jointed. Paternal grandmother: died at 45 from heart problems (possible aortic dissection).",
  });
  const diff = JSON.parse(diffRaw);
  console.log(`  OK: ${diff.candidates.length} candidates`);
  for (const c of diff.candidates.slice(0, 3)) {
    console.log(`  #${c.rank} ${c.diseaseName} (${c.confidence}) — ${c.phenotypeOverlapPercent}% overlap`);
  }

  // Tool 4: suggest_diagnostic_pathway
  console.log("\n5/7 — suggest_diagnostic_pathway (~10s)");
  const pathRaw = await callTool("suggest_diagnostic_pathway", {
    patient_id: PATIENT_ID,
    differential_json: JSON.stringify(diff),
  });
  const pathway = JSON.parse(pathRaw);
  console.log(`  OK: ${pathway.recommendations.length} recommendations, top candidate: ${pathway.topCandidate}`);
  for (const r of pathway.recommendations.slice(0, 3)) {
    console.log(`  [${r.priority}] ${r.type}: ${r.description}`);
  }

  // Tool 5: create_navigator_report
  console.log("\n6/7 — create_navigator_report (~10s)");
  const reportRaw = await callTool("create_navigator_report", {
    patient_id: PATIENT_ID,
    timeline_json: timelineRaw,
    differential_json: JSON.stringify(diff),
    pathway_json: JSON.stringify(pathway),
  });
  const report = JSON.parse(reportRaw);
  console.log(`  OK: Navigator Report generated`);
  console.log(`  Summary: ${report.summary.substring(0, 150)}...`);
  console.log(`  Questions for doctor: ${report.questionsForYourDoctor?.length ?? 0}`);
  console.log(`  Support resources: ${report.supportResources?.length ?? 0}`);

  // Tool 7: output_phenopacket
  console.log("\n7/7 — output_phenopacket");
  const phenoRaw = await callTool("output_phenopacket", {
    patient_id: PATIENT_ID,
    hpo_terms_json: JSON.stringify(hpoTerms),
    differential_json: JSON.stringify(diff),
    patient_sex: "FEMALE",
    patient_dob: "2020-03-15",
  });
  const pheno = JSON.parse(phenoRaw);
  console.log(`  OK: Phenopacket ${pheno.id}`);
  console.log(`  Subject: ${pheno.subject.id} (${pheno.subject.sex}, DOB ${pheno.subject.dateOfBirth})`);
  console.log(`  Phenotypic features: ${pheno.phenotypicFeatures.length}`);
  console.log(`  Interpretations: ${pheno.interpretations.length}`);
  console.log(`  Schema version: ${pheno.metaData.phenopacketSchemaVersion}`);

  console.log(`\n${"=".repeat(50)}`);
  console.log(`ALL 7 TOOLS PASSED`);
  console.log(`${"=".repeat(50)}\n`);
}

main().catch((err: unknown) => {
  console.error("\nSMOKE TEST FAILED:", err);
  process.exit(1);
});
