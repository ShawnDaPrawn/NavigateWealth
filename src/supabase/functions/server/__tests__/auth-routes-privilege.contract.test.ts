/**
 * auth-routes.ts + auth-admin-routes.ts — Privilege Boundaries
 * ===========================================================
 *
 * The other half of the auth surface: the routes that could create an account,
 * change a role, reset anyone's password, or read the security dashboard.
 * `auth-routes.contract.test.ts` covers anti-enumeration and rate limiting.
 *
 * What this file protects:
 *
 *   - **There is one signup door, and it proves address ownership.** A second
 *     `POST /auth/signup` created accounts with `email_confirm: true` for any
 *     address, unauthenticated. Combined with an email-based super-admin
 *     allowlist that contained an address with no account, it was a
 *     one-request super-admin. It is gone, and pinned gone.
 *   - **`/security-status` authorises on the TRUSTED role.** It used to verify
 *     the token by hand and then read `role` off the caller's KV profile — a
 *     second role source nothing else trusts. It now goes through
 *     `requireAdmin`, which also applies the suspended/deleted/2FA policy.
 *   - **No shared-secret account utilities.** `create-superadmin` and
 *     `ensure-dev-user` took nothing but a static secret in the body and could
 *     mint a super-admin or reset ANY account's password — the owner's
 *     included — with no audit record. Both are gone, and they stay gone even
 *     when the old secret is presented. `clear-rate-limit` survives behind a
 *     super-admin session, and every use is audited.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kvStore } from './helpers/contract-harness.ts';
import {
  CLEAN_IP,
  STRONG_PASSWORD,
  SUPER_ADMIN,
  USER_ID,
  auditRecord,
  resetAuthMocks,
  seedProfile,
  supa,
} from './helpers/auth-routes-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: {
      get: (k: string) =>
        k === 'SUPER_ADMIN_PASSWORD'
          ? 'the-shared-super-admin-secret'
          : k === 'SUPABASE_URL'
            ? 'https://test.supabase.co'
            : 'test',
    },
  };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

vi.mock('jsr:@supabase/supabase-js@2.49.8', async () =>
  (await import('./helpers/auth-routes-harness.ts')).makeSupabaseMock(),
);

vi.mock('../admin-audit-service.ts', async () => ({
  AdminAuditService: { record: (await import('./helpers/auth-routes-harness.ts')).auditRecord },
}));

const app = (await import('../auth-routes.ts')).default;

const SECRET = 'the-shared-super-admin-secret';

function post(path: string, body: unknown, { token }: { token?: string } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'CF-Connecting-IP': CLEAN_IP,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return app.request(path, { method: 'POST', headers, body: JSON.stringify(body) });
}

/**
 * Signs the caller in as `role`. `resolveTrustedRole` trusts `app_metadata`
 * (and the super-admin email allowlist) and explicitly ignores a privileged
 * role in the client-editable `user_metadata`, so the fixture puts it where the
 * real code looks.
 */
function actingAs(role: string, { email = 'admin@navigatewealth.co', id = USER_ID } = {}) {
  supa.getUser.mockResolvedValue({
    data: { user: { id, email, app_metadata: { role }, user_metadata: {} } },
    error: null,
  });
  return { id, email };
}

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  resetAuthMocks();
});

// ============================================================================
// ONE SIGNUP DOOR — the pre-verified second one is gone
// ============================================================================

describe('the retired POST /auth/signup', () => {
  it('no longer creates accounts, whatever it is sent', async () => {
    // The exact request that made anyone a super-admin: an allowlisted address
    // with no account yet, created pre-verified with a password of the
    // caller's choosing.
    const res = await post('/signup', {
      email: 'shawn.africantreasures@gmail.com',
      password: STRONG_PASSWORD,
      metadata: { role: 'super_admin' },
    });
    expect(res.status).toBe(404);
    expect(supa.createUser).not.toHaveBeenCalled();
  });
});

