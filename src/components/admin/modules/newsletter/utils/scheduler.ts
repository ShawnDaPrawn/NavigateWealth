/**
 * Newsletter Studio — how healthy is background delivery right now?
 *
 * The processor state records the last browser-accelerator run and, separately,
 * the last run made by the pg_cron job. Only the cron job delivers unattended,
 * so the health signal is about that job specifically.
 */
import type { NewsletterProcessorState } from '../types';

/**
 * How long `lastCronRunAt` may go unrefreshed before delivery is called stale.
 *
 * This has to clear the worst-case age of an honest heartbeat, which is set by
 * two server-side numbers together:
 *
 *   - the cron cadence, now every 2 minutes
 *     (`supabase/cron/newsletter-studio-jobs.sql`), and
 *   - `IDLE_HEARTBEAT_INTERVAL_MS` (2 minutes), the window inside which an
 *     idle tick skips rewriting the row rather than burn a KV write on a fresh
 *     timestamp.
 *
 * A write at T is therefore skipped at T+2min (age 2 min, inside the window)
 * and made at T+4min, so a perfectly healthy job can show a 4-minute-old
 * heartbeat. At the previous 5 minutes that left one minute of margin for
 * delivery jitter and cold starts, which is not enough; 10 minutes leaves six.
 * A genuinely dead job goes silent for hours, so nothing is lost by waiting.
 */
export const SCHEDULER_STALE_AFTER_MS = 10 * 60_000;

export type SchedulerLevel = 'live' | 'stale' | 'missing' | 'unknown';

export interface SchedulerHealth {
  level: SchedulerLevel;
  /** Short label for pills: "Scheduler live". */
  label: string;
  /** One sentence for banners and tooltips. */
  detail: string;
}

export function schedulerHealth(
  processor: NewsletterProcessorState | null | undefined,
  now: number = Date.now(),
): SchedulerHealth {
  if (!processor) {
    return {
      level: 'unknown',
      label: 'No delivery runs yet',
      detail: 'Delivery has not run yet. It starts automatically once a campaign is queued.',
    };
  }
  if (!processor.lastCronRunAt) {
    return {
      level: 'missing',
      label: 'Scheduler not installed',
      detail:
        'The scheduled delivery job has never checked in. Campaigns only send while an admin has the studio open until an operator installs it.',
    };
  }
  const age = now - new Date(processor.lastCronRunAt).getTime();
  if (Number.isNaN(age) || age > SCHEDULER_STALE_AFTER_MS) {
    return {
      level: 'stale',
      label: 'Scheduler stale',
      detail:
        'The scheduled delivery job has not checked in recently. Scheduled sends may be delayed until it recovers.',
    };
  }
  return {
    level: 'live',
    label: 'Scheduler live',
    detail: 'Background delivery is running on schedule, so campaigns send unattended.',
  };
}

/** True when the processor reported an error on its latest pass. */
export function hasProcessorError(processor: NewsletterProcessorState | null | undefined): boolean {
  return Boolean(processor?.lastError);
}
