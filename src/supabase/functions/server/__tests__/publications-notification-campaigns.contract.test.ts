/**
 * Article notification campaigns — contract tests
 * ===============================================
 *
 * The admin-facing half of the notification engine: the publish blast, the
 * retry queue it leaves behind, resume, and the campaign rows the publications
 * dashboard reads. A campaign row is the only place an admin can see whether a
 * blast actually landed, so a wrong status here is a wrong answer to "did my
 * subscribers get this?".
 *
 * `email-service.ts` is the only stub.
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
  createArticleNotificationQueueFailedCampaign,
  finalizeActiveArticleNotificationJobsForPublish,
  getArticleNotificationCampaign,
  getLatestArticleNotificationCampaign,
  listArticleNotificationCampaigns,
  repairPublishNotificationCampaignFromTracking,
  resumeArticleNotificationDelivery,
  retryUndeliveredArticleNotifications,
  sendArticlePublishedNotifications,
  sendArticlePublishedNotificationsBlastThenRetryQueue,
} from '../publications-notification-service.ts';
import {
  PUBLISH_TRACKING_CAMPAIGN_ID,
  queueArticleNotificationJob,
  syncPublishNotificationCampaignFromTrackingState,
} from '../publications-notification-helpers.ts';
import {
  activeNotificationJobKey,
  NEWSLETTER_GROUP_KEY,
  notificationCampaignKey,
  notificationJobKey,
} from '../publications-notification-state.ts';
import type {
  ArticleNotificationCampaign,
  ArticleNotificationJob,
} from '../publications-notification-types.ts';

const ARTICLE = { id: 'art-1', title: 'Two-pot reform', slug: 'two-pot', excerpt: 'Summary.' };
const TRACKING_CAMPAIGN_ID = PUBLISH_TRACKING_CAMPAIGN_ID(ARTICLE.id);

const publish = () =>
  kvStore.set(`article:${ARTICLE.id}`, {
    status: 'published',
    title: ARTICLE.title,
    slug: ARTICLE.slug,
    excerpt: ARTICLE.excerpt,
  });

const seedAudience = (count: number) =>
  kvStore.set(NEWSLETTER_GROUP_KEY, {
    externalContacts: Array.from({ length: count }, (_, index) => ({
      email: `reader${String(index).padStart(2, '0')}@example.com`,
    })),
  });

const storedJob = (jobId: string) =>
  kvStore.get(notificationJobKey(jobId)) as ArticleNotificationJob;

const storedCampaign = (campaignId: string) =>
  kvStore.get(notificationCampaignKey(campaignId)) as ArticleNotificationCampaign | undefined;

const activePointer = (kind: 'publish' | 'retry_undelivered') =>
  kvStore.get(activeNotificationJobKey(ARTICLE.id, 'publish', kind));

const seedCampaign = (campaign: Partial<ArticleNotificationCampaign> & { id: string }) =>
  kvStore.set(notificationCampaignKey(campaign.id), {
    articleId: ARTICLE.id,
    articleTitle: ARTICLE.title,
    articleSlug: ARTICLE.slug,
    source: 'publish',
    status: 'completed',
    sentCount: 0,
    intendedRecipientCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    jobId: null,
    ...campaign,
  });

/**
 * Fails `listByPrefix` for the tracking-record prefix only, so the blast itself
 * still runs and the failure lands squarely on the post-blast sync.
 */
