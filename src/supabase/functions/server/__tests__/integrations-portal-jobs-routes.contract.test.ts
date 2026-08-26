/**
 * integrations-portal-jobs-routes.ts — Gate, Route Order & Job Scope
 * =================================================================
 *
 * Portal jobs are the robot that logs into a product provider's website AS THE
 * FIRM, with the firm's stored username and password, and writes what it finds
 * back onto client policy records. This file pins the three properties that
 * decide WHICH job a request is allowed to touch; the OTP relay, the job
 * lifecycle and the returned artifacts each have their own suite, and all four
 * share `helpers/portal-jobs-harness.ts`.
 *
 *   1. **The admin gate**, applied per route rather than as `app.use('*', ...)` —
 *      the shape where a route added later can ship ungated, because nothing
 *      fails when the middleware argument is left out.
 *   2. **Route order.** `/portal-jobs/latest` and `/portal-jobs/history` are
 *      registered before `/portal-jobs/:jobId` precisely so those words are not
 *      captured as job ids (§14.2, and there is a comment in the source saying
 *      so). Registration order is not visible at the call site.
 *   3. **Job scope.** Almost every route takes a `jobId` from the URL and an
 *      optional providerId/categoryId from the caller, and
 *      `getPortalJobScopeError` returns 409 when they disagree. That check is
 *      what stops the Allan Gray tab in the SPA from driving a BrightRock job —
 *      same admin, wrong provider, real policy writes.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import {
  alignFileGlobal,
  kvStore,
  request,
  routeRegistrations,
  type RequestOptions,
} from './helpers/contract-harness.ts';
import {
  ADMIN_ROLES,
  CATEGORY,
  FORBIDDEN_ROLES,
  JOB,
  OTHER_CATEGORY,
  OTHER_PROVIDER,
  PROVIDER,
  ROUTES,
  resetPortalJobMocks,
  runtime,
  screenshot,
  seedJob,
  type Route,
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

const call = (r: Route, opts: RequestOptions = {}) =>
  req(r.path, {
    method: r.method,
    ...(r.form ? { form: screenshot() } : r.body !== undefined ? { body: r.body } : {}),
    ...opts,
  });

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  resetPortalJobMocks();
});

// ============================================================================
// THE ADMIN GATE — 13 routes, gated one at a time
// ============================================================================

describe('admin gate', () => {
  it('covers every route the module registers', () => {
    const registered = routeRegistrations(app);
    // Each route registers twice — once for `requireAdmin`, once for the
    // handler — so the distinct method+path count is the route count. A route
    // registered WITHOUT `requireAdmin` appears once; the middleware count
    // below is what catches that.
    const distinct = new Set(registered.map((r) => `${r.method} ${r.path}`));
    expect(distinct.size).toBe(ROUTES.length);
    expect(registered).toHaveLength(ROUTES.length * 2);
  });

  it.each(ROUTES)('$method $path ($name) rejects an unauthenticated caller', async (r) => {
    const res = await call(r, { auth: false });
    expect(res.status).toBe(401);
  });

  describe.each(FORBIDDEN_ROLES)('as %s', (role) => {
    it.each(ROUTES)('$method $path ($name) is forbidden', async (r) => {
      const res = await call(r, { as: role });
      expect(res.status).toBe(403);
      // A refused request must not have reached the provider portal.
      expect(runtime.dispatch).not.toHaveBeenCalled();
      expect(runtime.uploadLiveView).not.toHaveBeenCalled();
    });
  });

  describe.each(ADMIN_ROLES)('as %s', (role) => {
    it.each(ROUTES)('$method $path ($name) passes the gate', async (r) => {
      seedJob();
      const res = await call(r, { as: role });
      // Past the gate: whatever the handler decides, it is not 401/403.
      expect([401, 403]).not.toContain(res.status);
    });
  });
});
// ============================================================================
// ROUTE ORDER — "latest" and "history" are words, not job ids
// ============================================================================

describe('route order', () => {
  it('serves /portal-jobs/latest from its own handler, not :jobId', async () => {
    // If `:jobId` were registered first it would match "latest" and return
    // "Portal job not found" (404) instead of the 400 the real handler gives
    // for a missing providerId. The distinction IS the test.
    const res = await req('/portal-jobs/latest');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Missing providerId or categoryId');
  });

  it('serves /portal-jobs/history from its own handler, not :jobId', async () => {
    const res = await req('/portal-jobs/history');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Missing providerId or categoryId');
  });

  it('still resolves a job whose id happens to be a suffix path', async () => {
    seedJob('items');
    const res = await req('/portal-jobs/items');
    expect(res.status).toBe(200);
    expect((await res.json()).job.id).toBe('items');
  });
});
// ============================================================================
// JOB SCOPE — 409 when the URL's job is not the caller's job
// ============================================================================

/**
 * Every route below reads the job by id and then checks it against a
 * provider/category the caller supplies — from the query string for GETs, from
 * the body for POSTs. That asymmetry is easy to get wrong in a refactor (read
 * the body's providerId on a GET and it is always undefined, which the guard
 * treats as "no opinion" and passes). Each route is asserted in both
 * directions: the wrong provider is refused, the right provider is allowed.
 */
