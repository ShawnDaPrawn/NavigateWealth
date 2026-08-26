/**
 * integrations-portal-jobs-routes.ts — Creation, Latest Pointer & History
 * ======================================================================
 *
 * How a portal job comes into existence and how the SPA finds it again.
 *
 *   - **Creation** runs six refusals before a robot touches a provider portal:
 *     missing ids, a parent category, an unknown provider, a credential profile
 *     the flow does not define, credentials that were never saved, and an empty
 *     policy queue. Each one exists because the alternative is a GitHub Actions
 *     run that burns a login attempt and leaves a stuck job on screen. A failed
 *     dispatch, by contrast, is deliberately NOT fatal — the queue is already
 *     built and persisted by then.
 *   - **The latest pointer** is what the dashboard polls. It is self-healing: a
 *     pointer that cannot resolve is deleted rather than returned again, because
 *     a stuck pointer is a permanently wrong dashboard.
 *   - **History** is a prefix scan over `portal-job:`, which also returns the
 *     `portal-job:latest:*` pointer records — so the shape filter that drops
 *     them is load-bearing, not defensive.
 *
 * Shares `helpers/portal-jobs-harness.ts` with the other portal-job suites.
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
  JOB,
  OTHER_CATEGORY,
  OTHER_PROVIDER,
  PROVIDER,
  resetPortalJobMocks,
  runtime,
  seedCreatePrerequisites,
  seedJob,
  seedLatestPointer,
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

/**
 * `normaliseRunMode` is pure and belongs to the contract under test, so the
 * real one is kept; only the GitHub Actions dispatch and the storage upload are
 * replaced.
 */
vi.mock('../integrations-portal-runtime.ts', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const { runtime: rt } = await import('./helpers/portal-jobs-harness.ts');
  return {
    ...actual,
    dispatchPortalGitHubAction: rt.dispatch,
    uploadPortalLiveView: rt.uploadLiveView,
  };
});

/** Role-aware `requireAdmin`, mirroring the shipped 401/403 split. */
vi.mock('../auth-mw.ts', async () => ({
  requireAdmin: (await import('./helpers/contract-harness.ts')).makeRoleGate(
    ['admin', 'super_admin', 'super-admin'],
    'FORBIDDEN',
  ),
}));

const app = (await import('../integrations-portal-jobs-routes.ts')).default;

/** See `contract-harness.ts` for why the `File` global has to be realigned. */
beforeAll(async () => {
  await alignFileGlobal();
});

const req = (path: string, opts: RequestOptions = {}) =>
  request(app, path, { as: 'admin', ...opts });

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  resetPortalJobMocks();
});

// ============================================================================
// JOB CREATION — six refusals before a robot touches a provider portal
// ============================================================================

const CREATE = '/portal-jobs';

