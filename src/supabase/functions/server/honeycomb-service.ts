/**
 * Honeycomb Integration — Service Layer
 *
 * Per Guidelines §4.2: Services own business logic, KV access patterns,
 * and cross-entity consistency. Route handlers are thin dispatchers
 * that call into this service.
 *
 * This module centralises:
 * - Authenticated HTTP calls to the Honeycomb public API
 * - Rate-limit retry logic (429 backoff)
 * - KV storage for matter IDs, results, and activity logs
 * - ID validation and normalisation
 */

import { createModuleLogger } from "./stderr-logger.ts";
import * as kv from "./kv_store.tsx";
import type {
  HoneycombNaturalPersonRequest,
  HoneycombCheckResult,
  HoneycombCheckType,
  ServiceResult,
  HoneycombIdvResponse,
  HoneycombBankVerificationResponse,
  HoneycombCreditResponse,
  HoneycombSanctionsResponse,
  HoneycombTraceResponse,
  HoneycombDebtReviewResponse,
  HoneycombCipcResponse,
  HoneycombDirectorResponse,
  HoneycombEnforcementResponse,
  HoneycombAddressResponse,
  HoneycombCustomScreeningResponse,
  HoneycombLegalAListingResponse,
  HoneycombLifestyleAuditResponse,
  HoneycombIncomePredictorResponse,
  HoneycombTendersBlueResponse,
  HoneycombBulkIdvResponse,
  ComplianceDashboardData,
  ComplianceCategory,
  CategoryStatus,
  CheckStatus,
  RiskFlag,
} from "./honeycomb-types.ts";

const log = createModuleLogger("honeycomb-service");

const HONEYCOMB_API_URL = "https://publicapi.honeycombonline.co.za";
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/** Sentinel values that indicate "no real ID number" */
const INVALID_ID_SENTINELS = [
  "not provided", "n/a", "undefined", "null", "none", "-", "",
];

// ============================================================================
// HELPERS
// ============================================================================

/** Check if a string is a real identification value (not a sentinel/placeholder) */
export function isRealIdNumber(val: unknown): val is string {
  return (
    typeof val === "string" &&
    val.trim().length > 0 &&
    !INVALID_ID_SENTINELS.includes(val.trim().toLowerCase())
  );
}

/** Check if a value is a valid UUID / non-nil ID */
function isValidId(id: unknown): boolean {
  return typeof id === "string" && id.length > 0 && id !== NIL_UUID;
}

/** Get authenticated headers for Honeycomb API */
function getHeaders(): Record<string, string> {
  const apiKey = Deno.env.get("HONEYCOMB_API_KEY");
  if (!apiKey) {
    throw new Error("HONEYCOMB_API_KEY is not configured");
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "NavigateWealth-Admin/1.0",
  };
}

/**
 * Extract a usable ID from various Honeycomb response shapes.
 * The API returns different key names depending on the endpoint.
 */
export function extractId(data: Record<string, unknown>): string | null {
  // 1. Top-level keys
  const topLevelKeys = [
    "Id", "ClientId", "ReferenceId", "id", "PersonId",
    "NaturalPersonId", "naturalPersonId", "reference",
  ];
  for (const key of topLevelKeys) {
    if (isValidId(data[key])) return data[key] as string;
  }

  // 2. Nested objects
  const nestedPaths = ["naturalPerson", "entity", "client", "result", "data"];
  for (const path of nestedPaths) {
    const nested = data[path] as Record<string, unknown> | undefined;
    if (nested && isValidId(nested.id)) return nested.id as string;
  }

  // 3. Fallback: search for any key containing "id"
  const probableKey = Object.keys(data).find(
    (k) =>
      (k.toLowerCase().includes("id") && !k.toLowerCase().includes("valid")) ||
      k.toLowerCase() === "code"
  );
  if (probableKey && isValidId(data[probableKey])) {
    log.info(`Found probable ID in key: ${probableKey}`);
    return data[probableKey] as string;
  }

  return null;
}

/**
 * Centralised HTTP caller with rate-limit retry (429 backoff).
 * All Honeycomb API calls go through this function.
 */
async function callHoneycomb(
  method: string,
  path: string,
  body?: unknown,
  maxRetries = 3,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null; raw?: string }> {
  const url = `${HONEYCOMB_API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = getHeaders();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      log.info(`Honeycomb ${method} ${url} (attempt ${attempt + 1})`);

      const fetchOpts: RequestInit = {
        method,
        headers,
      };
      if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
        fetchOpts.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOpts);

      // Handle rate limiting with exponential backoff
      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(1000 * Math.pow(2, attempt), 30000);
        log.warn(`Rate limited (429). Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Parse response
      const rawText = await response.text();
      let data: Record<string, unknown> | null;
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }

      return { ok: response.ok, status: response.status, data, raw: rawText };
    } catch (err) {
      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt);
        log.warn(`Network error, retrying in ${delay}ms:`, { error: (err as Error).message });
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }

  // Unreachable, but satisfies TS
  throw new Error("Max retries exhausted");
}

/** Build the standard natural-person payload from normalised inputs */
function buildPersonPayload(
  clientId: string,
  firstName: string,
  lastName: string,
  idNumber: string | null,
  passport: string | null,
): HoneycombNaturalPersonRequest {
  return {
    uniqueId: clientId,
    firstName,
    surname: lastName,
    identityNumber: isRealIdNumber(idNumber) ? idNumber : "",
    passport: isRealIdNumber(passport) ? passport : "",
  };
}

