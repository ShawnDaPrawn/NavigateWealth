/**
 * esign-documents-routes.ts — Route Contract Tests
 * ================================================
 *
 * The page-manifest and multi-document routes on an envelope: read, save and
 * clear the reorder/rotate manifest; list the envelope's documents; remove one;
 * reorder them. 184 statements, 24% covered.
 *
 * `esign-documents.ts` and `esign-services.ts` run for real — both are KV apart
 * from a fire-and-forget Postgres mirror — so the tests assert against the
 * documents index and audit trail the product actually writes. Stubbed: the
 * storage layer (presigned URLs), the PDF transform, and the Postgres mirror.
 *
 * THE AUTHORIZATION GAP IS PINNED HERE, NOT ENDORSED
 * --------------------------------------------------
 * Not one route in this module scopes to the caller. Each does
 * `getAuthContext(c)` and then loads the envelope straight by id. The module
 * reads `envelope.firm_id` in four places but only ever passes it along; it
 * never compares it to the caller. The sibling `esign-envelopes-routes.ts`
 * calls `belongsToFirm` in four places, and `esign-firm-scope.ts` exists for
 * exactly this and exports `assertFirmAccess`.
 *
 * The tests at the foot of this file pin that as CURRENT behaviour so it is
 * visible and so the fix announces itself by failing them. They are not an
 * endorsement. The fix is blocked on a decision, not on effort: no user in this
 * deployment carries `app_metadata.firm_id`, so `resolveFirmId` falls back to
 * the user id for everyone, and adding a strict `assertFirmAccess` today would
 * lock out every envelope whose firm id matches nobody. See the session notes
 * accompanying this change.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: (key: string) => `test-${key}` },
  };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../esign-postgres-repo.ts', () => ({
  esignPgRepo: {
    insertAudit: vi.fn(async () => undefined),
    upsertEnvelope: vi.fn(async () => undefined),
    upsertSigner: vi.fn(async () => undefined),
  },
}));

/** Storage is a real IO boundary — presigned URLs and PDF bytes. */
vi.mock('../esign-storage.ts', () => ({
  uploadDocument: vi.fn(async () => ({ path: 'stored/path.pdf' })),
  downloadDocument: vi.fn(async () => new Uint8Array([1, 2, 3])),
  getDocumentUrl: vi.fn(async (path: string) => `https://signed.test/${path}`),
  validateDocument: vi.fn(async () => ({ valid: true })),
  calculateHash: vi.fn(async () => 'sha256:deadbeef'),
  extractPageCount: vi.fn(async () => 3),
}));

vi.mock('../esign-pdf-transform.ts', async () => {
  // `validateManifest` is pure and is the thing under test on the PUT route,
  // so it runs for real. Only the PDF rendering is replaced.
  const real = await vi.importActual<typeof import('../esign-pdf-transform.ts')>(
    '../esign-pdf-transform.ts',
  );
  return { ...real, applyManifest: vi.fn(async () => new Uint8Array([9, 9, 9])) };
});

vi.mock('../email-service.ts', () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock('../sms-service.ts', () => ({ sendInviteSms: vi.fn(async () => true) }));

const supa = vi.hoisted(() => ({
  authUsers: new Map<string, Record<string, unknown>>(),
  /** When false, the rate-limit RPC throws — see the fail-closed test. */
  rateLimitRpcWorks: true,
}));
const authUsers = supa.authUsers;

/**
 * `auth.getUser` for the token check, and `rpc` for the rate limiter.
 *
 * The `rpc` half is not optional. `rateLimit('SENDER_MUTATE')` runs for real on
 * the PUT route, and `checkRateLimit` reaches Postgres through
 * `getSupabase().rpc('check_auth_rate_limit_91ed8379', …)` and FAILS CLOSED on
 * any error. A mock without `rpc` therefore turns every rate-limited route into
 * a 429 — which is what happened on the first run of this file, and is worth
 * recording because the 429 looks like a test problem and is actually the
 * production failure mode.
 */
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) => {
        const user = supa.authUsers.get(token);
        return user
          ? { data: { user }, error: null }
          : { data: { user: null }, error: { message: 'invalid token' } };
      },
    },
    rpc: async (fn: string) => {
      if (!supa.rateLimitRpcWorks) throw new Error(`rpc ${fn} unavailable`);
      return {
        data: { allowed: true, remaining: 119, resetAt: 4_000_000_000_000, blocked: false },
        error: null,
      };
    },
  }),
}));
vi.mock('../auth-mw.ts', async () => {
  const actual = await vi.importActual<typeof import('../auth-mw.ts')>('../auth-mw.ts');
  return { ...actual, enforceAccountSecurity: vi.fn(async () => undefined) };
});