const SCOPED: { name: string; method: string; path: string; via: 'query' | 'body' }[] = [
  { name: 'get job', method: 'GET', path: `/portal-jobs/${JOB}`, via: 'query' },
  { name: 'job items', method: 'GET', path: `/portal-jobs/${JOB}/items`, via: 'query' },
  {
    name: 'get discovery report',
    method: 'GET',
    path: `/portal-jobs/${JOB}/discovery-report`,
    via: 'query',
  },
  {
    name: 'retry item',
    method: 'POST',
    path: `/portal-jobs/${JOB}/items/item-1/retry`,
    via: 'body',
  },
  { name: 'submit otp', method: 'POST', path: `/portal-jobs/${JOB}/otp`, via: 'body' },
];

describe('job scope', () => {
  const scoped = (
    r: (typeof SCOPED)[number],
    providerId?: string,
    categoryId?: string,
    extra: Record<string, unknown> = {},
  ) => {
    const qs = new URLSearchParams();
    if (r.via === 'query') {
      if (providerId) qs.set('providerId', providerId);
      if (categoryId) qs.set('categoryId', categoryId);
    }
    const query = qs.toString();
    return req(`${r.path}${query ? `?${query}` : ''}`, {
      method: r.method,
      ...(r.method === 'POST'
        ? { body: r.via === 'body' ? { providerId, categoryId, ...extra } : extra }
        : {}),
    });
  };

  it.each(SCOPED)('$method $path ($name) refuses another provider with 409', async (r) => {
    seedJob();
    const res = await scoped(r, OTHER_PROVIDER, undefined, { otp: '123456' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(
      `Portal job belongs to provider ${PROVIDER}, not ${OTHER_PROVIDER}`,
    );
  });

  it.each(SCOPED)('$method $path ($name) refuses another category with 409', async (r) => {
    seedJob();
    const res = await scoped(r, undefined, OTHER_CATEGORY, { otp: '123456' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(
      `Portal job belongs to category ${CATEGORY}, not ${OTHER_CATEGORY}`,
    );
  });

  it.each(SCOPED)('$method $path ($name) allows the owning provider and category', async (r) => {
    seedJob();
    kvStore.set(`portal-job-items:${JOB}`, [
      { id: 'item-1', clientName: 'Thabo', policyNumber: 'AG-1', status: 'failed' },
    ]);
    const res = await scoped(r, PROVIDER, CATEGORY, { otp: '123456' });
    expect(res.status).toBe(200);
  });

  it.each(SCOPED)('$method $path ($name) treats no scope at all as no opinion', async (r) => {
    // An omitted providerId is "I did not say", not "any provider". Turning
    // that into a refusal would break every caller that only has a job id.
    seedJob();
    kvStore.set(`portal-job-items:${JOB}`, [
      { id: 'item-1', clientName: 'Thabo', policyNumber: 'AG-1', status: 'failed' },
    ]);
    const res = await scoped(r, undefined, undefined, { otp: '123456' });
    expect(res.status).toBe(200);
  });

  it('checks scope only after confirming the job exists', async () => {
    // A caller with a bad job id and a mismatched provider gets 404, not 409:
    // the 409 message names the job's real provider, so emitting it for a job
    // that was never found would be a lie.
    const res = await req(`/portal-jobs/nope?providerId=${OTHER_PROVIDER}`);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Portal job not found');
  });

  it.each(['   ', ''])('ignores a whitespace-only provider scope (%p)', async (providerId) => {
    seedJob();
    const res = await req(`/portal-jobs/${JOB}?providerId=${encodeURIComponent(providerId)}`);
    expect(res.status).toBe(200);
  });
});