describe('job creation', () => {
  it('queues a job, builds the policy queue and dispatches the worker', async () => {
    seedCreatePrerequisites();
    const res = await req(CREATE, {
      method: 'POST',
      body: { providerId: PROVIDER, categoryId: CATEGORY },
    });
    expect(res.status).toBe(200);
    const { job } = await res.json();
    expect(job).toMatchObject({
      providerId: PROVIDER,
      providerName: 'Allan Gray',
      categoryId: CATEGORY,
      status: 'queued',
      automationHost: 'github_actions',
      credentialProfileId: 'allan-gray-env',
    });
    expect(job.queueSummary).toMatchObject({ total: 1, queued: 1 });
    expect(runtime.dispatch).toHaveBeenCalledTimes(1);

    // The three KV rows the rest of the module reads back.
    expect(kvStore.has(`portal-job:${job.id}`)).toBe(true);
    expect(kvStore.get(`portal-job-items:${job.id}`)).toHaveLength(1);
    expect(kvStore.get(`portal-job:latest:${PROVIDER}:${CATEGORY}`)).toMatchObject({
      jobId: job.id,
    });
  });

  it('never returns the stored portal password', async () => {
    // The response carries the resolved flow, which names the credential
    // profile and its env vars. Those are NAMES. The username and password
    // themselves live in a separate KV record and must not travel with it.
    seedCreatePrerequisites();
    const res = await req(CREATE, {
      method: 'POST',
      body: { providerId: PROVIDER, categoryId: CATEGORY },
    });
    const payload = JSON.stringify(await res.json());
    expect(payload).not.toContain('portal-pa55word');
    expect(payload).not.toContain('firm@example.co.za');
  });

  it.each([
    ['no providerId', { categoryId: CATEGORY }],
    ['no categoryId', { providerId: PROVIDER }],
    ['an empty providerId', { providerId: '', categoryId: CATEGORY }],
    ['neither', {}],
  ])('refuses a request with %s', async (_label, body) => {
    const res = await req(CREATE, { method: 'POST', body });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Missing providerId or categoryId');
    expect(runtime.dispatch).not.toHaveBeenCalled();
  });

  it.each([
    [
      'retirement_planning',
      'Retirement Planning is a parent category. Portal automation can only run for Pre-Retirement or Post-Retirement.',
    ],
    [
      'investments',
      'Investments is a parent category. Portal automation can only run for Voluntary Investments or Guaranteed Investments.',
    ],
    [
      'nonsense',
      'Portal automation can only run for specific product subcategories. Select a supported category before starting a job.',
    ],
  ])('refuses the %s category by name', async (categoryId, message) => {
    seedCreatePrerequisites();
    const res = await req(CREATE, { method: 'POST', body: { providerId: PROVIDER, categoryId } });
    expect(res.status).toBe(400);
    // A parent category would silently run against the wrong product set, so
    // the refusal says which subcategory to pick instead of "invalid".
    expect((await res.json()).error).toBe(message);
    expect(runtime.dispatch).not.toHaveBeenCalled();
  });

  it.each([
    'risk_planning',
    'medical_aid',
    'retirement_pre',
    'retirement_post',
    'investments_voluntary',
    'investments_guaranteed',
    'employee_benefits',
    'tax_planning',
    'estate_planning',
  ])('allows the %s subcategory past the category guard', async (categoryId) => {
    seedCreatePrerequisites({ categoryId });
    const res = await req(CREATE, { method: 'POST', body: { providerId: PROVIDER, categoryId } });
    expect(res.status).toBe(200);
  });

  it('refuses a provider that is not in KV', async () => {
    const res = await req(CREATE, {
      method: 'POST',
      body: { providerId: 'ghost-provider', categoryId: CATEGORY },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid provider ID');
  });

  it('refuses a credential profile the flow does not define', async () => {
    seedCreatePrerequisites();
    const res = await req(CREATE, {
      method: 'POST',
      body: { providerId: PROVIDER, categoryId: CATEGORY, credentialProfileId: 'someone-elses' },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid credential profile');
    expect(runtime.dispatch).not.toHaveBeenCalled();
  });

  it.each([
    ['nothing saved', null],
    ['a username but no password', { username: 'firm@example.co.za', password: '' }],
    ['a password but no username', { username: '', password: 'portal-pa55word' }],
  ])('refuses to start with %s', async (_label, credentials) => {
    seedCreatePrerequisites({ credentials: credentials as never });
    const res = await req(CREATE, {
      method: 'POST',
      body: { providerId: PROVIDER, categoryId: CATEGORY },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(
      'Save the provider portal username and password before creating a portal job',
    );
    // A job dispatched without credentials would fail at the login page after
    // burning a GitHub Actions run and leaving a stuck job on screen.
    expect(runtime.dispatch).not.toHaveBeenCalled();
  });

  it('refuses when no client policy carries a policy number', async () => {
    seedCreatePrerequisites({ policyNumber: '' });
    const res = await req(CREATE, {
      method: 'POST',
      body: { providerId: PROVIDER, categoryId: CATEGORY },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('No active Allan Gray policies with policy numbers');
    expect(runtime.dispatch).not.toHaveBeenCalled();
    // Nothing persisted — a queued job with an empty queue would sit on the
    // dashboard forever.
    expect([...kvStore.keys()].some((k) => k.startsWith('portal-job:'))).toBe(false);
  });

  it('skips archived policies and policies of other providers', async () => {
    seedCreatePrerequisites();
    kvStore.set(`policies:client:${CLIENT}`, [
      {
        id: 'a',
        clientId: CLIENT,
        providerId: PROVIDER,
        categoryId: CATEGORY,
        archived: true,
        data: { policy_number: 'AG-1' },
      },
      {
        id: 'b',
        clientId: CLIENT,
        providerId: OTHER_PROVIDER,
        categoryId: CATEGORY,
        archived: false,
        data: { policy_number: 'BR-1' },
      },
      {
        id: 'c',
        clientId: CLIENT,
        providerId: PROVIDER,
        categoryId: OTHER_CATEGORY,
        archived: false,
        data: { policy_number: 'AG-2' },
      },
      {
        id: 'd',
        clientId: CLIENT,
        providerId: PROVIDER,
        categoryId: CATEGORY,
        archived: false,
        data: { policy_number: 'AG-3' },
      },
    ]);
    const res = await req(CREATE, {
      method: 'POST',
      body: { providerId: PROVIDER, categoryId: CATEGORY },
    });
    const { job } = await res.json();
    expect(job.queueSummary.total).toBe(1);
    const items = kvStore.get(`portal-job-items:${job.id}`) as { policyNumber: string }[];
    expect(items.map((i) => i.policyNumber)).toEqual(['AG-3']);
  });

  it('keeps the job when the GitHub dispatch fails, and says so', async () => {
    // The queue is already built and persisted at this point. Failing the
    // request would throw that away and leave orphaned KV rows; instead the
    // job falls back to a manual host with the reason attached.
    seedCreatePrerequisites();
    runtime.dispatch.mockRejectedValue(new Error('workflow_dispatch: 404 Not Found'));
    const res = await req(CREATE, {
      method: 'POST',
      body: { providerId: PROVIDER, categoryId: CATEGORY },
    });
    expect(res.status).toBe(200);
    const { job } = await res.json();
    expect(job.automationHost).toBe('manual');
    expect(job.actionsDispatchError).toContain('workflow_dispatch: 404 Not Found');
    expect(job.message).toContain('GitHub Actions did not start');
    expect(kvStore.get(`portal-job:${job.id}`)).toMatchObject({ automationHost: 'manual' });
  });

  it('truncates a runaway dispatch error rather than storing it whole', async () => {
    seedCreatePrerequisites();
    runtime.dispatch.mockRejectedValue(new Error('x'.repeat(4000)));
    const res = await req(CREATE, {
      method: 'POST',
      body: { providerId: PROVIDER, categoryId: CATEGORY },
    });
    const { job } = await res.json();
    expect(job.actionsDispatchError).toHaveLength(500);
    expect(job.message).toHaveLength(500);
  });

  it('reports an unexpected failure as a 500 with the reason', async () => {
    seedCreatePrerequisites();
    // No policy-number field in the configured schema — the queue builder
    // throws, which is the only path into this module's catch-all 500.
    kvStore.set(`config:schema:${CATEGORY}`, {
      categoryId: CATEGORY,
      fields: [{ id: 'premium', name: 'Premium', type: 'currency' }],
    });
    const res = await req(CREATE, {
      method: 'POST',
      body: { providerId: PROVIDER, categoryId: CATEGORY },
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain('Failed to create portal job');
  });
});
// ============================================================================
// LATEST — a self-healing pointer
// ============================================================================

const latestPath = (providerId = PROVIDER, categoryId = CATEGORY) =>
  `/portal-jobs/latest?providerId=${providerId}&categoryId=${categoryId}`;

describe('latest job', () => {
  it('returns the job the pointer names', async () => {
    seedJob();
    seedLatestPointer();
    const res = await req(latestPath());
    expect(res.status).toBe(200);
    expect((await res.json()).job.id).toBe(JOB);
  });

  it('reports no job when no pointer exists', async () => {
    const res = await req(latestPath());
    expect(await res.json()).toEqual({ success: true, job: null });
  });

  it.each([
    ['the job it names was deleted', () => seedLatestPointer()],
    [
      'the job it names belongs to another provider',
      () => {
        seedJob(JOB, { providerId: OTHER_PROVIDER });
        seedLatestPointer();
      },
    ],
    [
      'the job it names belongs to another category',
      () => {
        seedJob(JOB, { categoryId: OTHER_CATEGORY });
        seedLatestPointer();
      },
    ],
  ])('clears a stale pointer when %s', async (_label, seed) => {
    seed();
    const res = await req(latestPath());
    expect(await res.json()).toEqual({ success: true, job: null });
    // Self-healing: a pointer that cannot resolve is removed rather than
    // returned again on the next poll. The SPA polls this route, so a stuck
    // pointer would be a permanently wrong dashboard.
    expect(kvStore.has(`portal-job:latest:${PROVIDER}:${CATEGORY}`)).toBe(false);
  });

  it('discards an investments job whose queue is actually retirement annuities', async () => {
    // Cross-category contamination guard: an RA policy pulled under an
    // investments job would write annuity values onto investment records.
    seedJob(JOB, { categoryId: 'investments_voluntary' });
    seedLatestPointer(JOB, PROVIDER, 'investments_voluntary');
    kvStore.set(`portal-job-items:${JOB}`, [
      { id: 'i1', rawData: { productName: 'Retirement Annuity Fund' } },
    ]);
    const res = await req(latestPath(PROVIDER, 'investments_voluntary'));
    expect(await res.json()).toEqual({ success: true, job: null });
    expect(kvStore.has(`portal-job:latest:${PROVIDER}:investments_voluntary`)).toBe(false);
  });

  it('keeps an investments job whose queue carries no annuity marker', async () => {
    seedJob(JOB, { categoryId: 'investments_voluntary' });
    seedLatestPointer(JOB, PROVIDER, 'investments_voluntary');
    kvStore.set(`portal-job-items:${JOB}`, [
      { id: 'i1', rawData: { productName: 'Balanced Fund' } },
    ]);
    const res = await req(latestPath(PROVIDER, 'investments_voluntary'));
    expect((await res.json()).job.id).toBe(JOB);
  });

  it('does not apply the annuity guard outside the investment categories', async () => {
    // A risk_planning job mentioning "retirement annuity" in a policy name is
    // not contamination — the guard is scoped to investments on purpose.
    seedJob();
    seedLatestPointer();
    kvStore.set(`portal-job-items:${JOB}`, [
      { id: 'i1', rawData: { productName: 'Retirement Annuity Fund' } },
    ]);
    const res = await req(latestPath());
    expect((await res.json()).job.id).toBe(JOB);
  });

  it('reads the staged run instead of the queue once a job has staged', async () => {
    seedJob(JOB, { stagedRunId: 'run-1', categoryId: 'investments_voluntary' });
    seedLatestPointer(JOB, PROVIDER, 'investments_voluntary');
    kvStore.set('sync-run:run-1', {
      id: 'run-1',
      providerId: PROVIDER,
      categoryId: 'investments_voluntary',
      rows: [{ rawData: { fund: 'Balanced' }, mappedData: {}, diffs: [] }],
    });
    const res = await req(latestPath(PROVIDER, 'investments_voluntary'));
    expect((await res.json()).job.id).toBe(JOB);
  });

  it('discards a staged run that turns out to hold annuities', async () => {
    seedJob(JOB, { stagedRunId: 'run-1', categoryId: 'investments_voluntary' });
    seedLatestPointer(JOB, PROVIDER, 'investments_voluntary');
    kvStore.set('sync-run:run-1', {
      id: 'run-1',
      providerId: PROVIDER,
      categoryId: 'investments_voluntary',
      rows: [{ rawData: { product: 'retirement annuity' }, mappedData: {}, diffs: [] }],
    });
    const res = await req(latestPath(PROVIDER, 'investments_voluntary'));
    expect(await res.json()).toEqual({ success: true, job: null });
  });

  it.each([
    ['no providerId', '/portal-jobs/latest?categoryId=risk_planning'],
    ['no categoryId', `/portal-jobs/latest?providerId=${PROVIDER}`],
  ])('refuses a request with %s', async (_label, path) => {
    const res = await req(path);
    expect(res.status).toBe(400);
  });
});
// ============================================================================
// HISTORY — a prefix scan that must not return its own pointers
// ============================================================================

const historyPath = (extra = '') =>
  `/portal-jobs/history?providerId=${PROVIDER}&categoryId=${CATEGORY}${extra}`;

describe('job history', () => {
  it('drops the latest-pointer records the prefix scan also returns', async () => {
    // `portal-job:latest:*` shares the `portal-job:` prefix and holds
    // `{ jobId, updatedAt }` — no `id`, no `status`. Without the shape filter
    // those pointers appear in the history list as blank rows.
    seedJob('j1', { createdAt: '2026-01-01T00:00:00.000Z' });
    seedLatestPointer('j1');
    kvStore.set(`portal-job-items:j1`, [{ id: 'x' }]);
    const res = await req(historyPath());
    const { jobs } = await res.json();
    expect(jobs.map((j: { id: string }) => j.id)).toEqual(['j1']);
  });

  it('returns only jobs for the requested provider and category', async () => {
    seedJob('mine', { createdAt: '2026-01-03T00:00:00.000Z' });
    seedJob('other-provider', {
      providerId: OTHER_PROVIDER,
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    seedJob('other-category', {
      categoryId: OTHER_CATEGORY,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const { jobs } = await (await req(historyPath())).json();
    expect(jobs.map((j: { id: string }) => j.id)).toEqual(['mine']);
  });

  it('returns the newest job first', async () => {
    seedJob('old', { createdAt: '2026-01-01T00:00:00.000Z' });
    seedJob('newest', { createdAt: '2026-03-01T00:00:00.000Z' });
    seedJob('middle', { createdAt: '2026-02-01T00:00:00.000Z' });
    const { jobs } = await (await req(historyPath())).json();
    expect(jobs.map((j: { id: string }) => j.id)).toEqual(['newest', 'middle', 'old']);
  });

  it('defaults to twenty entries', async () => {
    for (let i = 0; i < 25; i += 1) {
      seedJob(`j${i}`, { createdAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z` });
    }
    const { jobs } = await (await req(historyPath())).json();
    expect(jobs).toHaveLength(20);
  });

  it.each([
    ['5', 5],
    ['50', 50],
    ['1', 1],
    ['0', 20],
    ['-3', 1],
    ['999', 50],
    ['abc', 20],
    ['', 20],
  ])('clamps a limit of %p to %i', async (limit, expected) => {
    // `Math.min(Math.max(Number(limit) || 20, 1), 50)`. Two different
    // mechanisms, and they land in different places: `0`, `''` and `abc` are
    // falsy (or NaN) so they take the `|| 20` default, while `-3` is truthy and
    // survives to `Math.max(-3, 1)` — a negative limit returns ONE row, not
    // twenty. Both are pinned because the expression reads as if it had a
    // single floor.
    for (let i = 0; i < 60; i += 1) {
      seedJob(`j${i}`, { createdAt: `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z` });
    }
    const { jobs } = await (await req(historyPath(`&limit=${limit}`))).json();
    expect(jobs).toHaveLength(expected);
  });

  it('returns a summary shape, not the whole job record', async () => {
    seedJob('j1', {
      warnings: ['older', 'newest'],
      queueSummary: { total: 3, queued: 1, inProgress: 0, completed: 2, failed: 0, skipped: 0 },
      credentialProfileId: 'allan-gray-env',
      flowId: 'flow-1',
    });
    const { jobs } = await (await req(historyPath())).json();
    expect(jobs[0]).toMatchObject({
      id: 'j1',
      status: 'running',
      // `latestPortalWarning(job.warnings) || job.warning` — the newest wins.
      warning: 'newest',
      queueSummary: { total: 3, completed: 2 },
    });
    // History is a list view; the flow and credential wiring belong to the job
    // detail route, not to every row of a dropdown.
    expect(jobs[0]).not.toHaveProperty('flowId');
    expect(jobs[0]).not.toHaveProperty('credentialProfileId');
  });

  it('falls back to the singular warning when no history array exists', async () => {
    seedJob('j1', { warning: 'legacy single warning' });
    const { jobs } = await (await req(historyPath())).json();
    expect(jobs[0].warning).toBe('legacy single warning');
  });

  it('returns an empty list rather than 404 when nothing matches', async () => {
    const res = await req(historyPath());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, jobs: [] });
  });

  it.each([
    ['no providerId', '/portal-jobs/history?categoryId=risk_planning'],
    ['no categoryId', `/portal-jobs/history?providerId=${PROVIDER}`],
  ])('refuses a request with %s', async (_label, path) => {
    expect((await req(path)).status).toBe(400);
  });
});
