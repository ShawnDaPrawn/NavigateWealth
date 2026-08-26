/**
 * Article notification job lifecycle — contract tests
 * ===================================================
 *
 * Queueing, leasing, hydration, tracking-record preparation, resume and
 * finalisation. This is the layer that decides whether a publish blast can be
 * safely resumed after a timeout, and whether two concurrent cron runs can
 * double-send to the same subscriber.
 *
 * `email-service.ts` is the only stub: nothing here sends, but the modules under
 * test import it transitively.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../email-service.ts', () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
  getFooterSettings: vi.fn(async () => ({})),
  createEmailTemplate: () => '<html></html>',
}));

import { kvStore } from './helpers/contract-harness.ts';
import {
  acquireArticleNotificationJobLease,
  buildArticleNotificationProcessorState,
  campaignFromJobSnapshot,
  finalizeArticleNotificationJob,
  getActiveArticleNotificationJob,
  hydrateArticleNotificationJob,
  preparePublishJobTrackingBatch,
  queueArticleNotificationJob,
  releaseArticleNotificationJobLease,
  resumeArticleNotificationJob,
  syncRetryJobRecipients,
} from '../publications-notification-helpers.ts';
import {
  activeNotificationJobKey,
  notificationCampaignKey,
  notificationJobKey,
  STUCK_JOB_THRESHOLD_MS,
  TRACKING_PREPARE_BATCH_SIZE,
} from '../publications-notification-state.ts';
import {
  createArticleEmailTrackingRecords,
  listArticleEmailTrackingRecords,
  markArticleEmailDeliveryFailed,
  markArticleEmailDeliverySent,
  type ArticleEmailTrackingRecord,
} from '../publications-email-engagement-service.ts';
import type {
  ArticleNotificationCampaign,
  ArticleNotificationJob,
} from '../publications-notification-types.ts';

const ARTICLE = { id: 'art-1', title: 'Two-pot reform', slug: 'two-pot', excerpt: 'Summary.' };

const recipients = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    email: `reader${String(index).padStart(2, '0')}@example.com`,
    firstName: `Reader${index}`,
    name: `Reader ${index}`,
  }));

const storedJob = (jobId: string) =>
  kvStore.get(notificationJobKey(jobId)) as ArticleNotificationJob;

const storedCampaign = (campaignId: string) =>
  kvStore.get(notificationCampaignKey(campaignId)) as ArticleNotificationCampaign | undefined;

const activePointer = (kind: 'publish' | 'retry_undelivered') =>
  kvStore.get(activeNotificationJobKey(ARTICLE.id, 'publish', kind));

const trackingFor = (count: number): Promise<ArticleEmailTrackingRecord[]> =>
  createArticleEmailTrackingRecords(
    recipients(count).map((recipient) => ({ article: ARTICLE, recipient, source: 'publish' })),
  );

beforeEach(() => {
  kvStore.clear();
});

describe('queueArticleNotificationJob — publish', () => {
  it('creates a queued job, an active pointer and a campaign row', async () => {
    const snapshot = await queueArticleNotificationJob(ARTICLE, recipients(3), {
      kind: 'publish',
      source: 'publish',
    });

    expect(snapshot).toMatchObject({
      articleId: ARTICLE.id,
      kind: 'publish',
      status: 'queued',
      recipientCount: 3,
      // Nothing is prepared yet: tokens are minted in batches by the processor.
      prepareCursor: 0,
      preparedCount: 0,
      unpreparedCount: 3,
      phase: 'preparing',
    });
    expect(snapshot.items.every((i) => i.trackingToken === null)).toBe(true);
    expect(activePointer('publish')).toBe(snapshot.id);
    expect(storedCampaign(snapshot.id)).toMatchObject({
      status: 'queued',
      intendedRecipientCount: 3,
      jobId: snapshot.id,
    });
  });

  it('lower-cases and trims recipient addresses on the way into the job', async () => {
    const snapshot = await queueArticleNotificationJob(
      ARTICLE,
      [{ email: '  Mixed@Example.COM ', firstName: 'Mixed', name: 'Mixed Case' }],
      { kind: 'publish' },
    );

    expect(snapshot.items[0].email).toBe('mixed@example.com');
  });

  it('completes immediately, and leaves no pointer, when there is no audience', async () => {
    const snapshot = await queueArticleNotificationJob(ARTICLE, [], { kind: 'publish' });

    expect(snapshot).toMatchObject({ status: 'completed', recipientCount: 0, phase: 'completed' });
    expect(snapshot.completedAt).toBeTruthy();
    expect(activePointer('publish')).toBeUndefined();
    // A campaign with nobody to mail reads as "no_recipients", not "completed",
    // so the admin can tell an empty list from a successful send.
    expect(storedCampaign(snapshot.id)?.status).toBe('no_recipients');
    expect(storedCampaign(snapshot.id)?.progressPercent).toBe(100);
  });

  it('returns the job already in flight rather than queueing a second blast', async () => {
    const first = await queueArticleNotificationJob(ARTICLE, recipients(3), { kind: 'publish' });

    const second = await queueArticleNotificationJob(ARTICLE, recipients(9), { kind: 'publish' });

    expect(second.id).toBe(first.id);
    expect(second.recipientCount).toBe(3);
  });

  it('queues a fresh job once the previous one has finished', async () => {
    const first = await queueArticleNotificationJob(ARTICLE, recipients(1), { kind: 'publish' });
    await finalizeArticleNotificationJob(storedJob(first.id));

    const second = await queueArticleNotificationJob(ARTICLE, recipients(2), { kind: 'publish' });

    expect(second.id).not.toBe(first.id);
    expect(activePointer('publish')).toBe(second.id);
  });
});

describe('queueArticleNotificationJob — retry_undelivered', () => {
  it('arrives fully prepared, carrying the existing tracking tokens', async () => {
    const records = await trackingFor(2);

    const snapshot = await queueArticleNotificationJob(ARTICLE, records, {
      kind: 'retry_undelivered',
    });

    expect(snapshot).toMatchObject({
      kind: 'retry_undelivered',
      recipientCount: 2,
      prepareCursor: 2,
      preparedCount: 2,
      unpreparedCount: 0,
    });
    expect(snapshot.items.map((i) => i.trackingToken).sort()).toEqual(
      records.map((r) => r.token).sort(),
    );
    expect(activePointer('retry_undelivered')).toBe(snapshot.id);
  });

  it('does not write a campaign row, which belongs to the publish job', async () => {
    // Two campaign rows for one article would double-count on the dashboard.
    const snapshot = await queueArticleNotificationJob(ARTICLE, await trackingFor(1), {
      kind: 'retry_undelivered',
    });

    expect(storedCampaign(snapshot.id)).toBeUndefined();
  });

  it('re-syncs the recipient list of a retry job already in flight', async () => {
    const records = await trackingFor(3);
    const first = await queueArticleNotificationJob(ARTICLE, records, {
      kind: 'retry_undelivered',
    });

    const second = await queueArticleNotificationJob(ARTICLE, records.slice(0, 1), {
      kind: 'retry_undelivered',
    });

    expect(second.id).toBe(first.id);
    expect(second.recipientCount).toBe(1);
  });
});

describe('syncRetryJobRecipients', () => {
  it('completes the job and clears the pointer once nothing is left undelivered', async () => {
    const records = await trackingFor(2);
    const queued = await queueArticleNotificationJob(ARTICLE, records, {
      kind: 'retry_undelivered',
    });

    const synced = await syncRetryJobRecipients(storedJob(queued.id), []);

    expect(synced).toMatchObject({ status: 'completed', recipientCount: 0 });
    expect(synced.completedAt).toBeTruthy();
    expect(activePointer('retry_undelivered')).toBeUndefined();
  });

  it('leaves the job untouched when the list has not changed', async () => {
    const records = await trackingFor(2);
    const queued = await queueArticleNotificationJob(ARTICLE, records, {
      kind: 'retry_undelivered',
    });
    const before = storedJob(queued.id);

    await syncRetryJobRecipients(before, records);

    expect(storedJob(queued.id).updatedAt).toBe(before.updatedAt);
  });

  it('counts already-resolved records toward the progress index', async () => {
    const records = await trackingFor(2);
    const queued = await queueArticleNotificationJob(ARTICLE, records, {
      kind: 'retry_undelivered',
    });
    await markArticleEmailDeliverySent(records[0].token);
    const refreshed = await listArticleEmailTrackingRecords(ARTICLE.id);

    const synced = await syncRetryJobRecipients(storedJob(queued.id), refreshed.slice(0, 1));

    expect(synced.recipientCount).toBe(1);
  });
});

describe('getActiveArticleNotificationJob', () => {
  it('returns nothing, and clears the stale pointer, when the job has finished', async () => {
    const queued = await queueArticleNotificationJob(ARTICLE, recipients(1), { kind: 'publish' });
    kvStore.set(notificationJobKey(queued.id), { ...storedJob(queued.id), status: 'completed' });

    const active = await getActiveArticleNotificationJob(ARTICLE.id, 'publish', 'publish');

    expect(active).toBeNull();
    expect(activePointer('publish')).toBeUndefined();
  });

  it('returns nothing when the pointer names a job that no longer exists', async () => {
    kvStore.set(activeNotificationJobKey(ARTICLE.id, 'publish', 'publish'), 'ghost-job');

    await expect(
      getActiveArticleNotificationJob(ARTICLE.id, 'publish', 'publish'),
    ).resolves.toBeNull();
  });
});

describe('leases', () => {
  it('marks a queued job as processing and stamps a lock', async () => {
    const queued = await queueArticleNotificationJob(ARTICLE, recipients(1), { kind: 'publish' });

    const leased = await acquireArticleNotificationJobLease(storedJob(queued.id));

    expect(leased).toMatchObject({ status: 'processing' });
    expect(leased?.lockId).toBeTruthy();
    expect(new Date(leased!.lockExpiresAt!).getTime()).toBeGreaterThan(Date.now());
    expect(leased?.startedAt).toBeTruthy();
  });

  it('refuses a second lease while the first is live', async () => {
    // Two cron runs overlapping is the normal case, not the exception: the
    // schedule is every 30 seconds and a large blast takes longer than that.
    const queued = await queueArticleNotificationJob(ARTICLE, recipients(1), { kind: 'publish' });
    const leased = await acquireArticleNotificationJobLease(storedJob(queued.id));

    await expect(acquireArticleNotificationJobLease(leased!)).resolves.toBeNull();
  });

  it('takes over a lease that has expired', async () => {
    const queued = await queueArticleNotificationJob(ARTICLE, recipients(1), { kind: 'publish' });
    const leased = await acquireArticleNotificationJobLease(storedJob(queued.id));
    const expired = {
      ...leased!,
      lockExpiresAt: new Date(Date.now() - 1_000).toISOString(),
    };
    kvStore.set(notificationJobKey(expired.id), expired);

    const retaken = await acquireArticleNotificationJobLease(expired);

    expect(retaken?.lockId).toBeTruthy();
    expect(retaken?.lockId).not.toBe(leased?.lockId);
  });

  it('releases a processing job back to queued with the lock cleared', async () => {
    const queued = await queueArticleNotificationJob(ARTICLE, recipients(1), { kind: 'publish' });
    const leased = await acquireArticleNotificationJobLease(storedJob(queued.id));

    const released = await releaseArticleNotificationJobLease(leased!, { lastError: 'timed out' });

    expect(released).toMatchObject({ status: 'queued', lastError: 'timed out' });
    expect(released.lockId).toBeNull();
    expect(released.lockExpiresAt).toBeNull();
  });
});

describe('preparePublishJobTrackingBatch', () => {
  it('mints tracking records for one batch at a time and advances the cursor', async () => {
    const total = TRACKING_PREPARE_BATCH_SIZE + 4;
    const queued = await queueArticleNotificationJob(ARTICLE, recipients(total), {
      kind: 'publish',
    });

    const first = await preparePublishJobTrackingBatch(storedJob(queued.id), ARTICLE);

    expect(first.preparedCount).toBe(TRACKING_PREPARE_BATCH_SIZE);
    expect(first.job.prepareCursor).toBe(TRACKING_PREPARE_BATCH_SIZE);
    expect(first.job.items.filter((i) => i.trackingToken).length).toBe(TRACKING_PREPARE_BATCH_SIZE);
    expect(first.job.lastPreparedAt).toBeTruthy();

    const second = await preparePublishJobTrackingBatch(first.job, ARTICLE);

    expect(second.preparedCount).toBe(4);
    expect(second.job.prepareCursor).toBe(total);
    expect(await listArticleEmailTrackingRecords(ARTICLE.id)).toHaveLength(total);
  });

  it('reports nothing left to do once every item has a token', async () => {
    const queued = await queueArticleNotificationJob(ARTICLE, recipients(2), { kind: 'publish' });
    const prepared = await preparePublishJobTrackingBatch(storedJob(queued.id), ARTICLE);

    const again = await preparePublishJobTrackingBatch(prepared.job, ARTICLE);

    expect(again.preparedCount).toBe(0);
    expect(await listArticleEmailTrackingRecords(ARTICLE.id)).toHaveLength(2);
  });

  it('is a no-op for a retry job and for a job with no items', async () => {
    const retry = await queueArticleNotificationJob(ARTICLE, await trackingFor(1), {
      kind: 'retry_undelivered',
    });

    await expect(
      preparePublishJobTrackingBatch(storedJob(retry.id), ARTICLE),
    ).resolves.toMatchObject({ preparedCount: 0 });

    const empty = await queueArticleNotificationJob(ARTICLE, [], { kind: 'publish' });
    await expect(
      preparePublishJobTrackingBatch(storedJob(empty.id), ARTICLE),
    ).resolves.toMatchObject({ preparedCount: 0 });
  });

  it('advances a cursor left behind items that were already prepared out of band', async () => {
    const queued = await queueArticleNotificationJob(ARTICLE, recipients(2), { kind: 'publish' });
    const prepared = await preparePublishJobTrackingBatch(storedJob(queued.id), ARTICLE);
    // Rewind only the cursor, leaving the tokens in place — the shape a crash
    // between the record write and the job write would leave behind.
    const rewound = { ...prepared.job, prepareCursor: 0 };
    kvStore.set(notificationJobKey(rewound.id), rewound);

    const result = await preparePublishJobTrackingBatch(rewound, ARTICLE);

    expect(result.preparedCount).toBe(0);
    expect(result.job.prepareCursor).toBe(2);
  });
});

describe('hydrateArticleNotificationJob', () => {
  it('derives every count on the snapshot from the tracking records', async () => {
    const queued = await queueArticleNotificationJob(ARTICLE, recipients(4), { kind: 'publish' });
    const { job } = await preparePublishJobTrackingBatch(storedJob(queued.id), ARTICLE);
    const tokens = job.items.map((i) => i.trackingToken!);
    await markArticleEmailDeliverySent(tokens[0]);
    await markArticleEmailDeliveryFailed(tokens[1], 'invalid address', 'failed_terminal');
    await markArticleEmailDeliveryFailed(tokens[2], 'socket hang up', 'failed_retryable');

    const snapshot = await hydrateArticleNotificationJob(storedJob(queued.id));

    expect(snapshot).toMatchObject({
      recipientCount: 4,
      preparedCount: 4,
      unpreparedCount: 0,
      sentCount: 1,
      failedTerminalCount: 1,
      failedRetryableCount: 1,
      failedCount: 2,
      processedCount: 2,
      // pending = still pending + retryable, and the fourth record is untouched.
      pendingCount: 2,
      progressPercent: 50,
      currentIndex: 2,
      phase: 'sending',
    });
  });

  it('counts unprepared recipients as pending, so progress never overstates itself', async () => {
    const queued = await queueArticleNotificationJob(ARTICLE, recipients(3), { kind: 'publish' });

    const snapshot = await hydrateArticleNotificationJob(storedJob(queued.id));

    expect(snapshot).toMatchObject({
      preparedCount: 0,
      unpreparedCount: 3,
      pendingCount: 3,
      processedCount: 0,
      progressPercent: 0,
      phase: 'preparing',
    });
  });

  it('reports 100% for a job with no recipients rather than dividing by zero', async () => {
    const empty = await queueArticleNotificationJob(ARTICLE, [], { kind: 'publish' });

    const snapshot = await hydrateArticleNotificationJob(storedJob(empty.id));

    expect(snapshot.progressPercent).toBe(100);
    expect(campaignFromJobSnapshot(snapshot).status).toBe('no_recipients');
  });
});

describe('finalizeArticleNotificationJob', () => {
  it('marks a clean run completed and clears the active pointer', async () => {
    const queued = await queueArticleNotificationJob(ARTICLE, recipients(1), { kind: 'publish' });
    const { job } = await preparePublishJobTrackingBatch(storedJob(queued.id), ARTICLE);
    await markArticleEmailDeliverySent(job.items[0].trackingToken!);

    const finalized = await finalizeArticleNotificationJob(storedJob(queued.id));

    expect(finalized.status).toBe('completed');
    expect(finalized.completedAt).toBeTruthy();
    expect(finalized.lockId).toBeNull();
    expect(activePointer('publish')).toBeUndefined();
    expect(storedCampaign(queued.id)?.status).toBe('completed');
  });

  it('records a run that gave up on someone as completed_with_failures', async () => {
    const queued = await queueArticleNotificationJob(ARTICLE, recipients(2), { kind: 'publish' });
    const { job } = await preparePublishJobTrackingBatch(storedJob(queued.id), ARTICLE);
    await markArticleEmailDeliverySent(job.items[0].trackingToken!);
    await markArticleEmailDeliveryFailed(job.items[1].trackingToken!, 'bounced', 'failed_terminal');

    const finalized = await finalizeArticleNotificationJob(storedJob(queued.id));

    expect(finalized.status).toBe('completed_with_failures');
    expect(storedCampaign(queued.id)?.status).toBe('completed_with_failures');
  });
});

describe('resumeArticleNotificationJob', () => {
  it('puts a locked, errored job back on the queue with the error cleared', async () => {
    const queued = await queueArticleNotificationJob(ARTICLE, recipients(2), { kind: 'publish' });
    const leased = await acquireArticleNotificationJobLease(storedJob(queued.id));
    kvStore.set(notificationJobKey(leased!.id), { ...leased!, lastError: 'stalled mid-batch' });

    const resumed = await resumeArticleNotificationJob(storedJob(queued.id));

    expect(resumed).toMatchObject({ status: 'queued', lastError: null, completedAt: null });
    expect(resumed.lockId).toBeNull();
    expect(activePointer('publish')).toBe(queued.id);
  });

  it('completes, and stands down, a job that has no recipients to resume', async () => {
    const queued = await queueArticleNotificationJob(ARTICLE, recipients(1), { kind: 'publish' });
    kvStore.set(notificationJobKey(queued.id), {
      ...storedJob(queued.id),
      items: [],
      recipientCount: 0,
    });

    const resumed = await resumeArticleNotificationJob(storedJob(queued.id));

    expect(resumed.status).toBe('completed');
    expect(activePointer('publish')).toBeUndefined();
  });
});

describe('buildArticleNotificationProcessorState', () => {
  const input = {
    mode: 'automated' as const,
    lastHeartbeatAt: new Date().toISOString(),
    lastRunAt: new Date().toISOString(),
    lastSuccessAt: null,
    lastError: null,
    maxJobs: 5,
    maxBatchesPerJob: 4,
    processedJobs: 0,
    advancedJobs: 0,
    completedJobs: 0,
  };

  it('counts only the jobs that are still active', async () => {
    const queued = await queueArticleNotificationJob(ARTICLE, recipients(1), { kind: 'publish' });
    const leasedArticle = { ...ARTICLE, id: 'art-2' };
    const processing = await queueArticleNotificationJob(leasedArticle, recipients(1), {
      kind: 'publish',
    });
    await acquireArticleNotificationJobLease(storedJob(processing.id));
    const done = await queueArticleNotificationJob({ ...ARTICLE, id: 'art-3' }, recipients(1), {
      kind: 'publish',
    });
    await finalizeArticleNotificationJob(storedJob(done.id));

    const state = await buildArticleNotificationProcessorState(input);

    expect(state).toMatchObject({
      activeJobCount: 2,
      queuedJobCount: 1,
      processingJobCount: 1,
      stuckJobCount: 0,
      staleJobThresholdMs: STUCK_JOB_THRESHOLD_MS,
    });
    expect(storedJob(queued.id).status).toBe('queued');
  });

  it('surfaces stalled jobs, worst first', async () => {
    const stall = async (articleId: string, staleMs: number) => {
      const snapshot = await queueArticleNotificationJob(
        { ...ARTICLE, id: articleId },
        recipients(1),
        { kind: 'publish' },
      );
      kvStore.set(notificationJobKey(snapshot.id), {
        ...storedJob(snapshot.id),
        status: 'processing',
        lastProgressAt: new Date(Date.now() - staleMs).toISOString(),
      });
      return snapshot.id;
    };
    const mildlyStuck = await stall('art-mild', STUCK_JOB_THRESHOLD_MS + 60_000);
    const badlyStuck = await stall('art-bad', STUCK_JOB_THRESHOLD_MS + 600_000);

    const state = await buildArticleNotificationProcessorState(input);

    expect(state.stuckJobCount).toBe(2);
    expect(state.stuckJobs.map((j) => j.id)).toEqual([badlyStuck, mildlyStuck]);
    expect(state.stuckJobs[0]).toMatchObject({
      phase: 'preparing',
      pendingCountEstimate: 1,
      recipientCount: 1,
    });
    expect(state.stuckJobs[0].minutesSinceProgress).toBeGreaterThan(
      state.stuckJobs[1].minutesSinceProgress!,
    );
  });
});
