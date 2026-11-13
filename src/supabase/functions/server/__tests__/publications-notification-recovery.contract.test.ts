/**
 * Interrupted publish blast recovery — contract tests (GitHub #476)
 * =================================================================
 *
 * The publish route sends to the whole audience inside the request and only
 * queues a retry job for the leftovers AFTER that returns. When the Edge worker
 * is killed mid-blast (answering 546), recipients stay `pending` with no job
 * and nothing ever sends to them. `recoverInterruptedPublishBlasts` is the
 * cron-side net for that case.
 *
 * Nothing but the clock is mocked. Tracking records, jobs and the retry queue
 * all run for real against the in-memory KV.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../newsletter-group-service.ts', () => ({
  backfillLegacyNewsletterSubscribersToGroup: vi.fn(async () => undefined),
}));
vi.mock('../email-service.ts', () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
  getFooterSettings: vi.fn(async () => ({ companyName: 'Navigate Wealth' })),
  createEmailTemplate: (body: string) => body,
}));

import { kvStore } from './helpers/contract-harness.ts';
import {
  INTERRUPTED_BLAST_MAX_AGE_MS,
  INTERRUPTED_BLAST_MIN_AGE_MS,
  recoverInterruptedPublishBlasts,
} from '../publications-notification-service.ts';
import { getActiveArticleNotificationJob } from '../publications-notification-helpers.ts';
import {
  createArticleEmailTrackingRecord,
  listUndeliveredArticleEmailTrackingRecords,
  markArticleEmailDeliverySent,
} from '../publications-email-engagement-service.ts';

const ARTICLE = {
  id: 'art-recover',
  title: 'Two-pot reform explained',
  slug: 'two-pot-reform',
  excerpt: 'What changed.',
};

// A UTC minute that is a multiple of the sweep interval, so the sweep runs.
const T0 = new Date('2026-11-02T23:50:00.000Z');
const minutes = (n: number) => n * 60_000;

const publishArticle = (status = 'published') =>
  kvStore.set(`article:${ARTICLE.id}`, {
    status,
    title: ARTICLE.title,
    slug: ARTICLE.slug,
    excerpt: ARTICLE.excerpt,
  });

const seedPending = async (emails: string[]) => {
  for (const email of emails) {
    await createArticleEmailTrackingRecord({
      article: ARTICLE,
      recipient: { email, firstName: 'Reader', name: 'Reader Person' },
      source: 'publish',
    });
  }
};

const at = (offsetMs: number) => new Date(T0.getTime() + offsetMs);

beforeEach(() => {
  kvStore.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('recoverInterruptedPublishBlasts', () => {
  it('queues stranded pending recipients on the retry processor', async () => {
    publishArticle();
    await seedPending(['a@example.com', 'b@example.com']);

    const now = at(INTERRUPTED_BLAST_MIN_AGE_MS + minutes(10));
    vi.setSystemTime(now);
    const result = await recoverInterruptedPublishBlasts(now);

    expect(result.ran).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.recovered).toHaveLength(1);
    expect(result.recovered[0].articleId).toBe(ARTICLE.id);
    expect(result.recovered[0].recipientCount).toBe(2);

    const job = await getActiveArticleNotificationJob(ARTICLE.id, 'publish', 'retry_undelivered');
    expect(job).not.toBeNull();
  });

  it('does nothing outside its sweep minute', async () => {
    publishArticle();
    await seedPending(['a@example.com']);

    const now = new Date(T0.getTime() + INTERRUPTED_BLAST_MIN_AGE_MS + minutes(11)); // :01
    vi.setSystemTime(now);
    const result = await recoverInterruptedPublishBlasts(now);

    expect(result.ran).toBe(false);
    expect(result.recovered).toEqual([]);
    expect(await getActiveArticleNotificationJob(ARTICLE.id, 'publish', 'retry_undelivered')).toBe(
      null,
    );
  });

  it('leaves records alone while a live blast could still be sending them', async () => {
    publishArticle();
    // Seeded four minutes before the sweep minute (23:50), so only the age
    // guard can be what stops it: the minute itself is a sweep minute.
    vi.setSystemTime(new Date(T0.getTime() - minutes(4)));
    await seedPending(['a@example.com']);

    vi.setSystemTime(T0);
    const result = await recoverInterruptedPublishBlasts(T0);

    expect(result.ran).toBe(true);
    expect(result.recovered).toEqual([]);
    expect(await getActiveArticleNotificationJob(ARTICLE.id, 'publish', 'retry_undelivered')).toBe(
      null,
    );
  });

  it('does not mail out an announcement older than the recovery window', async () => {
    publishArticle();
    await seedPending(['a@example.com']);

    const now = at(INTERRUPTED_BLAST_MAX_AGE_MS + minutes(10));
    vi.setSystemTime(now);
    const result = await recoverInterruptedPublishBlasts(now);

    expect(result.ran).toBe(true);
    expect(result.recovered).toEqual([]);
    expect(await getActiveArticleNotificationJob(ARTICLE.id, 'publish', 'retry_undelivered')).toBe(
      null,
    );
  });

  it('ignores recipients that were already delivered', async () => {
    publishArticle();
    await seedPending(['a@example.com']);
    const [record] = await listUndeliveredArticleEmailTrackingRecords(ARTICLE.id, 'publish');
    await markArticleEmailDeliverySent(record.token, { providerMessageId: 'provider-1' });

    const now = at(INTERRUPTED_BLAST_MIN_AGE_MS + minutes(10));
    vi.setSystemTime(now);
    const result = await recoverInterruptedPublishBlasts(now);

    expect(result.recovered).toEqual([]);
  });

  it('does not queue a second job when one is already active', async () => {
    publishArticle();
    await seedPending(['a@example.com']);

    const first = at(INTERRUPTED_BLAST_MIN_AGE_MS + minutes(10));
    vi.setSystemTime(first);
    const one = await recoverInterruptedPublishBlasts(first);
    expect(one.recovered).toHaveLength(1);

    const second = new Date(first.getTime() + minutes(10));
    vi.setSystemTime(second);
    const two = await recoverInterruptedPublishBlasts(second);
    expect(two.recovered).toEqual([]);
  });

  it('sends nothing for an article that is no longer published', async () => {
    publishArticle('draft');
    await seedPending(['a@example.com']);

    const now = at(INTERRUPTED_BLAST_MIN_AGE_MS + minutes(10));
    vi.setSystemTime(now);
    const result = await recoverInterruptedPublishBlasts(now);

    expect(result.recovered).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/not published/);
    expect(await getActiveArticleNotificationJob(ARTICLE.id, 'publish', 'retry_undelivered')).toBe(
      null,
    );
  });
});
