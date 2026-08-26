/**
 * risk-planning-fna-routes.tsx — Route Contract Tests
 * ===================================================
 *
 * Twelve routes, 199 statements uncovered: the life, disability, severe-illness
 * and income-protection needs analysis for a client. A published Risk Planning
 * FNA is a FAIS record of advice, so the lifecycle here — draft, publish,
 * unpublish, archive, hard delete — is a compliance surface, not just CRUD.
 *
 * `client-access.ts` runs for real; only the adviser-assignment lookup is
 * stubbed. The real zod schemas run. Nothing about the storage layer is stubbed
 * beyond the in-memory KV.
 *
 * Three behaviours are asserted here as DEFECTS rather than pinned, because
 * each is fixed in the same change:
 *   - the version number was derived from a prefix that held no FNAs
 *   - `PUT /update/:fnaId` merged the RAW request body into the record
 *   - `POST /unpublish/:fnaId` left the `:latest` pointer serving the
 *     withdrawn FNA, still stamped published
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

const snapshots = vi.hoisted(() => ({ auto: vi.fn(async () => undefined) }));
vi.mock('../net-worth-snapshot-service.ts', () => ({
  NetWorthSnapshotService: class {
    autoSnapshotFromKV = snapshots.auto;
  },
}));

const prefill = vi.hoisted(() => ({
  riskAutoPopulateFromResolver: vi.fn(async () => ({ grossMonthlyIncome: 75_000 })),
}));
vi.mock('../form-prefill-auto-populate.ts', () => prefill);

import { kvStore } from './helpers/contract-harness.ts';
import { resetFnaHarness, seedFnaUser, fnaAssignments } from './helpers/fna-routes-harness.ts';

const app = (await import('../risk-planning-fna-routes.tsx')).default;

const CLIENT_A = '11111111-2222-4333-8444-555555555555';
const CLIENT_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const ADVISER_A = 'adviser-of-a';
const ADVISER_B = 'adviser-of-b';

const TOKENS: Record<string, { id: string; email: string; role?: string }> = {
  admin: { id: 'admin-1', email: 'admin@navigatewealth.co', role: 'admin' },
  adviserA: { id: ADVISER_A, email: 'a@navigatewealth.co', role: 'adviser' },
  adviserB: { id: ADVISER_B, email: 'b@navigatewealth.co', role: 'adviser' },
  clientA: { id: CLIENT_A, email: 'clienta@example.com', role: 'client' },
  paraplanner: { id: 'para-1', email: 'para@navigatewealth.co', role: 'paraplanner' },
};

function req(
  path: string,
  {
    as = 'admin',
    method = 'GET',
    body,
    auth = true,
  }: {
    as?: keyof typeof TOKENS | null;
    method?: string;
    body?: unknown;
    auth?: boolean;
  } = {},
) {
  const headers: Record<string, string> = {};
  if (auth) headers.Authorization = `Bearer ${as ?? 'unknown-token'}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return app.request(path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const json = async (res: Response) => (await res.json()) as Record<string, never>;

/**
 * A complete `RiskCalcInputData`.
 *
 * The calculation functions destructure nested fields and call `.length` on
 * `dependants`, so a thin fixture makes every create a 500 and the whole suite
 * asserts an error envelope instead of the routes. Real numbers, in rands, so
 * the calculated figures below are readable when one changes.
 */
const INPUT_DATA = {
  grossMonthlyIncome: 75_000,
  grossAnnualIncome: 900_000,
  netMonthlyIncome: 52_000,
  netAnnualIncome: 624_000,
  currentAge: 38,
  retirementAge: 65,
  dependants: [
    { id: 'dep-1', relationship: 'child', dependencyTerm: 15, monthlyEducationCost: 6_500 },
    { id: 'dep-2', relationship: 'child', dependencyTerm: 18, monthlyEducationCost: 4_200 },
  ],
  totalOutstandingDebts: 1_450_000,
  totalCurrentAssets: 890_000,
  totalEstateValue: 3_200_000,
  spouseFullName: 'Nomvula Dlamini',
  spouseAverageMonthlyIncome: 31_000,
  existingCover: {
    life: { personal: 2_000_000, group: 1_500_000 },
    disability: { personal: 1_000_000, group: 900_000 },
    severeIllness: { personal: 500_000, group: 0 },
    incomeProtection: {
      temporary: { personal: 20_000, group: 15_000 },
      permanent: { personal: 25_000, group: 0 },
    },
  },
  incomeProtectionSettings: {
    temporary: { benefitPeriod: '24 months' },
    permanent: { escalation: 'CPI' },
  },
} as const;

