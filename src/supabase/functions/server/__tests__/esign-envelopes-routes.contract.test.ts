/**
 * esign-envelopes-routes.ts — Route Contract Tests
 * ================================================
 *
 * Envelope CRUD plus the public hash-verification endpoint. 164 statements,
 * 25% covered.
 *
 * `esign-services.ts` runs for real; only storage, the Postgres mirror and the
 * Supabase client are stubbed. The Supabase mock needs an `rpc` stub: the real
 * rate limiter reaches Postgres through it and FAILS CLOSED, so a mock without
 * one turns every rate-limited route into a 429.
 *
 * WHAT THE FIRM-SCOPE TESTS ARE FOR
 * ---------------------------------
 * Scoping in this module is applied route by route, and the tests below record
 * where it lands and where it does not — `GET /envelopes` filters, `GET
 * /envelopes/:id` 404s on mismatch, `PUT /draft-signers` does neither.
 *
 * They also pin the consequence that matters most, because it is live in
 * production rather than hypothetical: `belongsToFirm` requires an exact
 * non-empty match, so an envelope stored WITHOUT a `firm_id` is invisible to
 * every caller, including the person who created it. The comment above that
 * filter claims the opposite — that such records are "accessible to everyone,
 * which keeps the single-firm install working". The test named for it is the
 * evidence, and it is pinned as current behaviour, not endorsed.
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
vi.mock('../esign-storage.ts', () => ({
  uploadDocument: vi.fn(async () => ({ path: 'stored/path.pdf' })),
  downloadDocument: vi.fn(async () => new Uint8Array([1, 2, 3])),
  getDocumentUrl: vi.fn(async (path: string) => `https://signed.test/${path}`),
  validateDocument: vi.fn(async () => ({ valid: true })),
  calculateHash: vi.fn(async () => 'sha256:uploaded'),
  extractPageCount: vi.fn(async () => 2),
  initializeStorageBuckets: vi.fn(async () => undefined),
}));
vi.mock('../admin-audit-service.ts', () => ({
  AdminAuditService: { record: vi.fn(async () => undefined) },
}));

const supa = vi.hoisted(() => ({
  users: new Map<string, Record<string, unknown>>(),
  rateLimitRpcWorks: true,
}));
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) => {
        const user = supa.users.get(token);
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

const app = (await import('../esign-envelopes-routes.ts')).default;

const FIRM_A = 'firm-a';
const FIRM_B = 'firm-b';

function seedUser(
  token: string,
  { id, firmId, role = 'admin' }: { id: string; firmId?: string; role?: string },
) {
  supa.users.set(token, {
    id,
    email: `${id}@navigatewealth.co`,
    app_metadata: { role, ...(firmId ? { firm_id: firmId } : {}) },
    user_metadata: {},
  });
}

function req(
  path: string,
  {
    as = 'adminA',
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

/** An envelope, with a document and optionally a signer. */
function seedEnvelope(
  id: string,
  {
    firmId,
    status = 'draft',
    signedHash,
    docHash,
    deletedAt,
  }: {
    firmId?: string;
    status?: string;
    signedHash?: string;
    docHash?: string;
    deletedAt?: string;
  } = {},
) {
  const docId = `${id}-doc`;
  kvStore.set(EsignKeys.envelope(id), {
    id,
    ...(firmId ? { firm_id: firmId } : {}),
    title: `Envelope ${id}`,
    status,
    document_id: docId,
    created_at: '2026-03-01T09:00:00.000Z',
    ...(signedHash ? { signed_document_hash: signedHash } : {}),
    ...(deletedAt ? { deleted_at: deletedAt } : {}),
  });
  kvStore.set(EsignKeys.PREFIX_DOCUMENT + docId, {
    id: docId,
    file_name: `${id}.pdf`,
    storage_path: `esign/${id}.pdf`,
    page_count: 2,
    ...(docHash ? { hash: docHash } : {}),
  });
}

