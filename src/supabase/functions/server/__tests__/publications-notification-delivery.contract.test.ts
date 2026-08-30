/**
 * Article notification delivery — contract tests
 * ==============================================
 *
 * Covers the send path itself: resolving the article as still published,
 * attempting a tracked send, classifying a failure as retryable or terminal,
 * and the immediate blast that fans out across batches.
 *
 * The only mocked collaborator is `email-service.ts` — the provider boundary.
 * Everything else runs for real against the in-memory KV, so the tracking
 * records these tests assert on are written by the production code paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sendEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => ({ success: true })),
}));

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
  sendEmail,
  getFooterSettings: vi.fn(async () => ({ companyName: 'Navigate Wealth' })),
  // Echoes the template inputs back so a test can assert that the tracked URL
  // and the unsubscribe link actually reach the rendered email.
  createEmailTemplate: (body: string, options: Record<string, unknown>) =>
    [
      `<title>${options.title}</title>`,
      `<greeting>${options.greeting}</greeting>`,
      `<button href="${options.buttonUrl}">${options.buttonLabel}</button>`,
      `<unsubscribe href="${options.unsubscribeLink}"></unsubscribe>`,
      body,
    ].join(''),
}));

import { kvStore } from './helpers/contract-harness.ts';
import {
  createAndDeliverTrackingRecord,
  deliverTrackedNotificationRecord,
  resolvePublishedArticleForDelivery,
} from '../publications-notification-helpers.ts';
import { runArticleNotificationDelivery } from '../publications-notification-service.ts';
import {
  createArticleEmailTrackingRecord,
  listArticleEmailTrackingRecords,
  type ArticleEmailDeliveryStatus,
  type ArticleEmailTrackingRecord,
} from '../publications-email-engagement-service.ts';
import { MAX_SEND_ATTEMPTS, NEWSLETTER_GROUP_KEY } from '../publications-notification-state.ts';

const ARTICLE = {
  id: 'art-1',
  title: 'Retirement annuities after the two-pot reform',
  slug: 'two-pot-reform',
  excerpt: 'What changed, and what it means for your withdrawals.',
};

const publishArticle = (overrides: Record<string, unknown> = {}) =>
  kvStore.set(`article:${ARTICLE.id}`, {
    status: 'published',
    title: ARTICLE.title,
    slug: ARTICLE.slug,
    excerpt: ARTICLE.excerpt,
    ...overrides,
  });

const seedAudience = (emails: string[]) =>
  kvStore.set(NEWSLETTER_GROUP_KEY, {
    externalContacts: emails.map((email) => ({ email })),
  });

const trackingFor = async (email: string): Promise<ArticleEmailTrackingRecord | undefined> =>
  (await listArticleEmailTrackingRecords(ARTICLE.id)).find((r) => r.recipientEmail === email);

const newRecord = (email = 'reader@example.com') =>
  createArticleEmailTrackingRecord({
    article: ARTICLE,
    recipient: { email, firstName: 'Reader', name: 'Reader Person' },
    source: 'publish',
  });

beforeEach(() => {
  kvStore.clear();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ success: true });
});

describe('resolvePublishedArticleForDelivery', () => {
  it('refuses to send for an article that is not published', async () => {
    publishArticle({ status: 'draft' });

    await expect(resolvePublishedArticleForDelivery(ARTICLE)).rejects.toThrow(
      /article art-1 is not published/,
    );
  });

  it('refuses to send for an article that no longer exists', async () => {
    await expect(resolvePublishedArticleForDelivery(ARTICLE)).rejects.toThrow(
      /article art-1 is not published/,
    );
  });

  it('prefers the stored title and slug over whatever the caller passed', async () => {
    // The caller's copy can be a stale snapshot from when the job was queued.
    // Subscribers should get the article as it stands now.
    publishArticle({ title: 'Renamed since queueing', slug: 'renamed-slug' });

    await expect(
      resolvePublishedArticleForDelivery({ ...ARTICLE, title: 'Stale', slug: 'stale-slug' }),
    ).resolves.toEqual({
      id: ARTICLE.id,
      title: 'Renamed since queueing',
      slug: 'renamed-slug',
      excerpt: ARTICLE.excerpt,
    });
  });
});

describe('deliverTrackedNotificationRecord', () => {
  it('sends the tracked article link and marks the record sent', async () => {
    publishArticle();
    const record = await newRecord();

    await deliverTrackedNotificationRecord(ARTICLE, record);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [to, subject, html, text] = sendEmail.mock.calls[0];
    expect(to).toBe('reader@example.com');
    expect(subject).toBe(`New article: ${ARTICLE.title}`);

    // The tracking token has to be on the link, or the open/read counters that
    // the engagement dashboard reports can never be attributed.
    const trackedUrl = `https://navigatewealth.co/resources/article/${ARTICLE.slug}?nt=${record.token}`;
    expect(html).toContain(trackedUrl);
    expect(text).toContain(trackedUrl);
    expect(html).toContain(
      'https://www.navigatewealth.co/newsletter/unsubscribe?email=reader%40example.com',
    );

    const stored = await trackingFor('reader@example.com');
    expect(stored).toMatchObject({ deliveryStatus: 'sent', attemptCount: 1 });
    expect(stored?.sentAt).toBeTruthy();
    expect(stored?.deliveryError).toBeNull();
  });

  it('does nothing at all for a record that already reached a terminal status', async () => {
    publishArticle();
    const record = await newRecord();

    for (const status of ['sent', 'failed_terminal'] as ArticleEmailDeliveryStatus[]) {
      await deliverTrackedNotificationRecord(ARTICLE, { ...record, deliveryStatus: status });
    }

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('gives up after a single attempt on a terminal provider error', async () => {
    publishArticle();
    const record = await newRecord('bounced@example.com');
    sendEmail.mockRejectedValue(new Error('Bad request: recipient address is invalid'));

    await expect(deliverTrackedNotificationRecord(ARTICLE, record)).rejects.toThrow(
      /recipient address is invalid/,
    );

    // One attempt, not three: retrying a rejected address just burns quota and
    // hurts the sending reputation.
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(await trackingFor('bounced@example.com')).toMatchObject({
      deliveryStatus: 'failed_terminal',
      deliveryError: 'Bad request: recipient address is invalid',
      attemptCount: 1,
    });
  });

  it('stops on the first attempt for a sender-side fault, without burning the address', async () => {
    publishArticle();
    const record = await newRecord('reader@example.com');
    // SES sandbox: rejects every send until AWS grants production access.
    sendEmail.mockRejectedValue(
      new Error(
        'SES error (400): {"message":"Email address is not verified. The following identities failed the check in region EU-WEST-1: newsletters@navigatewealth.co"}',
      ),
    );

    await expect(deliverTrackedNotificationRecord(ARTICLE, record)).rejects.toThrow(/not verified/);

    // One call, not MAX_SEND_ATTEMPTS: no retry can clear our own config.
    expect(sendEmail).toHaveBeenCalledTimes(1);
    // Retryable, never terminal — the address is fine and must survive to be
    // sent once the identity is verified.
    expect(await trackingFor('reader@example.com')).toMatchObject({
      deliveryStatus: 'failed_retryable',
      attemptCount: 1,
    });
  });

  it('retries a transient provider error up to the attempt ceiling', async () => {
    publishArticle();
    const record = await newRecord('flaky@example.com');
    sendEmail.mockRejectedValue(new Error('socket hang up'));

    await expect(deliverTrackedNotificationRecord(ARTICLE, record)).rejects.toThrow(
      /socket hang up/,
    );

    expect(sendEmail).toHaveBeenCalledTimes(MAX_SEND_ATTEMPTS);
    expect(await trackingFor('flaky@example.com')).toMatchObject({
      deliveryStatus: 'failed_retryable',
      deliveryError: 'socket hang up',
      attemptCount: MAX_SEND_ATTEMPTS,
    });
  });

  it('stops retrying as soon as an attempt succeeds', async () => {
    publishArticle();
    const record = await newRecord('recovers@example.com');
    sendEmail
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce({ success: true });

    await deliverTrackedNotificationRecord(ARTICLE, record);

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(await trackingFor('recovers@example.com')).toMatchObject({
      deliveryStatus: 'sent',
      attemptCount: 2,
    });
  });

  it('reports an unrecognised throw rather than swallowing it', async () => {
    publishArticle();
    const record = await newRecord('odd@example.com');
    sendEmail.mockRejectedValue('a bare string, not an Error');

    await expect(deliverTrackedNotificationRecord(ARTICLE, record)).rejects.toThrow(
      'Unknown error',
    );
    expect(await trackingFor('odd@example.com')).toMatchObject({
      deliveryStatus: 'failed_retryable',
      deliveryError: 'Unknown error',
    });
  });
});

describe('createAndDeliverTrackingRecord', () => {
  it('reuses the existing publish record for a recipient instead of minting a second token', async () => {
    publishArticle();
    const recipient = { email: 'twice@example.com', firstName: 'Twice', name: 'Twice Over' };

    await createAndDeliverTrackingRecord(ARTICLE, recipient, 'publish');
    const first = await trackingFor('twice@example.com');
    await createAndDeliverTrackingRecord(ARTICLE, recipient, 'publish');

    const records = await listArticleEmailTrackingRecords(ARTICLE.id);
    expect(records).toHaveLength(1);
    expect(records[0].token).toBe(first?.token);
    // Already 'sent' after the first pass, so the second call is a no-op send.
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('keeps a reshare on its own record, separate from the publish one', async () => {
    publishArticle();
    const recipient = { email: 'both@example.com', firstName: 'Both', name: 'Both Sources' };

    await createAndDeliverTrackingRecord(ARTICLE, recipient, 'publish');
    await createAndDeliverTrackingRecord(ARTICLE, recipient, 'reshare');

    const records = await listArticleEmailTrackingRecords(ARTICLE.id);
    expect(records.map((r) => r.source).sort()).toEqual(['publish', 'reshare']);
    expect(new Set(records.map((r) => r.token)).size).toBe(2);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });
});

describe('runArticleNotificationDelivery', () => {
  it('reports the audience without sending anything on a dry run', async () => {
    // Deliberately left unpublished: a dry run is a preview and must not be
    // blocked by publication state.
    seedAudience(['a@example.com', 'b@example.com']);

    const result = await runArticleNotificationDelivery(ARTICLE, { dryRun: true });

    expect(result).toMatchObject({ dryRun: true, recipientCount: 2, sent: 0, failed: 0 });
    expect(result.recipients.map((r) => r.email)).toEqual(['a@example.com', 'b@example.com']);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('refuses a live publish send when the article is not published', async () => {
    seedAudience(['a@example.com']);

    await expect(runArticleNotificationDelivery(ARTICLE)).rejects.toThrow(/is not published/);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does not gate a reshare on publication state', async () => {
    // A reshare is an explicit admin action against an article the admin is
    // looking at, so it skips the published check the publish path enforces.
    seedAudience(['a@example.com']);

    const result = await runArticleNotificationDelivery(ARTICLE, { source: 'reshare' });

    expect(result.recipientCount).toBe(1);
    // The delivery itself still resolves the article, so an unpublished one
    // fails per-recipient rather than up front.
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatch(/^a@example\.com: /);
  });

  it('returns an empty result, and sends nothing, when there is no audience', async () => {
    publishArticle();

    const result = await runArticleNotificationDelivery(ARTICLE);

    expect(result).toEqual({
      dryRun: false,
      recipientCount: 0,
      sent: 0,
      failed: 0,
      recipients: [],
      errors: [],
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('fans out across more recipients than fit in one delivery batch', async () => {
    publishArticle();
    const emails = Array.from(
      { length: 25 },
      (_, index) => `reader${String(index).padStart(2, '0')}@example.com`,
    );
    seedAudience(emails);

    const result = await runArticleNotificationDelivery(ARTICLE);

    expect(result).toMatchObject({ recipientCount: 25, sent: 25, failed: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(25);
    expect(await listArticleEmailTrackingRecords(ARTICLE.id)).toHaveLength(25);
  });

  it('keeps delivering the rest of the batch when one recipient fails', async () => {
    publishArticle();
    seedAudience(['good@example.com', 'bad@example.com', 'alsogood@example.com']);
    sendEmail.mockImplementation(async (to: string) => {
      if (to === 'bad@example.com') throw new Error('Bad request: malformed address');
      return { success: true };
    });

    const result = await runArticleNotificationDelivery(ARTICLE);

    expect(result).toMatchObject({ recipientCount: 3, sent: 2, failed: 1 });
    expect(result.errors).toEqual(['bad@example.com: Bad request: malformed address']);
    expect(await trackingFor('bad@example.com')).toMatchObject({
      deliveryStatus: 'failed_terminal',
    });
    expect(await trackingFor('good@example.com')).toMatchObject({ deliveryStatus: 'sent' });
  });

  it('honours an explicit recipient list', async () => {
    publishArticle();
    seedAudience(['wanted@example.com', 'not-wanted@example.com']);

    const result = await runArticleNotificationDelivery(ARTICLE, {
      recipientEmails: ['wanted@example.com'],
    });

    expect(result.recipients.map((r) => r.email)).toEqual(['wanted@example.com']);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
