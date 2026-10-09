/**
 * Two-factor verifications, stored per sign-in.
 * =============================================
 *
 * The account-security gate treats a null verification time as "this session
 * has not passed 2FA" and refuses the request. A NaN does not: `null` fails
 * the check, and `Date.now() - NaN >= grace` is false, so the user is
 * admitted. An unreadable stamp has to come back null.
 *
 * Recording prunes entries that have already aged out of the same window the
 * gate uses, and it must not refresh some other session's stamp while it
 * writes this one — that would extend a sign-in the user is not in.
 */
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test' } });
});

const store = new Map<string, unknown>();

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (key: string) => store.get(key) ?? null),
  set: vi.fn(async (key: string, value: unknown) => {
    store.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    store.delete(key);
  }),
  mget: vi.fn(async (keys: string[]) => keys.map((key) => store.get(key) ?? null)),
  mset: vi.fn(async () => {}),
  mdel: vi.fn(async () => {}),
  getByPrefix: vi.fn(async () => []),
  listByPrefix: vi.fn(async () => []),
}));

const {
  TWO_FACTOR_GRACE_MS,
  TWO_FACTOR_SESSION_NAMESPACE,
  sessionTwoFactorVerifiedAt,
  recordSessionTwoFactor,
  clearSessionTwoFactor,
} = await import('../repositories/two-factor-session-repository.ts');

const USER = 'user-1';
const KEY = `${TWO_FACTOR_SESSION_NAMESPACE}${USER}`;
const NOW = new Date('2026-10-09T12:00:00.000Z');

beforeEach(() => {
  store.clear();
});

describe('sessionTwoFactorVerifiedAt', () => {
  it('returns the epoch milliseconds of a real stamp', async () => {
    store.set(KEY, { 'sess-A': '2026-10-09T09:00:00.000Z' });
    expect(await sessionTwoFactorVerifiedAt(USER, 'sess-A')).toBe(
      Date.parse('2026-10-09T09:00:00.000Z'),
    );
  });

  it('returns null when this session has no stamp', async () => {
    expect(await sessionTwoFactorVerifiedAt(USER, 'sess-A')).toBeNull();
    store.set(KEY, { 'sess-B': NOW.toISOString() });
    expect(await sessionTwoFactorVerifiedAt(USER, 'sess-A')).toBeNull();
  });

  it('returns null, not NaN, when the stamp cannot be read as a time', async () => {
    // NaN would pass the gate: it is not null, and `now - NaN >= grace` is
    // false, so a corrupt row would count as verified.
    store.set(KEY, { 'sess-A': 'not-a-date', 'sess-B': 1_700_000_000_000 });
    expect(await sessionTwoFactorVerifiedAt(USER, 'sess-A')).toBeNull();
    expect(await sessionTwoFactorVerifiedAt(USER, 'sess-B')).toBeNull();
  });
});

describe('recordSessionTwoFactor', () => {
  it('drops a session that has aged out of the grace window and keeps one still inside it', async () => {
    const expired = new Date(NOW.getTime() - TWO_FACTOR_GRACE_MS).toISOString();
    const live = new Date(NOW.getTime() - TWO_FACTOR_GRACE_MS + 1).toISOString();
    store.set(KEY, {
      expired,
      live,
      corrupt: 'nope',
    });

    await recordSessionTwoFactor(USER, 'sess-new', NOW);

    expect(store.get(KEY)).toEqual({
      live,
      'sess-new': NOW.toISOString(),
    });
  });

  it("does not move another session's stamp forward", async () => {
    const earlier = new Date(NOW.getTime() - 60_000).toISOString();
    store.set(KEY, { 'sess-A': earlier });

    await recordSessionTwoFactor(USER, 'sess-B', NOW);

    expect(store.get(KEY)).toEqual({
      'sess-A': earlier,
      'sess-B': NOW.toISOString(),
    });
  });

  it('starts a record when the user has none', async () => {
    await recordSessionTwoFactor(USER, 'sess-A', NOW);
    expect(store.get(KEY)).toEqual({ 'sess-A': NOW.toISOString() });
  });
});

describe('clearSessionTwoFactor', () => {
  it('forgets every verified session for the user', async () => {
    await recordSessionTwoFactor(USER, 'sess-A', NOW);
    await clearSessionTwoFactor(USER);
    expect(store.has(KEY)).toBe(false);
    expect(await sessionTwoFactorVerifiedAt(USER, 'sess-A')).toBeNull();
  });
});