/** Attach a signer record to an envelope. */
function seedSigner(envelopeId: string, signerId: string, name: string) {
  kvStore.set(EsignKeys.PREFIX_SIGNER + signerId, {
    id: signerId,
    envelope_id: envelopeId,
    name,
    email: `${signerId}@example.com`,
    role: 'signer',
    status: 'signed',
    signed_at: '2026-03-02T10:00:00.000Z',
  });
  kvStore.set(EsignKeys.envelopeSigners(envelopeId), [signerId]);
}

beforeEach(() => {
  kvStore.clear();
  supa.users.clear();
  supa.rateLimitRpcWorks = true;
  seedUser('adminA', { id: 'admin-a', firmId: FIRM_A });
  seedUser('adminB', { id: 'admin-b', firmId: FIRM_B });
  seedUser('noFirm', { id: 'no-firm-user' });
  seedUser('super', { id: 'super-1', firmId: FIRM_A, role: 'super_admin' });
  // A client in the SAME firm as adminA: the role gate, not the firm
  // filter, has to be what stops them reaching the aggregate list.
  seedUser('client', { id: 'client-1', firmId: FIRM_A, role: 'client' });
});

// ============================================================================
// PUBLIC HASH VERIFICATION
// ============================================================================

describe('POST /verify-hash', () => {
  it('needs no token — it is a public authenticity check', async () => {
    seedEnvelope('e1', { firmId: FIRM_A, status: 'completed', signedHash: 'sha256:sealed' });
    const res = await req('/verify-hash', {
      as: null,
      method: 'POST',
      body: { hash: 'sha256:sealed' },
    });
    expect(res.status).toBe(200);
    expect(((await json(res)) as unknown as { verified: boolean }).verified).toBe(true);
  });

  it('rejects a missing or non-string hash', async () => {
    for (const hash of [undefined, null, 42, {}]) {
      const res = await req('/verify-hash', { as: null, method: 'POST', body: { hash } });
      expect([res.status, JSON.stringify(hash)]).toEqual([400, JSON.stringify(hash)]);
    }
  });

  it('matches the SEALED hash and reports matchType "signed"', async () => {
    seedEnvelope('e1', { firmId: FIRM_A, status: 'completed', signedHash: 'sha256:sealed' });
    seedSigner('e1', 'sgn-1', 'Thandi Mokoena');

    const res = await req('/verify-hash', {
      as: null,
      method: 'POST',
      body: { hash: 'sha256:sealed' },
    });
    const body = (await json(res)) as unknown as {
      verified: boolean;
      matchType: string;
      envelope: { id: string; title: string };
      signers: Array<{ name: string; email?: string }>;
      message: string;
    };

    expect(body.verified).toBe(true);
    expect(body.matchType).toBe('signed');
    expect(body.envelope).toMatchObject({ id: 'e1', title: 'Envelope e1' });
    expect(body.message).toContain('authentic signed and sealed');

    // Names and roles are disclosed; email addresses deliberately are not.
    // The caller already holds the document, so the signatories on it are not
    // a new disclosure — their contact details would be.
    expect(body.signers).toEqual([
      {
        name: 'Thandi Mokoena',
        role: 'signer',
        status: 'signed',
        signedAt: '2026-03-02T10:00:00.000Z',
      },
    ]);
    expect(JSON.stringify(body)).not.toContain('@example.com');
  });

  it('falls back to the ORIGINAL document hash and says the signed copy may differ', async () => {
    seedEnvelope('e1', { firmId: FIRM_A, status: 'completed', docHash: 'sha256:original' });

    const res = await req('/verify-hash', {
      as: null,
      method: 'POST',
      body: { hash: 'sha256:original' },
    });
    const body = (await json(res)) as unknown as { matchType: string; message: string };
    expect(body.matchType).toBe('original');
    expect(body.message).toContain('may have additional content');
  });

  it('reports an incomplete envelope as found-but-not-complete', async () => {
    seedEnvelope('e1', { firmId: FIRM_A, status: 'sent', signedHash: 'sha256:sealed' });
    const res = await req('/verify-hash', {
      as: null,
      method: 'POST',
      body: { hash: 'sha256:sealed' },
    });
    const body = (await json(res)) as unknown as { verified: boolean; message: string };
    expect(body.verified).toBe(true);
    expect(body.message).toContain('"sent"');
  });

  it('does not verify against a soft-deleted envelope', async () => {
    seedEnvelope('e1', {
      firmId: FIRM_A,
      status: 'completed',
      signedHash: 'sha256:sealed',
      deletedAt: '2026-03-05T00:00:00.000Z',
    });
    const res = await req('/verify-hash', {
      as: null,
      method: 'POST',
      body: { hash: 'sha256:sealed' },
    });
    expect(((await json(res)) as unknown as { verified: boolean }).verified).toBe(false);
  });

  it('reports an unknown hash as unverified without leaking whether anything exists', async () => {
    seedEnvelope('e1', { firmId: FIRM_A, status: 'completed', signedHash: 'sha256:sealed' });
    const res = await req('/verify-hash', {
      as: null,
      method: 'POST',
      body: { hash: 'sha256:other' },
    });
    const body = (await json(res)) as unknown as { verified: boolean; message: string };
    expect(body.verified).toBe(false);
    expect(body.message).toContain('No matching document found');
    expect(JSON.stringify(body)).not.toContain('e1');
  });

  it('ignores non-envelope values sharing the envelope key prefix', async () => {
    // `getByPrefix('esign:envelope:')` also returns the `:signers`, `:fields`
    // and `:audit` arrays that live under the same prefix. The filter requires
    // an object carrying `id` and `status`, which is what keeps those out.
    seedEnvelope('e1', { firmId: FIRM_A, status: 'completed', signedHash: 'sha256:sealed' });
    kvStore.set(EsignKeys.envelopeFields('e1'), ['field-1', 'field-2']);
    kvStore.set(EsignKeys.envelopeAudit('e1'), ['audit-1']);

    const res = await req('/verify-hash', {
      as: null,
      method: 'POST',
      body: { hash: 'sha256:sealed' },
    });
    expect(res.status).toBe(200);
    expect(((await json(res)) as unknown as { verified: boolean }).verified).toBe(true);
  });
});

