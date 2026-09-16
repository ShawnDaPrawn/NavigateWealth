/**
 * integrations-portal-jobs-routes.ts — Per-Policy Refresh Scope
 * =============================================================
 *
 * Until now the smallest unit of portal work was every policy a provider has in
 * a category. An adviser looking at one stale value had no way to say "just
 * refresh this one", which is the single biggest reason the module reads as a
 * batch tool rather than something you use on a client record.
 *
 * `POST /portal-jobs` now takes an optional `policyIds`. This suite pins the
 * three properties that matter:
 *
 *   1. **Absent means everything.** Every existing caller omits the field, so
 *      omitting it must queue exactly what it queued before.
 *   2. **Present means only those.** A scoped run must not quietly widen back
 *      to the whole book — that would hit provider portals far harder than the
 *      adviser asked for, and stage rows nobody reviewed.
 *   3. **Scope cannot cross the provider/category boundary.** A policy id from
 *      another provider must not be pulled in just because it was named.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import {
  alignFileGlobal,
  kvStore,
  request,
  type RequestOptions,
} from './helpers/contract-harness.ts';
import {
  CATEGORY,
  CLIENT,
  PROVIDER,
  resetPortalJobMocks,
  runtime,
  seedCreatePrerequisites,
} from './helpers/portal-jobs-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: (k: string) => (k === 'NW_PORTAL_WORKER_SECRET' ? 'worker-secret' : 'test') },
  };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

vi.mock('../integrations-portal-runtime.ts', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const { runtime: rt } = await import('./helpers/portal-jobs-harness.ts');
  return {
    ...actual,
    dispatchPortalGitHubAction: rt.dispatch,
    uploadPortalLiveView: rt.uploadLiveView,
  };
});

vi.mock('../auth-mw.ts', async () => ({
  requireAdmin: (await import('./helpers/contract-harness.ts')).makeRoleGate(
    ['admin', 'super_admin', 'super-admin'],
    'FORBIDDEN',
  ),
}));

const app = (await import('../integrations-portal-jobs-routes.ts')).default;

beforeAll(async () => {
  await alignFileGlobal();
});

const req = (path: string, opts: RequestOptions = {}) =>
  request(app, path, { as: 'admin', ...opts });

/** Three eligible policies on one client, so scoping is observable. */
function seedThreePolicies() {
  seedCreatePrerequisites();
  kvStore.set(`policies:client:${CLIENT}`, [
    {
      id: 'pol-1',
      clientId: CLIENT,
      providerId: PROVIDER,
      categoryId: CATEGORY,
      archived: false,
      data: { policy_number: 'AG-00001' },
    },
    {
      id: 'pol-2',
      clientId: CLIENT,
      providerId: PROVIDER,
      categoryId: CATEGORY,
      archived: false,
      data: { policy_number: 'AG-00002' },
    },
    {
      id: 'pol-3',
      clientId: CLIENT,
      providerId: PROVIDER,
      categoryId: CATEGORY,
      archived: false,
      data: { policy_number: 'AG-00003' },
    },
  ]);
}

const createJob = (body: Record<string, unknown>) =>
  req('/portal-jobs', {
    method: 'POST',
    body: { providerId: PROVIDER, categoryId: CATEGORY, ...body },
  });

/** The queued items the route persisted for the created job. */
function queuedItems(jobId: string) {
  return (kvStore.get(`portal-job-items:${jobId}`) ?? []) as Array<{ policyId: string }>;
}

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  resetPortalJobMocks();
});

