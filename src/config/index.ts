/**
 * TinyDx Configuration
 * Power of 15: Rule 14 — No hardcoded secrets, all from env vars
 * Power of 15: Rule 5 — Assertions on every required config value
 */
import type { TinyDxConfig } from "../types/index.js";

const MAX_CANDIDATES = 10;
const MAX_HPO_TERMS = 50;
const MAX_FHIR_PAGES = 20;
const DEFAULT_PORT = 3000;

export function loadConfig(): TinyDxConfig {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const fhirBaseUrl = process.env.FHIR_BASE_URL ?? "https://hapi.fhir.org/baseR4";
  const omimApiKey = process.env.OMIM_API_KEY;
  const hpoApiBase = process.env.HPO_API_BASE ?? "https://clinicaltables.nlm.nih.gov/api/hpo/v3";
  const orphanetApiBase = process.env.ORPHANET_API_BASE ?? "https://api.orphadata.com";
  const port = parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);

  // Rule 5: Assert required values
  if (!anthropicApiKey || anthropicApiKey.length === 0) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }
  if (!fhirBaseUrl.startsWith("http")) {
    throw new Error("FHIR_BASE_URL must be a valid HTTP(S) URL");
  }

  return Object.freeze({
    anthropicApiKey,
    fhirBaseUrl,
    omimApiKey,
    hpoApiBase,
    orphanetApiBase,
    port,
    maxCandidates: MAX_CANDIDATES,
    maxHpoTerms: MAX_HPO_TERMS,
    maxFhirPages: MAX_FHIR_PAGES,
  });
}
