/**
 * tax-planning-fna-routes.ts — Route Contract Tests
 * =================================================
 *
 * Eleven routes, 188 statements, 0% covered before this file: a client's tax
 * plan, plus an ad-hoc document store holding their tax returns, IRP5
 * certificates and SARS assessments. Every route is client-scoped and the whole
 * file was untested.
 *
 * Two deliberate choices, the same ones the advice-engine suite makes:
 *
 *   1. `client-access.ts` is NOT mocked. The genuine `canAccessClientAs` policy
 *      decides every 403 here — clients self-only, platform admins across
 *      clients, advisers only for their server-resolved assignment, everyone
 *      else denied. Only the adviser-assignment lookup is stubbed. A mocked
 *      policy would leave these tests asserting the mock.
 *   2. The real zod schemas and the real `authenticateUser` run, so the 400 and
 *      401 envelopes are the ones that ship.
 *
 * Several behaviours below are pinned as they ARE and flagged at their tests
 * rather than quietly asserted: the bucket-before-authorization order on
 * upload, the extension fallback that never fires, and the storage-delete
 * failure that is swallowed.
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
vi.mock('jsr:@supabase/supabase-js@2.49.8', async () =>
  (await import('./helpers/fna-routes-harness.ts')).makeFnaSupabaseMock(),
);
vi.mock('../fna-intake-adviser-resolver.ts', async () =>
  (await import('./helpers/fna-routes-harness.ts')).makeAdviserResolverMock(),
);
vi.mock('../auth-mw.ts', async () =>
  (await import('./helpers/fna-routes-harness.ts')).makeAuthMwMockForFna(),
);

const prefill = vi.hoisted(() => ({
  taxAutoPopulateFromResolver: vi.fn(async () => ({ grossIncome: 900_000 })),
  enrichTaxFromDomainSessions: vi.fn(
    async (_clientId: string, inputs: Record<string, unknown>) => ({
      ...inputs,
      retirementContributions: 120_000,
    }),
  ),
}));
vi.mock('../form-prefill-auto-populate.ts', () => prefill);

import { kvStore, multipart, alignFileGlobal } from './helpers/contract-harness.ts';
import {
  resetFnaHarness,
  seedFnaUser,
  fnaAssignments,
  fnaStorageUploads,
  fnaStorageErrors,
  fnaCreatedBuckets,
  fnaExistingBuckets,
} from './helpers/fna-routes-harness.ts';

const app = (await import('../tax-planning-fna-routes.ts')).default;

// `clientId` is validated as a UUID by SaveTaxPlanningSessionSchema, so the
// fixtures have to be real ones.
const CLIENT_A = '11111111-2222-4333-8444-555555555555';
const CLIENT_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const ADVISER_A = 'adviser-of-a';
const ADVISER_B = 'adviser-of-b';
const BUCKET = 'make-91ed8379-tax-docs';

/** Tokens seeded once; `as` on a request picks which one is presented. */
const TOKENS: Record<string, { id: string; email: string; role?: string }> = {
  admin: { id: 'admin-1', email: 'admin@navigatewealth.co', role: 'admin' },
  adviserA: { id: ADVISER_A, email: 'a@navigatewealth.co', role: 'adviser' },
  adviserB: { id: ADVISER_B, email: 'b@navigatewealth.co', role: 'adviser' },
  clientA: { id: CLIENT_A, email: 'clienta@example.com', role: 'client' },
  paraplanner: { id: 'para-1', email: 'para@navigatewealth.co', role: 'paraplanner' },
  compliance: { id: 'comp-1', email: 'comp@navigatewealth.co', role: 'compliance' },
};

/**
 * The FNA gateway reads a bearer token rather than test headers, so requests
 * name a seeded token instead of a role header.
 */
