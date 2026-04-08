/**
 * Publications Notification Service
 *
 * Publish delivery is modeled as a durable queued job stored in KV. The job
 * can be resumed across multiple short HTTP requests, which prevents the
 * publish endpoint from trying to send the entire audience in one request.
 *
 * Reshare delivery remains an explicit direct-send workflow because it is a
 * manually targeted admin action.
 *
 * @module publications/notification-service
 */

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
  listUndeliveredArticleEmailTrackingRecords,
  markArticleEmailDeliveryAttemptStarted,
  markArticleEmailDeliveryFailed,
  markArticleEmailDeliverySent,
  summarizeTrackedRecipientDeliveries,
  type ArticleEmailTrackingRecord,
  type ArticleEmailTrackingSource,
} from './publications-email-engagement-service.ts';
import { backfillLegacyNewsletterSubscribersToGroup } from './newsletter-group-service.ts';

const log = createModuleLogger('article-notifications');

const NEWSLETTER_PREFIX = 'newsletter:';
const NEWSLETTER_GROUP_KEY = 'communication:groups:sys_newsletter_contacts';
const ARTICLE_NOTIFICATION_JOB_PREFIX = 'article_notification_job:';
const ARTICLE_NOTIFICATION_ACTIVE_PREFIX = 'article_notification_job_active:';
const ARTICLE_NOTIFICATION_CAMPAIGN_PREFIX = 'article_notification_campaign:';
const ARTICLE_NOTIFICATION_PROCESSOR_STATE_KEY = 'article_notification_processor_state';
const DELIVERY_BATCH_SIZE = 20;
const TRACKING_PREPARE_BATCH_SIZE = 15;
const MAX_SEND_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [750, 1500];
const RETRYABLE_REQUEUE_DELAY_MS = 30_000;
const JOB_LOCK_TTL_MS = 60_000;
const JOB_LOCK_SETTLE_MS = 80;
const PROFILE_LOOKUP_BATCH_SIZE = 100;
const LEGACY_SUBSCRIPTION_PAGE_SIZE = 100;
const DEFAULT_MANUAL_MAX_JOBS = 2;
const DEFAULT_MANUAL_MAX_BATCHES_PER_JOB = 3;
const DEFAULT_AUTOMATED_MAX_JOBS = 5;
const DEFAULT_AUTOMATED_MAX_BATCHES_PER_JOB = 4;
const STUCK_JOB_THRESHOLD_MS = 180_000;

export interface PublishedArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
}

export interface ArticleNotificationRecipient {
  email: string;
  firstName: string;
  name: string;
}

export interface ArticleNotificationRunResult {
  dryRun: boolean;
  recipientCount: number;
  sent: number;
  failed: number;
  recipients: ArticleNotificationRecipient[];
  errors: string[];
}

export type ArticleNotificationJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'completed_with_failures';

export type ArticleNotificationCampaignStatus =
  | ArticleNotificationJobStatus
  | 'no_recipients'
  | 'queue_failed';

export type ArticleNotificationJobKind = 'publish' | 'retry_undelivered';
export type ArticleNotificationJobPhase = 'preparing' | 'sending' | 'completed';

export interface ArticleNotificationJobItem {
  email: string;
  firstName: string;
  name: string;
  trackingToken: string | null;
}

export interface ArticleNotificationJob {
  id: string;
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  articleExcerpt: string;
  source: ArticleEmailTrackingSource;
  kind: ArticleNotificationJobKind;
  status: ArticleNotificationJobStatus;
  recipientCount: number;
  currentIndex: number;
  prepareCursor: number;
  items: ArticleNotificationJobItem[];
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastProgressAt: string | null;
  lastPreparedAt: string | null;
  lastDeliveredAt: string | null;
  lastError: string | null;
  lockId: string | null;
  lockExpiresAt: string | null;
}

export interface ArticleNotificationJobSnapshot extends ArticleNotificationJob {
  phase: ArticleNotificationJobPhase;
  preparedCount: number;
  unpreparedCount: number;
  sentCount: number;
  failedCount: number;
  failedRetryableCount: number;
  failedTerminalCount: number;
  pendingCount: number;
  sendingCount: number;
  processedCount: number;
  progressPercent: number;
  stuck: boolean;
}

export interface ArticleNotificationCampaign {
  id: string;
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  articleExcerpt: string;
  source: ArticleEmailTrackingSource;
  status: ArticleNotificationCampaignStatus;
  phase: ArticleNotificationJobPhase;
  intendedRecipientCount: number;
  preparedCount: number;
  unpreparedCount: number;
  pendingCount: number;
  sendingCount: number;
  sentCount: number;
  failedRetryableCount: number;
  failedTerminalCount: number;
  processedCount: number;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
  lastError: string | null;
  jobId: string | null;
  stuck: boolean;
}

export interface ArticleNotificationProcessorResult {
  processedJobs: number;
  advancedJobs: number;
  completedJobs: number;
  jobs: ArticleNotificationJobSnapshot[];
}

