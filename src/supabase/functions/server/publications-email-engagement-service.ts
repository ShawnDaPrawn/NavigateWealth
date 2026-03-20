import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('publications-email-engagement');

const ARTICLE_EMAIL_TRACKING_PREFIX = 'article_email_tracking:';
const ARTICLE_EMAIL_TOKEN_PREFIX = 'article_email_token:';
const WEBSITE_BASE_URL = 'https://navigatewealth.co';

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
}

export interface ArticleEmailEngagementSummary {
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  publishedAt: string | null;
  sent: number;
  failed: number;
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
}

function articleTrackingKey(articleId: string, token: string): string {
  return `${ARTICLE_EMAIL_TRACKING_PREFIX}${articleId}:${token}`;
}

function tokenTrackingKey(token: string): string {
  return `${ARTICLE_EMAIL_TOKEN_PREFIX}${token}`;
}

async function persistTrackingRecord(record: ArticleEmailTrackingRecord): Promise<void> {
  await kv.mset(
    [articleTrackingKey(record.articleId, record.token), tokenTrackingKey(record.token)],
    [record, record],
  );
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
  const record: ArticleEmailTrackingRecord = {
    token: crypto.randomUUID(),
    articleId: input.article.id,
    articleSlug: input.article.slug,
    articleTitle: input.article.title,
    recipientEmail: input.recipient.email.trim().toLowerCase(),
    recipientName: input.recipient.name || input.recipient.firstName || input.recipient.email,
    recipientFirstName: input.recipient.firstName || 'Subscriber',
    source: input.source ?? 'publish',
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
  };

  await persistTrackingRecord(record);
  return record;
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

export function summarizeArticleEmailEngagement(
  article: TrackingArticleDetails | null,
  records: ArticleEmailTrackingRecord[],
): ArticleEmailEngagementSummary {
  const sent = records.filter((record) => record.deliveryStatus === 'sent').length;
  const failed = records.filter((record) => record.deliveryStatus === 'failed').length;
  const opened = records.filter((record) => Boolean(record.openedAt)).length;
  const read = records.filter((record) => Boolean(record.readAt)).length;

  return {
    articleId: article?.id || records[0]?.articleId || '',
    articleTitle: article?.title || records[0]?.articleTitle || 'Untitled article',
    articleSlug: article?.slug || records[0]?.articleSlug || '',
    publishedAt: article?.published_at || null,
    sent,
    failed,
    opened,
    read,
    openRate: roundRate(opened, sent),
    readRate: roundRate(read, sent),
    latestSentAt: latestDate(records.map((record) => record.sentAt)),
    latestOpenedAt: latestDate(records.map((record) => record.lastOpenedAt || record.openedAt)),
    latestReadAt: latestDate(records.map((record) => record.lastReadAt || record.readAt)),
  };
}

export async function logArticleEmailEngagementError(message: string, error: unknown): Promise<void> {
  log.error(message, error);
}