function req(
  path: string,
  {
    as = 'admin',
    method = 'GET',
    body,
    form,
    auth = true,
  }: {
    as?: keyof typeof TOKENS | null;
    method?: string;
    body?: unknown;
    form?: { body: string; contentType: string };
    auth?: boolean;
  } = {},
) {
  const headers: Record<string, string> = {};
  if (auth && as) headers.Authorization = `Bearer ${as}`;
  else if (auth) headers.Authorization = 'Bearer unknown-token';
  if (form) headers['Content-Type'] = form.contentType;
  else if (body !== undefined) headers['Content-Type'] = 'application/json';
  return app.request(path, {
    method,
    headers,
    ...(form ? { body: form.body } : body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const json = async (res: Response) => (await res.json()) as Record<string, never>;

/** A valid save body. `finalResults` is required by the schema. */
const savePayload = (clientId: string, extra: Record<string, unknown> = {}) => ({
  clientId,
  inputs: { grossIncome: 900_000 },
  finalResults: { taxPayable: 250_000 },
  ...extra,
});

/** Every stored session for a client, lowest version first. */
function sessions(clientId: string) {
  return [...kvStore.entries()]
    .filter(([key]) => key.startsWith(`tax-planning-fna:client:${clientId}:`))
    .map(([, value]) => value as Record<string, never>)
    .sort((a, b) => Number(a.version) - Number(b.version));
}

beforeEach(async () => {
  kvStore.clear();
  resetFnaHarness();
  await alignFileGlobal();
  for (const [token, user] of Object.entries(TOKENS)) seedFnaUser(token, user);
  fnaAssignments.set(CLIENT_A, ADVISER_A);
  fnaAssignments.set(CLIENT_B, ADVISER_B);
  prefill.taxAutoPopulateFromResolver.mockClear();
  prefill.enrichTaxFromDomainSessions.mockClear();
});

// ============================================================================
// SHAPE
// ============================================================================

describe('service root', () => {
  it.each(['/', ''])('answers %j without requiring a token', async (path) => {
    const res = await req(path, { auth: false });
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ service: 'tax-planning-fna', status: 'active' });
  });
});

// ============================================================================
// AUTHORIZATION — the real policy, on every client-scoped route
// ============================================================================

/**
 * Every route that names a client, with a body where the method needs one.
 * Table-driven because the failure this guards against is one route in eleven
 * missing its check, which sampling does not find.
 */
const CLIENT_SCOPED: Array<[string, string, unknown?]> = [
  ['POST', `/client/${CLIENT_A}/auto-populate`],
  ['POST', '/save', undefined],
  ['GET', `/client/${CLIENT_A}`],
  ['GET', `/client/${CLIENT_A}/latest-published`],
  ['GET', `/tax-docs/${CLIENT_A}`],
  ['GET', `/tax-docs/${CLIENT_A}/tdoc_1/download`],
  ['DELETE', `/tax-docs/${CLIENT_A}/tdoc_1`],
];

describe('authorization', () => {
  it.each(CLIENT_SCOPED)('%s %s rejects a request with no token', async (method, path) => {
    const res = await req(path, {
      method,
      auth: false,
      body: path === '/save' ? savePayload(CLIENT_A) : undefined,
    });
    expect(res.status).toBe(401);
  });

  it.each(CLIENT_SCOPED)('%s %s rejects an unrecognised token', async (method, path) => {
    const res = await req(path, {
      method,
      as: null,
      body: path === '/save' ? savePayload(CLIENT_A) : undefined,
    });
    expect(res.status).toBe(401);
  });

  it.each(CLIENT_SCOPED)("%s %s denies the OTHER client's adviser", async (method, path) => {
    const res = await req(path, {
      method,
      as: 'adviserB',
      body: path === '/save' ? savePayload(CLIENT_A) : undefined,
    });
    expect(res.status).toBe(403);
  });

  // paraplanner and compliance can sign in, and still cannot open a client's
  // tax plan: `canAccessClientAs` denies every role that is neither a platform
  // admin nor the assigned adviser nor the client themselves.
  it.each(['paraplanner', 'compliance'] as const)('denies %s on the whole family', async (role) => {
    for (const [method, path] of CLIENT_SCOPED) {
      const res = await req(path, {
        method,
        as: role,
        body: path === '/save' ? savePayload(CLIENT_A) : undefined,
      });
      expect([res.status, method, path]).toEqual([403, method, path]);
    }
  });

  it('admits the assigned adviser', async () => {
    const res = await req(`/client/${CLIENT_A}`, { as: 'adviserA' });
    expect(res.status).toBe(200);
  });

  it('admits the client for their own record', async () => {
    const res = await req(`/client/${CLIENT_A}`, { as: 'clientA' });
    expect(res.status).toBe(200);
  });

  it('denies the client for someone else’s record', async () => {
    const res = await req(`/client/${CLIENT_B}`, { as: 'clientA' });
    expect(res.status).toBe(403);
  });
});

// ============================================================================
// AUTO-POPULATE
// ============================================================================

describe('POST /client/:clientId/auto-populate', () => {
  it('runs the resolver and then the domain enrichment, in that order', async () => {
    const res = await req(`/client/${CLIENT_A}/auto-populate`, { method: 'POST' });

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({
      success: true,
      data: { grossIncome: 900_000, retirementContributions: 120_000 },
    });
    expect(prefill.taxAutoPopulateFromResolver).toHaveBeenCalledWith(CLIENT_A);
    // The enrichment is handed the resolver's output, not the raw client id —
    // it layers onto what the resolver found rather than replacing it.
    expect(prefill.enrichTaxFromDomainSessions).toHaveBeenCalledWith(CLIENT_A, {
      grossIncome: 900_000,
    });
  });

  it('surfaces a resolver failure as a 500 rather than an empty success', async () => {
    prefill.taxAutoPopulateFromResolver.mockRejectedValueOnce(new Error('resolver exploded'));
    const res = await req(`/client/${CLIENT_A}/auto-populate`, { method: 'POST' });
    expect(res.status).toBe(500);
  });
});

// ============================================================================
// SAVE
// ============================================================================

describe('POST /save', () => {
  it('stores the session and defaults an unspecified status to published', async () => {
    const res = await req('/save', { method: 'POST', body: savePayload(CLIENT_A) });

    expect(res.status).toBe(200);
    const { data } = (await json(res)) as unknown as { data: Record<string, never> };
    expect(data).toMatchObject({
      clientId: CLIENT_A,
      version: 1,
      // Pinned deliberately: a save with no status is treated as PUBLISHED, not
      // as a draft. `latest-published` reads it immediately.
      status: 'published',
      adviserId: 'admin-1',
      adjustments: [],
      recommendations: [],
      adviserNotes: '',
      createdBy: 'Adviser',
    });
    expect(String(data.id)).toMatch(new RegExp(`^${CLIENT_A}-v1-[0-9a-f]{8}$`));
  });

  it('keys the record under the client so one client cannot list another’s', async () => {
    await req('/save', { method: 'POST', body: savePayload(CLIENT_A) });
    const key = [...kvStore.keys()].find((k) => k.startsWith('tax-planning-fna:client:'))!;
    expect(key.startsWith(`tax-planning-fna:client:${CLIENT_A}:`)).toBe(true);
  });

  it('numbers each save above the highest already stored', async () => {
    for (let i = 0; i < 3; i++) {
      await req('/save', { method: 'POST', body: savePayload(CLIENT_A) });
    }
    expect(sessions(CLIENT_A).map((s) => s.version)).toEqual([1, 2, 3]);
  });

  it('rejects a body missing finalResults with a 400 naming the field', async () => {
    const res = await req('/save', {
      method: 'POST',
      body: { clientId: CLIENT_A, inputs: { grossIncome: 1 } },
    });
    expect(res.status).toBe(400);
    // `error` is the whole formatZodError object, not a string — the field
    // names live under `error.errors`, keyed by path.
    const body = (await json(res)) as unknown as {
      success: boolean;
      error: { message: string; errors: Record<string, string[]> };
    };
    expect(body.success).toBe(false);
    expect(body.error.message).toBe('Validation failed');
    expect(Object.keys(body.error.errors)).toContain('finalResults');
  });

  it('rejects a non-uuid clientId with a 400 for a platform admin', async () => {
    // `canAccessClientAs` short-circuits true for a platform admin whatever the
    // clientId, so the access check cannot reject this one and the schema is
    // what stops it. Worth pinning: the 403 an adviser gets here is NOT what
    // keeps a malformed id out of the store.
    const res = await req('/save', { method: 'POST', body: savePayload('not-a-uuid') });
    expect(res.status).toBe(400);
    expect(sessions('not-a-uuid')).toHaveLength(0);
  });

  it('rejects a non-uuid clientId with a 403 for an adviser', async () => {
    const res = await req('/save', {
      method: 'POST',
      as: 'adviserA',
      body: savePayload('not-a-uuid'),
    });
    expect(res.status).toBe(403);
  });

  it('checks client access BEFORE validating, so a bad body cannot probe ownership', async () => {
    // A caller without access gets 403 whether the body is valid or not — the
    // 400 would otherwise confirm the clientId exists to someone who cannot
    // read it.
    const res = await req('/save', {
      method: 'POST',
      as: 'adviserB',
      body: { clientId: CLIENT_A, inputs: {} },
    });
    expect(res.status).toBe(403);
    expect(sessions(CLIENT_A)).toHaveLength(0);
  });

  it('carries adjustments, recommendations and notes through when supplied', async () => {
    const res = await req('/save', {
      method: 'POST',
      body: savePayload(CLIENT_A, {
        adjustments: [{ kind: 's11F', amount: 350_000 }],
        recommendations: [{ text: 'Top up the RA before year end' }],
        adviserNotes: 'Client wants to retire at 60.',
        status: 'draft',
      }),
    });
    const { data } = (await json(res)) as unknown as { data: Record<string, never> };
    expect(data).toMatchObject({
      status: 'draft',
      adjustments: [{ kind: 's11F', amount: 350_000 }],
      recommendations: [{ text: 'Top up the RA before year end' }],
      adviserNotes: 'Client wants to retire at 60.',
    });
  });
});

// ============================================================================
// READS
// ============================================================================

describe('GET /client/:clientId', () => {
  it('returns the client’s sessions newest version first', async () => {
    for (let i = 0; i < 3; i++) {
      await req('/save', { method: 'POST', body: savePayload(CLIENT_A) });
    }
    const res = await req(`/client/${CLIENT_A}`);
    const { data } = (await json(res)) as unknown as { data: Array<{ version: number }> };
    expect(data.map((s) => s.version)).toEqual([3, 2, 1]);
  });

  it('returns an empty list rather than a 404 for a client with no sessions', async () => {
    const res = await req(`/client/${CLIENT_A}`);
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ success: true, data: [] });
  });

  it('does not leak another client’s sessions', async () => {
    await req('/save', { method: 'POST', body: savePayload(CLIENT_B), as: 'adviserB' });
    const res = await req(`/client/${CLIENT_A}`, { as: 'adviserA' });
    expect(await json(res)).toEqual({ success: true, data: [] });
  });
});