/** Require at least one form of identification */
function requireIdentification(idNumber: string | null, passport: string | null): void {
  if (!isRealIdNumber(idNumber) && !isRealIdNumber(passport)) {
    throw new Error(
      "Client has no valid ID number or passport. " +
      "Please update their profile before running this check."
    );
  }
}

// ============================================================================
// ACTIVITY LOGGING (KV)
// ============================================================================

/** Log a compliance activity entry for a client */
export async function logActivity(
  clientId: string,
  type: string,
  details: Record<string, unknown>,
): Promise<{ id: string }> {
  const key = `honeycomb_activity:${clientId}`;
  const existing = (await kv.get(key)) || [];
  const entry = {
    id: crypto.randomUUID(),
    type,
    date: new Date().toISOString(),
    details,
    status: "Completed",
  };
  await kv.set(key, [entry, ...(Array.isArray(existing) ? existing : [])]);
  return { id: entry.id };
}

/** Store a check result in KV and log it as activity */
async function storeCheckResult(
  clientId: string,
  checkType: HoneycombCheckType,
  matterId: string | null,
  summary: string,
  rawResponse: unknown,
): Promise<HoneycombCheckResult> {
  const result: HoneycombCheckResult = {
    id: crypto.randomUUID(),
    checkType,
    clientId,
    matterId,
    submittedAt: new Date().toISOString(),
    status: "completed",
    summary,
    rawResponse,
  };

  // Store in check-type-specific history
  const historyKey = `honeycomb_checks:${clientId}:${checkType}`;
  const existing = (await kv.get(historyKey)) || [];
  await kv.set(historyKey, [result, ...(Array.isArray(existing) ? existing : [])]);

  return result;
}

// ============================================================================
// SERVICE METHODS
// ============================================================================

/**
 * IDV — Identity Verification (No Photo)
 * Honeycomb endpoint: POST /natural-person-idv-no-photo-no-upload
 */
