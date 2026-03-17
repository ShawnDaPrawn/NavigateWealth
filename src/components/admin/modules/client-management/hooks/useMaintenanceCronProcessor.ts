/**
 * Client Management — useMaintenanceCronProcessor Hook
 *
 * Client-side poller that triggers both the Data Maintenance (client
 * profile cleanup) and the KV Store Cleanup as automated daily jobs.
 *
 * Since this environment does not have a native cron scheduler, we use
 * a client-side interval as a practical alternative — identical to the
 * pattern established by `useOverdueDigestProcessor`.
 *
 * Both endpoints are idempotent:
 * - Client cleanup: persists `system:client_cleanup:last_run` in KV
 * - KV cleanup: persists `system:kv_cleanup:last_run` in KV
 * The server checks the date to skip if already run today.
 *
 * Flow:
 *   1. On mount (admin panel load), check both status endpoints
 *   2. If either hasn't run today, POST the corresponding cron endpoint
 *   3. Re-check every 6 hours in case the panel stays open overnight
 *
 * @module client-management/hooks
 */

import { useEffect, useRef, useCallback } from 'react';
import { api } from '../../../../../utils/api/client';
import { createClient } from '../../../../../utils/supabase/client';

/** Re-check interval — 6 hours */
const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Initial delay before first run — 35 seconds (staggered after other processors) */
const INITIAL_DELAY_MS = 35_000;

interface StatusResponse {
  success: boolean;
  alreadyRanToday: boolean;
  lastRun: {
    timestamp: string;
    [key: string]: unknown;
  } | null;
}

/**
 * Hook that automatically triggers daily Data Maintenance and KV Store
 * Cleanup cron jobs when the admin panel is open.
 *
 * Must be called inside a component that mounts when the admin panel is active.
 * The interval is automatically cleaned up on unmount.
 *
 * @param options.enabled - Whether the processor should be active (default: true)
 * @param options.onClientCleanupRan - Optional callback when client cleanup completes
 * @param options.onKvCleanupRan - Optional callback when KV cleanup completes
 */
export function useMaintenanceCronProcessor(options?: {
  enabled?: boolean;
  onClientCleanupRan?: () => void;
  onKvCleanupRan?: () => void;
}) {
  const { enabled = true, onClientCleanupRan, onKvCleanupRan } = options || {};
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);

  const checkAndRunMaintenance = useCallback(async () => {
    // Prevent concurrent runs
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    try {
      // Verify we have an active session before making auth-required calls
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        // No session yet — skip this tick and wait for the next interval
        return;
      }

      // ── 1. Client Data Maintenance ──────────────────────────────────
      try {
        const clientStatus = await api.get<StatusResponse>('/clients/cron/status');

        if (!clientStatus.alreadyRanToday) {
          // Trigger the cleanup — uses the existing /clients/maintenance/cleanup
          // endpoint which the admin already has access to
          const result = await api.post<{ success: boolean; dryRun: boolean; totalProfilesScanned: number }>(
            '/clients/maintenance/cleanup',
            { dryRun: false },
          );

          if (result.success) {
            console.log(
              `[MaintenanceCronProcessor] Client cleanup complete: ${result.totalProfilesScanned} profiles scanned`
            );
            onClientCleanupRan?.();
          }
        }
      } catch (err) {
        // Silent failure — background task
        console.error('[MaintenanceCronProcessor] Error running client cleanup:', err);
      }

      // ── 2. KV Store Cleanup ────────────────────────────────────────
      try {
        const kvStatus = await api.get<StatusResponse>('/kv-cleanup/status');

        if (!kvStatus.alreadyRanToday) {
          const result = await api.post<{ success: boolean; dryRun: boolean; totalKeysDeleted: number }>(
            '/kv-cleanup/run',
            { dryRun: false },
          );

          if (result.success) {
            console.log(
              `[MaintenanceCronProcessor] KV cleanup complete: ${result.totalKeysDeleted} stale keys deleted`
            );
            onKvCleanupRan?.();
          }
        }
      } catch (err) {
        // Silent failure — background task
        console.error('[MaintenanceCronProcessor] Error running KV cleanup:', err);
      }
    } finally {
      isRunningRef.current = false;
    }
  }, [onClientCleanupRan, onKvCleanupRan]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Run after a short delay on mount (give the panel time to settle)
    const initialTimeout = setTimeout(checkAndRunMaintenance, INITIAL_DELAY_MS);

    // Then re-check every 6 hours
    intervalRef.current = setInterval(checkAndRunMaintenance, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, checkAndRunMaintenance]);
}