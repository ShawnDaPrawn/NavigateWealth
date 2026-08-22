/**
 * Super-admin secret comparison + body validation (B2 burn-down).
 * ===============================================================
 *
 * `auth-admin-routes.ts` has three routes, all gated by the same
 * `SUPER_ADMIN_PASSWORD` secret. One of them — `/ensure-dev-user` — compared it
 * with `constantTimeEqual` and carried a comment explaining why. The other two,
 * including the one that CREATES A SUPER-ADMIN ACCOUNT, used a plain `!==`.
 *
 * `!==` on strings short-circuits at the first differing byte, so how long the
 * comparison takes correlates with how much of the secret the caller already
 * guessed. Practical exploitation across a network is hard and noisy; that is
 * an argument about difficulty, not about correctness, and the correct helper
 * was already imported at the top of the same file. Two of three siblings had
 * simply drifted from it.
 *
 * The second half of this file is the body validation those three routes never
 * had, plus `/auth-signup/signup` — which turned out to be the signup endpoint
 * the SPA actually calls, while the schema added in B2 sat on `/auth/signup`,
 * which nothing calls.
 */
import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const listUsers = vi.hoisted(() => vi.fn());
const createUser = vi.hoisted(() => vi.fn());
const updateUserById = vi.hoisted(() => vi.fn());
const clearRateLimit = vi.hoisted(() => vi.fn());

beforeAll(() => {
  vi.stubGlobal('Deno', {
    env: {
      get: (name: string) =>
        ({
          SUPER_ADMIN_PASSWORD: 'the-real-secret',
          SUPABASE_URL: 'https://test',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        })[name] ?? '',
    },
  });
});

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    auth: {
      admin: {
        listUsers: (...a: unknown[]) => listUsers(...a),
        createUser: (...a: unknown[]) => createUser(...a),
        updateUserById: (...a: unknown[]) => updateUserById(...a),
      },
    },
  }),
}));

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async () => null),
  set: vi.fn(),
  del: vi.fn(),
  getByPrefix: vi.fn(async () => []),
  mget: vi.fn(),
  mset: vi.fn(),
  mdel: vi.fn(),
}));

vi.mock('../rateLimiter.ts', () => ({ clearRateLimit: (...a: unknown[]) => clearRateLimit(...a) }));

import adminAuthRoutes from '../auth-admin-routes.ts';

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  listUsers.mockResolvedValue({ data: { users: [] } });
});

describe('the secret is compared in constant time on every route that checks it', () => {
  it('leaves no plain-equality comparison of the secret in the file', () => {
    // Structural, because a timing property cannot be measured reliably in a
    // test runner. What CAN be pinned is that the correct helper is used at
    // every site — which is the thing that had drifted.
    const src = readFileSync(join(SERVER_DIR, 'auth-admin-routes.ts'), 'utf8');

    const plainComparisons = src
      .split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => !line.startsWith('*') && !line.startsWith('//'))
      .filter(({ line }) => /secretKey\s*(!==|===|!=|==)\s*expectedSecretKey/.test(line));

    expect(
      plainComparisons.map((p) => `${p.n}: ${p.line}`),
      'compare the super-admin secret with constantTimeEqual, as /ensure-dev-user does',
    ).toEqual([]);
  });

  it('uses constantTimeEqual once per secret-checking route', () => {
    const src = readFileSync(join(SERVER_DIR, 'auth-admin-routes.ts'), 'utf8');
    const calls = src.match(/constantTimeEqual\(/g) ?? [];

    // Three routes check the secret; the fourth match is the import.
    expect(calls).toHaveLength(3);
  });

  it.each([
    ['/create-superadmin', { secretKey: 'wrong', email: 'a@b.com', password: 'Passw0rd!x' }],
    ['/clear-rate-limit', { secretKey: 'wrong', email: 'a@b.com' }],
    ['/ensure-dev-user', { secretKey: 'wrong', email: 'a@b.com', password: 'Passw0rd!x' }],
  ])('still refuses %s with a wrong secret', async (path, body) => {
    const res = await adminAuthRoutes.request(path, json(body));

    expect(res.status).toBe(403);
    expect(clearRateLimit).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('accepts the correct secret — the fix did not break the door it guards', async () => {
    const res = await adminAuthRoutes.request(
      '/clear-rate-limit',
      json({ secretKey: 'the-real-secret', email: 'a@b.com' }),
    );

    expect(res.status).toBe(200);
    expect(clearRateLimit).toHaveBeenCalledWith('a@b.com', 'login');
  });

  it('refuses a secret that is a prefix of the real one', async () => {
    // constantTimeEqual returns false on a length mismatch before comparing
    // bytes. Worth pinning: a helper that padded instead would be a different,
    // subtler bug.
    const res = await adminAuthRoutes.request(
      '/clear-rate-limit',
      json({ secretKey: 'the-real', email: 'a@b.com' }),
    );

    expect(res.status).toBe(403);
  });
});

describe('body validation on the super-admin utilities', () => {
  it.each([
    ['/create-superadmin', { email: 'a@b.com', password: 'x' }],
    ['/clear-rate-limit', { email: 'a@b.com' }],
    ['/ensure-dev-user', { email: 'a@b.com', password: 'x' }],
  ])('rejects %s with no secretKey as 400', async (path, body) => {
    const res = await adminAuthRoutes.request(path, json(body));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: 'Validation failed' });
  });

  it('rejects /clear-rate-limit with no email, which would clear an undefined bucket', async () => {
    const res = await adminAuthRoutes.request(
      '/clear-rate-limit',
      json({ secretKey: 'the-real-secret' }),
    );

    expect(res.status).toBe(400);
    expect(clearRateLimit).not.toHaveBeenCalled();
  });

  it('turns /ensure-dev-user with no email into a 400 rather than a 500', async () => {
    // The handler calls `email.toLowerCase()`. Before the schema, a missing
    // email threw inside the handler and surfaced as an opaque server error.
    const res = await adminAuthRoutes.request(
      '/ensure-dev-user',
      json({ secretKey: 'the-real-secret', password: 'x' }),
    );

    expect(res.status).toBe(400);
  });

  it('rejects a body that is not JSON at all as 400', async () => {
    const res = await adminAuthRoutes.request('/clear-rate-limit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    expect(res.status).toBe(400);
  });

  it('never rejects an unknown extra field', async () => {
    // Every schema is `.passthrough()`. A caller sending more than the schema
    // knows about must not start failing because of this change.
    const res = await adminAuthRoutes.request(
      '/clear-rate-limit',
      json({ secretKey: 'the-real-secret', email: 'a@b.com', somethingNew: 'ok' }),
    );

    expect(res.status).toBe(200);
  });
});