export interface ArticleNotificationProcessorState {
  mode: 'manual' | 'cron' | 'scheduler';
  lastHeartbeatAt: string;
  lastRunAt: string;
  lastSuccessAt: string | null;
  lastError: string | null;
  maxJobs: number;
  maxBatchesPerJob: number;
  processedJobs: number;
  advancedJobs: number;
  completedJobs: number;
  activeJobCount: number;
  queuedJobCount: number;
  processingJobCount: number;
  stuckJobCount: number;
  staleJobThresholdMs: number;
  stuckJobs: ArticleNotificationProcessorStuckJob[];
}

export interface ArticleNotificationProcessorStuckJob {
  id: string;
  articleId: string;
  articleTitle: string;
  kind: ArticleNotificationJobKind;
  source: ArticleEmailTrackingSource;
  status: ArticleNotificationJobStatus;
  phase: ArticleNotificationJobPhase;
  pendingCountEstimate: number;
  prepareCursor: number;
  recipientCount: number;
  lastProgressAt: string | null;
  updatedAt: string;
  minutesSinceProgress: number | null;
}

interface QueueArticleNotificationOptions {
  kind: ArticleNotificationJobKind;
  source?: ArticleEmailTrackingSource;
}

interface NewsletterSubscription {
  email: string;
  name?: string;
  confirmed: boolean;
  active?: boolean;
}

interface ExternalContact {
  email: string;
  name?: string;
  source: string;
  subscribedAt: string;
}

interface NewsletterGroup {
  clientIds: string[];
  externalContacts?: ExternalContact[];
}

interface LegacySubscriptionPageOptions {
  startAfter?: string;
  limit?: number;
}

interface ArticleNotificationProcessorOptions {
  jobId?: string;
  maxJobs?: number;
  maxBatchesPerJob?: number;
  mode?: 'manual' | 'cron' | 'scheduler';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSendError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return 'Unknown error';
}

