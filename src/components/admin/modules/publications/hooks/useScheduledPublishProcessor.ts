/**
 * Publications Feature - useScheduledPublishProcessor Hook
 *
 * Client-side poller that calls the server's process-scheduled endpoint
 * every 5 minutes while the Publications module is mounted. This handles
 * automatic publication of scheduled articles that have reached their
 * publish date/time.
 *
 * Since this environment does not have a native cron scheduler, we use
 * a client-side interval as a practical alternative. The endpoint is
 * idempotent — calling it when no articles are due is a no-op.
 *
 * @module publications/hooks
 */

import { useEffect, useRef, useCallback } from 'react';
import { PublicationsAPI } from '../api';
import { createClient } from '../../../../../utils/supabase/client';

/** Interval in milliseconds — 5 minutes */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

/** Initial delay before first run — 20 seconds (let the server warm up) */
const INITIAL_DELAY_MS = 20_000;

/**
 * Hook that runs a background poller for processing scheduled articles.
 *
 * Must be called inside a component that mounts when the admin panel is active.
 * The interval is automatically cleaned up on unmount.
 *
 * @param enabled - Whether the processor should be active (default: true)
 * @param onProcessed - Optional callback when articles are processed
 */
export function useScheduledPublishProcessor(options?: {
  enabled?: boolean;
  onProcessed?: (count: number) => void;
}) {
  const { enabled = true, onProcessed } = options || {};
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);

  const processScheduled = useCallback(async () => {
    // Prevent concurrent runs
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    try {
      // Verify we have an active session before making server calls
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        // No session yet — skip this tick and wait for the next interval
        return;
      }

      const result = await PublicationsAPI.Articles.processScheduled();
      if (result && result.processed > 0) {
        console.log(`[ScheduledPublishProcessor] Published ${result.processed} scheduled article(s)`);
        onProcessed?.(result.processed);
      }
    } catch (err) {
      // Silent failure — this is a background task
      console.error('[ScheduledPublishProcessor] Error processing scheduled articles:', err);
    } finally {
      isRunningRef.current = false;
    }
  }, [onProcessed]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Run after an initial delay to let the server warm up and auth settle
    const initialTimeout = setTimeout(processScheduled, INITIAL_DELAY_MS);
    intervalRef.current = setInterval(processScheduled, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, processScheduled]);
}