/**
 * publications-notification-recipients.ts — recipient collection contract
 * =======================================================================
 *
 * The audience for an article notification is assembled from three sources that
 * overlap: the Newsletter Contacts group's external contacts, the client
 * profiles that group points at, and the legacy `newsletter:` subscription
 * records that predate the group. Getting this wrong sends a client two copies
 * of the same email, or none.
 *
 * Real collaborators throughout — the in-memory KV stands in for the store, and
 * only the legacy-backfill call (which reaches the communication repo) is
 * stubbed, so the assertions cover the actual precedence, de-duplication,
 * filtering and pagination code rather than a rehearsal of it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { backfillSpy } = vi.hoisted(() => ({
  backfillSpy: vi.fn(async () => undefined),
}));

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../newsletter-group-service.ts', () => ({
  backfillLegacyNewsletterSubscribersToGroup: backfillSpy,
}));

import * as kv from '../kv_store.tsx';
import { kvStore } from './helpers/contract-harness.ts';
import {
  collectArticleNotificationRecipients,
  extractFirstName,
} from '../publications-notification-recipients.ts';
import {
  LEGACY_SUBSCRIPTION_PAGE_SIZE,
  NEWSLETTER_GROUP_KEY,
  NEWSLETTER_PREFIX,
} from '../publications-notification-state.ts';

type Group = {
  externalContacts?: Array<{ email?: string; name?: string }>;
  clientIds?: string[];
};

const seedGroup = (group: Group) => kvStore.set(NEWSLETTER_GROUP_KEY, group);

const seedProfile = (clientId: string, profile: Record<string, unknown>) =>
  kvStore.set(`user_profile:${clientId}:personal_info`, profile);

const seedLegacy = (
  email: string,
  overrides: Partial<{ name: string; confirmed: boolean; active: boolean }> = {},
) =>
  kvStore.set(`${NEWSLETTER_PREFIX}${email}`, {
    email,
    name: overrides.name,
    confirmed: overrides.confirmed ?? true,
    active: overrides.active ?? true,
  });

/**
 * Replaces the KV `get` implementation for one key only, delegating everything
 * else to the in-memory store, and restores it afterwards. Used to prove the
 * non-blocking `catch` arms actually swallow a store failure.
 */
async function withFailingKey<T>(failingKey: string, run: () => Promise<T>): Promise<T> {
  const get = vi.mocked(kv.get);
  const original = get.getMockImplementation()!;
  get.mockImplementation(async (key: string) => {
    if (key === failingKey) throw new Error(`KV unavailable for ${key}`);
    return original(key);
  });
  try {
    return await run();
  } finally {
    get.mockImplementation(original);
  }
}

beforeEach(() => {
  kvStore.clear();
  backfillSpy.mockClear();
});

describe('extractFirstName', () => {
  it('takes the first word of the local part and title-cases it', () => {
    expect(extractFirstName('john.doe@example.com')).toBe('John');
    expect(extractFirstName('mary-jane@example.com')).toBe('Mary');
    expect(extractFirstName('thabo_mokoena@example.com')).toBe('Thabo');
  });

  it('strips digits, which is what makes numbered addresses readable', () => {
    expect(extractFirstName('sipho2024@example.com')).toBe('Sipho');
    expect(extractFirstName('2fast@example.com')).toBe('Fast');
  });

  it('falls back to "Subscriber" when nothing usable survives', () => {
    // An all-digits local part reduces to the empty string once digits go.
    expect(extractFirstName('12345@example.com')).toBe('Subscriber');
    expect(extractFirstName('@example.com')).toBe('Subscriber');
  });
});

