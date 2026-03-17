/**
 * Client Cleanup Service
 * 
 * Periodic maintenance utility that scans for and reconciles orphaned or
 * inconsistent client data in the KV store. Designed to be triggered by
 * an admin-only route rather than a scheduled job (edge functions don't
 * support cron natively).
 * 
 * Handles three categories of stale data:
 * 
 * 1. **Orphaned KV profiles** — user_profile entries whose Supabase Auth
 *    account has been fully deleted. These are marked accountStatus:'closed'
 *    and security.deleted:true so they no longer appear in searches.
 * 
 * 2. **Security/profile drift** — profiles where security.deleted or
 *    security.suspended is true but the profile's accountStatus was never
 *    updated (legacy records from before the deleteClient/suspendClient
 *    methods were updated to propagate status).
 * 
 * 3. **Orphaned security entries** — security:* keys with no matching
 *    profile. Logged for visibility but not automatically removed.
 * 
 * All mutations are idempotent and safe to re-run.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('client-cleanup');

function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// ============================================================================
// Types
// ============================================================================

export interface CleanupResult {
  /** Total KV profile entries scanned */
  totalProfilesScanned: number;

  /** Profiles whose auth account no longer exists — marked as closed */
  orphanedProfilesClosed: number;

  /** Profiles where security.deleted was true but accountStatus wasn't 'closed' — backfilled */
  deletedStatusBackfilled: number;

  /** Profiles where security.suspended was true but accountStatus wasn't 'suspended' — backfilled */
  suspendedStatusBackfilled: number;

  /** Individual records affected (for audit trail) */
  affectedRecords: AffectedRecord[];

  /** Timestamp of the cleanup run */
  timestamp: string;

  /** Duration in ms */
  durationMs: number;
}

interface AffectedRecord {
  userId: string;
  action: 'orphan_closed' | 'deleted_backfill' | 'suspended_backfill';
  previousAccountStatus: string | undefined;
  newAccountStatus: string;
}

// ============================================================================
// Cleanup Logic
// ============================================================================

/**
 * Run the full client cleanup scan.
 * 
 * @param dryRun  If true, no mutations are performed — only a report is returned.
 * @returns       Summary of the cleanup run.
 */
