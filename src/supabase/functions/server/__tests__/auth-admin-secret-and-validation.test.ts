/**
 * auth-admin-routes.ts — no shared-secret account doors.
 * ======================================================
 *
 * This file used to pin that the three super-admin utilities compared the
 * `SUPER_ADMIN_PASSWORD` secret in constant time. That was the right fix for
 * the wrong problem. Two of those routes — `create-superadmin` and
 * `ensure-dev-user` — could mint a super-admin or reset ANY account's password
 * (the owner's included) with nothing but that one static string in the body:
 * no session, no rate limit on guesses, no audit record. A timing-safe compare
 * does not make a single shared string an acceptable key to every account.
 *
 * Both are gone. `clear-rate-limit` has a genuine support use and survives
 * behind a super-admin SESSION. What is pinned here:
 *   1. Structurally: the module no longer reads the shared secret, and no
 *      longer touches account creation or passwords at all.
 *   2. Behaviourally: the removed paths 404, and `clear-rate-limit` is refused
 *      without a super-admin session, validates its body, and clears the
 *      NORMALISED account bucket.
 *
 * `auth-routes-privilege.contract.test.ts` exercises the same route through
 * the real auth middleware; this file stubs it to keep the checks focused.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = readFileSync(join(SERVER_DIR, 'auth-admin-routes.ts'), 'utf8');

const clearRateLimit = vi.hoisted(() => vi.fn());
const auditRecord = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../rateLimiter.ts', async () => {
  const actual = await vi.importActual<typeof import('../rateLimiter.ts')>('../rateLimiter.ts');
  return { ...actual, clearRateLimit: (...a: unknown[]) => clearRateLimit(...a) };
});

vi.mock('../auth-mw.ts', () => ({
  // Stand-in for the real guard: the caller's role arrives on a test header.
  requireSuperAdmin: async (
    c: {
      req: { header: (n: string) => string | undefined };
      json: (b: unknown, s: number) => Response;
      set: (k: string, v: string) => void;
    },
    next: () => Promise<void>,
  ) => {
    const role = c.req.header('x-test-role');
    if (!role) return c.json({ error: 'Unauthorized' }, 401);
    if (role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403);
    c.set('userId', 'sa-1');
    c.set('userRole', role);
    await next();
  },
}));

vi.mock('../admin-audit-service.ts', () => ({ AdminAuditService: { record: auditRecord } }));

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

import adminAuthRoutes from '../auth-admin-routes.ts';

const post = (path: string, body: unknown, role?: string) =>
  adminAuthRoutes.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(role ? { 'x-test-role': role } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('no shared-secret account doors', () => {
  it('no longer reads the shared super-admin secret', () => {
    const code = SOURCE.split('\n')
      .filter((line) => {
        const t = line.trim();
        return !(t.startsWith('*') || t.startsWith('//') || t.startsWith('/*'));
      })
      .join('\n');
    expect(code).not.toMatch(/SUPER_ADMIN_PASSWORD|secretKey/);
  });

  it('never creates accounts or sets passwords', () => {
    expect(SOURCE).not.toMatch(/createUser|updateUserById|listUsers/);
  });

  it('registers exactly one route, behind a super-admin session', () => {
    const routes = [...SOURCE.matchAll(/adminAuthRoutes\.(get|post|put|patch|delete)\(/g)];
    expect(routes).toHaveLength(1);
    expect(SOURCE).toMatch(/'\/clear-rate-limit',\s*requireSuperAdmin/);
  });

  it.each(['/create-superadmin', '/ensure-dev-user'])(
    '%s 404s even for a super-admin session',
    async (path) => {
      const res = await post(
        path,
        { email: 'a@b.com', password: 'Passw0rd!x', secretKey: 'the-real-secret' },
        'super_admin',
      );
      expect(res.status).toBe(404);
    },
  );
});

describe('clear-rate-limit', () => {
  it('refuses a caller with no session, even with the old secret', async () => {
    const res = await post('/clear-rate-limit', { secretKey: 'the-real-secret', email: 'a@b.com' });
    expect(res.status).toBe(401);
    expect(clearRateLimit).not.toHaveBeenCalled();
  });

  it('refuses an admin who is not a super-admin', async () => {
    const res = await post('/clear-rate-limit', { email: 'a@b.com' }, 'admin');
    expect(res.status).toBe(403);
    expect(clearRateLimit).not.toHaveBeenCalled();
  });

  it('clears the normalised account bucket and records who did it', async () => {
    const res = await post('/clear-rate-limit', { email: '  A@B.com ' }, 'super_admin');
    expect(res.status).toBe(200);
    expect(clearRateLimit).toHaveBeenCalledTimes(1);
    expect(clearRateLimit).toHaveBeenCalledWith('a@b.com', 'login');
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'sa-1', action: 'login_rate_limit_cleared' }),
    );
  });

  it('rejects a body with no email, which would clear an undefined bucket', async () => {
    const res = await post('/clear-rate-limit', {}, 'super_admin');
    expect(res.status).toBe(400);
    expect(clearRateLimit).not.toHaveBeenCalled();
  });

  it('rejects a body that is not JSON at all as 400', async () => {
    const res = await post('/clear-rate-limit', 'not json', 'super_admin');
    expect(res.status).toBe(400);
  });

  it('never rejects an unknown extra field', async () => {
    const res = await post(
      '/clear-rate-limit',
      { email: 'a@b.com', somethingNew: 'ok' },
      'super_admin',
    );
    expect(res.status).toBe(200);
  });
});
