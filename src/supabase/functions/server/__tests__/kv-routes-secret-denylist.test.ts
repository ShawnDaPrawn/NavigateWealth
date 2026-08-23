/**
 * Generic KV reader hardening — SECURITY-AUDIT S4 regression guard
 * ================================================================
 *
 * `GET /kv-store/:key` returns any value in the datastore. It was gated on
 * `admin`, and the audit's finding was that an `admin` is not the owner: any
 * one of them could read `esign_config:platform_signing_cert` — the PDF signing
 * private key AND its passphrase — and forge signatures that validate
 * identically to genuine ones.
 *
 * Two independent controls are asserted, because a role check alone protects
 * against the wrong person and says nothing about the wrong key.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/kv-routes-secret-denylist.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const kvGet = vi.fn(async () => ({ secret: 'value' }));
const auditRecord = vi.fn(async () => ({}));

/** Role the fake auth middleware will grant for the next request. */
let currentRole = 'super_admin';

vi.mock('../kv_store.tsx', () => ({
  get: (...args: unknown[]) => kvGet(...(args as [])),
  set: vi.fn(),
  del: vi.fn(),
  getByPrefix: vi.fn(async () => []),
  mget: vi.fn(),
  mset: vi.fn(),
  mdel: vi.fn(),
}));

vi.mock('../auth-mw.ts', () => ({
  // Mirrors the real middleware's contract: reject non-super-admins with 403,
  // otherwise populate the context the handler reads.
  requireSuperAdmin: async (
    c: { set: (k: string, v: unknown) => void; json: (b: unknown, s: number) => Response },
    next: () => Promise<void>,
  ) => {
    if (currentRole !== 'super_admin' && currentRole !== 'super-admin') {
      return c.json({ error: 'Forbidden: Super Admin access required' }, 403);
    }
    c.set('userId', 'actor-1');
    c.set('userRole', currentRole);
    await next();
  },
  requireAdmin: async () => {
    throw new Error('kv-routes must not fall back to requireAdmin');
  },
}));

vi.mock('../admin-audit-service.ts', () => ({
  AdminAuditService: { record: (...args: unknown[]) => auditRecord(...(args as [])) },
}));

import kvRoutes from '../kv-routes.ts';

const call = (key: string) =>
  kvRoutes.fetch(new Request(`http://localhost/${encodeURIComponent(key)}`));

beforeEach(() => {
  currentRole = 'super_admin';
  kvGet.mockClear();
  auditRecord.mockClear();
});

describe('secret-key denylist', () => {
  it('refuses the e-sign platform signing certificate', async () => {
    const response = await call('esign_config:platform_signing_cert');

    expect(response.status).toBe(403);
    // The decisive assertion: the store was never even consulted, so the key
    // material cannot have reached the response body.
    expect(kvGet).not.toHaveBeenCalled();
  });

  it('refuses every denied namespace, to a super-admin included', async () => {
    // Deliberately checked as super_admin: the denylist is defence in depth and
    // must not be bypassable by having the strongest role.
    for (const key of [
      'esign_config:anything',
      'smtp_config:primary',
      'api_credentials:sendgrid',
      'integration_secrets:momentum',
      'provider_portal_credentials:discovery',
    ]) {
      const response = await call(key);
      expect(response.status, `expected ${key} to be refused`).toBe(403);
    }
    expect(kvGet).not.toHaveBeenCalled();
  });

  it('matches the denylist case-insensitively', async () => {
    const response = await call('ESIGN_CONFIG:platform_signing_cert');
    expect(response.status).toBe(403);
    expect(kvGet).not.toHaveBeenCalled();
  });

  it('records a critical audit entry when a secret read is refused', async () => {
    await call('esign_config:platform_signing_cert');

    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'kv_secret_read_denied',
        severity: 'critical',
        actorId: 'actor-1',
      }),
    );
  });

  it('still serves ordinary keys', async () => {
    const response = await call('user_profile:123:personal_info');

    expect(response.status).toBe(200);
    expect(kvGet).toHaveBeenCalledWith('user_profile:123:personal_info');
  });

  it('audits ordinary reads too, so a break-glass read is attributable', async () => {
    await call('user_profile:123:personal_info');

    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'kv_read', actorId: 'actor-1' }),
    );
  });
});

describe('role gate', () => {
  it('rejects a plain admin — the principal the audit called out', async () => {
    currentRole = 'admin';

    const response = await call('user_profile:123:personal_info');

    expect(response.status).toBe(403);
    expect(kvGet).not.toHaveBeenCalled();
  });
});