import { kvStore } from './helpers/contract-harness.ts';
import { EsignKeys } from '../esign-keys.ts';

const app = (await import('../esign-documents-routes.ts')).default;
const { getAuditTrail } = await import('../esign-services.ts');

const OWNER = 'owner-user';
const OTHER = 'other-user';

function seedUser(token: string, id: string, firmId?: string) {
  authUsers.set(token, {
    id,
    email: `${id}@navigatewealth.co`,
    app_metadata: firmId ? { firm_id: firmId, role: 'admin' } : { role: 'admin' },
    user_metadata: {},
  });
}

function req(
  path: string,
  {
    as = 'owner',
    method = 'GET',
    body,
  }: { as?: string | null; method?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = {};
  if (as) headers.Authorization = `Bearer ${as}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return app.request(path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const json = async (res: Response) => (await res.json()) as Record<string, never>;

const ENV_ID = 'env-1';
const DOC_ID = 'doc-1';

/** An envelope with one document, in the given status. */
function seedEnvelope(status = 'draft', firmId = 'firm-owner') {
  kvStore.set(EsignKeys.envelope(ENV_ID), {
    id: ENV_ID,
    firm_id: firmId,
    client_id: 'client-1',
    title: 'Mandate',
    status,
    document_id: DOC_ID,
    created_by_user_id: OWNER,
  });
  kvStore.set(EsignKeys.PREFIX_DOCUMENT + DOC_ID, {
    id: DOC_ID,
    file_name: 'mandate.pdf',
    storage_path: 'esign/mandate.pdf',
    page_count: 3,
  });
}

/** A second document appended to the envelope's index. */
function seedSecondDocument(documentId = 'doc-2') {
  kvStore.set(EsignKeys.PREFIX_DOCUMENT + documentId, {
    id: documentId,
    file_name: 'annexure.pdf',
    storage_path: 'esign/annexure.pdf',
    page_count: 2,
  });
  kvStore.set(EsignKeys.envelopeDocuments(ENV_ID), [
    { document_id: DOC_ID, storage_path: 'esign/mandate.pdf', page_count: 3, order: 0 },
    { document_id: documentId, storage_path: 'esign/annexure.pdf', page_count: 2, order: 1 },
  ]);
}

/**
 * The real `PageManifest` shape, from `validateManifest`: a `version: 1`
 * discriminator, and pages carrying `sourcePage` (ONE-indexed, 1..pageCount)
 * and `rotation` constrained to 0/90/180/270. My first attempt used
 * `{ source: 0, rotate: 90 }` and every write came back 400 — the field names
 * and the base index were both wrong.
 */
const VALID_MANIFEST = {
  version: 1,
  pages: [
    { sourcePage: 1, rotation: 0 },
    { sourcePage: 3, rotation: 90 },
  ],
};

beforeEach(() => {
  kvStore.clear();
  authUsers.clear();
  supa.rateLimitRpcWorks = true;
  seedUser('owner', OWNER, 'firm-owner');
  seedUser('other', OTHER, 'firm-other');
});

// ============================================================================
// AUTHENTICATION
// ============================================================================

const ALL_ROUTES: Array<[string, string, unknown?]> = [
  ['GET', `/envelopes/${ENV_ID}/manifest`],
  ['PUT', `/envelopes/${ENV_ID}/manifest`, { manifest: VALID_MANIFEST }],
  ['DELETE', `/envelopes/${ENV_ID}/manifest`],
  ['GET', `/envelopes/${ENV_ID}/documents`],
  ['DELETE', `/envelopes/${ENV_ID}/documents/${DOC_ID}`],
  ['PUT', `/envelopes/${ENV_ID}/documents/order`, { order: [DOC_ID] }],
];

describe('authentication', () => {
  it.each(ALL_ROUTES)('%s %s rejects a request with no token', async (method, path, body) => {
    seedEnvelope();
    const res = await req(path, { method, as: null, body });
    expect(res.status).toBe(401);
  });

  it.each(ALL_ROUTES)('%s %s rejects an unrecognised token', async (method, path, body) => {
    seedEnvelope();
    const res = await req(path, { method, as: 'nobody', body });
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// MANIFEST
// ============================================================================

describe('GET /envelopes/:id/manifest', () => {
  it('returns null when no manifest has been saved', async () => {
    seedEnvelope();
    const res = await req(`/envelopes/${ENV_ID}/manifest`);
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ manifest: null });
  });

  it('returns the saved manifest', async () => {
    seedEnvelope();
    kvStore.set(EsignKeys.envelopeManifest(ENV_ID), VALID_MANIFEST);
    const res = await req(`/envelopes/${ENV_ID}/manifest`);
    expect(await json(res)).toEqual({ manifest: VALID_MANIFEST });
  });

  it('returns null rather than 404 for an envelope that does not exist', async () => {
    // Pinned as current behaviour: the read does not load the envelope at all,
    // so a bad id is indistinguishable from an envelope with no manifest.
    const res = await req('/envelopes/no-such-envelope/manifest');
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ manifest: null });
  });
});

describe('PUT /envelopes/:id/manifest', () => {
  it('saves a valid manifest and writes an audit event', async () => {
    seedEnvelope();
    const res = await req(`/envelopes/${ENV_ID}/manifest`, {
      method: 'PUT',
      body: { manifest: VALID_MANIFEST },
    });

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ success: true, manifest: VALID_MANIFEST });
    expect(kvStore.get(EsignKeys.envelopeManifest(ENV_ID))).toEqual(VALID_MANIFEST);

    const events = await getAuditTrail(ENV_ID);
    expect(events.map((e) => e.action)).toContain('page_manifest_updated');
  });

  it('refuses once the envelope has left draft', async () => {
    seedEnvelope('sent');
    const res = await req(`/envelopes/${ENV_ID}/manifest`, {
      method: 'PUT',
      body: { manifest: VALID_MANIFEST },
    });
    expect(res.status).toBe(409);
    expect(kvStore.has(EsignKeys.envelopeManifest(ENV_ID))).toBe(false);
  });

  it('404s for an unknown envelope', async () => {
    const res = await req('/envelopes/nope/manifest', {
      method: 'PUT',
      body: { manifest: VALID_MANIFEST },
    });
    expect(res.status).toBe(404);
  });

  it('409s when the source document has no pages to reorder', async () => {
    seedEnvelope();
    kvStore.set(EsignKeys.PREFIX_DOCUMENT + DOC_ID, {
      id: DOC_ID,
      storage_path: 'esign/mandate.pdf',
      page_count: 0,
    });
    const res = await req(`/envelopes/${ENV_ID}/manifest`, {
      method: 'PUT',
      body: { manifest: VALID_MANIFEST },
    });
    expect(res.status).toBe(409);
  });

  it('rejects a manifest referencing a page the source does not have', async () => {
    seedEnvelope();
    const res = await req(`/envelopes/${ENV_ID}/manifest`, {
      method: 'PUT',
      // The source has 3 pages (0..2); 7 is out of range.
      body: { manifest: { version: 1, pages: [{ sourcePage: 7, rotation: 0 }] } },
    });
    expect(res.status).toBe(400);
    expect(kvStore.has(EsignKeys.envelopeManifest(ENV_ID))).toBe(false);
  });

  it('rejects a malformed manifest', async () => {
    seedEnvelope();
    for (const manifest of [
      undefined,
      null,
      {},
      { version: 2, pages: [{ sourcePage: 1, rotation: 0 }] },
      { version: 1, pages: 'nope' },
      { version: 1, pages: [] },
      { version: 1, pages: [{ sourcePage: 0, rotation: 0 }] },
      { version: 1, pages: [{ sourcePage: 1, rotation: 45 }] },
    ]) {
      const res = await req(`/envelopes/${ENV_ID}/manifest`, { method: 'PUT', body: { manifest } });
      expect([res.status, JSON.stringify(manifest)]).toEqual([400, JSON.stringify(manifest)]);
    }
  });
});

describe('DELETE /envelopes/:id/manifest', () => {
  it('clears the manifest and writes an audit event', async () => {
    seedEnvelope();
    kvStore.set(EsignKeys.envelopeManifest(ENV_ID), VALID_MANIFEST);

    const res = await req(`/envelopes/${ENV_ID}/manifest`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(kvStore.has(EsignKeys.envelopeManifest(ENV_ID))).toBe(false);

    const events = await getAuditTrail(ENV_ID);
    expect(events.map((e) => e.action)).toContain('page_manifest_cleared');
  });

  it('succeeds even when the envelope does not exist, and still audits', async () => {
    // Pinned: the clear does not load the envelope, so it neither 404s nor
    // checks the draft status the PUT enforces. A sent envelope's manifest can
    // be cleared through this route.
    seedEnvelope('sent');
    kvStore.set(EsignKeys.envelopeManifest(ENV_ID), VALID_MANIFEST);
    const res = await req(`/envelopes/${ENV_ID}/manifest`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(kvStore.has(EsignKeys.envelopeManifest(ENV_ID))).toBe(false);
  });
});

describe('rate limiting on the manifest write', () => {
  it('fails CLOSED with a 429 when the rate-limit backend is unreachable', async () => {
    // `checkRateLimit` catches any error from the Postgres RPC and returns
    // `allowed: false, blocked: true`. That is the right security default, and
    // it is also an availability coupling worth being explicit about: a
    // Postgres hiccup turns every rate-limited e-sign mutation into a 429, on
    // top of the extra round trip the check costs on each one.
    seedEnvelope();
    supa.rateLimitRpcWorks = false;

    const res = await req(`/envelopes/${ENV_ID}/manifest`, {
      method: 'PUT',
      body: { manifest: VALID_MANIFEST },
    });

    expect(res.status).toBe(429);
    expect(kvStore.has(EsignKeys.envelopeManifest(ENV_ID))).toBe(false);
  });

  it('lets the write through when the backend allows it', async () => {
    seedEnvelope();
    const res = await req(`/envelopes/${ENV_ID}/manifest`, {
      method: 'PUT',
      body: { manifest: VALID_MANIFEST },
    });
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// DOCUMENTS
// ============================================================================

describe('GET /envelopes/:id/documents', () => {
  it('hydrates each document with a presigned URL', async () => {
    seedEnvelope();
    seedSecondDocument();

    const res = await req(`/envelopes/${ENV_ID}/documents`);
    expect(res.status).toBe(200);
    const { documents } = (await json(res)) as unknown as {
      documents: Array<{ document_id: string; url: string }>;
    };
    expect(documents.map((d) => d.document_id)).toEqual([DOC_ID, 'doc-2']);
    expect(documents.map((d) => d.url)).toEqual([
      'https://signed.test/esign/mandate.pdf',
      'https://signed.test/esign/annexure.pdf',
    ]);
  });

  it('404s for an unknown envelope', async () => {
    expect((await req('/envelopes/nope/documents')).status).toBe(404);
  });
});

describe('DELETE /envelopes/:id/documents/:documentId', () => {
  it('removes one document and returns what is left', async () => {
    seedEnvelope();
    seedSecondDocument();

    const res = await req(`/envelopes/${ENV_ID}/documents/doc-2`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    const { documents } = (await json(res)) as unknown as {
      documents: Array<{ document_id: string }>;
    };
    expect(documents.map((d) => d.document_id)).toEqual([DOC_ID]);

    const events = await getAuditTrail(ENV_ID);
    expect(events.map((e) => e.action)).toContain('document_removed');
  });

  it('refuses to remove the LAST document, with a 409 rather than a 500', async () => {
    // The handler maps a /last document/i error message to 409 explicitly —
    // an envelope with no documents is not a state the signing flow can use.
    seedEnvelope();
    seedSecondDocument();
    await req(`/envelopes/${ENV_ID}/documents/doc-2`, { method: 'DELETE' });

    const res = await req(`/envelopes/${ENV_ID}/documents/${DOC_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(409);
  });

  it('refuses once the envelope has left draft', async () => {
    seedEnvelope('sent');
    seedSecondDocument();
    const res = await req(`/envelopes/${ENV_ID}/documents/doc-2`, { method: 'DELETE' });
    expect(res.status).toBe(409);
  });

  it('404s for an unknown envelope', async () => {
    expect((await req(`/envelopes/nope/documents/${DOC_ID}`, { method: 'DELETE' })).status).toBe(
      404,
    );
  });
});