export async function runClientCleanup(dryRun = false): Promise<CleanupResult> {
  const startTime = Date.now();
  const supabase = createServiceClient();

  log.info(`Starting client cleanup (dryRun=${dryRun})`);

  // ── Fetch all profile KV entries ──────────────────────────────────────

  const { data: profileRows, error: fetchError } = await supabase
    .from('kv_store_91ed8379')
    .select('key, value')
    .like('key', 'user_profile:%:personal_info');

  if (fetchError) {
    log.error('Failed to fetch profile KV entries for cleanup', fetchError);
    throw new Error(`Cleanup aborted: ${fetchError.message}`);
  }

  const profiles = profileRows || [];
  log.info(`Scanned ${profiles.length} profile KV entries`);

  // ── Extract user IDs ─────────────────────────────────────────────────

  const profilesByUserId = new Map<string, unknown>();
  for (const row of profiles) {
    const match = row.key.match(/user_profile:([^:]+):personal_info/);
    if (match) {
      profilesByUserId.set(match[1], row.value);
    }
  }

  // ── Batch auth validation ────────────────────────────────────────────
  // Check which user IDs still exist in Supabase Auth.

  const userIds = Array.from(profilesByUserId.keys());
  const authExistence = new Map<string, boolean>();

  // Process in batches of 20 to avoid overwhelming auth API
  const BATCH_SIZE = 20;
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (uid) => {
        const { data: { user }, error } = await supabase.auth.admin.getUserById(uid);
        return { uid, exists: !error && !!user };
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        authExistence.set(result.value.uid, result.value.exists);
      } else {
        // If the auth check itself fails, assume user exists (conservative)
        log.info('Auth check failed for user, assuming exists', { error: result.reason });
      }
    }
  }

  // ── Reconcile ────────────────────────────────────────────────────────

  const affectedRecords: AffectedRecord[] = [];
  let orphanedProfilesClosed = 0;
  let deletedStatusBackfilled = 0;
  let suspendedStatusBackfilled = 0;

  for (const [userId, profile] of profilesByUserId) {
    // Skip admin/super_admin profiles — never touch these
    if (profile?.role === 'admin' || profile?.role === 'super_admin') {
      continue;
    }

    const authExists = authExistence.get(userId);
    const security = await kv.get(`security:${userId}`);

    // ── Case 1: Orphaned auth account ─────────────────────────────────
    if (authExists === false && profile?.accountStatus !== 'closed') {
      log.info('Orphaned KV profile detected (auth account removed)', { userId });

      if (!dryRun) {
        // Mark profile as closed
        profile.accountStatus = 'closed';
        profile.updatedAt = new Date().toISOString();
        await kv.set(`user_profile:${userId}:personal_info`, profile);

        // Also set security.deleted for belt-and-suspenders
        const sec = security || {};
        if (!sec.deleted) {
          sec.deleted = true;
          sec.deletedAt = new Date().toISOString();
          sec.deletedReason = 'cleanup:orphaned_auth_account';
          await kv.set(`security:${userId}`, sec);
        }
      }

      affectedRecords.push({
        userId,
        action: 'orphan_closed',
        previousAccountStatus: profile?.accountStatus,
        newAccountStatus: 'closed',
      });
      orphanedProfilesClosed++;
      continue;
    }

    // ── Case 2: security.deleted but profile not closed (backfill) ────
    if (security?.deleted === true && profile?.accountStatus !== 'closed') {
      log.info('Backfilling accountStatus for deleted client', { userId });

      if (!dryRun) {
        profile.accountStatus = 'closed';
        profile.updatedAt = new Date().toISOString();
        await kv.set(`user_profile:${userId}:personal_info`, profile);
      }

      affectedRecords.push({
        userId,
        action: 'deleted_backfill',
        previousAccountStatus: profile?.accountStatus,
        newAccountStatus: 'closed',
      });
      deletedStatusBackfilled++;
      continue;
    }

    // ── Case 3: security.suspended but profile not suspended (backfill)
    if (security?.suspended === true && profile?.accountStatus !== 'suspended') {
      log.info('Backfilling accountStatus for suspended client', { userId });

      if (!dryRun) {
        // Preserve previous status so unsuspend can restore it
        if (profile?.accountStatus && profile.accountStatus !== 'suspended') {
          const sec = security || {};
          sec.previousAccountStatus = profile.accountStatus;
          await kv.set(`security:${userId}`, sec);
        }

        profile.accountStatus = 'suspended';
        profile.updatedAt = new Date().toISOString();
        await kv.set(`user_profile:${userId}:personal_info`, profile);
      }

      affectedRecords.push({
        userId,
        action: 'suspended_backfill',
        previousAccountStatus: profile?.accountStatus,
        newAccountStatus: 'suspended',
      });
      suspendedStatusBackfilled++;
    }
  }

  const durationMs = Date.now() - startTime;

  const result: CleanupResult = {
    totalProfilesScanned: profiles.length,
    orphanedProfilesClosed,
    deletedStatusBackfilled,
    suspendedStatusBackfilled,
    affectedRecords,
    timestamp: new Date().toISOString(),
    durationMs,
  };

  log.info('Client cleanup complete', {
    dryRun,
    totalScanned: result.totalProfilesScanned,
    orphansClosed: result.orphanedProfilesClosed,
    deletedBackfilled: result.deletedStatusBackfilled,
    suspendedBackfilled: result.suspendedStatusBackfilled,
    durationMs: result.durationMs,
  });

  // Persist last run status in KV so the cron processor can check idempotency.
  // Only live runs are persisted (dry runs are previews only).
  if (!dryRun) {
    try {
      await kv.set('system:client_cleanup:last_run', {
        timestamp: result.timestamp,
        totalProfilesScanned: result.totalProfilesScanned,
        orphanedProfilesClosed: result.orphanedProfilesClosed,
        deletedStatusBackfilled: result.deletedStatusBackfilled,
        suspendedStatusBackfilled: result.suspendedStatusBackfilled,
        durationMs: result.durationMs,
      });
    } catch (persistErr) {
      log.error('Failed to persist last client cleanup run status (non-blocking)', persistErr);
    }
  }

  return result;
}

/**
 * Get the last live client cleanup run status.
 * Returns null if no live run has been performed yet.
 */
export async function getLastClientCleanupRun(): Promise<{
  timestamp: string;
  totalProfilesScanned: number;
  orphanedProfilesClosed: number;
  deletedStatusBackfilled: number;
  suspendedStatusBackfilled: number;
  durationMs: number;
} | null> {
  try {
    const data = await kv.get('system:client_cleanup:last_run');
    return data as {
      timestamp: string;
      totalProfilesScanned: number;
      orphanedProfilesClosed: number;
      deletedStatusBackfilled: number;
      suspendedStatusBackfilled: number;
      durationMs: number;
    } | null;
  } catch {
    return null;
  }
}