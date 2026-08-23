/**
 * Job lifecycle helpers for article notifications: processor state,
 * leases, campaign sync, hydration, tracking-batch preparation, and
 * resume. Moved verbatim from publications-notification-helpers.ts, which
 * re-exports them.
 */
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import {
  createArticleEmailTrackingRecords,
  isArticleEmailDeliveryTerminalStatus,
  listArticleEmailTrackingRecords,
  summarizeTrackedRecipientDeliveries,
  type ArticleEmailTrackingRecord,
  type ArticleEmailTrackingSource,
} from './publications-email-engagement-service.ts';
import type {
  ArticleNotificationCampaign,
  ArticleNotificationJob,
  ArticleNotificationJobKind,
  ArticleNotificationJobSnapshot,
  ArticleNotificationProcessorState,
  ArticleNotificationProcessorStuckJob,
  PreparePublishJobTrackingBatchResult,
  PublishedArticle,
} from './publications-notification-types.ts';

const log = createModuleLogger('article-notifications');

import {
  ARTICLE_NOTIFICATION_JOB_PREFIX,
  TRACKING_PREPARE_BATCH_SIZE,
  JOB_LOCK_TTL_MS,
  JOB_LOCK_SETTLE_MS,
  STUCK_JOB_THRESHOLD_MS,
  sleep,
  normalizeSendError,
  nowIso,
  activeNotificationJobKey,
  jobItemFromTrackingRecord,
  withArticleNotificationJobDefaults,
  getJobLastProgressTimestamp,
  getJobPhase,
  isArticleNotificationJobStuck,
  getArticleNotificationJobRecord,
  persistArticleNotificationJob,
  persistArticleNotificationCampaign,
} from './publications-notification-state.ts';

export async function buildArticleNotificationProcessorState(
  input: Omit<
    ArticleNotificationProcessorState,
    | 'activeJobCount'
    | 'queuedJobCount'
    | 'processingJobCount'
    | 'stuckJobCount'
    | 'staleJobThresholdMs'
    | 'stuckJobs'
  >,
): Promise<ArticleNotificationProcessorState> {
  const allJobs = (
    (await kv.getByPrefix(ARTICLE_NOTIFICATION_JOB_PREFIX)) as ArticleNotificationJob[]
  ).map(withArticleNotificationJobDefaults);
  const activeJobs = allJobs.filter(
    (job) => job.status === 'queued' || job.status === 'processing',
  );
  const queuedJobCount = activeJobs.filter((job) => job.status === 'queued').length;
  const processingJobCount = activeJobs.filter((job) => job.status === 'processing').length;
  const stuckJobs = activeJobs
    .map((job) => {
      const pendingCountEstimate = Math.max(
        job.recipientCount - Math.min(job.currentIndex, job.recipientCount),
        0,
      );
      const unpreparedCount =
        job.kind === 'publish' ? Math.max(job.recipientCount - job.prepareCursor, 0) : 0;
      const phase = getJobPhase(job, unpreparedCount, pendingCountEstimate);
      if (!isArticleNotificationJobStuck(job, phase)) return null;

      const lastProgressTs = getJobLastProgressTimestamp(job);
      return {
        id: job.id,
        articleId: job.articleId,
        articleTitle: job.articleTitle,
        kind: job.kind,
        source: job.source,
        status: job.status,
        phase,
        pendingCountEstimate,
        prepareCursor: job.prepareCursor,
        recipientCount: job.recipientCount,
        lastProgressAt: job.lastProgressAt,
        updatedAt: job.updatedAt,
        minutesSinceProgress: lastProgressTs
          ? Math.round(((Date.now() - lastProgressTs) / 60_000) * 10) / 10
          : null,
      } satisfies ArticleNotificationProcessorStuckJob;
    })
    .filter((job): job is ArticleNotificationProcessorStuckJob => Boolean(job))
    .sort((a, b) => (b.minutesSinceProgress ?? 0) - (a.minutesSinceProgress ?? 0));

  return {
    ...input,
    activeJobCount: activeJobs.length,
    queuedJobCount,
    processingJobCount,
    stuckJobCount: stuckJobs.length,
    staleJobThresholdMs: STUCK_JOB_THRESHOLD_MS,
    stuckJobs,
  };
}