// ============================================================================
// SECURITY STATUS — the dashboard a suspended admin must not reach
// ============================================================================

describe('security status', () => {
  const get = (token?: string) =>
    app.request('/security-status', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  it('refuses a request with no credential', async () => {
    const res = await get();
    expect(res.status).toBe(401);
    expect(supa.getUser).not.toHaveBeenCalled();
  });

  it('refuses an invalid token', async () => {
    supa.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });
    const res = await get('nope');
    expect(res.status).toBe(401);
  });

  it.each(['admin', 'super_admin', 'super-admin'])('lets a %s read the stats', async (role) => {
    actingAs(role);
    seedProfile(role);
    const res = await get('good');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, stats: expect.any(Object) });
  });

  it.each(['client', 'adviser', 'paraplanner', 'compliance', 'worker'])(
    'refuses a %s',
    async (role) => {
      actingAs(role);
      seedProfile(role);
      const res = await get('good');
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe('FORBIDDEN_ADMIN');
    },
  );

  it('does not trust a role written on the KV profile', async () => {
    // The route used to authorise on `user_profile:{id}:personal_info.role` — a
    // field no other guard trusts. The trusted role here is 'client'.
    actingAs('client');
    seedProfile('admin');
    const res = await get('good');
    expect(res.status).toBe(403);
  });

  it('does not trust a privileged role in client-editable user_metadata', async () => {
    supa.getUser.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: 'mallory@example.com',
          app_metadata: {},
          user_metadata: { role: 'admin' },
        },
      },
      error: null,
    });
    seedProfile('admin');
    expect((await get('good')).status).toBe(403);
  });

  it.each([
    ['a suspended account', { suspended: true }, 'ACCOUNT_SUSPENDED'],
    ['a closed account', { deleted: true }, 'ACCOUNT_DELETED'],
    [
      'an account whose 2FA verification has gone stale',
      { twoFactorEnabled: true, last2faVerifiedAt: '2020-01-01T00:00:00.000Z' },
      'TWO_FACTOR_REQUIRED',
    ],
    [
      'an account with 2FA on and no verification recorded',
      { twoFactorEnabled: true },
      'TWO_FACTOR_REQUIRED',
    ],
  ])('refuses %s even when the role is admin', async (_label, security, code) => {
    // This handler verifies the token itself instead of going through
    // requireAdmin, and so had skipped this check entirely. A suspended admin
    // reading the security dashboard is exactly what suspension is for.
    actingAs('admin');
    seedProfile('admin');
    kvStore.set(`security:${USER_ID}`, security);
    const res = await get('good');
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe(code);
  });

  it('allows an admin whose CURRENT session passed 2FA recently', async () => {
    actingAs('admin');
    kvStore.set(`security:${USER_ID}`, { twoFactorEnabled: true });
    kvStore.set(`2fa_sessions:${USER_ID}`, { 'sess-A': new Date().toISOString() });
    const b64 = (o: unknown) =>
      btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const token = `${b64({ alg: 'HS256' })}.${b64({ sub: USER_ID, session_id: 'sess-A' })}.sig`;
    expect((await get(token)).status).toBe(200);
  });

  it('refuses an admin whose account verified 2FA on a DIFFERENT session', async () => {
    // Account-wide verification no longer unlocks every sign-in.
    actingAs('admin');
    kvStore.set(`security:${USER_ID}`, {
      twoFactorEnabled: true,
      last2faVerifiedAt: new Date().toISOString(),
    });
    kvStore.set(`2fa_sessions:${USER_ID}`, { 'someone-else': new Date().toISOString() });
    const res = await get('good');
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('TWO_FACTOR_REQUIRED');
  });

  it('reports the stats it computes from the auth log', async () => {
    actingAs('admin');
    seedProfile('admin');
    const now = new Date().toISOString();
    kvStore.set(`auth_log:${now}:e1`, { timestamp: now, type: 'login_failure', success: false });
    kvStore.set(`auth_log:${now}:e2`, { timestamp: now, type: 'login_success', success: true });
    kvStore.set(`auth_log:${now}:e3`, { timestamp: now, type: 'account_locked', success: false });
    const { stats } = await (await get('good')).json();
    expect(stats).toMatchObject({
      totalEvents: 3,
      failedLogins24h: 1,
      successfulLogins24h: 1,
      accountLocks24h: 1,
    });
  });
});

