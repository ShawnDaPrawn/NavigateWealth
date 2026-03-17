/**
 * Tasks Module — useOverdueDigestProcessor Hook
 *
 * Client-side poller that triggers the overdue tasks digest email.
 *
 * Since this environment does not have a native cron scheduler, we use
 * a client-side interval as a practical alternative. The endpoint is
 * idempotent — the server stores a `tasks_digest:last_sent` KV entry
 * keyed by date and silently skips if today's digest was already sent.
 *
 * Flow:
 *   1. On mount (admin panel load), check the server's /tasks-digest/status
 *   2. If not sent today, POST /tasks-digest/send-overdue
 *   3. Re-check every 30 minutes in case the panel stays open overnight
 *
 * @module tasks/hooks
 */

import { useEffect, useRef, useCallback } from 'react';
import { api } from '../../../../../utils/api/client';
import { createClient } from '../../../../../utils/supabase/client';

/** Re-check interval — 30 minutes */
const POLL_INTERVAL_MS = 30 * 60 * 1000;

/** Initial delay before first run — 30 seconds (let auth fully settle) */
const INITIAL_DELAY_MS = 30_000;

interface DigestStatusResponse {
  alreadySentToday: boolean;
  lastSentDate: string | null;
  lastOverdueCount: number;
  todayKey: string;
}

interface DigestSendResponse {
  success: boolean;
  sent: boolean;
  reason?: string;
  overdue_count?: number;
  breakdown?: { critical: number; high: number; medium: number; low: number };
}

/**
 * Hook that automatically triggers the overdue tasks daily digest email.
 *
 * Must be called inside a component that mounts when the admin panel is active.
 * The interval is automatically cleaned up on unmount.
 *
 * @param options.enabled - Whether the processor should be active (default: true)
 * @param options.onDigestSent - Optional callback when a digest email is successfully sent
 */
export function useOverdueDigestProcessor(options?: {
  enabled?: boolean;
  onDigestSent?: (overdueCount: number) => void;
}) {
  const { enabled = true, onDigestSent } = options || {};
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);

  const checkAndSendDigest = useCallback(async () => {
    // Prevent concurrent runs
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    try {
      // Verify we have an active admin session before making auth-required calls
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        // No session yet — skip this tick and wait for the next interval
        return;
      }

      // 1. Check if digest was already sent today
      const status = await api.get<DigestStatusResponse>('/tasks-digest/status');

      if (status.alreadySentToday) {
        // Already sent — nothing to do
        return;
      }

      // 2. Trigger the digest
      const result = await api.post<DigestSendResponse>('/tasks-digest/send-overdue');

      if (result.sent && result.overdue_count && result.overdue_count > 0) {
        console.log(
          `[OverdueDigestProcessor] Sent digest email with ${result.overdue_count} overdue task(s)`
        );
        onDigestSent?.(result.overdue_count);
      } else if (result.reason === 'no_overdue_tasks') {
        console.log('[OverdueDigestProcessor] No overdue tasks — no email sent');
      }
    } catch (err) {
      // Silent failure — this is a background task
      console.error('[OverdueDigestProcessor] Error checking/sending overdue digest:', err);
    } finally {
      isRunningRef.current = false;
    }
  }, [onDigestSent]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Run after a longer delay on mount (give the panel and auth time to settle)
    const initialTimeout = setTimeout(checkAndSendDigest, INITIAL_DELAY_MS);

    // Then re-check every 30 minutes
    intervalRef.current = setInterval(checkAndSendDigest, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, checkAndSendDigest]);
}