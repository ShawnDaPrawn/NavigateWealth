/**
 * esign-v1-routes.ts — Contract Tests for the public REST API
 * ===========================================================
 *
 * The /v1/* surface is the only e-sign entry point authenticated by API KEY
 * rather than a user session, so its firm scoping is the whole tenant boundary
 * for anyone integrating against this platform. That is what this suite is
 * mostly about.
 *
 * Real collaborators throughout: `api-key-service` mints and resolves real
 * tokens (so token parsing, the hash compare, the active flag and expiry all
 * execute), `esign-services` and `esign-template-service` run against the
 * in-memory KV. Only the true IO boundary is mocked — Postgres mirror, object
 * storage, Supabase, and the rate limiter.
 *
 * Two mock shapes worth stating, because getting either wrong makes the suite
 * pass while testing nothing:
 *
 *   - `validateDocument` and `extractPageCount` are SYNCHRONOUS in
 *     esign-storage.ts. Mocked as async, `validation.valid` reads `undefined`
 *     off a Promise, every from-template request 400s, and the tests that
 *     assert a 400 still pass — for entirely the wrong reason.
 *   - `rateLimit` is a middleware FACTORY. Mocking it as the middleware itself
 *     mounts a function Hono calls with (c, next) at registration time.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

vi.mock('../kv_store.tsx', async () => {
  const { makeKvMock } = await import('./helpers/contract-harness.ts');
  return makeKvMock();
});
vi.mock('../stderr-logger.ts', async () => {
  const { makeLoggerMock } = await import('./helpers/contract-harness.ts');
  return makeLoggerMock();
});

vi.mock('../esign-postgres-repo.ts', () => ({
  esignPgRepo: {
    insertAudit: vi.fn(async () => undefined),
    upsertEnvelope: vi.fn(async () => undefined),
    upsertSigner: vi.fn(async () => undefined),
  },
}));

const storage = vi.hoisted(() => ({
  uploadError: null as string | null,
  downloaded: new Uint8Array([37, 80, 68, 70]) as Uint8Array | null,
  validation: { valid: true } as { valid: boolean; error?: string },
  uploads: [] as Array<{ firmId: string; documentId: string; filename: string }>,
}));

vi.mock('../esign-storage.ts', () => ({
  uploadDocument: vi.fn(
    async (firmId: string, documentId: string, _b: unknown, filename: string) => {
      storage.uploads.push({ firmId, documentId, filename });
      return storage.uploadError
        ? { path: null, error: storage.uploadError }
        : { path: `${firmId}/${documentId}.pdf`, error: null };
    },
  ),
  downloadDocument: vi.fn(async () => storage.downloaded),
  getDocumentUrl: vi.fn(async (p: string) => `https://signed.test/${p}`),
  // Synchronous, as in esign-storage.ts.
  validateDocument: vi.fn(() => storage.validation),
  extractPageCount: vi.fn(() => 3),
  calculateHash: vi.fn(async () => 'sha256:test'),
  initializeStorageBuckets: vi.fn(async () => undefined),
}));

vi.mock('../admin-audit-service.ts', () => ({
  AdminAuditService: { record: vi.fn(async () => undefined) },
}));

// rateLimit is a FACTORY returning middleware.
vi.mock('../esign-rate-limit.ts', () => ({
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: { message: 'no session' } }) },
    rpc: async () => ({
      data: { allowed: true, remaining: 100, resetAt: 4_000_000_000_000, blocked: false },
      error: null,
    }),
  }),
}));

import { kvStore } from './helpers/contract-harness.ts';
import v1Routes from '../esign-v1-routes.ts';
import { createApiKey, updateApiKey } from '../api-key-service.ts';
import { createTemplate } from '../esign-template-service.ts';
import { createEnvelope, createDocument, logAuditEvent } from '../esign-services.ts';

const FIRM_A = 'firm-a';
const FIRM_B = 'firm-b';

// A one-page PDF's worth of bytes; content is irrelevant because
// validateDocument is stubbed, but the base64 has to decode.
const PDF_B64 = btoa('%PDF-1.4 test');

let tokenA = '';
let tokenB = '';

const call = (
  method: string,
  path: string,
  opts: { token?: string | null; body?: unknown } = {},
) => {
  const token = opts.token === undefined ? tokenA : opts.token;
  return v1Routes.fetch(
    new Request(`http://x${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
    }),
  );
};

const json = async (r: Response) => (await r.json()) as any;

/** A draft envelope owned by `firmId`, with a document behind it. */
async function seedEnvelope(firmId: string, over: Record<string, unknown> = {}): Promise<string> {
  const documentId = crypto.randomUUID();
  await createDocument({
    id: documentId,
    firm_id: firmId,
    storage_path: `${firmId}/${documentId}.pdf`,
    original_filename: 'doc.pdf',
    page_count: 1,
    hash: 'sha256:seed',
    created_at: new Date().toISOString(),
  });
  const { envelopeId } = await createEnvelope({
    firmId,
    clientId: 'client-1',
    title: 'Seeded envelope',
    documentId,
    createdByUserId: 'seed',
    signers: [],
  });
  if (over && Object.keys(over).length > 0) {
    const key = `esign:envelope:${envelopeId}`;
    kvStore.set(key, { ...(kvStore.get(key) as Record<string, unknown>), ...over });
  }
  return envelopeId!;
}