// ============================================================================
// LIST
// ============================================================================

describe('GET /envelopes', () => {
  it('requires a token', async () => {
    expect((await req('/envelopes', { as: null })).status).toBe(401);
  });

  it('returns only the caller’s own firm’s envelopes', async () => {
    seedEnvelope('mine', { firmId: FIRM_A });
    seedEnvelope('theirs', { firmId: FIRM_B });

    const res = await req('/envelopes', { as: 'adminA' });
    const { envelopes } = (await json(res)) as unknown as { envelopes: Array<{ id: string }> };
    expect(envelopes.map((e) => e.id)).toEqual(['mine']);
  });

  it('is refused for a client, even one inside the caller firm', async () => {
    // THE HOLE THIS CLOSES. The docstring said "admin only" and nothing checked
    // it — `getAuthContext` authenticates but does not authorise. On the
    // production deployment 188 of 193 accounts are clients.
    //
    // The firm filter alone is not the control: this client is seeded into
    // FIRM_A, so a repaired filter would have handed them the whole firm's
    // envelope list. Authorization has to be its own gate.
    seedEnvelope('mine', { firmId: FIRM_A });

    const res = await req('/envelopes', { as: 'client' });
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain('mine');
  });

  it('still admits an admin and a super-admin', async () => {
    seedEnvelope('mine', { firmId: FIRM_A });
    for (const as of ['adminA', 'super']) {
      const res = await req('/envelopes', { as });
      expect([as, res.status]).toEqual([as, 200]);
    }
  });

  it('denies an envelope carrying no firm_id, to every caller', async () => {
    // `belongsToFirm` requires an exact non-empty match, so a record with no
    // `firm_id` belongs to nobody. That is the correct default for a security
    // boundary — deny, then backfill the record — and it is the opposite of
    // what the comment above this filter used to claim.
    seedEnvelope('orphan');

    for (const as of ['adminA', 'adminB', 'super']) {
      const res = await req('/envelopes', { as });
      const { envelopes } = (await json(res)) as unknown as { envelopes: Array<{ id: string }> };
      expect([as, envelopes.map((e) => e.id)]).toEqual([as, []]);
    }
  });

  it('falls back to the USER ID as the firm when app_metadata carries none', async () => {
    // The other half of the same problem: with no firm_id on the user, each
    // caller is silently their own firm, so scoping becomes per-user.
    seedEnvelope('theirs', { firmId: 'no-firm-user' });

    const mine = await req('/envelopes', { as: 'noFirm' });
    expect(
      ((await json(mine)) as unknown as { envelopes: Array<{ id: string }> }).envelopes.map(
        (e) => e.id,
      ),
    ).toEqual(['theirs']);

    const others = await req('/envelopes', { as: 'adminA' });
    expect(((await json(others)) as unknown as { envelopes: unknown[] }).envelopes).toEqual([]);
  });

  it('filters by status when asked', async () => {
    seedEnvelope('draft-one', { firmId: FIRM_A, status: 'draft' });
    seedEnvelope('sent-one', { firmId: FIRM_A, status: 'sent' });

    const res = await req('/envelopes?status=sent', { as: 'adminA' });
    const { envelopes } = (await json(res)) as unknown as { envelopes: Array<{ id: string }> };
    expect(envelopes.map((e) => e.id)).toEqual(['sent-one']);
  });
});