describe('portal job scope — absent policyIds keeps the old behaviour', () => {
  it('queues every eligible policy when no scope is given', async () => {
    seedThreePolicies();
    const body = await (await createJob({})).json();

    expect(body.job.queueSummary.total).toBe(3);
    expect(
      queuedItems(body.job.id)
        .map((item) => item.policyId)
        .sort(),
    ).toEqual(['pol-1', 'pol-2', 'pol-3']);
    expect(body.job.scopedPolicyIds).toBeUndefined();
    expect(runtime.dispatch).toHaveBeenCalledTimes(1);
  });

  it('refuses a supplied-but-empty scope rather than widening it to everything', async () => {
    // Failing closed matters here: an empty scope that fell back to "the whole
    // book" would turn a malformed single-policy refresh into a sweep, and with
    // auto-publish on that writes to every matched policy.
    seedThreePolicies();
    const response = await createJob({ policyIds: [] });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('no usable policy id');
    expect(runtime.dispatch).not.toHaveBeenCalled();
  });

  it('refuses a scope of the wrong shape rather than widening it', async () => {
    seedThreePolicies();
    const response = await createJob({ policyIds: 'pol-1' });

    expect(response.status).toBe(400);
    expect(runtime.dispatch).not.toHaveBeenCalled();
  });

  it('refuses a scope whose every entry normalises away', async () => {
    seedThreePolicies();
    const response = await createJob({ policyIds: ['', '   ', null] });

    expect(response.status).toBe(400);
    expect(runtime.dispatch).not.toHaveBeenCalled();
  });
});

describe('portal job scope — a scoped refresh stays scoped', () => {
  it('queues only the named policy', async () => {
    seedThreePolicies();
    const body = await (await createJob({ policyIds: ['pol-2'] })).json();

    expect(body.job.queueSummary.total).toBe(1);
    expect(queuedItems(body.job.id).map((item) => item.policyId)).toEqual(['pol-2']);
  });

  it('records the scope on the job so the run is identifiable afterwards', async () => {
    seedThreePolicies();
    const body = await (await createJob({ policyIds: ['pol-2'] })).json();
    expect(body.job.scopedPolicyIds).toEqual(['pol-2']);
  });

  it('says the run is a refresh of the selection, not a whole-book sweep', async () => {
    seedThreePolicies();
    const body = await (await createJob({ policyIds: ['pol-2'] })).json();
    expect(body.job.message).toContain('Refreshing 1 selected policy');
  });

  it('queues several when several are named', async () => {
    seedThreePolicies();
    const body = await (await createJob({ policyIds: ['pol-1', 'pol-3'] })).json();
    expect(
      queuedItems(body.job.id)
        .map((item) => item.policyId)
        .sort(),
    ).toEqual(['pol-1', 'pol-3']);
  });

  it('ignores blank entries rather than widening to everything', async () => {
    seedThreePolicies();
    const body = await (await createJob({ policyIds: ['pol-1', '', '   '] })).json();
    expect(queuedItems(body.job.id).map((item) => item.policyId)).toEqual(['pol-1']);
  });
});

describe('portal job scope — the provider boundary still holds', () => {
  it('will not queue a policy belonging to another provider', async () => {
    seedThreePolicies();
    kvStore.set(`policies:client:${CLIENT}`, [
      {
        id: 'pol-other',
        clientId: CLIENT,
        providerId: 'someone-else',
        categoryId: CATEGORY,
        archived: false,
        data: { policy_number: 'XX-1' },
      },
    ]);

    const response = await createJob({ policyIds: ['pol-other'] });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('could not be queued');
  });

  it('will not queue an archived policy', async () => {
    seedThreePolicies();
    kvStore.set(`policies:client:${CLIENT}`, [
      {
        id: 'pol-archived',
        clientId: CLIENT,
        providerId: PROVIDER,
        categoryId: CATEGORY,
        archived: true,
        data: { policy_number: 'AG-9' },
      },
    ]);

    expect((await createJob({ policyIds: ['pol-archived'] })).status).toBe(400);
  });

  it('does not dispatch a worker when the scope matches nothing', async () => {
    seedThreePolicies();
    await createJob({ policyIds: ['no-such-policy'] });
    expect(runtime.dispatch).not.toHaveBeenCalled();
  });
});
