import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('publications-email-engagement');

const ARTICLE_EMAIL_TRACKING_PREFIX = 'article_email_tracking:';
const ARTICLE_EMAIL_TOKEN_PREFIX = 'article_email_token:';
const ARTICLE_EMAIL_PUBLISH_RECIPIENT_PREFIX = 'article_email_publish_recipient:';
const WEBSITE_BASE_URL = 'https://navigatewealth.co';
const TRACKING_RECORD_PERSIST_BATCH_SIZE = 25;

export type ArticleEmailTrackingSource = 'publish' | 'reshare';
export type ArticleEmailDeliveryStatus = 'pending' | 'sent' | 'failed';

export interface ArticleEmailTrackingRecord {
  token: string;
  articleId: string;
  articleSlug: string;
  articleTitle: string;
  recipientEmail: string;
  recipientName: string;
  recipientFirstName: string;
  source: ArticleEmailTrackingSource;
  createdAt: string;
  sentAt: string | null;
  openedAt: string | null;
  readAt: string | null;
  lastOpenedAt: string | null;
  lastReadAt: string | null;
  openCount: number;
  readCount: number;
  deliveryStatus: ArticleEmailDeliveryStatus;
  deliveryError: string | null;
  jobId?: string | null;
}

export interface ArticleEmailEngagementSummary {
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  publishedAt: string | null;
  pending: number;
  sent: number;
  failed: number;
  undelivered: number;
  publishPending: number;
  publishFailed: number;
  publishUndelivered: number;
  resharePending: number;
  reshareFailed: number;
  reshareUndelivered: number;
  opened: number;
  read: number;
  openRate: number;
  readRate: number;
  latestSentAt: string | null;
  latestOpenedAt: string | null;
  latestReadAt: string | null;
}

interface TrackingArticleDetails {
  id: string;
  slug: string;
  title: string;
  published_at?: string;
}

interface CreateTrackingRecordInput {
  article: TrackingArticleDetails;
  recipient: {
    email: string;
    firstName: string;
    name: string;
  };
  source?: ArticleEmailTrackingSource;
  jobId?: string | null;
}

function articleTrackingKey(articleId: string, token: string): string {
  return `${ARTICLE_EMAIL_TRACKING_PREFIX}${articleId}:${token}`;
}

function tokenTrackingKey(token: string): string {
  return `${ARTICLE_EMAIL_TOKEN_PREFIX}${token}`;
}

function publishRecipientTrackingKey(articleId: string, recipientEmail: string): string {
  return `${ARTICLE_EMAIL_PUBLISH_RECIPIENT_PREFIX}${articleId}:${recipientEmail.trim().toLowerCase()}`;
}

async function persistTrackingRecord(record: ArticleEmailTrackingRecord): Promise<void> {
  const keys = [
    articleTrackingKey(record.articleId, record.token),
    tokenTrackingKey(record.token),
  ];
  const values = [record, record];

  if (record.source === 'publish') {
    keys.push(publishRecipientTrackingKey(record.articleId, record.recipientEmail));
    values.push(record);
  }

  await kv.mset(keys, values);
}

async function persistTrackingRecords(records: ArticleEmailTrackingRecord[]): Promise<void> {
  if (records.length === 0) return;

  for (let index = 0; index < records.length; index += TRACKING_RECORD_PERSIST_BATCH_SIZE) {
    const batch = records.slice(index, index + TRACKING_RECORD_PERSIST_BATCH_SIZE);
    const keys: string[] = [];
    const values: ArticleEmailTrackingRecord[] = [];

    for (const record of batch) {
      keys.push(articleTrackingKey(record.articleId, record.token));
      values.push(record);
      keys.push(tokenTrackingKey(record.token));
      values.push(record);

      if (record.source === 'publish') {
        keys.push(publishRecipientTrackingKey(record.articleId, record.recipientEmail));
        values.push(record);
      }
    }

    await kv.mset(keys, values);
  }
}

function toIsoNow(): string {
  return new Date().toISOString();
}

