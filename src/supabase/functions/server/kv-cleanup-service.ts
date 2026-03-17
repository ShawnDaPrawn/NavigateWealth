/**
 * KV Cleanup Service
 *
 * General-purpose stale KV entry purge mechanism.
 * Designed as a dry-run-first admin tool (see Guidelines §14.1).
 *
 * Handles five categories of ephemeral/transient KV data:
 *
 * 1. **Rate-limit entries** (`rate_limit:contact:*`, `rate_limit:quote:*`, `rate_limit:submission:*`, `rate_limit:consultation:*`)
 *    — timestamps older than 1 hour are stale by definition.
 *
 * 2. **Expired newsletter tokens** (`newsletter:*`)
 *    — unconfirmed subscriptions whose 48-hour confirmation window has passed.
 *
 * 3. **Old contact form and consultation submissions** (`contact_form:*`, `consultation:*`)
 *    — raw KV records mirrored in the Submissions Manager; safe to purge
 *      after a configurable retention period (default: 90 days).
 *
 * 4. **Old quote request submissions** (`quote_request:*`)
 *    — same as contact form submissions.
 *
 * 5. **Stale audit trail entries** (`audit:*`)
 *    — suspension-attempt audit logs older than the retention period.
 *
 * All mutations are idempotent and safe to re-run.
 * Client-profile and security-entry cleanup is handled separately by
 * `client-cleanup-service.ts`.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('kv-cleanup');

function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// ============================================================================
// Types
// ============================================================================

export interface KvCleanupOptions {
  /** If true, no deletes are performed — only a report is returned. Default: true */
  dryRun?: boolean;
  /** Retention period in days for form submissions (contact_form, quote_request). Default: 90 */
  retentionDays?: number;
  /** Retention period in days for audit trail entries (audit:*). Default: 365. Configurable separately from general retention because audit data has compliance value. */
  auditRetentionDays?: number;
}

interface CategoryResult {
  keysFound: number;
  keysDeleted: number;
  sampleKeys: string[];
}

