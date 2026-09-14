/**
 * An interval that only runs while the tab is actually being looked at.
 *
 * The admin dashboard mounts several background "accelerator" pollers for the
 * whole session, two of them every 15 seconds. Written with a bare
 * `setInterval` they kept firing in a backgrounded tab, so one admin window
 * left open across a workday issued thousands of Edge Function invocations to
 * drain queues nobody was watching — the polling half of the resource audit in
 * `docs/INCIDENTS.md`, 2026-09-13.
 *
 * Every one of these pollers sits on top of a pg_cron job that is the
 * authoritative driver, so pausing while hidden costs at most a little queue
 * latency, and only for a tab with no one in front of it.
 *
 * On becoming visible the poller ticks immediately rather than waiting out a
 * full interval, so returning to the tab shows fresh state at once.
 *
 * @module hooks/useVisibilityAwarePoll
 */
import { useEffect, useRef } from 'react';

export interface VisibilityAwarePollOptions {
  /** How often to tick while the tab is visible. */
  intervalMs: number;
  /**
   * How long to wait before the very first tick, to let the app and the Edge
   * Function settle after sign-in. Applies once; a later resume ticks at once.
   */
  initialDelayMs?: number;
  /** Set false to stop polling entirely. */
  enabled?: boolean;
}

/**
 * Run `tick` on an interval, but only while `document.visibilityState` is
 * visible.
 *
 * `tick` is read through a ref, so passing a fresh closure on every render does
 * not restart the interval. Re-entrancy is the caller's business: these
 * pollers each guard with their own in-flight flag, because what counts as
 * "already running" differs between them.
 */
export function useVisibilityAwarePoll(
  tick: () => void | Promise<void>,
  { intervalMs, initialDelayMs = 0, enabled = true }: VisibilityAwarePollOptions,
): void {
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let startTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let hasTicked = false;

    const run = () => {
      hasTicked = true;
      void tickRef.current();
    };

    const stop = () => {
      if (startTimeoutId !== null) {
        clearTimeout(startTimeoutId);
        startTimeoutId = null;
      }
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const start = (delayMs: number) => {
      stop();
      startTimeoutId = setTimeout(() => {
        startTimeoutId = null;
        run();
        intervalId = setInterval(run, intervalMs);
      }, delayMs);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
        return;
      }
      // Catch up now. A tab opened in the background has never ticked, so it
      // still owes its settle delay; one that is merely returning does not.
      start(hasTicked ? 0 : initialDelayMs);
    };

    if (!document.hidden) start(initialDelayMs);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stop();
    };
  }, [enabled, intervalMs, initialDelayMs]);
}