function roundRate(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function latestDate(values: Array<string | null | undefined>): string | null {
  const filtered = values.filter((value): value is string => Boolean(value));
  if (filtered.length === 0) return null;

  return filtered.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}

export function buildTrackedArticleUrl(articleSlug: string, token: string): string {
  return `${WEBSITE_BASE_URL}/resources/article/${articleSlug}?nt=${encodeURIComponent(token)}`;
}

export async function createArticleEmailTrackingRecord(
  input: CreateTrackingRecordInput,
): Promise<ArticleEmailTrackingRecord> {
  const source = input.source ?? 'publish';
  const recipientEmail = input.recipient.email.trim().toLowerCase();

  if (source === 'publish') {
    const existing = await kv.get(
      publishRecipientTrackingKey(input.article.id, recipientEmail),
    ) as ArticleEmailTrackingRecord | null;

    if (existing) {
      const updatedExisting: ArticleEmailTrackingRecord = {
        ...existing,
        articleSlug: input.article.slug,
        articleTitle: input.article.title,
        recipientEmail,
        recipientName: input.recipient.name || input.recipient.firstName || input.recipient.email,
        recipientFirstName: input.recipient.firstName || 'Subscriber',
        jobId: input.jobId ?? existing.jobId ?? null,
      };

      await persistTrackingRecord(updatedExisting);
      return updatedExisting;
    }
  }

  const record: ArticleEmailTrackingRecord = {
    token: crypto.randomUUID(),
    articleId: input.article.id,
    articleSlug: input.article.slug,
    articleTitle: input.article.title,
    recipientEmail,
    recipientName: input.recipient.name || input.recipient.firstName || input.recipient.email,
    recipientFirstName: input.recipient.firstName || 'Subscriber',
    source,
    createdAt: toIsoNow(),
    sentAt: null,
    openedAt: null,
    readAt: null,
    lastOpenedAt: null,
    lastReadAt: null,
    openCount: 0,
    readCount: 0,
    deliveryStatus: 'pending',
    deliveryError: null,
    jobId: input.jobId ?? null,
  };

  await persistTrackingRecord(record);
  return record;
}

export async function createArticleEmailTrackingRecords(
  inputs: CreateTrackingRecordInput[],
): Promise<ArticleEmailTrackingRecord[]> {
  if (inputs.length === 0) return [];

  const existingPublishRecords = await Promise.all(
    inputs.map((input) => {
      const source = input.source ?? 'publish';
      if (source !== 'publish') return Promise.resolve(null);

      return kv.get(
        publishRecipientTrackingKey(input.article.id, input.recipient.email.trim().toLowerCase()),
      ) as Promise<ArticleEmailTrackingRecord | null>;
    }),
  );

  const records = inputs.map((input, index) => {
    const source = input.source ?? 'publish';
    const recipientEmail = input.recipient.email.trim().toLowerCase();
    const existing = source === 'publish' ? existingPublishRecords[index] : null;

    if (existing) {
      return {
        ...existing,
        articleSlug: input.article.slug,
        articleTitle: input.article.title,
        recipientEmail,
        recipientName: input.recipient.name || input.recipient.firstName || input.recipient.email,
        recipientFirstName: input.recipient.firstName || 'Subscriber',
        jobId: input.jobId ?? existing.jobId ?? null,
      } satisfies ArticleEmailTrackingRecord;
    }

    return {
      token: crypto.randomUUID(),
      articleId: input.article.id,
      articleSlug: input.article.slug,
      articleTitle: input.article.title,
      recipientEmail,
      recipientName: input.recipient.name || input.recipient.firstName || input.recipient.email,
      recipientFirstName: input.recipient.firstName || 'Subscriber',
      source,
      createdAt: toIsoNow(),
      sentAt: null,
      openedAt: null,
      readAt: null,
      lastOpenedAt: null,
      lastReadAt: null,
      openCount: 0,
      readCount: 0,
      deliveryStatus: 'pending',
      deliveryError: null,
      jobId: input.jobId ?? null,
    } satisfies ArticleEmailTrackingRecord;
  });

  await persistTrackingRecords(records);
  return records;
}

export async function getArticleEmailTrackingRecordByToken(
  token: string,
): Promise<ArticleEmailTrackingRecord | null> {
  if (!token) return null;
  return (await kv.get(tokenTrackingKey(token))) as ArticleEmailTrackingRecord | null;
}

export async function markArticleEmailDeliverySent(token: string): Promise<void> {
  const existing = await getArticleEmailTrackingRecordByToken(token);
  if (!existing) return;

  await persistTrackingRecord({
    ...existing,
    sentAt: existing.sentAt || toIsoNow(),
    deliveryStatus: 'sent',
    deliveryError: null,
  });
}

export async function markArticleEmailDeliveryFailed(token: string, errorMessage: string): Promise<void> {
  const existing = await getArticleEmailTrackingRecordByToken(token);
  if (!existing) return;

  await persistTrackingRecord({
    ...existing,
    deliveryStatus: 'failed',
    deliveryError: errorMessage || 'Delivery failed',
  });
}

export async function markArticleEmailOpened(token: string): Promise<ArticleEmailTrackingRecord | null> {
  const existing = await getArticleEmailTrackingRecordByToken(token);
  if (!existing) return null;

  const now = toIsoNow();
  const updated: ArticleEmailTrackingRecord = {
    ...existing,
    openedAt: existing.openedAt || now,
    lastOpenedAt: now,
    openCount: (existing.openCount || 0) + 1,
  };

  await persistTrackingRecord(updated);
  return updated;
}

export async function markArticleEmailRead(token: string): Promise<ArticleEmailTrackingRecord | null> {
  const existing = await getArticleEmailTrackingRecordByToken(token);
  if (!existing) return null;

  const now = toIsoNow();
  const updated: ArticleEmailTrackingRecord = {
    ...existing,
    openedAt: existing.openedAt || now,
    lastOpenedAt: existing.lastOpenedAt || now,
    openCount: existing.openCount > 0 ? existing.openCount : 1,
    readAt: existing.readAt || now,
    lastReadAt: now,
    readCount: (existing.readCount || 0) + 1,
  };

  await persistTrackingRecord(updated);
  return updated;
}

export async function listArticleEmailTrackingRecords(articleId: string): Promise<ArticleEmailTrackingRecord[]> {
  const records = await kv.getByPrefix(`${ARTICLE_EMAIL_TRACKING_PREFIX}${articleId}:`) as ArticleEmailTrackingRecord[];
  return records.sort((a, b) => {
    const aTime = new Date(a.lastReadAt || a.lastOpenedAt || a.sentAt || a.createdAt).getTime();
    const bTime = new Date(b.lastReadAt || b.lastOpenedAt || b.sentAt || b.createdAt).getTime();
    return bTime - aTime;
  });
}

export async function listAllArticleEmailTrackingRecords(): Promise<ArticleEmailTrackingRecord[]> {
  const records = await kv.getByPrefix(ARTICLE_EMAIL_TRACKING_PREFIX) as ArticleEmailTrackingRecord[];
  return records.sort((a, b) => {
    const aTime = new Date(a.sentAt || a.createdAt).getTime();
    const bTime = new Date(b.sentAt || b.createdAt).getTime();
    return bTime - aTime;
  });
}

export async function listUndeliveredArticleEmailTrackingRecords(
  articleId: string,
  source?: ArticleEmailTrackingSource,
): Promise<ArticleEmailTrackingRecord[]> {
  const records = await listArticleEmailTrackingRecords(articleId);
  return records.filter((record) => {
    if (source && record.source !== source) return false;
    return record.deliveryStatus !== 'sent';
  });
}

export function summarizeTrackedRecipientDeliveries(
  records: ArticleEmailTrackingRecord[],
  source?: ArticleEmailTrackingSource,
) {
  const filtered = source ? records.filter((record) => record.source === source) : records;
  const pending = filtered.filter((record) => record.deliveryStatus === 'pending').length;
  const sent = filtered.filter((record) => record.deliveryStatus === 'sent').length;
  const failed = filtered.filter((record) => record.deliveryStatus === 'failed').length;

  return {
    pending,
    sent,
    failed,
    undelivered: pending + failed,
  };
}

export function summarizeArticleEmailEngagement(
  article: TrackingArticleDetails | null,
  records: ArticleEmailTrackingRecord[],
): ArticleEmailEngagementSummary {
  const totals = summarizeTrackedRecipientDeliveries(records);
  const publishTotals = summarizeTrackedRecipientDeliveries(records, 'publish');
  const reshareTotals = summarizeTrackedRecipientDeliveries(records, 'reshare');
  const opened = records.filter((record) => Boolean(record.openedAt)).length;
  const read = records.filter((record) => Boolean(record.readAt)).length;

  return {
    articleId: article?.id || records[0]?.articleId || '',
    articleTitle: article?.title || records[0]?.articleTitle || 'Untitled article',
    articleSlug: article?.slug || records[0]?.articleSlug || '',
    publishedAt: article?.published_at || null,
    pending: totals.pending,
    sent: totals.sent,
    failed: totals.failed,
    undelivered: totals.undelivered,
    publishPending: publishTotals.pending,
    publishFailed: publishTotals.failed,
    publishUndelivered: publishTotals.undelivered,
    resharePending: reshareTotals.pending,
    reshareFailed: reshareTotals.failed,
    reshareUndelivered: reshareTotals.undelivered,
    opened,
    read,
    openRate: roundRate(opened, totals.sent),
    readRate: roundRate(read, totals.sent),
    latestSentAt: latestDate(records.map((record) => record.sentAt)),
    latestOpenedAt: latestDate(records.map((record) => record.lastOpenedAt || record.openedAt)),
    latestReadAt: latestDate(records.map((record) => record.lastReadAt || record.readAt)),
  };
}

export async function logArticleEmailEngagementError(message: string, error: unknown): Promise<void> {
  log.error(message, error);
}
