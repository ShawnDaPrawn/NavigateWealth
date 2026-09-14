/**
 * Publications Feature - useScheduledPublishProcessor Hook
 *
 * Client-side poller that calls the server's process-scheduled endpoint
 * every 5 minutes while an admin has a visible admin tab open. This
 * accelerates automatic publication of scheduled articles that have reached
 * their publish date/time.
 *
 * This accelerates the pg_cron job that is the authoritative driver, so it
 * pauses while the tab is hidden. The endpoint is idempotent — calling it when
 * no articles are due is a no-op.
 *
 * @module publications/hooks
 */

import { useRef, useCallback } from 'react';
import { useVisibilityAwarePoll } from '../../../../../hooks/useVisibilityAwarePoll';
import { PublicationsAPI } from '../api';
import { createClient } from '../../../../../utils/supabase/client';
import { logger } from '../../../../../utils/logger';

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
  const isRunningRef = useRef(false);

  const processScheduled = useCallback(async () => {
    // Prevent concurrent runs
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    try {
      // Verify we have an active session before making server calls
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        // No session yet — skip this tick and wait for the next interval
        return;
      }

      const result = await PublicationsAPI.Articles.processScheduled();
      if (result && result.processed > 0) {
        logger.info('[ScheduledPublishProcessor] Published scheduled articles', {
          processed: result.processed,
        });
        onProcessed?.(result.processed);
      }
    } catch (err) {
      // Silent failure — this is a background task
      console.error('[ScheduledPublishProcessor] Error processing scheduled articles:', err);
    } finally {
      isRunningRef.current = false;
    }
  }, [onProcessed]);

  // Paused while the tab is hidden: this is an accelerator over a pg_cron
  // job, so a backgrounded tab polling it only burns invocations.
  useVisibilityAwarePoll(processScheduled, {
    intervalMs: POLL_INTERVAL_MS,
    initialDelayMs: INITIAL_DELAY_MS,
    enabled,
  });
}
