import { useCallback, useRef } from 'react';
import { useVisibilityAwarePoll } from '../../../../../hooks/useVisibilityAwarePoll';
import { PublicationsAPI } from '../api';
import { createClient } from '../../../../../utils/supabase/client';

const POLL_INTERVAL_MS = 15_000;
const INITIAL_DELAY_MS = 12_000;

export function useArticleNotificationProcessor(options?: {
  enabled?: boolean;
  onProcessed?: (count: number) => void;
}) {
  const { enabled = true, onProcessed } = options || {};
  const isRunningRef = useRef(false);

  const processJobs = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      const result = await PublicationsAPI.Articles.processNotificationJobs({
        maxJobs: 5,
        maxBatchesPerJob: 4,
      });
      if (result.advancedJobs > 0) {
        onProcessed?.(result.advancedJobs);
      }
    } catch (error) {
      console.error('[ArticleNotificationProcessor] Error processing notification jobs:', error);
    } finally {
      isRunningRef.current = false;
    }
  }, [onProcessed]);

  // Paused while the tab is hidden: this is an accelerator over a pg_cron
  // job, so a backgrounded tab polling it only burns invocations.
  useVisibilityAwarePoll(processJobs, {
    intervalMs: POLL_INTERVAL_MS,
    initialDelayMs: INITIAL_DELAY_MS,
    enabled,
  });
}
