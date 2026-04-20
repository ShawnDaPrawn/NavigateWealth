/**
 * E-Signature Scheduled Tasks
 *
 * Registers lightweight interval-based background jobs for the e-sign module.
 * In this Supabase Edge Function environment, `Deno.cron` is unavailable, so
 * we use `setInterval` as a best-effort scheduler. The interval survives as
 * long as the edge function instance stays warm; cold starts will re-register
 * the timer automatically via the import in mount-modules.ts.
 *
 * Because the sweep itself is idempotent and guards against re-processing
 * (checks `expires_at < now`), overlapping or missed runs are harmless.
 *
 * Belt-and-suspenders: an admin can always trigger a manual sweep via the
 * dashboard button or POST /esign/maintenance/expiry-sweep.
 */

import { runExpirySweep } from './esign-expiry-service.ts';
import { flushDigests } from './esign-notification-prefs.ts';
import { runReminderSweep } from './esign-reminder-service.ts';
import { flushWebhookOutbox } from './webhook-service.ts';
import { purgeExpiredDeletedEnvelopes } from './esign-recovery-bin.ts';
import { runStuckAlertSweep } from './esign-stuck-alert-service.ts';
import { runSyntheticProbe } from './esign-synthetic-probe.ts';
import { runRetentionSweep } from './esign-retention-service.ts';
import { drainCompletionQueue } from './esign-completion-queue.ts';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('esign-scheduler');

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Run the expiry sweep every 6 hours (in milliseconds). */
const EXPIRY_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Delay after server boot before the first automatic sweep (90 seconds).
 * Gives the rest of the server time to finish initialising.
 */
const INITIAL_DELAY_MS = 90 * 1000;

/** P5.2 — digest flush cadence. Once per 24h is plenty. */
const DIGEST_FLUSH_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** P5.3 — reminder sweep cadence. Hourly so the "day 3 / day 7 / day 14"
 *  windows stay within an hour of their intended moment. */
const REMINDER_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
/** P5.4 — webhook outbox tick cadence. One minute keeps retry windows
 *  tight without flooding the edge function instance. */
const WEBHOOK_FLUSH_INTERVAL_MS = 60 * 1000;
/** P6.8 — recovery bin retention sweep. Once every 24h is sufficient
 *  for a 90-day retention window; the sweeper itself is idempotent. */
const RECOVERY_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** P7.2 — stuck-envelope alert sweep. Runs every 6 hours; individual
 *  envelopes only alert once per 7-day cooldown so multiple ticks
 *  are harmless. */
const STUCK_ALERT_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** P7.4 — synthetic probe. Once an hour; the probe itself is cheap
 *  (no network / no PDF work — just a KV + hash round-trip). */
const SYNTHETIC_PROBE_INTERVAL_MS = 60 * 60 * 1000;
/** P7.5 — signed-PDF completion queue drain. A tight loop that keeps
 *  the request path fast; idempotent against an empty queue. */
const COMPLETION_DRAIN_INTERVAL_MS = 15 * 1000;
/** P7.7 — long-term retention sweep. Daily cadence; per-firm policies
 *  gate actual purges so off-by-default firms pay zero cost. */
const RETENTION_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// SCHEDULER
// ============================================================================

let schedulerStarted = false;

/**
 * Start the expiry sweep scheduler. Safe to call multiple times — only the
 * first invocation registers the timers.
 */
