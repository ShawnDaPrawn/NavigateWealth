import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { SITE_ORIGIN } from '../../../utils/siteOrigin.ts';

const log = createModuleLogger('publications-email-engagement');

const ARTICLE_EMAIL_TRACKING_PREFIX = 'article_email_tracking:';
const ARTICLE_EMAIL_TOKEN_PREFIX = 'article_email_token:';
const ARTICLE_EMAIL_PUBLISH_RECIPIENT_PREFIX = 'article_email_publish_recipient:';

const WEBSITE_BASE_URL = SITE_ORIGIN;
// Each publish recipient currently fans out to three KV entries
// (article, token, and publish recipient lookup). Large bulk upserts were
// timing out in production during article publish, so keep batches small.
const TRACKING_RECORD_PERSIST_BATCH_SIZE = 5;
const TRACKING_RECORD_LOOKUP_BATCH_SIZE = 100;
const TRACKING_RECORD_LIST_PAGE_SIZE = 100;

export type ArticleEmailTrackingSource = 'publish' | 'reshare';
export type ArticleEmailDeliveryStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'failed_retryable'
  | 'failed_terminal';

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
  attemptCount?: number;
  lastAttemptedAt?: string | null;
  providerMessageId?: string | null;
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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function listTrackingRecordsByPrefix(prefix: string): Promise<ArticleEmailTrackingRecord[]> {
  const records: ArticleEmailTrackingRecord[] = [];
  let startAfter: string | undefined;

  while (true) {
    const rows = await kv.listByPrefix(prefix, {
      startAfter,
      limit: TRACKING_RECORD_LIST_PAGE_SIZE,
    }) as Array<{ key: string; value: ArticleEmailTrackingRecord | null | undefined }>;

    if (rows.length === 0) {
      return records;
    }

    for (const row of rows) {
      if (row.value) {
        records.push(withTrackingDefaults(row.value));
      }
    }

    if (rows.length < TRACKING_RECORD_LIST_PAGE_SIZE) {
      return records;
    }

    startAfter = rows[rows.length - 1]?.key;
  }
}

