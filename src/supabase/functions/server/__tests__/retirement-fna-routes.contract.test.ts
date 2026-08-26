/**
 * retirement-fna-routes.tsx — Route Contract Tests
 * ================================================
 *
 * Eight routes, 142 statements uncovered. Same family and same harness as the
 * risk and tax suites; `client-access.ts` runs for real and only the
 * adviser-assignment lookup is stubbed.
 *
 * This file exists as much to cover the version fix as to cover the routes.
 * `getNextVersionNumber` here prefix-scanned `retirement_fna:${clientId}:`,
 * which holds the `:latest` and `:list` bookkeeping keys and never a session —
 * records live at `retirement_fna:${fnaId}` with a uuid id. The number an
 * adviser saw was therefore a function of which bookkeeping keys existed, not
 * of how many retirement analyses the client had.
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
  retirementAutoPopulateFromResolver: vi.fn(async () => ({ currentAge: 41, retirementAge: 65 })),
}));
vi.mock('../form-prefill-auto-populate.ts', () => prefill);

import { kvStore } from './helpers/contract-harness.ts';
import { resetFnaHarness, seedFnaUser, fnaAssignments } from './helpers/fna-routes-harness.ts';

const app = (await import('../retirement-fna-routes.tsx')).default;

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

async function create(clientId = CLIENT_A, as: keyof typeof TOKENS = 'admin') {
  const res = await req('/create', { method: 'POST', as, body: { clientId } });
  expect(res.status).toBe(200);
  return ((await json(res)) as unknown as { data: Record<string, never> }).data;
}

const record = (fnaId: string) =>
  kvStore.get(`retirement_fna:${fnaId}`) as Record<string, never> | undefined;
const latest = (clientId: string) =>
  kvStore.get(`retirement_fna:${clientId}:latest`) as Record<string, never> | undefined;
const list = (clientId: string) =>
  (kvStore.get(`retirement_fna:${clientId}:list`) as string[] | undefined) ?? [];

/** Enough for `performCalculations` to produce real numbers. */
const INPUTS = {
  currentAge: 41,
  retirementAge: 65,
  currentMonthlyIncome: 68_000,
  currentRetirementSavings: 1_250_000,
  currentMonthlyContribution: 11_500,
  yearsInRetirement: 25,
  inflationRate: 6,
  preRetirementReturn: 11,
  postRetirementReturn: 8,
  salaryEscalation: 6,
};

beforeEach(() => {
  kvStore.clear();
  resetFnaHarness();
  for (const [token, user] of Object.entries(TOKENS)) seedFnaUser(token, user);
  fnaAssignments.set(CLIENT_A, ADVISER_A);
  fnaAssignments.set(CLIENT_B, ADVISER_B);
  prefill.retirementAutoPopulateFromResolver.mockClear();
});

// ============================================================================
// AUTHORIZATION
// ============================================================================