// ============================================================================
// CONFIRM EMAIL — super-admin only, and still says nothing about who exists
// ============================================================================

describe('confirm email', () => {
  const confirm = (email: string, token = 'good') => post('/confirm-email', { email }, { token });

  it('refuses a caller with no credential', async () => {
    const res = await app.request('/confirm-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'legacy@example.com' }),
    });
    expect(res.status).toBe(401);
    expect(supa.listUsers).not.toHaveBeenCalled();
  });

  it.each(['admin', 'adviser', 'compliance', 'client'])('refuses a %s', async (role) => {
    actingAs(role);
    const res = await confirm('legacy@example.com');
    expect(res.status).toBe(403);
    // Not even a lookup: an admin must not be able to probe which addresses
    // exist through this route.
    expect(supa.listUsers).not.toHaveBeenCalled();
  });

  it('confirms an unconfirmed legacy user for a super admin', async () => {
    actingAs('super_admin');
    supa.listUsers.mockResolvedValue({
      data: { users: [{ id: 'legacy-1', email: 'legacy@example.com', email_confirmed_at: null }] },
      error: null,
    });
    const res = await confirm('legacy@example.com');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ confirmed: true });
    expect(supa.updateUserById).toHaveBeenCalledWith('legacy-1', { email_confirm: true });
  });

  it('matches the address case-insensitively', async () => {
    actingAs('super_admin');
    supa.listUsers.mockResolvedValue({
      data: { users: [{ id: 'legacy-1', email: 'Legacy@Example.com', email_confirmed_at: null }] },
      error: null,
    });
    expect((await confirm('legacy@example.com')).status).toBe(200);
    expect(supa.updateUserById).toHaveBeenCalled();
  });

  it('says nothing about an address that has no account', async () => {
    // 200 with `confirmed: false`, not 404 — the same shape a failed update
    // returns, so the response cannot be used to enumerate accounts.
    actingAs('super_admin');
    supa.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    const res = await confirm('nobody@example.com');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ confirmed: false });
    expect(supa.updateUserById).not.toHaveBeenCalled();
  });

  it('does nothing for an account that is already confirmed', async () => {
    actingAs('super_admin');
    supa.listUsers.mockResolvedValue({
      data: {
        users: [
          { id: 'ok-1', email: 'ok@example.com', email_confirmed_at: '2026-01-01T00:00:00.000Z' },
        ],
      },
      error: null,
    });
    const res = await confirm('ok@example.com');
    expect(await res.json()).toEqual({ confirmed: true, alreadyConfirmed: true });
    expect(supa.updateUserById).not.toHaveBeenCalled();
    // No state change means no audit entry.
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('audits a confirmation at warning severity', async () => {
    actingAs('super_admin', { email: SUPER_ADMIN });
    supa.listUsers.mockResolvedValue({
      data: { users: [{ id: 'legacy-1', email: 'legacy@example.com', email_confirmed_at: null }] },
      error: null,
    });
    await confirm('legacy@example.com');
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'security',
        action: 'legacy_email_confirmed',
        severity: 'warning',
        entityType: 'user',
        entityId: 'legacy-1',
      }),
    );
  });

  it('reports a listing failure as a 500 without confirming anything', async () => {
    actingAs('super_admin');
    supa.listUsers.mockResolvedValue({ data: { users: null }, error: { message: 'rate limited' } });
    const res = await confirm('legacy@example.com');
    expect(res.status).toBe(500);
    expect(supa.updateUserById).not.toHaveBeenCalled();
  });

  it('reports a failed update as an unconfirmed result, not an error', async () => {
    actingAs('super_admin');
    supa.listUsers.mockResolvedValue({
      data: { users: [{ id: 'legacy-1', email: 'legacy@example.com', email_confirmed_at: null }] },
      error: null,
    });
    supa.updateUserById.mockResolvedValue({ data: null, error: { message: 'conflict' } });
    const res = await confirm('legacy@example.com');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ confirmed: false });
    expect(auditRecord).not.toHaveBeenCalled();
  });
});

