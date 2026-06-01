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

  // ---- Envelope CRUD + draft group ----
  it('POST /verify-hash is public but 400s without a hash in the body', async () => {
    const res = await esignRoutes.request('/verify-hash', { method: 'POST', body: '{}' });
    expect(res.status).toBe(400);
  });

  it('DELETE /envelopes returns 401 without an Authorization header', async () => {
    const res = await esignRoutes.request('/envelopes', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('POST /envelopes/upload returns 401 without an Authorization header', async () => {
    const res = await esignRoutes.request('/envelopes/upload', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('GET /envelopes/:id returns 404 for an unknown envelope when authenticated', async () => {
    const res = await esignRoutes.request('/envelopes/env_missing', {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(res.status).toBe(404);
  });

  it('PUT /envelopes/:id/draft-signers returns 401 without an Authorization header', async () => {
    const res = await esignRoutes.request('/envelopes/env_x/draft-signers', {
      method: 'PUT',
      body: '{}',
    });
    expect(res.status).toBe(401);
  });

  it('PATCH /envelopes/:id/draft-settings returns 401 without an Authorization header', async () => {
    const res = await esignRoutes.request('/envelopes/env_x/draft-settings', {
      method: 'PATCH',
      body: '{}',
    });
    expect(res.status).toBe(401);
  });

  // ---- Auth-enforcement contracts across the major route groups ----
  // These lock the invariant that every group is reachable AND auth-gated,
  // so the Phase 5 extraction into sub-apps cannot silently drop a group's
  // mount or its getAuthContext guard. A no-Authorization request must 401.
  const AUTH_GUARDED: ReadonlyArray<readonly [string, string, RequestInit?]> = [
    ['GET', '/me/notification-prefs'],
    ['PUT', '/me/notification-prefs', { method: 'PUT', body: '{}' }],
    ['GET', '/me/notifications'],
    ['POST', '/me/notifications/read-all', { method: 'POST' }],
    ['GET', '/diagnostics/sms'],
    ['POST', '/maintenance/expiry-sweep', { method: 'POST', body: '{}' }],
    ['POST', '/maintenance/reminder-sweep', { method: 'POST', body: '{}' }],
    ['GET', '/envelopes/env_missing'],
    ['GET', '/clients/c1/envelopes'],
  ];
  for (const [method, path, init] of AUTH_GUARDED) {
    it(`${method} ${path} returns 401 without an Authorization header`, async () => {
      const res = await esignRoutes.request(path, init ?? {});
      expect(res.status).toBe(401);
    });
  }

  it('GET /me/notification-prefs returns the prefs envelope when authenticated', async () => {
    const res = await esignRoutes.request('/me/notification-prefs', {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; preferences: unknown };
    expect(body.success).toBe(true);
    expect(body.preferences).toBeDefined();
  });

  it('GET /me/notifications returns the notifications envelope when authenticated', async () => {
    const res = await esignRoutes.request('/me/notifications', {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('GET /diagnostics/sms reports the SMS provider status when authenticated', async () => {
    const res = await esignRoutes.request('/diagnostics/sms', {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; sms: unknown };
    expect(body.success).toBe(true);
    expect(body.sms).toBeDefined();
  });

  // ---- Envelope fields group (CRUD on a draft envelope's signature fields) ----
  it('GET /envelopes/:id/fields returns 401 without an Authorization header', async () => {
    const res = await esignRoutes.request('/envelopes/env_x/fields');
    expect(res.status).toBe(401);
  });

  it('GET /envelopes/:id/fields returns 404 for an unknown envelope when authenticated', async () => {
    const res = await esignRoutes.request('/envelopes/env_missing/fields', {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(res.status).toBe(404);
  });

  it('PATCH /envelopes/:id/fields/:fieldId returns 401 without an Authorization header', async () => {
    const res = await esignRoutes.request('/envelopes/env_x/fields/f1', {
      method: 'PATCH',
      body: '{}',
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /envelopes/:id/fields/:fieldId returns 401 without an Authorization header', async () => {
    const res = await esignRoutes.request('/envelopes/env_x/fields/f1', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  // ---- Envelope documents + manifest group (prep-time doc management) ----
  const DOC_MANIFEST_AUTH_GUARDED: ReadonlyArray<readonly [string, string, RequestInit?]> = [
    ['GET', '/envelopes/env_x/manifest'],
    ['DELETE', '/envelopes/env_x/manifest', { method: 'DELETE' }],
    ['POST', '/envelopes/env_x/materialize-preview', { method: 'POST', body: '{}' }],
    ['GET', '/envelopes/env_x/documents'],
    ['DELETE', '/envelopes/env_x/documents/doc1', { method: 'DELETE' }],
    ['PUT', '/envelopes/env_x/documents/order', { method: 'PUT', body: '{}' }],
    ['POST', '/envelopes/env_x/invites', { method: 'POST', body: '{}' }],
  ];
  for (const [method, path, init] of DOC_MANIFEST_AUTH_GUARDED) {
    it(`${method} ${path} returns 401 without an Authorization header`, async () => {
      const res = await esignRoutes.request(path, init ?? {});
      expect(res.status).toBe(401);
    });
  }

  it('GET /envelopes/:id/manifest returns { manifest: null } for an unknown envelope', async () => {
    const res = await esignRoutes.request('/envelopes/env_missing/manifest', {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ manifest: null });
  });

  it('GET /envelopes/:id/documents returns 404 for an unknown envelope when authenticated', async () => {
    const res = await esignRoutes.request('/envelopes/env_missing/documents', {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(res.status).toBe(404);
  });

  // ---- /cron/* uses the service-role-key auth model, not user sessions ----
  // (token must equal SUPABASE_SERVICE_ROLE_KEY; the Deno.env mock returns
  // 'test', so `Bearer test` authenticates and anything else / nothing 401s.)
  it('POST /cron/expiry-sweep returns 401 without the service role key', async () => {
    const res = await esignRoutes.request('/cron/expiry-sweep', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('POST /cron/expiry-sweep returns 401 with a wrong bearer token', async () => {
    const res = await esignRoutes.request('/cron/expiry-sweep', {
      method: 'POST',
      headers: { Authorization: 'Bearer not-the-service-key' },
    });
    expect(res.status).toBe(401);
  });

  it('POST /cron/expiry-sweep runs the sweep with the service role key', async () => {
    const res = await esignRoutes.request('/cron/expiry-sweep', {
      method: 'POST',
      headers: { Authorization: 'Bearer test' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  // ---- Signer token-flow group (public, token-authenticated; OTP + submit) ----
  // These routes authenticate by signer access token in the body/path, not a
  // session Bearer header — so the stable contracts are 404 for a bad token
  // and 400 for a missing/invalid body, which lock the validation + the mount.
  it('GET /sign-by-token/:token returns 404 for an invalid signing token', async () => {
    const res = await esignRoutes.request('/sign-by-token/not-a-real-token');
    expect(res.status).toBe(404);
  });

  it('GET /signer/download/:token returns 404 for an invalid token', async () => {
    const res = await esignRoutes.request('/signer/download/not-a-real-token');
    expect(res.status).toBe(404);
  });

  const SIGNER_BODY_VALIDATED: ReadonlyArray<readonly [string, string]> = [
    ['POST', '/signer/validate'],
    ['POST', '/signer/verify-otp'],
    ['POST', '/signer/resend-otp'],
    ['POST', '/signer/submit'],
    ['POST', '/signer/reject'],
    ['POST', '/signer/saved-signature'],
    ['POST', '/signer/attachment'],
    ['POST', '/signer/pause'],
  ];
  for (const [method, path] of SIGNER_BODY_VALIDATED) {
    it(`${method} ${path} returns 400 for an empty/invalid body`, async () => {
      const res = await esignRoutes.request(path, { method, body: '{}' });
      expect(res.status).toBe(400);
    });
  }

  it('GET /envelopes/:id/attachments returns 401 without an Authorization header', async () => {
    const res = await esignRoutes.request('/envelopes/env_x/attachments');
    expect(res.status).toBe(401);
  });

  // ---- Sender envelope-actions group (session-authed sender operations) ----
  // Only the routes that authenticate before touching the body/envelope have a
  // stable no-auth 401 contract; the body-first POSTs (otp/send, verify, sign,
  // reject, recall, remind) are validation/seed-dependent and are exercised by
  // the service-layer happy-path test instead.
  const SENDER_AUTH_GUARDED: ReadonlyArray<readonly [string, string, RequestInit?]> = [
    ['GET', '/envelopes/env_x/audit'],
    ['GET', '/envelopes/env_x/document'],
    ['GET', '/envelopes/env_x/certificate'],
    ['DELETE', '/envelopes/env_x', { method: 'DELETE' }],
    ['GET', '/envelopes/env_x/evidence-pack'],
    ['GET', '/envelopes/env_x/reminder-config'],
    ['PUT', '/envelopes/env_x/reminder-config', { method: 'PUT', body: '{}' }],
    ['PATCH', '/envelopes/env_x/signing-mode', { method: 'PATCH', body: '{}' }],
    ['GET', '/envelopes/env_x/audit/export'],
    ['GET', '/diagnostics/kba'],
  ];
  for (const [method, path, init] of SENDER_AUTH_GUARDED) {
    it(`${method} ${path} returns 401 without an Authorization header`, async () => {
      const res = await esignRoutes.request(path, init ?? {});
      expect(res.status).toBe(401);
    });
  }

  it('POST /signer/kba returns 400 for an empty/invalid body (token-authed)', async () => {
    const res = await esignRoutes.request('/signer/kba', { method: 'POST', body: '{}' });
    expect(res.status).toBe(400);
  });
});