describe('collectArticleNotificationRecipients — the Newsletter Contacts group', () => {
  it('reads external contacts, and uses the contact name as the first name', async () => {
    seedGroup({
      externalContacts: [
        { email: 'Nomvula@Example.com', name: 'Nomvula Dlamini' },
        { email: 'noname@example.com' },
      ],
    });

    const recipients = await collectArticleNotificationRecipients();

    expect(recipients).toEqual([
      {
        // Lower-cased on the way in: the map is keyed by address, so a group
        // that stores mixed case must not produce a second recipient.
        email: 'nomvula@example.com',
        firstName: 'Nomvula Dlamini',
        name: 'Nomvula Dlamini',
      },
      { email: 'noname@example.com', firstName: 'Noname', name: 'Noname' },
    ]);
  });

  it("resolves the group's clientIds through their personal-info profiles", async () => {
    seedGroup({ clientIds: ['c1', 'c2', 'c3'] });
    seedProfile('c1', { email: 'Direct@Example.com', firstName: 'Direct', lastName: 'Field' });
    seedProfile('c2', {
      personalInformation: { email: 'nested@example.com', firstName: 'Nested', surname: 'Person' },
    });
    seedProfile('c3', { contactDetails: { email: 'contact@example.com' }, name: 'Full Name Wins' });

    const recipients = await collectArticleNotificationRecipients();

    expect(recipients).toEqual([
      { email: 'contact@example.com', firstName: 'Contact', name: 'Full Name Wins' },
      { email: 'direct@example.com', firstName: 'Direct', name: 'Direct Field' },
      { email: 'nested@example.com', firstName: 'Nested', name: 'Nested Person' },
    ]);
  });

  it('skips a clientId with no resolvable email rather than inventing one', async () => {
    seedGroup({ clientIds: ['has-email', 'no-profile', 'no-email'] });
    seedProfile('has-email', { email: 'kept@example.com' });
    seedProfile('no-email', { firstName: 'Emailless' });

    const recipients = await collectArticleNotificationRecipients();

    expect(recipients.map((r) => r.email)).toEqual(['kept@example.com']);
  });

  it('keeps going when the group itself is missing', async () => {
    seedLegacy('legacy@example.com');

    const recipients = await collectArticleNotificationRecipients();

    expect(recipients.map((r) => r.email)).toEqual(['legacy@example.com']);
  });

  it('keeps going when the group read fails outright', async () => {
    seedLegacy('legacy@example.com');

    const recipients = await withFailingKey(NEWSLETTER_GROUP_KEY, () =>
      collectArticleNotificationRecipients(),
    );

    expect(recipients.map((r) => r.email)).toEqual(['legacy@example.com']);
  });
});

describe('collectArticleNotificationRecipients — legacy subscriptions', () => {
  it('includes confirmed, active subscriptions and excludes the rest', async () => {
    seedLegacy('confirmed@example.com', { name: 'Confirmed Person' });
    seedLegacy('unconfirmed@example.com', { confirmed: false });
    seedLegacy('unsubscribed@example.com', { active: false });

    const recipients = await collectArticleNotificationRecipients();

    expect(recipients).toEqual([
      { email: 'confirmed@example.com', firstName: 'Confirmed Person', name: 'Confirmed Person' },
    ]);
  });

  it('treats a missing `active` flag as still subscribed', async () => {
    // Only an explicit `active: false` unsubscribes. Older rows have no flag at
    // all, and dropping them would silently shrink the audience.
    kvStore.set(`${NEWSLETTER_PREFIX}old@example.com`, {
      email: 'old@example.com',
      confirmed: true,
    });

    const recipients = await collectArticleNotificationRecipients();

    expect(recipients.map((r) => r.email)).toEqual(['old@example.com']);
  });

  it('ignores a row whose stored value has no email of its own', async () => {
    // The address comes from the value, not the key, so a half-written row is
    // not silently mailed using its key as an address.
    kvStore.set(`${NEWSLETTER_PREFIX}orphan@example.com`, { confirmed: true });
    seedLegacy('real@example.com');

    const recipients = await collectArticleNotificationRecipients();

    expect(recipients.map((r) => r.email)).toEqual(['real@example.com']);
  });

  it('pages through more subscriptions than fit in one KV page', async () => {
    const total = LEGACY_SUBSCRIPTION_PAGE_SIZE + 47;
    for (let index = 0; index < total; index++) {
      // Zero-padded so lexicographic key order matches numeric order, which is
      // what the `startAfter` cursor walks.
      seedLegacy(`sub${String(index).padStart(4, '0')}@example.com`);
    }

    const recipients = await collectArticleNotificationRecipients();

    expect(recipients).toHaveLength(total);
    expect(recipients[0].email).toBe('sub0000@example.com');
    expect(recipients[total - 1].email).toBe(
      `sub${String(total - 1).padStart(4, '0')}@example.com`,
    );
  });
});