async function withUnreadableTrackingStore<T>(run: () => Promise<T>): Promise<T> {
  const fn = vi.mocked(kv.listByPrefix);
  const original = fn.getMockImplementation()!;
  fn.mockImplementation(async (prefix: string, options?: unknown) => {
    if (prefix.startsWith('article_email_tracking:')) {
      throw new Error('KV tracking scan unavailable');
    }
    return original(prefix, options as never);
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

describe('sendArticlePublishedNotifications', () => {
  it('queues the whole audience without sending anything itself', async () => {
    publish();
    seedAudience(3);

    const snapshot = await sendArticlePublishedNotifications(ARTICLE);

    expect(snapshot).toMatchObject({ kind: 'publish', status: 'queued', recipientCount: 3 });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('sendArticlePublishedNotificationsBlastThenRetryQueue', () => {
  it('sends immediately and closes the campaign when everyone is reached', async () => {
    publish();
    seedAudience(2);

    const result = await sendArticlePublishedNotificationsBlastThenRetryQueue(ARTICLE);

    expect(result.blast).toMatchObject({ recipientCount: 2, sent: 2, failed: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    // Nobody is undelivered, so no retry job is left lying around.
    expect(result.retryJob).toBeNull();
    expect(activePointer('retry_undelivered')).toBeUndefined();
    expect(result.publishCampaign).toMatchObject({
      id: TRACKING_CAMPAIGN_ID,
      status: 'completed',
      sentCount: 2,
      pendingCount: 0,
      progressPercent: 100,
      phase: 'completed',
    });
  });

  it('closes the campaign as completed_with_failures when someone is written off', async () => {
    publish();
    seedAudience(2);
    sendEmail.mockImplementation(async (to: string) => {
      if (to === 'reader01@example.com') throw new Error('Bad request: invalid email');
      return { success: true };
    });

    const result = await sendArticlePublishedNotificationsBlastThenRetryQueue(ARTICLE);

    expect(result.blast).toMatchObject({ sent: 1, failed: 1 });
    // A terminal failure is not retryable, so there is nothing to queue.
    expect(result.retryJob).toBeNull();
    expect(result.publishCampaign).toMatchObject({
      status: 'completed_with_failures',
      sentCount: 1,
      failedTerminalCount: 1,
      pendingCount: 0,
    });
  });

  it('queues the undelivered remainder for the retry processor', async () => {
    publish();
    seedAudience(2);
    sendEmail.mockImplementation(async (to: string) => {
      // Retryable, so the record stays undelivered rather than being written off.
      if (to === 'reader01@example.com') throw new Error('socket hang up');
      return { success: true };
    });

    const result = await sendArticlePublishedNotificationsBlastThenRetryQueue(ARTICLE);

    expect(result.blast).toMatchObject({ sent: 1, failed: 1 });
    expect(result.retryJob).toMatchObject({ kind: 'retry_undelivered', recipientCount: 1 });
    expect(result.retryJob!.items[0].email).toBe('reader01@example.com');
    expect(activePointer('retry_undelivered')).toBe(result.retryJob!.id);
    expect(result.publishCampaign).toMatchObject({
      status: 'processing',
      sentCount: 1,
      pendingCount: 1,
      phase: 'sending',
    });
  });

  it('still reports the blast when the post-blast bookkeeping fails', async () => {
    // The emails are already gone. Losing the campaign row afterwards must not
    // lose the record of what was sent.
    publish();
    seedAudience(2);
    sendEmail.mockImplementation(async (to: string) => {
      if (to === 'reader01@example.com') throw new Error('Bad request: invalid email');
      return { success: true };
    });

    const result = await withUnreadableTrackingStore(() =>
      sendArticlePublishedNotificationsBlastThenRetryQueue(ARTICLE),
    );

    expect(result.blast).toMatchObject({ recipientCount: 2, sent: 1, failed: 1 });
    expect(result.publishCampaign).toMatchObject({
      id: TRACKING_CAMPAIGN_ID,
      status: 'completed_with_failures',
      intendedRecipientCount: 2,
      sentCount: 1,
      failedTerminalCount: 1,
      lastError: 'KV tracking scan unavailable',
    });
  });

  it('records a campaign even when there was nobody to send to', async () => {
    publish();

    const result = await sendArticlePublishedNotificationsBlastThenRetryQueue(ARTICLE);

    expect(result.blast).toMatchObject({ recipientCount: 0, sent: 0 });
    expect(result.retryJob).toBeNull();
    // No tracking records exist, so there is no campaign to derive — the caller
    // gets an explicit null rather than a fabricated empty campaign.
    expect(result.publishCampaign).toBeNull();
  });
});

describe('retryUndeliveredArticleNotifications', () => {
  it('queues exactly the recipients still outstanding', async () => {
    publish();
    seedAudience(3);
    sendEmail.mockImplementation(async (to: string) => {
      if (to !== 'reader00@example.com') throw new Error('socket hang up');
      return { success: true };
    });
    await sendArticlePublishedNotificationsBlastThenRetryQueue(ARTICLE);
    // Clear the retry job the blast already queued so this call starts fresh.
    kvStore.delete(activeNotificationJobKey(ARTICLE.id, 'publish', 'retry_undelivered'));

    const snapshot = await retryUndeliveredArticleNotifications(ARTICLE);

    expect(snapshot.recipientCount).toBe(2);
    expect(snapshot.items.map((i) => i.email).sort()).toEqual([
      'reader01@example.com',
      'reader02@example.com',
    ]);
  });

  it('queues an already-complete job when nothing is outstanding', async () => {
    publish();
    seedAudience(1);
    await sendArticlePublishedNotificationsBlastThenRetryQueue(ARTICLE);

    const snapshot = await retryUndeliveredArticleNotifications(ARTICLE);

    expect(snapshot).toMatchObject({ status: 'completed', recipientCount: 0 });
  });
});

describe('resumeArticleNotificationDelivery', () => {
  it('prefers an active retry job over the publish job', async () => {
    publish();
    const publishJob = await queueArticleNotificationJob(ARTICLE, [{ email: 'a@example.com' }], {
      kind: 'publish',
    });
    const retryJob = await queueArticleNotificationJob(
      ARTICLE,
      [{ email: 'a@example.com', token: 'tok-1' }] as never,
      { kind: 'retry_undelivered' },
    );

    const resumed = await resumeArticleNotificationDelivery(ARTICLE);

    expect(resumed.id).toBe(retryJob.id);
    expect(resumed.id).not.toBe(publishJob.id);
    expect(resumed.status).toBe('queued');
  });

  it('resumes the publish job when there is no retry job', async () => {
    publish();
    const publishJob = await queueArticleNotificationJob(ARTICLE, [{ email: 'a@example.com' }], {
      kind: 'publish',
    });
    kvStore.set(notificationJobKey(publishJob.id), {
      ...storedJob(publishJob.id),
      lastError: 'stalled',
      lockId: 'stale-lock',
    });

    const resumed = await resumeArticleNotificationDelivery(ARTICLE);

    expect(resumed).toMatchObject({ id: publishJob.id, status: 'queued', lastError: null });
    expect(resumed.lockId).toBeNull();
  });

  it('falls back to queueing a fresh retry job when nothing is active', async () => {
    publish();
    seedAudience(1);
    sendEmail.mockRejectedValue(new Error('socket hang up'));
    await sendArticlePublishedNotificationsBlastThenRetryQueue(ARTICLE);
    kvStore.delete(activeNotificationJobKey(ARTICLE.id, 'publish', 'retry_undelivered'));

    const resumed = await resumeArticleNotificationDelivery(ARTICLE);

    expect(resumed).toMatchObject({ kind: 'retry_undelivered', recipientCount: 1 });
  });
});

describe('finalizeActiveArticleNotificationJobsForPublish', () => {
  it('closes out both active jobs so a new blast can be queued', async () => {
    publish();
    const publishJob = await queueArticleNotificationJob(ARTICLE, [{ email: 'a@example.com' }], {
      kind: 'publish',
    });
    const retryJob = await queueArticleNotificationJob(
      ARTICLE,
      [{ email: 'a@example.com', token: 'tok-1' }] as never,
      { kind: 'retry_undelivered' },
    );

    await finalizeActiveArticleNotificationJobsForPublish(ARTICLE.id);

    expect(storedJob(publishJob.id).status).toBe('completed');
    expect(storedJob(retryJob.id).status).toBe('completed');
    expect(activePointer('publish')).toBeUndefined();
    expect(activePointer('retry_undelivered')).toBeUndefined();
  });

  it('is a no-op when nothing is in flight', async () => {
    await expect(
      finalizeActiveArticleNotificationJobsForPublish(ARTICLE.id),
    ).resolves.toBeUndefined();
  });

  it('clears a pointer left behind by a job that already completed', async () => {
    const publishJob = await queueArticleNotificationJob(ARTICLE, [{ email: 'a@example.com' }], {
      kind: 'publish',
    });
    kvStore.set(notificationJobKey(publishJob.id), {
      ...storedJob(publishJob.id),
      status: 'completed_with_failures',
    });

    await finalizeActiveArticleNotificationJobsForPublish(ARTICLE.id);

    expect(activePointer('publish')).toBeUndefined();
    // Already terminal, so the status is left exactly as it was.
    expect(storedJob(publishJob.id).status).toBe('completed_with_failures');
  });
});

describe('syncPublishNotificationCampaignFromTrackingState', () => {
  it('returns null when the article has no publish tracking records at all', async () => {
    await expect(syncPublishNotificationCampaignFromTrackingState(ARTICLE)).resolves.toBeNull();
  });

  it('trusts a fully delivered blast without re-reading the tracking store', async () => {
    const campaign = await syncPublishNotificationCampaignFromTrackingState(ARTICLE, {
      blast: { recipientCount: 4, sent: 4, failed: 0 },
    });

    expect(campaign).toMatchObject({
      id: TRACKING_CAMPAIGN_ID,
      status: 'completed',
      intendedRecipientCount: 4,
      sentCount: 4,
      progressPercent: 100,
    });
    expect(campaign!.completedAt).toBeTruthy();
  });

  it('reports work still outstanding as queued, or processing once a retry job exists', async () => {
    publish();
    seedAudience(2);
    sendEmail.mockImplementation(async (to: string) => {
      if (to === 'reader01@example.com') throw new Error('socket hang up');
      return { success: true };
    });
    await sendArticlePublishedNotificationsBlastThenRetryQueue(ARTICLE);

    const queued = await syncPublishNotificationCampaignFromTrackingState(ARTICLE);
    expect(queued).toMatchObject({ status: 'queued', pendingCount: 1, phase: 'sending' });

    const processing = await syncPublishNotificationCampaignFromTrackingState(ARTICLE, {
      retryJobId: 'retry-1',
    });
    expect(processing).toMatchObject({ status: 'processing', pendingCount: 1 });
    // Same row both times: the campaign id is derived from the article.
    expect(processing!.id).toBe(queued!.id);
    expect(processing!.createdAt).toBe(queued!.createdAt);
  });

  it('ignores reshare records when reporting on the publish campaign', async () => {
    publish();
    seedAudience(1);
    await sendArticlePublishedNotificationsBlastThenRetryQueue(ARTICLE);
    sendEmail.mockRejectedValue(new Error('Bad request: invalid email'));
    // A failed reshare to a different address must not drag the publish campaign
    // into completed_with_failures.
    const { runArticleNotificationDelivery } =
      await import('../publications-notification-service.ts');
    await runArticleNotificationDelivery(ARTICLE, {
      source: 'reshare',
      recipientEmails: ['reader00@example.com'],
    });

    const campaign = await syncPublishNotificationCampaignFromTrackingState(ARTICLE);

    expect(campaign).toMatchObject({
      status: 'completed',
      intendedRecipientCount: 1,
      sentCount: 1,
      failedTerminalCount: 0,
    });
  });
});

describe('repairPublishNotificationCampaignFromTracking', () => {
  it('rebuilds the campaign row from the tracking records', async () => {
    publish();
    seedAudience(2);
    await sendArticlePublishedNotificationsBlastThenRetryQueue(ARTICLE);
    kvStore.delete(notificationCampaignKey(TRACKING_CAMPAIGN_ID));

    const repaired = await repairPublishNotificationCampaignFromTracking(ARTICLE);

    expect(repaired).toMatchObject({ id: TRACKING_CAMPAIGN_ID, status: 'completed', sentCount: 2 });
    expect(storedCampaign(TRACKING_CAMPAIGN_ID)).toBeDefined();
  });

  it('stamps the error onto the repaired row when one is supplied', async () => {
    publish();
    seedAudience(1);
    await sendArticlePublishedNotificationsBlastThenRetryQueue(ARTICLE);

    const repaired = await repairPublishNotificationCampaignFromTracking(ARTICLE, {
      lastError: 'queueing the retry job failed',
    });

    expect(repaired?.lastError).toBe('queueing the retry job failed');
    expect(storedCampaign(TRACKING_CAMPAIGN_ID)?.lastError).toBe('queueing the retry job failed');
  });

  it('returns null when there is nothing to rebuild from', async () => {
    await expect(repairPublishNotificationCampaignFromTracking(ARTICLE)).resolves.toBeNull();
  });
});

describe('createArticleNotificationQueueFailedCampaign', () => {
  it('records a total failure as queue_failed', async () => {
    const campaign = await createArticleNotificationQueueFailedCampaign(ARTICLE, {
      source: 'publish',
      lastError: 'could not reach the queue',
    });

    expect(campaign).toMatchObject({
      status: 'queue_failed',
      sentCount: 0,
      intendedRecipientCount: 0,
      lastError: 'could not reach the queue',
      phase: 'completed',
    });
    expect(campaign.startedAt).toBeNull();
  });

  it('prefers repairing from tracking records over inventing a failed row', async () => {
    publish();
    seedAudience(1);
    await sendArticlePublishedNotificationsBlastThenRetryQueue(ARTICLE);

    const campaign = await createArticleNotificationQueueFailedCampaign(ARTICLE, {
      source: 'publish',
      lastError: 'queueing failed after the send',
    });

    // The send succeeded; only the bookkeeping failed. Reporting "queue_failed"
    // here would tell the admin nobody got the article, which is false.
    expect(campaign).toMatchObject({
      id: TRACKING_CAMPAIGN_ID,
      status: 'completed',
      sentCount: 1,
      lastError: 'queueing failed after the send',
    });
  });

  it('carries partial blast numbers through when the tracking store is unreadable', async () => {
    const campaign = await withUnreadableTrackingStore(() =>
      createArticleNotificationQueueFailedCampaign(ARTICLE, {
        source: 'publish',
        lastError: 'sync failed',
        blast: { recipientCount: 5, sent: 3, failed: 1 },
      }),
    );

    expect(campaign).toMatchObject({
      id: TRACKING_CAMPAIGN_ID,
      status: 'completed_with_failures',
      intendedRecipientCount: 5,
      sentCount: 3,
      failedTerminalCount: 1,
      // 5 intended, 4 accounted for — the last one is unexplained, so it stays
      // pending rather than being quietly rounded away.
      pendingCount: 1,
      processedCount: 4,
      progressPercent: 80,
    });
  });

  it('gives a reshare failure its own row rather than overwriting the publish campaign', async () => {
    const campaign = await createArticleNotificationQueueFailedCampaign(ARTICLE, {
      source: 'reshare',
      lastError: 'reshare queueing failed',
    });

    expect(campaign.id).not.toBe(TRACKING_CAMPAIGN_ID);
    expect(campaign.source).toBe('reshare');
  });
});

describe('listArticleNotificationCampaigns', () => {
  it('filters by article and source, newest first', async () => {
    seedCampaign({ id: 'c-old', updatedAt: '2026-01-01T00:00:00.000Z' });
    seedCampaign({ id: 'c-new', updatedAt: '2026-06-01T00:00:00.000Z' });
    seedCampaign({ id: 'c-reshare', source: 'reshare', updatedAt: '2026-07-01T00:00:00.000Z' });
    seedCampaign({ id: 'c-other-article', articleId: 'art-9' });

    await expect(
      listArticleNotificationCampaigns({ articleId: ARTICLE.id, source: 'publish' }),
    ).resolves.toMatchObject([{ id: 'c-new' }, { id: 'c-old' }]);
    await expect(listArticleNotificationCampaigns({ source: 'reshare' })).resolves.toMatchObject([
      { id: 'c-reshare' },
    ]);
    await expect(listArticleNotificationCampaigns()).resolves.toHaveLength(4);
  });

  it('falls back to createdAt when a row has never been updated', async () => {
    seedCampaign({ id: 'c-1', updatedAt: '', createdAt: '2026-05-01T00:00:00.000Z' });
    seedCampaign({ id: 'c-2', updatedAt: '', createdAt: '2026-01-01T00:00:00.000Z' });

    await expect(listArticleNotificationCampaigns()).resolves.toMatchObject([
      { id: 'c-1' },
      { id: 'c-2' },
    ]);
  });
});

describe('getArticleNotificationCampaign', () => {
  it('recomputes a job-backed campaign from the job it points at', async () => {
    publish();
    const job = await queueArticleNotificationJob(ARTICLE, [{ email: 'a@example.com' }], {
      kind: 'publish',
    });
    // Stale counts, as if the campaign row were written before the last batch.
    kvStore.set(notificationCampaignKey(job.id), {
      ...storedCampaign(job.id),
      sentCount: 999,
      status: 'completed',
    });

    const campaign = await getArticleNotificationCampaign(job.id);

    expect(campaign).toMatchObject({ jobId: job.id, sentCount: 0, status: 'queued' });
    expect(storedCampaign(job.id)?.sentCount).toBe(0);
  });

  it('returns a tracking-derived campaign as stored, since it has no job', async () => {
    seedCampaign({ id: TRACKING_CAMPAIGN_ID, sentCount: 7, jobId: null });

    await expect(getArticleNotificationCampaign(TRACKING_CAMPAIGN_ID)).resolves.toMatchObject({
      sentCount: 7,
    });
  });

  it('returns the stored row when the job it names has been reaped', async () => {
    seedCampaign({ id: 'c-1', jobId: 'long-gone-job', sentCount: 4 });

    await expect(getArticleNotificationCampaign('c-1')).resolves.toMatchObject({ sentCount: 4 });
  });

  it('reports nothing for an unknown campaign id', async () => {
    await expect(getArticleNotificationCampaign('nope')).resolves.toBeNull();
    await expect(getArticleNotificationCampaign('')).resolves.toBeNull();
  });
});

describe('getLatestArticleNotificationCampaign', () => {
  it('prefers the tracking campaign once it has actually sent to someone', async () => {
    seedCampaign({ id: 'c-newer-job-row', updatedAt: '2026-09-01T00:00:00.000Z', sentCount: 0 });
    seedCampaign({
      id: TRACKING_CAMPAIGN_ID,
      updatedAt: '2026-02-01T00:00:00.000Z',
      sentCount: 3,
    });

    await expect(getLatestArticleNotificationCampaign(ARTICLE.id)).resolves.toMatchObject({
      id: TRACKING_CAMPAIGN_ID,
      sentCount: 3,
    });
  });

  it('skips a queue_failed row that never sent anything', async () => {
    seedCampaign({
      id: 'c-failed',
      status: 'queue_failed',
      updatedAt: '2026-09-01T00:00:00.000Z',
      sentCount: 0,
      intendedRecipientCount: 0,
    });
    seedCampaign({ id: 'c-real', updatedAt: '2026-01-01T00:00:00.000Z', sentCount: 2 });

    await expect(getLatestArticleNotificationCampaign(ARTICLE.id)).resolves.toMatchObject({
      id: 'c-real',
    });
  });

  it('falls back to the newest row when every candidate is a bare failure', async () => {
    seedCampaign({
      id: 'c-failed-new',
      status: 'queue_failed',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
    seedCampaign({
      id: 'c-failed-old',
      status: 'queue_failed',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(getLatestArticleNotificationCampaign(ARTICLE.id)).resolves.toMatchObject({
      id: 'c-failed-new',
    });
  });

  it('reports nothing when the article has no campaigns', async () => {
    await expect(getLatestArticleNotificationCampaign(ARTICLE.id)).resolves.toBeNull();
  });
});