describe('GET /client/:clientId/latest-published', () => {
  it('returns the highest-version PUBLISHED session, ignoring later drafts', async () => {
    await req('/save', { method: 'POST', body: savePayload(CLIENT_A, { status: 'published' }) });
    await req('/save', { method: 'POST', body: savePayload(CLIENT_A, { status: 'published' }) });
    await req('/save', { method: 'POST', body: savePayload(CLIENT_A, { status: 'draft' }) });

    const res = await req(`/client/${CLIENT_A}/latest-published`);
    const { data } = (await json(res)) as unknown as { data: { version: number; status: string } };
    expect(data.version).toBe(2);
    expect(data.status).toBe('published');
  });

  it('returns null when nothing is published', async () => {
    await req('/save', { method: 'POST', body: savePayload(CLIENT_A, { status: 'draft' }) });
    const res = await req(`/client/${CLIENT_A}/latest-published`);
    expect(await json(res)).toEqual({ success: true, data: null });
  });
});

// ============================================================================
// TAX DOCUMENTS
// ============================================================================

const pdfUpload = (
  overrides: Partial<{ filename: string; type: string; title: string; documentType: string }> = {},
) =>
  multipart([
    {
      name: 'file',
      value: '%PDF-1.4 fake',
      filename: overrides.filename ?? 'IRP5-2026.pdf',
      type: overrides.type ?? 'application/pdf',
    },
    { name: 'title', value: overrides.title ?? 'IRP5 2026' },
    { name: 'documentType', value: overrides.documentType ?? 'irp5' },
    { name: 'taxYear', value: '2026' },
    { name: 'notes', value: 'From the employer portal' },
  ]);