export async function runIdvNoPhoto(
  clientId: string,
  firstName: string,
  lastName: string,
  idNumber: string | null,
  passport: string | null,
  secondary = false,
): Promise<ServiceResult<HoneycombIdvResponse>> {
  try {
    requireIdentification(idNumber, passport);
    const payload = buildPersonPayload(clientId, firstName, lastName, idNumber, passport);

    const endpoint = secondary
      ? "/natural-person-idv-no-photo-no-upload-secondary"
      : "/natural-person-idv-no-photo-no-upload";

    const checkType: HoneycombCheckType = secondary ? "idv_no_photo_secondary" : "idv_no_photo";

    log.info(`Running IDV (no photo${secondary ? ", secondary" : ""}) for ${clientId}`);

    const { ok, status, data } = await callHoneycomb("POST", endpoint, payload);

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      log.error(`IDV failed (${status}):`, { error: errMsg });
      return { success: false, error: `IDV check failed: ${errMsg}` };
    }

    const matterId = extractId(data) || null;
    const result = await storeCheckResult(clientId, checkType, matterId, "IDV check completed", data);
    await logActivity(clientId, "IDV Report", {
      reportId: result.id,
      matterId,
      checkType,
      verificationStatus: data?.verificationStatus || "completed",
    });

    return { success: true, data, matterId, checkType };
  } catch (err) {
    log.error("IDV (no photo) error:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * IDV — Identity Verification (With Photo)
 * Honeycomb endpoint: POST /natural-person-idv-photo-no-upload
 */
export async function runIdvWithPhoto(
  clientId: string,
  firstName: string,
  lastName: string,
  idNumber: string | null,
  passport: string | null,
  photo: string,
  secondary = false,
): Promise<ServiceResult<HoneycombIdvResponse>> {
  try {
    requireIdentification(idNumber, passport);
    const payload = {
      ...buildPersonPayload(clientId, firstName, lastName, idNumber, passport),
      photo,
    };

    const endpoint = secondary
      ? "/natural-person-idv-photo-no-upload-secondary"
      : "/natural-person-idv-photo-no-upload";

    const checkType: HoneycombCheckType = secondary ? "idv_with_photo_secondary" : "idv_with_photo";

    log.info(`Running IDV (with photo${secondary ? ", secondary" : ""}) for ${clientId}`);

    const { ok, status, data } = await callHoneycomb("POST", endpoint, payload);

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `IDV photo check failed: ${errMsg}` };
    }

    const matterId = extractId(data) || null;
    await storeCheckResult(clientId, checkType, matterId, "IDV photo check completed", data);
    await logActivity(clientId, "IDV Report (Photo)", {
      matterId,
      checkType,
      photoMatch: data?.photoMatch,
    });

    return { success: true, data, matterId, checkType };
  } catch (err) {
    log.error("IDV (with photo) error:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * BANK ACCOUNT VERIFICATION (Real-time)
 * Honeycomb endpoint: POST /natural-person-account-verification-real-time
 */
export async function runBankVerification(
  clientId: string,
  firstName: string,
  lastName: string,
  idNumber: string | null,
  passport: string | null,
  bankName: string,
  accountNumber: string,
  branchCode: string,
  accountType: string,
): Promise<ServiceResult<HoneycombBankVerificationResponse>> {
  try {
    requireIdentification(idNumber, passport);

    const payload = {
      ...buildPersonPayload(clientId, firstName, lastName, idNumber, passport),
      bankName,
      accountNumber,
      branchCode,
      accountType,
    };

    log.info(`Running bank account verification for ${clientId}`);

    const { ok, status, data } = await callHoneycomb(
      "POST",
      "/natural-person-account-verification-real-time",
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Bank verification failed: ${errMsg}` };
    }

    const matterId = extractId(data) || null;
    await storeCheckResult(clientId, "bank_verification", matterId, "Bank verification completed", data);
    await logActivity(clientId, "Bank Verification", {
      matterId,
      verified: data?.verified ?? data?.accountExists,
      bankName,
      // Do NOT log account number (PII) — only bank name
    });

    return { success: true, data, matterId, checkType: "bank_verification" };
  } catch (err) {
    log.error("Bank verification error:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * CONSUMER CREDIT CHECK
 * Honeycomb endpoint: POST /natural-person-consumer-credit
 */
export async function runConsumerCredit(
  clientId: string,
  firstName: string,
  lastName: string,
  idNumber: string | null,
  passport: string | null,
): Promise<ServiceResult<HoneycombCreditResponse>> {
  try {
    requireIdentification(idNumber, passport);
    const payload = buildPersonPayload(clientId, firstName, lastName, idNumber, passport);

    log.info(`Running consumer credit check for ${clientId}`);

    const { ok, status, data } = await callHoneycomb(
      "POST",
      "/natural-person-consumer-credit",
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Credit check failed: ${errMsg}` };
    }

    const matterId = extractId(data) || null;
    await storeCheckResult(clientId, "consumer_credit", matterId, "Credit check completed", data);
    await logActivity(clientId, "Consumer Credit Check", {
      matterId,
      creditScore: data?.creditScore,
      // Do NOT log detailed financial data (PII)
    });

    return { success: true, data, matterId, checkType: "consumer_credit" };
  } catch (err) {
    log.error("Consumer credit error:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * CONSUMER TRACE
 * Honeycomb endpoint: POST /natural-person-consumer-trace
 *
 * Traces the client across credit bureau records to find known addresses,
 * employers, contact numbers, and email addresses linked to their ID.
 */
export async function runConsumerTrace(
  clientId: string,
  firstName: string,
  lastName: string,
  idNumber: string | null,
  passport: string | null,
): Promise<ServiceResult<HoneycombTraceResponse>> {
  try {
    requireIdentification(idNumber, passport);
    const payload = buildPersonPayload(clientId, firstName, lastName, idNumber, passport);

    log.info(`Running consumer trace for ${clientId}`);

    const { ok, status, data } = await callHoneycomb(
      "POST",
      "/natural-person-consumer-trace",
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Consumer trace failed: ${errMsg}` };
    }

    const matterId = extractId(data) || null;
    await storeCheckResult(clientId, "consumer_trace", matterId, "Consumer trace completed", data);
    await logActivity(clientId, "Consumer Trace", {
      matterId,
      checkType: "consumer_trace",
    });

    return { success: true, data, matterId, checkType: "consumer_trace" };
  } catch (err) {
    log.error("Consumer trace error:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * DEBT REVIEW ENQUIRY
 * Honeycomb endpoint: POST /natural-person-debt-review
 *
 * Checks whether the client is currently registered under debt review
 * (debt counselling) via the National Credit Regulator.
 */
export async function runDebtReviewEnquiry(
  clientId: string,
  firstName: string,
  lastName: string,
  idNumber: string | null,
  passport: string | null,
): Promise<ServiceResult<HoneycombDebtReviewResponse>> {
  try {
    requireIdentification(idNumber, passport);
    const payload = buildPersonPayload(clientId, firstName, lastName, idNumber, passport);

    log.info(`Running debt review enquiry for ${clientId}`);

    const { ok, status, data } = await callHoneycomb(
      "POST",
      "/natural-person-debt-review",
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Debt review enquiry failed: ${errMsg}` };
    }

    const matterId = extractId(data) || null;
    const isUnderReview = data?.debtReviewStatus === true || data?.isUnderReview === true;
    await storeCheckResult(
      clientId, "debt_enquiry", matterId,
      isUnderReview ? "Under debt review" : "Not under debt review",
      data,
    );
    await logActivity(clientId, "Debt Review Enquiry", {
      matterId,
      debtReviewStatus: isUnderReview ? "Under Review" : "Clear",
    });

    return { success: true, data, matterId, checkType: "debt_enquiry" };
  } catch (err) {
    log.error("Debt review enquiry error:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * SANCTIONS SEARCH (General)
 * Honeycomb endpoint: GET /search-sanctions-natural-persons
 */
export async function searchSanctions(
  clientId: string,
  name: string,
  surname: string,
  identityNumber?: string,
  uniqueId?: string,
  source?: string,
): Promise<ServiceResult<HoneycombSanctionsResponse>> {
  try {
    // Build query string
    const params = new URLSearchParams();
    if (name) params.append("name", name);
    if (surname) params.append("surname", surname);
    if (identityNumber && isRealIdNumber(identityNumber)) {
      params.append("identityNumber", identityNumber);
    }
    if (uniqueId) params.append("uniqueId", uniqueId);

    // Choose endpoint based on whether source filter is provided
    let endpoint: string;
    if (source) {
      params.append("source", source);
      endpoint = `/search-sanctions-natural-persons-by-source?${params.toString()}`;
    } else {
      endpoint = `/search-sanctions-natural-persons?${params.toString()}`;
    }

    log.info(`Searching sanctions for ${clientId}: ${name} ${surname}`);

    const { ok, status, data } = await callHoneycomb("GET", endpoint);

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Sanctions search failed: ${errMsg}` };
    }

    // Normalise results
    const results = Array.isArray(data) ? data : data?.results || data?.listings || [];
    const totalMatches = results.length;
    const sanctionsData: HoneycombSanctionsResponse = {
      results,
      totalMatches,
      searchedLists: source ? [source] : ["all"],
      ...(typeof data === "object" && data !== null ? data : {}),
    };

    await storeCheckResult(
      clientId,
      "sanctions_search",
      null,
      `Sanctions search: ${totalMatches} match(es)`,
      sanctionsData,
    );
    await logActivity(clientId, "Sanctions Search", {
      totalMatches,
      source: source || "all",
      screeningOutcome: totalMatches === 0 ? "Clear" : "Matches Found",
    });

    return { success: true, data: sanctionsData, checkType: "sanctions_search" };
  } catch (err) {
    log.error("Sanctions search error:", err);
    return { success: false, error: (err as Error).message };
  }
}

// ============================================================================
// PHASE 2 — SEARCH ENDPOINTS (ENFORCEMENT & LEGAL)
// ============================================================================

/**
 * ENFORCEMENT ACTIONS SEARCH
 * Honeycomb endpoint: GET /search-enforcement-actions-natural-persons
 *
 * Uses GET with query parameters — matching the pattern used by the
 * working sanctions search endpoint.
 */
export async function searchEnforcementActions(
  clientId: string,
  name: string,
  surname: string,
  identityNumber?: string,
  uniqueId?: string,
): Promise<ServiceResult<HoneycombEnforcementResponse>> {
  try {
    const params = new URLSearchParams();
    if (name) params.append("name", name);
    if (surname) params.append("surname", surname);
    if (identityNumber && isRealIdNumber(identityNumber)) {
      params.append("identityNumber", identityNumber);
    }
    if (uniqueId) params.append("uniqueId", uniqueId);

    const endpoint = `/search-enforcement-actions-natural-persons?${params.toString()}`;

    log.info(`Searching enforcement actions for ${clientId}: ${name} ${surname}`);

    const { ok, status, data, raw } = await callHoneycomb("GET", endpoint);

    if (!ok) {
      log.error(`Enforcement actions Honeycomb error: status=${status}, raw=${raw?.substring(0, 500)}`);
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Enforcement search failed: ${errMsg}` };
    }

    const results = Array.isArray(data) ? data : data?.results || data?.listings || [];
    const totalMatches = results.length;

    await storeCheckResult(
      clientId,
      "enforcement_actions",
      null,
      `Enforcement: ${totalMatches} match(es)`,
      { results, totalMatches },
    );
    await logActivity(clientId, "Enforcement Actions Search", {
      totalMatches,
      screeningOutcome: totalMatches === 0 ? "Clear" : "Matches Found",
    });

    return {
      success: true,
      data: { results, totalMatches },
      checkType: "enforcement_actions",
    };
  } catch (err) {
    log.error("Enforcement actions search error:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * LEGAL A LISTING SEARCH
 * Honeycomb endpoint: GET /search-legal-a-listing-natural-persons
 *
 * Uses GET with query parameters — matching the pattern used by the
 * working sanctions search endpoint.
 */
export async function searchLegalAListing(
  clientId: string,
  name: string,
  surname: string,
  identityNumber?: string,
  uniqueId?: string,
): Promise<ServiceResult<HoneycombLegalAListingResponse>> {
  try {
    const params = new URLSearchParams();
    if (name) params.append("name", name);
    if (surname) params.append("surname", surname);
    if (identityNumber && isRealIdNumber(identityNumber)) {
      params.append("identityNumber", identityNumber);
    }
    if (uniqueId) params.append("uniqueId", uniqueId);

    const endpoint = `/search-legal-a-listing-natural-persons?${params.toString()}`;

    log.info(`Searching legal A listing for ${clientId}: ${name} ${surname}`);

    const { ok, status, data, raw } = await callHoneycomb("GET", endpoint);

    if (!ok) {
      log.error(`Legal A listing Honeycomb error: status=${status}, raw=${raw?.substring(0, 500)}`);
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Legal A listing search failed: ${errMsg}` };
    }

    const results = Array.isArray(data) ? data : data?.results || data?.listings || [];
    const totalMatches = results.length;

    await storeCheckResult(
      clientId,
      "legal_a_listing",
      null,
      `Legal A: ${totalMatches} match(es)`,
      { results, totalMatches },
    );
    await logActivity(clientId, "Legal A Listing Search", {
      totalMatches,
      screeningOutcome: totalMatches === 0 ? "Clear" : "Matches Found",
    });

    return {
      success: true,
      data: { results, totalMatches },
      checkType: "legal_a_listing",
    };
  } catch (err) {
    log.error("Legal A listing search error:", err);
    return { success: false, error: (err as Error).message };
  }
}

// ============================================================================
// PHASE 2 — CORPORATE & GOVERNANCE
// ============================================================================

/**
 * CIPC COMPANY SEARCH
 * Honeycomb endpoint: POST /natural-person-cipc
 *
 * Searches the CIPC (Companies and Intellectual Property Commission)
 * registry for companies associated with this person's ID number.
 */
export async function runCipcSearch(
  clientId: string,
  firstName: string,
  lastName: string,
  idNumber: string | null,
  passport: string | null,
): Promise<ServiceResult<HoneycombCipcResponse>> {
  try {
    requireIdentification(idNumber, passport);
    const payload = buildPersonPayload(clientId, firstName, lastName, idNumber, passport);

    log.info(`Running CIPC company search for ${clientId}`);

    const { ok, status, data } = await callHoneycomb(
      "POST",
      "/natural-person-cipc",
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `CIPC search failed: ${errMsg}` };
    }

    const matterId = extractId(data) || null;
    const companies = Array.isArray(data?.companies) ? data.companies : (Array.isArray(data) ? data : []);
    await storeCheckResult(clientId, "cipc", matterId, `CIPC: ${companies.length} company/ies`, data);
    await logActivity(clientId, "CIPC Company Search", {
      matterId,
      companiesFound: companies.length,
    });

    return { success: true, data, matterId, checkType: "cipc" };
  } catch (err) {
    log.error("CIPC search error:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * DIRECTOR ENQUIRY
 * Honeycomb endpoint: POST /natural-person-director-enquiry
 *
 * Queries directorship records to find all companies where this person
 * has been or is currently appointed as a director.
 */
export async function runDirectorEnquiry(
  clientId: string,
  firstName: string,
  lastName: string,
  idNumber: string | null,
  passport: string | null,
): Promise<ServiceResult<HoneycombDirectorResponse>> {
  try {
    requireIdentification(idNumber, passport);
    const payload = buildPersonPayload(clientId, firstName, lastName, idNumber, passport);

    log.info(`Running director enquiry for ${clientId}`);

    const { ok, status, data } = await callHoneycomb(
      "POST",
      "/natural-person-director-enquiry",
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Director enquiry failed: ${errMsg}` };
    }

    const matterId = extractId(data) || null;
    const directorships = Array.isArray(data?.directorships) ? data.directorships : [];
    await storeCheckResult(
      clientId, "director_enquiry", matterId,
      `Director enquiry: ${directorships.length} directorship(s)`,
      data,
    );
    await logActivity(clientId, "Director Enquiry", {
      matterId,
      directorshipsFound: directorships.length,
    });

    return { success: true, data, matterId, checkType: "director_enquiry" };
  } catch (err) {
    log.error("Director enquiry error:", err);
    return { success: false, error: (err as Error).message };
  }
}

// ============================================================================
// PHASE 2 — ADDRESS & SCREENING
// ============================================================================

/**
 * BEST KNOWN ADDRESS
 * Honeycomb endpoint: POST /natural-person-address
 *
 * Retrieves the client's known addresses from credit bureau records.
 */
export async function runBestKnownAddress(
  clientId: string,
  firstName: string,
  lastName: string,
  idNumber: string | null,
  passport: string | null,
): Promise<ServiceResult<HoneycombAddressResponse>> {
  try {
    requireIdentification(idNumber, passport);
    const payload = buildPersonPayload(clientId, firstName, lastName, idNumber, passport);

    log.info(`Running best known address lookup for ${clientId}`);

    const { ok, status, data } = await callHoneycomb(
      "POST",
      "/natural-person-address",
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Address lookup failed: ${errMsg}` };
    }

    const matterId = extractId(data) || null;
    await storeCheckResult(clientId, "best_known_address", matterId, "Address lookup completed", data);
    await logActivity(clientId, "Best Known Address", {
      matterId,
      checkType: "best_known_address",
    });

    return { success: true, data, matterId, checkType: "best_known_address" };
  } catch (err) {
    log.error("Best known address error:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * CUSTOM SCREENING
 * Honeycomb endpoint: POST /natural-person-custom-screening
 *
 * Runs a custom screening package configured in the Honeycomb account.
 */
export async function runCustomScreening(
  clientId: string,
  firstName: string,
  lastName: string,
  idNumber: string | null,
  passport: string | null,
  packageId?: string,
  screeningPackage?: string,
): Promise<ServiceResult<HoneycombCustomScreeningResponse>> {
  try {
    requireIdentification(idNumber, passport);
    const payload: Record<string, unknown> = {
      ...buildPersonPayload(clientId, firstName, lastName, idNumber, passport),
    };
    if (packageId) payload.packageId = packageId;
    if (screeningPackage) payload.screeningPackage = screeningPackage;

    log.info(`Running custom screening for ${clientId}`);

    const { ok, status, data } = await callHoneycomb(
      "POST",
      "/natural-person-custom-screening",
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Custom screening failed: ${errMsg}` };
    }

    const matterId = extractId(data) || null;
    await storeCheckResult(clientId, "custom_screening", matterId, "Custom screening completed", data);
    await logActivity(clientId, "Custom Screening", {
      matterId,
      packageId: packageId || "default",
    });

    return { success: true, data, matterId, checkType: "custom_screening" };
  } catch (err) {
    log.error("Custom screening error:", err);
    return { success: false, error: (err as Error).message };
  }
}

// ============================================================================
// PHASE 3 — POST MATTER-CREATION ENDPOINTS
// ============================================================================

/**
 * LIFESTYLE AUDIT
 * Honeycomb endpoint: POST /natural-person-lifestyle-audit
 */
export async function runLifestyleAudit(
  clientId: string,
  firstName: string,
  lastName: string,
  idNumber: string | null,
  passport: string | null,
): Promise<ServiceResult<HoneycombLifestyleAuditResponse>> {
  try {
    requireIdentification(idNumber, passport);
    const payload = buildPersonPayload(clientId, firstName, lastName, idNumber, passport);

    log.info(`Running lifestyle audit for ${clientId}`);

    const { ok, status, data } = await callHoneycomb(
      "POST",
      "/natural-person-lifestyle-audit",
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Lifestyle audit failed: ${errMsg}` };
    }

    const matterId = extractId(data) || null;
    await storeCheckResult(clientId, "lifestyle_audit", matterId, "Lifestyle audit completed", data);
    await logActivity(clientId, "Lifestyle Audit", {
      matterId,
      lifestyleScore: data?.lifestyleScore,
      estimatedIncome: data?.estimatedIncome,
    });

    return { success: true, data, matterId, checkType: "lifestyle_audit" };
  } catch (err) {
    log.error("Lifestyle audit error:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * INCOME PREDICTOR
 * Honeycomb endpoint: POST /natural-person-income-predictor
 */
export async function runIncomePredictor(
  clientId: string,
  firstName: string,
  lastName: string,
  idNumber: string | null,
  passport: string | null,
): Promise<ServiceResult<HoneycombIncomePredictorResponse>> {
  try {
    requireIdentification(idNumber, passport);
    const payload = buildPersonPayload(clientId, firstName, lastName, idNumber, passport);

    log.info(`Running income predictor for ${clientId}`);

    const { ok, status, data } = await callHoneycomb(
      "POST",
      "/natural-person-income-predictor",
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Income predictor failed: ${errMsg}` };
    }

    const matterId = extractId(data) || null;
    await storeCheckResult(clientId, "income_predictor", matterId, "Income predictor completed", data);
    await logActivity(clientId, "Income Predictor", {
      matterId,
      estimatedIncome: data?.estimatedIncome,
      confidenceLevel: data?.confidenceLevel,
    });

    return { success: true, data, matterId, checkType: "income_predictor" };
  } catch (err) {
    log.error("Income predictor error:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * TENDERS BLUE LIST
 * Honeycomb endpoint: POST /natural-person-tenders-blue
 */
export async function runTendersBlue(
  clientId: string,
  firstName: string,
  lastName: string,
  idNumber: string | null,
  passport: string | null,
): Promise<ServiceResult<HoneycombTendersBlueResponse>> {
  try {
    requireIdentification(idNumber, passport);
    const payload = buildPersonPayload(clientId, firstName, lastName, idNumber, passport);

    log.info(`Running tenders blue search for ${clientId}`);

    const { ok, status, data } = await callHoneycomb(
      "POST",
      "/natural-person-tenders-blue",
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Tenders blue search failed: ${errMsg}` };
    }

    const matterId = extractId(data) || null;
    const tenders = Array.isArray(data?.tenders) ? data.tenders : (Array.isArray(data) ? data : []);
    await storeCheckResult(clientId, "tenders_blue", matterId, `Tenders: ${tenders.length} record(s)`, data);
    await logActivity(clientId, "Tenders Blue Search", {
      matterId,
      tendersFound: tenders.length,
    });

    return { success: true, data, matterId, checkType: "tenders_blue" };
  } catch (err) {
    log.error("Tenders blue error:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * CDD REPORT — Customer Due Diligence
 * Honeycomb endpoint: POST /natural-person-cdd
 *
 * Runs a comprehensive due diligence check against the natural person,
 * covering identity verification, address confirmation, and risk indicators
 * in a single consolidated bureau call.
 */
export async function runCddReport(
  clientId: string,
  firstName: string,
  lastName: string,
  idNumber: string | null,
  passport: string | null,
): Promise<ServiceResult> {
  try {
    requireIdentification(idNumber, passport);
    const payload = buildPersonPayload(clientId, firstName, lastName, idNumber, passport);

    log.info(`Running CDD report for ${clientId}`);

    const { ok, status, data } = await callHoneycomb(
      "POST",
      "/natural-person-cdd",
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      log.error(`CDD report failed (${status}):`, { error: errMsg, rawResponse: JSON.stringify(data) });
      return { success: false, error: `CDD report failed: ${errMsg}` };
    }

    const matterId = extractId(data) || null;
    await storeCheckResult(clientId, "cdd_report", matterId, "CDD report completed", data);
    await logActivity(clientId, "CDD Report", {
      matterId,
      checkType: "cdd_report",
    });

    return { success: true, data, matterId, checkType: "cdd_report" };
  } catch (err) {
    log.error("CDD report error:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * GET CHECK HISTORY
 * Returns stored results for a specific check type from KV.
 */
export async function getCheckHistory(
  clientId: string,
  checkType: HoneycombCheckType,
): Promise<HoneycombCheckResult[]> {
  const key = `honeycomb_checks:${clientId}:${checkType}`;
  const history = await kv.get(key);
  return Array.isArray(history) ? history : [];
}

/**
 * GET ALL CHECKS HISTORY
 * Returns stored results across all check types for a client.
 */
export async function getAllCheckHistory(
  clientId: string,
): Promise<HoneycombCheckResult[]> {
  const prefix = `honeycomb_checks:${clientId}:`;
  const entries = await kv.getByPrefix(prefix);

  const allResults: HoneycombCheckResult[] = [];
  for (const entry of entries) {
    // getByPrefix returns values directly (not {key, value} objects)
    if (Array.isArray(entry)) {
      allResults.push(...entry);
    }
  }

  // Sort by submittedAt descending
  return allResults.sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

// ============================================================================
// PHASE 4 — BULK IDV + COMPLIANCE DASHBOARD
// ============================================================================

/**
 * BULK IDV
 * Honeycomb endpoint: POST /natural-person-idv-bulk
 *
 * Processes multiple identity numbers in a single batch request.
 * Useful for verifying household members or related parties.
 */
export async function runBulkIdv(
  clientId: string,
  persons: Array<{
    firstName: string;
    lastName: string;
    idNumber: string;
  }>,
): Promise<ServiceResult<HoneycombBulkIdvResponse>> {
  try {
    if (!persons.length) {
      return { success: false, error: "At least one person is required for bulk IDV" };
    }

    const payload = persons.map((p) => ({
      uniqueId: clientId,
      firstName: p.firstName,
      surname: p.lastName,
      identityNumber: p.idNumber,
      passport: "",
    }));

    log.info(`Running bulk IDV for ${clientId}: ${persons.length} person(s)`);

    const { ok, status, data } = await callHoneycomb(
      "POST",
      "/natural-person-idv-bulk",
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Bulk IDV failed: ${errMsg}` };
    }

    const results = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
    const totalProcessed = results.length;
    const totalMatched = results.filter((r: Record<string, unknown>) => r?.status === "matched" || r?.matchResult === "matched").length;
    const totalFailed = results.filter((r: Record<string, unknown>) => r?.status === "failed" || r?.matchResult === "failed").length;

    const matterId = extractId(data) || null;
    await storeCheckResult(
      clientId,
      "idv_bulk",
      matterId,
      `Bulk IDV: ${totalProcessed} processed, ${totalMatched} matched, ${totalFailed} failed`,
      data,
    );
    await logActivity(clientId, "Bulk IDV", {
      matterId,
      totalProcessed,
      totalMatched,
      totalFailed,
    });

    return {
      success: true,
      data: { ...data, results, totalProcessed, totalMatched, totalFailed },
      matterId,
      checkType: "idv_bulk",
    };
  } catch (err) {
    log.error("Bulk IDV error:", err);
    return { success: false, error: (err as Error).message };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// COMPLIANCE DASHBOARD — Computed from KV check history
// ────────────────────────────────────────────────────────────────────────────

/** Category definitions for the compliance matrix */
const COMPLIANCE_CATEGORIES: ComplianceCategory[] = [
  {
    id: "identity",
    label: "Identity Verification",
    checkTypes: ["idv_no_photo", "idv_with_photo", "idv_no_photo_secondary", "idv_with_photo_secondary", "idv_bulk"],
    colour: "blue",
  },
  {
    id: "cdd",
    label: "Customer Due Diligence",
    checkTypes: ["cdd_report"],
    colour: "teal",
  },
  {
    id: "financial",
    label: "Financial Intelligence",
    checkTypes: ["bank_verification", "consumer_credit", "consumer_trace", "debt_enquiry", "lifestyle_audit", "income_predictor"],
    colour: "green",
  },
  {
    id: "sanctions",
    label: "Screening & Sanctions",
    checkTypes: ["sanctions_search", "enforcement_actions", "legal_a_listing", "custom_screening"],
    colour: "purple",
  },
  {
    id: "corporate",
    label: "Corporate & Governance",
    checkTypes: ["cipc", "director_enquiry", "tenders_blue"],
    colour: "indigo",
  },
  {
    id: "address",
    label: "Address",
    checkTypes: ["best_known_address"],
    colour: "emerald",
  },
  {
    id: "assessment",
    label: "Risk Assessment",
    checkTypes: ["assessment"],
    colour: "amber",
  },
];

/** Human-readable labels for each check type */
const CHECK_TYPE_LABELS: Record<HoneycombCheckType, string> = {
  idv_no_photo: "IDV (No Photo)",
  idv_with_photo: "IDV (With Photo)",
  idv_no_photo_secondary: "IDV Secondary (No Photo)",
  idv_with_photo_secondary: "IDV Secondary (With Photo)",
  idv_bulk: "Bulk IDV",
  bank_verification: "Bank Verification",
  consumer_credit: "Consumer Credit",
  consumer_trace: "Consumer Trace",
  debt_enquiry: "Debt Review Enquiry",
  lifestyle_audit: "Lifestyle Audit",
  income_predictor: "Income Predictor",
  cipc: "CIPC Company Search",
  director_enquiry: "Director Enquiry",
  tenders_blue: "Tenders Blue List",
  custom_screening: "Custom Screening",
  sanctions_search: "Sanctions Search",
  enforcement_actions: "Enforcement Actions",
  legal_a_listing: "Legal A Listing",
  best_known_address: "Best Known Address",
  cdd_report: "CDD Report",
  assessment: "Risk Assessment",
  registration: "Registration",
};

/** Extract risk flags from raw check results */
function extractRiskFlags(allResults: HoneycombCheckResult[]): RiskFlag[] {
  const flags: RiskFlag[] = [];

  for (const result of allResults) {
    const raw = result.rawResponse as Record<string, unknown> | null;
    if (!raw) continue;

    switch (result.checkType) {
      case "sanctions_search": {
        const resultsArr = Array.isArray(raw.results) ? raw.results : [];
        const matches = (typeof raw.totalMatches === 'number' ? raw.totalMatches : null) ?? resultsArr.length ?? 0;
        if (matches > 0) {
          flags.push({
            severity: "high",
            source: "Sanctions Search",
            message: `${matches} sanctions match(es) found`,
            checkType: result.checkType,
            detectedAt: result.submittedAt,
          });
        }
        break;
      }
      case "enforcement_actions": {
        const resultsArr = Array.isArray(raw.results) ? raw.results : [];
        const matches = (typeof raw.totalMatches === 'number' ? raw.totalMatches : null) ?? resultsArr.length ?? 0;
        if (matches > 0) {
          flags.push({
            severity: "high",
            source: "Enforcement Actions",
            message: `${matches} enforcement action(s) found`,
            checkType: result.checkType,
            detectedAt: result.submittedAt,
          });
        }
        break;
      }
      case "legal_a_listing": {
        const resultsArr = Array.isArray(raw.results) ? raw.results : [];
        const matches = (typeof raw.totalMatches === 'number' ? raw.totalMatches : null) ?? resultsArr.length ?? 0;
        if (matches > 0) {
          flags.push({
            severity: "medium",
            source: "Legal A Listing",
            message: `${matches} legal listing(s) found`,
            checkType: result.checkType,
            detectedAt: result.submittedAt,
          });
        }
        break;
      }
      case "debt_enquiry": {
        if (raw.isUnderDebtReview === true) {
          flags.push({
            severity: "medium",
            source: "Debt Review",
            message: "Client is under debt review",
            checkType: result.checkType,
            detectedAt: result.submittedAt,
          });
        }
        break;
      }
      case "idv_no_photo":
      case "idv_with_photo": {
        if (raw.idVerified === false) {
          flags.push({
            severity: "high",
            source: "Identity Verification",
            message: "Identity could not be verified",
            checkType: result.checkType,
            detectedAt: result.submittedAt,
          });
        }
        if (raw.photoMatch === false) {
          flags.push({
            severity: "medium",
            source: "IDV Photo Match",
            message: "Photo does not match bureau records",
            checkType: result.checkType,
            detectedAt: result.submittedAt,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  // Sort by severity (high first)
  const severityOrder = { high: 0, medium: 1, low: 2, info: 3 };
  return flags.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/**
 * COMPLIANCE DASHBOARD
 * Aggregates all check history for a client into a readiness score,
 * per-category completion, and risk flags.
 */
export async function getComplianceDashboard(
  clientId: string,
): Promise<ComplianceDashboardData> {
  const allResults = await getAllCheckHistory(clientId);

  // Build a map of checkType -> results
  const resultsByType = new Map<HoneycombCheckType, HoneycombCheckResult[]>();
  for (const r of allResults) {
    const existing = resultsByType.get(r.checkType) || [];
    existing.push(r);
    resultsByType.set(r.checkType, existing);
  }

  // Exclude 'registration' from scoring — it's not a compliance check
  const scorableCategories = COMPLIANCE_CATEGORIES;

  // Build per-check status
  const checks: CheckStatus[] = [];
  for (const cat of scorableCategories) {
    for (const ct of cat.checkTypes) {
      const results = resultsByType.get(ct) || [];
      const lastResult = results[0]; // already sorted desc
      checks.push({
        checkType: ct,
        label: CHECK_TYPE_LABELS[ct] || ct,
        category: cat.id,
        completed: results.length > 0,
        lastRun: lastResult?.submittedAt || null,
        runCount: results.length,
        lastMatterId: lastResult?.matterId || null,
      });
    }
  }

  // Build per-category status
  const categories: CategoryStatus[] = scorableCategories.map((cat) => {
    const catChecks = checks.filter((c) => c.category === cat.id);
    const completedCount = catChecks.filter((c) => c.completed).length;
    return {
      id: cat.id,
      label: cat.label,
      colour: cat.colour,
      completedCount,
      totalCount: catChecks.length,
      percentage: catChecks.length > 0 ? Math.round((completedCount / catChecks.length) * 100) : 0,
    };
  });

  // Compute overall readiness score
  // Weighted: identity=25%, cdd=15%, financial=20%, sanctions=20%, corporate=10%, address=5%, assessment=5%
  const weights: Record<string, number> = {
    identity: 0.25,
    cdd: 0.15,
    financial: 0.20,
    sanctions: 0.20,
    corporate: 0.10,
    address: 0.05,
    assessment: 0.05,
  };
  let readinessScore = 0;
  for (const cat of categories) {
    const w = weights[cat.id] ?? 0;
    readinessScore += (cat.percentage / 100) * w * 100;
  }
  readinessScore = Math.round(readinessScore);

  // Extract risk flags
  const riskFlags = extractRiskFlags(allResults);

  // Totals
  const completedCheckTypes = checks.filter((c) => c.completed).length;
  const totalCheckTypes = checks.length;
  const lastCheckDate = allResults.length > 0 ? allResults[0].submittedAt : null;

  return {
    readinessScore,
    completedCheckTypes,
    totalCheckTypes,
    categories,
    checks,
    riskFlags,
    lastCheckDate,
    totalCheckRuns: allResults.length,
  };
}