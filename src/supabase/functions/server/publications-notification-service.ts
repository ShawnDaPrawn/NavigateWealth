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

const log = createModuleLogger('article-notifications');

const NEWSLETTER_PREFIX = 'newsletter:';
const NEWSLETTER_GROUP_KEY = 'communication:groups:sys_newsletter_contacts';
const ARTICLE_NOTIFICATION_JOB_PREFIX = 'article_notification_job:';
const ARTICLE_NOTIFICATION_ACTIVE_PREFIX = 'article_notification_job_active:';
const ARTICLE_NOTIFICATION_CAMPAIGN_PREFIX = 'article_notification_campaign:';
const DELIVERY_BATCH_SIZE = 10;
const MAX_SEND_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [750, 1500];
const RETRYABLE_REQUEUE_DELAY_MS = 30_000;
const JOB_LOCK_TTL_MS = 120_000;
const JOB_LOCK_SETTLE_MS = 80;

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

export interface ArticleNotificationJobItem {
  email: string;
  firstName: string;
  name: string;
  trackingToken: string;
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
  items: ArticleNotificationJobItem[];
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
  lockId: string | null;
  lockExpiresAt: string | null;
}

export interface ArticleNotificationJobSnapshot extends ArticleNotificationJob {
  sentCount: number;
  failedCount: number;
  failedRetryableCount: number;
  failedTerminalCount: number;
  pendingCount: number;
  sendingCount: number;
  processedCount: number;
  progressPercent: number;
}

export interface ArticleNotificationCampaign {
  id: string;
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  articleExcerpt: string;
  source: ArticleEmailTrackingSource;
  status: ArticleNotificationCampaignStatus;
  intendedRecipientCount: number;
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
}

