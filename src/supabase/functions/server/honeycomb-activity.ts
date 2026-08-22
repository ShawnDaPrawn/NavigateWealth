/**
 * Honeycomb integration — Activity logging and check-result storage in KV.
 *
 * One slice of what used to be all 1,613 lines of `honeycomb-service.ts`.
 * That file still re-exports the whole public surface, because all five
 * honeycomb route files reach it as `import * as service`.
 *
 * The logger keeps the channel name `honeycomb-service` on purpose: splitting
 * the file should not rename anything in the logs.
 */
import * as kv from './kv_store.tsx';
import type { HoneycombCheckResult, HoneycombCheckType } from './honeycomb-types.ts';

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
    status: 'Completed',
  };
  await kv.set(key, [entry, ...(Array.isArray(existing) ? existing : [])]);
  return { id: entry.id };
}

/** Store a check result in KV and log it as activity */
export async function storeCheckResult(
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
    status: 'completed',
    summary,
    rawResponse,
  };

  // Store in check-type-specific history
  const historyKey = `honeycomb_checks:${clientId}:${checkType}`;
  const existing = (await kv.get(historyKey)) || [];
  await kv.set(historyKey, [result, ...(Array.isArray(existing) ? existing : [])]);

  return result;
}
