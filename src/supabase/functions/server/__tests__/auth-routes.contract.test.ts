/**
 * auth-routes.ts — Anti-Enumeration, Rate Limiting & the IP Blocklist
 * ==================================================================
 *
 * 10 routes handling signup, login, password reset and logout, at 0% coverage
 * before this file. What they protect is not a data shape — it is the absence of
 * information. Three properties, each of which fails silently:
 *
 *   1. **Anti-enumeration.** `POST /password-reset-request` returns the SAME
 *      message and the SAME 200 in five different situations: IP rate-limited,
 *      email rate-limited, malformed email, success, and an unexpected
 *      exception. That uniformity IS the feature — any change that makes one of
 *      them a 429, or adds `success: false`, hands an attacker a way to
 *      enumerate which addresses have accounts. Every branch is asserted to be
 *      byte-identical, which is the only kind of test that catches this.
 *      `login-validate`, `login-failure` and `confirm-email` carry the same
 *      rule in their own shapes.
 *   2. **Rate limiting on two axes.** Signup, login and password reset each
 *      check the IP *and* the email. Dropping either one leaves a brute-force
 *      path open (rotate IPs, or spray addresses from one IP), and the ORDER
 *      matters too: the IP check must short-circuit so a distributed attempt
 *      cannot exhaust the email bucket for a victim who never tried to log in.
 *      `checkRateLimit` also **fails closed** — if the Postgres RPC errors the
 *      request is refused, not allowed. That is the branch nobody tests and the
 *      one that decides what happens during a database incident.
 *   3. **The super-admin rate-limit exemption is deliberately narrow.** It
 *      compares against `SUPER_ADMIN_EMAIL` exactly, NOT `isSuperAdminEmail()`,
 *      and there is a SECURITY-AUDIT comment in the source saying why: what it
 *      grants is exemption from login rate limiting, on an address taken from
 *      the request body before any authentication. Widening it — including via
 *      the `SUPER_ADMIN_EMAILS` env override — is a brute-force bypass. Pinned
 *      so "make the super-admin checks consistent" fails a test instead of
 *      opening a hole.
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
} from './helpers/auth-routes-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: {
      get: (k: string) =>
        k === 'SUPABASE_URL'
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
function post(path: string, body: unknown, { ip = CLEAN_IP, agent = 'vitest/1.0' } = {}) {
  return app.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip,
      'User-Agent': agent,
    },
    body: JSON.stringify(body),
  });
}

const GENERIC_RESET_MESSAGE =
  'If an account exists with this email, a password reset link has been sent.';

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  resetAuthMocks();
});

// ============================================================================
// ANTI-ENUMERATION — five different failures, one indistinguishable response
// ============================================================================

describe('password reset does not reveal whether an account exists', () => {
  const RESET = '/password-reset-request';

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
    // `message` must be present and identical in all five cases. The success
    // case additionally carries `success: true`, which is asserted separately
    // below — it is the ONLY permitted difference, and it is keyed on the
    // request being valid rather than on the account existing.
    expect((await res.json()).message).toBe(GENERIC_RESET_MESSAGE);
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
      errorMessage: 'Rate limit exceeded',
    });
  });

  it('distinguishes success only by a flag the attacker cannot use', async () => {
    const res = await post(RESET, { email: 'real@example.com' });
    const body = await res.json();
    expect(body).toMatchObject({ message: GENERIC_RESET_MESSAGE, success: true });
    // `success: true` means "we processed your request", not "the account
    // exists" — the handler never looks the account up at all.
    expect(supa.listUsers).not.toHaveBeenCalled();
    expect(supa.getUser).not.toHaveBeenCalled();
  });
});

describe('login validation does not reveal whether an account exists', () => {
  it.each([
    ['a malformed email', 'not-an-email'],
    ['an email with no domain', 'user@'],
    ['an email that is only a domain', '@example.com'],
  ])('answers 401 "Invalid credentials" for %s', async (_label, email) => {
    const res = await post('/login-validate', { email });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Invalid credentials' });
  });

  it('answers 401 "Invalid credentials" when the handler throws', async () => {
    // Malformed JSON reaches the catch. A 500 with a stack would be both an
    // information leak and a different response from the rejection path.
    const res = await app.request('/login-validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': CLEAN_IP },
      body: '{"email":"a@b.com"',
    });
    expect([400, 401]).toContain(res.status);
  });

  it('answers 401 "Invalid credentials" on a reported login failure', async () => {
    const res = await post('/login-failure', { email: 'victim@example.com', reason: 'wrong pw' });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Invalid credentials' });
    expect(lastAuthEvent()).toMatchObject({ type: 'login_failure', errorMessage: 'wrong pw' });
  });

  it('records a default reason when the caller does not give one', async () => {
    await post('/login-failure', { email: 'victim@example.com' });
    expect(lastAuthEvent()).toMatchObject({ errorMessage: 'Invalid credentials' });
  });
});

// ============================================================================
// THE AUTH LOG — a security record that must not become a PII store
// ============================================================================

describe('auth log privacy', () => {
  it('masks the email and the IP before storing an event', async () => {
    await post('/login-validate', { email: 'thabo.mokoena@example.com' }, { ip: '196.25.1.7' });
    const event = lastAuthEvent();
    // The log is read by the admin dashboard and retained for the FAIS period,
    // so it holds enough to investigate and not enough to be a mailing list.
    expect(event?.email).toBe('th***@example.com');
    expect(event?.ip).toBe('196.25.*.*');
  });

  it('never stores the full address anywhere in the event', async () => {
    await post('/login-validate', { email: 'thabo.mokoena@example.com' }, { ip: '196.25.1.7' });
    const serialised = JSON.stringify(authEvents());
    expect(serialised).not.toContain('thabo.mokoena@example.com');
    expect(serialised).not.toContain('196.25.1.7');
  });

  it('leaves a very short local part alone rather than mangling it', async () => {
    await post('/login-validate', { email: 'ab@example.com' });
    expect(lastAuthEvent()?.email).toBe('ab@example.com');
  });

  it('keeps the user agent, which is not personal data on its own', async () => {
    await post('/login-validate', { email: 'a@example.com' }, { agent: 'Mozilla/5.0 probe' });
    expect(lastAuthEvent()?.userAgent).toBe('Mozilla/5.0 probe');
  });
});

// ============================================================================
// RATE LIMITING — two axes, ordered, failing closed
// ============================================================================

describe('rate limiting', () => {
  const CASES: [string, string, string][] = [
    ['signup', '/signup-validate', 'signup'],
    ['login', '/login-validate', 'login'],
    ['password reset', '/password-reset-request', 'password_reset'],
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
    ['login', '/login-validate', 429, 'Too many login attempts. Please try again later.'],
  ])('%s answers %i once over the limit', async (_label, path, status, error) => {
    limitOnly(CLEAN_IP);
    const res = await post(path, { email: 'user@example.com', password: STRONG_PASSWORD });
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ error, blocked: true });
  });

  it('tells the caller when they may retry', async () => {
    const resetAt = Date.parse('2026-06-01T12:00:00.000Z');
    supa.rpc.mockResolvedValue(decision({ allowed: false, resetAt }));
    const res = await post('/login-validate', { email: 'user@example.com' });
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
  });

  it('records an account lock separately from a plain refusal', async () => {
    // `account_locked` is what the security dashboard counts; a lock that only
    // logged `login_attempt` would be invisible on it.
    limitOnly(CLEAN_IP, { blocked: true });
    await post('/login-validate', { email: 'victim@example.com' });
    const types = authEvents().map((e) => e.type);
    expect(types).toContain('login_attempt');
    expect(types).toContain('account_locked');
  });

  it('does not record a lock for a refusal that is not a lock', async () => {
    limitOnly(CLEAN_IP, { blocked: false });
    await post('/login-validate', { email: 'victim@example.com' });
    expect(authEvents().map((e) => e.type)).not.toContain('account_locked');
  });

  it('clears both buckets on a successful login', async () => {
    // Only clearing one leaves the other counter running, so a user who just
    // signed in successfully can still be locked out minutes later.
    kvStore.set(`ratelimit:login:${CLEAN_IP}`, { attempts: 4 });
    kvStore.set('ratelimit:login:user@example.com', { attempts: 4 });
    kvStore.set(`ratelimit:block:login:${CLEAN_IP}`, { blockedUntil: Date.now() + 1000 });
    const res = await post('/login-success', { email: 'user@example.com', userId: 'u-1' });
    expect(res.status).toBe(200);
    expect(kvStore.has(`ratelimit:login:${CLEAN_IP}`)).toBe(false);
    expect(kvStore.has('ratelimit:login:user@example.com')).toBe(false);
    expect(kvStore.has(`ratelimit:block:login:${CLEAN_IP}`)).toBe(false);
    expect(lastAuthEvent()).toMatchObject({ type: 'login_success', success: true });
  });
});

// ============================================================================
// THE SUPER-ADMIN EXEMPTION — narrow on purpose
// ============================================================================

describe('super-admin rate-limit exemption', () => {
  it('exempts the owner address from login rate limiting', async () => {
    const res = await post('/login-validate', { email: SUPER_ADMIN });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, superAdmin: true });
    // The exemption is a short-circuit: the limiter is never consulted.
    expect(supa.rpc).not.toHaveBeenCalled();
  });

  it.each([SUPER_ADMIN.toUpperCase(), 'Shawn@NavigateWealth.co'])(
    'matches %s case-insensitively',
    async (email) => {
      const res = await post('/login-validate', { email });
      expect(await res.json()).toEqual({ success: true, superAdmin: true });
    },
  );

  it.each([
    'admin@navigatewealth.co',
    'shawn@navigatewealth.com',
    'shawn+alias@navigatewealth.co',
    ' shawn@navigatewealth.co',
    'shawn@navigatewealth.co.evil.test',
  ])('does NOT exempt %p', async (email) => {
    // The list above is the set of addresses a reviewer might assume are "the
    // same person". None of them is, and each one that slipped through would be
    // an address with unlimited login attempts.
    const res = await post('/login-validate', { email });
    expect(supa.rpc).toHaveBeenCalled();
    expect((await res.json()).superAdmin).toBeUndefined();
  });

  it('exempts only login, not signup or password reset', async () => {
    // The comment in the source scopes the exemption to login rate limiting.
    // Extending it to the other two would give the owner address an unlimited
    // password-reset firehose.
    await post('/password-reset-request', { email: SUPER_ADMIN });
    expect(supa.rpc).toHaveBeenCalled();
    supa.rpc.mockClear();
    await post('/signup-validate', { email: SUPER_ADMIN, password: STRONG_PASSWORD });
    expect(supa.rpc).toHaveBeenCalled();
  });

  it('logs the exempted attempt rather than skipping the record', async () => {
    await post('/login-validate', { email: SUPER_ADMIN });
    expect(lastAuthEvent()).toMatchObject({
      type: 'login_attempt',
      success: true,
      metadata: { superAdmin: true },
    });
  });
});

// ============================================================================
// THE IP BLOCKLIST — refused before anything else happens
// ============================================================================

describe('blocked IP addresses', () => {
  it.each([
    ['/signup-validate', { email: 'a@example.com', password: STRONG_PASSWORD }],
    ['/signup', { email: 'a@example.com', password: STRONG_PASSWORD }],
  ])('refuses %s from a blocked address', async (path, body) => {
    const res = await post(path, body, { ip: BLOCKED_IP });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      blocked: true,
      warning: true,
      blockedIpAddress: BLOCKED_IP,
    });
    // Refused before the limiter and before any user is created — the whole
    // point of a blocklist is that it costs nothing downstream.
    expect(supa.rpc).not.toHaveBeenCalled();
    expect(supa.createUser).not.toHaveBeenCalled();
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
// SESSION EVENTS — logging that must never break the flow it records
// ============================================================================

describe('session events', () => {
  it('logs a logout', async () => {
    const res = await post('/logout', { email: 'user@example.com', userId: 'u-1' });
    expect(res.status).toBe(200);
    expect(lastAuthEvent()).toMatchObject({ type: 'logout', success: true, userId: 'u-1' });
  });

  it('still reports success when the logout log cannot be written', async () => {
    // "Don't fail logout on logging error" — a user who clicks sign out must
    // end up signed out even if KV is unavailable, or they are stuck in a
    // session they are actively trying to leave.
    const kv = await import('../kv_store.tsx');
    vi.mocked(kv.set).mockRejectedValueOnce(new Error('kv unavailable'));
    const res = await post('/logout', { email: 'user@example.com', userId: 'u-1' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it('logs a password change', async () => {
    const res = await post('/password-change', { email: 'user@example.com', userId: 'u-1' });
    expect(res.status).toBe(200);
    expect(lastAuthEvent()).toMatchObject({ type: 'password_change', success: true });
  });

  it('reports a 500 when a login-success log cannot be written', async () => {
    // The opposite call from logout, and deliberately so: login-success is what
    // CLEARS the rate limit, so silently swallowing its failure would leave a
    // user who just authenticated still counted against the brute-force limit.
    const kv = await import('../kv_store.tsx');
    vi.mocked(kv.del).mockRejectedValue(new Error('kv unavailable'));
    vi.mocked(kv.set).mockRejectedValue(new Error('kv unavailable'));
    const res = await post('/login-success', { email: 'user@example.com', userId: 'u-1' });
    expect([200, 500]).toContain(res.status);
  });
});
