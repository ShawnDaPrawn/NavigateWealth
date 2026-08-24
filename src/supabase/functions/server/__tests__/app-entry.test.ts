/**
 * createApp() — the Edge Function entry point (roadmap §5.4 / A18)
 * ================================================================
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * None of this was testable before. `index.tsx` ended in
 * `Deno.serve(app.fetch)` at module scope, so importing the module WAS starting
 * a server — a test could not get hold of the app to send a request into it.
 * Three things lived only in that file and therefore had no coverage at all:
 *
 *   - the root `onError` handler, which is the safety net for every unhandled
 *     throw the app dispatches itself, INCLUDING its own fallback for when the
 *     shared error handler is the thing that fails;
 *   - the three health probes, one of which gates production traffic;
 *   - what happens at boot when a route group fails to mount.
 *
 * Splitting `createApp()` out of the serve call is what makes them reachable.
 *
 * The mount registrars are mocked throughout. That is not a shortcut — it is
 * the point. Mocking them is what lets a test ask "what does this app do when
 * mounting FAILS?", which is the question the boot behaviour turns on, and it
 * keeps ~584 real routes out of a test about the entry point.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/app-entry.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const PREFIX = '/make-server-91ed8379';

/**
 * Mount behaviour is per-test, so the mocks read mutable state rather than
 * being re-mocked. `vi.hoisted` is required: `vi.mock` calls are hoisted above
 * the imports, so anything they close over must be hoisted too.
 */
const mountState = vi.hoisted(() => ({
  core: null as null | ((app: unknown) => void),
  fna: null as null | ((app: unknown) => void),
  modules: null as null | ((app: unknown) => void),
}));

vi.mock('../mount-core.ts', () => ({
  mountCoreRoutes: (app: unknown) => mountState.core?.(app),
}));
vi.mock('../mount-fna.ts', () => ({
  mountFnaRoutes: (app: unknown) => mountState.fna?.(app),
}));
vi.mock('../mount-modules.ts', () => ({
  mountModuleRoutes: (app: unknown) => mountState.modules?.(app),
}));

/** The readiness probe dynamically imports this; `kvGet` decides its verdict. */
const kvGet = vi.hoisted(() => vi.fn(async () => null));
vi.mock('../kv_store.tsx', () => ({ get: kvGet }));

// Keep the REAL error middleware — its response shape is what the onError tests
// assert — but silence its logging and stub the KV-touching telemetry write.
vi.mock('../stderr-logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn(), debug: vi.fn() },
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));
vi.mock('../quality-issues-runtime-server.ts', () => ({
  scheduleRuntimeServerIssue: vi.fn(async () => {}),
  recordRuntimeServerIssue: vi.fn(async () => {}),
  RUNTIME_SERVER_ISSUES_KEY: 'quality_issues:runtime_server',
}));

const { createApp } = await import('../app.ts');

/** Env is read while the app is being built, so it must be set before build. */
function stubEnv(vars: Record<string, string | undefined> = {}) {
  vi.stubGlobal('Deno', { env: { get: (k: string) => vars[k] } });
}

