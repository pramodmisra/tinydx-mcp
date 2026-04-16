/**
 * SHARP Context Extraction Module
 *
 * Extracts healthcare context from HTTP headers per the SHARP-on-MCP spec
 * used by the Prompt Opinion platform. SHARP bridges EHR session credentials
 * into MCP tool calls via standardized headers.
 *
 * Reference: https://sharponmcp.com/getting-started
 * Reference: github.com/prompt-opinion/po-community-mcp
 *
 * Power of 15: Rule 14 — No PHI in logs
 */
import { decodeJwt } from "jose";
import type { IncomingMessage } from "node:http";

// ── SHARP Header Constants (matching po-community-mcp/mcp-constants.ts) ──

export const SHARP_HEADERS = {
  FHIR_SERVER_URL: "x-fhir-server-url",
  FHIR_ACCESS_TOKEN: "x-fhir-access-token",
  PATIENT_ID: "x-patient-id",
} as const;

// ── Types ──

export interface FhirContext {
  readonly url: string;
  readonly token?: string;
}

// ── Context Extraction Functions ──

/**
 * Extract FHIR server context (URL + token) from SHARP HTTP headers.
 * Returns null if no FHIR server URL is present in headers.
 */
export function getSharpFhirContext(
  req: IncomingMessage
): FhirContext | null {
  const url = getHeader(req, SHARP_HEADERS.FHIR_SERVER_URL);
  if (!url) return null;

  const token = getHeader(req, SHARP_HEADERS.FHIR_ACCESS_TOKEN);
  return { url, token: token ?? undefined };
}

/**
 * Extract patient ID from SHARP context.
 *
 * Strategy (matching po-community-mcp/fhir-utilities.ts):
 * 1. If access token present, decode JWT and look for "patient" claim
 * 2. Fall back to x-patient-id header
 * 3. Return null if neither source has a patient ID
 */
export function getSharpPatientId(
  req: IncomingMessage
): string | null {
  // Try JWT patient claim first
  const token = getHeader(req, SHARP_HEADERS.FHIR_ACCESS_TOKEN);
  if (token) {
    try {
      const claims = decodeJwt(token);
      const patientClaim = claims["patient"];
      if (typeof patientClaim === "string" && patientClaim.length > 0) {
        return patientClaim;
      }
    } catch {
      // Token is not a valid JWT — fall through to header
    }
  }

  // Fall back to explicit header
  return getHeader(req, SHARP_HEADERS.PATIENT_ID) ?? null;
}

// ── Helper ──

function getHeader(
  req: IncomingMessage,
  name: string
): string | undefined {
  const value = req.headers[name];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }
  return undefined;
}
