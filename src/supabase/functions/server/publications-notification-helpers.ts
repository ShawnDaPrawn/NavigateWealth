import * as kv from './kv_store.tsx';
import { sendEmail } from './email-service.ts';
import { createArticleNotificationEmail } from './article-notification-template.ts';
import { createModuleLogger } from './stderr-logger.ts';
import {
  buildTrackedArticleUrl,
  createArticleEmailTrackingRecord,
  createArticleEmailTrackingRecords,
  isArticleEmailDeliveryRetryableStatus,
  isArticleEmailDeliveryTerminalStatus,
  listArticleEmailTrackingRecords,
  markArticleEmailDeliveryAttemptStarted,
  markArticleEmailDeliveryFailed,
  markArticleEmailDeliverySent,
  summarizeTrackedRecipientDeliveries,
  type ArticleEmailTrackingRecord,
  type ArticleEmailTrackingSource,
} from './publications-email-engagement-service.ts';
import type {
  ArticleNotificationCampaign,
  ArticleNotificationJob,
  ArticleNotificationJobItem,
  ArticleNotificationJobKind,
  ArticleNotificationJobPhase,
  ArticleNotificationJobSnapshot,
  ArticleNotificationProcessorState,
  ArticleNotificationProcessorStuckJob,
  ArticleNotificationRecipient,
  ArticleNotificationRunResult,
  DeliveryFailureClassification,
  PreparePublishJobTrackingBatchResult,
  PublishedArticle,
  QueueArticleNotificationOptions,
} from './publications-notification-types.ts';

const log = createModuleLogger('article-notifications');

export const NEWSLETTER_PREFIX = 'newsletter:';
export const NEWSLETTER_GROUP_KEY = 'communication:groups:sys_newsletter_contacts';
export const ARTICLE_NOTIFICATION_JOB_PREFIX = 'article_notification_job:';
const ARTICLE_NOTIFICATION_ACTIVE_PREFIX = 'article_notification_job_active:';
export const ARTICLE_NOTIFICATION_CAMPAIGN_PREFIX = 'article_notification_campaign:';
const ARTICLE_NOTIFICATION_PROCESSOR_STATE_KEY = 'article_notification_processor_state';
export const DELIVERY_BATCH_SIZE = 20;
const TRACKING_PREPARE_BATCH_SIZE = 15;
const MAX_SEND_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [750, 1500];
const RETRYABLE_REQUEUE_DELAY_MS = 30_000;
const JOB_LOCK_TTL_MS = 60_000;
const JOB_LOCK_SETTLE_MS = 80;
export const PROFILE_LOOKUP_BATCH_SIZE = 100;
export const LEGACY_SUBSCRIPTION_PAGE_SIZE = 100;
export const DEFAULT_MANUAL_MAX_JOBS = 2;
export const DEFAULT_MANUAL_MAX_BATCHES_PER_JOB = 3;
export const DEFAULT_AUTOMATED_MAX_JOBS = 5;
export const DEFAULT_AUTOMATED_MAX_BATCHES_PER_JOB = 4;
const STUCK_JOB_THRESHOLD_MS = 180_000;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeSendError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return 'Unknown error';
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function classifyDeliveryFailure(error: unknown): DeliveryFailureClassification {
  const message = normalizeSendError(error);
  const lowerMessage = message.toLowerCase();

  const terminalPatterns = [
    'invalid email',
    'invalid address',
    'does not contain a valid address',
    'address is invalid',
    'bounce',
    'suppression',
    'unsubscribe',
    'spam report',
    'recipient is on the suppression list',
    'permission',
    'forbidden',
    'unauthorized',
    'not verified',
    'from address does not match',
    'malformed',
    'bad request',
  ];

  if (terminalPatterns.some((pattern) => lowerMessage.includes(pattern))) {
    return { message, disposition: 'terminal' };
  }

  return { message, disposition: 'retryable' };
}