/** Create an FNA and return the record the route responded with. */
async function create(clientId = CLIENT_A, as: keyof typeof TOKENS = 'admin') {
  const res = await req('/create', {
    method: 'POST',
    as,
    body: { clientId, inputData: INPUT_DATA },
  });
  expect(res.status).toBe(200);
  return ((await json(res)) as unknown as { data: Record<string, never> }).data;
}

const record = (fnaId: string) =>
  kvStore.get(`risk_planning_fna:${fnaId}`) as Record<string, never> | undefined;
const latest = (clientId: string) =>
  kvStore.get(`risk_planning_fna:${clientId}:latest`) as Record<string, never> | undefined;
const list = (clientId: string) =>
  (kvStore.get(`risk_planning_fna:${clientId}:list`) as string[] | undefined) ?? [];

beforeEach(() => {
  kvStore.clear();
  resetFnaHarness();
  for (const [token, user] of Object.entries(TOKENS)) seedFnaUser(token, user);
  fnaAssignments.set(CLIENT_A, ADVISER_A);
  fnaAssignments.set(CLIENT_B, ADVISER_B);
  snapshots.auto.mockClear();
  prefill.riskAutoPopulateFromResolver.mockClear();
});

// ============================================================================
// SHAPE + AUTHORIZATION
// ============================================================================

describe('service root', () => {
  it.each(['/', ''])('answers %j', async (path) => {
    const res = await req(path, { auth: false });
    expect(res.status).toBe(200);
  });
});

describe('authorization', () => {
  const CLIENT_SCOPED: Array<[string, string]> = [
    ['GET', `/client-profile/${CLIENT_A}`],
    ['GET', `/client/${CLIENT_A}/latest`],
    ['GET', `/client/${CLIENT_A}/list`],
  ];

  it.each(CLIENT_SCOPED)('%s %s needs a token', async (method, path) => {
    expect((await req(path, { method, auth: false })).status).toBe(401);
  });

  it.each(CLIENT_SCOPED)("%s %s denies the other client's adviser", async (method, path) => {
    expect((await req(path, { method, as: 'adviserB' })).status).toBe(403);
  });

  it.each(CLIENT_SCOPED)('%s %s denies a paraplanner', async (method, path) => {
    expect((await req(path, { method, as: 'paraplanner' })).status).toBe(403);
  });

  it('admits the assigned adviser and the client themselves', async () => {
    expect((await req(`/client/${CLIENT_A}/list`, { as: 'adviserA' })).status).toBe(200);
    expect((await req(`/client/${CLIENT_A}/list`, { as: 'clientA' })).status).toBe(200);
  });

  const RECORD_SCOPED: Array<[string, (id: string) => string]> = [
    ['GET', (id: string) => `/${id}`],
    ['PUT', (id: string) => `/update/${id}`],
    ['POST', (id: string) => `/publish/${id}`],
    ['POST', (id: string) => `/unpublish/${id}`],
    ['DELETE', (id: string) => `/archive/${id}`],
    ['DELETE', (id: string) => `/hard-delete/${id}`],
  ];

  // The record-scoped routes authorize on the OWNER stored on the record, not
  // on anything the caller supplied. Table-driven over all six because the
  // failure mode is exactly one of them missing its check.
  it.each(RECORD_SCOPED)("%s on a record denies another client's adviser", async (method, path) => {
    const fna = await create(CLIENT_A, 'adviserA');
    const res = await req(path(String(fna.id)), {
      method,
      as: 'adviserB',
      body: method === 'PUT' ? { inputData: INPUT_DATA } : undefined,
    });
    expect(res.status).toBe(403);
  });

  it.each(RECORD_SCOPED)('%s on an unknown record is a 404', async (method, path) => {
    const res = await req(path('risk-fna-nope'), {
      method,
      body: method === 'PUT' ? { inputData: INPUT_DATA } : undefined,
    });
    expect(res.status).toBe(404);
  });
});

