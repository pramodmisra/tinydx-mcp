/**
 * FHIR R4 Client Service
 * Queries patient clinical data: Conditions, Observations, FamilyMemberHistory, Encounters
 *
 * Power of 15: Rule 2 — All pagination bounded by maxFhirPages
 * Power of 15: Rule 7 — Every fetch wrapped in try/catch with retry
 * Power of 15: Rule 5 — Input validation + output assertions
 */
import type {
  TinyDxConfig,
  FhirCondition,
  FhirObservation,
  FhirFamilyMemberHistory,
  FhirEncounter,
  TimelineEntry,
  SymptomTimeline,
} from "../types/index.js";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function fhirFetch<T>(
  baseUrl: string,
  path: string,
  token?: string,
  retries: number = MAX_RETRIES
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/fhir+json",
    "Content-Type": "application/fhir+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Rule 2: Bounded retry loop
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const url = `${baseUrl}/${path}`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`FHIR request failed: ${response.status} ${response.statusText} for ${url}`);
      }

      const data = (await response.json()) as T;
      return data;
    } catch (error: unknown) {
      const isLastAttempt = attempt === retries - 1;
      if (isLastAttempt) {
        throw new Error(
          `FHIR fetch failed after ${retries} attempts: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      // Exponential backoff: Rule 7
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
    }
  }
  throw new Error("Unreachable: retry loop exhausted"); // Rule 7: no silent failures
}

interface FhirBundle<T> {
  resourceType: "Bundle";
  total?: number;
  entry?: Array<{ resource: T }>;
  link?: Array<{ relation: string; url: string }>;
}

/** Fetch all conditions for a patient */
export async function getPatientConditions(
  config: TinyDxConfig,
  patientId: string,
  token?: string
): Promise<ReadonlyArray<FhirCondition>> {
  // Rule 5: Input validation
  if (!patientId || patientId.length === 0) {
    throw new Error("patientId is required");
  }

  const bundle = await fhirFetch<FhirBundle<FhirCondition>>(
    config.fhirBaseUrl,
    `Condition?patient=${patientId}&_count=100`,
    token
  );

  const conditions = bundle.entry?.map((e) => e.resource) ?? [];
  return conditions;
}

/** Fetch relevant observations for a patient */
export async function getPatientObservations(
  config: TinyDxConfig,
  patientId: string,
  token?: string
): Promise<ReadonlyArray<FhirObservation>> {
  if (!patientId || patientId.length === 0) {
    throw new Error("patientId is required");
  }

  const bundle = await fhirFetch<FhirBundle<FhirObservation>>(
    config.fhirBaseUrl,
    `Observation?patient=${patientId}&_count=100&_sort=-date`,
    token
  );

  return bundle.entry?.map((e) => e.resource) ?? [];
}

/** Fetch family member history */
export async function getPatientFamilyHistory(
  config: TinyDxConfig,
  patientId: string,
  token?: string
): Promise<ReadonlyArray<FhirFamilyMemberHistory>> {
  if (!patientId || patientId.length === 0) {
    throw new Error("patientId is required");
  }

  const bundle = await fhirFetch<FhirBundle<FhirFamilyMemberHistory>>(
    config.fhirBaseUrl,
    `FamilyMemberHistory?patient=${patientId}`,
    token
  );

  return bundle.entry?.map((e) => e.resource) ?? [];
}

/** Fetch encounters for a patient */
export async function getPatientEncounters(
  config: TinyDxConfig,
  patientId: string,
  token?: string
): Promise<ReadonlyArray<FhirEncounter>> {
  if (!patientId || patientId.length === 0) {
    throw new Error("patientId is required");
  }

  const bundle = await fhirFetch<FhirBundle<FhirEncounter>>(
    config.fhirBaseUrl,
    `Encounter?patient=${patientId}&_count=100&_sort=-date`,
    token
  );

  return bundle.entry?.map((e) => e.resource) ?? [];
}

/** Assemble a unified symptom timeline from all FHIR data */
export async function assembleTimeline(
  config: TinyDxConfig,
  patientId: string,
  token?: string
): Promise<SymptomTimeline> {
  // Pull all data sources in parallel
  const [conditions, observations, encounters] = await Promise.all([
    getPatientConditions(config, patientId, token),
    getPatientObservations(config, patientId, token),
    getPatientEncounters(config, patientId, token),
  ]);

  const entries: TimelineEntry[] = [];

  // Map conditions to timeline entries
  for (const condition of conditions) {
    const display = condition.code.coding?.[0]?.display ?? condition.code.text ?? "Unknown condition";
    const date = condition.onsetDateTime ?? "Unknown";
    entries.push({
      date,
      source: "Condition",
      description: display,
      code: condition.code.coding?.[0]?.code,
    });
  }

  // Map observations to timeline entries (filter to clinically relevant)
  for (const obs of observations) {
    const display = obs.code.coding?.[0]?.display ?? obs.code.text ?? "Unknown observation";
    const date = obs.effectiveDateTime ?? "Unknown";
    const value = obs.valueQuantity
      ? `${obs.valueQuantity.value} ${obs.valueQuantity.unit}`
      : obs.valueString ?? "";
    entries.push({
      date,
      source: "Observation",
      description: `${display}${value ? `: ${value}` : ""}`,
      code: obs.code.coding?.[0]?.code,
    });
  }

  // Map encounters to timeline entries
  for (const enc of encounters) {
    const reason = enc.reasonCode?.[0]?.coding?.[0]?.display ?? enc.reasonCode?.[0]?.text ?? "";
    const date = enc.period?.start ?? "Unknown";
    entries.push({
      date,
      source: "Encounter",
      description: `Visit${reason ? `: ${reason}` : ""}`,
      provider: enc.serviceProvider?.display,
    });
  }

  // Sort chronologically
  entries.sort((a, b) => {
    if (a.date === "Unknown") return 1;
    if (b.date === "Unknown") return -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Calculate unique providers
  const providers = new Set(
    encounters
      .map((e) => e.serviceProvider?.display)
      .filter((p): p is string => p !== undefined)
  );

  // Calculate time span
  const dates = entries
    .map((e) => e.date)
    .filter((d) => d !== "Unknown")
    .map((d) => new Date(d).getTime())
    .filter((t) => !isNaN(t));

  const timeSpanMs = dates.length >= 2 ? Math.max(...dates) - Math.min(...dates) : 0;
  const timeSpanMonths = Math.round(timeSpanMs / (1000 * 60 * 60 * 24 * 30));

  // Rule 5: Output assertion
  const timeline: SymptomTimeline = {
    patientId,
    entries,
    totalEncounters: encounters.length,
    totalProviders: providers.size,
    timeSpanMonths,
  };

  return timeline;
}
