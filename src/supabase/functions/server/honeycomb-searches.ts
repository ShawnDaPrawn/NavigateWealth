/**
 * Honeycomb integration — Phase 2 searches — enforcement, legal, corporate, address and screening.
 *
 * One slice of what used to be all 1,613 lines of `honeycomb-service.ts`.
 * That file still re-exports the whole public surface, because all five
 * honeycomb route files reach it as `import * as service`.
 *
 * The logger keeps the channel name `honeycomb-service` on purpose: splitting
 * the file should not rename anything in the logs.
 */
import { createModuleLogger } from './stderr-logger.ts';
import type {
  ServiceResult,
  HoneycombCipcResponse,
  HoneycombDirectorResponse,
  HoneycombEnforcementResponse,
  HoneycombAddressResponse,
  HoneycombCustomScreeningResponse,
  HoneycombLegalAListingResponse,
} from './honeycomb-types.ts';
import { logActivity, storeCheckResult } from './honeycomb-activity.ts';
import {
  buildPersonPayload,
  callHoneycomb,
  extractId,
  isRealIdNumber,
  requireIdentification,
} from './honeycomb-client.ts';

const log = createModuleLogger('honeycomb-service');

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
    if (name) params.append('name', name);
    if (surname) params.append('surname', surname);
    if (identityNumber && isRealIdNumber(identityNumber)) {
      params.append('identityNumber', identityNumber);
    }
    if (uniqueId) params.append('uniqueId', uniqueId);

    const endpoint = `/search-enforcement-actions-natural-persons?${params.toString()}`;

    log.info(`Searching enforcement actions for ${clientId}: ${name} ${surname}`);

    const { ok, status, data, raw } = await callHoneycomb('GET', endpoint);

    if (!ok) {
      log.error(
        `Enforcement actions Honeycomb error: status=${status}, raw=${raw?.substring(0, 500)}`,
      );
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Enforcement search failed: ${errMsg}` };
    }

    const results: unknown[] = Array.isArray(data)
      ? data
      : ((data?.results ?? data?.listings ?? []) as unknown[]);
    const totalMatches = results.length;

    await storeCheckResult(
      clientId,
      'enforcement_actions',
      null,
      `Enforcement: ${totalMatches} match(es)`,
      { results, totalMatches },
    );
    await logActivity(clientId, 'Enforcement Actions Search', {
      totalMatches,
      screeningOutcome: totalMatches === 0 ? 'Clear' : 'Matches Found',
    });

    return {
      success: true,
      data: { results, totalMatches } as HoneycombEnforcementResponse,
      checkType: 'enforcement_actions',
    };
  } catch (err) {
    log.error('Enforcement actions search error:', err);
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
    if (name) params.append('name', name);
    if (surname) params.append('surname', surname);
    if (identityNumber && isRealIdNumber(identityNumber)) {
      params.append('identityNumber', identityNumber);
    }
    if (uniqueId) params.append('uniqueId', uniqueId);

    const endpoint = `/search-legal-a-listing-natural-persons?${params.toString()}`;

    log.info(`Searching legal A listing for ${clientId}: ${name} ${surname}`);

    const { ok, status, data, raw } = await callHoneycomb('GET', endpoint);

    if (!ok) {
      log.error(`Legal A listing Honeycomb error: status=${status}, raw=${raw?.substring(0, 500)}`);
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Legal A listing search failed: ${errMsg}` };
    }

    const results: unknown[] = Array.isArray(data)
      ? data
      : ((data?.results ?? data?.listings ?? []) as unknown[]);
    const totalMatches = results.length;

    await storeCheckResult(
      clientId,
      'legal_a_listing',
      null,
      `Legal A: ${totalMatches} match(es)`,
      { results, totalMatches },
    );
    await logActivity(clientId, 'Legal A Listing Search', {
      totalMatches,
      screeningOutcome: totalMatches === 0 ? 'Clear' : 'Matches Found',
    });

    return {
      success: true,
      data: { results, totalMatches } as HoneycombLegalAListingResponse,
      checkType: 'legal_a_listing',
    };
  } catch (err) {
    log.error('Legal A listing search error:', err);
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

    const { ok, status, data } = await callHoneycomb('POST', '/natural-person-cipc', payload);

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `CIPC search failed: ${errMsg}` };
    }

    const matterId = data ? extractId(data) || null : null;
    const companies = Array.isArray(data?.companies)
      ? data.companies
      : Array.isArray(data)
        ? data
        : [];
    await storeCheckResult(
      clientId,
      'cipc',
      matterId,
      `CIPC: ${companies.length} company/ies`,
      data,
    );
    await logActivity(clientId, 'CIPC Company Search', {
      matterId,
      companiesFound: companies.length,
    });

    return { success: true, data, matterId: matterId ?? undefined, checkType: 'cipc' };
  } catch (err) {
    log.error('CIPC search error:', err);
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
      'POST',
      '/natural-person-director-enquiry',
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Director enquiry failed: ${errMsg}` };
    }

    const matterId = data ? extractId(data) || null : null;
    const directorships = Array.isArray(data?.directorships) ? data.directorships : [];
    await storeCheckResult(
      clientId,
      'director_enquiry',
      matterId,
      `Director enquiry: ${directorships.length} directorship(s)`,
      data,
    );
    await logActivity(clientId, 'Director Enquiry', {
      matterId,
      directorshipsFound: directorships.length,
    });

    return { success: true, data, matterId: matterId ?? undefined, checkType: 'director_enquiry' };
  } catch (err) {
    log.error('Director enquiry error:', err);
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

    const { ok, status, data } = await callHoneycomb('POST', '/natural-person-address', payload);

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Address lookup failed: ${errMsg}` };
    }

    const matterId = data ? extractId(data) || null : null;
    await storeCheckResult(
      clientId,
      'best_known_address',
      matterId,
      'Address lookup completed',
      data,
    );
    await logActivity(clientId, 'Best Known Address', {
      matterId,
      checkType: 'best_known_address',
    });

    return {
      success: true,
      data,
      matterId: matterId ?? undefined,
      checkType: 'best_known_address',
    };
  } catch (err) {
    log.error('Best known address error:', err);
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
      'POST',
      '/natural-person-custom-screening',
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Custom screening failed: ${errMsg}` };
    }

    const matterId = data ? extractId(data) || null : null;
    await storeCheckResult(
      clientId,
      'custom_screening',
      matterId,
      'Custom screening completed',
      data,
    );
    await logActivity(clientId, 'Custom Screening', {
      matterId,
      packageId: packageId || 'default',
    });

    return { success: true, data, matterId: matterId ?? undefined, checkType: 'custom_screening' };
  } catch (err) {
    log.error('Custom screening error:', err);
    return { success: false, error: (err as Error).message };
  }
}
