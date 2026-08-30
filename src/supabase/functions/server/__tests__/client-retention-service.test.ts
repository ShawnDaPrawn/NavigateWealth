/**
 * Retention sweep — the tests that stop it erasing living clients.
 * ================================================================
 *
 * This job deletes client data irreversibly, on a 7-year timer nobody will be
 * watching when it first fires in 2033. By then the reasoning behind it will be
 * gone and only these tests will remain to say what it was supposed to do. So
 * they are written around the two ways it could be wrong in the direction that
 * matters — erasing somebody it should have kept — rather than around coverage.
 *
 * The two traps, both live in this codebase:
 *
 *   1. `deleteClient()` sets `suspended = true` AND `deleted = true`. Suspension
 *      is therefore useless as a discriminator, and reasoning from the word
 *      rather than the data gets it backwards. Production carries three
 *      suspended-but-not-deleted clients right now.
 *   2. `AccountStatus` has no `inactive` member, so a dormant client is still
 *      `active`. Anything keyed on last-activity erases live relationships.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';

const store = new Map<string, unknown>();

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (k: string) => store.get(k) ?? null),
  set: vi.fn(async (k: string, v: unknown) => {
    store.set(k, v);
  }),
  del: vi.fn(async (k: string) => {
    store.delete(k);
  }),
  mget: vi.fn(async (ks: string[]) => ks.map((k) => store.get(k) ?? null)),
  getByPrefix: vi.fn(async (p: string) =>
    [...store.entries()].filter(([k]) => k.startsWith(p)).map(([, v]) => v),
  ),
  listByPrefix: vi.fn(async (p: string) =>
    [...store.entries()]
      .filter(([k]) => k.startsWith(p))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ key, value })),
  ),
}));

const { runClientRetentionSweep, assessRetention, retentionBoundary, RETENTION_YEARS } =
  await import('../client-retention-service.ts');

const NOW = new Date('2026-08-29T12:00:00.000Z');
/** Comfortably outside the window. */
const LONG_AGO = '2015-01-01T00:00:00.000Z';
/** Inside the window — closed recently. */
const RECENT = '2026-02-16T00:28:45.260Z';

function seedSubject(
  userId: string,
  security: Record<string, unknown>,
  extras: Record<string, unknown> = {},
) {
  store.set(`security:${userId}`, security);
  store.set(`user_profile:${userId}:personal_info`, { name: 'x' });
  store.set(`auth_log:${userId}:1`, { event: 'login' });
  store.set(`audit:${userId}:1`, { action: 'update' });
  store.set(`activity:${userId}:1`, { kind: 'view' });
  for (const [k, v] of Object.entries(extras)) store.set(k, v);
}

beforeEach(() => {
  store.clear();
});

describe('who is in scope', () => {
  it('never touches a suspended client, however long ago they were suspended', async () => {
    // The trap. Suspended-but-not-deleted is a LIVE relationship: the client
    // still exists, still has a profile, and may be reinstated tomorrow.
    seedSubject('suspended-user', {
      suspended: true,
      suspendedAt: LONG_AGO,
      deleted: false,
    });

    const result = await runClientRetentionSweep({ apply: true, now: NOW });

    expect(result.scanned).toBe(0);
    expect(result.eligible).toEqual([]);
    expect(result.erased).toEqual([]);
    expect(store.has('security:suspended-user')).toBe(true);
    expect(store.has('user_profile:suspended-user:personal_info')).toBe(true);
  });

  it('never touches a dormant but open client', async () => {
    // No `inactive` status exists; a client nobody has touched is still active.
    // Nothing about age may make them eligible.
    seedSubject('dormant-user', { suspended: false, deleted: false });

    const result = await runClientRetentionSweep({ apply: true, now: NOW });

    expect(result.scanned).toBe(0);
    expect(store.has('user_profile:dormant-user:personal_info')).toBe(true);
  });

  it('counts a deleted client, who is also flagged suspended by deleteClient()', async () => {
    // Mirrors exactly what deleteClient() writes: BOTH flags.
    seedSubject('deleted-user', { suspended: true, deleted: true, deletedAt: LONG_AGO });

    const { scanned, eligible } = await assessRetention(NOW);

    expect(scanned).toBe(1);
    expect(eligible.map((c) => c.userId)).toEqual(['deleted-user']);
  });
});

describe('when the window applies', () => {
  it('retains a deleted client still inside the 7 years', async () => {
    seedSubject('recent-closure', { deleted: true, suspended: true, deletedAt: RECENT });

    const result = await runClientRetentionSweep({ apply: true, now: NOW });

    expect(result.retained).toBe(1);
    expect(result.eligible).toEqual([]);
    expect(store.has('user_profile:recent-closure:personal_info')).toBe(true);
  });

  it('erases a deleted client past the 7 years, across every namespace', async () => {
    seedSubject('expired', { deleted: true, suspended: true, deletedAt: LONG_AGO });

    const result = await runClientRetentionSweep({ apply: true, now: NOW });

    expect(result.erased).toEqual(['expired']);
    expect(result.keysRemoved).toBe(5);
    for (const key of [
      'security:expired',
      'user_profile:expired:personal_info',
      'auth_log:expired:1',
      'audit:expired:1',
      'activity:expired:1',
    ]) {
      expect(store.has(key), `${key} should be erased`).toBe(false);
    }
  });

  it('puts the boundary exactly 7 years back', () => {
    expect(RETENTION_YEARS).toBe(7);
    expect(retentionBoundary(NOW).toISOString()).toBe('2019-08-29T12:00:00.000Z');
  });

  it('is inclusive at the boundary — a closure exactly 7 years old is due', async () => {
    seedSubject('exactly-due', {
      deleted: true,
      deletedAt: retentionBoundary(NOW).toISOString(),
    });

    const { eligible } = await assessRetention(NOW);

    expect(eligible.map((c) => c.userId)).toEqual(['exactly-due']);
  });
});

