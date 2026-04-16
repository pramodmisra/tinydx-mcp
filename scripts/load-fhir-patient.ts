/**
 * Load Lily Chen synthetic patient into HAPI FHIR public test server.
 *
 * Usage: npx tsx scripts/load-fhir-patient.ts [fhir-base-url]
 *
 * The script uses PUT with explicit IDs — idempotent and re-runnable.
 * HAPI FHIR public server wipes periodically, so this may need to be re-run.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FHIR_BASE = process.argv[2] ?? "https://hapi.fhir.org/baseR4";
const BUNDLE_PATH = resolve(import.meta.dirname ?? ".", "../data/lily-chen-bundle.json");

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

interface BundleEntry {
  resource: { resourceType: string; id?: string };
  request: { method: string; url: string };
}

interface BundleResponseEntry {
  response: { status: string; location?: string };
}

async function fetchWithRetry(url: string, options: RequestInit, retries: number = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (error: unknown) {
      if (attempt === retries - 1) throw error;
      console.log(`  Retry ${attempt + 1}/${retries}...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }
  throw new Error("Unreachable");
}

async function main(): Promise<void> {
  console.log(`Loading Lily Chen patient into ${FHIR_BASE}`);
  console.log(`Bundle: ${BUNDLE_PATH}\n`);

  const bundleText = readFileSync(BUNDLE_PATH, "utf-8");
  const bundle = JSON.parse(bundleText) as { entry: BundleEntry[] };

  console.log(`Resources in bundle: ${bundle.entry.length}`);
  console.log("---");

  // Post the transaction bundle
  const response = await fetchWithRetry(FHIR_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/fhir+json",
      Accept: "application/fhir+json",
    },
    body: bundleText,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`FHIR transaction FAILED: ${response.status} ${response.statusText}`);
    console.error(errorText.substring(0, 1000));
    process.exit(1);
  }

  const result = (await response.json()) as { entry?: BundleResponseEntry[] };
  const entries = result.entry ?? [];

  console.log(`\nTransaction result: ${response.status}`);
  console.log(`Entries returned: ${entries.length}\n`);

  let successCount = 0;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const srcEntry = bundle.entry[i];
    const status = entry.response.status;
    const resourceDesc = `${srcEntry.resource.resourceType}/${srcEntry.resource.id ?? "?"}`;
    const ok = status.startsWith("200") || status.startsWith("201");
    console.log(`  ${ok ? "OK" : "!!"} ${resourceDesc} — ${status}`);
    if (ok) successCount++;
  }

  console.log(`\n--- ${successCount}/${entries.length} resources loaded successfully ---`);

  // Verify patient exists
  console.log("\nVerification: querying Patient/lily-chen-001...");
  const verifyRes = await fetchWithRetry(`${FHIR_BASE}/Patient/lily-chen-001`, {
    headers: { Accept: "application/fhir+json" },
  });

  if (verifyRes.ok) {
    const patient = (await verifyRes.json()) as { name?: Array<{ given?: string[]; family?: string }> };
    const name = patient.name?.[0];
    console.log(`  Patient found: ${name?.given?.[0]} ${name?.family}`);
  } else {
    console.error(`  Patient NOT found: ${verifyRes.status}`);
  }

  // Verify conditions count
  const condRes = await fetchWithRetry(
    `${FHIR_BASE}/Condition?patient=lily-chen-001&_summary=count`,
    { headers: { Accept: "application/fhir+json" } }
  );
  if (condRes.ok) {
    const condBundle = (await condRes.json()) as { total?: number };
    console.log(`  Conditions: ${condBundle.total ?? "?"} found`);
  }

  // Verify encounters count
  const encRes = await fetchWithRetry(
    `${FHIR_BASE}/Encounter?patient=lily-chen-001&_summary=count`,
    { headers: { Accept: "application/fhir+json" } }
  );
  if (encRes.ok) {
    const encBundle = (await encRes.json()) as { total?: number };
    console.log(`  Encounters: ${encBundle.total ?? "?"} found`);
  }

  // Verify family history count
  const fmhRes = await fetchWithRetry(
    `${FHIR_BASE}/FamilyMemberHistory?patient=lily-chen-001&_summary=count`,
    { headers: { Accept: "application/fhir+json" } }
  );
  if (fmhRes.ok) {
    const fmhBundle = (await fmhRes.json()) as { total?: number };
    console.log(`  FamilyMemberHistory: ${fmhBundle.total ?? "?"} found`);
  }

  console.log("\nDone. Patient ID for testing: lily-chen-001");
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
