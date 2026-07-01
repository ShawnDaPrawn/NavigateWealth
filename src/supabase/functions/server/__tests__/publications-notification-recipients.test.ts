/**
 * Tests for article-notification recipient resolution and delivery-time name
 * refresh.
 *
 * Run with: npx vitest run src/supabase/functions/server/__tests__/publications-notification-recipients.test.ts
 *
 * @module server/__tests__/publications-notification-recipients
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const kvStore = new Map<string, unknown>();
let mgetShouldThrow = false;

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn((key: string) => {
    const val = kvStore.get(key);
    return val ? JSON.parse(JSON.stringify(val)) : null;
  }),
  mget: vi.fn((keys: string[]) => {
    if (mgetShouldThrow) throw new Error('mget boom');
    return keys.map((key) => {
      const val = kvStore.get(key);
      return val ? JSON.parse(JSON.stringify(val)) : null;
    });
  }),
  listByPrefix: vi.fn(() => []),
}));

vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

// Backfill is a no-op in tests (only runs on the unfiltered path).
vi.mock('../newsletter-group-service.ts', () => ({
  backfillLegacyNewsletterSubscribersToGroup: vi.fn(async () => undefined),
}));

const { persistArticleEmailTrackingRecords } = vi.hoisted(() => ({
  persistArticleEmailTrackingRecords: vi.fn(async () => undefined),
}));
vi.mock('../publications-email-engagement-service.ts', () => ({
  persistArticleEmailTrackingRecords,
}));

// Only the constants/helpers actually imported by the recipients module.
vi.mock('../publications-notification-helpers.ts', () => ({
  NEWSLETTER_PREFIX: 'newsletter:',
  NEWSLETTER_GROUP_KEY: 'communication:groups:sys_newsletter_contacts',
  PROFILE_LOOKUP_BATCH_SIZE: 100,
  LEGACY_SUBSCRIPTION_PAGE_SIZE: 100,
  chunkArray: <T>(items: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
    return chunks;
  },
  normalizeSendError: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));

import {
  collectArticleNotificationRecipients,
  refreshTrackingRecordRecipientNames,
} from '../publications-notification-recipients.ts';

const GROUP_KEY = 'communication:groups:sys_newsletter_contacts';

beforeEach(() => {
  kvStore.clear();
  mgetShouldThrow = false;
  persistArticleEmailTrackingRecords.mockClear();
});

describe('collectArticleNotificationRecipients — precedence', () => {
  it('uses the live client profile name over a stale external contact for the same email', async () => {
    kvStore.set(GROUP_KEY, {
      clientIds: ['client-1'],
      externalContacts: [{ email: 'shared@example.com', name: 'Old Name' }],
    });
    kvStore.set('user_profile:client-1:personal_info', {
      email: 'shared@example.com',
      firstName: 'New',
      lastName: 'Name',
    });

    const recipients = await collectArticleNotificationRecipients(['shared@example.com']);

    expect(recipients).toHaveLength(1);
    expect(recipients[0]).toMatchObject({
      email: 'shared@example.com',
      firstName: 'New',
      name: 'New Name',
    });
  });

  it('still returns external contacts that have no matching profile', async () => {
    kvStore.set(GROUP_KEY, {
      clientIds: [],
      externalContacts: [{ email: 'ext@example.com', name: 'External Person' }],
    });

    const recipients = await collectArticleNotificationRecipients(['ext@example.com']);
    expect(recipients).toEqual([
      { email: 'ext@example.com', firstName: 'External Person', name: 'External Person' },
    ]);
  });
});

describe('refreshTrackingRecordRecipientNames', () => {
  const baseRecord = {
    token: 't1',
    articleId: 'a1',
    articleSlug: 'slug',
    articleTitle: 'Title',
    recipientEmail: 'shared@example.com',
    recipientName: 'Old Name',
    recipientFirstName: 'Old',
    source: 'publish' as const,
  };

  it('refreshes changed names and persists only the changed records', async () => {
    kvStore.set(GROUP_KEY, {
      clientIds: ['client-1'],
      externalContacts: [],
    });
    kvStore.set('user_profile:client-1:personal_info', {
      email: 'shared@example.com',
      firstName: 'New',
      lastName: 'Name',
    });

    const result = await refreshTrackingRecordRecipientNames([{ ...baseRecord } as never]);

    expect(result[0]).toMatchObject({
      recipientFirstName: 'New',
      recipientName: 'New Name',
    });
    expect(persistArticleEmailTrackingRecords).toHaveBeenCalledTimes(1);
    expect(persistArticleEmailTrackingRecords).toHaveBeenCalledWith([
      expect.objectContaining({
        token: 't1',
        recipientFirstName: 'New',
        recipientName: 'New Name',
      }),
    ]);
  });

  it('does not persist when names are unchanged', async () => {
    kvStore.set(GROUP_KEY, { clientIds: ['client-1'], externalContacts: [] });
    kvStore.set('user_profile:client-1:personal_info', {
      email: 'shared@example.com',
      firstName: 'Old',
      lastName: 'Name',
    });

    const record = { ...baseRecord, recipientFirstName: 'Old', recipientName: 'Old Name' };
    const result = await refreshTrackingRecordRecipientNames([record as never]);

    expect(result[0]).toMatchObject({ recipientFirstName: 'Old', recipientName: 'Old Name' });
    expect(persistArticleEmailTrackingRecords).not.toHaveBeenCalled();
  });

  it('returns the original records when resolution fails', async () => {
    mgetShouldThrow = true;
    kvStore.set(GROUP_KEY, { clientIds: ['client-1'], externalContacts: [] });

    const record = { ...baseRecord } as never;
    const result = await refreshTrackingRecordRecipientNames([record]);

    expect(result[0]).toBe(record);
    expect(persistArticleEmailTrackingRecords).not.toHaveBeenCalled();
  });
});