// ============================================================================
// DETAIL
// ============================================================================

describe('GET /envelopes/:envelopeId', () => {
  it('returns the envelope with a presigned document URL', async () => {
    seedEnvelope('e1', { firmId: FIRM_A });
    const res = await req('/envelopes/e1', { as: 'adminA' });
    expect(res.status).toBe(200);
    const body = (await json(res)) as unknown as { id: string; document: { url: string } };
    expect(body.id).toBe('e1');
    expect(body.document.url).toBe('https://signed.test/esign/e1.pdf');
  });

  it('404s — not 403 — for another firm’s envelope, so it cannot be probed', async () => {
    seedEnvelope('e1', { firmId: FIRM_A });
    const res = await req('/envelopes/e1', { as: 'adminB' });
    expect(res.status).toBe(404);
    // The body must be indistinguishable from a genuine miss.
    expect(await json(res)).toEqual({ error: 'Envelope not found' });
    const missing = await req('/envelopes/does-not-exist', { as: 'adminB' });
    expect(await json(missing)).toEqual({ error: 'Envelope not found' });
  });

  it('404s a soft-deleted envelope', async () => {
    seedEnvelope('e1', { firmId: FIRM_A, deletedAt: '2026-03-05T00:00:00.000Z' });
    expect((await req('/envelopes/e1', { as: 'adminA' })).status).toBe(404);
  });

  it('requires a token', async () => {
    seedEnvelope('e1', { firmId: FIRM_A });
    expect((await req('/envelopes/e1', { as: null })).status).toBe(401);
  });
});

// ============================================================================
// DRAFT SIGNERS
// ============================================================================

