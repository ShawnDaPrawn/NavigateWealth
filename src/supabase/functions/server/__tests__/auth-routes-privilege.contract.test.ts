/**
 * auth-routes.ts + auth-admin-routes.ts — Privilege Boundaries
 * ===========================================================
 *
 * The other half of the auth surface: the routes that can create an account,
 * change a role, reset anyone's password, or read the security dashboard.
 * `auth-routes.contract.test.ts` covers anti-enumeration and rate limiting.
 *
 * What this file protects:
 *
 *   - **Signup metadata cannot carry a role.** The auth middleware derives role
 *     from metadata, so accepting a caller-supplied `role` on signup is a
 *     one-request self-provisioned super admin. The handler strips `role`,
 *     `accountStatus`, `adviserAssigned` and `suspended`; that strip is asserted
 *     per key, because a refactor that rebuilt the object from a spread would
 *     reinstate all four at once and nothing else would fail.
 *   - **`app_metadata` is the authoritative role source.** `resolveTrustedRole`
 *     only trusts `app_metadata` (user_metadata is client-editable), so a
 *     created super admin whose role landed only in `user_metadata` would not
 *     actually be one. Both admin-creation routes are asserted to set it.
 *   - **`/security-status` verifies its own token** rather than going through
 *     `requireAdmin`, and so once skipped the suspended/deleted/stale-2FA check
 *     entirely. `enforceAccountSecurity` is now pinned on it — a suspended admin
 *     must not be able to read the security dashboard.
 *   - **The three admin utilities share one secret** and compare it in constant
 *     time, because a plain `!==` leaks how many bytes the caller guessed. Two of
 *     the three had drifted to `!==` before; the comparison being *timing-safe*
 *     cannot be asserted directly, so what is pinned is the behaviour that comes
 *     with it: the same 403 for a wrong key of any length, and fail-closed when
 *     the secret is unset.
 *   - **`/ensure-dev-user` can reset ANY account's password**, including the
 *     super-admin's. It is the highest-risk route in the module and its gate is
 *     asserted from every angle.
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
// SIGNUP METADATA — a role the caller asks for is a role the caller gets
// ============================================================================

describe('signup metadata stripping', () => {
  const signup = (metadata: Record<string, unknown>) =>
    post('/signup', { email: 'new@example.com', password: STRONG_PASSWORD, metadata });

  const createdMetadata = () =>
    (supa.createUser.mock.calls[0][0] as { user_metadata: Record<string, unknown> }).user_metadata;

  it.each(['role', 'accountStatus', 'adviserAssigned', 'suspended'])(
    'drops a caller-supplied %s',
    async (key) => {
      await signup({ [key]: 'super_admin', firstName: 'Mallory' });
      expect(createdMetadata()).not.toHaveProperty(key);
      // The rest of the metadata still arrives — this is a targeted strip, not
      // a whitelist that would silently drop real profile fields.
      expect(createdMetadata()).toMatchObject({ firstName: 'Mallory' });
    },
  );

  it('drops all four at once', async () => {
    await signup({
      role: 'super_admin',
      accountStatus: 'active',
      adviserAssigned: 'adviser-1',
      suspended: false,
      firstName: 'Mallory',
      surname: 'Attacker',
    });
    expect(createdMetadata()).toEqual({ firstName: 'Mallory', surname: 'Attacker' });
  });

  it('does not mutate the caller-supplied object into the response', async () => {
    // The strip works on a copy. If it mutated and then echoed, a client could
    // still observe which keys were removed — harmless here, but the copy is
    // also what stops a later read of `metadata` seeing the privileged value.
    supa.createUser.mockResolvedValue({
      data: { user: { id: USER_ID, email: 'new@example.com', app_metadata: {} } },
      error: null,
    });
    const res = await signup({ role: 'super_admin' });
    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).not.toContain('super_admin');
  });

  it('accepts a signup with no metadata at all', async () => {
    await post('/signup', { email: 'new@example.com', password: STRONG_PASSWORD });
    expect(createdMetadata()).toEqual({});
  });

  it('auto-confirms the email so the account can sign in', async () => {
    await signup({});
    expect(supa.createUser.mock.calls[0][0]).toMatchObject({ email_confirm: true });
  });

  it('surfaces a Supabase rejection as a 400, not a 500', async () => {
    supa.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'A user with this email address has already been registered' },
    });
    const res = await post('/signup', { email: 'taken@example.com', password: STRONG_PASSWORD });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('already been registered');
  });

  it('reports a created-but-empty response as a 500', async () => {
    supa.createUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await post('/signup', { email: 'new@example.com', password: STRONG_PASSWORD });
    expect(res.status).toBe(500);
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
      expect((await res.json()).error).toBe('Forbidden - Admin access required');
    },
  );

  it('refuses a token whose profile does not exist', async () => {
    // The role comes from the KV profile here, not from the token. No profile
    // means no established role, which must not default to admin.
    actingAs('admin');
    const res = await get('good');
    expect(res.status).toBe(403);
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

  it('allows an admin whose 2FA was verified recently', async () => {
    actingAs('admin');
    seedProfile('admin');
    kvStore.set(`security:${USER_ID}`, {
      twoFactorEnabled: true,
      last2faVerifiedAt: new Date().toISOString(),
    });
    expect((await get('good')).status).toBe(200);
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
// THE THREE ADMIN UTILITIES — one shared secret, compared in constant time
// ============================================================================

const UTILITIES: { name: string; path: string; body: (secretKey: unknown) => unknown }[] = [
  {
    name: 'create-superadmin',
    path: '/create-superadmin',
    body: (secretKey) => ({ secretKey, email: 'owner@example.com', password: STRONG_PASSWORD }),
  },
  {
    name: 'clear-rate-limit',
    path: '/clear-rate-limit',
    body: (secretKey) => ({ secretKey, email: 'user@example.com' }),
  },
  {
    name: 'ensure-dev-user',
    path: '/ensure-dev-user',
    body: (secretKey) => ({ secretKey, email: 'dev@example.com', password: STRONG_PASSWORD }),
  },
];

describe('admin utility secret gate', () => {
  it.each(UTILITIES)('$name refuses a wrong secret', async (u) => {
    const res = await post(u.path, u.body('wrong-secret'));
    expect(res.status).toBe(403);
    expect(supa.createUser).not.toHaveBeenCalled();
    expect(supa.updateUserById).not.toHaveBeenCalled();
  });

  it.each(UTILITIES)('$name refuses a secret of any wrong length', async (u) => {
    // A `!==` short-circuits at the first differing byte, so response time
    // correlates with how much of the secret the caller already has. The
    // comparison is `constantTimeEqual`; what is observable from here is that
    // every wrong key — one character, a prefix of the real one, the real one
    // with a byte appended, the right characters in the wrong case — gets the
    // same 403 and the same body.
    const bodies: string[] = [];
    for (const wrong of ['a', SECRET.slice(0, -1), `${SECRET}x`, SECRET.toUpperCase()]) {
      const res = await post(u.path, u.body(wrong));
      expect(res.status).toBe(403);
      bodies.push(await res.text());
    }
    expect(new Set(bodies).size).toBe(1);
  });

  it.each(UTILITIES)('$name rejects an empty secret at the schema, not the gate', async (u) => {
    // `secretKey: z.string().min(1)` means the empty string never reaches the
    // comparison. 400 rather than 403 — worth pinning so the difference is a
    // recorded decision rather than a surprise during a support call.
    const res = await post(u.path, u.body(''));
    expect(res.status).toBe(400);
  });

  it.each(UTILITIES)('$name refuses a non-string secret', async (u) => {
    for (const wrong of [null, 0, false, { toString: () => SECRET }]) {
      const res = await post(u.path, u.body(wrong));
      expect([400, 403]).toContain(res.status);
    }
    expect(supa.createUser).not.toHaveBeenCalled();
  });

  it.each(UTILITIES)('$name rejects a body with no secret before the gate runs', async (u) => {
    // The zod gate is middleware, so a request that is both malformed and
    // unauthorised answers 400 rather than 403. Neither response says anything
    // about the secret, so the ordering leaks nothing.
    const body = u.body(undefined) as Record<string, unknown>;
    delete body.secretKey;
    const res = await post(u.path, body);
    expect(res.status).toBe(400);
  });
});

describe('create-superadmin', () => {
  const create = (over: Record<string, unknown> = {}) =>
    post('/create-superadmin', {
      secretKey: SECRET,
      email: 'owner@example.com',
      password: STRONG_PASSWORD,
      ...over,
    });

  it('creates the account with the role in app_metadata', async () => {
    supa.createUser.mockResolvedValue({
      data: { user: { id: 'sa-new', email: 'owner@example.com' } },
      error: null,
    });
    const res = await create();
    expect(res.status).toBe(201);
    const payload = supa.createUser.mock.calls[0][0] as Record<string, unknown>;
    // `resolveTrustedRole` reads app_metadata and ignores a privileged role in
    // user_metadata, so an account created with the role ONLY in user_metadata
    // would come back as a plain client on its first request.
    expect(payload.app_metadata).toEqual({ role: 'super_admin' });
    expect(payload).toMatchObject({ email_confirm: true });
  });

  it('writes the KV profile the rest of the app reads', async () => {
    supa.createUser.mockResolvedValue({
      data: { user: { id: 'sa-new', email: 'owner@example.com' } },
      error: null,
    });
    await create();
    expect(kvStore.get('user_profile:sa-new:personal_info')).toMatchObject({
      role: 'super_admin',
      email: 'owner@example.com',
    });
  });

  it('refuses to create a second account for an existing address', async () => {
    supa.listUsers.mockResolvedValue({
      data: { users: [{ id: 'existing', email: 'owner@example.com' }] },
      error: null,
    });
    const res = await create();
    expect(res.status).toBe(409);
    expect(supa.createUser).not.toHaveBeenCalled();
  });

  it('rejects a weak password before creating anything', async () => {
    const res = await create({ password: 'short' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Password does not meet security requirements');
    expect(supa.createUser).not.toHaveBeenCalled();
  });

  it('rejects a malformed email before creating anything', async () => {
    const res = await create({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(supa.createUser).not.toHaveBeenCalled();
  });
});

describe('clear-rate-limit', () => {
  it('clears the email bucket and the calling IP', async () => {
    kvStore.set('ratelimit:login:user@example.com', { attempts: 5 });
    kvStore.set(`ratelimit:login:${CLEAN_IP}`, { attempts: 5 });
    kvStore.set(`ratelimit:block:login:${CLEAN_IP}`, { blockedUntil: Date.now() + 1000 });
    const res = await post('/clear-rate-limit', { secretKey: SECRET, email: 'user@example.com' });
    expect(res.status).toBe(200);
    expect(kvStore.has('ratelimit:login:user@example.com')).toBe(false);
    expect(kvStore.has(`ratelimit:login:${CLEAN_IP}`)).toBe(false);
    expect(kvStore.has(`ratelimit:block:login:${CLEAN_IP}`)).toBe(false);
  });

  it('still clears the email bucket when no client IP is present', async () => {
    kvStore.set('ratelimit:login:user@example.com', { attempts: 5 });
    const res = await app.request('/clear-rate-limit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secretKey: SECRET, email: 'user@example.com' }),
    });
    expect(res.status).toBe(200);
    expect(kvStore.has('ratelimit:login:user@example.com')).toBe(false);
    // 'unknown' is the placeholder `getClientIP` returns; clearing a bucket
    // under that key would clear it for every caller with no IP header.
    expect(kvStore.has('ratelimit:login:unknown')).toBe(false);
  });

  it('refuses a body with no email, which would clear nothing and report success', async () => {
    const res = await post('/clear-rate-limit', { secretKey: SECRET });
    expect(res.status).toBe(400);
  });
});

describe('ensure-dev-user', () => {
  const ensure = (over: Record<string, unknown> = {}) =>
    post('/ensure-dev-user', {
      secretKey: SECRET,
      email: 'dev@example.com',
      password: STRONG_PASSWORD,
      ...over,
    });

  it('resets the password of an existing account', async () => {
    supa.listUsers.mockResolvedValue({
      data: { users: [{ id: 'dev-1', email: 'dev@example.com' }] },
      error: null,
    });
    const res = await ensure();
    expect(res.status).toBe(200);
    expect(supa.updateUserById).toHaveBeenCalledWith('dev-1', {
      password: STRONG_PASSWORD,
      email_confirm: true,
    });
    expect(supa.createUser).not.toHaveBeenCalled();
  });

  it('creates the account when it does not exist, with the role in app_metadata', async () => {
    supa.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    supa.createUser.mockResolvedValue({
      data: { user: { id: 'dev-new', email: 'dev@example.com' } },
      error: null,
    });
    const res = await ensure();
    expect(res.status).toBe(200);
    expect(supa.createUser.mock.calls[0][0]).toMatchObject({
      email_confirm: true,
      app_metadata: { role: 'admin' },
    });
    expect(supa.updateUserById).not.toHaveBeenCalled();
  });

  it('matches an existing account case-insensitively rather than creating a duplicate', async () => {
    supa.listUsers.mockResolvedValue({
      data: { users: [{ id: 'dev-1', email: 'Dev@Example.com' }] },
      error: null,
    });
    await ensure();
    expect(supa.createUser).not.toHaveBeenCalled();
    expect(supa.updateUserById).toHaveBeenCalled();
  });

  it('can be pointed at the super-admin address, which is why the gate matters', async () => {
    // Stated rather than implied: this route resets ANY account's password. The
    // secret is the only thing between it and a one-request takeover, and the
    // tests above cover every way of getting the secret wrong.
    supa.listUsers.mockResolvedValue({
      data: { users: [{ id: 'sa-1', email: SUPER_ADMIN }] },
      error: null,
    });
    const refused = await post('/ensure-dev-user', {
      secretKey: 'guess',
      email: SUPER_ADMIN,
      password: STRONG_PASSWORD,
    });
    expect(refused.status).toBe(403);
    expect(supa.updateUserById).not.toHaveBeenCalled();

    const allowed = await ensure({ email: SUPER_ADMIN });
    expect(allowed.status).toBe(200);
  });

  it('reports a listing failure as a 500', async () => {
    supa.listUsers.mockResolvedValue({ data: { users: null }, error: { message: 'boom' } });
    expect((await ensure()).status).toBe(500);
  });

  it('surfaces a failed password update as a 400', async () => {
    supa.listUsers.mockResolvedValue({
      data: { users: [{ id: 'dev-1', email: 'dev@example.com' }] },
      error: null,
    });
    supa.updateUserById.mockResolvedValue({ data: null, error: { message: 'weak password' } });
    expect((await ensure()).status).toBe(400);
  });

  it.each([
    ['no email', { email: undefined }],
    ['no password', { password: undefined }],
  ])('refuses a body with %s', async (_label, over) => {
    const body = {
      secretKey: SECRET,
      email: 'dev@example.com',
      password: STRONG_PASSWORD,
      ...over,
    };
    for (const [k, v] of Object.entries(over)) if (v === undefined) delete (body as never)[k];
    const res = await post('/ensure-dev-user', body);
    expect(res.status).toBe(400);
    expect(supa.listUsers).not.toHaveBeenCalled();
  });
});