export async function releaseArticleNotificationJobLease(
  job: ArticleNotificationJob,
  updates?: Partial<ArticleNotificationJob>,
): Promise<ArticleNotificationJob> {
  const releasedJob: ArticleNotificationJob = {
    ...withArticleNotificationJobDefaults(job),
    ...updates,
    status: updates?.status ?? (job.status === 'processing' ? 'queued' : job.status),
    updatedAt: updates?.updatedAt ?? nowIso(),
    lockId: null,
    lockExpiresAt: null,
  };

  await persistArticleNotificationJob(releasedJob);
  return releasedJob;
}

function campaignStatusFromJob(
  snapshot: ArticleNotificationJobSnapshot,
): ArticleNotificationCampaign['status'] {
  if (snapshot.recipientCount === 0) return 'no_recipients';
  return snapshot.status;
}

export function campaignFromJobSnapshot(
  snapshot: ArticleNotificationJobSnapshot,
): ArticleNotificationCampaign {
  return {
    id: snapshot.id,
    articleId: snapshot.articleId,
    articleTitle: snapshot.articleTitle,
    articleSlug: snapshot.articleSlug,
    articleExcerpt: snapshot.articleExcerpt,
    source: snapshot.source,
    status: campaignStatusFromJob(snapshot),
    phase: snapshot.phase,
    intendedRecipientCount: snapshot.recipientCount,
    preparedCount: snapshot.preparedCount,
    unpreparedCount: snapshot.unpreparedCount,
    pendingCount: snapshot.pendingCount,
    sendingCount: snapshot.sendingCount,
    sentCount: snapshot.sentCount,
    failedRetryableCount: snapshot.failedRetryableCount,
    failedTerminalCount: snapshot.failedTerminalCount,
    processedCount: snapshot.processedCount,
    progressPercent: snapshot.progressPercent,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    startedAt: snapshot.startedAt,
    completedAt: snapshot.completedAt,
    lastActivityAt: snapshot.lastProgressAt || snapshot.updatedAt,
    lastError: snapshot.lastError,
    jobId: snapshot.id,
    stuck: snapshot.stuck,
  };
}

export async function syncArticleNotificationCampaignFromJob(
  snapshot: ArticleNotificationJobSnapshot,
): Promise<ArticleNotificationCampaign | null> {
  if (snapshot.kind !== 'publish') return null;

  const campaign = campaignFromJobSnapshot(snapshot);
  await persistArticleNotificationCampaign(campaign);
  return campaign;
}

export async function removeActiveJobPointer(job: ArticleNotificationJob): Promise<void> {
  try {
    await kv.del(activeNotificationJobKey(job.articleId, job.source, job.kind));
  } catch (error) {
    log.warn('Failed to clear active article notification job pointer', {
      jobId: job.id,
      error: normalizeSendError(error),
    });
  }
}

export function mapJobTrackingRecords(
  job: ArticleNotificationJob,
  records: ArticleEmailTrackingRecord[],
): ArticleEmailTrackingRecord[] {
  const recordByToken = new Map(records.map((record) => [record.token, record]));
  return job.items
    .map((item) => (item.trackingToken ? (recordByToken.get(item.trackingToken) ?? null) : null))
    .filter((record): record is ArticleEmailTrackingRecord => Boolean(record));
}

