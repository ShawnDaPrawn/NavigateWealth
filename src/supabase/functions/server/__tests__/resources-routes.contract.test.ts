/**
 * resources-routes.ts — route contract tests
 * ==========================================
 *
 * WHY THIS FAMILY
 * ---------------
 * 208 statements at 0% coverage, and it straddles the public/gated boundary in
 * one file: `GET /resources/legal/:slug` is served to anonymous visitors (the
 * public Legal & Compliance page reads it), while every authoring route beside
 * it is `requireAuth` + `requireAdmin`. That shape — a public read next to
 * admin writes — is exactly the one that produced the only genuine gap found in
 * the §5.5 route classification, where `integrations-schema-routes.ts` had the
 * write guarded and the reads open. Nothing was pinning this file's version of
 * that boundary.
 *
 * It is also on the §7.3 public-surface inventory, so if the boundary moves the
 * verify_jwt flip would be planned against a stale list.
 *
 * WHAT IS ASSERTED
 * ----------------
 *   - the public legal read answers WITHOUT an Authorization header, in both
 *     the found and not-found shapes (the not-found shape is a 200 with
 *     `available: false`, not a 404 — a detail a rewrite would plausibly
 *     "fix" and break the public page with);
 *   - the admin routes beside it reject an unauthenticated caller;
 *   - the health descriptor keeps its exact body, since the smoke and the
 *     module-descriptor classification both depend on it.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/resources-routes.contract.test.ts
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test' } });
});

vi.mock('../stderr-logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn(), debug: vi.fn() },
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../admin-audit-service.ts', () => ({
  AdminAuditService: { record: vi.fn(async () => {}) },
}));

// Auth middleware: a pass-through that still enforces the header, so the
// public/gated boundary is what is actually being measured here.
vi.mock('../auth-mw.ts', () => ({
  requireAuth: async (c: any, next: any) => {
    if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'test-user');
    c.set('userRole', 'admin');
    await next();
  },
  requireAdmin: async (c: any, next: any) => {
    if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);
    await next();
  },
  requireSuperAdmin: async (c: any, next: any) => {
    if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);
    await next();
  },
}));

const serviceMocks = vi.hoisted(() => ({
  getLegalDocumentPublic: vi.fn(),
  listLegalDocumentDefinitions: vi.fn(async () => []),
  seedLegalDocuments: vi.fn(async () => ({ seeded: 0 })),
}));

vi.mock('../resources-service.ts', () => ({
  ResourcesService: class {
    getLegalDocumentPublic = serviceMocks.getLegalDocumentPublic;
    listLegalDocumentDefinitions = serviceMocks.listLegalDocumentDefinitions;
    seedLegalDocuments = serviceMocks.seedLegalDocuments;
  },
}));

const app = (await import('../resources-routes.ts')).default;

const AUTH = { Authorization: 'Bearer test-token' };

beforeEach(() => {
  vi.clearAllMocks();
  serviceMocks.listLegalDocumentDefinitions.mockResolvedValue([]);
  serviceMocks.seedLegalDocuments.mockResolvedValue({ seeded: 0 });
});

describe('resources-routes: health descriptor', () => {
  it('answers with the exact body the smoke and the classification rely on', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ service: 'resources', status: 'active' });
  });
});

describe('resources-routes: GET /legal/:slug is PUBLIC', () => {
  it('serves a legal document with no Authorization header', async () => {
    serviceMocks.getLegalDocumentPublic.mockResolvedValue({ title: 'Terms', body: '...' });

    const res = await app.request('/legal/terms-of-service');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      available: true,
      slug: 'terms-of-service',
      document: { title: 'Terms', body: '...' },
    });
  });

  it('returns 200 with available:false — NOT a 404 — for an unknown slug', async () => {
    // Deliberately pinned. The public Legal page distinguishes "this document
    // is not published yet" from "the request failed", and it does that on the
    // `available` flag, not on the status code. Turning this into a 404 reads
    // like a correctness fix and would break that page.
    serviceMocks.getLegalDocumentPublic.mockResolvedValue(null);

    const res = await app.request('/legal/does-not-exist');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ available: false, slug: 'does-not-exist' });
  });

  it('does not consult the auth middleware at all', async () => {
    // If someone adds requireAuth here, the public Legal & Compliance page goes
    // blank for every anonymous visitor and nothing else fails. This is the
    // assertion that catches it.
    serviceMocks.getLegalDocumentPublic.mockResolvedValue({ title: 'Privacy' });
    const res = await app.request('/legal/privacy-policy');
    expect(res.status).not.toBe(401);
    expect(serviceMocks.getLegalDocumentPublic).toHaveBeenCalledWith('privacy-policy');
  });
});

describe('resources-routes: the admin routes beside it are NOT public', () => {
  it.each([
    ['GET', '/admin/legal-documents'],
    ['POST', '/legal/seed'],
  ])('%s %s rejects an unauthenticated caller', async (method, path) => {
    const res = await app.request(path, {
      method,
      ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}),
    });
    expect(res.status).toBe(401);
  });

  it('serves the admin list once authenticated', async () => {
    serviceMocks.listLegalDocumentDefinitions.mockResolvedValue([{ id: 'doc-1' }]);

    const res = await app.request('/admin/legal-documents', { headers: AUTH });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ documents: [{ id: 'doc-1' }] });
  });

  it('seeds only for an authenticated admin, and passes the registry through', async () => {
    serviceMocks.seedLegalDocuments.mockResolvedValue({ seeded: 3 });

    const res = await app.request('/legal/seed', {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents: [{ slug: 'a' }] }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true, seeded: 3 });
    expect(serviceMocks.seedLegalDocuments).toHaveBeenCalledWith([{ slug: 'a' }]);
  });

  it('tolerates a malformed seed body rather than 500ing', async () => {
    // The handler does `c.req.json().catch(() => ({}))` — pinned because the
    // obvious "add validateBody here" change would turn this into a 400, and
    // the admin UI posts an empty body for a default seed.
    const res = await app.request('/legal/seed', {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: 'not json',
    });

    expect(res.status).toBe(200);
    expect(serviceMocks.seedLegalDocuments).toHaveBeenCalledWith(undefined);
  });
});