function isReadyToAttemptTrackingRecord(record: ArticleEmailTrackingRecord): boolean {
  if (isArticleEmailDeliveryTerminalStatus(record.deliveryStatus)) {
    return false;
  }

  const lastAttemptedAt = record.lastAttemptedAt ? new Date(record.lastAttemptedAt).getTime() : 0;
  const elapsedMs = lastAttemptedAt > 0 ? Date.now() - lastAttemptedAt : Number.POSITIVE_INFINITY;

  if (record.deliveryStatus === 'sending') {
    return elapsedMs >= JOB_LOCK_TTL_MS;
  }

  if (record.deliveryStatus === 'failed_retryable' || record.deliveryStatus === 'failed') {
    return elapsedMs >= RETRYABLE_REQUEUE_DELAY_MS;
  }

  return isArticleEmailDeliveryRetryableStatus(record.deliveryStatus);
}

function notificationJobKey(jobId: string): string {
  return `${ARTICLE_NOTIFICATION_JOB_PREFIX}${jobId}`;
}

function notificationCampaignKey(campaignId: string): string {
  return `${ARTICLE_NOTIFICATION_CAMPAIGN_PREFIX}${campaignId}`;
}

function activeNotificationJobKey(
  articleId: string,
  source: ArticleEmailTrackingSource,
  kind: ArticleNotificationJobKind,
): string {
  return `${ARTICLE_NOTIFICATION_ACTIVE_PREFIX}${articleId}:${source}:${kind}`;
}

function jobItemFromTrackingRecord(record: ArticleEmailTrackingRecord): ArticleNotificationJobItem {
  return {
    email: record.recipientEmail,
    firstName: record.recipientFirstName,
    name: record.recipientName,
    trackingToken: record.token,
  };
}