describe('erasing one subject does not reach another', () => {
  it('does not erase a user id that merely starts with the same characters', async () => {
    // `abc` and `abcdef` share a prefix. A scan keyed on the bare id would take
    // both, and the second client is not even closed. This is the failure that
    // would be discovered years later, by its victim.
    seedSubject('abc', { deleted: true, deletedAt: LONG_AGO });
    seedSubject('abcdef', { deleted: false, suspended: false });

    const result = await runClientRetentionSweep({ apply: true, now: NOW });

    expect(result.erased).toEqual(['abc']);
    expect(store.has('security:abc')).toBe(false);
    expect(store.has('security:abcdef')).toBe(true);
    expect(store.has('user_profile:abcdef:personal_info')).toBe(true);
    expect(store.has('audit:abcdef:1')).toBe(true);
  });
});

describe('a sweep writes nothing unless asked to', () => {
  it('defaults to reporting only', async () => {
    seedSubject('expired', { deleted: true, deletedAt: LONG_AGO });

    const result = await runClientRetentionSweep({ now: NOW });

    expect(result.applied).toBe(false);
    expect(result.eligible).toHaveLength(1);
    expect(result.erased).toEqual([]);
    expect(store.has('security:expired')).toBe(true);
  });

  it('writes no erasure log on a dry run', async () => {
    seedSubject('expired', { deleted: true, deletedAt: LONG_AGO });

    await runClientRetentionSweep({ now: NOW });

    expect([...store.keys()].some((k) => k.startsWith('erasure_log:'))).toBe(false);
  });
});

describe('an unusable closure date is never treated as an expired one', () => {
  it('blocks a deleted client with no deletedAt', async () => {
    seedSubject('no-timestamp', { deleted: true, suspended: true });

    const result = await runClientRetentionSweep({ apply: true, now: NOW });

    expect(result.blocked).toEqual([
      { userId: 'no-timestamp', reason: 'missing-deletion-timestamp', found: null },
    ]);
    expect(result.erased).toEqual([]);
    expect(store.has('user_profile:no-timestamp:personal_info')).toBe(true);
  });

  it('blocks a deleted client whose deletedAt does not parse', async () => {
    seedSubject('bad-timestamp', { deleted: true, deletedAt: 'not a date' });

    const result = await runClientRetentionSweep({ apply: true, now: NOW });

    expect(result.blocked).toEqual([
      { userId: 'bad-timestamp', reason: 'unparseable-deletion-timestamp', found: 'not a date' },
    ]);
    expect(store.has('security:bad-timestamp')).toBe(true);
  });
});

describe('the audit trail POPIA asks for', () => {
  it('records the subjects and the boundary, but not their data', async () => {
    seedSubject('expired', { deleted: true, deletedAt: LONG_AGO }, {});

    await runClientRetentionSweep({ apply: true, now: NOW });

    const entry = [...store.entries()].find(([k]) => k.startsWith('erasure_log:client_retention:'));
    expect(entry, 'an erasure must leave a record').toBeDefined();

    const value = entry![1] as Record<string, unknown>;
    expect(value.subjects).toEqual(['expired']);
    expect(value.boundary).toBe(retentionBoundary(NOW).toISOString());
    expect(value.keysRemoved).toBe(5);
    // Recording the erased content would defeat the erasure it documents.
    expect(JSON.stringify(value)).not.toContain('personal_info');
  });
});

describe('one run cannot clear the store', () => {
  it('caps the batch and says so', async () => {
    for (let i = 0; i < 60; i += 1) {
      seedSubject(`user-${String(i).padStart(3, '0')}`, {
        deleted: true,
        deletedAt: LONG_AGO,
      });
    }

    const result = await runClientRetentionSweep({ apply: true, now: NOW });

    expect(result.eligible).toHaveLength(60);
    expect(result.erased).toHaveLength(50);
    expect(result.cappedAtLimit).toBe(true);
    // The ten left behind are still there for the next run.
    expect([...store.keys()].filter((k) => k.startsWith('security:'))).toHaveLength(10);
  });

  it('erases oldest closure first, so a capped run follows the obligation order', async () => {
    seedSubject('newer', { deleted: true, deletedAt: '2018-01-01T00:00:00.000Z' });
    seedSubject('oldest', { deleted: true, deletedAt: '2010-01-01T00:00:00.000Z' });

    const { eligible } = await assessRetention(NOW);

    expect(eligible.map((c) => c.userId)).toEqual(['oldest', 'newer']);
  });
});
