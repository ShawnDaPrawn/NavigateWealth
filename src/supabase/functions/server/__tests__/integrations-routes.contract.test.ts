/**
 * integrations.tsx — Route Contract / Characterization Tests (Phase 4)
 * ====================================================================
 *
 * Purpose: lock the response CONTRACTS of the integrations Edge Function's
 * readable routes BEFORE the Phase 5 decomposition splits this 6,600-line file
 * into submodules. If a route's shape, status code, or auth behaviour changes
 * during extraction, these tests fail.
 *
 * Approach (mirrors fna-intake-routes.integration + esign-happy-path):
 *   • Mount the real Hono app (default export of integrations.tsx).
 *   • Mock the Deno/IO boundary only — in-memory KV, quiet logger, a
 *     pass-through `requireAuth` that still enforces the auth header, and a
 *     stubbed Supabase client. No real network/Deno runtime.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/integrations-routes.contract.test.ts
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ── Deno runtime shim (handlers read Deno.env) ──────────────────────────────
beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test' } });
});

// ── In-memory KV (same pattern as esign-happy-path) ─────────────────────────
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

// ── Quiet logger ────────────────────────────────────────────────────────────
vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Auth middleware: enforce the header, otherwise pass a fake admin user ────
vi.mock('../auth-mw.ts', () => ({
  requireAuth: async (c: any, next: any) => {
    if (!c.req.header('Authorization')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    c.set('user', { id: 'test-user', email: 'admin@test.co' });
    c.set('userId', 'test-user');
    c.set('userRole', 'admin');
    await next();
  },
}));

// ── Supabase client stub (the module-level createClient + local getByPrefix) ─
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ like: () => ({ data: [], error: null }) }),
    }),
  }),
}));

// ── Heavy service module not exercised by the read routes under test ─────────
vi.mock('../policy-extraction-service.ts', () => ({
  extractPolicyDocument: vi.fn(),
  getProviderTerminology: vi.fn(),
  saveProviderTerminology: vi.fn(),
  getAllProviderTerminologies: vi.fn(async () => ({})),
  generateExtractionDiff: vi.fn(),
  buildHistoryEntry: vi.fn(),
}));

import integrationsApp from '../integrations.tsx';

const AUTH = { Authorization: 'Bearer test-token' };

beforeEach(() => {
  kvStore.clear();
});

describe('integrations.tsx route contracts', () => {
  it('GET / returns the service status envelope (no auth)', async () => {
    const res = await integrationsApp.request('/');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ service: 'integrations', status: 'active' });
  });

  describe('GET /providers', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await integrationsApp.request('/providers');
      expect(res.status).toBe(401);
    });

    it('returns an empty list when no providers are stored', async () => {
      const res = await integrationsApp.request('/providers', { headers: AUTH });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ providers: [] });
    });

    it('normalises providers to both snake_case and camelCase and sorts by name', async () => {
      kvStore.set('provider:b', {
        id: 'b',
        name: 'Bravo',
        categoryIds: ['risk'],
        logoUrl: 'b.png',
      });
      kvStore.set('provider:a', { id: 'a', name: 'Alpha', category_ids: ['medical'] });

      const res = await integrationsApp.request('/providers', { headers: AUTH });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { providers: Array<Record<string, unknown>> };

      expect(body.providers.map((p) => p.name)).toEqual(['Alpha', 'Bravo']);
      // camelCase input is mirrored to snake_case (and vice-versa)
      expect(body.providers[1]).toMatchObject({
        id: 'b',
        category_ids: ['risk'],
        categoryIds: ['risk'],
        logo_url: 'b.png',
        logoUrl: 'b.png',
      });
      expect(body.providers[0]).toMatchObject({
        category_ids: ['medical'],
        categoryIds: ['medical'],
      });
    });
  });

  describe('GET /config', () => {
    it('returns 400 when providerId or categoryId is missing', async () => {
      const res = await integrationsApp.request('/config?providerId=x', { headers: AUTH });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining('Missing') });
    });

    it('returns a default config envelope when none is stored', async () => {
      const res = await integrationsApp.request('/config?providerId=p1&categoryId=risk', {
        headers: AUTH,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toMatchObject({
        providerId: 'p1',
        categoryId: 'risk',
        fieldMapping: {},
        fieldBindings: [],
        settings: { autoMap: true, ignoreUnmatched: false, strictMode: false, autoPublish: false },
      });
    });
  });

  describe('GET /policies', () => {
    it('returns 400 when clientId is missing', async () => {
      const res = await integrationsApp.request('/policies');
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'Missing clientId' });
    });

    it('returns only non-archived policies by default', async () => {
      kvStore.set('policies:client:c1', [
        { id: 'p1', categoryId: 'risk', archived: false },
        { id: 'p2', categoryId: 'risk', archived: true },
      ]);
      const res = await integrationsApp.request('/policies?clientId=c1');
      expect(res.status).toBe(200);
      const body = (await res.json()) as { policies: Array<{ id: string }> };
      expect(body.policies.map((p) => p.id)).toEqual(['p1']);
    });

    it('returns archived policies when includeArchived=true', async () => {
      kvStore.set('policies:client:c1', [
        { id: 'p1', categoryId: 'risk', archived: false },
        { id: 'p2', categoryId: 'risk', archived: true },
      ]);
      const res = await integrationsApp.request('/policies?clientId=c1&includeArchived=true');
      expect(res.status).toBe(200);
      const body = (await res.json()) as { policies: Array<{ id: string }> };
      expect(body.policies.map((p) => p.id)).toEqual(['p2']);
    });
  });
});
