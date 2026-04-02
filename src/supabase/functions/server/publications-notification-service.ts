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
  getArticleEmailTrackingRecordByToken,
  listArticleEmailTrackingRecords,
  listUndeliveredArticleEmailTrackingRecords,
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
const DELIVERY_BATCH_SIZE = 10;
const MAX_SEND_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [750, 1500];
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
  pendingCount: number;
  processedCount: number;
  progressPercent: number;
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

function notificationJobKey(jobId: string): string {
  return `${ARTICLE_NOTIFICATION_JOB_PREFIX}${jobId}`;
}

function activeNotificationJobKey(
  articleId: string,
  source: ArticleEmailTrackingSource,
  kind: ArticleNotificationJobKind,
): string {
  return `${ARTICLE_NOTIFICATION_ACTIVE_PREFIX}${articleId}:${source}:${kind}`;
}

async function getArticleNotificationJobRecord(jobId: string): Promise<ArticleNotificationJob | null> {
  if (!jobId) return null;
  return (await kv.get(notificationJobKey(jobId))) as ArticleNotificationJob | null;
}

async function persistArticleNotificationJob(job: ArticleNotificationJob): Promise<void> {
  await kv.set(notificationJobKey(job.id), job);
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

async function hydrateArticleNotificationJob(job: ArticleNotificationJob): Promise<ArticleNotificationJobSnapshot> {
  const trackingRecords = (await listArticleEmailTrackingRecords(job.articleId)).filter((record) =>
    job.items.some((item) => item.trackingToken === record.token),
  );

  const totals = summarizeTrackedRecipientDeliveries(trackingRecords);
  const startedCount = Math.min(job.currentIndex, job.recipientCount);
  const notStartedCount = Math.max(job.recipientCount - startedCount, 0);
  const processedCount = totals.sent + totals.failed;
  const pendingCount = totals.pending + notStartedCount;
  const progressPercent = job.recipientCount > 0
    ? Math.round((processedCount / job.recipientCount) * 1000) / 10
    : 100;

  return {
    ...job,
    sentCount: totals.sent,
    failedCount: totals.failed,
    pendingCount,
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

async function deliverTrackedNotificationRecord(
  article: PublishedArticle,
  record: ArticleEmailTrackingRecord,
): Promise<void> {
  let lastError = 'Delivery failed';

  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
    try {
      const articleUrl = buildTrackedArticleUrl(article.slug, record.token);
      const unsubscribeUrl = `https://navigatewealth.co/newsletter/unsubscribe?email=${encodeURIComponent(record.recipientEmail)}`;
      const { html, text } = await createArticleNotificationEmail({
        firstName: record.recipientFirstName,
        articleTitle: article.title,
        articleExcerpt: article.excerpt || 'A new article has been published on Navigate Wealth.',
        articleUrl,
        unsubscribeUrl,
      });

      const delivered = await sendEmail({
        to: record.recipientEmail,
        subject: `New article: ${article.title}`,
        html,
        text,
      });

      if (!delivered) {
        throw new Error('SendGrid delivery failed');
      }

      await markArticleEmailDeliverySent(record.token);
      return;
    } catch (error) {
      lastError = normalizeSendError(error);
      const hasRetryRemaining = attempt < MAX_SEND_ATTEMPTS;

      if (hasRetryRemaining) {
        const delayMs = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)] ?? 1000;
        log.warn(`Retrying article notification delivery for ${record.recipientEmail}`, {
          articleId: article.id,
          attempt,
          nextDelayMs: delayMs,
          error: lastError,
        });
        await sleep(delayMs);
        continue;
      }
    }
  }

  await markArticleEmailDeliveryFailed(record.token, lastError);
  throw new Error(lastError);
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

async function queueArticleNotificationJob(
  article: PublishedArticle,
  items: ArticleNotificationRecipient[] | ArticleEmailTrackingRecord[],
  options: QueueArticleNotificationOptions,
): Promise<ArticleNotificationJobSnapshot> {
  const source = options.source ?? 'publish';
  const existingActiveJob = await getActiveArticleNotificationJob(article.id, source, options.kind);
  if (existingActiveJob) {
    return hydrateArticleNotificationJob(existingActiveJob);
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

  return hydrateArticleNotificationJob(job);
}

async function finalizeArticleNotificationJob(
  job: ArticleNotificationJob,
): Promise<ArticleNotificationJobSnapshot> {
  const snapshot = await hydrateArticleNotificationJob(job);
  const completedJob: ArticleNotificationJob = {
    ...job,
    status: snapshot.failedCount > 0 ? 'completed_with_failures' : 'completed',
    completedAt: nowIso(),
    updatedAt: nowIso(),
    lockId: null,
    lockExpiresAt: null,
  };

  await persistArticleNotificationJob(completedJob);
  await removeActiveJobPointer(completedJob);

  return hydrateArticleNotificationJob(completedJob);
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

export async function getArticleNotificationJob(
  jobId: string,
): Promise<ArticleNotificationJobSnapshot | null> {
  const job = await getArticleNotificationJobRecord(jobId);
  if (!job) return null;
  return hydrateArticleNotificationJob(job);
}

export async function processArticleNotificationJobs(options?: {
  jobId?: string;
  maxJobs?: number;
}): Promise<ArticleNotificationProcessorResult> {
  const maxJobs = Math.max(1, Math.min(options?.maxJobs ?? 1, 5));
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
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, maxJobs);

    jobsToProcess.push(...queuedJobs);
  }

  const snapshots: ArticleNotificationJobSnapshot[] = [];
  let advancedJobs = 0;
  let completedJobs = 0;

  for (const job of jobsToProcess) {
    const leasedJob = await acquireArticleNotificationJobLease(job);
    if (!leasedJob) continue;

    if (leasedJob.currentIndex >= leasedJob.items.length) {
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

    const batch = leasedJob.items.slice(
      leasedJob.currentIndex,
      leasedJob.currentIndex + DELIVERY_BATCH_SIZE,
    );

    const batchResults = await Promise.allSettled(
      batch.map(async (item) => {
        const tracking = await getArticleEmailTrackingRecordByToken(item.trackingToken);
        if (!tracking) {
          throw new Error(`Tracking record missing for ${item.email}`);
        }

        if (tracking.deliveryStatus === 'sent') {
          return { email: item.email, skipped: true };
        }

        await deliverTrackedNotificationRecord(article, tracking);
        return { email: item.email, skipped: false };
      }),
    );

    const errors = batchResults
      .map((result, index) => {
        if (result.status === 'fulfilled') return null;
        return `${batch[index]?.email || 'unknown'}: ${normalizeSendError(result.reason)}`;
      })
      .filter((value): value is string => Boolean(value));

    const updatedJob: ArticleNotificationJob = {
      ...leasedJob,
      currentIndex: leasedJob.currentIndex + batch.length,
      updatedAt: nowIso(),
      lastError: errors[0] ?? leasedJob.lastError,
      lockId: null,
      lockExpiresAt: null,
    };

    await persistArticleNotificationJob(updatedJob);

    const snapshot = updatedJob.currentIndex >= updatedJob.items.length
      ? await finalizeArticleNotificationJob(updatedJob)
      : await hydrateArticleNotificationJob(updatedJob);

    snapshots.push(snapshot);
    advancedJobs++;

    if (snapshot.status === 'completed' || snapshot.status === 'completed_with_failures') {
      completedJobs++;
    }

    log.info('Processed article notification job batch', {
      jobId: snapshot.id,
      articleId: snapshot.articleId,
      source: snapshot.source,
      kind: snapshot.kind,
      status: snapshot.status,
      processedCount: snapshot.processedCount,
      pendingCount: snapshot.pendingCount,
      sentCount: snapshot.sentCount,
      failedCount: snapshot.failedCount,
    });
  }

  return {
    processedJobs: jobsToProcess.length,
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
