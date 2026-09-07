/**
 * Session revocation on credential change — the behaviour, not the plumbing.
 * ==========================================================================
 *
 * The defect these cover: `updateUser({ password })` and
 * `admin.updateUserById(id, { password })` both rotate the credential and
 * leave every issued token alive. A user who changes their password because
 * someone else has it did not evict that someone.
 *
 * The two properties worth pinning are the ones that are easy to get subtly
 * backwards, and both were got backwards once while this was being written:
 *
 *   1. A self-service change must NOT sign the caller out. The watermark goes
 *      at the caller's own `iat`, not at `now` — a `now` watermark refuses the
 *      very token that authorised the change, on the caller's next request.
 *
 *   2. An admin reset MUST end every session, including any the target has
 *      open right now, because that is what an administrative reset is for.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Deno runtime shim ────────────────────────────────────────────────────────
// `session-revocation.ts` builds its Supabase client from `Deno.env`. Without
// this the constructor throws, `revokeGoTrueSessions` swallows it, and the
// GoTrue half silently never runs — which is exactly the failure mode this
// file exists to catch, so it must not be the harness causing it.
vi.stubGlobal('Deno', { env: { get: () => 'test-value' } });

const kvMock = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  get: vi.fn(async (key: string) => kvMock.store.get(key) ?? null),
  set: vi.fn(async (key: string, value: unknown) => {
    kvMock.store.set(key, value);
  }),
}));
vi.mock('../kv_store.tsx', () => ({ get: kvMock.get, set: kvMock.set }));

const adminSignOut = vi.hoisted(() => vi.fn(async () => ({ error: null })));
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({ auth: { admin: { signOut: adminSignOut } } }),
}));

vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { revokeSessionsAfterCredentialChange, stampSessionsValidFrom } from '../session-revocation';
import { enforceAccountSecurity } from '../auth-mw';

/** A token whose payload carries the given claims. Signature is never checked. */
function tokenWith(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64(claims)}.sig`;
}

const SECONDS = 1000;

beforeEach(() => {
  kvMock.store.clear();
  vi.clearAllMocks();
});

describe('stampSessionsValidFrom', () => {
  it('merges into the existing security record instead of replacing it', async () => {
    // A blind overwrite here would un-suspend an account as a side effect of
    // changing its password — the record also carries the suspension and 2FA
    // state that `enforceAccountSecurity` reads.
    kvMock.store.set('security:u1', { suspended: true, twoFactorEnabled: true });

    await stampSessionsValidFrom('u1', new Date('2026-05-01T10:00:00Z'));

    expect(kvMock.store.get('security:u1')).toMatchObject({
      suspended: true,
      twoFactorEnabled: true,
      sessionsValidFrom: '2026-05-01T10:00:00.000Z',
    });
  });

  it('reports failure rather than throwing when the store is unavailable', async () => {
    // The password has already changed by the time this runs; throwing would
    // report failure for an operation that succeeded.
    kvMock.set.mockRejectedValueOnce(new Error('kv down'));
    await expect(stampSessionsValidFrom('u1')).resolves.toBe(false);
  });
});

describe('revokeSessionsAfterCredentialChange', () => {
  it('self-service: watermarks at the caller’s own token, so the caller survives', async () => {
    const iat = Math.floor(Date.parse('2026-05-01T10:00:00Z') / 1000);
    const result = await revokeSessionsAfterCredentialChange({
      userId: 'u1',
      actor: 'self',
      accessToken: tokenWith({ sub: 'u1', iat }),
    });

    expect(result.validFrom).toBe('2026-05-01T10:00:00.000Z');
    // Not `now` — that is the whole point.
    expect(Date.parse(result.validFrom)).toBeLessThan(Date.now());
  });

  it('self-service: asks GoTrue to end the OTHER sessions', async () => {
    const token = tokenWith({ sub: 'u1', iat: 1_760_000_000 });
    await revokeSessionsAfterCredentialChange({
      userId: 'u1',
      actor: 'self',
      accessToken: token,
      scope: 'others',
    });
    expect(adminSignOut).toHaveBeenCalledWith(token, 'others');
  });

  it('admin reset: watermarks at now and does NOT call GoTrue', async () => {
    const before = Date.now();
    const result = await revokeSessionsAfterCredentialChange({ userId: 'u2', actor: 'admin' });

    expect(Date.parse(result.validFrom)).toBeGreaterThanOrEqual(before);
    // There is no token for the target user, so there is nothing GoTrue can be
    // asked to revoke — the watermark is the entire mechanism on this path.
    expect(adminSignOut).not.toHaveBeenCalled();
    expect(result.goTrueRevoked).toBe(false);
  });

  it('still watermarks when GoTrue refuses the revocation', async () => {
    adminSignOut.mockResolvedValueOnce({ error: { message: 'nope' } } as never);
    const result = await revokeSessionsAfterCredentialChange({
      userId: 'u1',
      actor: 'self',
      accessToken: tokenWith({ sub: 'u1', iat: 1_760_000_000 }),
    });
    expect(result.goTrueRevoked).toBe(false);
    expect(result.stamped).toBe(true);
  });
});

describe('enforceAccountSecurity — the watermark is what refuses the old token', () => {
  it('rejects a token minted before the watermark', async () => {
    const cutoff = Date.parse('2026-05-01T10:00:00Z');
    kvMock.store.set('security:u1', { sessionsValidFrom: new Date(cutoff).toISOString() });

    const staleIat = Math.floor((cutoff - 60 * SECONDS) / 1000);
    await expect(enforceAccountSecurity('u1', staleIat)).rejects.toMatchObject({
      code: 'SESSION_REVOKED',
      statusCode: 401,
    });
  });

  it('admits a token minted after the watermark', async () => {
    const cutoff = Date.parse('2026-05-01T10:00:00Z');
    kvMock.store.set('security:u1', { sessionsValidFrom: new Date(cutoff).toISOString() });

    const freshIat = Math.floor((cutoff + 60 * SECONDS) / 1000);
    await expect(enforceAccountSecurity('u1', freshIat)).resolves.toBeUndefined();
  });

  it('admits the token minted in the SAME second as the watermark', async () => {
    // `iat` has second granularity, so the session that performed the change
    // can share a second with its own watermark. Rejecting it would sign the
    // user out of the change they just made.
    const cutoff = Date.parse('2026-05-01T10:00:00Z');
    kvMock.store.set('security:u1', { sessionsValidFrom: new Date(cutoff).toISOString() });

    await expect(enforceAccountSecurity('u1', Math.floor(cutoff / 1000))).resolves.toBeUndefined();
  });

  it('FAILS OPEN when the iat cannot be read', async () => {
    // Callers without the raw token to hand (ai-intelligence, tasks-digest)
    // pass null. Turning "cannot tell" into a 401 would lock every user of
    // those paths out on the first password change anyone performs.
    kvMock.store.set('security:u1', { sessionsValidFrom: new Date().toISOString() });
    await expect(enforceAccountSecurity('u1', null)).resolves.toBeUndefined();
    await expect(enforceAccountSecurity('u1')).resolves.toBeUndefined();
  });

  it('still enforces suspension — revocation did not displace the older rules', async () => {
    kvMock.store.set('security:u1', {
      suspended: true,
      sessionsValidFrom: new Date(0).toISOString(),
    });
    await expect(enforceAccountSecurity('u1', 2_000_000_000)).rejects.toMatchObject({
      code: 'ACCOUNT_SUSPENDED',
    });
  });
});
