/**
 * esign-routes.tsx — Route Contract / Characterization Tests (Phase 4)
 * ====================================================================
 *
 * Locks the HTTP-level contracts of the e-sign Edge Function's entry routes
 * BEFORE the Phase 5 decomposition splits this 6,728-line, 131-route file into
 * sub-routers. The existing esign-happy-path test is service-layer only; this
 * mounts the real Hono app and asserts the status envelope + auth enforcement.
 *
 * Mocks only the Deno/IO boundary (in-memory KV, quiet logger, getAuthContext
 * that enforces the Bearer header, pass-through rate-limit/idempotency
 * middleware, stubbed Supabase + Deno.env). No real network/Deno runtime.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub the Deno global BEFORE module imports evaluate (some transitive edge
// module reads Deno.env at module-load). vi.hoisted runs above all imports.
const { stubModule } = vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
  // Uniform stub for heavy service modules (pdf/zip/crypto via Deno npm:
  // subpaths Vitest can't bundle). Any named/default import resolves to a
  // vi.fn(); ESM-interop keys are handled so the module imports cleanly.
  const stubModule = () =>
    new Proxy(
      {},
      {
        get: (_t, prop) => {
          if (prop === '__esModule') return true;
          if (typeof prop === 'symbol' || prop === 'then') return undefined;
          return vi.fn();
        },
      },
    );
  return { stubModule };
});

// Heavy esign service modules the entry routes under test don't exercise.
vi.mock('../esign-documents.ts', () => stubModule());
vi.mock('../esign-evidence-export.ts', () => stubModule());
vi.mock('../esign-synthetic-probe.ts', () => stubModule());
vi.mock('../esign-pdf-protect.ts', () => stubModule());

const kvStore = new Map<string, unknown>();
const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));
vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (k: string) => clone(kvStore.get(k) ?? null)),
  set: vi.fn(async (k: string, v: unknown) => {
    kvStore.set(k, clone(v));
  }),
  del: vi.fn(async (k: string) => {
    kvStore.delete(k);
  }),
  mget: vi.fn(async (ks: string[]) => ks.map((k) => clone(kvStore.get(k) ?? null))),
  mset: vi.fn(async (ks: string[], vs: unknown[]) =>
    ks.forEach((k, i) => kvStore.set(k, clone(vs[i]))),
  ),
  mdel: vi.fn(async (ks: string[]) => ks.forEach((k) => kvStore.delete(k))),
  getByPrefix: vi.fn(async (p: string) => {
    const out: unknown[] = [];
    kvStore.forEach((v, k) => k.startsWith(p) && out.push(clone(v)));
    return out;
  }),
  listByPrefix: vi.fn(async (p: string) => {
    const out: { key: string; value: unknown }[] = [];
    kvStore.forEach((v, k) => k.startsWith(p) && out.push({ key: k, value: clone(v) }));
    return out;
  }),
}));

vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../auth-mw.ts', () => {
  class AuthError extends Error {
    statusCode: number;
    code: string;
    constructor(message: string, statusCode = 401, code = 'AUTH_ERROR') {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
    }
  }
  return {
    AuthError,
    getAuthContext: async (c: any) => {
      if (!c.req.header('Authorization')) {
        throw new AuthError('Unauthorized: Missing token', 401, 'AUTH_REQUIRED');
      }
      return {
        user: { id: 'u1', email: 'admin@test.co' },
        userId: 'u1',
        role: 'admin',
        token: 't',
      };
    },
  };
});

// Middleware factories must return a real pass-through middleware (they run at
// module-load when routes are registered).
vi.mock('../esign-rate-limit.ts', () => ({
  rateLimit: () => async (_c: any, next: any) => {
    await next();
  },
}));
vi.mock('../idempotency.ts', () => ({
  requireIdempotency: () => async (_c: any, next: any) => {
    await next();
  },
}));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ like: () => ({ data: [], error: null }) }) }),
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  }),
}));

// PDF-heavy services pull in pdfjs/pdf-lib/signpdf via Deno `npm:` subpaths that
// Vitest can't bundle; the entry routes under test don't use them, so stub.
vi.mock('../esign-pdf-analysis.ts', () => ({ analyzeUploadedPdf: vi.fn() }));
vi.mock('../esign-pdf-transform.ts', () => ({ applyManifest: vi.fn(), validateManifest: vi.fn() }));
vi.mock('../esign-pdf.service.ts', () => ({ PDFService: class {} }));

import esignRoutes from '../esign-routes.tsx';

beforeEach(() => {
  kvStore.clear();
});

describe('esign-routes.tsx route contracts', () => {
  it('GET / returns the esign service status envelope', async () => {
    const res = await esignRoutes.request('/');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ service: 'esign', status: 'active' });
  });

  it('GET /health returns the health envelope', async () => {
    const res = await esignRoutes.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok', service: 'esign' });
  });

  it('GET /envelopes returns 401 without an Authorization header (auth enforced)', async () => {
    const res = await esignRoutes.request('/envelopes');
    expect(res.status).toBe(401);
  });

  it('GET /envelopes returns the (firm-scoped) envelope list when authenticated', async () => {
    const res = await esignRoutes.request('/envelopes', {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { envelopes: unknown[] };
    expect(Array.isArray(body.envelopes)).toBe(true);
  });
});