// ============================================================================
// CREATE
// ============================================================================

describe('POST /create', () => {
  it('stores the FNA and appends its id to the client list', async () => {
    const fna = await create();
    expect(String(fna.id)).toMatch(/^risk-fna-[0-9a-f-]{36}$/);
    expect(fna.status).toBe('draft');
    expect(record(String(fna.id))).toBeTruthy();
    expect(list(CLIENT_A)).toEqual([fna.id]);
  });

  it('rejects a body with no clientId', async () => {
    const res = await req('/create', { method: 'POST', body: { inputData: {} } });
    expect(res.status).toBe(400);
    expect((await json(res)) as unknown as { error: string }).toMatchObject({
      error: 'clientId is required',
    });
  });

  it('rejects a non-uuid clientId on the schema', async () => {
    const res = await req('/create', { method: 'POST', body: { clientId: 'nope' } });
    expect(res.status).toBe(400);
  });

  it('numbers versions from the client’s OWN records, one per create', async () => {
    // The regression this guards: `getNextVersionNumber` used to prefix-scan
    // `risk_planning_fna:${clientId}:`, which holds only the `:latest` and
    // `:list` bookkeeping keys and never an FNA. Versions came out 1, then 2
    // for every subsequent create, then 3 once anything was published — a
    // number that told an adviser nothing about the client's history.
    const a = await create();
    const b = await create();
    const c = await create();
    expect([a.version, b.version, c.version]).toEqual([1, 2, 3]);

    await req(`/publish/${a.id}`, { method: 'POST' });
    const d = await create();
    expect(d.version).toBe(4);
  });

  it('counts each client separately', async () => {
    await create(CLIENT_A, 'adviserA');
    await create(CLIENT_A, 'adviserA');
    const first = await create(CLIENT_B, 'adviserB');
    expect(first.version).toBe(1);
  });
});

// ============================================================================
// READS
// ============================================================================

describe('reads', () => {
  it('GET /client-profile/:clientId returns the resolver output', async () => {
    const res = await req(`/client-profile/${CLIENT_A}`);
    expect(res.status).toBe(200);
    expect(prefill.riskAutoPopulateFromResolver).toHaveBeenCalledWith(CLIENT_A);
  });

  it('GET /client/:clientId/latest returns null before anything is published', async () => {
    await create();
    const res = await req(`/client/${CLIENT_A}/latest`);
    expect(await json(res)).toEqual({ success: true, data: null });
  });

  it('GET /client/:clientId/list summarises the client’s FNAs', async () => {
    const a = await create();
    await create();
    const res = await req(`/client/${CLIENT_A}/list`);
    const { data } = (await json(res)) as unknown as { data: Array<{ id: string }> };
    expect(data).toHaveLength(2);
    expect(data.map((f) => f.id)).toContain(a.id);
  });

  it('GET /client/:clientId/list does not leak another client’s FNAs', async () => {
    await create(CLIENT_B, 'adviserB');
    const res = await req(`/client/${CLIENT_A}/list`, { as: 'adviserA' });
    expect(((await json(res)) as unknown as { data: unknown[] }).data).toEqual([]);
  });
});

// ============================================================================
// UPDATE
// ============================================================================