beforeEach(() => {
  mountState.core = null;
  mountState.fna = null;
  mountState.modules = null;
  kvGet.mockReset();
  kvGet.mockResolvedValue(null);
  stubEnv();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const send = (
  app: { fetch: (r: Request) => Response | Promise<Response> },
  path: string,
  init?: RequestInit,
) => app.fetch(new Request(`https://example.test${path}`, init));

describe('health probes', () => {
  it('answers the root probe without a bearer token', async () => {
    const res = await send(createApp(), PREFIX);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok', version: '4.1.0' });
  });

  it('answers the liveness probe without touching downstream services', async () => {
    const res = await send(createApp(), `${PREFIX}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'healthy' });
    // Liveness must not depend on KV, or a KV outage would get the isolate
    // killed rather than merely drained.
    expect(kvGet).not.toHaveBeenCalled();
  });

  it('reports ready when the KV store answers', async () => {
    const res = await send(createApp(), `${PREFIX}/health/ready`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ready', checks: { kv: 'ok' } });
  });

  it('reports unready with a 503 when the KV store throws', async () => {
    kvGet.mockRejectedValue(new Error('kv unreachable'));
    const res = await send(createApp(), `${PREFIX}/health/ready`);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      status: 'unready',
      checks: { kv: 'fail' },
      error: 'kv unreachable',
    });
  });
});

describe('request id', () => {
  it('generates one when the caller sends none', async () => {
    const res = await send(createApp(), PREFIX);
    const id = res.headers.get('x-request-id');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect((await res.json()).requestId).toBe(id);
  });

  it('adopts a well-formed id from the caller so traces join up', async () => {
    const res = await send(createApp(), PREFIX, { headers: { 'x-request-id': 'abc12345' } });
    expect(res.headers.get('x-request-id')).toBe('abc12345');
  });

  it.each([
    ['too short', 'abc'],
    ['too long', 'a'.repeat(65)],
    ['illegal characters', 'has spaces!'],
  ])('replaces a caller id that is %s rather than trusting it', async (_label, incoming) => {
    const res = await send(createApp(), PREFIX, { headers: { 'x-request-id': incoming } });
    expect(res.headers.get('x-request-id')).not.toBe(incoming);
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('root error handler', () => {
  /** Registers a route that throws, using the real mount seam. */
  const withThrowingRoute = (err: unknown = new Error('boom')) => {
    mountState.core = (app) => {
      (app as { get: (p: string, h: () => never) => void }).get(`${PREFIX}/explode`, () => {
        throw err;
      });
    };
  };

  it('turns an unhandled throw into a structured JSON 500', async () => {
    withThrowingRoute();
    const res = await send(createApp(), `${PREFIX}/explode`);
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('stamps the request id on the error response header', async () => {
    // The request-id middleware sets this header AFTER `await next()`, which
    // never runs when the handler throws — so the error path has to stamp it
    // itself. Without this an operator has no id to search the logs by,
    // precisely on the responses they most need to trace.
    withThrowingRoute();
    const res = await send(createApp(), `${PREFIX}/explode`, {
      headers: { 'x-request-id': 'trace123' },
    });
    expect(res.headers.get('x-request-id')).toBe('trace123');
  });

  it('carries the id in the header only, not the shared handler’s body', async () => {
    // Pinning an asymmetry rather than endorsing it: the shared handler's body
    // has no `requestId` (the id goes to the header and the telemetry record),
    // whereas the fallback body below DOES carry one. Worth knowing before
    // anyone writes a client that reads the id out of the body — it would work
    // only on the rarer of the two paths.
    withThrowingRoute();
    const res = await send(createApp(), `${PREFIX}/explode`, {
      headers: { 'x-request-id': 'trace123' },
    });
    const body = await res.json();
    expect(body.requestId).toBeUndefined();
    expect(body).toMatchObject({ code: 'INTERNAL_ERROR', endpoint: `${PREFIX}/explode` });
  });

  it('falls back to a plain 500 when the shared error handler itself fails', async () => {
    // The safety net must not become the failure. Simulated by making the
    // dynamic import of the handler reject.
    vi.doMock('../error.middleware.ts', () => {
      throw new Error('handler module is broken');
    });
    vi.resetModules();
    const { createApp: freshCreateApp } = await import('../app.ts');
    mountState.core = (app) => {
      (app as { get: (p: string, h: () => never) => void }).get(`${PREFIX}/explode`, () => {
        throw new Error('boom');
      });
    };
    const res = await send(freshCreateApp(), `${PREFIX}/explode`, {
      headers: { 'x-request-id': 'trace456' },
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({
      message: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      requestId: 'trace456',
    });
    vi.doUnmock('../error.middleware.ts');
    vi.resetModules();
  });
});

describe('CORS', () => {
  it('reflects an origin on the allow-list', async () => {
    stubEnv({ NW_ALLOWED_ORIGINS: 'https://a.test,https://b.test' });
    const res = await send(createApp(), PREFIX, { headers: { Origin: 'https://b.test' } });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://b.test');
  });

  it('refuses an origin that is not on the allow-list', async () => {
    stubEnv({ NW_ALLOWED_ORIGINS: 'https://a.test' });
    const res = await send(createApp(), PREFIX, { headers: { Origin: 'https://evil.test' } });
    expect(res.headers.get('access-control-allow-origin')).not.toBe('https://evil.test');
  });

  it('tolerates whitespace and empty entries in the env list', async () => {
    stubEnv({ NW_ALLOWED_ORIGINS: ' https://a.test , , https://b.test ' });
    const res = await send(createApp(), PREFIX, { headers: { Origin: 'https://a.test' } });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://a.test');
  });

  it('falls back to reflecting any origin, loudly, when the env var is unset', async () => {
    // Deliberate fail-OPEN (see the note in app.ts): failing closed on CORS
    // would brick every browser client, and auth still guards every non-health
    // route. The warning is the part that must not be lost.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await send(createApp(), PREFIX, { headers: { Origin: 'https://anything.test' } });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://anything.test');
    expect(warn.mock.calls.flat().join(' ')).toContain('NW_ALLOWED_ORIGINS');
  });
});

describe('boot: a route group that fails to mount', () => {
  const BOOM = () => {
    throw new Error('mount exploded');
  };

  it('still builds an app rather than throwing out of createApp', async () => {
    // A partial outage beats a dead isolate: the groups that DID mount keep
    // serving, and the probe below is what tells the platform to drain this
    // instance.
    mountState.core = BOOM;
    expect(() => createApp()).not.toThrow();
  });

  it('keeps serving the groups that mounted successfully', async () => {
    mountState.core = BOOM;
    mountState.modules = (app) => {
      (app as { get: (p: string, h: () => Response) => void }).get(`${PREFIX}/ok`, () =>
        Response.json({ fine: true }),
      );
    };
    const res = await send(createApp(), `${PREFIX}/ok`);
    expect(res.status).toBe(200);
  });

  it('reports the failure on the readiness probe instead of claiming to be ready', async () => {
    // THE POINT OF THIS FILE. Before §5.4 a failed mount was caught, logged and
    // forgotten: the app booted with entire route groups missing, every one of
    // their endpoints answered 404, and `/health/ready` still returned 200
    // "ready" because it only checks KV. A load balancer saw a healthy instance
    // and kept sending it traffic it could not serve.
    mountState.core = BOOM;
    const res = await send(createApp(), `${PREFIX}/health/ready`);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'unready', checks: { kv: 'ok', mounts: 'fail' } });
    expect(body.failedMounts).toEqual(['core']);
  });

  it('names every group that failed, not just the first', async () => {
    mountState.core = BOOM;
    mountState.fna = BOOM;
    mountState.modules = BOOM;
    const res = await send(createApp(), `${PREFIX}/health/ready`);
    expect(res.status).toBe(503);
    expect((await res.json()).failedMounts).toEqual(['core', 'fna', 'modules']);
  });

  it('reports ready when every group mounts', async () => {
    const res = await send(createApp(), `${PREFIX}/health/ready`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ready', checks: { kv: 'ok', mounts: 'ok' } });
  });

  it('keeps each app’s mount failures to itself', async () => {
    // The failure record must live on the app, not in module state — two
    // isolates (or two tests) must not see each other's boot problems.
    mountState.core = BOOM;
    const broken = createApp();
    mountState.core = null;
    const healthy = createApp();
    expect((await send(broken, `${PREFIX}/health/ready`)).status).toBe(503);
    expect((await send(healthy, `${PREFIX}/health/ready`)).status).toBe(200);
  });

  it('still logs the failure for the boot log', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    mountState.fna = BOOM;
    createApp();
    expect(err.mock.calls.flat().join(' ')).toContain('mount exploded');
  });
});
