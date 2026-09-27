/**
 * auth-routes.ts — Anti-Enumeration, Rate Limiting & the IP Blocklist
 * ==================================================================
 *
 * The routes handling login, password reset, signup validation and logout.
 * What they protect is not a data shape — it is the absence of information,
 * and the absence of a way around the lockout. Four properties, each of which
 * fails silently:
 *
 *   1. **Anti-enumeration.** `POST /password-reset` returns the SAME message
 *      and the SAME 200 whether the request succeeded, was rate-limited on
 *      either axis, carried a malformed address, or met a limiter outage. That
 *      uniformity IS the feature. `/login` answers "Invalid credentials" for
 *      a wrong password and an unknown account alike.
 *   2. **Rate limiting on two axes.** Signup validation, login and password
 *      reset each check the IP *and* the (normalised) email. Dropping either
 *      leaves a brute-force path open, and the ORDER matters: the IP check must
 *      short-circuit so a distributed attempt cannot exhaust the email bucket
 *      for a victim who never tried to log in. `checkRateLimit` **fails
 *      closed**. The email bucket is keyed on the trimmed, lower-cased address,
 *      because GoTrue matches addresses case-insensitively and a raw key gave
 *      every spelling of one account a fresh budget of guesses.
 *   3. **The owner exemption is narrow.** The single `SUPER_ADMIN_EMAIL` skips
 *      the per-ACCOUNT lockout (so a stranger cannot lock the owner out) and
 *      nothing else — it is still limited per IP. It used to skip both, which
 *      meant unlimited guesses against the most privileged account.
 *   4. **No side doors.** The unauthenticated routes that used to sit beside
 *      these — a pre-verified `/signup`, `/login-success` (which RESET the
 *      lockout for any address), `/login-validate`, `/login-failure`,
 *      `/password-reset-request` and the shared-secret account utilities —
 *      are gone, and pinned gone.
 *
 * WHAT IS REAL: the rate limiter, the auth logger and its email/IP masking, the
 * password and email validators, the IP blocklist and the zod schemas all run
 * as they ship. See `helpers/auth-routes-harness.ts`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kvStore } from './helpers/contract-harness.ts';
import {
  BLOCKED_IP,
  CLEAN_IP,
  STRONG_PASSWORD,
  SUPER_ADMIN,
  authEvents,
  decision,
  lastAuthEvent,
  limitOnly,
  resetAuthMocks,
  supa,
  USER_ID,
} from './helpers/auth-routes-harness.ts';

/**
 * Per-test environment overrides, consulted before the fixed answers below.
 *
 * Needed since the reset-link destination started being checked against
 * `NW_ALLOWED_ORIGINS` (see `isTrustedRedirectOrigin`): a test about which
 * origins are trusted has to be able to say what the allow-list contains.
 * Cleared in `beforeEach`, so one test's allow-list is never another's.
 */
