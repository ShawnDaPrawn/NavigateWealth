/**
 * Connection tests — the cheap diagnostic that did not exist
 * ==========================================================
 *
 * Before this, the only way to find out whether a provider's stored credentials
 * still worked was to start a real sync run. That required the provider to
 * already have policies captured, and if it worked it wrote to the book. So the
 * question an adviser asks first ("can we even get in?") was the most expensive
 * one to ask, and in practice nobody asked it — which is how providers sat
 * broken without anyone knowing.
 *
 * A connection test is the opposite: no queue, no extraction, nothing written.
 * This suite pins the three properties that make it safe to offer:
 *
 *   1. **It queues nothing.** Not "queues and skips" — queues nothing, so it
 *      cannot touch a policy even by accident.
 *   2. **It runs with no policies at all.** The empty-queue 400 that guards a
 *      real run must not fire, or the test is useless at the only moment it
 *      matters: setting a provider up.
 *   3. **It cannot be turned into a real run.** It is forced to `discover`
 *      whatever run mode is asked for, and it refuses a policy scope outright.
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

const PROFILE = `${PROVIDER}-env`;

const startTest = (body: Record<string, unknown> = {}) =>
  req('/portal-jobs', {
    method: 'POST',
    body: {
      providerId: PROVIDER,
      categoryId: CATEGORY,
      credentialProfileId: PROFILE,
      connectionTest: true,
      ...body,
    },
  });

function queuedItems(jobId: string) {
  return (kvStore.get(`portal-job-items:${jobId}`) ?? []) as unknown[];
}

/** Strip the provider's policies, leaving credentials and the flow intact. */
function removeAllPolicies() {
  kvStore.set(`policies:client:${CLIENT}`, []);
}

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  resetPortalJobMocks();
});

describe('connection test — it reads nothing and writes nothing', () => {
  it('queues no policies at all, even when the provider has some', async () => {
    seedCreatePrerequisites();
    const body = await (await startTest()).json();

    expect(body.job.connectionTest).toBe(true);
    expect(queuedItems(body.job.id)).toEqual([]);
    expect(body.job.queueSummary.total).toBe(0);
  });

  it('runs for a provider with no policies at all, which is when it is needed', async () => {
    seedCreatePrerequisites();
    removeAllPolicies();

    const response = await startTest();
    expect(response.status).toBe(200);
    expect((await response.json()).job.connectionTest).toBe(true);
  });

  it('still dispatches a worker, or the test would never actually run', async () => {
    seedCreatePrerequisites();
    removeAllPolicies();
    await startTest();
    expect(runtime.dispatch).toHaveBeenCalledTimes(1);
  });

  it('says what it is doing, without claiming to have found policies', async () => {
    seedCreatePrerequisites();
    const body = await (await startTest()).json();
    expect(body.job.message).toContain('No policy data will be read or changed');
  });
});

describe('connection test — it cannot be turned into a real run', () => {
  it('forces discover mode however the caller asks for it to run', async () => {
    seedCreatePrerequisites();
    const body = await (await startTest({ runMode: 'run' })).json();
    expect(body.job.runMode).toBe('discover');
  });

  it('refuses a policy scope rather than quietly ignoring it', async () => {
    seedCreatePrerequisites();
    const response = await startTest({ policyIds: ['pol-1'] });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('does not take policyIds');
    expect(runtime.dispatch).not.toHaveBeenCalled();
  });

  it('still requires stored credentials — there is nothing to test without them', async () => {
    seedCreatePrerequisites({ credentials: null });
    const response = await startTest();

    expect(response.status).toBe(400);
    expect(runtime.dispatch).not.toHaveBeenCalled();
  });
});

