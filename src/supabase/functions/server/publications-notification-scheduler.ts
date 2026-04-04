import { processArticleNotificationJobs } from './publications-notification-service.ts';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('article-notification-scheduler');

const INITIAL_DELAY_MS = 15_000;
const PROCESS_INTERVAL_MS = 30_000;
const MAX_JOBS_PER_RUN = 3;
const MAX_BATCHES_PER_JOB = 3;

let schedulerStarted = false;
let isRunning = false;

async function runScheduledNotificationProcessing(reason: 'initial' | 'interval'): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    const result = await processArticleNotificationJobs({
      maxJobs: MAX_JOBS_PER_RUN,
      maxBatchesPerJob: MAX_BATCHES_PER_JOB,
    });
    if (result.advancedJobs > 0 || result.completedJobs > 0) {
      log.info('Processed article notification jobs in scheduler', {
        reason,
        processedJobs: result.processedJobs,
        advancedJobs: result.advancedJobs,
        completedJobs: result.completedJobs,
      });
    }
  } catch (error) {
    log.error('Scheduled article notification processing failed', error);
  } finally {
    isRunning = false;
  }
}

export function startArticleNotificationScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  log.info(
    `Article notification scheduler registered: initial run in ${INITIAL_DELAY_MS / 1000}s, ` +
    `then every ${PROCESS_INTERVAL_MS / 1000}s`,
  );

  setTimeout(() => {
    void runScheduledNotificationProcessing('initial');
  }, INITIAL_DELAY_MS);

  setInterval(() => {
    void runScheduledNotificationProcessing('interval');
  }, PROCESS_INTERVAL_MS);
}