describe('collectArticleNotificationRecipients — precedence and ordering', () => {
  it('lets the group win over a legacy row for the same address', async () => {
    seedGroup({ externalContacts: [{ email: 'both@example.com', name: 'Group Name' }] });
    seedLegacy('both@example.com', { name: 'Legacy Name' });

    const recipients = await collectArticleNotificationRecipients();

    expect(recipients).toEqual([
      { email: 'both@example.com', firstName: 'Group Name', name: 'Group Name' },
    ]);
  });

  it('returns one recipient per address, sorted by address', async () => {
    seedGroup({
      externalContacts: [{ email: 'zed@example.com' }, { email: 'zed@example.com' }],
      clientIds: ['c1'],
    });
    seedProfile('c1', { email: 'alpha@example.com' });
    seedLegacy('mid@example.com');

    const recipients = await collectArticleNotificationRecipients();

    expect(recipients.map((r) => r.email)).toEqual([
      'alpha@example.com',
      'mid@example.com',
      'zed@example.com',
    ]);
  });

  it('runs the legacy backfill before collecting the full audience', async () => {
    await collectArticleNotificationRecipients();

    expect(backfillSpy).toHaveBeenCalledTimes(1);
  });

  it('survives a backfill failure instead of aborting the send', async () => {
    backfillSpy.mockRejectedValueOnce(new Error('backfill exploded'));
    seedLegacy('still-sent@example.com');

    const recipients = await collectArticleNotificationRecipients();

    expect(recipients.map((r) => r.email)).toEqual(['still-sent@example.com']);
  });
});

describe('collectArticleNotificationRecipients — an explicit recipient list', () => {
  it('filters the group down to the requested addresses', async () => {
    seedGroup({
      externalContacts: [{ email: 'wanted@example.com' }, { email: 'unwanted@example.com' }],
      clientIds: ['c1'],
    });
    seedProfile('c1', { email: 'unwanted-client@example.com' });

    const recipients = await collectArticleNotificationRecipients(['WANTED@example.com  ']);

    expect(recipients.map((r) => r.email)).toEqual(['wanted@example.com']);
  });

  it('does not run the backfill for a targeted send', async () => {
    // The backfill is a whole-table rewrite. A reshare to three addresses has no
    // business triggering it.
    seedGroup({ externalContacts: [{ email: 'one@example.com' }] });

    await collectArticleNotificationRecipients(['one@example.com']);

    expect(backfillSpy).not.toHaveBeenCalled();
  });

  it('falls back to a per-address legacy lookup for anyone not in the group', async () => {
    seedGroup({ externalContacts: [{ email: 'in-group@example.com' }] });
    seedLegacy('only-legacy@example.com', { name: 'Only Legacy' });

    const recipients = await collectArticleNotificationRecipients([
      'in-group@example.com',
      'only-legacy@example.com',
    ]);

    expect(recipients.map((r) => r.email)).toEqual([
      'in-group@example.com',
      'only-legacy@example.com',
    ]);
  });

  it('drops a requested address that is unknown or unsubscribed', async () => {
    seedLegacy('unsubscribed@example.com', { active: false });

    const recipients = await collectArticleNotificationRecipients([
      'unsubscribed@example.com',
      'never-heard-of@example.com',
    ]);

    expect(recipients).toEqual([]);
  });

  it('still delivers the others when one legacy lookup fails', async () => {
    seedLegacy('fine@example.com');
    seedLegacy('broken@example.com');

    const recipients = await withFailingKey(`${NEWSLETTER_PREFIX}broken@example.com`, () =>
      collectArticleNotificationRecipients(['fine@example.com', 'broken@example.com']),
    );

    expect(recipients.map((r) => r.email)).toEqual(['fine@example.com']);
  });
});
