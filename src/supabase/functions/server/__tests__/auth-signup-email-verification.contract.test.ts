/**
 * `POST /auth-signup/signup` — email ownership must be proven.
 * ============================================================
 *
 * WHAT WAS WRONG
 * --------------
 * The route created accounts with `email_confirm: true`, i.e. already verified,
 * and then sent a "verification" email. Nothing was gated on that email: anyone
 * could sign up with an address they did not own and sign straight in. The
 * comment justifying it said "an email server hasn't been configured", which
 * had long stopped being true — this same function sends 2FA codes and e-sign
 * notifications.
 *
 * It was also self-defeating: `auth.resend({ type: 'signup' })` has nothing to
 * send for an already-confirmed user, so the confirmation mail was failing into
 * a warn-only catch and never arriving at all.
 *
 * The SPA had always assumed the opposite — authService.ts returns
 * `session: null, // No session until email is verified` and SignupPage.tsx
 * routes to /verify-email rather than logging anyone in. Only this flag
 * disagreed.
 *
 * WHAT THESE TESTS PIN
 *   1. Accounts are created unconfirmed, so Supabase itself refuses the sign-in
 *      until the link is clicked.
 *   2. The confirmation email is actually requested.
 *   3. `emailRedirectTo` is never chosen by the caller. That URL receives the
 *      session token, and `Origin` is attacker-controlled, so an unrecognised
 *      origin must fall back to the canonical site rather than be trusted.
 *   4. A failed send does not fail the signup — the account and its application
 *      record are real, and the person recovers via "Resend verification email"
 *      on LoginPage.tsx.
 *
 * WHAT IS REAL: the route, `isTrustedRedirectOrigin`, `validateBody`,
 * `PublicSignupSchema`. Supabase, KV, the logger and downstream services are
 * stubbed.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/auth-signup-email-verification.contract.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SITE = 'https://www.navigatewealth.co';
const APEX = 'https://navigatewealth.co';
const EVIL = 'https://evil.example';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: {
      get: (k: string) => {
        if (k === 'SUPABASE_URL') return 'https://test.supabase.co';
        if (k === 'NW_ALLOWED_ORIGINS') return `${SITE},${APEX}`;
        if (k === 'SITE_URL') return SITE;
        return 'test';
      },
    },
  };
});

const createUser = vi.fn();
const resend = vi.fn();

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({ auth: { admin: { createUser }, resend } }),
}));
vi.mock('../email-service.ts', () => ({
  sendAdminSignupNotification: vi.fn(async () => undefined),
}));
vi.mock('../communication-repo.ts', () => ({
  recalculateAllGroupMemberships: vi.fn(async () => undefined),
}));
vi.mock('../application-number-utils.ts', () => ({
  generateApplicationNumber: vi.fn(async () => 'NW-TEST-0001'),
}));
vi.mock('../submissions-service.ts', () => ({
  submissionsService: { create: vi.fn(async () => ({ id: 'sub_1' })) },
}));
vi.mock('../newsletter-service.ts', () => ({ autoSubscribeClient: vi.fn(async () => undefined) }));

const app = (await import('../auth-signup.ts')).default;

const VALID = {
  email: 'someone@example.com',
  // Satisfies the real validatePassword (12+ chars, 3-of-4 classes, uncommon).
  password: 'Ntsikelelo7#Qvpz',
  firstName: 'Thandi',
  surname: 'Mokoena',
  countryCode: '+27',
  phoneNumber: '821234567',
};

function signup(origin?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'CF-Connecting-IP': '196.25.1.7',
  };
  if (origin) headers.Origin = origin;
  return app.request('/signup', {
    method: 'POST',
    headers,
    body: JSON.stringify(VALID),
  });
}

beforeEach(() => {
  createUser.mockReset();
  createUser.mockResolvedValue({
    data: { user: { id: 'user_1', email: VALID.email } },
    error: null,
  });
  resend.mockReset();
  resend.mockResolvedValue({ error: null });
});

describe('signup creates an UNVERIFIED account', () => {
  it('passes email_confirm: false to admin.createUser', async () => {
    // The whole fix in one assertion. `true` here is an account that can sign
    // in without anyone proving they own the address.
    const res = await signup(SITE);

    expect(res.status).toBe(200);
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(createUser.mock.calls[0][0]).toMatchObject({
      email: VALID.email,
      email_confirm: false,
    });
  });

  it('still returns the application number the SPA shows the user', async () => {
    // The signup itself must still succeed and hand back what SignupPage.tsx
    // renders before redirecting to /verify-email.
    const res = await signup(SITE);
    const body = (await res.json()) as {
      success: boolean;
      user: { id: string };
      application: { application_number: string };
    };

    expect(body.success).toBe(true);
    expect(body.user.id).toBe('user_1');
    expect(body.application.application_number).toBe('NW-TEST-0001');
  });

  it('requests the confirmation email', async () => {
    await signup(SITE);

    expect(resend).toHaveBeenCalledTimes(1);
    expect(resend.mock.calls[0][0]).toMatchObject({ type: 'signup', email: VALID.email });
  });
});

describe('emailRedirectTo is never chosen by the caller', () => {
  it('honours an allow-listed Origin', async () => {
    await signup(APEX);

    expect(resend.mock.calls[0][0].options.emailRedirectTo).toBe(`${APEX}/auth/callback`);
  });

  it('refuses an attacker-supplied Origin and falls back to the canonical site', async () => {
    // The attack: POST the signup for a victim's address with
    // `Origin: evil.example`, and the confirmation link — which carries the
    // session token in its fragment — lands on the attacker's page.
    await signup(EVIL);

    const { emailRedirectTo } = resend.mock.calls[0][0].options;
    expect(emailRedirectTo).toBe(`${SITE}/auth/callback`);
    expect(emailRedirectTo).not.toContain('evil.example');
  });

  it('falls back when no Origin header is sent at all', async () => {
    await signup();

    expect(resend.mock.calls[0][0].options.emailRedirectTo).toBe(`${SITE}/auth/callback`);
  });

  it.each([
    ['a lookalike suffix', 'https://www.navigatewealth.co.evil.example'],
    ['a lookalike prefix', 'https://navigatewealth.co.attacker.test'],
    ['plain http', 'http://www.navigatewealth.co'],
    ['a subdomain', 'https://staging.navigatewealth.co'],
  ])('rejects %s', async (_label, origin) => {
    // Exact-match allow-list, not a substring or suffix test.
    await signup(origin);

    expect(resend.mock.calls[0][0].options.emailRedirectTo).toBe(`${SITE}/auth/callback`);
  });
});

describe('a failed confirmation email does not fail the signup', () => {
  it('still returns 200 when Supabase reports a send error', async () => {
    // The account and application record are real by this point; failing the
    // request would leave the person with an account they were told did not
    // exist. They recover via "Resend verification email" on LoginPage.tsx.
    resend.mockResolvedValue({ error: { message: 'smtp down' } });

    const res = await signup(SITE);

    expect(res.status).toBe(200);
    expect(((await res.json()) as { success: boolean }).success).toBe(true);
  });

  it('still returns 200 when the send throws', async () => {
    resend.mockRejectedValue(new Error('network'));

    const res = await signup(SITE);

    expect(res.status).toBe(200);
  });
});