export interface ArticleNotificationProcessorResult {
  processedJobs: number;
  advancedJobs: number;
  completedJobs: number;
  jobs: ArticleNotificationJobSnapshot[];
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

async function getArticleNotificationJobRecord(jobId: string): Promise<ArticleNotificationJob | null> {
  if (!jobId) return null;
  return (await kv.get(notificationJobKey(jobId))) as ArticleNotificationJob | null;
}

async function persistArticleNotificationJob(job: ArticleNotificationJob): Promise<void> {
  await kv.set(notificationJobKey(job.id), job);
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
    intendedRecipientCount: snapshot.recipientCount,
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
    lastActivityAt: snapshot.updatedAt,
    lastError: snapshot.lastError,
    jobId: snapshot.id,
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
    .map((item) => recordByToken.get(item.trackingToken) ?? null)
    .filter((record): record is ArticleEmailTrackingRecord => Boolean(record));
}

async function hydrateArticleNotificationJob(job: ArticleNotificationJob): Promise<ArticleNotificationJobSnapshot> {
  const articleRecords = await listArticleEmailTrackingRecords(job.articleId);
  const trackingRecords = mapJobTrackingRecords(job, articleRecords);
  const missingRecordCount = Math.max(job.recipientCount - trackingRecords.length, 0);

  const totals = summarizeTrackedRecipientDeliveries(trackingRecords);
  const failedTerminalCount = totals.failedTerminal + missingRecordCount;
  const processedCount = totals.sent + failedTerminalCount;
  const pendingCount = totals.pending;
  const progressPercent = job.recipientCount > 0
    ? Math.round((processedCount / job.recipientCount) * 1000) / 10
    : 100;

  return {
    ...job,
    currentIndex: Math.min(processedCount, job.recipientCount),
    sentCount: totals.sent,
    failedCount: totals.failedRetryable + failedTerminalCount,
    failedRetryableCount: totals.failedRetryable,
    failedTerminalCount,
    pendingCount,
    sendingCount: totals.sending,
    processedCount,
    progressPercent,
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
    ...job,
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
    ...job,
    items: nextItems,
    recipientCount: nextItems.length,
    currentIndex: Math.min(resolvedCount, nextItems.length),
    updatedAt: nowIso(),
    completedAt: null,
  };

  await persistArticleNotificationJob(syncedJob);
  const snapshot = await hydrateArticleNotificationJob(syncedJob);
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
      const unsubscribeUrl = `https://navigatewealth.co/newsletter/unsubscribe?email=${encodeURIComponent(record.recipientEmail)}`;
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

async function collectArticleNotificationRecipients(
  recipientEmails?: string[],
): Promise<ArticleNotificationRecipient[]> {
  const requestedEmails = recipientEmails?.length
    ? new Set(recipientEmails.map((email) => email.trim().toLowerCase()))
    : null;

  const recipientMap = new Map<string, ArticleNotificationRecipient>();

  try {
    const allSubs = await kv.getByPrefix(NEWSLETTER_PREFIX) as NewsletterSubscription[];
    for (const sub of allSubs) {
      if (!sub.confirmed || sub.active === false || !sub.email) continue;

      const email = sub.email.toLowerCase();
      if (requestedEmails && !requestedEmails.has(email)) continue;
      if (!recipientMap.has(email)) {
        const firstName = sub.name || extractFirstName(email);
        recipientMap.set(email, {
          email,
          firstName,
          name: sub.name || firstName,
        });
      }
    }
    log.info(`Collected ${recipientMap.size} recipient(s) from newsletter KV`);
  } catch (err) {
    log.error('Failed to fetch newsletter KV entries (non-blocking)', err);
  }

  try {
    const group = await kv.get(NEWSLETTER_GROUP_KEY) as NewsletterGroup | null;
    if (group?.externalContacts?.length) {
      for (const contact of group.externalContacts) {
        const email = contact.email.toLowerCase();
        if (requestedEmails && !requestedEmails.has(email)) continue;
        if (!recipientMap.has(email)) {
          const firstName = contact.name || extractFirstName(email);
          recipientMap.set(email, {
            email,
            firstName,
            name: contact.name || firstName,
          });
        }
      }
      log.info(`Added ${group.externalContacts.length} external contact(s) from Newsletter group`);
    }
  } catch (err) {
    log.error('Failed to fetch Newsletter Contacts group (non-blocking)', err);
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
    const records = await createArticleEmailTrackingRecords(
      recipients.map((recipient) => ({
        article,
        recipient,
        source,
        jobId,
      })),
    );

    jobItems = records.map((record) => ({
      email: record.recipientEmail,
      firstName: record.recipientFirstName,
      name: record.recipientName,
      trackingToken: record.token,
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
    items: jobItems,
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    completedAt: jobItems.length > 0 ? null : createdAt,
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
  const snapshot = await hydrateArticleNotificationJob(job);
  const completedJob: ArticleNotificationJob = {
    ...job,
    status: snapshot.failedTerminalCount > 0 ? 'completed_with_failures' : 'completed',
    completedAt: nowIso(),
    updatedAt: nowIso(),
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

export async function getArticleNotificationCampaign(
  campaignId: string,
): Promise<ArticleNotificationCampaign | null> {
  return getArticleNotificationCampaignRecord(campaignId);
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
  return campaigns[0] ?? null;
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
    intendedRecipientCount: 0,
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

export async function processArticleNotificationJobs(options?: {
  jobId?: string;
  maxJobs?: number;
  maxBatchesPerJob?: number;
}): Promise<ArticleNotificationProcessorResult> {
  const maxJobs = Math.max(1, Math.min(options?.maxJobs ?? 1, 5));
  const maxBatchesPerJob = Math.max(1, Math.min(options?.maxBatchesPerJob ?? 1, 5));
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

    let workingJob = leasedJob;
    let batchSteps = 0;
    let didAdvanceJob = false;

    while (batchSteps < maxBatchesPerJob) {
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

      const refreshedSnapshot = await hydrateArticleNotificationJob(workingJob);

      workingJob = {
        ...workingJob,
        currentIndex: refreshedSnapshot.currentIndex,
        updatedAt: nowIso(),
        lastError: errors[0] ?? workingJob.lastError,
        status: 'processing',
      };

      await persistArticleNotificationJob(workingJob);
      batchSteps++;
      didAdvanceJob = true;

      if (refreshedSnapshot.pendingCount === 0 && refreshedSnapshot.sendingCount === 0) {
        break;
      }
    }

    const refreshedSnapshot = await hydrateArticleNotificationJob(workingJob);
    const snapshot = refreshedSnapshot.pendingCount === 0 && refreshedSnapshot.sendingCount === 0
      ? await finalizeArticleNotificationJob(workingJob)
      : await (async () => {
        const releasableJob: ArticleNotificationJob = {
          ...workingJob,
          currentIndex: refreshedSnapshot.currentIndex,
          lockId: null,
          lockExpiresAt: null,
          updatedAt: nowIso(),
        };

        await persistArticleNotificationJob(releasableJob);
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
      batchSteps,
      processedCount: snapshot.processedCount,
      pendingCount: snapshot.pendingCount,
      sentCount: snapshot.sentCount,
      failedCount: snapshot.failedCount,
    });
  }

  return {
    processedJobs: inspectedJobs,
    advancedJobs,
    completedJobs,
    jobs: snapshots,
  };
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
