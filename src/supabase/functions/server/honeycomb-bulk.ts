/**
 * Honeycomb integration — Phase 4 bulk IDV.
 *
 * One slice of what used to be all 1,613 lines of `honeycomb-service.ts`.
 * That file still re-exports the whole public surface, because all five
 * honeycomb route files reach it as `import * as service`.
 *
 * The logger keeps the channel name `honeycomb-service` on purpose: splitting
 * the file should not rename anything in the logs.
 */
import { createModuleLogger } from './stderr-logger.ts';
import type { ServiceResult, HoneycombBulkIdvResponse, BulkIdvEntry } from './honeycomb-types.ts';
import { logActivity, storeCheckResult } from './honeycomb-activity.ts';
import { callHoneycomb, extractId } from './honeycomb-client.ts';

const log = createModuleLogger('honeycomb-service');

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
      return { success: false, error: 'At least one person is required for bulk IDV' };
    }

    const payload = persons.map((p) => ({
      uniqueId: clientId,
      firstName: p.firstName,
      surname: p.lastName,
      identityNumber: p.idNumber,
      passport: '',
    }));

    log.info(`Running bulk IDV for ${clientId}: ${persons.length} person(s)`);

    const { ok, status, data } = await callHoneycomb('POST', '/natural-person-idv-bulk', payload);

    if (!ok) {
      const errMsg = data?.message || data?.error || `Honeycomb returned ${status}`;
      return { success: false, error: `Bulk IDV failed: ${errMsg}` };
    }

    const results: unknown[] = Array.isArray(data?.results)
      ? (data.results as unknown[])
      : Array.isArray(data)
        ? data
        : [];
    const totalProcessed = results.length;
    const totalMatched = results.filter(
      (r) =>
        (r as Record<string, unknown>)?.status === 'matched' ||
        (r as Record<string, unknown>)?.matchResult === 'matched',
    ).length;
    const totalFailed = results.filter(
      (r) =>
        (r as Record<string, unknown>)?.status === 'failed' ||
        (r as Record<string, unknown>)?.matchResult === 'failed',
    ).length;

    const matterId = data ? extractId(data) || null : null;
    await storeCheckResult(
      clientId,
      'idv_bulk',
      matterId,
      `Bulk IDV: ${totalProcessed} processed, ${totalMatched} matched, ${totalFailed} failed`,
      data,
    );
    await logActivity(clientId, 'Bulk IDV', {
      matterId,
      totalProcessed,
      totalMatched,
      totalFailed,
    });

    return {
      success: true,
      data: {
        ...(data ?? {}),
        results: results as BulkIdvEntry[],
        totalProcessed,
        totalMatched,
        totalFailed,
      },
      matterId: matterId ?? undefined,
      checkType: 'idv_bulk',
    };
  } catch (err) {
    log.error('Bulk IDV error:', err);
    return { success: false, error: (err as Error).message };
  }
}

// ────────────────────────────────────────────────────────────────────────────
