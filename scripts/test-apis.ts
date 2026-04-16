/**
 * Quick test for HPO and Orphanet API services.
 * Usage: npx tsx scripts/test-apis.ts
 */
import { searchHpoByName, validateHpoTerm, batchValidateHpoTerms } from "../src/services/hpo.js";
import { searchDiseasesByHpoTerms, getNaturalHistory, calculatePhenotypeOverlap } from "../src/services/orphanet.js";

async function testHpo(): Promise<void> {
  console.log("=== HPO API Tests ===\n");

  // Search
  const results = await searchHpoByName("scoliosis");
  console.log("Search 'scoliosis':", JSON.stringify(results));

  // Validate correct ID
  const v1 = await validateHpoTerm({ id: "HP:0002650", name: "Scoliosis", confidence: 0.95 });
  console.log("Validate HP:0002650 (correct):", JSON.stringify(v1));

  // Validate hallucinated ID
  const v2 = await validateHpoTerm({ id: "HP:9999999", name: "Scoliosis", confidence: 0.90 });
  console.log("Validate HP:9999999 (hallucinated):", JSON.stringify(v2));

  // Batch validate — mix of correct and bad IDs
  const batch = await batchValidateHpoTerms([
    { id: "HP:0002650", name: "Scoliosis", confidence: 0.95 },
    { id: "HP:0001083", name: "Ectopia lentis", confidence: 0.90 },
    { id: "HP:0000000", name: "Arachnodactyly", confidence: 0.85 },
  ]);
  console.log("Batch validated:", batch.map((t) => `${t.id} ${t.name}`).join(", "));
}

async function testOrphanet(): Promise<void> {
  console.log("\n=== Orphanet API Tests ===\n");

  // Search by Marfan-typical HPO terms
  const marfanHpo = ["HP:0001083", "HP:0002650", "HP:0001166", "HP:0000768", "HP:0001634"];
  const diseases = await searchDiseasesByHpoTerms(marfanHpo);
  console.log(`Diseases matching Marfan HPO terms: ${diseases.length}`);
  for (const d of diseases.slice(0, 5)) {
    const overlap = calculatePhenotypeOverlap(marfanHpo, d);
    console.log(`  ORPHA:${d.orphaCode} — ${d.name} (${overlap}% overlap, ${d.hpoAssociations.length} HPO terms)`);
  }

  // Natural history for Marfan
  if (diseases.length > 0) {
    const history = await getNaturalHistory(diseases[0].orphaCode);
    if (history) {
      console.log(`\nNatural history for ${history.name}:`);
      console.log(`  Inheritance: ${history.inheritanceTypes.join(", ")}`);
      console.log(`  Age of onset: ${history.averageAgeOfOnset.join(", ")}`);
    }
  }
}

async function main(): Promise<void> {
  await testHpo();
  await testOrphanet();
  console.log("\n=== All API tests complete ===");
}

main().catch((err: unknown) => {
  console.error("Test failed:", err);
  process.exit(1);
});
