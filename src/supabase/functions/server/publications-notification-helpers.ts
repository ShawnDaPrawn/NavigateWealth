/**
 * Article notification delivery: resolving published articles, delivering
 * tracked records, queueing and finalizing jobs, and campaign sync from
 * tracking state. The constants/utilities/record layer lives in
 * publications-notification-state.ts and the job lifecycle in
 * publications-notification-jobs.ts — both re-exported here so the
 * recipients and service modules keep their import surface.
 */
import * as kv from './kv_store.tsx';
import { sendEmail } from './email-service.ts';
import { createArticleNotificationEmail } from './article-notification-template.ts';
import { createModuleLogger } from './stderr-logger.ts';
import {
  buildTrackedArticleUrl,
  createArticleEmailTrackingRecord,
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
  ArticleNotificationJobPhase,
  ArticleNotificationJobSnapshot,
  ArticleNotificationRecipient,
  ArticleNotificationRunResult,
  DeliveryFailureClassification,
  PublishedArticle,
  QueueArticleNotificationOptions,
} from './publications-notification-types.ts';

export * from './publications-notification-state.ts';
export * from './publications-notification-jobs.ts';

import {
  MAX_SEND_ATTEMPTS,
  RETRY_DELAYS_MS,
  sleep,
  nowIso,
  activeNotificationJobKey,
  classifyDeliveryFailure,
  isSenderConfigurationFailure,
  normalizeSendError,
  getArticleNotificationCampaignRecord,
  persistArticleNotificationCampaign,
  isReadyToAttemptTrackingRecord,
  withArticleNotificationJobDefaults,
  persistArticleNotificationJob,
} from './publications-notification-state.ts';
import {
  getActiveArticleNotificationJob,
  hydrateArticleNotificationJob,
  mapJobTrackingRecords,
  removeActiveJobPointer,
  syncArticleNotificationCampaignFromJob,
  syncRetryJobRecipients,
} from './publications-notification-jobs.ts';

const log = createModuleLogger('article-notifications');

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
      // Our identity, credentials, account standing or quota. Retrying cannot
      // clear it and it will fail identically for every remaining recipient,
      // so stop the ladder here. Stays retryable, never terminal: the address
      // is fine and must survive to be sent once the cause is fixed.
      if (isSenderConfigurationFailure(error)) {
        lastFailure = { message: normalizeSendError(error), disposition: 'retryable' };
        break;
      }
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