function nowIso(): string {
  return new Date().toISOString();
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

type DeliveryFailureDisposition = 'retryable' | 'terminal';

interface DeliveryFailureClassification {
  message: string;
  disposition: DeliveryFailureDisposition;
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
  const recipientCount = typeof job.recipientCount === 'number' && Number.isFinite(job.recipientCount)
    ? job.recipientCount
    : items.length;
  const prepareCursor = clampInteger(
    (job as Partial<ArticleNotificationJob>).prepareCursor ?? inferPrepareCursorFromItems(job.kind, items),
    0,
    items.length,
  );

  return {
    ...job,
    recipientCount,
    currentIndex: clampInteger(job.currentIndex, 0, recipientCount),
    prepareCursor,
    items,
    lastProgressAt: (job as Partial<ArticleNotificationJob>).lastProgressAt ?? job.updatedAt ?? job.createdAt ?? null,
    lastPreparedAt: (job as Partial<ArticleNotificationJob>).lastPreparedAt ?? null,
    lastDeliveredAt: (job as Partial<ArticleNotificationJob>).lastDeliveredAt ?? null,
    lastError: job.lastError ?? null,
    lockId: job.lockId ?? null,
    lockExpiresAt: job.lockExpiresAt ?? null,
  };
}

function getJobLastProgressTimestamp(job: Pick<ArticleNotificationJob, 'lastProgressAt' | 'updatedAt' | 'createdAt'>): number | null {
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

async function getArticleNotificationJobRecord(jobId: string): Promise<ArticleNotificationJob | null> {
  if (!jobId) return null;
  const job = (await kv.get(notificationJobKey(jobId))) as ArticleNotificationJob | null;
  return job ? withArticleNotificationJobDefaults(job) : null;
}

async function persistArticleNotificationJob(job: ArticleNotificationJob): Promise<void> {
  await kv.set(notificationJobKey(job.id), withArticleNotificationJobDefaults(job));
}

async function getArticleNotificationCampaignRecord(
  campaignId: string,
): Promise<ArticleNotificationCampaign | null> {
  if (!campaignId) return null;
  return (await kv.get(notificationCampaignKey(campaignId))) as ArticleNotificationCampaign | null;
}

async function persistArticleNotificationCampaign(
  campaign: ArticleNotificationCampaign,
): Promise<void> {
  await kv.set(notificationCampaignKey(campaign.id), campaign);
}

async function getArticleNotificationProcessorStateRecord(): Promise<ArticleNotificationProcessorState | null> {
  return (await kv.get(ARTICLE_NOTIFICATION_PROCESSOR_STATE_KEY)) as ArticleNotificationProcessorState | null;
}

async function persistArticleNotificationProcessorState(
  state: ArticleNotificationProcessorState,
): Promise<void> {
  await kv.set(ARTICLE_NOTIFICATION_PROCESSOR_STATE_KEY, state);
}

async function buildArticleNotificationProcessorState(
  input: Omit<ArticleNotificationProcessorState, 'activeJobCount' | 'queuedJobCount' | 'processingJobCount' | 'stuckJobCount' | 'staleJobThresholdMs' | 'stuckJobs'>,
): Promise<ArticleNotificationProcessorState> {
  const allJobs = (await kv.getByPrefix(ARTICLE_NOTIFICATION_JOB_PREFIX) as ArticleNotificationJob[])
    .map(withArticleNotificationJobDefaults);
  const activeJobs = allJobs.filter((job) => job.status === 'queued' || job.status === 'processing');
  const queuedJobCount = activeJobs.filter((job) => job.status === 'queued').length;
  const processingJobCount = activeJobs.filter((job) => job.status === 'processing').length;
  const stuckJobs = activeJobs
    .map((job) => {
      const pendingCountEstimate = Math.max(job.recipientCount - Math.min(job.currentIndex, job.recipientCount), 0);
      const unpreparedCount = job.kind === 'publish' ? Math.max(job.recipientCount - job.prepareCursor, 0) : 0;
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

async function releaseArticleNotificationJobLease(
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
): ArticleNotificationCampaignStatus {
  if (snapshot.recipientCount === 0) return 'no_recipients';
  return snapshot.status;
}

function campaignFromJobSnapshot(
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

async function syncArticleNotificationCampaignFromJob(
  snapshot: ArticleNotificationJobSnapshot,
): Promise<ArticleNotificationCampaign | null> {
  if (snapshot.kind !== 'publish') return null;

  const campaign = campaignFromJobSnapshot(snapshot);
  await persistArticleNotificationCampaign(campaign);
  return campaign;
}

async function removeActiveJobPointer(job: ArticleNotificationJob): Promise<void> {
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
    .map((item) => item.trackingToken ? recordByToken.get(item.trackingToken) ?? null : null)
    .filter((record): record is ArticleEmailTrackingRecord => Boolean(record));
}

async function hydrateArticleNotificationJob(job: ArticleNotificationJob): Promise<ArticleNotificationJobSnapshot> {
  const normalizedJob = withArticleNotificationJobDefaults(job);
  const articleRecords = await listArticleEmailTrackingRecords(normalizedJob.articleId);
  const recordByToken = new Map(articleRecords.map((record) => [record.token, record]));
  const trackingRecords = mapJobTrackingRecords(normalizedJob, articleRecords);
  const preparedCount = normalizedJob.items.filter((item) => item.trackingToken && recordByToken.has(item.trackingToken)).length;
  const unpreparedCount = Math.max(normalizedJob.recipientCount - preparedCount, 0);

  const totals = summarizeTrackedRecipientDeliveries(trackingRecords);
  const failedTerminalCount = totals.failedTerminal;
  const processedCount = totals.sent + failedTerminalCount;
  const pendingCount = totals.pending + unpreparedCount;
  const phase = getJobPhase(normalizedJob, unpreparedCount, totals.pending + totals.sending + totals.failedRetryable);
  const progressPercent = normalizedJob.recipientCount > 0
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

interface PreparePublishJobTrackingBatchResult {
  job: ArticleNotificationJob;
  preparedCount: number;
}

async function preparePublishJobTrackingBatch(
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

  while (nextPrepareCursor < normalizedJob.items.length && indexesToPrepare.length < TRACKING_PREPARE_BATCH_SIZE) {
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

async function getActiveArticleNotificationJob(
  articleId: string,
  source: ArticleEmailTrackingSource,
  kind: ArticleNotificationJobKind,
): Promise<ArticleNotificationJob | null> {
  const jobId = await kv.get(activeNotificationJobKey(articleId, source, kind)) as string | null;
  if (!jobId) return null;

  const job = await getArticleNotificationJobRecord(jobId);
  if (!job) return null;

  if (job.status === 'completed' || job.status === 'completed_with_failures') {
    await removeActiveJobPointer(job);
    return null;
  }

  return job;
}

async function acquireArticleNotificationJobLease(
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
  const resolvedCount = records.filter((record) => isArticleEmailDeliveryTerminalStatus(record.deliveryStatus)).length;

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

async function resumeArticleNotificationJob(
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

async function deliverTrackedNotificationRecord(
  article: PublishedArticle,
  record: ArticleEmailTrackingRecord,
): Promise<void> {
  if (isArticleEmailDeliveryTerminalStatus(record.deliveryStatus)) {
    return;
  }

  let lastFailure: DeliveryFailureClassification = {
    message: 'Delivery failed',
    disposition: 'retryable',
  };

  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
    try {
      await markArticleEmailDeliveryAttemptStarted(record.token);
      const articleUrl = buildTrackedArticleUrl(article.slug, record.token);
      const unsubscribeUrl = `https://www.navigatewealth.co/newsletter/unsubscribe?email=${encodeURIComponent(record.recipientEmail)}`;
      const { html, text } = await createArticleNotificationEmail({
        firstName: record.recipientFirstName,
        articleTitle: article.title,
        articleExcerpt: article.excerpt || 'A new article has been published on Navigate Wealth.',
        articleUrl,
        unsubscribeUrl,
      });

      await sendEmail(
        record.recipientEmail,
        `New article: ${article.title}`,
        html,
        text,
      );

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

  const failureStatus = lastFailure.disposition === 'terminal' ? 'failed_terminal' : 'failed_retryable';
  await markArticleEmailDeliveryFailed(record.token, lastFailure.message, failureStatus);
  throw new Error(lastFailure.message);
}

async function createAndDeliverTrackingRecord(
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

function getProfileEmail(profile: Record<string, unknown> | null | undefined): string | null {
  if (!profile) return null;

  const personalInformation = (profile.personalInformation || {}) as Record<string, unknown>;
  const contactDetails = (profile.contactDetails || {}) as Record<string, unknown>;
  const email = profile.email || personalInformation.email || contactDetails.email;

  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
}

function getProfileFirstName(profile: Record<string, unknown> | null | undefined, fallbackEmail: string): string {
  if (!profile) return extractFirstName(fallbackEmail);

  const personalInformation = (profile.personalInformation || {}) as Record<string, unknown>;
  const firstName = profile.firstName || personalInformation.firstName || profile.preferredName;

  return typeof firstName === 'string' && firstName.trim()
    ? firstName.trim()
    : extractFirstName(fallbackEmail);
}

function getProfileFullName(
  profile: Record<string, unknown> | null | undefined,
  firstName: string,
): string {
  if (!profile) return firstName;

  const personalInformation = (profile.personalInformation || {}) as Record<string, unknown>;
  const name = profile.name;
  const first = profile.firstName || personalInformation.firstName;
  const last = profile.lastName || personalInformation.lastName || personalInformation.surname;

  if (typeof name === 'string' && name.trim()) return name.trim();
  if ((typeof first === 'string' && first.trim()) || (typeof last === 'string' && last.trim())) {
    return `${typeof first === 'string' ? first.trim() : ''} ${typeof last === 'string' ? last.trim() : ''}`.trim();
  }

  return firstName;
}

async function collectRecipientsFromNewsletterGroup(
  recipientMap: Map<string, ArticleNotificationRecipient>,
  requestedEmails: Set<string> | null,
): Promise<number> {
  const group = await kv.get(NEWSLETTER_GROUP_KEY) as NewsletterGroup | null;

  if (!group) {
    log.warn('Newsletter Contacts group not found while resolving article notification recipients');
    return 0;
  }

  let addedCount = 0;

  if (group.externalContacts?.length) {
    for (const contact of group.externalContacts) {
      const email = contact.email?.trim().toLowerCase();
      if (!email) continue;
      if (requestedEmails && !requestedEmails.has(email)) continue;
      if (recipientMap.has(email)) continue;

      const firstName = contact.name || extractFirstName(email);
      recipientMap.set(email, {
        email,
        firstName,
        name: contact.name || firstName,
      });
      addedCount++;
    }
  }

  const clientIds = Array.isArray(group.clientIds) ? group.clientIds.filter(Boolean) : [];
  if (clientIds.length === 0) return addedCount;

  const profileKeys = clientIds.map((clientId) => `user_profile:${clientId}:personal_info`);
  for (const batch of chunkArray(profileKeys, PROFILE_LOOKUP_BATCH_SIZE)) {
    const profiles = await kv.mget(batch) as Array<Record<string, unknown> | null | undefined>;

    for (const profile of profiles) {
      const email = getProfileEmail(profile);
      if (!email) continue;
      if (requestedEmails && !requestedEmails.has(email)) continue;
      if (recipientMap.has(email)) continue;

      const firstName = getProfileFirstName(profile, email);
      recipientMap.set(email, {
        email,
        firstName,
        name: getProfileFullName(profile, firstName),
      });
      addedCount++;
    }
  }

  return addedCount;
}

async function collectRecipientsFromRequestedLegacySubscriptions(
  recipientMap: Map<string, ArticleNotificationRecipient>,
  requestedEmails: Set<string>,
): Promise<number> {
  const unresolvedEmails = [...requestedEmails].filter((email) => !recipientMap.has(email));
  if (unresolvedEmails.length === 0) return 0;

  let addedCount = 0;

  for (const email of unresolvedEmails) {
    try {
      const subscription = await kv.get(`${NEWSLETTER_PREFIX}${email}`) as NewsletterSubscription | null;
      if (!subscription || !subscription.confirmed || subscription.active === false) continue;

      const firstName = subscription.name || extractFirstName(email);
      recipientMap.set(email, {
        email,
        firstName,
        name: subscription.name || firstName,
      });
      addedCount++;
    } catch (error) {
      log.warn('Failed to resolve legacy newsletter subscription for requested recipient', {
        email,
        error: normalizeSendError(error),
      });
    }
  }

  return addedCount;
}

async function listLegacyNewsletterSubscriptionPage(
  options?: LegacySubscriptionPageOptions,
): Promise<Array<{ key: string; value: NewsletterSubscription | null }>> {
  return await kv.listByPrefix(NEWSLETTER_PREFIX, {
    startAfter: options?.startAfter,
    limit: options?.limit ?? LEGACY_SUBSCRIPTION_PAGE_SIZE,
  }) as Array<{ key: string; value: NewsletterSubscription | null }>;
}

async function collectRecipientsFromAllLegacySubscriptions(
  recipientMap: Map<string, ArticleNotificationRecipient>,
): Promise<number> {
  let lastKey: string | undefined;
  let addedCount = 0;

  while (true) {
    const rows = await listLegacyNewsletterSubscriptionPage({
      startAfter: lastKey,
    });

    if (rows.length === 0) {
      return addedCount;
    }

    for (const row of rows) {
      const subscription = row.value as NewsletterSubscription | null;
      const email = subscription?.email?.trim().toLowerCase();
      if (!email || !subscription?.confirmed || subscription.active === false) continue;
      if (recipientMap.has(email)) continue;

      const firstName = subscription.name || extractFirstName(email);
      recipientMap.set(email, {
        email,
        firstName,
        name: subscription.name || firstName,
      });
      addedCount++;
    }

    if (rows.length < LEGACY_SUBSCRIPTION_PAGE_SIZE) {
      return addedCount;
    }

    lastKey = rows[rows.length - 1]?.key;
  }
}

async function collectArticleNotificationRecipients(
  recipientEmails?: string[],
): Promise<ArticleNotificationRecipient[]> {
  const requestedEmails = recipientEmails?.length
    ? new Set(recipientEmails.map((email) => email.trim().toLowerCase()))
    : null;

  const recipientMap = new Map<string, ArticleNotificationRecipient>();

  if (!requestedEmails) {
    try {
      await backfillLegacyNewsletterSubscribersToGroup();
    } catch (err) {
      log.error('Legacy newsletter subscriber backfill failed before recipient collection (non-blocking)', err);
    }
  }

  try {
    const addedFromGroup = await collectRecipientsFromNewsletterGroup(recipientMap, requestedEmails);
    log.info('Collected article notification recipients from Newsletter Contacts group', {
      requestedRecipientCount: requestedEmails?.size ?? null,
      addedFromGroup,
      totalUniqueRecipients: recipientMap.size,
    });
  } catch (err) {
    log.error('Failed to fetch Newsletter Contacts group recipients (non-blocking)', err);
  }

  if (requestedEmails) {
    const addedFromLegacyRequested = await collectRecipientsFromRequestedLegacySubscriptions(recipientMap, requestedEmails);
    log.info('Resolved requested legacy newsletter recipients', {
      requestedRecipientCount: requestedEmails.size,
      addedFromLegacyRequested,
      totalUniqueRecipients: recipientMap.size,
    });
  } else {
    try {
      const addedFromLegacy = await collectRecipientsFromAllLegacySubscriptions(recipientMap);
      log.info('Collected article notification recipients from legacy newsletter subscriptions', {
        addedFromLegacy,
        totalUniqueRecipients: recipientMap.size,
      });
    } catch (err) {
      log.error('Failed to fetch recipients from legacy newsletter subscriptions', err);
    }
  }

  return [...recipientMap.values()].sort((a, b) => a.email.localeCompare(b.email));
}

async function listJobTrackingRecords(job: ArticleNotificationJob): Promise<ArticleEmailTrackingRecord[]> {
  const articleRecords = await listArticleEmailTrackingRecords(job.articleId);
  return mapJobTrackingRecords(job, articleRecords);
}

async function listReadyJobTrackingRecords(job: ArticleNotificationJob): Promise<ArticleEmailTrackingRecord[]> {
  const records = await listJobTrackingRecords(job);
  return records.filter((record) => isReadyToAttemptTrackingRecord(record));
}

async function queueArticleNotificationJob(
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

  let jobItems: ArticleNotificationJobItem[] = [];

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

async function finalizeArticleNotificationJob(
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

export async function runArticleNotificationDelivery(
  article: PublishedArticle,
  options?: {
    dryRun?: boolean;
    recipientEmails?: string[];
    source?: ArticleEmailTrackingSource;
  },
): Promise<ArticleNotificationRunResult> {
  const dryRun = options?.dryRun ?? false;
  const recipients = await collectArticleNotificationRecipients(options?.recipientEmails);

  if (recipients.length === 0) {
    return {
      dryRun,
      recipientCount: 0,
      sent: 0,
      failed: 0,
      recipients: [],
      errors: [],
    };
  }

  if (dryRun) {
    return {
      dryRun: true,
      recipientCount: recipients.length,
      sent: 0,
      failed: 0,
      recipients,
      errors: [],
    };
  }

  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  for (let start = 0; start < recipients.length; start += DELIVERY_BATCH_SIZE) {
    const batch = recipients.slice(start, start + DELIVERY_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((recipient) =>
        createAndDeliverTrackingRecord(article, recipient, options?.source ?? 'publish')
          .then(() => ({ email: recipient.email })),
      ),
    );

    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      const recipient = batch[index];
      if (result.status === 'fulfilled') {
        sent++;
        continue;
      }

      failed++;
      const msg = normalizeSendError(result.reason);
      errors.push(`${recipient.email}: ${msg}`);
      log.error(`Failed to send article notification to ${recipient.email}: ${msg}`);
    }

    log.info('Processed direct article notification batch', {
      articleId: article.id,
      processed: Math.min(start + batch.length, recipients.length),
      total: recipients.length,
      sent,
      failed,
    });
  }

  return {
    dryRun: false,
    recipientCount: recipients.length,
    sent,
    failed,
    recipients,
    errors,
  };
}

export async function sendArticlePublishedNotifications(
  article: PublishedArticle,
): Promise<ArticleNotificationJobSnapshot> {
  log.info('Queueing article publish notifications', { articleId: article.id, title: article.title });
  const recipients = await collectArticleNotificationRecipients();
  return queueArticleNotificationJob(article, recipients, {
    kind: 'publish',
    source: 'publish',
  });
}

export async function retryUndeliveredArticleNotifications(
  article: PublishedArticle,
  options?: {
    source?: ArticleEmailTrackingSource;
  },
): Promise<ArticleNotificationJobSnapshot> {
  const source = options?.source ?? 'publish';
  const undeliveredRecords = await listUndeliveredArticleEmailTrackingRecords(article.id, source);

  log.info('Queueing article notification retry job', {
    articleId: article.id,
    source,
    recipientCount: undeliveredRecords.length,
  });

  return queueArticleNotificationJob(article, undeliveredRecords, {
    kind: 'retry_undelivered',
    source,
  });
}

export async function resumeArticleNotificationDelivery(
  article: PublishedArticle,
  options?: {
    source?: ArticleEmailTrackingSource;
  },
): Promise<ArticleNotificationJobSnapshot> {
  const source = options?.source ?? 'publish';

  const activeRetryJob = await getActiveArticleNotificationJob(article.id, source, 'retry_undelivered');
  if (activeRetryJob) {
    log.info('Resuming active article notification retry job', {
      articleId: article.id,
      jobId: activeRetryJob.id,
      source,
    });
    return resumeArticleNotificationJob(activeRetryJob);
  }

  const activePublishJob = await getActiveArticleNotificationJob(article.id, source, 'publish');
  if (activePublishJob) {
    log.info('Resuming active article notification publish job', {
      articleId: article.id,
      jobId: activePublishJob.id,
      source,
    });
    return resumeArticleNotificationJob(activePublishJob);
  }

  return retryUndeliveredArticleNotifications(article, { source });
}

export async function getArticleNotificationCampaign(
  campaignId: string,
): Promise<ArticleNotificationCampaign | null> {
  const campaign = await getArticleNotificationCampaignRecord(campaignId);
  if (!campaign) return null;
  if (!campaign.jobId) return campaign;

  const job = await getArticleNotificationJobRecord(campaign.jobId);
  if (!job) return campaign;

  const snapshot = await hydrateArticleNotificationJob(job);
  const liveCampaign = campaignFromJobSnapshot(snapshot);
  await persistArticleNotificationCampaign(liveCampaign);
  return liveCampaign;
}

export async function listArticleNotificationCampaigns(
  options?: {
    articleId?: string;
    source?: ArticleEmailTrackingSource;
  },
): Promise<ArticleNotificationCampaign[]> {
  const campaigns = await kv.getByPrefix(ARTICLE_NOTIFICATION_CAMPAIGN_PREFIX) as ArticleNotificationCampaign[];

  return campaigns
    .filter((campaign) => {
      if (options?.articleId && campaign.articleId !== options.articleId) return false;
      if (options?.source && campaign.source !== options.source) return false;
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
}

export async function getLatestArticleNotificationCampaign(
  articleId: string,
  source: ArticleEmailTrackingSource = 'publish',
): Promise<ArticleNotificationCampaign | null> {
  const campaigns = await listArticleNotificationCampaigns({ articleId, source });
  const latestCampaign = campaigns[0] ?? null;
  if (!latestCampaign) return null;
  return getArticleNotificationCampaign(latestCampaign.id);
}

export async function getArticleNotificationProcessorState(): Promise<ArticleNotificationProcessorState | null> {
  return getArticleNotificationProcessorStateRecord();
}

export async function createArticleNotificationQueueFailedCampaign(
  article: PublishedArticle,
  options?: {
    source?: ArticleEmailTrackingSource;
    lastError?: string | null;
  },
): Promise<ArticleNotificationCampaign> {
  const createdAt = nowIso();
  const campaign: ArticleNotificationCampaign = {
    id: crypto.randomUUID(),
    articleId: article.id,
    articleTitle: article.title,
    articleSlug: article.slug,
    articleExcerpt: article.excerpt,
    source: options?.source ?? 'publish',
    status: 'queue_failed',
    phase: 'completed',
    intendedRecipientCount: 0,
    preparedCount: 0,
    unpreparedCount: 0,
    pendingCount: 0,
    sendingCount: 0,
    sentCount: 0,
    failedRetryableCount: 0,
    failedTerminalCount: 0,
    processedCount: 0,
    progressPercent: 0,
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    completedAt: createdAt,
    lastActivityAt: createdAt,
    lastError: options?.lastError ?? 'Notification campaign could not be queued',
    jobId: null,
    stuck: false,
  };

  await persistArticleNotificationCampaign(campaign);
  return campaign;
}

export async function getArticleNotificationJob(
  jobId: string,
): Promise<ArticleNotificationJobSnapshot | null> {
  const job = await getArticleNotificationJobRecord(jobId);
  if (!job) return null;
  const snapshot = await hydrateArticleNotificationJob(job);
  await syncArticleNotificationCampaignFromJob(snapshot);
  return snapshot;
}

export async function processArticleNotificationJobs(
  options?: ArticleNotificationProcessorOptions,
): Promise<ArticleNotificationProcessorResult> {
  const mode = options?.mode ?? 'manual';
  const defaultMaxJobs = mode === 'manual' ? DEFAULT_MANUAL_MAX_JOBS : DEFAULT_AUTOMATED_MAX_JOBS;
  const defaultMaxBatchesPerJob = mode === 'manual'
    ? DEFAULT_MANUAL_MAX_BATCHES_PER_JOB
    : DEFAULT_AUTOMATED_MAX_BATCHES_PER_JOB;
  const requestedMaxJobs = Math.max(1, Math.min(options?.maxJobs ?? defaultMaxJobs, 5));
  const requestedMaxBatchesPerJob = Math.max(1, Math.min(
    options?.maxBatchesPerJob ?? defaultMaxBatchesPerJob,
    5,
  ));
  const maxJobs = mode === 'manual'
    ? requestedMaxJobs
    : Math.max(defaultMaxJobs, requestedMaxJobs);
  const maxBatchesPerJob = mode === 'manual'
    ? requestedMaxBatchesPerJob
    : Math.max(defaultMaxBatchesPerJob, requestedMaxBatchesPerJob);
  const previousProcessorState = await getArticleNotificationProcessorStateRecord();

  try {
    const jobsToProcess: ArticleNotificationJob[] = [];

    if (options?.jobId) {
      const job = await getArticleNotificationJobRecord(options.jobId);
      if (job && (job.status === 'queued' || job.status === 'processing')) {
        jobsToProcess.push(job);
      }
    } else {
      const allJobs = await kv.getByPrefix(ARTICLE_NOTIFICATION_JOB_PREFIX) as ArticleNotificationJob[];
      const queuedJobs = allJobs
        .filter((job) => job.status === 'queued' || job.status === 'processing')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      jobsToProcess.push(...queuedJobs);
    }

    const snapshots: ArticleNotificationJobSnapshot[] = [];
    let advancedJobs = 0;
    let completedJobs = 0;
    let inspectedJobs = 0;

    for (const job of jobsToProcess) {
      if (advancedJobs >= maxJobs) break;
      inspectedJobs++;

      const leasedJob = await acquireArticleNotificationJobLease(job);
      if (!leasedJob) continue;

      let workingJob = leasedJob;
      let prepareSteps = 0;
      let deliverySteps = 0;
      let didAdvanceJob = false;

      try {
        const leasedSnapshot = await hydrateArticleNotificationJob(leasedJob);
        if (leasedSnapshot.pendingCount === 0 && leasedSnapshot.sendingCount === 0) {
          const completed = await finalizeArticleNotificationJob(leasedJob);
          snapshots.push(completed);
          completedJobs++;
          advancedJobs++;
          continue;
        }

        const article: PublishedArticle = {
          id: leasedJob.articleId,
          title: leasedJob.articleTitle,
          slug: leasedJob.articleSlug,
          excerpt: leasedJob.articleExcerpt,
        };

        if (workingJob.kind === 'publish') {
          while (prepareSteps < maxBatchesPerJob) {
            const preparationResult = await preparePublishJobTrackingBatch(workingJob, article);
            workingJob = preparationResult.job;

            if (preparationResult.preparedCount <= 0) {
              break;
            }

            prepareSteps++;
            didAdvanceJob = true;

            const preparationSnapshot = await hydrateArticleNotificationJob(workingJob);
            workingJob = {
              ...workingJob,
              currentIndex: preparationSnapshot.currentIndex,
            };
            await syncArticleNotificationCampaignFromJob(preparationSnapshot);
          }
        }

        while (deliverySteps < maxBatchesPerJob) {
          const readyRecords = await listReadyJobTrackingRecords(workingJob);
          const batch = readyRecords.slice(0, DELIVERY_BATCH_SIZE);
          if (batch.length === 0) break;

          const batchResults = await Promise.allSettled(
            batch.map(async (tracking) => {
              if (isArticleEmailDeliveryTerminalStatus(tracking.deliveryStatus)) {
                return { email: tracking.recipientEmail, skipped: true };
              }

              await deliverTrackedNotificationRecord(article, tracking);
              return { email: tracking.recipientEmail, skipped: false };
            }),
          );

          const errors = batchResults
            .map((result, index) => {
              if (result.status === 'fulfilled') return null;
              return `${batch[index]?.recipientEmail || 'unknown'}: ${normalizeSendError(result.reason)}`;
            })
            .filter((value): value is string => Boolean(value));

          const deliveryTimestamp = nowIso();
          workingJob = {
            ...workingJob,
            currentIndex: workingJob.currentIndex,
            updatedAt: deliveryTimestamp,
            lastProgressAt: deliveryTimestamp,
            lastDeliveredAt: deliveryTimestamp,
            lastError: errors[0] ?? workingJob.lastError,
            status: 'processing',
          };

          await persistArticleNotificationJob(workingJob);
          deliverySteps++;
          didAdvanceJob = true;

          const intermediateSnapshot = await hydrateArticleNotificationJob(workingJob);
          workingJob = {
            ...workingJob,
            currentIndex: intermediateSnapshot.currentIndex,
          };
          await syncArticleNotificationCampaignFromJob(intermediateSnapshot);

          if (intermediateSnapshot.pendingCount === 0 && intermediateSnapshot.sendingCount === 0) {
            break;
          }
        }

        const refreshedSnapshot = await hydrateArticleNotificationJob(workingJob);
        const snapshot = refreshedSnapshot.pendingCount === 0 && refreshedSnapshot.sendingCount === 0
          ? await finalizeArticleNotificationJob(workingJob)
          : await (async () => {
            const releasableJob = await releaseArticleNotificationJobLease(workingJob, {
              currentIndex: refreshedSnapshot.currentIndex,
            });
            return hydrateArticleNotificationJob(releasableJob);
          })();

        snapshots.push(snapshot);
        if (didAdvanceJob || snapshot.status === 'completed' || snapshot.status === 'completed_with_failures') {
          advancedJobs++;
        }

        await syncArticleNotificationCampaignFromJob(snapshot);

        if (snapshot.status === 'completed' || snapshot.status === 'completed_with_failures') {
          completedJobs++;
        }

        log.info('Processed article notification job batch', {
          jobId: snapshot.id,
          articleId: snapshot.articleId,
          source: snapshot.source,
          kind: snapshot.kind,
          status: snapshot.status,
          prepareSteps,
          deliverySteps,
          processedCount: snapshot.processedCount,
          pendingCount: snapshot.pendingCount,
          sentCount: snapshot.sentCount,
          failedCount: snapshot.failedCount,
        });
      } catch (error) {
        const errorMessage = normalizeSendError(error);
        log.error('Article notification job processing failed', {
          jobId: workingJob.id,
          articleId: workingJob.articleId,
          source: workingJob.source,
          kind: workingJob.kind,
          prepareSteps,
          deliverySteps,
          error: errorMessage,
        });

        try {
          const releasedJob = await releaseArticleNotificationJobLease(workingJob, {
            status: 'queued',
            lastError: errorMessage,
          });
          const snapshot = await hydrateArticleNotificationJob(releasedJob);
          snapshots.push(snapshot);
          await syncArticleNotificationCampaignFromJob(snapshot);
        } catch (releaseError) {
          log.error('Failed to release article notification job after processing error', {
            jobId: workingJob.id,
            articleId: workingJob.articleId,
            error: normalizeSendError(releaseError),
          });
        }
      }
    }

    const result = {
      processedJobs: inspectedJobs,
      advancedJobs,
      completedJobs,
      jobs: snapshots,
    };

    await persistArticleNotificationProcessorState(await buildArticleNotificationProcessorState({
      mode,
      lastHeartbeatAt: nowIso(),
      lastRunAt: nowIso(),
      lastSuccessAt: nowIso(),
      lastError: null,
      maxJobs,
      maxBatchesPerJob,
      processedJobs: result.processedJobs,
      advancedJobs: result.advancedJobs,
      completedJobs: result.completedJobs,
    }));

    return result;
  } catch (error) {
    const errorMessage = normalizeSendError(error);
    await persistArticleNotificationProcessorState(await buildArticleNotificationProcessorState({
      mode,
      lastHeartbeatAt: nowIso(),
      lastRunAt: nowIso(),
      lastSuccessAt: previousProcessorState?.lastSuccessAt ?? null,
      lastError: errorMessage,
      maxJobs,
      maxBatchesPerJob,
      processedJobs: 0,
      advancedJobs: 0,
      completedJobs: 0,
    }));
    throw error;
  }
}

function extractFirstName(email: string): string {
  const local = email.split('@')[0] || 'Subscriber';
  const cleaned = local
    .replace(/[._-]/g, ' ')
    .replace(/\d+/g, '')
    .trim();

  if (!cleaned) return 'Subscriber';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).split(' ')[0];
}