describe('POST /tax-docs/:clientId/upload', () => {
  it('stores the file and its metadata under the client', async () => {
    const res = await req(`/tax-docs/${CLIENT_A}/upload`, {
      method: 'POST',
      form: pdfUpload(),
    });

    expect(res.status).toBe(200);
    const { data } = (await json(res)) as unknown as { data: Record<string, never> };
    expect(data).toMatchObject({
      clientId: CLIENT_A,
      title: 'IRP5 2026',
      documentType: 'irp5',
      taxYear: '2026',
      notes: 'From the employer portal',
      fileName: 'IRP5-2026.pdf',
      mimeType: 'application/pdf',
      uploadedBy: 'admin@navigatewealth.co',
    });

    expect(fnaStorageUploads).toEqual([
      { bucket: BUCKET, path: `tax-docs/${CLIENT_A}/${data.id}.pdf` },
    ]);
    expect(kvStore.get(`tax_doc:${CLIENT_A}:${data.id}`)).toMatchObject({ id: data.id });
  });

  it('rejects a request with no file', async () => {
    const res = await req(`/tax-docs/${CLIENT_A}/upload`, {
      method: 'POST',
      form: multipart([
        { name: 'title', value: 'no file here' },
        { name: 'documentType', value: 'irp5' },
      ]),
    });
    expect(res.status).toBe(400);
    expect((await json(res)) as unknown as { error: string }).toMatchObject({
      error: 'No file provided',
    });
  });

  it('rejects a file with no title or documentType', async () => {
    const res = await req(`/tax-docs/${CLIENT_A}/upload`, {
      method: 'POST',
      form: multipart([{ name: 'file', value: 'x', filename: 'a.pdf', type: 'application/pdf' }]),
    });
    expect(res.status).toBe(400);
    expect((await json(res)) as unknown as { error: string }).toMatchObject({
      error: 'Title and document type are required',
    });
  });

  it.each([
    ['application/zip', 'archive.zip'],
    ['text/html', 'page.html'],
    ['application/x-msdownload', 'payload.exe'],
  ])('rejects %s on content type, whatever the extension says', async (type, filename) => {
    const res = await req(`/tax-docs/${CLIENT_A}/upload`, {
      method: 'POST',
      form: pdfUpload({ type, filename }),
    });
    expect(res.status).toBe(400);
    expect((await json(res)) as unknown as { error: string }).toMatchObject({
      error: 'Invalid file type. Only PDF, JPEG, and PNG files are allowed.',
    });
    expect(fnaStorageUploads).toEqual([]);
  });

  it.each([
    ['image/jpeg', 'scan.jpg'],
    ['image/png', 'assessment.png'],
  ])('accepts %s', async (type, filename) => {
    const res = await req(`/tax-docs/${CLIENT_A}/upload`, {
      method: 'POST',
      form: pdfUpload({ type, filename }),
    });
    expect(res.status).toBe(200);
  });

  it('derives the stored extension from the filename, not the content type', async () => {
    // A PNG named `.jpg` is stored as `.jpg`. Pinned as current behaviour: the
    // route trusts the caller's filename for the path and the caller's
    // Content-Type for the allowlist, which are two different sources.
    const res = await req(`/tax-docs/${CLIENT_A}/upload`, {
      method: 'POST',
      form: pdfUpload({ type: 'image/png', filename: 'mislabelled.jpg' }),
    });
    const { data } = (await json(res)) as unknown as { data: { id: string } };
    expect(fnaStorageUploads[0].path).toBe(`tax-docs/${CLIENT_A}/${data.id}.jpg`);
  });

  it('falls back to pdf only for a name ending in a bare dot', async () => {
    // `'mandate'.split('.').pop()` is `'mandate'`, which is truthy, so the
    // `|| 'pdf'` fallback never fires for an extensionless name — only for one
    // that ends in '.'. Pinned as it is, not as it reads.
    const res = await req(`/tax-docs/${CLIENT_A}/upload`, {
      method: 'POST',
      form: pdfUpload({ filename: 'mandate' }),
    });
    const { data } = (await json(res)) as unknown as { data: { id: string } };
    expect(fnaStorageUploads[0].path).toBe(`tax-docs/${CLIENT_A}/${data.id}.mandate`);

    fnaStorageUploads.length = 0;
    const res2 = await req(`/tax-docs/${CLIENT_A}/upload`, {
      method: 'POST',
      form: pdfUpload({ filename: 'trailing.' }),
    });
    const { data: d2 } = (await json(res2)) as unknown as { data: { id: string } };
    expect(fnaStorageUploads[0].path).toBe(`tax-docs/${CLIENT_A}/${d2.id}.pdf`);
  });

  it('writes nothing to the KV when the storage upload fails', async () => {
    fnaStorageErrors.upload = 'bucket is full';
    const res = await req(`/tax-docs/${CLIENT_A}/upload`, {
      method: 'POST',
      form: pdfUpload(),
    });
    expect(res.status).toBe(500);
    expect((await json(res)) as unknown as { error: string }).toMatchObject({
      error: 'Failed to upload document: bucket is full',
    });
    expect([...kvStore.keys()].filter((k) => k.startsWith('tax_doc:'))).toEqual([]);
  });
});

