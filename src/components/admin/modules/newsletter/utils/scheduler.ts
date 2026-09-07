/**
 * Newsletter Studio — how healthy is background delivery right now?
 *
 * The processor state records the last browser-accelerator run and, separately,
 * the last run made by the pg_cron job. Only the cron job delivers unattended,
 * so the health signal is about that job specifically.
 */
import type { NewsletterProcessorState } from '../types';

/** A cron job on a 30-second cadence that has been silent this long is stale. */
export const SCHEDULER_STALE_AFTER_MS = 5 * 60_000;

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
