/**
 * Newsletter Studio — browser-side delivery accelerator.
 *
 * Best-effort accelerator only; the pg_cron job
 * (supabase/cron/newsletter-studio-jobs.sql) is the authoritative delivery
 * driver. Mounted at AdminDashboardPage level, same as
 * useArticleNotificationProcessor, so campaigns keep moving while an admin is
 * looking at any admin tab. Paused while that tab is hidden, because the cron
 * job covers the unattended case. No-ops without a session; re-entrancy
 * guarded.
 */
import { useCallback, useRef } from 'react';
import { useVisibilityAwarePoll } from '../../../../../hooks/useVisibilityAwarePoll';
import { newsletterStudioApi } from '../api';
import { createClient } from '../../../../../utils/supabase/client';
import { logger } from '../../../../../utils/logger';

const POLL_INTERVAL_MS = 15_000;
const INITIAL_DELAY_MS = 13_000;

export function useNewsletterCampaignProcessor(options?: { enabled?: boolean }) {
  const { enabled = true } = options || {};
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

  // Paused while the tab is hidden: this is an accelerator over a pg_cron
  // job, so a backgrounded tab polling it only burns invocations.
  useVisibilityAwarePoll(processCampaigns, {
    intervalMs: POLL_INTERVAL_MS,
    initialDelayMs: INITIAL_DELAY_MS,
    enabled,
  });
}