describe('PUT /envelopes/:envelopeId/draft-signers', () => {
  const SIGNERS = [
    { name: 'Thandi Mokoena', email: 'thandi@example.com', role: 'signer' as const },
    { name: 'Pieter van Wyk', email: 'pieter@example.com', role: 'witness' as const },
  ];

  it('persists the draft signer configuration on the envelope', async () => {
    seedEnvelope('e1', { firmId: FIRM_A });
    const res = await req('/envelopes/e1/draft-signers', {
      as: 'adminA',
      method: 'PUT',
      body: { signers: SIGNERS },
    });

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ success: true, count: 2 });

    const stored = kvStore.get(EsignKeys.envelope('e1')) as { draft_signers: unknown[] };
    expect(stored.draft_signers).toHaveLength(2);
  });

  it('rejects an empty or malformed signer list', async () => {
    seedEnvelope('e1', { firmId: FIRM_A });
    for (const signers of [[], undefined, [{ name: 'No Email' }], [{ email: 'not-an-email' }]]) {
      const res = await req('/envelopes/e1/draft-signers', {
        as: 'adminA',
        method: 'PUT',
        body: { signers },
      });
      expect([res.status, JSON.stringify(signers)]).toEqual([400, JSON.stringify(signers)]);
    }
  });

  it('refuses once the envelope has left draft', async () => {
    seedEnvelope('e1', { firmId: FIRM_A, status: 'sent' });
    const res = await req('/envelopes/e1/draft-signers', {
      as: 'adminA',
      method: 'PUT',
      body: { signers: SIGNERS },
    });
    expect(res.status).toBe(400);
  });

  it('404s for an unknown envelope, and 401s with no token', async () => {
    expect(
      (
        await req('/envelopes/nope/draft-signers', {
          as: 'adminA',
          method: 'PUT',
          body: { signers: SIGNERS },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await req('/envelopes/nope/draft-signers', {
          as: null,
          method: 'PUT',
          body: { signers: SIGNERS },
        })
      ).status,
    ).toBe(401);
  });

  it('403s another firm’s draft envelope, and writes nothing', async () => {
    // This route used to call `getAuthContext(c)` WITHOUT capturing the result
    // — authenticate, then throw the answer away — so any authenticated caller
    // could replace the signer list on any draft envelope by supplying its id.
    // It is a write, which makes it worse than the read leaks fixed alongside.
    seedEnvelope('e1', { firmId: FIRM_A });

    const res = await req('/envelopes/e1/draft-signers', {
      as: 'adminB',
      method: 'PUT',
      body: { signers: SIGNERS },
    });

    expect(res.status).toBe(403);
    const stored = kvStore.get(EsignKeys.envelope('e1')) as { draft_signers?: unknown[] };
    expect(stored.draft_signers).toBeUndefined();
  });

  it('still lets the owning firm save draft signers', async () => {
    seedEnvelope('e1', { firmId: FIRM_A });

    const res = await req('/envelopes/e1/draft-signers', {
      as: 'adminA',
      method: 'PUT',
      body: { signers: SIGNERS },
    });

    expect(res.status).toBe(200);
    const stored = kvStore.get(EsignKeys.envelope('e1')) as { draft_signers: unknown[] };
    expect(stored.draft_signers).toHaveLength(2);
  });

  it('404s an unknown envelope rather than leaking that it is another firm’s', async () => {
    const res = await req('/envelopes/no-such-envelope/draft-signers', {
      as: 'adminA',
      method: 'PUT',
      body: { signers: SIGNERS },
    });
    expect(res.status).toBe(404);
  });
});

// ============================================================================
// SYSTEM WIPE
// ============================================================================

describe('DELETE /envelopes', () => {
  it('is refused for a non-super-admin', async () => {
    seedEnvelope('e1', { firmId: FIRM_A });
    const res = await req('/envelopes?confirm=true', { as: 'adminA', method: 'DELETE' });
    expect(res.status).toBe(403);
    expect(kvStore.has(EsignKeys.envelope('e1'))).toBe(true);
  });

  it('requires the confirm flag even from a super admin', async () => {
    seedEnvelope('e1', { firmId: FIRM_A });
    const res = await req('/envelopes', { as: 'super', method: 'DELETE' });
    expect(res.status).toBe(400);
    expect(kvStore.has(EsignKeys.envelope('e1'))).toBe(true);
  });

  it('wipes every e-sign record when confirmed by a super admin', async () => {
    seedEnvelope('e1', { firmId: FIRM_A });
    seedEnvelope('e2', { firmId: FIRM_B });

    const res = await req('/envelopes?confirm=true', { as: 'super', method: 'DELETE' });
    expect(res.status).toBe(200);

    // Not firm-scoped, and deliberately so — it is a system reset.
    expect(kvStore.has(EsignKeys.envelope('e1'))).toBe(false);
    expect(kvStore.has(EsignKeys.envelope('e2'))).toBe(false);
  });

  it('requires a token', async () => {
    expect((await req('/envelopes?confirm=true', { as: null, method: 'DELETE' })).status).toBe(401);
  });
});
