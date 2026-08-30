/**
 * Newsletter Studio — browser-side delivery accelerator.
 *
 * Best-effort accelerator only; the pg_cron job
 * (supabase/cron/newsletter-studio-jobs.sql) is the authoritative delivery
 * driver. Mounted at AdminDashboardPage level, same as
 * useArticleNotificationProcessor, so campaigns keep moving while any admin
 * tab is open. No-ops without a session; re-entrancy guarded.
 */
import { useCallback, useEffect, useRef } from 'react';
import { newsletterStudioApi } from '../api';
import { createClient } from '../../../../../utils/supabase/client';
import { logger } from '../../../../../utils/logger';

const POLL_INTERVAL_MS = 15_000;
const INITIAL_DELAY_MS = 13_000;

export function useNewsletterCampaignProcessor(options?: { enabled?: boolean }) {
  const { enabled = true } = options || {};
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);

  const processCampaigns = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await newsletterStudioApi.process();
    } catch (error) {
      logger.error('[NewsletterCampaignProcessor] tick failed', error);
    } finally {
      isRunningRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const initialTimeout = setTimeout(processCampaigns, INITIAL_DELAY_MS);
    intervalRef.current = setInterval(processCampaigns, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, processCampaigns]);
}
