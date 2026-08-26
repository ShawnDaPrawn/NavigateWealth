/**
 * processArticleNotificationJobs — contract tests
 * ===============================================
 *
 * The cron-driven processor. It leases a job, mints tracking records in
 * batches, delivers in batches, and either finalises the job or hands it back to
 * the queue with its progress recorded. Every branch here is one a stuck publish
 * blast depends on.
 *
 * `email-service.ts` is the only stub; the KV, the tracking store, the job
 * records and the campaign rows are all real code against an in-memory store.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sendEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => ({ success: true })),
}));

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../newsletter-group-service.ts', () => ({
  backfillLegacyNewsletterSubscribersToGroup: vi.fn(async () => undefined),
}));
vi.mock('../email-service.ts', () => ({
  sendEmail,
  getFooterSettings: vi.fn(async () => ({})),
  createEmailTemplate: () => '<html></html>',
}));

import * as kv from '../kv_store.tsx';
import { kvStore } from './helpers/contract-harness.ts';
import {
  getArticleNotificationJob,
  getArticleNotificationProcessorState,
  processArticleNotificationJobs,
} from '../publications-notification-service.ts';
import { queueArticleNotificationJob } from '../publications-notification-helpers.ts';
import {
  ARTICLE_NOTIFICATION_PROCESSOR_STATE_KEY,
  DEFAULT_AUTOMATED_MAX_BATCHES_PER_JOB,
  DEFAULT_AUTOMATED_MAX_JOBS,
  DELIVERY_BATCH_SIZE,
  notificationCampaignKey,
  notificationJobKey,
  TRACKING_PREPARE_BATCH_SIZE,
} from '../publications-notification-state.ts';
import { listArticleEmailTrackingRecords } from '../publications-email-engagement-service.ts';
import type {
  ArticleNotificationCampaign,
  ArticleNotificationJob,
  ArticleNotificationProcessorState,
} from '../publications-notification-types.ts';

const ARTICLE = { id: 'art-1', title: 'Two-pot reform', slug: 'two-pot', excerpt: 'Summary.' };

const recipients = (count: number, prefix = 'reader') =>
  Array.from({ length: count }, (_, index) => ({
    email: `${prefix}${String(index).padStart(2, '0')}@example.com`,
    firstName: `Reader${index}`,
    name: `Reader ${index}`,
  }));

const publish = (article = ARTICLE) =>
  kvStore.set(`article:${article.id}`, {
    status: 'published',
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
  });

const storedJob = (jobId: string) =>
  kvStore.get(notificationJobKey(jobId)) as ArticleNotificationJob;

const storedCampaign = (campaignId: string) =>
  kvStore.get(notificationCampaignKey(campaignId)) as ArticleNotificationCampaign | undefined;

const processorState = () =>
  kvStore.get(ARTICLE_NOTIFICATION_PROCESSOR_STATE_KEY) as
    | ArticleNotificationProcessorState
    | undefined;

const queuePublishJob = async (count: number, article = ARTICLE) => {
  publish(article);
  return queueArticleNotificationJob(article, recipients(count), { kind: 'publish' });
};

/**
 * Makes one KV method reject for the duration of `run`, then restores it.
 * `failures` bounds how many calls fail — the run's own error handler reads KV
 * too, so a method that failed unconditionally would take the handler down with
 * it and there would be nothing left to assert on.
 */
async function withFailingKv<T>(
  method: 'mset' | 'set' | 'getByPrefix',
  run: () => Promise<T>,
  options: { failures?: number } = {},
): Promise<T> {
  let remaining = options.failures ?? Number.POSITIVE_INFINITY;
  const fn = vi.mocked(kv[method] as unknown as (...args: unknown[]) => Promise<unknown>);
  const original = fn.getMockImplementation()!;
  fn.mockImplementation(async (...args: unknown[]) => {
    if (remaining > 0) {
      remaining -= 1;
      throw new Error(`KV ${method} unavailable`);
    }
    return original(...args);
  });
  try {
    return await run();
  } finally {
    fn.mockImplementation(original);
  }
}

beforeEach(() => {
  kvStore.clear();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ success: true });
});