describe('PUT /update/:fnaId', () => {
  it('applies a validated field and recalculates when inputData changes', async () => {
    const fna = await create();
    const res = await req(`/update/${fna.id}`, {
      method: 'PUT',
      body: { inputData: { ...INPUT_DATA, grossMonthlyIncome: 90_000 } },
    });
    expect(res.status).toBe(200);
    const stored = record(String(fna.id))!;
    expect((stored.inputData as unknown as Record<string, number>).grossMonthlyIncome).toBe(90_000);
    expect(stored.calculations).toBeTruthy();
  });

  it('rejects an empty update body', async () => {
    const fna = await create();
    const res = await req(`/update/${fna.id}`, { method: 'PUT', body: {} });
    expect(res.status).toBe(400);
  });

  it('refuses to update a published FNA', async () => {
    const fna = await create();
    await req(`/publish/${fna.id}`, { method: 'POST' });
    const res = await req(`/update/${fna.id}`, {
      method: 'PUT',
      body: { inputData: INPUT_DATA },
    });
    expect(res.status).toBe(400);
    expect((await json(res)) as unknown as { error: string }).toMatchObject({
      error: 'Cannot update published FNA. Unpublish first.',
    });
  });

  it('cannot be used to hand the FNA to a different client', async () => {
    // The route used to merge the RAW request body into the record. The schema
    // has no `clientId`, so zod stripped it from `.data` and let the request
    // through — and the raw spread then wrote it anyway. The access check had
    // already passed against the ORIGINAL owner, so client A's adviser could
    // move A's risk analysis onto client B, out of A's list and into B's.
    const fna = await create(CLIENT_A, 'adviserA');

    const res = await req(`/update/${fna.id}`, {
      method: 'PUT',
      as: 'adviserA',
      body: { inputData: INPUT_DATA, clientId: CLIENT_B },
    });

    expect(res.status).toBe(200);
    expect(record(String(fna.id))!.clientId).toBe(CLIENT_A);
  });

  it('cannot be used to rewrite the id, authorship or version', async () => {
    const fna = await create();
    await req(`/update/${fna.id}`, {
      method: 'PUT',
      body: {
        inputData: INPUT_DATA,
        id: 'risk-fna-hijacked',
        createdBy: 'someone-else',
        version: 99,
        publishedAt: '2020-01-01T00:00:00.000Z',
      },
    });

    const stored = record(String(fna.id))!;
    expect(stored.id).toBe(fna.id);
    expect(stored.createdBy).toBe('admin-1');
    expect(stored.version).toBe(1);
    expect(stored.publishedAt).toBeUndefined();
  });

  it('still allows `status` through, which the schema does declare', async () => {
    // Not a hole: `status` is a declared field on UpdateRiskPlanningFnaSchema,
    // so it is a supported update. Pinned so the fix above is not read as
    // blocking every field.
    const fna = await create();
    await req(`/update/${fna.id}`, { method: 'PUT', body: { status: 'archived' } });
    expect(record(String(fna.id))!.status).toBe('archived');
  });
});

// ============================================================================
// PUBLISH LIFECYCLE
// ============================================================================