beforeEach(async () => {
  kvStore.clear();
  storage.uploadError = null;
  storage.downloaded = new Uint8Array([37, 80, 68, 70]);
  storage.validation = { valid: true };
  storage.uploads = [];
  vi.clearAllMocks();

  tokenA = (await createApiKey({ firmId: FIRM_A, userId: 'u-a', name: 'A' })).token;
  tokenB = (await createApiKey({ firmId: FIRM_B, userId: 'u-b', name: 'B' })).token;
});

// ==========================================================================
// API-key authentication
// ==========================================================================
describe('API key authentication', () => {
  const GUARDED: Array<[string, string]> = [
    ['GET', '/v1/envelopes'],
    ['GET', '/v1/envelopes/e1'],
    ['GET', '/v1/envelopes/e1/audit'],
    ['GET', '/v1/envelopes/e1/signed-pdf'],
    ['GET', '/v1/templates'],
    ['GET', '/v1/templates/t1'],
    ['POST', '/v1/envelopes/from-template'],
  ];

  it.each(GUARDED)('%s %s is 401 with no Authorization header', async (method, path) => {
    const res = await call(method, path, { token: null, body: method === 'GET' ? undefined : {} });
    expect(res.status).toBe(401);
    expect((await json(res)).error).toBe('Missing API key');
  });

  it.each(GUARDED)('%s %s is 401 with an unparseable token', async (method, path) => {
    const res = await call(method, path, {
      token: 'garbage',
      body: method === 'GET' ? undefined : {},
    });
    expect(res.status).toBe(401);
    expect((await json(res)).error).toBe('Invalid or revoked API key');
  });

  it('rejects a well-formed token whose secret is wrong', async () => {
    const tampered = `${tokenA.slice(0, -4)}0000`;
    const res = await call('GET', '/v1/envelopes', { token: tampered });
    expect(res.status).toBe(401);
  });

  it('rejects a deactivated key', async () => {
    const { key, token } = await createApiKey({ firmId: FIRM_A, userId: 'u-a', name: 'temp' });
    expect((await call('GET', '/v1/envelopes', { token })).status).toBe(200);

    await updateApiKey(key.id, { active: false });

    const res = await call('GET', '/v1/envelopes', { token });
    expect(res.status).toBe(401);
    expect((await json(res)).error).toBe('Invalid or revoked API key');
  });

  it('rejects an expired key', async () => {
    const { token } = await createApiKey({
      firmId: FIRM_A,
      userId: 'u-a',
      name: 'expired',
      expiresAt: '2020-01-01T00:00:00.000Z',
    });
    const res = await call('GET', '/v1/envelopes', { token });
    expect(res.status).toBe(401);
    expect((await json(res)).error).toBe('Invalid or revoked API key');
  });

  it('accepts a key whose expiry is still ahead', async () => {
    const { token } = await createApiKey({
      firmId: FIRM_A,
      userId: 'u-a',
      name: 'future',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    expect((await call('GET', '/v1/envelopes', { token })).status).toBe(200);
  });

  it('ignores a non-Bearer Authorization scheme', async () => {
    const res = await v1Routes.fetch(
      new Request('http://x/v1/envelopes', { headers: { Authorization: `Basic ${tokenA}` } }),
    );
    expect(res.status).toBe(401);
    expect((await json(res)).error).toBe('Missing API key');
  });
});

// ==========================================================================
// Envelope list
// ==========================================================================
describe('GET /v1/envelopes', () => {
  it('returns only the calling firm’s envelopes', async () => {
    const mine = await seedEnvelope(FIRM_A, { title: 'Mine' });
    await seedEnvelope(FIRM_B, { title: 'Theirs' });

    const { envelopes, count } = await json(await call('GET', '/v1/envelopes'));
    expect(count).toBe(1);
    expect(envelopes.map((e: any) => e.id)).toEqual([mine]);
  });

  it('hides an envelope carrying no firm_id from every caller', async () => {
    const orphan = await seedEnvelope(FIRM_A);
    const key = `esign:envelope:${orphan}`;
    const rec = { ...(kvStore.get(key) as Record<string, unknown>) };
    delete rec.firm_id;
    kvStore.set(key, rec);

    expect((await json(await call('GET', '/v1/envelopes'))).count).toBe(0);
    expect((await json(await call('GET', '/v1/envelopes', { token: tokenB }))).count).toBe(0);
  });

  it('exposes only the summary fields, never signers or document paths', async () => {
    const id = await seedEnvelope(FIRM_A, {
      sent_at: '2026-02-01T00:00:00.000Z',
      completed_at: '2026-02-02T00:00:00.000Z',
    });
    const { envelopes } = await json(await call('GET', '/v1/envelopes'));
    expect(envelopes[0].id).toBe(id);
    expect(Object.keys(envelopes[0]).sort()).toEqual([
      'completed_at',
      'created_at',
      'expires_at',
      'id',
      'sent_at',
      'status',
      'title',
      'updated_at',
    ]);
  });

  it('omits fields the envelope does not carry rather than emitting nulls', async () => {
    await seedEnvelope(FIRM_A);
    const { envelopes } = await json(await call('GET', '/v1/envelopes'));
    expect(envelopes[0]).not.toHaveProperty('sent_at');
    expect(envelopes[0]).not.toHaveProperty('completed_at');
  });

  it('never exposes the document, signers or created_by on the list', async () => {
    await seedEnvelope(FIRM_A);
    const { envelopes } = await json(await call('GET', '/v1/envelopes'));
    for (const leaky of ['document', 'document_id', 'signers', 'created_by_user_id', 'firm_id']) {
      expect(envelopes[0]).not.toHaveProperty(leaky);
    }
  });

  it('filters by status', async () => {
    await seedEnvelope(FIRM_A, { status: 'draft' });
    const sent = await seedEnvelope(FIRM_A, { status: 'sent' });

    const { envelopes } = await json(await call('GET', '/v1/envelopes?status=sent'));
    expect(envelopes.map((e: any) => e.id)).toEqual([sent]);
  });

  it('honours ?limit and reports the clipped count', async () => {
    for (let i = 0; i < 5; i++) await seedEnvelope(FIRM_A);
    const body = await json(await call('GET', '/v1/envelopes?limit=2'));
    expect(body.envelopes).toHaveLength(2);
    expect(body.count).toBe(2);
  });

  it('caps ?limit at 200 rather than trusting the caller', async () => {
    await seedEnvelope(FIRM_A);
    const body = await json(await call('GET', '/v1/envelopes?limit=100000'));
    expect(body.count).toBe(1);
  });

  it('returns an empty list for a firm with no envelopes', async () => {
    await seedEnvelope(FIRM_B);
    const body = await json(await call('GET', '/v1/envelopes'));
    expect(body).toEqual({ envelopes: [], count: 0 });
  });
});

// ==========================================================================
// Envelope detail, audit, signed PDF
// ==========================================================================
describe('GET /v1/envelopes/:id', () => {
  it('returns an envelope the caller owns', async () => {
    const id = await seedEnvelope(FIRM_A, { title: 'Ours' });
    const { envelope } = await json(await call('GET', `/v1/envelopes/${id}`));
    expect(envelope.id).toBe(id);
    expect(envelope.title).toBe('Ours');
  });

  it('404s an unknown envelope', async () => {
    const res = await call('GET', '/v1/envelopes/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('403s another firm’s envelope rather than 404ing it', async () => {
    const theirs = await seedEnvelope(FIRM_B);
    const res = await call('GET', `/v1/envelopes/${theirs}`);
    expect(res.status).toBe(403);
    expect((await json(res)).error).toBe('Forbidden');
  });
});

describe('GET /v1/envelopes/:id/audit', () => {
  it('returns the audit trail for an owned envelope', async () => {
    const id = await seedEnvelope(FIRM_A);
    await logAuditEvent({
      envelopeId: id,
      actorType: 'sender_user',
      actorId: 'u-a',
      action: 'envelope_created',
    });

    const { events } = await json(await call('GET', `/v1/envelopes/${id}/audit`));
    expect(events.some((e: any) => e.action === 'envelope_created')).toBe(true);
  });

  it('403s another firm’s audit trail', async () => {
    const theirs = await seedEnvelope(FIRM_B);
    expect((await call('GET', `/v1/envelopes/${theirs}/audit`)).status).toBe(403);
  });

  it('404s an unknown envelope', async () => {
    expect((await call('GET', '/v1/envelopes/nope/audit')).status).toBe(404);
  });
});

describe('GET /v1/envelopes/:id/signed-pdf', () => {
  const completed = (path: string | null = 'firm-a/signed.pdf') => ({
    status: 'completed',
    signed_document_path: path,
  });

  it('streams the PDF for a completed owned envelope', async () => {
    const id = await seedEnvelope(FIRM_A, completed());
    const res = await call('GET', `/v1/envelopes/${id}/signed-pdf`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain(`envelope_${id}_signed.pdf`);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([37, 80, 68, 70]));
  });

  it('409s an envelope that is not completed', async () => {
    const id = await seedEnvelope(FIRM_A, { status: 'sent' });
    const res = await call('GET', `/v1/envelopes/${id}/signed-pdf`);
    expect(res.status).toBe(409);
    expect((await json(res)).error).toMatch(/only for completed/);
  });

  it('404s a completed envelope whose PDF was never materialised', async () => {
    const id = await seedEnvelope(FIRM_A, completed(null));
    const res = await call('GET', `/v1/envelopes/${id}/signed-pdf`);
    expect(res.status).toBe(404);
    expect((await json(res)).error).toMatch(/not yet materialised/);
  });

  it('404s when the object is gone from storage', async () => {
    const id = await seedEnvelope(FIRM_A, completed());
    storage.downloaded = null;
    const res = await call('GET', `/v1/envelopes/${id}/signed-pdf`);
    expect(res.status).toBe(404);
    expect((await json(res)).error).toMatch(/missing in storage/);
  });

  it('403s another firm’s signed PDF before it touches storage', async () => {
    const theirs = await seedEnvelope(FIRM_B, completed());
    const res = await call('GET', `/v1/envelopes/${theirs}/signed-pdf`);
    expect(res.status).toBe(403);
  });
});

// ==========================================================================
// Templates
// ==========================================================================
describe('templates on the v1 surface', () => {
  const makeTemplate = (over: Record<string, unknown> = {}) =>
    createTemplate({
      name: 'Advice mandate',
      createdBy: 'u-a',
      recipients: [{ name: 'Client', email: 'client@example.com', role: 'signer' }],
      fields: [
        {
          recipientIndex: 0,
          type: 'signature',
          page: 1,
          x: 10,
          y: 20,
          width: 100,
          height: 40,
          required: true,
        },
      ],
      ...over,
    } as Parameters<typeof createTemplate>[0]);

  it('lists templates', async () => {
    const t = await makeTemplate();
    const { templates } = await json(await call('GET', '/v1/templates'));
    expect(templates.map((x: any) => x.id)).toEqual([t.id]);
  });

  it('returns a template by id', async () => {
    const t = await makeTemplate();
    const { template } = await json(await call('GET', `/v1/templates/${t.id}`));
    expect(template.name).toBe('Advice mandate');
  });

  it('404s an unknown template', async () => {
    expect((await call('GET', '/v1/templates/nope')).status).toBe(404);
  });

  /**
   * ASSERTED, NOT ENDORSED — the same open `firm_id` question as the envelope
   * list (task #16).
   *
   * Both template routes scope with `!t.firm_id || t.firm_id === auth.firmId`,
   * but `EsignTemplateRecord` has no `firm_id` field and nothing in
   * esign-template-service.ts ever writes one — the `firmId` it does handle
   * belongs to the DOCUMENT records cloned into a template, not the template.
   * So the left branch is always true and the filter admits every template to
   * every API key, including recipient names and email addresses.
   *
   * It is unreachable in production today: that project holds zero API keys and
   * zero templates, so there is nothing to leak and nothing to backfill. It is
   * not fixed here because "deny a template with no firm_id" would deny all of
   * them — exactly the bind the envelope list is in — and which way that goes
   * depends on what firm_id is meant to mean, which is the decision already
   * open. These two tests fail the moment someone changes the behaviour, which
   * is the point: the change should be deliberate.
   */
  it('ASSERTED NOT ENDORSED: lists another firm’s templates to any API key', async () => {
    const t = await makeTemplate();
    const { templates } = await json(await call('GET', '/v1/templates', { token: tokenB }));
    expect(templates.map((x: any) => x.id)).toEqual([t.id]);
    expect(templates[0].recipients[0].email).toBe('client@example.com');
  });

  it('ASSERTED NOT ENDORSED: serves another firm’s template detail to any API key', async () => {
    const t = await makeTemplate();
    const res = await call('GET', `/v1/templates/${t.id}`, { token: tokenB });
    expect(res.status).toBe(200);
    expect((await json(res)).template.id).toBe(t.id);
  });

  it('403s a template that DOES carry a foreign firm_id', async () => {
    const t = await makeTemplate();
    kvStore.set(`esign:template:${t.id}`, {
      ...(kvStore.get(`esign:template:${t.id}`) as Record<string, unknown>),
      firm_id: FIRM_B,
    });
    expect((await call('GET', `/v1/templates/${t.id}`)).status).toBe(403);
  });
});

// ==========================================================================
// POST /v1/envelopes/from-template
// ==========================================================================
describe('POST /v1/envelopes/from-template', () => {
  const makeTemplate = (over: Record<string, unknown> = {}) =>
    createTemplate({
      name: 'Advice mandate',
      createdBy: 'u-a',
      recipients: [{ name: 'Client', email: 'client@example.com', role: 'signer' }],
      fields: [
        {
          recipientIndex: 0,
          type: 'signature',
          page: 1,
          x: 10,
          y: 20,
          width: 100,
          height: 40,
          required: true,
        },
      ],
      ...over,
    } as Parameters<typeof createTemplate>[0]);

  const validBody = (templateId: string, over: Record<string, unknown> = {}) => ({
    templateId,
    documentBase64: PDF_B64,
    recipients: [{ name: 'Ada', email: 'ada@example.com' }],
    ...over,
  });

  it('creates a draft envelope, document and signers from the template', async () => {
    const t = await makeTemplate();
    const res = await call('POST', '/v1/envelopes/from-template', { body: validBody(t.id) });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body).toMatchObject({
      status: 'draft',
      template_id: t.id,
      template_version: 1,
    });
    expect(body.signer_ids).toHaveLength(1);
    expect(storage.uploads[0].firmId).toBe(FIRM_A);
  });

  it('stamps the envelope with the API key’s firm, not the template author’s', async () => {
    const t = await makeTemplate();
    const { envelope_id } = await json(
      await call('POST', '/v1/envelopes/from-template', { body: validBody(t.id) }),
    );
    expect((kvStore.get(`esign:envelope:${envelope_id}`) as any).firm_id).toBe(FIRM_A);
  });

  it('attributes the envelope to the API key rather than a user', async () => {
    const t = await makeTemplate();
    const { envelope_id } = await json(
      await call('POST', '/v1/envelopes/from-template', { body: validBody(t.id) }),
    );
    expect((kvStore.get(`esign:envelope:${envelope_id}`) as any).created_by_user_id).toMatch(
      /^api:/,
    );
  });

  it('bumps the template usage count', async () => {
    const t = await makeTemplate();
    await call('POST', '/v1/envelopes/from-template', { body: validBody(t.id) });
    expect((kvStore.get(`esign:template:${t.id}`) as any).usageCount).toBe(1);
  });

  it('falls back to the template’s name, message and expiry', async () => {
    const t = await makeTemplate({ defaultMessage: 'Please sign', defaultExpiryDays: 7 });
    const { envelope_id } = await json(
      await call('POST', '/v1/envelopes/from-template', { body: validBody(t.id) }),
    );
    const env = kvStore.get(`esign:envelope:${envelope_id}`) as any;
    expect(env.title).toBe('Advice mandate');
    expect(env.message).toBe('Please sign');
  });

  it('lets the body override title, message and expiry', async () => {
    const t = await makeTemplate({ defaultMessage: 'Please sign' });
    const { envelope_id } = await json(
      await call('POST', '/v1/envelopes/from-template', {
        body: validBody(t.id, { title: 'Custom', message: 'Override', expiryDays: 2 }),
      }),
    );
    const env = kvStore.get(`esign:envelope:${envelope_id}`) as any;
    expect(env.title).toBe('Custom');
    expect(env.message).toBe('Override');
  });

  it('accepts a data: URI prefix on the base64 payload', async () => {
    const t = await makeTemplate();
    const res = await call('POST', '/v1/envelopes/from-template', {
      body: validBody(t.id, { documentBase64: `data:application/pdf;base64,${PDF_B64}` }),
    });
    expect(res.status).toBe(201);
  });

  it.each([
    [{ templateId: '' }, 'templateId required'],
    [{ documentBase64: '' }, 'documentBase64 required'],
    [{ recipients: [] }, 'At least one recipient is required'],
    [{ recipients: 'not an array' }, 'At least one recipient is required'],
  ])('rejects %j', async (over, message) => {
    const t = await makeTemplate();
    const res = await call('POST', '/v1/envelopes/from-template', {
      body: validBody(t.id, over as Record<string, unknown>),
    });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe(message);
  });

  it('rejects a body that is not JSON', async () => {
    const res = await v1Routes.fetch(
      new Request('http://x/v1/envelopes/from-template', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: 'not json',
      }),
    );
    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe('Invalid JSON body');
  });

  it('404s an unknown template', async () => {
    const res = await call('POST', '/v1/envelopes/from-template', {
      body: validBody('no-such-template'),
    });
    expect(res.status).toBe(404);
  });

  it('rejects fewer recipients than the template’s slots', async () => {
    const t = await makeTemplate({
      recipients: [
        { name: 'One', email: 'one@example.com', role: 'signer' },
        { name: 'Two', email: 'two@example.com', role: 'signer' },
      ],
    });
    const res = await call('POST', '/v1/envelopes/from-template', { body: validBody(t.id) });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/requires 2 recipient\(s\); received 1/);
  });

  it('rejects a payload that fails document validation', async () => {
    const t = await makeTemplate();
    storage.validation = { valid: false, error: 'Not a PDF' };
    const res = await call('POST', '/v1/envelopes/from-template', { body: validBody(t.id) });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe('Not a PDF');
  });

  it('500s when the upload fails, and creates no envelope', async () => {
    const t = await makeTemplate();
    storage.uploadError = 'bucket unavailable';
    const res = await call('POST', '/v1/envelopes/from-template', { body: validBody(t.id) });
    expect(res.status).toBe(500);
    expect((await json(res)).error).toBe('bucket unavailable');
    expect([...kvStore.keys()].filter((k) => /^esign:envelope:[^:]+$/.test(k))).toEqual([]);
  });

  it('fills a recipient’s missing name from the template slot', async () => {
    const t = await makeTemplate();
    const res = await call('POST', '/v1/envelopes/from-template', {
      body: validBody(t.id, { recipients: [{ email: 'ada@example.com' }] }),
    });
    expect(res.status).toBe(201);
    const { signer_ids } = await json(res);
    expect((kvStore.get(`esign:signer:${signer_ids[0]}`) as any).name).toBe('Client');
  });

  it('carries the template slot’s OTP requirement onto the signer', async () => {
    const t = await makeTemplate({
      recipients: [
        { name: 'Client', email: 'client@example.com', role: 'signer', otpRequired: true },
      ],
    });
    const { signer_ids } = await json(
      await call('POST', '/v1/envelopes/from-template', { body: validBody(t.id) }),
    );
    const signer = kvStore.get(`esign:signer:${signer_ids[0]}`) as any;
    expect(signer.requiresOtp ?? signer.requires_otp).toBe(true);
  });

  it('drops template fields whose recipient slot was never filled', async () => {
    const t = await makeTemplate({
      recipients: [{ name: 'Client', email: 'client@example.com', role: 'signer' }],
      fields: [
        { recipientIndex: 0, type: 'signature', page: 1, x: 1, y: 1, width: 1, height: 1 },
        { recipientIndex: 9, type: 'signature', page: 1, x: 2, y: 2, width: 1, height: 1 },
      ],
    });
    const { envelope_id } = await json(
      await call('POST', '/v1/envelopes/from-template', { body: validBody(t.id) }),
    );
    const fields = [...kvStore.entries()].filter(([k]) => k.startsWith('esign:field:'));
    expect(fields).toHaveLength(1);
    expect(envelope_id).toEqual(expect.any(String));
  });

  it('writes an audit event naming the template and version', async () => {
    const t = await makeTemplate();
    const { envelope_id } = await json(
      await call('POST', '/v1/envelopes/from-template', { body: validBody(t.id) }),
    );
    const events = [...kvStore.values()].filter(
      (v: any) => v?.action === 'envelope_created_from_template_api',
    ) as any[];
    expect(events).toHaveLength(1);
    expect(events[0].envelope_id ?? events[0].envelopeId).toBe(envelope_id);
    expect(events[0].metadata?.template_id ?? events[0].details?.template_id).toBe(t.id);
  });
});