describe('connection test — the outcome is recorded where the Connections screen reads it', () => {
  async function runToStatus(status: string, extra: Record<string, unknown> = {}) {
    seedCreatePrerequisites();
    const body = await (await startTest()).json();
    await req(`/portal-jobs/${body.job.id}/status`, {
      method: 'POST',
      body: { status, ...extra },
    });
    return kvStore.get(`portal-connection:${PROVIDER}:${PROFILE}`);
  }

  it('records a success when the worker reaches a signed-in page', async () => {
    const record = await runToStatus('discovery_ready', { message: 'Signed in successfully.' });
    expect(record.state).toBe('connected');
    expect(record.checkedAt).toBeTruthy();
  });

  it('records a failure, keeping what the provider said so it can be acted on', async () => {
    const record = await runToStatus('failed', { error: 'Your password has expired.' });
    expect(record.state).toBe('failed');
    expect(record.message).toContain('password has expired');
  });

  it('records nothing until the job has actually finished', async () => {
    expect(await runToStatus('running')).toBeUndefined();
  });

  it('does not record a connection outcome for an ordinary sync run', async () => {
    seedCreatePrerequisites();
    const body = await (
      await req('/portal-jobs', {
        method: 'POST',
        body: {
          providerId: PROVIDER,
          categoryId: CATEGORY,
          credentialProfileId: PROFILE,
          runMode: 'discover',
        },
      })
    ).json();

    await req(`/portal-jobs/${body.job.id}/status`, {
      method: 'POST',
      body: { status: 'failed', error: 'Policy page not found.' },
    });

    // A failure to FIND a policy says nothing about whether we can sign in, and
    // reporting it as a broken connection would send an adviser to reset a
    // password that was never the problem.
    expect(kvStore.get(`portal-connection:${PROVIDER}:${PROFILE}`)).toBeUndefined();
  });
});

describe('GET /portal-connections', () => {
  /**
   * The list is keyed off the provider's own category list — that is what says
   * which portal it even has — so the fixture has to carry one. The shared
   * `seedCreatePrerequisites` deliberately does not, because job creation takes
   * the category from the request instead.
   */
  const seedListablePrerequisites = (
    options: Parameters<typeof seedCreatePrerequisites>[0] = {},
  ) => {
    seedCreatePrerequisites(options);
    kvStore.set(`provider:${PROVIDER}`, {
      id: PROVIDER,
      name: 'Allan Gray',
      categoryIds: [CATEGORY],
    });
  };

  it('reports a provider whose credentials have never been tested as untested', async () => {
    seedListablePrerequisites();
    const body = await (await req('/portal-connections')).json();

    const entry = body.connections.find((c: { providerId: string }) => c.providerId === PROVIDER);
    expect(entry.hasCredentials).toBe(true);
    expect(entry.state).toBe('untested');
  });

  it('distinguishes "nobody has tried" from "somebody tried and it failed"', async () => {
    seedListablePrerequisites();
    kvStore.set(`portal-connection:${PROVIDER}:${PROFILE}`, {
      providerId: PROVIDER,
      credentialProfileId: PROFILE,
      categoryId: CATEGORY,
      state: 'failed',
      checkedAt: '2026-09-01T00:00:00.000Z',
      message: 'Your password has expired.',
    });

    const body = await (await req('/portal-connections')).json();
    const entry = body.connections.find((c: { providerId: string }) => c.providerId === PROVIDER);
    expect(entry.state).toBe('failed');
    expect(entry.message).toContain('password has expired');
  });

  it('asks for credentials before asking anyone to test them', async () => {
    seedListablePrerequisites({ credentials: null });
    const body = await (await req('/portal-connections')).json();

    const entry = body.connections.find((c: { providerId: string }) => c.providerId === PROVIDER);
    expect(entry.state).toBe('no_credentials');
    expect(entry.hasCredentials).toBe(false);
  });

  it('leaves out a provider with no automation-eligible category', async () => {
    kvStore.set('provider:spreadsheet-only', {
      id: 'spreadsheet-only',
      name: 'Spreadsheet Only',
      categoryIds: ['retirement_planning'],
    });

    const body = await (await req('/portal-connections')).json();
    expect(
      body.connections.some((c: { providerId: string }) => c.providerId === 'spreadsheet-only'),
    ).toBe(false);
  });
});