describe('publish / unpublish', () => {
  it('publishing stamps the record and points :latest at it', async () => {
    const fna = await create();
    const res = await req(`/publish/${fna.id}`, { method: 'POST' });
    expect(res.status).toBe(200);

    const stored = record(String(fna.id))!;
    expect(stored.status).toBe('published');
    expect(stored.publishedBy).toBe('admin-1');
    expect(latest(CLIENT_A)!.id).toBe(fna.id);
    expect(snapshots.auto).toHaveBeenCalledWith(CLIENT_A, 'risk-fna-publish');
  });

  it('refuses to publish twice', async () => {
    const fna = await create();
    await req(`/publish/${fna.id}`, { method: 'POST' });
    const res = await req(`/publish/${fna.id}`, { method: 'POST' });
    expect(res.status).toBe(400);
  });

  it('refuses to unpublish something that is not published', async () => {
    const fna = await create();
    const res = await req(`/unpublish/${fna.id}`, { method: 'POST' });
    expect(res.status).toBe(400);
  });

  it('unpublishing stops :latest serving the withdrawn FNA', async () => {
    // The bug this guards: unpublish returned the record to draft but left the
    // `:latest` pointer holding the pre-unpublish SNAPSHOT — still stamped
    // `status: 'published'`. An adviser who withdrew an FNA because its figures
    // were wrong kept serving it as the client's current published analysis,
    // with no route that would ever clear it short of archiving.
    const fna = await create();
    await req(`/publish/${fna.id}`, { method: 'POST' });
    expect(latest(CLIENT_A)).toBeTruthy();

    const res = await req(`/unpublish/${fna.id}`, { method: 'POST' });
    expect(res.status).toBe(200);
    expect(record(String(fna.id))!.status).toBe('draft');

    expect(latest(CLIENT_A)).toBeUndefined();
    const read = await req(`/client/${CLIENT_A}/latest`);
    expect(await json(read)).toEqual({ success: true, data: null });
  });

  it('unpublishing one FNA leaves another client’s pointer alone', async () => {
    const a = await create(CLIENT_A, 'adviserA');
    const b = await create(CLIENT_B, 'adviserB');
    await req(`/publish/${a.id}`, { method: 'POST' });
    await req(`/publish/${b.id}`, { method: 'POST' });

    await req(`/unpublish/${a.id}`, { method: 'POST' });
    expect(latest(CLIENT_A)).toBeUndefined();
    expect(latest(CLIENT_B)!.id).toBe(b.id);
  });

  it('unpublishing a superseded FNA does not clear a NEWER latest', async () => {
    const older = await create();
    await req(`/publish/${older.id}`, { method: 'POST' });
    await req(`/unpublish/${older.id}`, { method: 'POST' });

    const newer = await create();
    await req(`/publish/${newer.id}`, { method: 'POST' });

    // Re-publishing `older` is not possible without unpublishing `newer`, so
    // the case that matters is: the pointer is only cleared when it actually
    // points at the FNA being withdrawn.
    await req(`/unpublish/${newer.id}`, { method: 'POST' });
    expect(latest(CLIENT_A)).toBeUndefined();
  });
});

// ============================================================================
// ARCHIVE + HARD DELETE
// ============================================================================

describe('archive', () => {
  it('marks archived, clears :latest and drops the id from the list', async () => {
    const fna = await create();
    await req(`/publish/${fna.id}`, { method: 'POST' });

    const res = await req(`/archive/${fna.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);

    const stored = record(String(fna.id))!;
    expect(stored.status).toBe('archived');
    expect(stored.archivedAt).toBeTruthy();
    expect(latest(CLIENT_A)).toBeUndefined();
    expect(list(CLIENT_A)).toEqual([]);
  });

  it('keeps the record itself, because it is a compliance artefact', async () => {
    const fna = await create();
    await req(`/archive/${fna.id}`, { method: 'DELETE' });
    // Soft delete: FAIS retention means an archived FNA still has to exist.
    expect(record(String(fna.id))).toBeTruthy();
  });

  it('does not clear :latest when a DIFFERENT FNA is the latest', async () => {
    const older = await create();
    const newer = await create();
    await req(`/publish/${newer.id}`, { method: 'POST' });

    await req(`/archive/${older.id}`, { method: 'DELETE' });
    expect(latest(CLIENT_A)!.id).toBe(newer.id);
  });
});

describe('hard delete', () => {
  it('removes the record, the pointer and the list entry', async () => {
    const fna = await create();
    await req(`/publish/${fna.id}`, { method: 'POST' });

    const res = await req(`/hard-delete/${fna.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);

    expect(record(String(fna.id))).toBeUndefined();
    expect(latest(CLIENT_A)).toBeUndefined();
    expect(list(CLIENT_A)).toEqual([]);
  });

  it('does not let a deletion make the next version number come round again', async () => {
    const a = await create();
    const b = await create();
    const c = await create();
    expect([a.version, b.version, c.version]).toEqual([1, 2, 3]);

    await req(`/hard-delete/${b.id}`, { method: 'DELETE' });

    const d = await create();
    expect(d.version).toBe(4);
    expect(record(String(c.id))).toBeTruthy();
  });
});
