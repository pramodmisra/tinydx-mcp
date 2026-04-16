/**
 * TinyDx Domain Types
 * Power of 15: Rule 6 — minimal scope, const by default
 * Power of 15: Rule 9 — max 1 level of indirection
 */

// ── FHIR Resource Types (simplified for our use case) ──

export interface FhirCondition {
  readonly resourceType: "Condition";
  readonly id: string;
  readonly code: {
    readonly coding: ReadonlyArray<{ system: string; code: string; display: string }>;
    readonly text?: string;
  };
  readonly onsetDateTime?: string;
  readonly onsetAge?: { value: number; unit: string };
  readonly clinicalStatus?: { coding: ReadonlyArray<{ code: string }> };
  readonly subject: { reference: string };
}

export interface FhirObservation {
  readonly resourceType: "Observation";
  readonly id: string;
  readonly code: {
    readonly coding: ReadonlyArray<{ system: string; code: string; display: string }>;
    readonly text?: string;
  };
  readonly valueQuantity?: { value: number; unit: string };
  readonly valueString?: string;
  readonly effectiveDateTime?: string;
  readonly status: string;
}

export interface FhirFamilyMemberHistory {
  readonly resourceType: "FamilyMemberHistory";
  readonly id: string;
  readonly relationship: {
    readonly coding: ReadonlyArray<{ code: string; display: string }>;
  };
  readonly condition?: ReadonlyArray<{
    code: { coding: ReadonlyArray<{ display: string }>; text?: string };
    onsetAge?: { value: number; unit: string };
  }>;
}

export interface FhirEncounter {
  readonly resourceType: "Encounter";
  readonly id: string;
  readonly period?: { start: string; end?: string };
  readonly reasonCode?: ReadonlyArray<{
    coding: ReadonlyArray<{ display: string }>;
    text?: string;
  }>;
  readonly type?: ReadonlyArray<{
    coding: ReadonlyArray<{ display: string }>;
  }>;
  readonly serviceProvider?: { display: string };
}

// ── HPO Types ──

export interface HpoTerm {
  readonly id: string;        // e.g., "HP:0001250"
  readonly name: string;      // e.g., "Seizures"
  readonly confidence: number; // 0.0 - 1.0, how confident we are in the mapping
}

// ── Symptom Timeline ──

export interface TimelineEntry {
  readonly date: string;
  readonly source: "Condition" | "Observation" | "Encounter";
  readonly description: string;
  readonly code?: string;
  readonly provider?: string;
}

export interface SymptomTimeline {
  readonly patientId: string;
  readonly patientAge?: string;
  readonly entries: ReadonlyArray<TimelineEntry>;
  readonly totalEncounters: number;
  readonly totalProviders: number;
  readonly timeSpanMonths: number;
}

// ── Differential Diagnosis ──

export interface DiseaseCandidate {
  readonly rank: number;
  readonly diseaseName: string;
  readonly orphaCode?: string;
  readonly omimId?: string;
  readonly matchingPhenotypes: ReadonlyArray<string>;
  readonly unmatchedPhenotypes: ReadonlyArray<string>;
  readonly phenotypeOverlapPercent: number;
  readonly confidence: "HIGH" | "MODERATE" | "LOW";
  readonly reasoning: string;
  readonly evidence: ReadonlyArray<string>;
}

export interface DifferentialDiagnosis {
  readonly patientId: string;
  readonly hpoTermsUsed: ReadonlyArray<HpoTerm>;
  readonly candidates: ReadonlyArray<DiseaseCandidate>;
  readonly unexplainedSymptoms: ReadonlyArray<string>;
  readonly generatedAt: string;
}

// ── Diagnostic Pathway ──

export interface DiagnosticRecommendation {
  readonly priority: "URGENT" | "HIGH" | "STANDARD";
  readonly type: "genetic_test" | "specialist_referral" | "clinical_investigation" | "imaging";
  readonly description: string;
  readonly rationale: string;
}

export interface DiagnosticPathway {
  readonly patientId: string;
  readonly topCandidate: string;
  readonly recommendations: ReadonlyArray<DiagnosticRecommendation>;
  readonly estimatedTimeToAnswer: string;
}

// ── Family Navigator Report ──

export interface NavigatorReport {
  readonly patientId: string;
  readonly patientName: string;
  readonly generatedAt: string;
  readonly summary: string;              // Plain-language overview
  readonly whatWeFound: string;           // Symptoms assembled
  readonly possibleConditions: string;    // Top candidates explained simply
  readonly nextSteps: string;            // What to do next
  readonly questionsForYourDoctor: ReadonlyArray<string>;
  readonly supportResources: ReadonlyArray<string>;
}

// ── Phenopacket (GA4GH v2.0 simplified) ──

export interface PhenopacketOutput {
  readonly id: string;
  readonly subject: {
    readonly id: string;
    readonly dateOfBirth?: string;
    readonly sex?: "MALE" | "FEMALE" | "OTHER_SEX" | "UNKNOWN_SEX";
  };
  readonly phenotypicFeatures: ReadonlyArray<{
    readonly type: { id: string; label: string };
    readonly onset?: { id: string; label: string };
    readonly excluded: boolean;
  }>;
  readonly interpretations: ReadonlyArray<{
    readonly diagnosis: {
      readonly disease: { id: string; label: string };
    };
    readonly progressStatus: "SOLVED" | "IN_PROGRESS" | "UNKNOWN_PROGRESS";
  }>;
  readonly metaData: {
    readonly created: string;
    readonly createdBy: string;
    readonly phenopacketSchemaVersion: string;
    readonly resources: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
      readonly url: string;
      readonly version: string;
      readonly namespacePrefix: string;
    }>;
  };
}

// ── SHARP Context ──

export interface SharpContext {
  readonly patientId: string;
  readonly fhirBaseUrl: string;
  readonly fhirAccessToken?: string;
  readonly encounterContext?: string;
  readonly practitionerId?: string;
}

// ── Configuration ──

export interface TinyDxConfig {
  readonly anthropicApiKey: string;
  readonly fhirBaseUrl: string;
  readonly omimApiKey?: string;
  readonly hpoApiBase: string;
  readonly orphanetApiBase: string;
  readonly port: number;
  readonly maxCandidates: number;
  readonly maxHpoTerms: number;
  readonly maxFhirPages: number;
}

// ── HPO API Types ──

export interface HpoSearchResult {
  readonly id: string;       // e.g., "HP:0002650"
  readonly name: string;     // e.g., "Scoliosis"
}

// ── Orphanet API Types ──

export interface OrphanetHpoAssociation {
  readonly hpoId: string;
  readonly hpoTerm: string;
  readonly frequency: string;  // e.g., "Very frequent (99-80%)"
  readonly diagnosticCriteria: boolean;
}

export interface OrphanetDisease {
  readonly orphaCode: number;
  readonly name: string;
  readonly orphanetUrl: string;
  readonly hpoAssociations: ReadonlyArray<OrphanetHpoAssociation>;
}

export interface OrphanetNaturalHistory {
  readonly orphaCode: number;
  readonly name: string;
  readonly inheritanceTypes: ReadonlyArray<string>;
  readonly averageAgeOfOnset: ReadonlyArray<string>;
}

export interface OrphanetCrossRef {
  readonly orphaCode: number;
  readonly name: string;
  readonly externalReferences: ReadonlyArray<{
    source: string;
    reference: string;
  }>;
}