function clampInteger(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function inferPrepareCursorFromItems(
  kind: ArticleNotificationJobKind,
  items: ArticleNotificationJobItem[],
): number {
  if (kind !== 'publish') return items.length;

  let cursor = 0;
  while (cursor < items.length && items[cursor]?.trackingToken) {
    cursor++;
  }
  return cursor;
}

function withArticleNotificationJobDefaults(job: ArticleNotificationJob): ArticleNotificationJob {
  const items = Array.isArray(job.items)
    ? job.items.map((item) => ({
        email: item.email,
        firstName: item.firstName,
        name: item.name,
        trackingToken: item.trackingToken ?? null,
      }))
    : [];
  const recipientCount =
    typeof job.recipientCount === 'number' && Number.isFinite(job.recipientCount)
      ? job.recipientCount
      : items.length;
  const prepareCursor = clampInteger(
    (job as Partial<ArticleNotificationJob>).prepareCursor ??
      inferPrepareCursorFromItems(job.kind, items),
    0,
    items.length,
  );

  return {
    ...job,
    recipientCount,
    currentIndex: clampInteger(job.currentIndex, 0, recipientCount),
    prepareCursor,
    items,
    lastProgressAt:
      (job as Partial<ArticleNotificationJob>).lastProgressAt ??
      job.updatedAt ??
      job.createdAt ??
      null,
    lastPreparedAt: (job as Partial<ArticleNotificationJob>).lastPreparedAt ?? null,
    lastDeliveredAt: (job as Partial<ArticleNotificationJob>).lastDeliveredAt ?? null,
    lastError: job.lastError ?? null,
    lockId: job.lockId ?? null,
    lockExpiresAt: job.lockExpiresAt ?? null,
  };
}

function getJobLastProgressTimestamp(
  job: Pick<ArticleNotificationJob, 'lastProgressAt' | 'updatedAt' | 'createdAt'>,
): number | null {
  const candidate = job.lastProgressAt || job.updatedAt || job.createdAt;
  const timestamp = candidate ? new Date(candidate).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getJobPhase(
  job: ArticleNotificationJob,
  unpreparedCount: number,
  activeDeliveryCount: number,
): ArticleNotificationJobPhase {
  if (job.status === 'completed' || job.status === 'completed_with_failures') {
    return 'completed';
  }

  if (job.kind === 'publish' && unpreparedCount > 0) {
    return 'preparing';
  }

  if (activeDeliveryCount > 0) {
    return 'sending';
  }

  return 'completed';
}

function isArticleNotificationJobStuck(
  job: ArticleNotificationJob,
  phase: ArticleNotificationJobPhase,
): boolean {
  if ((job.status !== 'queued' && job.status !== 'processing') || phase === 'completed') {
    return false;
  }

  const lastProgressTs = getJobLastProgressTimestamp(job);
  if (!lastProgressTs) return false;
  return Date.now() - lastProgressTs >= STUCK_JOB_THRESHOLD_MS;
}

export async function getArticleNotificationJobRecord(
  jobId: string,
): Promise<ArticleNotificationJob | null> {
  if (!jobId) return null;
  const job = (await kv.get(notificationJobKey(jobId))) as ArticleNotificationJob | null;
  return job ? withArticleNotificationJobDefaults(job) : null;
}

export async function persistArticleNotificationJob(job: ArticleNotificationJob): Promise<void> {
  await kv.set(notificationJobKey(job.id), withArticleNotificationJobDefaults(job));
}

export async function getArticleNotificationCampaignRecord(
  campaignId: string,
): Promise<ArticleNotificationCampaign | null> {
  if (!campaignId) return null;
  return (await kv.get(notificationCampaignKey(campaignId))) as ArticleNotificationCampaign | null;
}

export async function persistArticleNotificationCampaign(
  campaign: ArticleNotificationCampaign,
): Promise<void> {
  await kv.set(notificationCampaignKey(campaign.id), campaign);
}

export async function getArticleNotificationProcessorStateRecord(): Promise<ArticleNotificationProcessorState | null> {
  return (await kv.get(
    ARTICLE_NOTIFICATION_PROCESSOR_STATE_KEY,
  )) as ArticleNotificationProcessorState | null;
}

export async function persistArticleNotificationProcessorState(
  state: ArticleNotificationProcessorState,
): Promise<void> {
  await kv.set(ARTICLE_NOTIFICATION_PROCESSOR_STATE_KEY, state);
}

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

function mapJobTrackingRecords(
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

async function syncRetryJobRecipients(
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

export async function resolvePublishedArticleForDelivery(
  article: PublishedArticle,
): Promise<PublishedArticle> {
  const stored = (await kv.get(`article:${article.id}`)) as {
    status?: string;
    slug?: string;
    title?: string;
    excerpt?: string;
  } | null;

  if (!stored || stored.status !== 'published') {
    throw new Error(`Cannot send article notifications: article ${article.id} is not published`);
  }

  return {
    id: article.id,
    title: stored.title || article.title,
    slug: stored.slug || article.slug,
    excerpt: stored.excerpt ?? article.excerpt,
  };
}

export async function deliverTrackedNotificationRecord(
  article: PublishedArticle,
  record: ArticleEmailTrackingRecord,
): Promise<void> {
  if (isArticleEmailDeliveryTerminalStatus(record.deliveryStatus)) {
    return;
  }

  const publishedArticle = await resolvePublishedArticleForDelivery(article);

  let lastFailure: DeliveryFailureClassification = {
    message: 'Delivery failed',
    disposition: 'retryable',
  };

  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
    try {
      await markArticleEmailDeliveryAttemptStarted(record.token);
      const articleUrl = buildTrackedArticleUrl(
        publishedArticle.slug || record.articleSlug,
        record.token,
      );
      const unsubscribeUrl = `https://www.navigatewealth.co/newsletter/unsubscribe?email=${encodeURIComponent(record.recipientEmail)}`;
      const { html, text } = await createArticleNotificationEmail({
        firstName: record.recipientFirstName,
        articleTitle: publishedArticle.title,
        articleExcerpt:
          publishedArticle.excerpt || 'A new article has been published on Navigate Wealth.',
        articleUrl,
        unsubscribeUrl,
      });

      await sendEmail(record.recipientEmail, `New article: ${publishedArticle.title}`, html, text);

      await markArticleEmailDeliverySent(record.token);
      return;
    } catch (error) {
      lastFailure = classifyDeliveryFailure(error);
      const hasRetryRemaining = attempt < MAX_SEND_ATTEMPTS;

      if (hasRetryRemaining && lastFailure.disposition === 'retryable') {
        const delayMs = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)] ?? 1000;
        log.warn(`Retrying article notification delivery for ${record.recipientEmail}`, {
          articleId: article.id,
          attempt,
          nextDelayMs: delayMs,
          error: lastFailure.message,
        });
        await sleep(delayMs);
        continue;
      }

      break;
    }
  }

  const failureStatus =
    lastFailure.disposition === 'terminal' ? 'failed_terminal' : 'failed_retryable';
  await markArticleEmailDeliveryFailed(record.token, lastFailure.message, failureStatus);
  throw new Error(lastFailure.message);
}

export async function createAndDeliverTrackingRecord(
  article: PublishedArticle,
  recipient: ArticleNotificationRecipient,
  source: ArticleEmailTrackingSource,
): Promise<void> {
  const tracking = await createArticleEmailTrackingRecord({
    article,
    recipient,
    source,
  });

  await deliverTrackedNotificationRecord(article, tracking);
}

async function listJobTrackingRecords(
  job: ArticleNotificationJob,
): Promise<ArticleEmailTrackingRecord[]> {
  const articleRecords = await listArticleEmailTrackingRecords(job.articleId);
  return mapJobTrackingRecords(job, articleRecords);
}

export async function listReadyJobTrackingRecords(
  job: ArticleNotificationJob,
): Promise<ArticleEmailTrackingRecord[]> {
  const records = await listJobTrackingRecords(job);
  return records.filter((record) => isReadyToAttemptTrackingRecord(record));
}

export async function queueArticleNotificationJob(
  article: PublishedArticle,
  items: ArticleNotificationRecipient[] | ArticleEmailTrackingRecord[],
  options: QueueArticleNotificationOptions,
): Promise<ArticleNotificationJobSnapshot> {
  const source = options.source ?? 'publish';
  const existingActiveJob = await getActiveArticleNotificationJob(article.id, source, options.kind);
  if (existingActiveJob) {
    if (options.kind === 'retry_undelivered') {
      return syncRetryJobRecipients(existingActiveJob, items as ArticleEmailTrackingRecord[]);
    }
    const snapshot = await hydrateArticleNotificationJob(existingActiveJob);
    await syncArticleNotificationCampaignFromJob(snapshot);
    return snapshot;
  }

  const jobId = crypto.randomUUID();
  const createdAt = nowIso();

  let jobItems: ArticleNotificationJobItem[];

  if (options.kind === 'publish') {
    const recipients = items as ArticleNotificationRecipient[];
    jobItems = recipients.map((recipient) => ({
      email: recipient.email.trim().toLowerCase(),
      firstName: recipient.firstName,
      name: recipient.name,
      trackingToken: null,
    }));
  } else {
    const records = items as ArticleEmailTrackingRecord[];
    jobItems = records.map((record) => ({
      email: record.recipientEmail,
      firstName: record.recipientFirstName,
      name: record.recipientName,
      trackingToken: record.token,
    }));
  }

  const job: ArticleNotificationJob = {
    id: jobId,
    articleId: article.id,
    articleTitle: article.title,
    articleSlug: article.slug,
    articleExcerpt: article.excerpt,
    source,
    kind: options.kind,
    status: jobItems.length > 0 ? 'queued' : 'completed',
    recipientCount: jobItems.length,
    currentIndex: 0,
    prepareCursor: options.kind === 'publish' ? 0 : jobItems.length,
    items: jobItems,
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    completedAt: jobItems.length > 0 ? null : createdAt,
    lastProgressAt: jobItems.length > 0 ? createdAt : null,
    lastPreparedAt: options.kind === 'publish' ? null : createdAt,
    lastDeliveredAt: null,
    lastError: null,
    lockId: null,
    lockExpiresAt: null,
  };

  await persistArticleNotificationJob(job);

  if (jobItems.length > 0) {
    await kv.set(activeNotificationJobKey(job.articleId, job.source, job.kind), job.id);
  }

  const snapshot = await hydrateArticleNotificationJob(job);
  await syncArticleNotificationCampaignFromJob(snapshot);
  return snapshot;
}

export async function finalizeArticleNotificationJob(
  job: ArticleNotificationJob,
): Promise<ArticleNotificationJobSnapshot> {
  const initialSnapshot = await hydrateArticleNotificationJob(job);
  const completedJob: ArticleNotificationJob = {
    ...withArticleNotificationJobDefaults(job),
    status: initialSnapshot.failedTerminalCount > 0 ? 'completed_with_failures' : 'completed',
    completedAt: nowIso(),
    updatedAt: nowIso(),
    lastProgressAt: nowIso(),
    lockId: null,
    lockExpiresAt: null,
  };

  await persistArticleNotificationJob(completedJob);
  await removeActiveJobPointer(completedJob);
  const snapshot = await hydrateArticleNotificationJob(completedJob);
  await syncArticleNotificationCampaignFromJob(snapshot);
  return snapshot;
}

/** Stable KV id for publish campaigns driven by tracking records (not a processor job id). */
export const PUBLISH_TRACKING_CAMPAIGN_ID = (articleId: string) => `publish_tracking_${articleId}`;

export async function syncPublishNotificationCampaignFromTrackingState(
  article: PublishedArticle,
  options?: {
    retryJobId?: string | null;
    blast?: Pick<ArticleNotificationRunResult, 'recipientCount' | 'sent' | 'failed'>;
  },
): Promise<ArticleNotificationCampaign | null> {
  const blast = options?.blast;
  const blastFullyDelivered = Boolean(
    blast && blast.recipientCount > 0 && blast.failed === 0 && blast.sent === blast.recipientCount,
  );

  let totals: ReturnType<typeof summarizeTrackedRecipientDeliveries>;
  let intended: number;

  if (blastFullyDelivered) {
    totals = {
      pending: 0,
      sending: 0,
      sent: blast!.sent,
      failed: 0,
      failedRetryable: 0,
      failedTerminal: 0,
      undelivered: 0,
    };
    intended = blast!.recipientCount;
  } else {
    const records = await listArticleEmailTrackingRecords(article.id);
    const publishRecords = records.filter((r) => r.source === 'publish');
    if (publishRecords.length === 0) {
      return null;
    }

    totals = summarizeTrackedRecipientDeliveries(publishRecords, 'publish');
    intended = publishRecords.length;
  }

  const campaignId = PUBLISH_TRACKING_CAMPAIGN_ID(article.id);
  const existing = await getArticleNotificationCampaignRecord(campaignId);
  const now = nowIso();
  const processedCount = totals.sent + totals.failedTerminal;
  const progressPercent = intended > 0 ? Math.round((processedCount / intended) * 1000) / 10 : 100;

  const workRemaining = totals.undelivered > 0;
  let status: ArticleNotificationCampaign['status'];
  if (workRemaining) {
    status = options?.retryJobId ? 'processing' : 'queued';
  } else if (totals.failedTerminal > 0) {
    status = 'completed_with_failures';
  } else {
    status = 'completed';
  }

  const phase: ArticleNotificationJobPhase = workRemaining ? 'sending' : 'completed';

  const campaign: ArticleNotificationCampaign = {
    id: campaignId,
    articleId: article.id,
    articleTitle: article.title,
    articleSlug: article.slug,
    articleExcerpt: article.excerpt,
    source: 'publish',
    status,
    phase,
    intendedRecipientCount: intended,
    preparedCount: intended,
    unpreparedCount: 0,
    pendingCount: totals.undelivered,
    sendingCount: totals.sending,
    sentCount: totals.sent,
    failedRetryableCount: totals.failedRetryable,
    failedTerminalCount: totals.failedTerminal,
    processedCount,
    progressPercent,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    startedAt: existing?.startedAt ?? now,
    completedAt: !workRemaining ? now : (existing?.completedAt ?? null),
    lastActivityAt: now,
    lastError: null,
    // Keep null so getArticleNotificationCampaign() does not merge processor state
    // into this row (would duplicate keys and break the engagement summary).
    jobId: null,
    stuck: false,
  };

  await persistArticleNotificationCampaign(campaign);
  return campaign;
}