const denoEnv = vi.hoisted(() => new Map<string, string>());

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: {
      get: (k: string) =>
        denoEnv.has(k)
          ? denoEnv.get(k)
          : k === 'SUPABASE_URL'
            ? 'https://test.supabase.co'
            : k === 'SUPER_ADMIN_PASSWORD'
              ? 'sekrit'
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

/** Posts a JSON body with a client IP, the way Cloudflare presents one. */
function post(
  path: string,
  body: unknown,
  {
    ip = CLEAN_IP,
    agent = 'vitest/1.0',
    bearer,
  }: { ip?: string; agent?: string; bearer?: string } = {},
) {
  return app.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip,
      'User-Agent': agent,
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** A bearer token carrying `sub` and `iat`; the harness never checks a signature. */
function sessionToken(sub = USER_ID, iat = Math.floor(Date.now() / 1000)): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ sub, iat })}.sig`;
}

const GENERIC_RESET_MESSAGE =
  'If an account exists with this email, a password reset link has been sent.';

beforeEach(async () => {
  denoEnv.clear();
  kvStore.clear();
  vi.clearAllMocks();
  resetAuthMocks();

  // `vi.clearAllMocks()` clears CALLS but keeps implementations, so a test that
  // makes the KV store fail (see "reports a 500 when a login-success log cannot
  // be written") leaves it failing for everything after it in this file. That
  // is invisible until a later test asserts on a logged event and finds none —
  // which is precisely how it was found. Restore the store's behaviour here so
  // failure injection stays scoped to the test that asked for it.
  const kv = await import('../kv_store.tsx');
  vi.mocked(kv.set).mockImplementation(async (key: string, value: unknown) => {
    kvStore.set(key, structuredClone(value));
  });
  vi.mocked(kv.del).mockImplementation(async (key: string) => {
    kvStore.delete(key);
  });
});

// ============================================================================
// ANTI-ENUMERATION — five different outcomes, one indistinguishable response
// ============================================================================

describe('password reset does not reveal whether an account exists', () => {
  const RESET = '/password-reset';

  it.each([
    ['a well-formed request', () => undefined],
    ['an IP that is over its limit', () => limitOnly(CLEAN_IP)],
    ['an email that is over its limit', () => limitOnly('victim@example.com')],
    ['a malformed email', () => undefined],
    ['a rate limiter that is down', () => supa.rpc.mockRejectedValue(new Error('db down'))],
  ])('answers identically for %s', async (label, arrange) => {
    arrange();
    const email = label === 'a malformed email' ? 'not-an-email' : 'victim@example.com';
    const res = await post(RESET, { email });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: GENERIC_RESET_MESSAGE });
  });

  it('never returns a 4xx, even when rate limited', async () => {
    // A 429 here would be an oracle: an attacker learns their address hit a
    // per-email bucket, which only exists for addresses that were submitted.
    limitOnly('victim@example.com');
    const res = await post(RESET, { email: 'victim@example.com' });
    expect(res.status).toBe(200);
    expect(await res.json()).not.toHaveProperty('error');
  });

  it('still records the refusal in the auth log', async () => {
    // The response is silent; the log is not. Rate-limited resets must remain
    // visible to whoever reviews the security dashboard.
    limitOnly(CLEAN_IP);
    await post(RESET, { email: 'victim@example.com' });
    expect(lastAuthEvent()).toMatchObject({
      type: 'password_reset_request',
      success: false,
      errorMessage: 'Rate limit exceeded (ip)',
    });
  });

  it('never looks the account up to decide what to answer', async () => {
    await post(RESET, { email: 'real@example.com' });
    expect(supa.listUsers).not.toHaveBeenCalled();
    expect(supa.getUser).not.toHaveBeenCalled();
  });
});

describe('login does not reveal whether an account exists', () => {
  it.each([
    ['a malformed email', 'not-an-email'],
    ['an email with no domain', 'user@'],
    ['an email that is only a domain', '@example.com'],
  ])('answers 401 "Invalid credentials" for %s', async (_label, email) => {
    const res = await post('/login', { email, password: STRONG_PASSWORD });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
  });

  it('does not answer with a 500 when the body is malformed JSON', async () => {
    // A 500 with a stack would be both an information leak and a different
    // response from the rejection path.
    const res = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': CLEAN_IP },
      body: '{"email":"a@b.com"',
    });
    expect([400, 401]).toContain(res.status);
  });
});

// ============================================================================
// RETIRED ROUTES — the side doors stay shut
// ============================================================================

describe('retired unauthenticated routes', () => {
  it.each([
    // Created a PRE-VERIFIED account for any address, unauthenticated and
    // unlimited. With a super-admin allowlist address that had no account yet,
    // that was a one-request route to super-admin.
    ['/signup', { email: 'shawn.africantreasures@gmail.com', password: STRONG_PASSWORD }],
    // Reset the login lockout for any address, unauthenticated — unlimited
    // password guessing through /login.
    ['/login-success', { email: 'victim@example.com', userId: 'u-1' }],
    ['/login-validate', { email: 'victim@example.com' }],
    ['/login-failure', { email: 'victim@example.com', reason: 'forged' }],
    ['/password-reset-request', { email: 'victim@example.com' }],
    // Shared-secret account utilities: reset ANY password / mint a super-admin.
    ['/ensure-dev-user', { secretKey: 'sekrit', email: SUPER_ADMIN, password: STRONG_PASSWORD }],
    [
      '/create-superadmin',
      { secretKey: 'sekrit', email: 'x@example.com', password: STRONG_PASSWORD },
    ],
  ])('%s no longer exists', async (path, body) => {
    const res = await post(path, body);
    expect(res.status).toBe(404);
    expect(supa.createUser).not.toHaveBeenCalled();
    expect(supa.updateUserById).not.toHaveBeenCalled();
  });

  it('cannot clear a lockout by reporting a "successful" login', async () => {
    // The concrete bypass: five guesses, then a forged login-success to wipe
    // the counters, repeated forever.
    kvStore.set('ratelimit:login:victim@example.com', { attempts: 5 });
    kvStore.set('ratelimit:block:login:victim@example.com', { blockedUntil: Date.now() + 60_000 });
    await post('/login-success', { email: 'victim@example.com', userId: 'u-1' });
    expect(kvStore.has('ratelimit:login:victim@example.com')).toBe(true);
    expect(kvStore.has('ratelimit:block:login:victim@example.com')).toBe(true);
  });
});

// ============================================================================
// THE AUTH LOG — a security record that must not become a PII store
// ============================================================================

describe('auth log privacy', () => {
  const login = (email: string, opts?: { ip?: string; agent?: string }) =>
    post('/login', { email, password: STRONG_PASSWORD }, opts);

  it('masks the email and the IP before storing an event', async () => {
    await login('thabo.mokoena@example.com', { ip: '196.25.1.7' });
    const event = lastAuthEvent();
    // The log is read by the admin dashboard and retained for the FAIS period,
    // so it holds enough to investigate and not enough to be a mailing list.
    expect(event?.email).toBe('th***@example.com');
    expect(event?.ip).toBe('196.25.*.*');
  });

  it('never stores the full address anywhere in the event', async () => {
    await login('thabo.mokoena@example.com', { ip: '196.25.1.7' });
    const serialised = JSON.stringify(authEvents());
    expect(serialised).not.toContain('thabo.mokoena@example.com');
    expect(serialised).not.toContain('196.25.1.7');
  });

  it('leaves a very short local part alone rather than mangling it', async () => {
    await login('ab@example.com');
    expect(lastAuthEvent()?.email).toBe('ab@example.com');
  });

  it('keeps the user agent, which is not personal data on its own', async () => {
    await login('a@example.com', { agent: 'Mozilla/5.0 probe' });
    expect(lastAuthEvent()?.userAgent).toBe('Mozilla/5.0 probe');
  });
});

// ============================================================================
// RATE LIMITING — two axes, ordered, failing closed
// ============================================================================

describe('rate limiting', () => {
  const CASES: [string, string, string][] = [
    ['signup', '/signup-validate', 'signup'],
    ['login', '/login', 'login'],
    ['password reset', '/password-reset', 'password_reset'],
  ];

  it.each(CASES)('%s checks the IP and the email', async (_label, path, action) => {
    await post(path, { email: 'user@example.com', password: STRONG_PASSWORD });
    const identifiers = supa.rpc.mock.calls
      .filter(([, args]) => (args as { p_action: string }).p_action === action)
      .map(([, args]) => (args as { p_identifier: string }).p_identifier);
    // Dropping either axis leaves a brute-force path: rotate IPs, or spray
    // addresses from one IP.
    expect(identifiers).toEqual([CLEAN_IP, 'user@example.com']);
  });

  it.each(CASES)(
    '%s keys the email bucket on the normalised address',
    async (_label, path, action) => {
      // GoTrue matches addresses case-insensitively, so `User@Example.COM` is
      // the same account as `user@example.com`. A raw key gave each spelling a
      // fresh budget — five more guesses per variant against one password.
      await post(path, { email: '  User@Example.COM ', password: STRONG_PASSWORD });
      const identifiers = supa.rpc.mock.calls
        .filter(([, args]) => (args as { p_action: string }).p_action === action)
        .map(([, args]) => (args as { p_identifier: string }).p_identifier);
      expect(identifiers).toContain('user@example.com');
      expect(identifiers).not.toContain('  User@Example.COM ');
    },
  );

  it.each(CASES)('%s stops at the IP without touching the email bucket', async (_l, path) => {
    // Order matters. If the email bucket were checked first, a distributed
    // attempt could exhaust a victim's own limit and lock them out of an
    // account they never tried to use.
    limitOnly(CLEAN_IP);
    await post(path, { email: 'victim@example.com', password: STRONG_PASSWORD });
    const identifiers = supa.rpc.mock.calls.map(
      ([, args]) => (args as { p_identifier: string }).p_identifier,
    );
    expect(identifiers).toEqual([CLEAN_IP]);
  });

  it.each([
    ['signup', '/signup-validate', 429, 'Too many signup attempts. Please try again later.'],
    ['login', '/login', 429, 'Too many login attempts. Please try again later.'],
  ])('%s answers %i once over the limit', async (_label, path, status, error) => {
    limitOnly(CLEAN_IP);
    const res = await post(path, { email: 'user@example.com', password: STRONG_PASSWORD });
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ error, blocked: true });
  });

  it('tells the caller when they may retry', async () => {
    const resetAt = Date.parse('2026-06-01T12:00:00.000Z');
    supa.rpc.mockResolvedValue(decision({ allowed: false, resetAt }));
    const res = await post('/login', { email: 'user@example.com', password: STRONG_PASSWORD });
    expect(new Date((await res.json()).resetAt).getTime()).toBe(resetAt);
  });

  it.each(CASES)('%s fails CLOSED when the rate limiter is unreachable', async (_l, path) => {
    // The limiter runs as a Postgres RPC. During a database incident the choice
    // is between refusing logins and disabling brute-force protection entirely;
    // `checkRateLimit` catches and returns `allowed: false`. Pinned because a
    // well-meaning "don't fail the request on a limiter error" is the exact
    // change that turns an outage into an open door.
    supa.rpc.mockRejectedValue(new Error('connection refused'));
    const res = await post(path, { email: 'user@example.com', password: STRONG_PASSWORD });
    expect([200, 429]).toContain(res.status);
    if (res.status === 200) {
      // password-reset answers 200 for anti-enumeration reasons — but it must
      // still have refused, which the log records.
      expect(lastAuthEvent()).toMatchObject({ success: false });
    }
    expect(supa.signInWithPassword).not.toHaveBeenCalled();
    expect(supa.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('records an account lock separately from a plain refusal', async () => {
    // `account_locked` is what the security dashboard counts; a lock that only
    // logged `login_attempt` would be invisible on it.
    limitOnly(CLEAN_IP, { blocked: true });
    await post('/login', { email: 'victim@example.com', password: STRONG_PASSWORD });
    const types = authEvents().map((e) => e.type);
    expect(types).toContain('login_attempt');
    expect(types).toContain('account_locked');
  });

  it('does not record a lock for a refusal that is not a lock', async () => {
    limitOnly(CLEAN_IP, { blocked: false });
    await post('/login', { email: 'victim@example.com', password: STRONG_PASSWORD });
    expect(authEvents().map((e) => e.type)).not.toContain('account_locked');
  });

  it('clears both buckets on a successful login — and only then', async () => {
    // Only clearing one leaves the other counter running, so a user who just
    // signed in successfully can still be locked out minutes later.
    supa.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: USER_ID, email: 'user@example.com' },
        session: { access_token: 'at', refresh_token: 'rt' },
      },
      error: null,
    });
    kvStore.set(`ratelimit:login:${CLEAN_IP}`, { attempts: 4 });
    kvStore.set('ratelimit:login:user@example.com', { attempts: 4 });
    kvStore.set(`ratelimit:block:login:${CLEAN_IP}`, { blockedUntil: Date.now() + 1000 });
    const res = await post('/login', { email: 'User@Example.com', password: STRONG_PASSWORD });
    expect(res.status).toBe(200);
    expect(kvStore.has(`ratelimit:login:${CLEAN_IP}`)).toBe(false);
    expect(kvStore.has('ratelimit:login:user@example.com')).toBe(false);
    expect(kvStore.has(`ratelimit:block:login:${CLEAN_IP}`)).toBe(false);
    expect(lastAuthEvent()).toMatchObject({ type: 'login_success', success: true });
  });

  it('does not clear anything on a failed login', async () => {
    kvStore.set('ratelimit:login:user@example.com', { attempts: 4 });
    await post('/login', { email: 'user@example.com', password: 'wrong' });
    expect(kvStore.has('ratelimit:login:user@example.com')).toBe(true);
  });
});

// ============================================================================
// THE OWNER EXEMPTION — narrow on purpose, and narrower than it was
// ============================================================================

describe('owner-address login exemption', () => {
  const identifiersFor = () =>
    supa.rpc.mock.calls
      .filter(([, args]) => (args as { p_action: string }).p_action === 'login')
      .map(([, args]) => (args as { p_identifier: string }).p_identifier);

  it('skips the per-ACCOUNT bucket, so a stranger cannot lock the owner out', async () => {
    await post('/login', { email: SUPER_ADMIN, password: 'guess' });
    expect(identifiersFor()).toEqual([CLEAN_IP]);
  });

  it('is still limited per IP — no unlimited guesses at the most privileged account', async () => {
    // The exemption used to skip BOTH buckets, which meant a single IP could
    // guess the owner's password without limit.
    limitOnly(CLEAN_IP, { blocked: true });
    const res = await post('/login', { email: SUPER_ADMIN, password: 'guess' });
    expect(res.status).toBe(429);
    expect(supa.signInWithPassword).not.toHaveBeenCalled();
  });

  it.each([SUPER_ADMIN.toUpperCase(), 'Shawn@NavigateWealth.co', ` ${SUPER_ADMIN} `])(
    'treats %p as the owner address (normalised)',
    async (email) => {
      await post('/login', { email, password: 'guess' });
      expect(identifiersFor()).toEqual([CLEAN_IP]);
    },
  );

  it.each([
    'admin@navigatewealth.co',
    'shawn@navigatewealth.com',
    'shawn+alias@navigatewealth.co',
    'shawn@navigatewealth.co.evil.test',
    'shawn.africantreasures@gmail.com',
  ])('applies the per-account bucket to %p', async (email) => {
    // The list above is the set of addresses a reviewer might assume are "the
    // same person". None of them is the single hardcoded owner identity — not
    // even the other allowlisted super-admin address (SECURITY-AUDIT A10).
    await post('/login', { email, password: 'guess' });
    expect(identifiersFor()).toEqual([CLEAN_IP, email]);
  });

  it('exempts only login, not signup validation or password reset', async () => {
    // Extending it to the other two would give the owner address an unlimited
    // password-reset firehose.
    await post('/password-reset', { email: SUPER_ADMIN });
    expect(
      supa.rpc.mock.calls.map(([, args]) => (args as { p_identifier: string }).p_identifier),
    ).toEqual([CLEAN_IP, SUPER_ADMIN]);
    supa.rpc.mockClear();
    await post('/signup-validate', { email: SUPER_ADMIN, password: STRONG_PASSWORD });
    expect(
      supa.rpc.mock.calls.map(([, args]) => (args as { p_identifier: string }).p_identifier),
    ).toEqual([CLEAN_IP, SUPER_ADMIN]);
  });
});

// ============================================================================
// THE IP BLOCKLIST — refused before anything else happens
// ============================================================================

describe('blocked IP addresses', () => {
  it.each([
    ['/signup-validate', { email: 'a@example.com', password: STRONG_PASSWORD }],
    ['/login', { email: 'a@example.com', password: STRONG_PASSWORD }],
  ])('refuses %s from a blocked address', async (path, body) => {
    const res = await post(path, body, { ip: BLOCKED_IP });
    expect(res.status).toBe(403);
    // Refused before the limiter and before any credential check — the whole
    // point of a blocklist is that it costs nothing downstream.
    expect(supa.rpc).not.toHaveBeenCalled();
    expect(supa.signInWithPassword).not.toHaveBeenCalled();
    expect(supa.createUser).not.toHaveBeenCalled();
  });

  it('answers signup validation with the structured block payload', async () => {
    const res = await post(
      '/signup-validate',
      { email: 'a@example.com', password: STRONG_PASSWORD },
      { ip: BLOCKED_IP },
    );
    expect(await res.json()).toMatchObject({
      blocked: true,
      warning: true,
      blockedIpAddress: BLOCKED_IP,
    });
  });

  it('records the refusal without the submitted email', async () => {
    // The handler logs `undefined` for the email here: the request never got
    // far enough to be treated as an account operation.
    await post(
      '/signup-validate',
      { email: 'a@example.com', password: STRONG_PASSWORD },
      { ip: BLOCKED_IP },
    );
    const event = lastAuthEvent();
    expect(event).toMatchObject({ type: 'signup_attempt', success: false });
    expect(event?.email).toBeUndefined();
  });

  it('recognises a blocked address behind a port', async () => {
    const res = await post(
      '/signup-validate',
      { email: 'a@example.com', password: STRONG_PASSWORD },
      { ip: `${BLOCKED_IP}:44321` },
    );
    expect(res.status).toBe(403);
  });

  it('recognises a blocked address first in an X-Forwarded-For chain', async () => {
    const res = await app.request('/signup-validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `${BLOCKED_IP}, 10.0.0.1, 172.16.0.1`,
      },
      body: JSON.stringify({ email: 'a@example.com', password: STRONG_PASSWORD }),
    });
    expect(res.status).toBe(403);
  });

  it('does not block an address that merely contains the blocked one', async () => {
    const res = await post(
      '/signup-validate',
      { email: 'a@example.com', password: STRONG_PASSWORD },
      { ip: `1${BLOCKED_IP}` },
    );
    expect(res.status).not.toBe(403);
  });

  it('lets a clean address through', async () => {
    const res = await post('/signup-validate', {
      email: 'a@example.com',
      password: STRONG_PASSWORD,
      firstName: 'Thabo',
      surname: 'Mokoena',
    });
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// SIGNUP VALIDATION — the checks that run before an account can exist
// ============================================================================

const SIGNUP_VALIDATE = '/signup-validate';
const validSignup = (over: Record<string, unknown> = {}) => ({
  email: 'thabo@example.com',
  password: STRONG_PASSWORD,
  firstName: 'Thabo',
  surname: 'Mokoena',
  ...over,
});

describe('signup validation', () => {
  it('passes a well-formed signup and returns the sanitised names', async () => {
    const res = await post(SIGNUP_VALIDATE, validSignup());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      valid: true,
      sanitized: { firstName: 'Thabo', surname: 'Mokoena' },
    });
  });

  it('strips markup from the names it echoes back', async () => {
    // These names are stored and later rendered in the admin UI and in emails.
    // `sanitizeInput` is the boundary, and this route is where it runs.
    const res = await post(
      SIGNUP_VALIDATE,
      validSignup({ firstName: '<script>alert(1)</script>Thabo', surname: 'Mokoena<img src=x>' }),
    );
    const { sanitized } = await res.json();
    expect(sanitized.firstName).not.toContain('<script');
    expect(sanitized.surname).not.toContain('<img');
  });

  it('rejects a weak password and says which rules it broke', async () => {
    const res = await post(SIGNUP_VALIDATE, validSignup({ password: 'password' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({
      error: 'Password does not meet security requirements',
      field: 'password',
    });
    // The caller gets the specific rules so the UI can list them — the one
    // place in this module where being specific is correct, because it is the
    // caller's own password and reveals nothing about anyone else.
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it.each([
    ['too short', 'Kh1!Zwe'],
    ['only two character classes', 'khimbazwelithu'],
    ['a common word', 'Str0ng!Passw0rd#2026'],
    ['sequential characters', 'Kh1mba!abcZwe#7'],
    ['repeated characters', 'Kh1mba!!!Zwelithu#7'],
  ])('rejects a password that is %s', async (_label, password) => {
    const res = await post(SIGNUP_VALIDATE, validSignup({ password }));
    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe('password');
  });

  it('records the weak-password refusal without the password itself', async () => {
    // The rejected string is deliberately a distinctive one that appears in no
    // rule message, so its absence from the log means the attempt was not
    // echoed — asserting on a word like "password" would only re-find it inside
    // "Password must be at least 12 characters long".
    const attempted = 'qwertzuiop-vhondo';
    await post(SIGNUP_VALIDATE, validSignup({ password: attempted }));
    const serialised = JSON.stringify(authEvents());
    expect(serialised).toContain('Weak password');
    expect(serialised).not.toContain(attempted);
  });

  it.each([
    ['a malformed email', { email: 'not-an-email' }, 'email'],
    ['a missing first name', { firstName: '' }, 'firstName'],
    ['a whitespace-only first name', { firstName: '   ' }, 'firstName'],
    ['a missing surname', { surname: '' }, 'surname'],
    ['a whitespace-only surname', { surname: '   ' }, 'surname'],
  ])('rejects %s and names the field', async (_label, over, field) => {
    const res = await post(SIGNUP_VALIDATE, validSignup(over));
    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe(field);
  });

  it('rejects an invalid phone number when one is supplied', async () => {
    const res = await post(SIGNUP_VALIDATE, validSignup({ phoneNumber: '12', countryCode: '+27' }));
    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe('phoneNumber');
  });

  it('accepts a signup with no phone number at all', async () => {
    // The field is optional; validating an absent value would block signups.
    const res = await post(SIGNUP_VALIDATE, validSignup());
    expect(res.status).toBe(200);
  });

  it('accepts a valid South African number', async () => {
    const res = await post(
      SIGNUP_VALIDATE,
      validSignup({ phoneNumber: '0821234567', countryCode: '+27' }),
    );
    expect(res.status).toBe(200);
  });

  it.each([
    ['no email', { password: STRONG_PASSWORD }],
    ['an empty email', { email: '', password: STRONG_PASSWORD }],
    ['no password', { email: 'a@example.com' }],
  ])('refuses a body with %s before any work happens', async (_label, body) => {
    // The zod gate runs as middleware, ahead of the blocklist and the limiter,
    // so a body missing `email` can never reach `checkRateLimit(undefined, …)`
    // and bucket every anonymous attempt together.
    const res = await post(SIGNUP_VALIDATE, body);
    expect(res.status).toBe(400);
    expect(supa.rpc).not.toHaveBeenCalled();
  });

  it('accepts extra fields rather than failing a caller that sends more', async () => {
    // Every auth schema is `.passthrough()` on purpose: this is a gate against
    // missing required input, not a closed contract.
    const res = await post(SIGNUP_VALIDATE, validSignup({ marketingSource: 'referral' }));
    expect(res.status).toBe(200);
  });

  it('records a passing validation as a successful attempt', async () => {
    await post(SIGNUP_VALIDATE, validSignup());
    expect(lastAuthEvent()).toMatchObject({
      type: 'signup_attempt',
      success: true,
      metadata: { validation: 'passed' },
    });
  });
});

// ============================================================================
// SESSION EVENTS — authenticated, and logging must never break the flow
// ============================================================================

describe('session events', () => {
  const asUser = () =>
    supa.getUser.mockResolvedValue({
      data: { user: { id: USER_ID, email: 'user@example.com', app_metadata: {} } },
      error: null,
    });

  it('refuses an anonymous logout record', async () => {
    // It used to take email + userId from an anonymous body, so anyone could
    // write sign-out entries into any account's security log.
    const res = await post('/logout', { email: 'user@example.com', userId: 'u-1' });
    expect(res.status).toBe(401);
    expect(authEvents()).toEqual([]);
  });

  it('logs a logout for the TOKEN’s user and ignores the body', async () => {
    asUser();
    const res = await post(
      '/logout',
      { email: 'victim@example.com', userId: 'someone-else' },
      { bearer: sessionToken() },
    );
    expect(res.status).toBe(200);
    expect(lastAuthEvent()).toMatchObject({ type: 'logout', success: true, userId: USER_ID });
  });

  it('still reports success when the logout log cannot be written', async () => {
    // "Don't fail logout on logging error" — a user who clicks sign out must
    // end up signed out even if KV is unavailable, or they are stuck in a
    // session they are actively trying to leave.
    asUser();
    const kv = await import('../kv_store.tsx');
    vi.mocked(kv.set).mockRejectedValueOnce(new Error('kv unavailable'));
    const res = await post('/logout', {}, { bearer: sessionToken() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  describe('POST /password-change — now authenticated, and it revokes', () => {
    /**
     * This route used to take `email` and `userId` from an UNAUTHENTICATED
     * body. That made it two things: a way to write entries into a stranger's
     * security log, and — once it started revoking sessions — a way to sign an
     * arbitrary user out by asserting their id. It now derives the identity
     * from the token and ignores the body entirely.
     */
    it('refuses an unauthenticated caller', async () => {
      const res = await post('/password-change', { email: 'user@example.com', userId: 'u-1' });
      expect(res.status).toBe(401);
    });

    it('logs the change and stamps the revocation watermark for the TOKEN’s user', async () => {
      asUser();

      // The body names somebody else on purpose: if the route still trusted it,
      // this request would revoke that person's sessions instead.
      const res = await post(
        '/password-change',
        { email: 'victim@example.com', userId: 'someone-else' },
        { bearer: sessionToken() },
      );

      expect(res.status).toBe(200);
      expect(lastAuthEvent()).toMatchObject({ type: 'password_change', success: true });

      const security = kvStore.get(`security:${USER_ID}`) as { sessionsValidFrom?: string };
      expect(security?.sessionsValidFrom).toEqual(expect.any(String));
      expect(kvStore.get('security:someone-else')).toBeUndefined();
    });
  });
});

describe('POST /login — the rate limit is IN the auth path, not beside it', () => {
  /**
   * The defect: `/login-validate` answered "may I try?", and then the BROWSER
   * authenticated against GoTrue on its own. Nothing made the second step
   * depend on the first, so a caller that skipped the question — or was never
   * a browser — never met the 5-in-15 lockout at all.
   *
   * This route does both in one handler. The tests that matter are therefore
   * about ORDERING and about what is NOT reached: a rate-limited attempt must
   * never get as far as `signInWithPassword`, or the limiter is decorative
   * again in a different place.
   */
  const creds = { email: 'user@example.com', password: STRONG_PASSWORD };

  function succeeds() {
    supa.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: USER_ID, email: 'user@example.com' },
        session: { access_token: 'at', refresh_token: 'rt' },
      },
      error: null,
    });
  }

  it('returns the session on correct credentials', async () => {
    succeeds();
    const res = await post('/login', creds);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      session: { access_token: 'at', refresh_token: 'rt' },
    });
    expect(lastAuthEvent()).toMatchObject({ type: 'login_success', success: true });
  });

  it('does not call the auth provider at all once the IP is rate-limited', async () => {
    // THE test for this change. If `signInWithPassword` runs here, an attacker
    // still gets a credential oracle out of a "blocked" response.
    limitOnly(CLEAN_IP, { blocked: true });
    const res = await post('/login', creds);

    expect(res.status).toBe(429);
    expect(supa.signInWithPassword).not.toHaveBeenCalled();
  });

  it('does not call the auth provider once the EMAIL is rate-limited', async () => {
    limitOnly('user@example.com', { blocked: true });
    const res = await post('/login', creds);

    expect(res.status).toBe(429);
    expect(supa.signInWithPassword).not.toHaveBeenCalled();
  });

  it('checks the IP before the email, so spraying cannot lock out a victim', async () => {
    limitOnly(CLEAN_IP, { blocked: true });
    await post('/login', creds);

    // The email bucket must be untouched: a distributed attempt against one
    // address should not be able to lock its owner out of their own account.
    const identifiers = supa.rpc.mock.calls.map(
      (call) => (call[1] as { p_identifier: string }).p_identifier,
    );
    expect(identifiers).not.toContain('user@example.com');
  });

  it('answers wrong-password and unknown-account identically', async () => {
    // The difference between them is exactly what an enumeration probe wants.
    supa.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials', status: 400 },
    });
    const wrongPassword = await post('/login', creds);

    supa.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User not found', status: 400 },
    });
    const noSuchUser = await post('/login', { email: 'nobody@example.com', password: 'x' });

    expect(wrongPassword.status).toBe(noSuchUser.status);
    expect(await wrongPassword.json()).toEqual(await noSuchUser.json());
  });

  it('refuses a blocked IP before doing any work', async () => {
    const res = await post('/login', creds, { ip: BLOCKED_IP });
    expect(res.status).toBe(403);
    expect(supa.signInWithPassword).not.toHaveBeenCalled();
  });

  it('clears both counters after a successful login', async () => {
    succeeds();
    const kv = await import('../kv_store.tsx');
    await post('/login', creds);

    // A user who mistyped four times and then succeeded must not be one slip
    // from a 30-minute lockout.
    expect(vi.mocked(kv.del)).toHaveBeenCalled();
  });
});

describe('POST /password-reset — the limit is in front of the send', () => {
  /**
   * `/password-reset-request` was called by the client AFTER it had already
   * asked GoTrue to send the mail, so its 3-per-hour limit counted messages
   * that were already gone. This route sends the mail itself, behind the
   * limit — and answers identically in every case, because "you are being
   * throttled" is itself a confirmation that the address is worth attacking.
   */
  const GENERIC = {
    success: true,
    message: 'If an account exists with this email, a password reset link has been sent.',
  };

  it('sends the mail and returns the generic message', async () => {
    const res = await post('/password-reset', { email: 'user@example.com' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(GENERIC);
    expect(supa.resetPasswordForEmail).toHaveBeenCalled();
  });

  it('does NOT send once rate-limited — and says nothing different', async () => {
    limitOnly(CLEAN_IP, { blocked: true });
    const res = await post('/password-reset', { email: 'user@example.com' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(GENERIC);
    expect(supa.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('answers identically for a malformed address and a provider failure', async () => {
    const malformed = await post('/password-reset', { email: 'not-an-email' });

    supa.resetPasswordForEmail.mockResolvedValue({ data: {}, error: { message: 'smtp down' } });
    const providerDown = await post('/password-reset', { email: 'user@example.com' });

    expect(malformed.status).toBe(200);
    expect(providerDown.status).toBe(200);
    expect(await malformed.json()).toEqual(GENERIC);
    expect(await providerDown.json()).toEqual(GENERIC);
  });

  const SITE = 'https://www.navigatewealth.co';

  function resetWith(headers: Record<string, string>, body: Record<string, unknown>) {
    return app.request('/password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': CLEAN_IP, ...headers },
      body: JSON.stringify(body),
    });
  }

  function lastRedirect(): string {
    const [, options] = supa.resetPasswordForEmail.mock.calls[0] as [
      string,
      { redirectTo: string },
    ];
    return options.redirectTo;
  }

  it('refuses an attacker-chosen redirectTo — a reset link is a credential', async () => {
    // The destination is checked against the ALLOW-LIST, not against the
    // request's own Origin header. Validating one attacker-supplied value
    // against another always passes, which is exactly what the first version
    // of this route did: Origin: evil + redirectTo: evil/... read as
    // "same-origin" and the recovery link was mailed to the attacker's host.
    denoEnv.set('NW_ALLOWED_ORIGINS', SITE);
    denoEnv.set('SITE_URL', SITE);

    await resetWith(
      { Origin: 'https://evil.example' },
      { email: 'user@example.com', redirectTo: 'https://evil.example/steal' },
    );

    expect(lastRedirect()).toBe(`${SITE}/reset-password`);
    expect(lastRedirect()).not.toContain('evil.example');
  });

  it('refuses an off-origin redirectTo even from an allow-listed Origin', async () => {
    denoEnv.set('NW_ALLOWED_ORIGINS', SITE);
    denoEnv.set('SITE_URL', SITE);

    await resetWith(
      { Origin: SITE },
      { email: 'user@example.com', redirectTo: 'https://evil.example/steal' },
    );

    expect(lastRedirect()).toBe(`${SITE}/reset-password`);
  });

  it('honours a redirectTo under an allow-listed origin', async () => {
    denoEnv.set('NW_ALLOWED_ORIGINS', SITE);

    await resetWith(
      { Origin: SITE },
      { email: 'user@example.com', redirectTo: `${SITE}/reset-password` },
    );

    expect(lastRedirect()).toBe(`${SITE}/reset-password`);
  });

  it('falls back to the canonical site when no allow-list is configured', async () => {
    // isTrustedRedirectOrigin fails CLOSED, so an unconfigured deploy sends
    // recovery links to the canonical site rather than wherever it is asked to.
    denoEnv.set('SITE_URL', SITE);

    await resetWith({ Origin: 'https://evil.example' }, { email: 'user@example.com' });

    expect(lastRedirect()).toBe(`${SITE}/reset-password`);
  });
});