async function persistTrackingRecord(record: ArticleEmailTrackingRecord): Promise<void> {
  const normalizedRecord = withTrackingDefaults(record);
  const keys = [
    articleTrackingKey(normalizedRecord.articleId, normalizedRecord.token),
    tokenTrackingKey(normalizedRecord.token),
  ];
  const values = [normalizedRecord, normalizedRecord];

  if (normalizedRecord.source === 'publish') {
    keys.push(publishRecipientTrackingKey(normalizedRecord.articleId, normalizedRecord.recipientEmail));
    values.push(normalizedRecord);
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
      const normalizedRecord = withTrackingDefaults(record);
      keys.push(articleTrackingKey(normalizedRecord.articleId, normalizedRecord.token));
      values.push(normalizedRecord);
      keys.push(tokenTrackingKey(normalizedRecord.token));
      values.push(normalizedRecord);

      if (normalizedRecord.source === 'publish') {
        keys.push(publishRecipientTrackingKey(normalizedRecord.articleId, normalizedRecord.recipientEmail));
        values.push(normalizedRecord);
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

function normalizeDeliveryStatus(status: ArticleEmailDeliveryStatus | null | undefined): ArticleEmailDeliveryStatus {
  switch (status) {
    case 'pending':
    case 'sending':
    case 'sent':
    case 'failed_retryable':
    case 'failed_terminal':
      return status;
    case 'failed':
    default:
      return 'failed_retryable';
  }
}

function withTrackingDefaults(record: ArticleEmailTrackingRecord): ArticleEmailTrackingRecord {
  return {
    ...record,
    deliveryStatus: normalizeDeliveryStatus(record.deliveryStatus),
    attemptCount: typeof record.attemptCount === 'number' && Number.isFinite(record.attemptCount)
      ? record.attemptCount
      : 0,
    lastAttemptedAt: record.lastAttemptedAt ?? null,
    providerMessageId: record.providerMessageId ?? null,
  };
}

export function isArticleEmailDeliveryTerminalStatus(
  status: ArticleEmailDeliveryStatus | null | undefined,
): boolean {
  const normalized = normalizeDeliveryStatus(status);
  return normalized === 'sent' || normalized === 'failed_terminal';
}

export function isArticleEmailDeliveryRetryableStatus(
  status: ArticleEmailDeliveryStatus | null | undefined,
): boolean {
  const normalized = normalizeDeliveryStatus(status);
  return normalized === 'pending' || normalized === 'sending' || normalized === 'failed_retryable';
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

      const normalizedExisting = withTrackingDefaults(updatedExisting);
      await persistTrackingRecord(normalizedExisting);
      return normalizedExisting;
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
    attemptCount: 0,
    lastAttemptedAt: null,
    providerMessageId: null,
    jobId: input.jobId ?? null,
  };

  await persistTrackingRecord(record);
  return record;
}

export async function createArticleEmailTrackingRecords(
  inputs: CreateTrackingRecordInput[],
): Promise<ArticleEmailTrackingRecord[]> {
  if (inputs.length === 0) return [];

  const existingPublishRecords = new Array<ArticleEmailTrackingRecord | null>(inputs.length).fill(null);
  const publishLookups = inputs
    .map((input, index) => {
      const source = input.source ?? 'publish';
      if (source !== 'publish') return null;

      return {
        index,
        key: publishRecipientTrackingKey(input.article.id, input.recipient.email.trim().toLowerCase()),
      };
    })
    .filter((lookup): lookup is { index: number; key: string } => Boolean(lookup));

  for (const batch of chunkArray(publishLookups, TRACKING_RECORD_LOOKUP_BATCH_SIZE)) {
    const batchResults = await kv.mget(batch.map((lookup) => lookup.key)) as Array<ArticleEmailTrackingRecord | null | undefined>;
    batch.forEach((lookup, batchIndex) => {
      existingPublishRecords[lookup.index] = batchResults[batchIndex] ?? null;
    });
  }

  const records = inputs.map((input, index) => {
    const source = input.source ?? 'publish';
    const recipientEmail = input.recipient.email.trim().toLowerCase();
    const existing = source === 'publish' ? existingPublishRecords[index] : null;

    if (existing) {
      return withTrackingDefaults({
        ...existing,
        articleSlug: input.article.slug,
        articleTitle: input.article.title,
        recipientEmail,
        recipientName: input.recipient.name || input.recipient.firstName || input.recipient.email,
        recipientFirstName: input.recipient.firstName || 'Subscriber',
        jobId: input.jobId ?? existing.jobId ?? null,
      } satisfies ArticleEmailTrackingRecord);
    }

    return withTrackingDefaults({
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
      attemptCount: 0,
      lastAttemptedAt: null,
      providerMessageId: null,
      jobId: input.jobId ?? null,
    } satisfies ArticleEmailTrackingRecord);
  });

  await persistTrackingRecords(records);
  return records;
}

export async function getArticleEmailTrackingRecordByToken(
  token: string,
): Promise<ArticleEmailTrackingRecord | null> {
  if (!token) return null;
  const record = (await kv.get(tokenTrackingKey(token))) as ArticleEmailTrackingRecord | null;
  return record ? withTrackingDefaults(record) : null;
}

export async function markArticleEmailDeliveryAttemptStarted(
  token: string,
): Promise<ArticleEmailTrackingRecord | null> {
  const existing = await getArticleEmailTrackingRecordByToken(token);
  if (!existing) return null;

  const normalizedStatus = normalizeDeliveryStatus(existing.deliveryStatus);
  if (normalizedStatus === 'sent' || normalizedStatus === 'failed_terminal') {
    return existing;
  }

  const updated = withTrackingDefaults({
    ...existing,
    deliveryStatus: 'sending',
    deliveryError: null,
    attemptCount: (existing.attemptCount || 0) + 1,
    lastAttemptedAt: toIsoNow(),
  });

  await persistTrackingRecord(updated);
  return updated;
}

export async function markArticleEmailDeliverySent(
  token: string,
  options?: {
    providerMessageId?: string | null;
  },
): Promise<void> {
  const existing = await getArticleEmailTrackingRecordByToken(token);
  if (!existing) return;

  await persistTrackingRecord({
    ...existing,
    sentAt: existing.sentAt || toIsoNow(),
    deliveryStatus: 'sent',
    deliveryError: null,
    providerMessageId: options?.providerMessageId ?? existing.providerMessageId ?? null,
  });
}

export async function markArticleEmailDeliveryFailed(
  token: string,
  errorMessage: string,
  status: 'failed_retryable' | 'failed_terminal' = 'failed_retryable',
): Promise<void> {
  const existing = await getArticleEmailTrackingRecordByToken(token);
  if (!existing) return;

  await persistTrackingRecord({
    ...existing,
    deliveryStatus: status,
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
  const records = await listTrackingRecordsByPrefix(`${ARTICLE_EMAIL_TRACKING_PREFIX}${articleId}:`);
  return records.sort((a, b) => {
    const aTime = new Date(a.lastReadAt || a.lastOpenedAt || a.sentAt || a.createdAt).getTime();
    const bTime = new Date(b.lastReadAt || b.lastOpenedAt || b.sentAt || b.createdAt).getTime();
    return bTime - aTime;
  });
}

export async function listAllArticleEmailTrackingRecords(): Promise<ArticleEmailTrackingRecord[]> {
  const records = await listTrackingRecordsByPrefix(ARTICLE_EMAIL_TRACKING_PREFIX);
  return records.sort((a, b) => {
    const aTime = new Date(a.sentAt || a.createdAt).getTime();
    const bTime = new Date(b.sentAt || b.createdAt).getTime();
    return bTime - aTime;
  });
}

/**
 * Discover article IDs that have tracking rows by scanning KV keys only (no
 * value payloads). Used for engagement summaries so we do not load every
 * tracking record in one request (which can hang or time out at scale).
 */
export async function listArticleIdsFromEmailTrackingKeyScan(): Promise<string[]> {
  const ids = new Set<string>();
  let startAfter: string | undefined;

  while (true) {
    const rows = await kv.listByPrefix(ARTICLE_EMAIL_TRACKING_PREFIX, {
      startAfter,
      limit: 500,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      const key = row.key;
      if (!key.startsWith(ARTICLE_EMAIL_TRACKING_PREFIX)) continue;
      const rest = key.slice(ARTICLE_EMAIL_TRACKING_PREFIX.length);
      const articleId = rest.split(':')[0];
      if (articleId) ids.add(articleId);
    }

    startAfter = rows[rows.length - 1]?.key;
    if (rows.length < 500) break;
  }

  return [...ids];
}

export async function listUndeliveredArticleEmailTrackingRecords(
  articleId: string,
  source?: ArticleEmailTrackingSource,
): Promise<ArticleEmailTrackingRecord[]> {
  const records = await listArticleEmailTrackingRecords(articleId);
  return records.filter((record) => {
    if (source && record.source !== source) return false;
    return !isArticleEmailDeliveryTerminalStatus(record.deliveryStatus);
  });
}

export function summarizeTrackedRecipientDeliveries(
  records: ArticleEmailTrackingRecord[],
  source?: ArticleEmailTrackingSource,
) {
  const filtered = source ? records.filter((record) => record.source === source) : records;
  const pendingOnly = filtered.filter((record) => normalizeDeliveryStatus(record.deliveryStatus) === 'pending').length;
  const sending = filtered.filter((record) => normalizeDeliveryStatus(record.deliveryStatus) === 'sending').length;
  const sent = filtered.filter((record) => normalizeDeliveryStatus(record.deliveryStatus) === 'sent').length;
  const failedRetryable = filtered.filter((record) => normalizeDeliveryStatus(record.deliveryStatus) === 'failed_retryable').length;
  const failedTerminal = filtered.filter((record) => normalizeDeliveryStatus(record.deliveryStatus) === 'failed_terminal').length;
  const pending = pendingOnly + sending + failedRetryable;

  return {
    pending,
    sending,
    sent,
    failed: failedTerminal,
    failedRetryable,
    failedTerminal,
    undelivered: pending,
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
