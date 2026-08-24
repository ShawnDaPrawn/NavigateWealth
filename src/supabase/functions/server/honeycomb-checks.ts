/**
 * Honeycomb integration — Identity, bank and credit checks.
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
  HoneycombCheckType,
  ServiceResult,
  HoneycombIdvResponse,
  HoneycombBankVerificationResponse,
  HoneycombCreditResponse,
  HoneycombSanctionsResponse,
  SanctionsMatch,
  HoneycombTraceResponse,
  HoneycombDebtReviewResponse,
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
      ? '/natural-person-idv-no-photo-no-upload-secondary'
      : '/natural-person-idv-no-photo-no-upload';

    const checkType: HoneycombCheckType = secondary ? 'idv_no_photo_secondary' : 'idv_no_photo';

    log.info(`Running IDV (no photo${secondary ? ', secondary' : ''}) for ${clientId}`);

    const { ok, status, data } = await callHoneycomb('POST', endpoint, payload);

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      log.error(`IDV failed (${status}):`, { error: errMsg });
      return { success: false, error: `IDV check failed: ${errMsg}` };
    }

    const matterId = data ? extractId(data) || null : null;
    const result = await storeCheckResult(
      clientId,
      checkType,
      matterId,
      'IDV check completed',
      data,
    );
    await logActivity(clientId, 'IDV Report', {
      reportId: result.id,
      matterId,
      checkType,
      verificationStatus: data?.verificationStatus || 'completed',
    });

    return {
      success: true,
      data,
      matterId: matterId ?? undefined,
      checkType: checkType ?? undefined,
    };
  } catch (err) {
    log.error('IDV (no photo) error:', err);
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
      ? '/natural-person-idv-photo-no-upload-secondary'
      : '/natural-person-idv-photo-no-upload';

    const checkType: HoneycombCheckType = secondary ? 'idv_with_photo_secondary' : 'idv_with_photo';

    log.info(`Running IDV (with photo${secondary ? ', secondary' : ''}) for ${clientId}`);

    const { ok, status, data } = await callHoneycomb('POST', endpoint, payload);

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `IDV photo check failed: ${errMsg}` };
    }

    const matterId = data ? extractId(data) || null : null;
    await storeCheckResult(clientId, checkType, matterId, 'IDV photo check completed', data);
    await logActivity(clientId, 'IDV Report (Photo)', {
      matterId,
      checkType,
      photoMatch: data?.photoMatch,
    });

    return {
      success: true,
      data,
      matterId: matterId ?? undefined,
      checkType: checkType ?? undefined,
    };
  } catch (err) {
    log.error('IDV (with photo) error:', err);
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
      'POST',
      '/natural-person-account-verification-real-time',
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Bank verification failed: ${errMsg}` };
    }

    const matterId = data ? extractId(data) || null : null;
    await storeCheckResult(
      clientId,
      'bank_verification',
      matterId,
      'Bank verification completed',
      data,
    );
    await logActivity(clientId, 'Bank Verification', {
      matterId,
      verified: data?.verified ?? data?.accountExists,
      bankName,
      // Do NOT log account number (PII) — only bank name
    });

    return { success: true, data, matterId: matterId ?? undefined, checkType: 'bank_verification' };
  } catch (err) {
    log.error('Bank verification error:', err);
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
      'POST',
      '/natural-person-consumer-credit',
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Credit check failed: ${errMsg}` };
    }

    const matterId = data ? extractId(data) || null : null;
    await storeCheckResult(clientId, 'consumer_credit', matterId, 'Credit check completed', data);
    await logActivity(clientId, 'Consumer Credit Check', {
      matterId,
      creditScore: data?.creditScore,
      // Do NOT log detailed financial data (PII)
    });

    return { success: true, data, matterId: matterId ?? undefined, checkType: 'consumer_credit' };
  } catch (err) {
    log.error('Consumer credit error:', err);
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
      'POST',
      '/natural-person-consumer-trace',
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Consumer trace failed: ${errMsg}` };
    }

    const matterId = data ? extractId(data) || null : null;
    await storeCheckResult(clientId, 'consumer_trace', matterId, 'Consumer trace completed', data);
    await logActivity(clientId, 'Consumer Trace', {
      matterId,
      checkType: 'consumer_trace',
    });

    return { success: true, data, matterId: matterId ?? undefined, checkType: 'consumer_trace' };
  } catch (err) {
    log.error('Consumer trace error:', err);
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
      'POST',
      '/natural-person-debt-review',
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Debt review enquiry failed: ${errMsg}` };
    }

    const matterId = data ? extractId(data) || null : null;
    const isUnderReview = data?.debtReviewStatus === true || data?.isUnderReview === true;
    await storeCheckResult(
      clientId,
      'debt_enquiry',
      matterId,
      isUnderReview ? 'Under debt review' : 'Not under debt review',
      data,
    );
    await logActivity(clientId, 'Debt Review Enquiry', {
      matterId,
      debtReviewStatus: isUnderReview ? 'Under Review' : 'Clear',
    });

    return { success: true, data, matterId: matterId ?? undefined, checkType: 'debt_enquiry' };
  } catch (err) {
    log.error('Debt review enquiry error:', err);
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
    if (name) params.append('name', name);
    if (surname) params.append('surname', surname);
    if (identityNumber && isRealIdNumber(identityNumber)) {
      params.append('identityNumber', identityNumber);
    }
    if (uniqueId) params.append('uniqueId', uniqueId);

    // Choose endpoint based on whether source filter is provided
    let endpoint: string;
    if (source) {
      params.append('source', source);
      endpoint = `/search-sanctions-natural-persons-by-source?${params.toString()}`;
    } else {
      endpoint = `/search-sanctions-natural-persons?${params.toString()}`;
    }

    log.info(`Searching sanctions for ${clientId}: ${name} ${surname}`);

    const { ok, status, data } = await callHoneycomb('GET', endpoint);

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Sanctions search failed: ${errMsg}` };
    }

    // Normalise results
    const results: unknown[] = Array.isArray(data)
      ? data
      : ((data?.results ?? data?.listings ?? []) as unknown[]);
    const totalMatches = results.length;
    const sanctionsData: HoneycombSanctionsResponse = {
      results: results as SanctionsMatch[],
      totalMatches,
      searchedLists: source ? [source] : ['all'],
      ...(typeof data === 'object' && data !== null ? data : {}),
    };

    await storeCheckResult(
      clientId,
      'sanctions_search',
      null,
      `Sanctions search: ${totalMatches} match(es)`,
      sanctionsData,
    );
    await logActivity(clientId, 'Sanctions Search', {
      totalMatches,
      source: source || 'all',
      screeningOutcome: totalMatches === 0 ? 'Clear' : 'Matches Found',
    });

    return { success: true, data: sanctionsData, checkType: 'sanctions_search' };
  } catch (err) {
    log.error('Sanctions search error:', err);
    return { success: false, error: (err as Error).message };
  }
}