describe('PUT /envelopes/:id/documents/order', () => {
  it('reorders the documents and audits the new order', async () => {
    seedEnvelope();
    seedSecondDocument();

    const res = await req(`/envelopes/${ENV_ID}/documents/order`, {
      method: 'PUT',
      body: { order: ['doc-2', DOC_ID] },
    });

    expect(res.status).toBe(200);
    const { documents } = (await json(res)) as unknown as {
      documents: Array<{ document_id: string }>;
    };
    expect(documents.map((d) => d.document_id)).toEqual(['doc-2', DOC_ID]);

    const events = await getAuditTrail(ENV_ID);
    const reordered = events.find((e) => e.action === 'documents_reordered');
    expect(reordered).toBeTruthy();
  });

  it('appends ids the caller omitted rather than dropping them', async () => {
    // A stale client that only knows about one document must not be able to
    // delete the other by omission.
    seedEnvelope();
    seedSecondDocument();

    const res = await req(`/envelopes/${ENV_ID}/documents/order`, {
      method: 'PUT',
      body: { order: ['doc-2'] },
    });

    const { documents } = (await json(res)) as unknown as {
      documents: Array<{ document_id: string }>;
    };
    expect(documents.map((d) => d.document_id)).toEqual(['doc-2', DOC_ID]);
  });

  it('rejects an order that is not an array of strings', async () => {
    seedEnvelope();
    seedSecondDocument();
    for (const order of [undefined, 'doc-1', [1, 2], [DOC_ID, 3]]) {
      const res = await req(`/envelopes/${ENV_ID}/documents/order`, {
        method: 'PUT',
        body: { order },
      });
      expect([res.status, JSON.stringify(order)]).toEqual([400, JSON.stringify(order)]);
    }
  });

  it('refuses once the envelope has left draft, and 404s an unknown one', async () => {
    seedEnvelope('sent');
    seedSecondDocument();
    expect(
      (
        await req(`/envelopes/${ENV_ID}/documents/order`, {
          method: 'PUT',
          body: { order: [DOC_ID] },
        })
      ).status,
    ).toBe(409);
    expect(
      (await req('/envelopes/nope/documents/order', { method: 'PUT', body: { order: [DOC_ID] } }))
        .status,
    ).toBe(404);
  });
});

