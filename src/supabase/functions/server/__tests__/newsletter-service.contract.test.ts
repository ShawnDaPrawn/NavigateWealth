/**
 * newsletter-service.ts — subscriber lifecycle contracts
 * ======================================================
 *
 * The consent record for marketing email. Under POPIA an opt-out has to stick,
 * so the tests here are mostly about the *negative* paths: which operations are
 * allowed to set `active: true` on someone who previously unsubscribed, and
 * which must refuse. Two of them — the client auto-subscribe on signup and the
 * bulk reconciliation sweep — run without anyone watching, which is exactly
 * where a silent re-subscribe would go unnoticed.
 *
 * Real collaborators: the in-memory KV. Only the Newsletter Contacts group
 * writer is stubbed, and it is asserted against so the group and the
 * subscription record cannot drift apart.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { group } = vi.hoisted(() => ({
  group: {
    addNewsletterSubscriber: vi.fn(async () => undefined),
    addNewsletterSubscribersBulk: vi.fn(async () => undefined),
    removeNewsletterSubscriber: vi.fn(async () => undefined),
    updateNewsletterSubscriberContact: vi.fn(async () => undefined),
  },
}));

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../newsletter-group-service.ts', () => group);

import { kvStore } from './helpers/contract-harness.ts';
import {
  addSubscriber,
  autoSubscribeClient,
  bulkAddSubscribers,
  getStats,
  listSubscribers,
  reconcileClientsToSubscribers,
  removeSubscriberByEmail,
  resubscribeByEmail,
  updateSubscriberDetails,
} from '../newsletter-service.ts';

type Entry = Record<string, unknown>;

const key = (email: string) => `newsletter:${email}`;

const stored = (email: string) => kvStore.get(key(email)) as Entry | undefined;

const seed = (email: string, overrides: Entry = {}) =>
  kvStore.set(key(email), {
    email,
    firstName: 'Thandi',
    surname: 'Nkosi',
    name: 'Thandi Nkosi',
    source: 'Website',
    confirmed: true,
    active: true,
    subscribedAt: '2026-01-01T00:00:00.000Z',
    confirmedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  });

const seedProfile = (id: string, profile: Entry) => kvStore.set(`user_profile:${id}`, profile);

beforeEach(() => {
  kvStore.clear();
  Object.values(group).forEach((fn) => fn.mockClear());
});

describe('listSubscribers', () => {
  it('returns the most recently subscribed first', async () => {
    seed('older@example.com', { subscribedAt: '2026-01-01T00:00:00.000Z' });
    seed('newer@example.com', { subscribedAt: '2026-06-01T00:00:00.000Z' });

    const subscribers = await listSubscribers();

    expect(subscribers.map((s) => s.email)).toEqual(['newer@example.com', 'older@example.com']);
  });

  it('drops a row with no email rather than rendering a blank one', async () => {
    kvStore.set(key('orphan'), { confirmed: true, active: true });
    seed('real@example.com');

    await expect(listSubscribers()).resolves.toHaveLength(1);
  });

  it('fills in the display shape a half-populated row does not carry', async () => {
    kvStore.set(key('sparse@example.com'), { email: 'sparse@example.com' });

    const [subscriber] = await listSubscribers();

    expect(subscriber).toEqual({
      email: 'sparse@example.com',
      firstName: '',
      surname: '',
      name: '',
      source: 'unknown',
      confirmed: false,
      active: false,
      subscribedAt: null,
      confirmedAt: null,
      unsubscribedAt: null,
      removedBy: null,
    });
  });

  it('composes the display name from first name and surname when both are present', async () => {
    seed('a@example.com', { firstName: 'Thandi', surname: 'Nkosi', name: 'Stale Legacy Name' });

    const [subscriber] = await listSubscribers();

    expect(subscriber.name).toBe('Thandi Nkosi');
  });

  it('falls back to the legacy name field when the parts are missing', async () => {
    seed('a@example.com', { firstName: '', surname: '', name: 'Legacy Only' });

    const [subscriber] = await listSubscribers();

    expect(subscriber.name).toBe('Legacy Only');
  });
});

describe('addSubscriber', () => {
  it('adds a new subscriber confirmed and active, and mirrors them into the group', async () => {
    const result = await addSubscriber({
      email: '  Thandi@Example.COM ',
      firstName: ' Thandi ',
      surname: ' Nkosi ',
    });

    expect(result.alreadySubscribed).toBe(false);
    expect(result.subscriber).toMatchObject({
      email: 'thandi@example.com',
      firstName: 'Thandi',
      surname: 'Nkosi',
      name: 'Thandi Nkosi',
      confirmed: true,
      active: true,
      source: 'Admin Manual Upload',
    });
    // The group is the audience the send actually reads, so a subscription that
    // never reaches it is a subscriber who never gets an email.
    expect(group.addNewsletterSubscriber).toHaveBeenCalledWith(
      'thandi@example.com',
      'Thandi Nkosi',
    );
  });

  it('reports an already-active subscriber without rewriting the record', async () => {
    seed('thandi@example.com', { source: 'Website' });

    const result = await addSubscriber({ email: 'THANDI@example.com' });

    expect(result).toMatchObject({ alreadySubscribed: true });
    expect(result.subscriber).toBeUndefined();
    expect(stored('thandi@example.com')).toMatchObject({ source: 'Website' });
    expect(group.addNewsletterSubscriber).not.toHaveBeenCalled();
  });

  it('reactivates someone who had unsubscribed, because an admin add is explicit', async () => {
    // Distinct from the automated paths below: a human typing the address in is
    // an act of consent capture, so it is allowed to override an earlier opt-out.
    seed('lapsed@example.com', { active: false, unsubscribedAt: '2026-02-01T00:00:00.000Z' });

    const result = await addSubscriber({ email: 'lapsed@example.com' });

    expect(result.alreadySubscribed).toBe(false);
    expect(stored('lapsed@example.com')).toMatchObject({ active: true, confirmed: true });
  });

  it('keeps the original subscribedAt when re-adding', async () => {
    seed('lapsed@example.com', { active: false, subscribedAt: '2020-05-05T00:00:00.000Z' });

    await addSubscriber({ email: 'lapsed@example.com' });

    expect(stored('lapsed@example.com')).toMatchObject({
      subscribedAt: '2020-05-05T00:00:00.000Z',
    });
  });

  it('keeps the stored name when the caller supplies none', async () => {
    seed('lapsed@example.com', { active: false, firstName: 'Thandi', surname: 'Nkosi' });

    await addSubscriber({ email: 'lapsed@example.com' });

    expect(stored('lapsed@example.com')).toMatchObject({
      firstName: 'Thandi',
      surname: 'Nkosi',
    });
  });
});

describe('bulkAddSubscribers', () => {
  it('adds, skips and reports errors in one pass', async () => {
    seed('existing@example.com');

    const result = await bulkAddSubscribers([
      { email: ' New@Example.com ', firstName: 'New', surname: 'Person' },
      { email: 'existing@example.com' },
      { email: 'not-an-email' },
      { email: '' },
      {},
    ]);

    expect(result).toMatchObject({ added: 1, skipped: 1 });
    expect(result.errors).toEqual([
      'Invalid email: not-an-email',
      'Invalid email: (empty)',
      'Invalid email: (empty)',
    ]);
    expect(stored('new@example.com')).toMatchObject({
      confirmed: true,
      active: true,
      source: 'Admin Bulk Upload',
    });
  });

  it('writes the group once for the whole batch, not once per row', async () => {
    // Each group write is a read-modify-write of one large record; doing it per
    // row is what made large uploads time out.
    await bulkAddSubscribers([
      { email: 'a@example.com', firstName: 'A' },
      { email: 'b@example.com', firstName: 'B' },
      { email: 'c@example.com', firstName: 'C' },
    ]);

    expect(group.addNewsletterSubscribersBulk).toHaveBeenCalledTimes(1);
    expect(group.addNewsletterSubscribersBulk).toHaveBeenCalledWith([
      { email: 'a@example.com', name: 'A' },
      { email: 'b@example.com', name: 'B' },
      { email: 'c@example.com', name: 'C' },
    ]);
  });

  it('does not touch the group at all when nothing was added', async () => {
    seed('existing@example.com');

    await bulkAddSubscribers([{ email: 'existing@example.com' }, { email: 'bad' }]);

    expect(group.addNewsletterSubscribersBulk).not.toHaveBeenCalled();
  });

  it('reactivates an unsubscribed address, the same as a single admin add', async () => {
    seed('lapsed@example.com', { active: false });

    const result = await bulkAddSubscribers([{ email: 'lapsed@example.com' }]);

    expect(result.added).toBe(1);
    expect(stored('lapsed@example.com')).toMatchObject({ active: true });
  });
});

describe('removeSubscriberByEmail', () => {
  it('marks the record inactive rather than deleting it', async () => {
    // POPIA: the withdrawal itself is a record that has to survive, so an
    // opt-out is a state change, never a delete.
    seed('thandi@example.com');

    await removeSubscriberByEmail(' THANDI@example.com ');

    const entry = stored('thandi@example.com');
    expect(entry).toMatchObject({ active: false, removedBy: 'admin', confirmed: true });
    expect(entry?.unsubscribedAt).toBeTruthy();
    expect(group.removeNewsletterSubscriber).toHaveBeenCalledWith('thandi@example.com');
  });

  it('refuses an address it has never seen', async () => {
    await expect(removeSubscriberByEmail('ghost@example.com')).rejects.toThrow(
      'Subscriber not found',
    );
    expect(group.removeNewsletterSubscriber).not.toHaveBeenCalled();
  });
});

describe('resubscribeByEmail', () => {
  it('clears the opt-out and records who reversed it', async () => {
    seed('lapsed@example.com', {
      active: false,
      unsubscribedAt: '2026-02-01T00:00:00.000Z',
      removedBy: 'admin',
    });

    const result = await resubscribeByEmail('lapsed@example.com');

    expect(result.alreadyActive).toBe(false);
    const entry = stored('lapsed@example.com');
    expect(entry).toMatchObject({
      active: true,
      confirmed: true,
      unsubscribedAt: null,
      removedBy: null,
      resubscribedBy: 'admin',
    });
    expect(entry?.resubscribedAt).toBeTruthy();
    expect(group.addNewsletterSubscriber).toHaveBeenCalledWith(
      'lapsed@example.com',
      'Thandi Nkosi',
    );
  });

  it('keeps the original confirmation timestamp', async () => {
    seed('lapsed@example.com', { active: false, confirmedAt: '2020-01-01T00:00:00.000Z' });

    await resubscribeByEmail('lapsed@example.com');

    expect(stored('lapsed@example.com')).toMatchObject({
      confirmedAt: '2020-01-01T00:00:00.000Z',
    });
  });

  it('reports an already-active subscriber without rewriting anything', async () => {
    seed('active@example.com');

    await expect(resubscribeByEmail('active@example.com')).resolves.toMatchObject({
      alreadyActive: true,
    });
    expect(group.addNewsletterSubscriber).not.toHaveBeenCalled();
  });

  it('refuses an address it has never seen', async () => {
    await expect(resubscribeByEmail('ghost@example.com')).rejects.toThrow('Subscriber not found');
  });
});

describe('updateSubscriberDetails', () => {
  it('updates the name in place when the address is unchanged', async () => {
    seed('thandi@example.com');

    const result = await updateSubscriberDetails({
      currentEmail: 'thandi@example.com',
      email: 'thandi@example.com',
      firstName: ' Thandiwe ',
      surname: ' Nkosi ',
    });

    expect(result.subscriber).toMatchObject({ firstName: 'Thandiwe', name: 'Thandiwe Nkosi' });
    expect(kvStore.has(key('thandi@example.com'))).toBe(true);
  });

  it('moves the record to the new key and removes the old one', async () => {
    // The address is the key, so a change of address is a move. Leaving the old
    // key behind would mail the person twice.
    seed('old@example.com');

    await updateSubscriberDetails({
      currentEmail: 'old@example.com',
      email: ' NEW@Example.com ',
      firstName: 'Thandi',
      surname: 'Nkosi',
    });

    expect(kvStore.has(key('old@example.com'))).toBe(false);
    expect(stored('new@example.com')).toMatchObject({ email: 'new@example.com' });
    expect(group.updateNewsletterSubscriberContact).toHaveBeenCalledWith(
      'old@example.com',
      'new@example.com',
      'Thandi Nkosi',
    );
  });

  it('refuses to overwrite a different person already on the new address', async () => {
    seed('old@example.com');
    seed('taken@example.com', { email: 'taken@example.com' });

    await expect(
      updateSubscriberDetails({ currentEmail: 'old@example.com', email: 'taken@example.com' }),
    ).rejects.toThrow('A subscriber with this email already exists');
    expect(kvStore.has(key('old@example.com'))).toBe(true);
  });

  it('does not touch the group for a subscriber who is not active', async () => {
    // An unsubscribed person is not in the audience, so a rename must not put
    // them back into it as a side effect.
    seed('lapsed@example.com', { active: false });

    await updateSubscriberDetails({
      currentEmail: 'lapsed@example.com',
      email: 'lapsed@example.com',
      firstName: 'Renamed',
    });

    expect(group.updateNewsletterSubscriberContact).not.toHaveBeenCalled();
    expect(stored('lapsed@example.com')).toMatchObject({ active: false });
  });

  it('refuses an address it has never seen', async () => {
    await expect(
      updateSubscriberDetails({ currentEmail: 'ghost@example.com', email: 'ghost@example.com' }),
    ).rejects.toThrow('Subscriber not found');
  });
});

describe('autoSubscribeClient', () => {
  it('never re-subscribes someone who opted out', async () => {
    // The POPIA-critical case. This runs unattended at signup, so a silent
    // re-subscribe here would go unnoticed until the person complained.
    seed('lapsed@example.com', { active: false, unsubscribedAt: '2026-02-01T00:00:00.000Z' });

    await autoSubscribeClient('lapsed@example.com', 'Thandi', 'Nkosi');

    expect(stored('lapsed@example.com')).toMatchObject({ active: false });
    expect(group.addNewsletterSubscriber).not.toHaveBeenCalled();
  });

  it('subscribes a brand-new client', async () => {
    await autoSubscribeClient(' Thandi@Example.com ', ' Thandi ', ' Nkosi ');

    expect(stored('thandi@example.com')).toMatchObject({
      email: 'thandi@example.com',
      firstName: 'Thandi',
      surname: 'Nkosi',
      name: 'Thandi Nkosi',
      confirmed: true,
      active: true,
      source: 'Client Signup Auto-Subscribe',
    });
  });

  it('leaves an already-active subscriber untouched', async () => {
    seed('thandi@example.com', { source: 'Website' });

    await autoSubscribeClient('thandi@example.com');

    expect(stored('thandi@example.com')).toMatchObject({ source: 'Website' });
    expect(group.addNewsletterSubscriber).not.toHaveBeenCalled();
  });

  it('completes an unconfirmed subscription instead of leaving it pending', async () => {
    seed('pending@example.com', { confirmed: false, active: true });

    await autoSubscribeClient('pending@example.com');

    expect(stored('pending@example.com')).toMatchObject({ confirmed: true, active: true });
  });

  it('swallows a store failure rather than failing the signup it runs inside', async () => {
    const kv = await import('../kv_store.tsx');
    const set = vi.mocked(kv.set);
    const original = set.getMockImplementation()!;
    set.mockRejectedValueOnce(new Error('KV unavailable'));
    try {
      await expect(autoSubscribeClient('new@example.com')).resolves.toBeUndefined();
    } finally {
      set.mockImplementation(original);
    }
  });
});

describe('reconcileClientsToSubscribers', () => {
  it('subscribes clients who are not on the list yet', async () => {
    seedProfile('c1', { email: 'One@Example.com', firstName: 'One', lastName: 'Client' });
    seedProfile('c2', { personalInformation: { email: 'two@example.com', firstName: 'Two' } });

    const result = await reconcileClientsToSubscribers();

    expect(result).toMatchObject({ totalClients: 2, added: 2, skippedUnsubscribed: 0 });
    expect(stored('one@example.com')).toMatchObject({
      source: 'Client Reconciliation',
      firstName: 'One',
      surname: 'Client',
      active: true,
    });
  });

  it('skips a client who has explicitly unsubscribed', async () => {
    // The other unattended path. A sweep that quietly re-subscribed opt-outs
    // would be a POPIA breach at scale rather than one at a time.
    seedProfile('c1', { email: 'lapsed@example.com' });
    seed('lapsed@example.com', { active: false });

    const result = await reconcileClientsToSubscribers();

    expect(result).toMatchObject({ added: 0, skippedUnsubscribed: 1 });
    expect(stored('lapsed@example.com')).toMatchObject({ active: false });
    expect(group.addNewsletterSubscriber).not.toHaveBeenCalled();
  });

  it('counts an already-subscribed client without rewriting them', async () => {
    seedProfile('c1', { email: 'active@example.com' });
    seed('active@example.com', { source: 'Website' });

    const result = await reconcileClientsToSubscribers();

    expect(result).toMatchObject({ added: 0, alreadySubscribed: 1 });
    expect(stored('active@example.com')).toMatchObject({ source: 'Website' });
  });

  it('de-duplicates two profiles sharing one address', async () => {
    seedProfile('c1', { email: 'shared@example.com', firstName: 'First' });
    seedProfile('c2', { email: 'Shared@Example.com', firstName: 'Second' });

    const result = await reconcileClientsToSubscribers();

    expect(result).toMatchObject({ totalClients: 1, added: 1 });
    expect(stored('shared@example.com')).toMatchObject({ firstName: 'First' });
  });

  it('ignores a profile with no resolvable address', async () => {
    seedProfile('c1', { firstName: 'Nameless' });
    seedProfile('c2', { contactDetails: { email: 'contact@example.com' } });

    const result = await reconcileClientsToSubscribers();

    expect(result).toMatchObject({ totalClients: 1, added: 1 });
  });

  it('reports the before and after totals', async () => {
    seed('existing@example.com');
    seedProfile('c1', { email: 'new@example.com' });

    const result = await reconcileClientsToSubscribers();

    expect(result).toMatchObject({
      totalSubscribersBefore: 1,
      added: 1,
      totalSubscribersAfter: 2,
    });
  });
});

describe('getStats', () => {
  it('counts subscribers by confirmation and activity', async () => {
    seed('active@example.com');
    seed('unconfirmed@example.com', { confirmed: false, active: true });
    seed('lapsed@example.com', { active: false });
    kvStore.set(key('orphan'), { confirmed: true, active: true });

    const stats = await getStats();

    expect(stats).toMatchObject({
      totalSubscribers: 3,
      confirmedSubscribers: 2,
      // Active is counted within confirmed, so an unconfirmed row never lands
      // in the audience total.
      activeSubscribers: 1,
    });
  });

  it('summarises broadcasts, newest first', async () => {
    kvStore.set('broadcast:1', {
      id: '1',
      subject: 'Older',
      sentAt: '2020-01-01T00:00:00.000Z',
    });
    kvStore.set('broadcast:2', {
      id: '2',
      subject: 'Newest',
      sentAt: new Date().toISOString(),
    });
    kvStore.set('broadcast:draft', { id: '3', subject: 'Never sent' });

    const stats = await getStats();

    expect(stats).toMatchObject({
      totalBroadcasts: 3,
      broadcastsThisMonth: 1,
      lastBroadcastSubject: 'Newest',
    });
  });

  it('reports zeroes and nulls on an empty store', async () => {
    await expect(getStats()).resolves.toEqual({
      totalSubscribers: 0,
      confirmedSubscribers: 0,
      activeSubscribers: 0,
      totalBroadcasts: 0,
      broadcastsThisMonth: 0,
      lastBroadcastAt: null,
      lastBroadcastSubject: null,
    });
  });
});