describe('GET /tax-docs/:clientId', () => {
  it('lists the client’s documents newest upload first', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const ids: string[] = [];
      for (const [i, title] of ['first', 'second', 'third'].entries()) {
        vi.setSystemTime(Date.parse('2026-03-01T09:00:00.000Z') + i * 60_000);
        const res = await req(`/tax-docs/${CLIENT_A}/upload`, {
          method: 'POST',
          form: pdfUpload({ title }),
        });
        ids.push(((await json(res)) as unknown as { data: { id: string } }).data.id);
      }

      const res = await req(`/tax-docs/${CLIENT_A}`);
      const { data } = (await json(res)) as unknown as { data: Array<{ title: string }> };
      expect(data.map((d) => d.title)).toEqual(['third', 'second', 'first']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not list another client’s documents', async () => {
    await req(`/tax-docs/${CLIENT_B}/upload`, {
      method: 'POST',
      form: pdfUpload(),
      as: 'adviserB',
    });
    const res = await req(`/tax-docs/${CLIENT_A}`, { as: 'adviserA' });
    expect(await json(res)).toEqual({ success: true, data: [] });
  });
});

describe('GET /tax-docs/:clientId/:docId/download', () => {
  it('returns a signed URL and the original filename', async () => {
    const up = await req(`/tax-docs/${CLIENT_A}/upload`, { method: 'POST', form: pdfUpload() });
    const { data } = (await json(up)) as unknown as { data: { id: string; filePath: string } };

    const res = await req(`/tax-docs/${CLIENT_A}/${data.id}/download`);
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({
      success: true,
      url: `https://signed.test/${BUCKET}/${data.filePath}`,
      fileName: 'IRP5-2026.pdf',
    });
  });

  it('404s for an unknown document', async () => {
    const res = await req(`/tax-docs/${CLIENT_A}/tdoc_nope/download`);
    expect(res.status).toBe(404);
  });

  it('404s rather than 403s for a document stored under another client', async () => {
    // The doc key is built from the URL's clientId, which was just authorized,
    // so a caller cannot reach across clients here even by knowing a docId.
    const up = await req(`/tax-docs/${CLIENT_B}/upload`, {
      method: 'POST',
      form: pdfUpload(),
      as: 'adviserB',
    });
    const { data } = (await json(up)) as unknown as { data: { id: string } };

    const res = await req(`/tax-docs/${CLIENT_A}/${data.id}/download`, { as: 'adviserA' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /tax-docs/:clientId/:docId', () => {
  it('removes the KV record', async () => {
    const up = await req(`/tax-docs/${CLIENT_A}/upload`, { method: 'POST', form: pdfUpload() });
    const { data } = (await json(up)) as unknown as { data: { id: string } };

    const res = await req(`/tax-docs/${CLIENT_A}/${data.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(kvStore.has(`tax_doc:${CLIENT_A}:${data.id}`)).toBe(false);
  });

  it('404s for an unknown document', async () => {
    const res = await req(`/tax-docs/${CLIENT_A}/tdoc_nope`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('still removes the KV record when the storage delete fails', async () => {
    // Pinned and flagged: the storage failure is logged at warn and swallowed,
    // so the metadata goes and the object is orphaned in the bucket. That is a
    // deliberate trade — a client asking for a document to be deleted should
    // not be blocked by the bucket — but it means the bucket accumulates files
    // nothing references.
    const up = await req(`/tax-docs/${CLIENT_A}/upload`, { method: 'POST', form: pdfUpload() });
    const { data } = (await json(up)) as unknown as { data: { id: string } };

    fnaStorageErrors.remove = 'object locked';
    const res = await req(`/tax-docs/${CLIENT_A}/${data.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(kvStore.has(`tax_doc:${CLIENT_A}:${data.id}`)).toBe(false);
  });
});

// ============================================================================
// LAZY BUCKET INIT
// ============================================================================

/**
 * `ensureTaxDocsBucket` latches on a MODULE-level flag, so after any earlier
 * upload in this file the bucket is already "initialized" and a second
 * assertion about creation would pass or fail on test ordering rather than on
 * behaviour. These tests take a fresh module instance instead.
 */
describe('lazy bucket initialisation', () => {
  async function freshApp() {
    vi.resetModules();
    return (await import('../tax-planning-fna-routes.ts')).default;
  }

  it('creates the bucket on the first upload and not on the second', async () => {
    const fresh = await freshApp();
    const send = () =>
      fresh.request(`/tax-docs/${CLIENT_A}/upload`, {
        method: 'POST',
        headers: { Authorization: 'Bearer admin', 'Content-Type': pdfUpload().contentType },
        body: pdfUpload().body,
      });

    await send();
    await send();
    expect(fnaCreatedBuckets).toEqual([BUCKET]);
  });

  it('does not create the bucket when listBuckets already reports it', async () => {
    fnaExistingBuckets.add(BUCKET);
    const fresh = await freshApp();
    await fresh.request(`/tax-docs/${CLIENT_A}/upload`, {
      method: 'POST',
      headers: { Authorization: 'Bearer admin', 'Content-Type': pdfUpload().contentType },
      body: pdfUpload().body,
    });
    expect(fnaCreatedBuckets).toEqual([]);
  });

  it('fails the upload when the bucket cannot be created', async () => {
    fnaStorageErrors.createBucket = 'insufficient permissions';
    const fresh = await freshApp();
    const res = await fresh.request(`/tax-docs/${CLIENT_A}/upload`, {
      method: 'POST',
      headers: { Authorization: 'Bearer admin', 'Content-Type': pdfUpload().contentType },
      body: pdfUpload().body,
    });
    expect(res.status).toBe(500);
    expect(fnaStorageUploads).toEqual([]);
  });

  it('denies an unauthorized caller BEFORE touching the bucket', async () => {
    // The gate order matters beyond the status code: with `ensureTaxDocsBucket`
    // ahead of `assertClientAccess`, a caller who should have been denied got a
    // 500 from storage work done on their behalf, and the request reached the
    // bucket at all. Both are asserted, because only checking the status would
    // still pass if the bucket call moved back ahead and happened to succeed.
    fnaStorageErrors.createBucket = 'insufficient permissions';
    const fresh = await freshApp();
    const res = await fresh.request(`/tax-docs/${CLIENT_A}/upload`, {
      method: 'POST',
      headers: { Authorization: 'Bearer adviserB', 'Content-Type': pdfUpload().contentType },
      body: pdfUpload().body,
    });
    expect(res.status).toBe(403);
    expect(fnaCreatedBuckets).toEqual([]);
  });
});

// ============================================================================
// LEGACY CATCH-ALL
// ============================================================================

describe('GET /:fnaId', () => {
  it('resolves a session by the id shape the save route mints', async () => {
    const saved = await req('/save', { method: 'POST', body: savePayload(CLIENT_A) });
    const { data } = (await json(saved)) as unknown as { data: { id: string } };

    const res = await req(`/${data.id}`);
    expect(res.status).toBe(200);
    expect(((await json(res)) as unknown as { data: { id: string } }).data.id).toBe(data.id);
  });

  it('resolves a session stored under the OLD two-part id shape', async () => {
    // Rows written before the version-collision fix have no suffix. The reader
    // scans the client prefix and matches on the stored `id`, so both resolve.
    const legacyId = `${CLIENT_A}-v7`;
    kvStore.set(`tax-planning-fna:client:${CLIENT_A}:${legacyId}`, {
      id: legacyId,
      clientId: CLIENT_A,
      version: 7,
      status: 'published',
    });

    const res = await req(`/${legacyId}`);
    expect(res.status).toBe(200);
    expect(((await json(res)) as unknown as { data: { version: number } }).data.version).toBe(7);
  });

  it('authorizes against the OWNER on the stored record, not the id supplied', async () => {
    const saved = await req('/save', {
      method: 'POST',
      body: savePayload(CLIENT_B),
      as: 'adviserB',
    });
    const { data } = (await json(saved)) as unknown as { data: { id: string } };

    // adviserA knows the id but is not client B's adviser.
    const res = await req(`/${data.id}`, { as: 'adviserA' });
    expect(res.status).toBe(403);
  });

  it('falls back to a full scan for an id that carries no client segment', async () => {
    kvStore.set(`tax-planning-fna:client:${CLIENT_A}:legacy-oddity`, {
      id: 'legacy-oddity',
      clientId: CLIENT_A,
      version: 1,
    });
    const res = await req('/legacy-oddity');
    expect(res.status).toBe(200);
  });

  it('404s for an id that matches nothing', async () => {
    const res = await req(`/${CLIENT_A}-v99`);
    expect(res.status).toBe(404);
  });
});