export async function hydrateArticleNotificationJob(
  job: ArticleNotificationJob,
): Promise<ArticleNotificationJobSnapshot> {
  const normalizedJob = withArticleNotificationJobDefaults(job);
  const articleRecords = await listArticleEmailTrackingRecords(normalizedJob.articleId);
  const recordByToken = new Map(articleRecords.map((record) => [record.token, record]));
  const trackingRecords = mapJobTrackingRecords(normalizedJob, articleRecords);
  const preparedCount = normalizedJob.items.filter(
    (item) => item.trackingToken && recordByToken.has(item.trackingToken),
  ).length;
  const unpreparedCount = Math.max(normalizedJob.recipientCount - preparedCount, 0);

  const totals = summarizeTrackedRecipientDeliveries(trackingRecords);
  const failedTerminalCount = totals.failedTerminal;
  const processedCount = totals.sent + failedTerminalCount;
  const pendingCount = totals.pending + unpreparedCount;
  const phase = getJobPhase(
    normalizedJob,
    unpreparedCount,
    totals.pending + totals.sending + totals.failedRetryable,
  );
  const progressPercent =
    normalizedJob.recipientCount > 0
      ? Math.round((processedCount / normalizedJob.recipientCount) * 1000) / 10
      : 100;
  const stuck = isArticleNotificationJobStuck(normalizedJob, phase);

  return {
    ...normalizedJob,
    phase,
    preparedCount,
    unpreparedCount,
    currentIndex: Math.min(processedCount, normalizedJob.recipientCount),
    sentCount: totals.sent,
    failedCount: totals.failedRetryable + failedTerminalCount,
    failedRetryableCount: totals.failedRetryable,
    failedTerminalCount,
    pendingCount,
    sendingCount: totals.sending,
    processedCount,
    progressPercent,
    stuck,
  };
}

export async function preparePublishJobTrackingBatch(
  job: ArticleNotificationJob,
  article: PublishedArticle,
): Promise<PreparePublishJobTrackingBatchResult> {
  if (job.kind !== 'publish' || job.items.length === 0) {
    return {
      job,
      preparedCount: 0,
    };
  }

  const normalizedJob = withArticleNotificationJobDefaults(job);
  const indexesToPrepare: number[] = [];
  let nextPrepareCursor = Math.min(normalizedJob.prepareCursor, normalizedJob.items.length);

  while (
    nextPrepareCursor < normalizedJob.items.length &&
    indexesToPrepare.length < TRACKING_PREPARE_BATCH_SIZE
  ) {
    const item = normalizedJob.items[nextPrepareCursor];
    if (!item?.trackingToken) {
      indexesToPrepare.push(nextPrepareCursor);
    }
    nextPrepareCursor++;
  }

  if (indexesToPrepare.length === 0) {
    if (nextPrepareCursor === normalizedJob.prepareCursor) {
      return {
        job: normalizedJob,
        preparedCount: 0,
      };
    }

    const cursorAdvancedJob: ArticleNotificationJob = {
      ...normalizedJob,
      prepareCursor: nextPrepareCursor,
      updatedAt: nowIso(),
    };
    await persistArticleNotificationJob(cursorAdvancedJob);
    return {
      job: cursorAdvancedJob,
      preparedCount: 0,
    };
  }

  const records = await createArticleEmailTrackingRecords(
    indexesToPrepare.map((index) => {
      const item = normalizedJob.items[index];
      return {
        article,
        recipient: {
          email: item.email,
          firstName: item.firstName,
          name: item.name,
        },
        source: job.source,
        jobId: job.id,
      };
    }),
  );

  let updatedItems = normalizedJob.items;
  let didUpdateItems = false;

  indexesToPrepare.forEach((index, prepareOffset) => {
    const item = updatedItems[index];
    const record = records[prepareOffset];
    if (!record || item.trackingToken === record.token) {
      return;
    }

    if (!didUpdateItems) {
      updatedItems = [...updatedItems];
      didUpdateItems = true;
    }

    updatedItems[index] = {
      ...item,
      trackingToken: record.token,
    };
  });

  if (!didUpdateItems) {
    return {
      job: normalizedJob,
      preparedCount: 0,
    };
  }

  const preparationTimestamp = nowIso();
  const updatedJob: ArticleNotificationJob = {
    ...normalizedJob,
    prepareCursor: nextPrepareCursor,
    items: updatedItems,
    updatedAt: preparationTimestamp,
    lastPreparedAt: preparationTimestamp,
    lastProgressAt: preparationTimestamp,
  };

  await persistArticleNotificationJob(updatedJob);
  return {
    job: updatedJob,
    preparedCount: indexesToPrepare.length,
  };
}