describe('processArticleNotificationJobs — a publish job end to end', () => {
  it('prepares, delivers and finalises a job that fits in one run', async () => {
    const queued = await queuePublishJob(3);

    const result = await processArticleNotificationJobs({ mode: 'manual' });

    expect(result).toMatchObject({ processedJobs: 1, advancedJobs: 1, completedJobs: 1 });
    expect(sendEmail).toHaveBeenCalledTimes(3);
    expect(result.jobs[0]).toMatchObject({
      id: queued.id,
      status: 'completed',
      sentCount: 3,
      pendingCount: 0,
      progressPercent: 100,
      phase: 'completed',
    });
    expect(storedCampaign(queued.id)).toMatchObject({ status: 'completed', sentCount: 3 });
  });

  it('records terminal failures instead of retrying them forever', async () => {
    const queued = await queuePublishJob(2);
    sendEmail.mockImplementation(async (to: string) => {
      if (to === 'reader01@example.com') throw new Error('Bad request: invalid email');
      return { success: true };
    });

    const result = await processArticleNotificationJobs({ mode: 'manual' });

    expect(result.completedJobs).toBe(1);
    expect(result.jobs[0]).toMatchObject({
      status: 'completed_with_failures',
      sentCount: 1,
      failedTerminalCount: 1,
    });
    expect(result.jobs[0].lastError).toContain('reader01@example.com');
    expect(storedJob(queued.id).status).toBe('completed_with_failures');
  });

  it('leaves a retryable failure queued for the next run rather than finalising', async () => {
    await queuePublishJob(1);
    sendEmail.mockRejectedValue(new Error('socket hang up'));

    const result = await processArticleNotificationJobs({ mode: 'manual', maxBatchesPerJob: 1 });

    expect(result.completedJobs).toBe(0);
    expect(result.jobs[0]).toMatchObject({
      status: 'queued',
      failedRetryableCount: 1,
      pendingCount: 1,
    });
  });

  it('finalises a job whose work is already done without sending anything', async () => {
    const queued = await queuePublishJob(1);
    kvStore.set(notificationJobKey(queued.id), {
      ...storedJob(queued.id),
      // No items left to prepare or deliver: the shape left behind when a run
      // delivered everything but died before writing the completion.
      items: [],
      recipientCount: 0,
    });

    const result = await processArticleNotificationJobs({ mode: 'manual' });

    expect(result).toMatchObject({ advancedJobs: 1, completedJobs: 1 });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(storedJob(queued.id).status).toBe('completed');
  });
});

