/**
 * Suspension reaches the hand-rolled auth paths too (P1.2 / S14 recurrence).
 * ==========================================================================
 *
 * `auth-consolidation.test.ts` asserts statically that every module verifying a
 * bearer token itself also mentions `enforceAccountSecurity`. Mentioning it is
 * not applying it, so this drives the real routers: a suspended account must be
 * refused, with the reason intact.
 *
 * "With the reason intact" is the part worth testing. Flattening a 403
 * ACCOUNT_SUSPENDED into a generic 401 tells the user to log in again — a loop
 * that cannot succeed, because signing in produces another valid token for the
 * same suspended account. `tasks-digest` was the awkward case: its token branch
 * sits inside a `catch {}` that falls through to exactly that 401, and
 * `error.middleware` does not know auth-mw's `AuthError`, so neither swallowing
 * nor rethrowing would have worked.
 */
import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';

// Deno runtime shim — the routes read Deno.env, which does not exist under
// Vitest. Returning '' for both cron secrets keeps the service-role /
// super-admin-password branch from matching, so every request under test
// reaches the admin-JWT branch this file is about.
beforeAll(() => {
  vi.stubGlobal('Deno', {
    env: { get: (name: string) => (name === 'SUPABASE_URL' ? 'https://test' : '') },
  });
});

const getUser = vi.hoisted(() => vi.fn());
const kvGet = vi.hoisted(() => vi.fn());
const kvSet = vi.hoisted(() => vi.fn());
const kvGetByPrefix = vi.hoisted(() => vi.fn());

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({ auth: { getUser: (...a: unknown[]) => getUser(...a) } }),
}));

vi.mock('../kv_store.tsx', () => ({
  get: (...a: unknown[]) => kvGet(...a),
  set: (...a: unknown[]) => kvSet(...a),
  del: vi.fn(),
  getByPrefix: (...a: unknown[]) => kvGetByPrefix(...a),
  mget: vi.fn(),
  mset: vi.fn(),
  mdel: vi.fn(),
}));

vi.mock('../email-service.tsx', () => ({
  sendEmail: vi.fn(),
  createEmailTemplate: vi.fn(() => ''),
  getFooterSettings: vi.fn(async () => ({})),
}));

import tasksDigestRoutes from '../tasks-digest-routes.ts';
import { enforceAccountSecurity } from '../auth-mw.ts';

const USER_ID = 'user-1';
const auth = { Authorization: 'Bearer a-real-looking-jwt' };

beforeEach(() => {
  vi.clearAllMocks();
  kvGetByPrefix.mockResolvedValue([]);
  getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
});

describe('enforceAccountSecurity, the policy these paths were missing', () => {
  it('passes an account with no security record', async () => {
    kvGet.mockResolvedValue(null);
    await expect(enforceAccountSecurity(USER_ID)).resolves.toBeUndefined();
  });

  it('rejects suspended and deleted accounts with distinguishable codes', async () => {
    kvGet.mockResolvedValue({ suspended: true });
    await expect(enforceAccountSecurity(USER_ID)).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_SUSPENDED',
    });

    kvGet.mockResolvedValue({ deleted: true });
    await expect(enforceAccountSecurity(USER_ID)).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_DELETED',
    });
  });
});

describe('tasks-digest admin JWT path', () => {
  it('refuses a suspended admin with 403 ACCOUNT_SUSPENDED, not a 401', async () => {
    kvGet.mockImplementation(async (key: string) =>
      key === `security:${USER_ID}` ? { suspended: true } : null,
    );

    const res = await tasksDigestRoutes.request('/status', { headers: auth });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ code: 'ACCOUNT_SUSPENDED' });
  });

  it('refuses a deleted admin the same way', async () => {
    kvGet.mockImplementation(async (key: string) =>
      key === `security:${USER_ID}` ? { deleted: true } : null,
    );

    const res = await tasksDigestRoutes.request('/status', { headers: auth });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ code: 'ACCOUNT_DELETED' });
  });

  it('still 401s a clean but non-admin account', async () => {
    // The suspension check must not become the only gate — a clean account with
    // no admin role is still refused, and by the original 401 path.
    kvGet.mockResolvedValue(null);

    const res = await tasksDigestRoutes.request('/status', { headers: auth });

    expect(res.status).toBe(401);
  });

  it('surfaces an unavailable security store rather than admitting the caller', async () => {
    // enforceAccountSecurity turns a KV failure into a 503, deliberately: an
    // unreadable suspension list must not read as "nobody is suspended".
    kvGet.mockImplementation(async (key: string) => {
      if (key === `security:${USER_ID}`) throw new Error('kv down');
      return null;
    });

    const res = await tasksDigestRoutes.request('/status', { headers: auth });

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ code: 'SECURITY_STATE_UNAVAILABLE' });
  });
});
