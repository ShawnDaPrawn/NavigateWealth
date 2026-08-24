/**
 * Constants, pure utilities, KV key builders, and record accessors for
 * article notification jobs. Moved verbatim from
 * publications-notification-helpers.ts, which re-exports them.
 */
import * as kv from './kv_store.tsx';
import {
  isArticleEmailDeliveryRetryableStatus,
  isArticleEmailDeliveryTerminalStatus,
  type ArticleEmailTrackingRecord,
  type ArticleEmailTrackingSource,
} from './publications-email-engagement-service.ts';
import type {
  ArticleNotificationCampaign,
  ArticleNotificationJob,
  ArticleNotificationJobItem,
  ArticleNotificationJobKind,
  ArticleNotificationJobPhase,
  ArticleNotificationProcessorState,
  DeliveryFailureClassification,
} from './publications-notification-types.ts';

export const NEWSLETTER_PREFIX = 'newsletter:';
export const NEWSLETTER_GROUP_KEY = 'communication:groups:sys_newsletter_contacts';
export const ARTICLE_NOTIFICATION_JOB_PREFIX = 'article_notification_job:';
export const ARTICLE_NOTIFICATION_ACTIVE_PREFIX = 'article_notification_job_active:';
export const ARTICLE_NOTIFICATION_CAMPAIGN_PREFIX = 'article_notification_campaign:';
export const ARTICLE_NOTIFICATION_PROCESSOR_STATE_KEY = 'article_notification_processor_state';
export const DELIVERY_BATCH_SIZE = 20;
export const TRACKING_PREPARE_BATCH_SIZE = 15;
export const MAX_SEND_ATTEMPTS = 3;
export const RETRY_DELAYS_MS = [750, 1500];
export const RETRYABLE_REQUEUE_DELAY_MS = 30_000;
export const JOB_LOCK_TTL_MS = 60_000;
export const JOB_LOCK_SETTLE_MS = 80;
export const PROFILE_LOOKUP_BATCH_SIZE = 100;
export const LEGACY_SUBSCRIPTION_PAGE_SIZE = 100;
export const DEFAULT_MANUAL_MAX_JOBS = 2;
export const DEFAULT_MANUAL_MAX_BATCHES_PER_JOB = 3;
export const DEFAULT_AUTOMATED_MAX_JOBS = 5;
export const DEFAULT_AUTOMATED_MAX_BATCHES_PER_JOB = 4;
export const STUCK_JOB_THRESHOLD_MS = 180_000;

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

export function classifyDeliveryFailure(error: unknown): DeliveryFailureClassification {
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

export function isReadyToAttemptTrackingRecord(record: ArticleEmailTrackingRecord): boolean {
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

export function notificationJobKey(jobId: string): string {
  return `${ARTICLE_NOTIFICATION_JOB_PREFIX}${jobId}`;
}

export function notificationCampaignKey(campaignId: string): string {
  return `${ARTICLE_NOTIFICATION_CAMPAIGN_PREFIX}${campaignId}`;
}

export function activeNotificationJobKey(
  articleId: string,
  source: ArticleEmailTrackingSource,
  kind: ArticleNotificationJobKind,
): string {
  return `${ARTICLE_NOTIFICATION_ACTIVE_PREFIX}${articleId}:${source}:${kind}`;
}

export function jobItemFromTrackingRecord(
  record: ArticleEmailTrackingRecord,
): ArticleNotificationJobItem {
  return {
    email: record.recipientEmail,
    firstName: record.recipientFirstName,
    name: record.recipientName,
    trackingToken: record.token,
  };
}

export function clampInteger(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

export function inferPrepareCursorFromItems(
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

export function withArticleNotificationJobDefaults(
  job: ArticleNotificationJob,
): ArticleNotificationJob {
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

export function getJobLastProgressTimestamp(
  job: Pick<ArticleNotificationJob, 'lastProgressAt' | 'updatedAt' | 'createdAt'>,
): number | null {
  const candidate = job.lastProgressAt || job.updatedAt || job.createdAt;
  const timestamp = candidate ? new Date(candidate).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getJobPhase(
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

export function isArticleNotificationJobStuck(
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