describe('authorization', () => {
  const CLIENT_SCOPED: Array<[string, string]> = [
    ['GET', `/client/${CLIENT_A}`],
    ['GET', `/client/${CLIENT_A}/latest-published`],
    ['GET', `/client/${CLIENT_A}/auto-populate`],
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

  it('POST /create denies an adviser who does not hold the client', async () => {
    const res = await req('/create', {
      method: 'POST',
      as: 'adviserB',
      body: { clientId: CLIENT_A },
    });
    expect(res.status).toBe(403);
    expect(list(CLIENT_A)).toEqual([]);
  });

  const RECORD_SCOPED: Array<[string, (id: string) => string, unknown?]> = [
    ['GET', (id: string) => `/${id}`, undefined],
    ['PUT', (id: string) => `/${id}/inputs`, { currentAge: 50 }],
    ['POST', (id: string) => `/${id}/calculate`, undefined],
    ['PUT', (id: string) => `/${id}/publish`, undefined],
  ];

  it.each(RECORD_SCOPED)(
    "%s on a record denies another client's adviser",
    async (method, path, body) => {
      const fna = await create(CLIENT_A, 'adviserA');
      const res = await req(path(String(fna.id)), { method, as: 'adviserB', body });
      expect(res.status).toBe(403);
    },
  );

  it.each(RECORD_SCOPED)('%s on an unknown record is a 404', async (method, path, body) => {
    expect((await req(path('retirement-fna-nope'), { method, body })).status).toBe(404);
  });

  it('admits the client for their own sessions', async () => {
    expect((await req(`/client/${CLIENT_A}`, { as: 'clientA' })).status).toBe(200);
  });
});

// ============================================================================
// CREATE + VERSIONING
// ============================================================================

describe('POST /create', () => {
  it('stores a draft and appends its id to the client list', async () => {
    const fna = await create();
    expect(fna.status).toBe('draft');
    expect(fna.results).toBeNull();
    expect(record(String(fna.id))).toBeTruthy();
    expect(list(CLIENT_A)).toEqual([fna.id]);
  });

  it('rejects a non-uuid clientId', async () => {
    const res = await req('/create', { method: 'POST', body: { clientId: 'nope' } });
    expect(res.status).toBe(400);
  });

  it('numbers versions from the client’s OWN sessions, one per create', async () => {
    // The regression: the old prefix scan matched only `:latest` and `:list`,
    // so this came out 1, then 2 for every create after the first, then 3 once
    // anything was published.
    const a = await create();
    const b = await create();
    const c = await create();
    expect([a.version, b.version, c.version]).toEqual([1, 2, 3]);

    await req(`/${a.id}/publish`, { method: 'PUT' });
    const d = await create();
    expect(d.version).toBe(4);
  });

  it('counts each client separately', async () => {
    await create(CLIENT_A, 'adviserA');
    await create(CLIENT_A, 'adviserA');
    expect((await create(CLIENT_B, 'adviserB')).version).toBe(1);
  });

  it('tolerates a list entry whose record has gone missing', async () => {
    // `mget` returns null for a dangling id. A version read must not throw on
    // one, or a single orphaned list entry would block every future create.
    const a = await create();
    kvStore.delete(`retirement_fna:${a.id}`);
    expect(list(CLIENT_A)).toEqual([a.id]);

    const b = await create();
    expect(b.version).toBe(1);
  });
});

// ============================================================================
// LIFECYCLE
// ============================================================================

describe('lifecycle', () => {
  it('merges input updates rather than replacing the inputs wholesale', async () => {
    const fna = await create();
    await req(`/${fna.id}/inputs`, { method: 'PUT', body: { currentAge: 41 } });
    await req(`/${fna.id}/inputs`, { method: 'PUT', body: { retirementAge: 65 } });

    const stored = record(String(fna.id))!;
    expect(stored.inputs).toEqual({ currentAge: 41, retirementAge: 65 });
  });

  it('rejects an empty input update', async () => {
    const fna = await create();
    expect((await req(`/${fna.id}/inputs`, { method: 'PUT', body: {} })).status).toBe(400);
  });

  it('calculates from the stored inputs and persists the result', async () => {
    const fna = await create();
    await req(`/${fna.id}/inputs`, { method: 'PUT', body: INPUTS });

    const res = await req(`/${fna.id}/calculate`, { method: 'POST' });
    expect(res.status).toBe(200);

    const stored = record(String(fna.id))!;
    expect(stored.results).toBeTruthy();
    expect(stored.results).not.toBeNull();
  });

  it('publishing stamps the record and points :latest at it', async () => {
    const fna = await create();
    const res = await req(`/${fna.id}/publish`, { method: 'PUT' });
    expect(res.status).toBe(200);

    const stored = record(String(fna.id))!;
    expect(stored.status).toBe('published');
    expect(stored.publishedBy).toBe('admin-1');
    expect(latest(CLIENT_A)!.id).toBe(fna.id);
  });

  it('publishing a second session moves the pointer', async () => {
    const first = await create();
    const second = await create();
    await req(`/${first.id}/publish`, { method: 'PUT' });
    await req(`/${second.id}/publish`, { method: 'PUT' });
    expect(latest(CLIENT_A)!.id).toBe(second.id);
  });
});

// ============================================================================
// READS
// ============================================================================

describe('reads', () => {
  it('GET /client/:clientId returns the client’s sessions, newest update first', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.parse('2026-03-01T09:00:00.000Z'));
      const older = await create();
      vi.setSystemTime(Date.parse('2026-03-01T09:05:00.000Z'));
      const newer = await create();

      const res = await req(`/client/${CLIENT_A}`);
      const { data } = (await json(res)) as unknown as { data: Array<{ id: string }> };
      expect(data.map((s) => s.id)).toEqual([newer.id, older.id]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('GET /client/:clientId does not leak another client’s sessions', async () => {
    await create(CLIENT_B, 'adviserB');
    const res = await req(`/client/${CLIENT_A}`, { as: 'adviserA' });
    expect(((await json(res)) as unknown as { data: unknown[] }).data).toEqual([]);
  });

  it('GET /:fnaId authorizes on the OWNER stored on the record', async () => {
    const fna = await create(CLIENT_B, 'adviserB');
    expect((await req(`/${fna.id}`, { as: 'adviserB' })).status).toBe(200);
    expect((await req(`/${fna.id}`, { as: 'adviserA' })).status).toBe(403);
  });

  it('GET /client/:clientId/latest-published returns the pointer once published', async () => {
    const fna = await create();
    await req(`/${fna.id}/publish`, { method: 'PUT' });

    const res = await req(`/client/${CLIENT_A}/latest-published`);
    const { data } = (await json(res)) as unknown as { data: { id: string } };
    expect(data.id).toBe(fna.id);
  });

  it('GET /client/:clientId/latest-published falls back to the list when the pointer is gone', async () => {
    const fna = await create();
    await req(`/${fna.id}/publish`, { method: 'PUT' });
    kvStore.delete(`retirement_fna:${CLIENT_A}:latest`);

    const res = await req(`/client/${CLIENT_A}/latest-published`);
    const { data } = (await json(res)) as unknown as { data: { id: string } | null };
    expect(data?.id).toBe(fna.id);
  });

  it('GET /client/:clientId/latest-published returns null when nothing is published', async () => {
    await create();
    const res = await req(`/client/${CLIENT_A}/latest-published`);
    expect(await json(res)).toEqual({ success: true, data: null });
  });

  it('GET /client/:clientId/auto-populate returns the resolver output', async () => {
    const res = await req(`/client/${CLIENT_A}/auto-populate`);
    expect(res.status).toBe(200);
    expect(prefill.retirementAutoPopulateFromResolver).toHaveBeenCalledWith(CLIENT_A);
  });
});