export function startExpirySweepScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  log.info(
    `Expiry sweep scheduler registered: initial run in ${INITIAL_DELAY_MS / 1000}s, ` +
    `then every ${EXPIRY_SWEEP_INTERVAL_MS / 1000 / 60 / 60}h`
  );

  // Initial delayed sweep
  setTimeout(async () => {
    log.info('Running initial scheduled expiry sweep...');
    try {
      const result = await runExpirySweep(false); // live run
      log.info(
        `Scheduled sweep complete: expired=${result.expiredCount}, ` +
        `skipped=${result.skippedCount}, errors=${result.errors.length}, ` +
        `duration=${result.durationMs}ms`
      );
    } catch (err) {
      log.error('Scheduled expiry sweep failed:', err);
    }
  }, INITIAL_DELAY_MS);

  // Recurring sweep
  setInterval(async () => {
    log.info('Running recurring scheduled expiry sweep...');
    try {
      const result = await runExpirySweep(false); // live run
      log.info(
        `Scheduled sweep complete: expired=${result.expiredCount}, ` +
        `skipped=${result.skippedCount}, errors=${result.errors.length}, ` +
        `duration=${result.durationMs}ms`
      );
    } catch (err) {
      log.error('Scheduled expiry sweep failed:', err);
    }
  }, EXPIRY_SWEEP_INTERVAL_MS);

  // P5.2 — nightly digest flush. First run delayed same as expiry sweep so
  // the edge function is warm; subsequent runs on a daily cadence.
  setTimeout(async () => {
    try {
      const result = await flushDigests();
      log.info(`Initial digest flush: users=${result.usersNotified}, entries=${result.entriesSent}`);
    } catch (err) {
      log.error('Initial digest flush failed:', err);
    }
  }, INITIAL_DELAY_MS + 5_000);
  setInterval(async () => {
    try {
      const result = await flushDigests();
      log.info(`Scheduled digest flush: users=${result.usersNotified}, entries=${result.entriesSent}`);
    } catch (err) {
      log.error('Scheduled digest flush failed:', err);
    }
  }, DIGEST_FLUSH_INTERVAL_MS);

  // P5.3 — reminder sweep. Runs hourly; each envelope's reminder policy
  // determines whether a reminder is due.
  setTimeout(async () => {
    try {
      const result = await runReminderSweep(false);
      log.info(
        `Initial reminder sweep: envelopes=${result.scannedCount}, ` +
        `remindersSent=${result.remindersSent}, errors=${result.errors.length}`,
      );
    } catch (err) {
      log.error('Initial reminder sweep failed:', err);
    }
  }, INITIAL_DELAY_MS + 10_000);
  setInterval(async () => {
    try {
      const result = await runReminderSweep(false);
      if (result.remindersSent > 0) {
        log.info(
          `Scheduled reminder sweep: envelopes=${result.scannedCount}, ` +
          `remindersSent=${result.remindersSent}`,
        );
      }
    } catch (err) {
      log.error('Scheduled reminder sweep failed:', err);
    }
  }, REMINDER_SWEEP_INTERVAL_MS);

  // P5.4 — webhook outbox tick. Tight cadence; the tick itself is cheap
  // when the outbox is empty.
  setInterval(async () => {
    try {
      const result = await flushWebhookOutbox();
      if (result.attempted > 0) {
        log.info(
          `Webhook outbox tick: attempted=${result.attempted}, ` +
          `delivered=${result.delivered}, retried=${result.retried}, ` +
          `deadLettered=${result.deadLettered}`,
        );
      }
    } catch (err) {
      log.error('Webhook outbox tick failed:', err);
    }
  }, WEBHOOK_FLUSH_INTERVAL_MS);

  // P6.8 — recovery-bin retention sweep. Runs once on boot (after the
  // initial delay) and then daily. Idempotent — entries that aren't
  // past retention are left alone.
  setTimeout(async () => {
    try {
      const result = await purgeExpiredDeletedEnvelopes();
      if (result.purgedCount > 0) {
        log.info(
          `Initial recovery sweep: scanned=${result.scannedCount}, ` +
          `purged=${result.purgedCount}`,
        );
      }
    } catch (err) {
      log.error('Initial recovery sweep failed:', err);
    }
  }, INITIAL_DELAY_MS + 15_000);
  setInterval(async () => {
    try {
      const result = await purgeExpiredDeletedEnvelopes();
      if (result.purgedCount > 0) {
        log.info(
          `Scheduled recovery sweep: scanned=${result.scannedCount}, ` +
          `purged=${result.purgedCount}`,
        );
      }
    } catch (err) {
      log.error('Scheduled recovery sweep failed:', err);
    }
  }, RECOVERY_SWEEP_INTERVAL_MS);

  // P7.2 — stuck-envelope alerting. First run shortly after boot so
  // any envelopes that accumulated overnight get flagged on the next
  // sender touch.
  setTimeout(async () => {
    try {
      const result = await runStuckAlertSweep();
      if (result.alerted > 0) {
        log.info(`Initial stuck sweep: scanned=${result.scanned}, alerted=${result.alerted}`);
      }
    } catch (err) {
      log.error('Initial stuck-alert sweep failed:', err);
    }
  }, INITIAL_DELAY_MS + 20_000);
  setInterval(async () => {
    try {
      const result = await runStuckAlertSweep();
      if (result.alerted > 0) {
        log.info(`Scheduled stuck sweep: scanned=${result.scanned}, alerted=${result.alerted}`);
      }
    } catch (err) {
      log.error('Scheduled stuck-alert sweep failed:', err);
    }
  }, STUCK_ALERT_SWEEP_INTERVAL_MS);

  // P7.4 — synthetic probe. First run on boot gives us a baseline; we
  // then sample hourly so a diagnostics surface can alert on trend.
  setTimeout(async () => {
    try {
      const result = await runSyntheticProbe();
      log.info(
        `Initial synthetic probe: ok=${result.ok}, latencyMs=${result.latencyMs}` +
        (result.error ? `, error=${result.error}` : ''),
      );
    } catch (err) {
      log.error('Initial synthetic probe failed:', err);
    }
  }, INITIAL_DELAY_MS + 25_000);
  setInterval(async () => {
    try {
      await runSyntheticProbe();
    } catch (err) {
      log.error('Scheduled synthetic probe failed:', err);
    }
  }, SYNTHETIC_PROBE_INTERVAL_MS);

  // P7.5 — completion queue drain. The sign route enqueues; this tick
  // dequeues and runs `completeEnvelope` so the request path stays
  // fast even for 50-page PDFs.
  setInterval(async () => {
    try {
      const result = await drainCompletionQueue();
      if (result.processed > 0) {
        log.info(
          `Completion queue drain: processed=${result.processed}, ` +
          `failed=${result.failed}`,
        );
      }
    } catch (err) {
      log.error('Completion queue drain failed:', err);
    }
  }, COMPLETION_DRAIN_INTERVAL_MS);

  // P7.7 — long-term retention sweep. Daily; a per-firm policy drives
  // the actual purges. Absent a policy the sweep is a cheap no-op.
  setTimeout(async () => {
    try {
      const result = await runRetentionSweep();
      if (result.purged > 0) {
        log.info(`Initial retention sweep: scanned=${result.scanned}, purged=${result.purged}`);
      }
    } catch (err) {
      log.error('Initial retention sweep failed:', err);
    }
  }, INITIAL_DELAY_MS + 30_000);
  setInterval(async () => {
    try {
      const result = await runRetentionSweep();
      if (result.purged > 0) {
        log.info(`Scheduled retention sweep: scanned=${result.scanned}, purged=${result.purged}`);
      }
    } catch (err) {
      log.error('Scheduled retention sweep failed:', err);
    }
  }, RETENTION_SWEEP_INTERVAL_MS);
}
