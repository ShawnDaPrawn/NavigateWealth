/**
 * Honeycomb integration — Phase 3 reports, and reading a client's check history back.
 *
 * One slice of what used to be all 1,613 lines of `honeycomb-service.ts`.
 * That file still re-exports the whole public surface, because all five
 * honeycomb route files reach it as `import * as service`.
 *
 * The logger keeps the channel name `honeycomb-service` on purpose: splitting
 * the file should not rename anything in the logs.
 */
import { createModuleLogger } from './stderr-logger.ts';
import * as kv from './kv_store.tsx';
import type {
  HoneycombCheckResult,
  HoneycombCheckType,
  ServiceResult,
  HoneycombLifestyleAuditResponse,
  HoneycombIncomePredictorResponse,
  HoneycombTendersBlueResponse,
} from './honeycomb-types.ts';
import { logActivity, storeCheckResult } from './honeycomb-activity.ts';
import {
  buildPersonPayload,
  callHoneycomb,
  extractId,
  requireIdentification,
} from './honeycomb-client.ts';

const log = createModuleLogger('honeycomb-service');

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
      'POST',
      '/natural-person-lifestyle-audit',
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Lifestyle audit failed: ${errMsg}` };
    }

    const matterId = data ? extractId(data) || null : null;
    await storeCheckResult(
      clientId,
      'lifestyle_audit',
      matterId,
      'Lifestyle audit completed',
      data,
    );
    await logActivity(clientId, 'Lifestyle Audit', {
      matterId,
      lifestyleScore: data?.lifestyleScore,
      estimatedIncome: data?.estimatedIncome,
    });

    return { success: true, data, matterId: matterId ?? undefined, checkType: 'lifestyle_audit' };
  } catch (err) {
    log.error('Lifestyle audit error:', err);
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
      'POST',
      '/natural-person-income-predictor',
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Income predictor failed: ${errMsg}` };
    }

    const matterId = data ? extractId(data) || null : null;
    await storeCheckResult(
      clientId,
      'income_predictor',
      matterId,
      'Income predictor completed',
      data,
    );
    await logActivity(clientId, 'Income Predictor', {
      matterId,
      estimatedIncome: data?.estimatedIncome,
      confidenceLevel: data?.confidenceLevel,
    });

    return { success: true, data, matterId: matterId ?? undefined, checkType: 'income_predictor' };
  } catch (err) {
    log.error('Income predictor error:', err);
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
      'POST',
      '/natural-person-tenders-blue',
      payload,
    );

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Tenders blue search failed: ${errMsg}` };
    }

    const matterId = data ? extractId(data) || null : null;
    const tenders = Array.isArray(data?.tenders) ? data.tenders : Array.isArray(data) ? data : [];
    await storeCheckResult(
      clientId,
      'tenders_blue',
      matterId,
      `Tenders: ${tenders.length} record(s)`,
      data,
    );
    await logActivity(clientId, 'Tenders Blue Search', {
      matterId,
      tendersFound: tenders.length,
    });

    return { success: true, data, matterId: matterId ?? undefined, checkType: 'tenders_blue' };
  } catch (err) {
    log.error('Tenders blue error:', err);
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

    const { ok, status, data } = await callHoneycomb('POST', '/natural-person-cdd', payload);

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      log.error(`CDD report failed (${status}):`, {
        error: errMsg,
        rawResponse: JSON.stringify(data),
      });
      return { success: false, error: `CDD report failed: ${errMsg}` };
    }

    const matterId = data ? extractId(data) || null : null;
    await storeCheckResult(clientId, 'cdd_report', matterId, 'CDD report completed', data);
    await logActivity(clientId, 'CDD Report', {
      matterId,
      checkType: 'cdd_report',
    });

    return { success: true, data, matterId: matterId ?? undefined, checkType: 'cdd_report' };
  } catch (err) {
    log.error('CDD report error:', err);
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
export async function getAllCheckHistory(clientId: string): Promise<HoneycombCheckResult[]> {
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
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
}
