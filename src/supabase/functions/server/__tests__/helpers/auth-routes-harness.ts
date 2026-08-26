/**
 * Fixtures and stubs shared by the auth-routes contract suites.
 * ============================================================
 *
 * `auth-routes.ts` had 0% coverage across 10 routes handling signup, login,
 * password reset and the admin security dashboard. Two suites split the surface:
 *
 *   auth-routes            anti-enumeration, rate limiting, the IP blocklist
 *   auth-routes-privilege  metadata stripping, security-status authz, confirm-email
 *
 * WHAT IS REAL: the rate limiter, the auth logger, the password/email/phone
 * validators, the IP blocklist, the zod schemas and `auth-mw`'s account-security
 * check all run for real. Only the Supabase client (Postgres RPC + admin auth
 * API), the stderr logger and the admin audit service are stubbed. Stubbing the
 * rate limiter or the logger would leave the two things this module exists for —
 * refusing brute force, and recording what happened — untested.
 *
 * @module __tests__/helpers/auth-routes-harness
 */
import { vi } from 'vitest';
import { kvStore } from './contract-harness.ts';

/** The one address exempt from login rate limiting; see SUPER_ADMIN_EMAIL. */
export const SUPER_ADMIN = 'shawn@navigatewealth.co';

/** The address in `BLOCKED_IP_ADDRESSES`. */
export const BLOCKED_IP = '105.224.67.241';
export const CLEAN_IP = '196.25.1.7';

export const USER_ID = '11111111-2222-4333-8444-555555555555';

/**
 * The Supabase surface these routes touch. `rpc` is the rate limiter's
 * `check_auth_rate_limit_91ed8379`; the rest is the admin auth API.
 */
export const supa = {
  rpc: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  listUsers: vi.fn(),
  updateUserById: vi.fn(),
};

export const auditRecord = vi.fn(async () => undefined);

/** Module shape for `vi.mock('jsr:@supabase/supabase-js@2.49.8', …)`. */
export function makeSupabaseMock() {
  return {
    createClient: () => ({
      rpc: supa.rpc,
      auth: {
        getUser: supa.getUser,
        admin: {
          createUser: supa.createUser,
          listUsers: supa.listUsers,
          updateUserById: supa.updateUserById,
        },
      },
    }),
  };
}

/** A rate-limit decision in the shape the RPC returns. */
export function decision({
  allowed = true,
  remaining = 4,
  blocked = false,
  resetAt = Date.parse('2026-01-01T01:00:00.000Z'),
} = {}) {
  return { data: { allowed, remaining, resetAt, blocked }, error: null };
}

/** Makes the next `identifier` (IP or email) rate-limited; everything else passes. */
export function limitOnly(identifier: string, { blocked = false } = {}) {
  supa.rpc.mockImplementation(async (_fn: string, args: Record<string, unknown>) =>
    args.p_identifier === identifier
      ? decision({ allowed: false, remaining: 0, blocked })
      : decision(),
  );
}

/** Every auth event written to KV so far, newest last. */
export function authEvents(): Record<string, unknown>[] {
  const out: { key: string; value: Record<string, unknown> }[] = [];
  kvStore.forEach((v, k) => {
    if (k.startsWith('auth_log:')) out.push({ key: k, value: v as Record<string, unknown> });
  });
  return out.sort((a, b) => a.key.localeCompare(b.key)).map((e) => e.value);
}

/** The most recent auth event, or undefined. */
export function lastAuthEvent(): Record<string, unknown> | undefined {
  const all = authEvents();
  return all[all.length - 1];
}

export function seedProfile(role: string, userId = USER_ID) {
  kvStore.set(`user_profile:${userId}:personal_info`, { id: userId, role });
}

/** A Supabase user record as `auth.getUser` returns it. */
export function seedAuthUser({
  id = USER_ID,
  email = 'admin@navigatewealth.co',
  role = 'admin',
} = {}) {
  supa.getUser.mockResolvedValue({
    data: { user: { id, email, app_metadata: { role }, user_metadata: {} } },
    error: null,
  });
  return { id, email };
}

/**
 * A password that satisfies `validatePassword`. Deliberately not built from
 * English words: the validator rejects anything containing a common word, so
 * an obvious-looking "Str0ng!Passw0rd" fails and would make every test that
 * needs to get PAST validation pass for the wrong reason.
 */
export const STRONG_PASSWORD = 'Kh1mba!Zwelithu#7';

/** Defaults that let every route through. Call from `beforeEach`. */
export function resetAuthMocks(): void {
  // Every identifier under its limit unless a test narrows it with `limitOnly`.
  supa.rpc.mockImplementation(async () => decision());
  supa.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'no token' } });
  supa.createUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  supa.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
  supa.updateUserById.mockResolvedValue({ data: {}, error: null });
  auditRecord.mockResolvedValue(undefined);
}
