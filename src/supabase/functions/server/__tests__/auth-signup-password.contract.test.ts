/**
 * `POST /auth-signup/signup` — the signup route that is actually reachable.
 * =========================================================================
 *
 * There are two signup routes and, until this suite, the wrong one was guarded.
 * `POST /auth/signup` in auth-routes.ts has validated password strength for a
 * long time, but nothing calls it — `auth-validation.ts` says so in a comment:
 * "the signup route that got a schema in B2 was the one nobody uses, and the
 * live one had none. The gate was on the wrong door."
 *
 * SignupPage.tsx and authService.ts both post to `/auth-signup/signup`, and here
 * the password went straight into `admin.createUser`. `PublicSignupSchema` asks
 * for `.min(1)`. So the 12-character, 3-of-4-character-class rule the signup
 * form displays, and disables its own submit button on, was enforced by the
 * browser and nothing else: curl, a stale bundle, or any script could set a
 * one-character password on a real client account.
 *
 * What these tests pin:
 *   1. A weak password is refused with 400 BEFORE `admin.createUser` is reached.
 *      The account must not exist, not exist-then-be-cleaned-up.
 *   2. The refusal says what is wrong, in `error` — the field both callers
 *      render. Detail hidden in a sibling key is detail the person never sees.
 *   3. The route agrees with the form's strength meter on every case. This is
 *      the property that makes the gate usable rather than merely present: a
 *      meter that goes green over a password the route refuses is worse than
 *      no meter.
 *
 * WHAT IS REAL: `validatePassword`, `PublicSignupSchema`, `validateBody`, the IP
 * blocklist, and the frontend meter it is compared against. Only Supabase, the
 * logger, the KV store and the downstream services (email, newsletter, groups,
 * application numbers) are stubbed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePassword as meter } from '../../../../utils/auth/passwordValidation';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: {
      get: (k: string) => (k === 'SUPABASE_URL' ? 'https://test.supabase.co' : 'test'),
    },
  };
});

const createUser = vi.fn();

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({ auth: { admin: { createUser } } }),
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
  firstName: 'Thandi',
  surname: 'Mokoena',
  countryCode: '+27',
  phoneNumber: '821234567',
};

function signup(password: string) {
  return app.request('/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '196.25.1.7' },
    body: JSON.stringify({ ...VALID, password }),
  });
}

beforeEach(() => {
  createUser.mockReset();
  createUser.mockResolvedValue({
    data: { user: { id: 'user_1', email: VALID.email } },
    error: null,
  });
});

describe('POST /auth-signup/signup password strength', () => {
  it('refuses a one-character password without creating the account', async () => {
    // The exact hole: PublicSignupSchema accepts `.min(1)`, so this reached
    // admin.createUser and a real account came out the other side.
    const res = await signup('x');

    expect(res.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it.each([
    ['too short', 'Short1!'],
    ['one character class', 'thisisallowercase'],
    ['a common word', 'MyPassword2026!'],
    ['a sequential run', 'Abcdefgh1234!'],
    ['a repeated character', 'aaaBBBccc111!'],
  ])('refuses a password with %s before reaching Supabase', async (_label, password) => {
    const res = await signup(password);

    expect(res.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('names the specific failures in `error`, which is the field both callers render', async () => {
    // SignupPage.tsx: `throw new Error(result.error || ...)`.
    // authService.ts:  `throw new AuthError(errorData.error || 'Signup failed')`.
    // Neither reads `errors`, so a bare "does not meet requirements" is a dead
    // end for whoever is trying to sign up.
    const res = await signup('short');
    const body = (await res.json()) as { error: string; errors: string[]; field: string };

    expect(body.field).toBe('password');
    expect(body.errors.length).toBeGreaterThan(0);
    expect(body.error).toContain('at least 12 characters');
    for (const detail of body.errors) {
      expect(body.error).toContain(detail);
    }
  });

  it('never echoes the password back in the refusal', async () => {
    const password = 'Sup3rSecret!Value';
    const res = await signup('weak');
    const raw = await res.text();

    expect(raw).not.toContain(password);
    expect(raw).not.toContain('weak');
  });

  it('lets a strong password through to account creation', async () => {
    const res = await signup('Kh1mba!Zwelithu#7');

    expect(createUser).toHaveBeenCalledTimes(1);
    expect(res.status).not.toBe(400);
  });

  it.each([['Olympic$Rain42'], ['Tropical#Sun88'], ['Compass&Birch51']])(
    'accepts %s, which the unbounded common-word rule used to refuse',
    async (password) => {
      await signup(password);

      expect(createUser).toHaveBeenCalledTimes(1);
    },
  );
});

describe('the route and the signup form agree', () => {
  // If these ever diverge, someone fills in the form, sees every requirement go
  // green, presses the button and is refused by the server with no way to tell
  // what to change.
  const CASES = [
    'Kh1mba!Zwelithu#7',
    'Olympic$Rain42',
    'Tropical#Sun88',
    'Zebra!Quilt7Moon',
    'Abcdefgh1234!',
    'aaaBBBccc111!',
    'MyPassword2026!',
    'Short1!',
    'thisisallowercase',
    'x',
  ];

  it.each(CASES.map((p) => [p]))('route matches the meter on %j', async (password) => {
    const accepted = meter(password).isValid;
    const res = await signup(password);

    if (accepted) {
      expect(res.status, `meter accepted ${password}; route must not 400`).not.toBe(400);
      expect(createUser).toHaveBeenCalledTimes(1);
    } else {
      expect(res.status, `meter rejected ${password}; route must 400`).toBe(400);
      expect(createUser).not.toHaveBeenCalled();
    }
  });
});
