/**
 * Publications Feature - useAutoContentProcessor Hook
 *
 * Client-side poller that calls the server's process-due endpoint
 * every 15 minutes while the Publications module is mounted. This handles
 * automatic triggering of content pipelines that are overdue based on
 * their configured scheduleIntervalHours.
 *
 * Since this environment does not have a native cron scheduler, we use
 * a client-side interval as a practical alternative. The endpoint is
 * idempotent — calling it when no pipelines are due is a no-op.
 *
 * @module publications/hooks
 */

import { useEffect, useRef, useCallback } from 'react';
import { PublicationsAPI } from '../api';
import { createClient } from '../../../../../utils/supabase/client';

/** Interval in milliseconds — 15 minutes */
const POLL_INTERVAL_MS = 15 * 60 * 1000;

/** Initial delay before first run — 25 seconds (staggered after scheduled processor) */
const INITIAL_DELAY_MS = 25_000;

/**
 * Hook that runs a background poller for processing due auto-content pipelines.
 *
 * Must be called inside a component that mounts when the admin panel is active.
 * The interval is automatically cleaned up on unmount.
 *
 * @param options.enabled - Whether the processor should be active (default: true)
 * @param options.onArticlesGenerated - Callback when new articles are generated
 */
export function useAutoContentProcessor(options?: {
  enabled?: boolean;
  onArticlesGenerated?: (count: number, pipelineNames: string[]) => void;
}) {
  const { enabled = true, onArticlesGenerated } = options || {};
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);

  const processDue = useCallback(async () => {
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

      const result = await PublicationsAPI.AutoContent.processDue();
      if (result && result.totalArticlesGenerated > 0) {
        const pipelineNames = result.processed
          .filter((p) => p.articlesGenerated > 0)
          .map((p) => p.pipelineId);
        console.error(
          `[AutoContentProcessor] Generated ${result.totalArticlesGenerated} article(s) from ${pipelineNames.length} pipeline(s)`
        );
        onArticlesGenerated?.(result.totalArticlesGenerated, pipelineNames);
      }
    } catch (err) {
      // Silent failure — this is a background task
      console.error('[AutoContentProcessor] Error processing due pipelines:', err);
    } finally {
      isRunningRef.current = false;
    }
  }, [onArticlesGenerated]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Run after an initial delay to let the server warm up and auth settle
    const initialTimeout = setTimeout(processDue, INITIAL_DELAY_MS);
    intervalRef.current = setInterval(processDue, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, processDue]);
}