// ============================================================================
// THE SCOPE GAP — pinned, flagged, not endorsed
// ============================================================================

describe('firm scope (ABSENT — pinned so the fix announces itself)', () => {
  /**
   * Every assertion in this block documents a hole. When firm scoping is added
   * to this module these tests SHOULD fail, and the failure is the signal to
   * rewrite them as denial assertions rather than to relax the fix.
   *
   * The caller here is authenticated and belongs to `firm-other`; the envelope
   * belongs to `firm-owner`. Nothing in this module compares the two.
   */
  it('lets any authenticated user read another firm’s manifest', async () => {
    seedEnvelope();
    kvStore.set(EsignKeys.envelopeManifest(ENV_ID), VALID_MANIFEST);

    const res = await req(`/envelopes/${ENV_ID}/manifest`, { as: 'other' });
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ manifest: VALID_MANIFEST });
  });

  it('lets any authenticated user overwrite another firm’s manifest', async () => {
    seedEnvelope();
    const res = await req(`/envelopes/${ENV_ID}/manifest`, {
      as: 'other',
      method: 'PUT',
      body: { manifest: { version: 1, pages: [{ sourcePage: 2, rotation: 180 }] } },
    });
    expect(res.status).toBe(200);
    expect(kvStore.get(EsignKeys.envelopeManifest(ENV_ID))).toEqual({
      version: 1,
      pages: [{ sourcePage: 2, rotation: 180 }],
    });
  });

  it('lets any authenticated user clear another firm’s manifest', async () => {
    seedEnvelope();
    kvStore.set(EsignKeys.envelopeManifest(ENV_ID), VALID_MANIFEST);
    const res = await req(`/envelopes/${ENV_ID}/manifest`, { as: 'other', method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(kvStore.has(EsignKeys.envelopeManifest(ENV_ID))).toBe(false);
  });

  it('lets any authenticated user delete a document from another firm’s envelope', async () => {
    seedEnvelope();
    seedSecondDocument();
    const res = await req(`/envelopes/${ENV_ID}/documents/doc-2`, {
      as: 'other',
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
  });

  it('lets any authenticated user reorder another firm’s documents', async () => {
    seedEnvelope();
    seedSecondDocument();
    const res = await req(`/envelopes/${ENV_ID}/documents/order`, {
      as: 'other',
      method: 'PUT',
      body: { order: ['doc-2', DOC_ID] },
    });
    expect(res.status).toBe(200);
  });

  it('records the OTHER firm’s user as the actor, which is the one thing that works', async () => {
    // The audit trail does capture who did it. That is the only reason any of
    // the above would be traceable after the fact.
    seedEnvelope();
    await req(`/envelopes/${ENV_ID}/manifest`, {
      as: 'other',
      method: 'PUT',
      body: { manifest: VALID_MANIFEST },
    });

    const events = await getAuditTrail(ENV_ID);
    const updated = events.find((e) => e.action === 'page_manifest_updated');
    expect(updated).toMatchObject({ actor_id: OTHER });
  });
});