export interface KvCleanupResult {
  dryRun: boolean;
  retentionDays: number;
  auditRetentionDays: number;
  categories: {
    rateLimits: CategoryResult;
    expiredNewsletterTokens: CategoryResult;
    oldContactForms: CategoryResult;
    oldQuoteRequests: CategoryResult;
    staleAuditEntries: CategoryResult;
  };
  totalKeysFound: number;
  totalKeysDeleted: number;
  timestamp: string;
  durationMs: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Fetch all KV rows whose key matches a given prefix.
 * Returns both key and value (unlike kv.getByPrefix which strips keys).
 */
async function fetchKeyValuesByPrefix(
  prefix: string,
): Promise<{ key: string; value: unknown }[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('kv_store_91ed8379')
    .select('key, value')
    .like('key', `${prefix}%`);

  if (error) {
    log.error(`Failed to fetch KV entries for prefix "${prefix}"`, error);
    throw new Error(`KV fetch failed for prefix "${prefix}": ${error.message}`);
  }

  return (data ?? []) as { key: string; value: unknown }[];
}

/**
 * Delete keys in batches of 100 to avoid overly large IN clauses.
 */
async function batchDelete(keys: string[]): Promise<void> {
  const BATCH = 100;
  for (let i = 0; i < keys.length; i += BATCH) {
    const batch = keys.slice(i, i + BATCH);
    await kv.mdel(batch);
  }
}

/**
 * Truncate an array to at most `n` items for the sample output.
 */
function sample(keys: string[], n = 10): string[] {
  return keys.slice(0, n);
}

// ============================================================================
// Category Cleaners
// ============================================================================

/**
 * 1. Rate-limit entries — all timestamps are transient; any entry whose
 *    newest timestamp is older than 1 hour is fully stale.
 */
async function cleanRateLimits(dryRun: boolean): Promise<CategoryResult> {
  const rows = [
    ...(await fetchKeyValuesByPrefix('rate_limit:contact:')),
    ...(await fetchKeyValuesByPrefix('rate_limit:quote:')),
    ...(await fetchKeyValuesByPrefix('rate_limit:submission:')),
    ...(await fetchKeyValuesByPrefix('rate_limit:consultation:')),
  ];

  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const staleKeys: string[] = [];

  for (const row of rows) {
    const val = row.value as { timestamps?: number[] } | null;
    if (!val || !Array.isArray(val.timestamps)) {
      // Malformed — treat as stale
      staleKeys.push(row.key);
      continue;
    }
    // If every timestamp is older than 1 hour, the whole entry is stale
    const allExpired = val.timestamps.every((t: number) => now - t >= oneHour);
    if (allExpired) {
      staleKeys.push(row.key);
    }
  }

  if (!dryRun && staleKeys.length > 0) {
    await batchDelete(staleKeys);
  }

  return {
    keysFound: staleKeys.length,
    keysDeleted: dryRun ? 0 : staleKeys.length,
    sampleKeys: sample(staleKeys),
  };
}

/**
 * 2. Expired newsletter confirmation tokens — unconfirmed subscriptions
 *    whose 48-hour window has passed.
 */
async function cleanExpiredNewsletterTokens(dryRun: boolean): Promise<CategoryResult> {
  const rows = await fetchKeyValuesByPrefix('newsletter:');

  const now = Date.now();
  const fortyEightHours = 48 * 60 * 60 * 1000;
  const staleKeys: string[] = [];

  for (const row of rows) {
    const val = row.value as Record<string, unknown> | null;
    if (!val) continue;

    // Only target unconfirmed entries with an expired token window
    if (val.confirmed === false && val.subscribedAt) {
      const subscribedAt = new Date(val.subscribedAt as string).getTime();
      if (now - subscribedAt > fortyEightHours) {
        staleKeys.push(row.key);
      }
    }
  }

  if (!dryRun && staleKeys.length > 0) {
    await batchDelete(staleKeys);
  }

  return {
    keysFound: staleKeys.length,
    keysDeleted: dryRun ? 0 : staleKeys.length,
    sampleKeys: sample(staleKeys),
  };
}

/**
 * 3. Old contact form and consultation submissions.
 */
async function cleanOldContactForms(
  dryRun: boolean,
  retentionDays: number,
): Promise<CategoryResult> {
  const rows = [
    ...(await fetchKeyValuesByPrefix('contact_form:')),
    ...(await fetchKeyValuesByPrefix('consultation:')),
  ];

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const staleKeys: string[] = [];

  for (const row of rows) {
    const val = row.value as Record<string, unknown> | null;
    if (!val) { staleKeys.push(row.key); continue; }

    const submittedAt = val.submittedAt
      ? new Date(val.submittedAt as string).getTime()
      : 0;
    if (submittedAt > 0 && submittedAt < cutoff) {
      staleKeys.push(row.key);
    }
  }

  if (!dryRun && staleKeys.length > 0) {
    await batchDelete(staleKeys);
  }

  return {
    keysFound: staleKeys.length,
    keysDeleted: dryRun ? 0 : staleKeys.length,
    sampleKeys: sample(staleKeys),
  };
}

/**
 * 4. Old quote request submissions.
 */
async function cleanOldQuoteRequests(
  dryRun: boolean,
  retentionDays: number,
): Promise<CategoryResult> {
  const rows = await fetchKeyValuesByPrefix('quote_request:');

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const staleKeys: string[] = [];

  for (const row of rows) {
    const val = row.value as Record<string, unknown> | null;
    if (!val) { staleKeys.push(row.key); continue; }

    const submittedAt = val.submittedAt
      ? new Date(val.submittedAt as string).getTime()
      : 0;
    if (submittedAt > 0 && submittedAt < cutoff) {
      staleKeys.push(row.key);
    }
  }

  if (!dryRun && staleKeys.length > 0) {
    await batchDelete(staleKeys);
  }

  return {
    keysFound: staleKeys.length,
    keysDeleted: dryRun ? 0 : staleKeys.length,
    sampleKeys: sample(staleKeys),
  };
}

/**
 * 5. Stale audit trail entries (e.g. audit:suspension_attempt:*).
 */
async function cleanStaleAuditEntries(
  dryRun: boolean,
  retentionDays: number,
): Promise<CategoryResult> {
  const rows = await fetchKeyValuesByPrefix('audit:');

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const staleKeys: string[] = [];

  for (const row of rows) {
    const val = row.value as Record<string, unknown> | null;
    if (!val) { staleKeys.push(row.key); continue; }

    // Audit entries may use `timestamp` or `createdAt`
    const ts = (val.timestamp || val.createdAt) as string | undefined;
    const entryTime = ts ? new Date(ts).getTime() : 0;
    if (entryTime > 0 && entryTime < cutoff) {
      staleKeys.push(row.key);
    }
  }

  if (!dryRun && staleKeys.length > 0) {
    await batchDelete(staleKeys);
  }

  return {
    keysFound: staleKeys.length,
    keysDeleted: dryRun ? 0 : staleKeys.length,
    sampleKeys: sample(staleKeys),
  };
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Run the full stale KV cleanup.
 *
 * @param options.dryRun              If true (default), no deletions — preview only.
 * @param options.retentionDays       Days to retain form submissions (default: 90).
 * @param options.auditRetentionDays  Days to retain audit trail entries (default: 365).
 */
export async function runKvCleanup(
  options: KvCleanupOptions = {},
): Promise<KvCleanupResult> {
  const dryRun = options.dryRun ?? true;
  const retentionDays = options.retentionDays ?? 90;
  const auditRetentionDays = options.auditRetentionDays ?? 365;
  const startTime = Date.now();

  log.info(`Starting KV cleanup (dryRun=${dryRun}, retentionDays=${retentionDays}, auditRetentionDays=${auditRetentionDays})`);

  const [
    rateLimits,
    expiredNewsletterTokens,
    oldContactForms,
    oldQuoteRequests,
    staleAuditEntries,
  ] = await Promise.all([
    cleanRateLimits(dryRun),
    cleanExpiredNewsletterTokens(dryRun),
    cleanOldContactForms(dryRun, retentionDays),
    cleanOldQuoteRequests(dryRun, retentionDays),
    cleanStaleAuditEntries(dryRun, auditRetentionDays),
  ]);

  const totalKeysFound =
    rateLimits.keysFound +
    expiredNewsletterTokens.keysFound +
    oldContactForms.keysFound +
    oldQuoteRequests.keysFound +
    staleAuditEntries.keysFound;

  const totalKeysDeleted =
    rateLimits.keysDeleted +
    expiredNewsletterTokens.keysDeleted +
    oldContactForms.keysDeleted +
    oldQuoteRequests.keysDeleted +
    staleAuditEntries.keysDeleted;

  const durationMs = Date.now() - startTime;

  const result: KvCleanupResult = {
    dryRun,
    retentionDays,
    auditRetentionDays,
    categories: {
      rateLimits,
      expiredNewsletterTokens,
      oldContactForms,
      oldQuoteRequests,
      staleAuditEntries,
    },
    totalKeysFound,
    totalKeysDeleted,
    timestamp: new Date().toISOString(),
    durationMs,
  };

  log.info('KV cleanup complete', {
    dryRun,
    totalKeysFound,
    totalKeysDeleted,
    durationMs,
  });

  // Persist last run status in KV so the dashboard System Health card can display it.
  // Only live runs are persisted (dry runs are previews only).
  if (!dryRun) {
    try {
      await kv.set('system:kv_cleanup:last_run', {
        timestamp: result.timestamp,
        totalKeysFound,
        totalKeysDeleted,
        durationMs,
        retentionDays,
        auditRetentionDays,
      });
    } catch (persistErr) {
      log.error('Failed to persist last cleanup run status (non-blocking)', persistErr);
    }
  }

  return result;
}

/**
 * Get the last live cleanup run status (for the dashboard System Health card).
 * Returns null if no live run has been performed yet.
 */
export async function getLastCleanupRun(): Promise<{
  timestamp: string;
  totalKeysFound: number;
  totalKeysDeleted: number;
  durationMs: number;
  retentionDays: number;
  auditRetentionDays: number;
} | null> {
  try {
    const data = await kv.get('system:kv_cleanup:last_run');
    return data as {
      timestamp: string;
      totalKeysFound: number;
      totalKeysDeleted: number;
      durationMs: number;
      retentionDays: number;
      auditRetentionDays: number;
    } | null;
  } catch {
    return null;
  }
}