describe('processArticleNotificationJobs — batching across runs', () => {
  it('stops at the batch ceiling and hands the job back with its progress kept', async () => {
    const total = DELIVERY_BATCH_SIZE + 5;
    const queued = await queuePublishJob(total);

    const first = await processArticleNotificationJobs({ mode: 'manual', maxBatchesPerJob: 1 });

    // One prepare batch mints 15 tokens; one delivery batch then sends those 15.
    expect(sendEmail).toHaveBeenCalledTimes(TRACKING_PREPARE_BATCH_SIZE);
    expect(first.completedJobs).toBe(0);
    expect(first.jobs[0]).toMatchObject({
      status: 'queued',
      sentCount: TRACKING_PREPARE_BATCH_SIZE,
      pendingCount: total - TRACKING_PREPARE_BATCH_SIZE,
    });
    expect(await listArticleEmailTrackingRecords(ARTICLE.id)).toHaveLength(
      TRACKING_PREPARE_BATCH_SIZE,
    );

    const second = await processArticleNotificationJobs({ mode: 'manual' });

    expect(second.completedJobs).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(total);
    expect(storedJob(queued.id)).toMatchObject({ status: 'completed' });
  });

  it('never sends the same recipient twice across runs', async () => {
    // The whole point of the tracking record is idempotency: a re-run must skip
    // anyone already delivered.
    await queuePublishJob(3);
    await processArticleNotificationJobs({ mode: 'manual' });
    sendEmail.mockClear();

    await processArticleNotificationJobs({ mode: 'manual' });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('honours maxJobs, leaving the rest of the queue for the next run', async () => {
    await queuePublishJob(1, ARTICLE);
    await queuePublishJob(1, { ...ARTICLE, id: 'art-2' });

    const result = await processArticleNotificationJobs({ mode: 'manual', maxJobs: 1 });

    expect(result).toMatchObject({ processedJobs: 1, advancedJobs: 1 });
    expect(result.jobs).toHaveLength(1);
  });

  it('processes the oldest job first', async () => {
    const older = await queuePublishJob(1, ARTICLE);
    const newer = await queuePublishJob(1, { ...ARTICLE, id: 'art-2' });
    kvStore.set(notificationJobKey(older.id), {
      ...storedJob(older.id),
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    kvStore.set(notificationJobKey(newer.id), {
      ...storedJob(newer.id),
      createdAt: '2026-06-01T00:00:00.000Z',
    });

    const result = await processArticleNotificationJobs({ mode: 'manual', maxJobs: 1 });

    expect(result.jobs[0].id).toBe(older.id);
  });

  it('processes only the named job when one is targeted', async () => {
    await queuePublishJob(1, ARTICLE);
    const target = await queuePublishJob(1, { ...ARTICLE, id: 'art-2' });

    const result = await processArticleNotificationJobs({ jobId: target.id, mode: 'manual' });

    expect(result.jobs.map((j) => j.id)).toEqual([target.id]);
  });

  it('does nothing for a targeted job that has already finished', async () => {
    const done = await queuePublishJob(1);
    await processArticleNotificationJobs({ mode: 'manual' });
    sendEmail.mockClear();

    const result = await processArticleNotificationJobs({ jobId: done.id, mode: 'manual' });

    expect(result).toMatchObject({ processedJobs: 0, advancedJobs: 0, jobs: [] });
  });

  it('skips a job another worker already holds the lease on', async () => {
    const queued = await queuePublishJob(1);
    kvStore.set(notificationJobKey(queued.id), {
      ...storedJob(queued.id),
      status: 'processing',
      lockId: 'held-by-another-run',
      lockExpiresAt: new Date(Date.now() + 30_000).toISOString(),
    });

    const result = await processArticleNotificationJobs({ mode: 'manual' });

    expect(result).toMatchObject({ processedJobs: 1, advancedJobs: 0, jobs: [] });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(storedJob(queued.id).lockId).toBe('held-by-another-run');
  });
});

describe('processArticleNotificationJobs — limits and modes', () => {
  it('clamps a manual request to the hard ceiling', async () => {
    await processArticleNotificationJobs({ mode: 'manual', maxJobs: 99, maxBatchesPerJob: 99 });

    expect(processorState()).toMatchObject({ mode: 'manual', maxJobs: 5, maxBatchesPerJob: 5 });
  });

  it('will not let an automated run ask for less throughput than its default', async () => {
    // Cron is the only thing that drains a large blast. A caller passing 1 must
    // not be able to throttle it below the scheduled baseline.
    await processArticleNotificationJobs({ mode: 'automated', maxJobs: 1, maxBatchesPerJob: 1 });

    expect(processorState()).toMatchObject({
      mode: 'automated',
      maxJobs: DEFAULT_AUTOMATED_MAX_JOBS,
      maxBatchesPerJob: DEFAULT_AUTOMATED_MAX_BATCHES_PER_JOB,
    });
  });

  it('defaults to a manual run when no mode is given', async () => {
    await processArticleNotificationJobs();

    expect(processorState()).toMatchObject({ mode: 'manual', maxJobs: 2, maxBatchesPerJob: 3 });
  });
});

describe('processArticleNotificationJobs — failure handling', () => {
  it('hands a job that blew up back to the queue with the reason recorded', async () => {
    const queued = await queuePublishJob(2);

    const result = await withFailingKv('mset', () =>
      processArticleNotificationJobs({ mode: 'manual' }),
    );

    expect(result.advancedJobs).toBe(0);
    expect(storedJob(queued.id)).toMatchObject({
      status: 'queued',
      lastError: 'KV mset unavailable',
    });
    expect(storedJob(queued.id).lockId).toBeNull();
    expect(result.jobs[0]).toMatchObject({ status: 'queued', lastError: 'KV mset unavailable' });
  });

  it('records the failure on the processor state and rethrows when the run itself dies', async () => {
    kvStore.set(ARTICLE_NOTIFICATION_PROCESSOR_STATE_KEY, {
      lastSuccessAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(
      withFailingKv('getByPrefix', () => processArticleNotificationJobs({ mode: 'automated' }), {
        failures: 1,
      }),
    ).rejects.toThrow('KV getByPrefix unavailable');

    expect(processorState()).toMatchObject({
      lastError: 'KV getByPrefix unavailable',
      // The previous success is preserved, so the dashboard can still say how
      // long it has been since the processor last actually worked.
      lastSuccessAt: '2026-01-01T00:00:00.000Z',
      processedJobs: 0,
      advancedJobs: 0,
      completedJobs: 0,
    });
  });
});

describe('processor state', () => {
  it('stamps a heartbeat and the run counters on every successful run', async () => {
    await queuePublishJob(1);

    await processArticleNotificationJobs({ mode: 'automated' });

    const state = await getArticleNotificationProcessorState();
    expect(state).toMatchObject({
      mode: 'automated',
      lastError: null,
      processedJobs: 1,
      advancedJobs: 1,
      completedJobs: 1,
      activeJobCount: 0,
      stuckJobCount: 0,
    });
    expect(state?.lastHeartbeatAt).toBeTruthy();
    expect(state?.lastSuccessAt).toBeTruthy();
  });

  it('reports nothing before the processor has ever run', async () => {
    await expect(getArticleNotificationProcessorState()).resolves.toBeNull();
  });
});

describe('getArticleNotificationJob', () => {
  it('returns a live snapshot and refreshes the campaign row from it', async () => {
    const queued = await queuePublishJob(2);
    await processArticleNotificationJobs({ mode: 'manual' });

    const snapshot = await getArticleNotificationJob(queued.id);

    expect(snapshot).toMatchObject({ id: queued.id, status: 'completed', sentCount: 2 });
    expect(storedCampaign(queued.id)).toMatchObject({ sentCount: 2, jobId: queued.id });
  });

  it('reports nothing for a job id that does not exist', async () => {
    await expect(getArticleNotificationJob('no-such-job')).resolves.toBeNull();
  });
});