export async function getActiveArticleNotificationJob(
  articleId: string,
  source: ArticleEmailTrackingSource,
  kind: ArticleNotificationJobKind,
): Promise<ArticleNotificationJob | null> {
  const jobId = (await kv.get(activeNotificationJobKey(articleId, source, kind))) as string | null;
  if (!jobId) return null;

  const job = await getArticleNotificationJobRecord(jobId);
  if (!job) return null;

  if (job.status === 'completed' || job.status === 'completed_with_failures') {
    await removeActiveJobPointer(job);
    return null;
  }

  return job;
}

export async function acquireArticleNotificationJobLease(
  job: ArticleNotificationJob,
): Promise<ArticleNotificationJob | null> {
  const expiresAt = job.lockExpiresAt ? new Date(job.lockExpiresAt).getTime() : 0;
  if (job.lockId && expiresAt > Date.now()) {
    return null;
  }

  const updated: ArticleNotificationJob = {
    ...withArticleNotificationJobDefaults(job),
    status: job.status === 'queued' ? 'processing' : job.status,
    startedAt: job.startedAt || nowIso(),
    updatedAt: nowIso(),
    lockId: crypto.randomUUID(),
    lockExpiresAt: new Date(Date.now() + JOB_LOCK_TTL_MS).toISOString(),
  };

  await persistArticleNotificationJob(updated);
  await sleep(JOB_LOCK_SETTLE_MS);

  const latest = await getArticleNotificationJobRecord(job.id);
  if (!latest || latest.lockId !== updated.lockId) {
    return null;
  }

  return latest;
}

export async function syncRetryJobRecipients(
  job: ArticleNotificationJob,
  records: ArticleEmailTrackingRecord[],
): Promise<ArticleNotificationJobSnapshot> {
  const desiredItems = records.map(jobItemFromTrackingRecord);
  const nextItems = desiredItems;
  const resolvedCount = records.filter((record) =>
    isArticleEmailDeliveryTerminalStatus(record.deliveryStatus),
  ).length;

  if (
    nextItems.length === job.items.length &&
    nextItems.every((item, index) => item.trackingToken === job.items[index]?.trackingToken)
  ) {
    return hydrateArticleNotificationJob(job);
  }

  const syncedJob: ArticleNotificationJob = {
    ...withArticleNotificationJobDefaults(job),
    items: nextItems,
    recipientCount: nextItems.length,
    currentIndex: Math.min(resolvedCount, nextItems.length),
    prepareCursor: nextItems.length,
    status: nextItems.length > 0 ? 'queued' : 'completed',
    updatedAt: nowIso(),
    startedAt: nextItems.length > 0 ? null : job.startedAt,
    completedAt: nextItems.length > 0 ? null : nowIso(),
    lastProgressAt: nowIso(),
    lastPreparedAt: nextItems.length > 0 ? nowIso() : job.lastPreparedAt,
    lastError: nextItems.length > 0 ? null : job.lastError,
    lockId: null,
    lockExpiresAt: null,
  };

  await persistArticleNotificationJob(syncedJob);
  if (nextItems.length === 0) {
    await removeActiveJobPointer(syncedJob);
  }
  const snapshot = await hydrateArticleNotificationJob(syncedJob);
  await syncArticleNotificationCampaignFromJob(snapshot);
  return snapshot;
}

export async function resumeArticleNotificationJob(
  job: ArticleNotificationJob,
): Promise<ArticleNotificationJobSnapshot> {
  const resumedJob: ArticleNotificationJob = {
    ...withArticleNotificationJobDefaults(job),
    status: job.recipientCount > 0 ? 'queued' : 'completed',
    updatedAt: nowIso(),
    completedAt: job.recipientCount > 0 ? null : nowIso(),
    lastProgressAt: nowIso(),
    lastError: null,
    lockId: null,
    lockExpiresAt: null,
  };

  await persistArticleNotificationJob(resumedJob);
  if (resumedJob.recipientCount === 0) {
    await removeActiveJobPointer(resumedJob);
  }

  const snapshot = await hydrateArticleNotificationJob(resumedJob);
  await syncArticleNotificationCampaignFromJob(snapshot);
  return snapshot;
}
