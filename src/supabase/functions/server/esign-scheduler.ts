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
}