// ============================================================================
// ADMIN UTILITIES — no shared-secret account doors
// ============================================================================

describe('retired shared-secret utilities', () => {
  it.each([
    [
      '/create-superadmin',
      { secretKey: SECRET, email: 'owner@example.com', password: STRONG_PASSWORD },
    ],
    ['/ensure-dev-user', { secretKey: SECRET, email: SUPER_ADMIN, password: STRONG_PASSWORD }],
  ])('%s is gone — even with the correct secret', async (path, body) => {
    // The correct secret is used on purpose. The problem was never a weak
    // comparison; it was that one static string could reset the owner's
    // password or mint a super-admin in a single request, with no session,
    // no rate limit and no audit record.
    supa.listUsers.mockResolvedValue({
      data: { users: [{ id: 'sa-1', email: SUPER_ADMIN }] },
      error: null,
    });
    const res = await post(path, body);
    expect(res.status).toBe(404);
    expect(supa.createUser).not.toHaveBeenCalled();
    expect(supa.updateUserById).not.toHaveBeenCalled();
  });
});

describe('clear-rate-limit', () => {
  const clear = (body: Record<string, unknown>, token?: string) =>
    post('/clear-rate-limit', body, { token });

  it('no longer accepts the shared secret in place of a session', async () => {
    kvStore.set('ratelimit:login:user@example.com', { attempts: 5 });
    const res = await clear({ secretKey: SECRET, email: 'user@example.com' });
    expect(res.status).toBe(401);
    expect(kvStore.has('ratelimit:login:user@example.com')).toBe(true);
  });

  it.each(['admin', 'adviser', 'client'])('refuses a %s', async (role) => {
    actingAs(role);
    kvStore.set('ratelimit:login:user@example.com', { attempts: 5 });
    const res = await clear({ email: 'user@example.com' }, 'good');
    expect(res.status).toBe(403);
    expect(kvStore.has('ratelimit:login:user@example.com')).toBe(true);
  });

  it('clears the normalised account bucket for a super-admin, and audits it', async () => {
    actingAs('super_admin', { email: SUPER_ADMIN });
    kvStore.set('ratelimit:login:user@example.com', { attempts: 5 });
    kvStore.set('ratelimit:block:login:user@example.com', { blockedUntil: Date.now() + 1000 });
    const res = await clear({ email: ' User@Example.com ' }, 'good');
    expect(res.status).toBe(200);
    expect(kvStore.has('ratelimit:login:user@example.com')).toBe(false);
    expect(kvStore.has('ratelimit:block:login:user@example.com')).toBe(false);
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'security',
        action: 'login_rate_limit_cleared',
        actorId: USER_ID,
      }),
    );
  });

  it("does not clear the caller's own IP bucket", async () => {
    // The locked-out client is somewhere else. Clearing the calling IP only
    // ever handed the caller a fresh set of guesses.
    actingAs('super_admin', { email: SUPER_ADMIN });
    kvStore.set(`ratelimit:login:${CLEAN_IP}`, { attempts: 5 });
    await clear({ email: 'user@example.com' }, 'good');
    expect(kvStore.has(`ratelimit:login:${CLEAN_IP}`)).toBe(true);
  });

  it('refuses a body with no email, which would clear nothing and report success', async () => {
    actingAs('super_admin', { email: SUPER_ADMIN });
    const res = await clear({}, 'good');
    expect(res.status).toBe(400);
  });
});
