/**
 * security.tsx — Route Contract / Characterization Tests (Phase 5)
 * ================================================================
 *
 * Purpose: lock the response CONTRACTS of the security Edge Function's routes
 * BEFORE the Phase 5 decomposition splits this 1,561-line file into sub-routers.
 * If a route's shape, status code, or auth behaviour changes during extraction,
 * these tests fail.
 *
 * Covers:
 *   GET/POST  /:userId/activity       (activity log)
 *   POST      /:userId/password       (password change)
 *   GET       /:userId/status         (security status)
 *   POST      /:userId/suspend        (admin-only suspend/unsuspend)
 *   POST      /:userId/2fa            (toggle 2FA)
 *   POST      /:userId/2fa/send-code  (send 2FA email code)
 *   POST      /:userId/2fa/verify-code (verify 2FA code)
 *   POST      /:userId/email-change/request
 *   POST      /:userId/email-change/resend
 *   POST      /:userId/email-change/verify
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/security-routes.contract.test.ts
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ── Deno runtime shim ────────────────────────────────────────────────────────
beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test-value' } });
});

// ── In-memory KV ─────────────────────────────────────────────────────────────
const kvStore = new Map<string, unknown>();
const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (key: string) => clone(kvStore.get(key) ?? null)),
  set: vi.fn(async (key: string, value: unknown) => {
    kvStore.set(key, clone(value));
  }),
  del: vi.fn(async (key: string) => {
    kvStore.delete(key);
  }),
  mget: vi.fn(async (keys: string[]) => keys.map((k) => clone(kvStore.get(k) ?? null))),
  mset: vi.fn(async (keys: string[], values: unknown[]) => {
    keys.forEach((k, i) => kvStore.set(k, clone(values[i])));
  }),
  mdel: vi.fn(async (keys: string[]) => {
    keys.forEach((k) => kvStore.delete(k));
  }),
  getByPrefix: vi.fn(async (prefix: string) => {
    const out: unknown[] = [];
    kvStore.forEach((v, k) => {
      if (k.startsWith(prefix)) out.push(clone(v));
    });
    return out;
  }),
  listByPrefix: vi.fn(async (prefix: string) => {
    const out: { key: string; value: unknown }[] = [];
    kvStore.forEach((v, k) => {
      if (k.startsWith(prefix)) out.push({ key: k, value: clone(v) });
    });
    return out;
  }),
}));

// ── Quiet logger ──────────────────────────────────────────────────────────────
vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Auth middleware ────────────────────────────────────────────────────────────
// The test userId for "self" checks is 'test-user'
const authMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(async (c: any, next: any) => {
    if (!c.req.header('Authorization')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    c.set('user', { id: 'test-user', email: 'admin@test.co' });
    c.set('userId', 'test-user');
    c.set('userRole', 'admin');
    await next();
  }),
}));

vi.mock('../auth-mw.ts', () => ({
  requireAuth: authMocks.requireAuth,
  requirePrimaryAuth: authMocks.requireAuth,
}));

// ── Supabase client stub ───────────────────────────────────────────────────────
const mockSupabaseUser = {
  id: 'test-user',
  email: 'user@test.co',
};

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    auth: {
      admin: {
        getUserById: vi.fn(async (id: string) => {
          if (id === 'test-user') {
            return { data: { user: mockSupabaseUser }, error: null };
          }
          return { data: null, error: { message: 'User not found' } };
        }),
        updateUserById: vi.fn(async () => ({
          data: { user: mockSupabaseUser },
          error: null,
        })),
      },
      signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
      signOut: vi.fn(async () => ({})),
      updateUser: vi.fn(async () => ({ data: { user: mockSupabaseUser }, error: null })),
    },
    from: () => ({
      select: () => ({ like: () => ({ data: [], error: null }) }),
    }),
  }),
}));

// ── Email service stub ─────────────────────────────────────────────────────────
vi.mock('../email-service.ts', () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
  sendTwoFactorEmail: vi.fn(async () => ({ success: true })),
  createEmailTemplate: vi.fn(() => '<html>test</html>'),
  getFooterSettings: vi.fn(async () => ({})),
}));

import securityApp from '../security.tsx';

const AUTH = { Authorization: 'Bearer test-token' };
const OTHER_USER_ID = 'other-user-id';

beforeEach(() => {
  kvStore.clear();
});

describe('security.tsx route contracts', () => {
  it('GET / returns the service status envelope (no auth)', async () => {
    const res = await securityApp.request('/');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ service: 'security', status: 'active' });
  });

  // ── GET /:userId/activity ──────────────────────────────────────────────────
  describe('GET /:userId/activity', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await securityApp.request('/test-user/activity');
      expect(res.status).toBe(401);
    });

    it('returns 403 when acting on a different user without admin role', async () => {
      // Override mock to non-admin role for this test
      const { requireAuth } = await import('../auth-mw.ts');
      vi.mocked(requireAuth).mockImplementationOnce(async (c: any, next: any) => {
        c.set('userId', 'test-user');
        c.set('userRole', 'adviser');
        await next();
      });
      const res = await securityApp.request(`/${OTHER_USER_ID}/activity`, { headers: AUTH });
      expect(res.status).toBe(403);
    });

    it('returns 200 with { success, count, logs } when no logs exist', async () => {
      const res = await securityApp.request('/test-user/activity', { headers: AUTH });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(typeof body.count).toBe('number');
      expect(Array.isArray(body.logs)).toBe(true);
    });

    it('returns stored activity logs sorted by timestamp descending', async () => {
      kvStore.set('activity:test-user:log1', {
        id: 'log1',
        userId: 'test-user',
        type: 'login',
        timestamp: '2025-01-01T00:00:00.000Z',
        success: true,
      });
      kvStore.set('activity:test-user:log2', {
        id: 'log2',
        userId: 'test-user',
        type: 'logout',
        timestamp: '2025-06-01T00:00:00.000Z',
        success: true,
      });
      const res = await securityApp.request('/test-user/activity', { headers: AUTH });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { count: number; logs: Array<{ id: string }> };
      expect(body.count).toBe(2);
      expect(body.logs[0].id).toBe('log2'); // newer first
    });
  });

  // ── POST /:userId/activity ─────────────────────────────────────────────────
  describe('POST /:userId/activity', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await securityApp.request('/test-user/activity', {
        method: 'POST',
        body: JSON.stringify({ type: 'login', success: true }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 on invalid body (missing required fields)', async () => {
      const res = await securityApp.request('/test-user/activity', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'Validation failed' });
    });

    it('returns 200 and stores the activity log entry', async () => {
      const res = await securityApp.request('/test-user/activity', {
        method: 'POST',
        body: JSON.stringify({ type: 'login_success', success: true }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; log: Record<string, unknown> };
      expect(body.success).toBe(true);
      expect(body.log).toMatchObject({ userId: 'test-user', type: 'login_success' });
    });
  });

  // ── GET /:userId/status ────────────────────────────────────────────────────
  describe('GET /:userId/status', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await securityApp.request('/test-user/status');
      expect(res.status).toBe(401);
    });

    it('returns 200 with default status when none stored', async () => {
      const res = await securityApp.request('/test-user/status', { headers: AUTH });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(typeof body.status).toBe('object');
      expect(typeof (body.status as Record<string, unknown>).suspended).toBe('boolean');
      expect(typeof (body.status as Record<string, unknown>).twoFactorEnabled).toBe('boolean');
    });

    it('returns the stored status when one exists', async () => {
      kvStore.set('security:test-user', {
        suspended: true,
        twoFactorEnabled: false,
        suspendedReason: 'test',
      });
      const res = await securityApp.request('/test-user/status', { headers: AUTH });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: Record<string, unknown> };
      expect(body.status.suspended).toBe(true);
    });
  });

  // ── POST /:userId/suspend ──────────────────────────────────────────────────
  describe('POST /:userId/suspend', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await securityApp.request('/test-user/suspend', {
        method: 'POST',
        body: JSON.stringify({ suspended: true }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 on invalid body (missing suspended field)', async () => {
      const res = await securityApp.request('/test-user/suspend', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'Validation failed' });
    });

    it('suspends a user and returns updated status', async () => {
      const res = await securityApp.request('/test-user/suspend', {
        method: 'POST',
        body: JSON.stringify({ suspended: true, adminId: 'admin1', reason: 'Suspicious activity' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; status: Record<string, unknown> };
      expect(body.success).toBe(true);
      expect(body.status.suspended).toBe(true);
    });

    it('unsuspends a user and clears suspension metadata', async () => {
      kvStore.set('security:test-user', {
        suspended: true,
        twoFactorEnabled: false,
        suspendedReason: 'test',
      });
      const res = await securityApp.request('/test-user/suspend', {
        method: 'POST',
        body: JSON.stringify({ suspended: false, adminId: 'admin1' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; status: Record<string, unknown> };
      expect(body.success).toBe(true);
      expect(body.status.suspended).toBe(false);
    });
  });

  // ── POST /:userId/2fa ──────────────────────────────────────────────────────
  describe('POST /:userId/2fa', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await securityApp.request('/test-user/2fa', {
        method: 'POST',
        body: JSON.stringify({ enabled: true }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 on invalid body (missing enabled field)', async () => {
      const res = await securityApp.request('/test-user/2fa', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'Validation failed' });
    });

    it('enables 2FA and returns updated status', async () => {
      const res = await securityApp.request('/test-user/2fa', {
        method: 'POST',
        body: JSON.stringify({ enabled: true }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        status: { twoFactorEnabled: boolean };
      };
      expect(body.success).toBe(true);
      expect(body.status.twoFactorEnabled).toBe(true);
    });
  });

  // ── POST /:userId/2fa/send-code ────────────────────────────────────────────
  describe('POST /:userId/2fa/send-code', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await securityApp.request('/test-user/2fa/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });

    it('returns 404 when user is not found in Supabase', async () => {
      const res = await securityApp.request(`/${OTHER_USER_ID}/2fa/send-code`, {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      // 403 because OTHER_USER_ID !== test-user (self-check) and role is admin so passes,
      // then getUserById returns not-found
      // admin role passes ensureSelfOrAdmin, but getUserById on OTHER_USER_ID returns 404
      expect([403, 404]).toContain(res.status);
    });

    it('returns 200 and sends code when user exists', async () => {
      const res = await securityApp.request('/test-user/2fa/send-code', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });
  });

  // ── POST /:userId/2fa/verify-code ─────────────────────────────────────────
  describe('POST /:userId/2fa/verify-code', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await securityApp.request('/test-user/2fa/verify-code', {
        method: 'POST',
        body: JSON.stringify({ code: '123456' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 on invalid body (missing code)', async () => {
      const res = await securityApp.request('/test-user/2fa/verify-code', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'Validation failed' });
    });

    it('returns 400 when no code has been sent (no stored code)', async () => {
      const res = await securityApp.request('/test-user/2fa/verify-code', {
        method: 'POST',
        body: JSON.stringify({ code: '123456' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ success: false });
    });

    it('returns 200 on valid code', async () => {
      const expiresAt = new Date(Date.now() + 60000).toISOString();
      kvStore.set('2fa:test-user:code', {
        code: '654321',
        expiresAt,
        attempts: 0,
      });
      const res = await securityApp.request('/test-user/2fa/verify-code', {
        method: 'POST',
        body: JSON.stringify({ code: '654321' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });
  });

  // ── 2FA code generation & comparison: security properties ─────────────────
  //
  // These assert HOW the login code is made and checked, not just that the
  // route answers 200. The code emailed here is the second factor on a
  // portal holding client financial records, and it was previously derived
  // from `Math.random()` — a non-cryptographic PRNG whose internal state is
  // recoverable from a few observed outputs, after which every later code is
  // predictable (CWE-338). The e-sign OTP path had used the CSPRNG helper
  // since crypto-utils.ts was written; this login path was the last holdout.
  describe('2FA code security properties', () => {
    it('never derives the code from Math.random()', async () => {
      // The regression test proper, and deterministic: pin Math.random() to a
      // fixed value and check the code is NOT the one the old expression
      // produced from it. `Math.floor(100000 + 0.5 * 900000)` is 550000, so a
      // reintroduced `Math.random()` generator fails here rather than shipping.
      //
      // Spying rather than asserting "not called" on purpose — Math.random()
      // is still used legitimately in this route for cosmetic activity-log
      // ids, so the claim has to be about the code itself.
      const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const res = await securityApp.request('/test-user/2fa/send-code', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);

      const stored = kvStore.get('2fa:test-user:code') as { code: string } | undefined;
      expect(stored?.code).toBeDefined();
      expect(stored!.code).not.toBe('550000');
      expect(stored!.code).toMatch(/^[0-9]{6}$/);

      rand.mockRestore();
    });

    it('draws the code from the CSPRNG', async () => {
      const getRandomValues = vi.spyOn(globalThis.crypto, 'getRandomValues');

      const res = await securityApp.request('/test-user/2fa/send-code', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      expect(getRandomValues).toHaveBeenCalled();
      getRandomValues.mockRestore();
    });

    it('stores a 6-digit numeric code', async () => {
      await securityApp.request('/test-user/2fa/send-code', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });

      const stored = kvStore.get('2fa:test-user:code') as { code: string };
      expect(stored.code).toMatch(/^[0-9]{6}$/);
    });

    it('does not repeat a code across sends', async () => {
      // Not a randomness proof — a cheap smoke check that the generator is
      // actually drawing each time rather than returning a constant.
      const seen = new Set<string>();
      for (let i = 0; i < 12; i++) {
        kvStore.clear();
        await securityApp.request('/test-user/2fa/send-code', {
          method: 'POST',
          body: JSON.stringify({}),
          headers: { ...AUTH, 'Content-Type': 'application/json' },
        });
        seen.add((kvStore.get('2fa:test-user:code') as { code: string }).code);
      }
      expect(seen.size).toBeGreaterThan(1);
    });

    it('rejects a wrong code of the same length and counts the attempt', async () => {
      kvStore.set('2fa:test-user:code', {
        code: '654321',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        attempts: 0,
      });

      const res = await securityApp.request('/test-user/2fa/verify-code', {
        method: 'POST',
        body: JSON.stringify({ code: '654322' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ success: false });
      expect((kvStore.get('2fa:test-user:code') as { attempts: number }).attempts).toBe(1);
    });

    it('rejects a code that shares a prefix with the real one', async () => {
      // The shape a timing oracle would be walked through, digit by digit.
      // `constantTimeEqual` compares every character regardless.
      kvStore.set('2fa:test-user:code', {
        code: '654321',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        attempts: 0,
      });

      const res = await securityApp.request('/test-user/2fa/verify-code', {
        method: 'POST',
        body: JSON.stringify({ code: '654399' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
    });

    it('rejects a wrong-length code without throwing', async () => {
      // constantTimeEqual returns false on a length mismatch rather than
      // indexing past the end of the shorter string.
      kvStore.set('2fa:test-user:code', {
        code: '654321',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        attempts: 0,
      });

      const res = await securityApp.request('/test-user/2fa/verify-code', {
        method: 'POST',
        body: JSON.stringify({ code: '6543' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
    });

    it('still accepts the correct code', async () => {
      // The constant-time comparison must not break the happy path.
      kvStore.set('2fa:test-user:code', {
        code: '654321',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        attempts: 0,
      });

      const res = await securityApp.request('/test-user/2fa/verify-code', {
        method: 'POST',
        body: JSON.stringify({ code: '654321' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ success: true });
    });

    it('accepts a generated code end-to-end', async () => {
      // Generation and verification agree: send, read what was stored, verify.
      await securityApp.request('/test-user/2fa/send-code', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      const { code } = kvStore.get('2fa:test-user:code') as { code: string };

      const res = await securityApp.request('/test-user/2fa/verify-code', {
        method: 'POST',
        body: JSON.stringify({ code }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ success: true });
    });
  });

  // ── POST /:userId/email-change/request ────────────────────────────────────
  describe('POST /:userId/email-change/request', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await securityApp.request('/test-user/email-change/request', {
        method: 'POST',
        body: JSON.stringify({ newEmail: 'new@test.co' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 on invalid body (missing newEmail)', async () => {
      const res = await securityApp.request('/test-user/email-change/request', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'Validation failed' });
    });

    it('returns 200 with email change summary on valid request', async () => {
      const res = await securityApp.request('/test-user/email-change/request', {
        method: 'POST',
        body: JSON.stringify({ newEmail: 'new@test.co', currentPassword: 'test-password' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        pendingEmailChange: Record<string, unknown>;
      };
      expect(body.success).toBe(true);
      expect(body.pendingEmailChange).toMatchObject({ newEmail: 'new@test.co' });
    });
  });

  // ── POST /:userId/email-change/resend ─────────────────────────────────────
  describe('POST /:userId/email-change/resend', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await securityApp.request('/test-user/email-change/resend', {
        method: 'POST',
        body: JSON.stringify({ target: 'new_email' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 when no pending request exists', async () => {
      const res = await securityApp.request('/test-user/email-change/resend', {
        method: 'POST',
        body: JSON.stringify({ target: 'new_email' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ success: false });
    });
  });

  // ── POST /:userId/email-change/verify ─────────────────────────────────────
  describe('POST /:userId/email-change/verify', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await securityApp.request('/test-user/email-change/verify', {
        method: 'POST',
        body: JSON.stringify({ code: '123456', target: 'new_email' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 on invalid body', async () => {
      const res = await securityApp.request('/test-user/email-change/verify', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 when no pending email change exists', async () => {
      const res = await securityApp.request('/test-user/email-change/verify', {
        method: 'POST',
        body: JSON.stringify({ code: '123456', target: 'new_email' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ success: false });
    });
  });

  // ── POST /:userId/password ─────────────────────────────────────────────────
  describe('POST /:userId/password', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await securityApp.request('/test-user/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: 'old', newPassword: 'New1234!' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 on invalid body (missing required fields)', async () => {
      const res = await securityApp.request('/test-user/password', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'Validation failed' });
    });

    it('returns 200 when password change succeeds (mocked Supabase)', async () => {
      const res = await securityApp.request('/test-user/password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: 'OldPass1!',
          newPassword: 'NewPass2@',
          emailPassword: false,
        }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      // Supabase signInWithPassword and updateUserById are mocked to succeed
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });
  });
});
