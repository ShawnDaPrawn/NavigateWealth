/**
 * create-app.ts — entry-point factory (roadmap §5.4 / finding A18)
 * ===============================================================
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Everything asserted here sits on the request path of EVERY deployed request
 * — the CORS allow-list, the request-id middleware, the root error handler and
 * the three health probes — and until `createApp()` was extracted, none of it
 * could be reached from a test: importing `index.tsx` ran `Deno.serve(...)` at
 * module scope.
 *
 * The boot-failure tests are the point of the change rather than a bonus. A
 * mount registrar that throws used to log to stderr and continue, leaving a
 * function that answered `/health` and `/health/ready` with 200 while missing a
 * third of its routes — and `scripts/post-deploy-smoke.mjs` would have called
 * that deploy green. Readiness now fails, so the existing smoke gate turns a
 * partial boot into a red deploy job.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/create-app.test.ts
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Hono } from 'hono';

const PREFIX = '/make-server-91ed8379';

// ── Deno runtime shim ───────────────────────────────────────────────────────
// `env` is a mutable map so each test can boot an app with a different
// NW_ALLOWED_ORIGINS (the value is read once per `createApp()` call).
const denoEnv = new Map<string, string>();

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: (key: string) => denoEnv.get(key) } });
});

// ── In-memory KV, with a failure switch for the readiness test ──────────────
const kvState = vi.hoisted(() => ({ failing: false }));

// ── Request context, with a failure switch ─────────────────────────────────
// Real by default (the id must genuinely cross the async boundary); one test
// forces it to reject, which is the only path where the middleware's
// post-`next()` header stamp does not run.
const contextState = vi.hoisted(() => ({ failing: false }));

vi.mock('../request-context.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../request-context.ts')>();
  return {
    ...actual,
    runWithRequestContext: async <T>(ctx: { requestId: string }, fn: () => Promise<T>) => {
      if (contextState.failing) throw new Error('async context unavailable');
      return actual.runWithRequestContext(ctx, fn);
    },
  };
});

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async () => {
    if (kvState.failing) throw new Error('kv unreachable');
    return null;
  }),
}));

// ── Quiet the logger and the telemetry sink used by the real errorHandler ───
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

const { createApp, DEFAULT_MOUNTS, SERVER_VERSION, SERVER_PREFIX } =
  await import('../create-app.ts');

/** A registrar that mounts one route, so "the healthy ones still register" is observable. */
const healthyMount = (name: string, path: string) => ({
  name,
  register: (app: Hono) => {
    app.get(`${PREFIX}${path}`, (c) => c.json({ from: name }));
  },
});

/** A registrar that throws the way a bad module import would at boot. */
const brokenMount = (name: string) => ({
  name,
  register: () => {
    throw new Error(`module load failed: ${name}`);
  },
});

const get = (app: Hono, path: string, init?: RequestInit) =>
  app.fetch(new Request(`http://edge.test${path}`, init));

beforeEach(() => {
  kvState.failing = false;
  contextState.failing = false;
  denoEnv.clear();
  vi.clearAllMocks();
});

describe('createApp: shape of the factory', () => {
  it('starts no server and can be called more than once', () => {
    // The whole point of A18: building the app is a pure function of its
    // options. If this ever needs a Deno.serve stub, the extraction regressed.
    const first = createApp({ mounts: [] });
    const second = createApp({ mounts: [] });
    expect(first).not.toBe(second);
  });

  it('defaults to the three production route families, in registration order', () => {
    // Order is significant — mount-core registers /admin/onboarding before
    // /admin, and the families themselves must not be reordered either.
    expect(DEFAULT_MOUNTS.map((m) => m.name)).toEqual(['core', 'fna', 'modules']);
    expect(DEFAULT_MOUNTS.every((m) => typeof m.register === 'function')).toBe(true);
  });

  it('exports the prefix the deployed function is served under', () => {
    expect(SERVER_PREFIX).toBe(PREFIX);
  });
});

describe('createApp: health probes', () => {
  it('answers the root probe without a bearer token', async () => {
    const res = await get(createApp({ mounts: [] }), PREFIX);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      status: 'ok',
      version: SERVER_VERSION,
    });
  });

  it('answers liveness without touching downstream services', async () => {
    const res = await get(createApp({ mounts: [] }), `${PREFIX}/health`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      status: 'healthy',
      version: SERVER_VERSION,
    });
  });

  it('reports ready when KV round-trips and every family mounted', async () => {
    const res = await get(
      createApp({ mounts: [healthyMount('core', '/x')] }),
      `${PREFIX}/health/ready`,
    );
    expect(res.status).toBe(200);
    // The exact shape the post-deploy smoke asserts on (scripts/post-deploy-smoke.mjs).
    await expect(res.json()).resolves.toMatchObject({
      status: 'ready',
      checks: { kv: 'ok', mounts: 'ok' },
    });
  });

  it('reports unready with a 503 when the KV store is unreachable', async () => {
    kvState.failing = true;
    const res = await get(createApp({ mounts: [] }), `${PREFIX}/health/ready`);
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      status: 'unready',
      checks: { kv: 'fail', mounts: 'ok' },
    });
  });
});

describe('createApp: a failed mount is not silently swallowed (A18)', () => {
  it('keeps serving the families that did register', async () => {
    const app = createApp({
      mounts: [healthyMount('core', '/core-route'), brokenMount('modules')],
    });

    const res = await get(app, `${PREFIX}/core-route`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ from: 'core' });
  });

  it('still answers liveness — the isolate is up, just not fit to serve', async () => {
    const app = createApp({ mounts: [brokenMount('core')] });
    const res = await get(app, `${PREFIX}/health`);
    expect(res.status).toBe(200);
  });

  it('fails readiness and names the registrars that threw', async () => {
    const app = createApp({
      mounts: [healthyMount('core', '/ok'), brokenMount('fna'), brokenMount('modules')],
    });

    const res = await get(app, `${PREFIX}/health/ready`);

    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      status: string;
      checks: Record<string, string>;
      failedMounts: string[];
    };
    expect(body.status).toBe('unready');
    expect(body.checks).toMatchObject({ kv: 'ok', mounts: 'fail' });
    expect(body.failedMounts).toEqual(['fna', 'modules']);
  });

  it('never leaks the caught error message to this unauthenticated probe', async () => {
    const app = createApp({ mounts: [brokenMount('core')] });
    const body = await (await get(app, `${PREFIX}/health/ready`)).text();
    expect(body).toContain('core');
    expect(body).not.toContain('module load failed');
  });

  it('scopes boot failures to the app that had them', async () => {
    // bootFailures is per-app closure state, not module state: a broken boot in
    // one isolate's app must not make an unrelated app report itself unready.
    createApp({ mounts: [brokenMount('core')] });
    const healthy = createApp({ mounts: [healthyMount('core', '/ok')] });

    const res = await get(healthy, `${PREFIX}/health/ready`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ checks: { mounts: 'ok' } });
  });
});

describe('createApp: request id (Guidelines §22)', () => {
  it('echoes a well-formed incoming id and stamps it on the response', async () => {
    const res = await get(createApp({ mounts: [] }), `${PREFIX}/health`, {
      headers: { 'x-request-id': 'abc123def456' },
    });

    expect(res.headers.get('x-request-id')).toBe('abc123def456');
    await expect(res.json()).resolves.toMatchObject({ requestId: 'abc123def456' });
  });

  it('generates an id when none is supplied', async () => {
    const res = await get(createApp({ mounts: [] }), `${PREFIX}/health`);
    const id = res.headers.get('x-request-id');
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    await expect(res.json()).resolves.toMatchObject({ requestId: id });
  });

  it.each([
    ['too short', 'short'],
    ['a newline injection', 'ok-id\nINJECTED: log line'],
    ['a path traversal attempt', '../../etc/passwd'],
  ])('replaces %s rather than echoing it into every log line', async (_label, hostile) => {
    const res = await get(createApp({ mounts: [] }), `${PREFIX}/health`, {
      headers: { 'x-request-id': encodeURI(hostile) },
    });

    const id = res.headers.get('x-request-id');
    expect(id).not.toBe(hostile);
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
});

describe('createApp: root error handler (Stage B / B1)', () => {
  it('turns a throw in a route this app dispatches into a structured JSON 500', async () => {
    const app = createApp({
      mounts: [
        {
          name: 'boom',
          register: (a: Hono) => {
            a.get(`${PREFIX}/boom`, () => {
              throw new Error('unanticipated failure');
            });
          },
        },
      ],
    });

    const res = await get(app, `${PREFIX}/boom`, { headers: { 'x-request-id': 'reqid-boom-1' } });

    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
    // No stack/detail disclosure: error.middleware fails closed unless
    // DENO_ENV === 'development', which the shim above leaves unset.
    expect(body).not.toHaveProperty('stack');
    expect(body).not.toHaveProperty('details');
  });

  it('keeps the correlation id on the error response', async () => {
    const app = createApp({
      mounts: [
        {
          name: 'boom',
          register: (a: Hono) => {
            a.get(`${PREFIX}/boom-id`, () => {
              throw new Error('unanticipated failure');
            });
          },
        },
      ],
    });

    const res = await get(app, `${PREFIX}/boom-id`, {
      headers: { 'x-request-id': 'reqid-boom-2' },
    });

    expect(res.headers.get('x-request-id')).toBe('reqid-boom-2');
  });

  it('still stamps the id when the middleware chain itself throws', async () => {
    // This is the case onError's own stamp exists for. On a ROUTE throw Hono
    // resolves the enclosing `await next()`, so the middleware's post-next
    // stamp runs and onError's is a harmless repeat. When the chain throws
    // before that line is reached — here, `runWithRequestContext` rejecting —
    // onError is the only thing left that can attach the id, and a 500 with no
    // correlation id is a 500 nobody can trace.
    contextState.failing = true;

    const res = await get(createApp({ mounts: [] }), `${PREFIX}/health`, {
      headers: { 'x-request-id': 'reqid-ctx-fail' },
    });

    expect(res.status).toBe(500);
    expect(res.headers.get('x-request-id')).toBe('reqid-ctx-fail');
  });
});

describe('createApp: CORS allow-list (Guidelines §12.4)', () => {
  it('reflects an allow-listed origin', async () => {
    denoEnv.set('NW_ALLOWED_ORIGINS', 'https://www.navigatewealth.co, https://navigatewealth.co');
    const res = await get(createApp({ mounts: [] }), `${PREFIX}/health`, {
      headers: { Origin: 'https://navigatewealth.co' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://navigatewealth.co');
  });

  it('refuses an origin outside the allow-list', async () => {
    denoEnv.set('NW_ALLOWED_ORIGINS', 'https://www.navigatewealth.co');
    const res = await get(createApp({ mounts: [] }), `${PREFIX}/health`, {
      headers: { Origin: 'https://evil.example' },
    });
    expect(res.headers.get('access-control-allow-origin')).not.toBe('https://evil.example');
  });

  it('falls back to reflecting any origin when the env var is unset, and warns', async () => {
    // Deliberate fail-OPEN (see the incident note in create-app.ts). Pinned so
    // nobody "fixes" it into a production outage without reading the reasoning.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await get(createApp({ mounts: [] }), `${PREFIX}/health`, {
      headers: { Origin: 'https://anything.example' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://anything.example');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NW_ALLOWED_ORIGINS'));
    warn.mockRestore();
  });

  it('denies every origin when the allow-list is separators only — the preserved sharp edge', async () => {
    // `" , ,"` parses to an empty allow-list, which denies everything with no
    // warning, while `""` falls through to permissive reflection. That
    // inconsistency came across verbatim from index.tsx and is pinned, not
    // fixed: a pure move does not get to widen a CORS allow-list. This test is
    // what will fail — deliberately — when someone decides how it should behave.
    denoEnv.set('NW_ALLOWED_ORIGINS', ' , ,');
    const res = await get(createApp({ mounts: [] }), `${PREFIX}/health`, {
      headers: { Origin: 'https://anything.example' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('treats an empty-string allow-list as unset (permissive), unlike the case above', async () => {
    denoEnv.set('NW_ALLOWED_ORIGINS', '');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await get(createApp({ mounts: [] }), `${PREFIX}/health`, {
      headers: { Origin: 'https://anything.example' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://anything.example');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('index.tsx stays a serve call and nothing else (A18)', () => {
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../index.tsx'),
    'utf8',
  );
  // Strip comments — the file is mostly its header block.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .trim();

  it('serves the app the factory built', () => {
    expect(code).toContain('Deno.serve(createApp().fetch)');
  });

  it('keeps the console override first, before any other import', () => {
    // It must run before any module can write to stdout and corrupt a response
    // body; ES imports evaluate in source order, so "first" is load-bearing.
    const imports = code.match(/^import .*$/gm) ?? [];
    expect(imports[0]).toContain('./console-override.ts');
  });

  it('holds no app configuration of its own', () => {
    // If middleware, routes or mounts reappear here, they are untestable again
    // and this test is the tripwire that says so.
    for (const forbidden of ['app.use(', 'app.get(', 'app.onError(', 'new Hono(', 'mount']) {
      expect(code).not.toContain(forbidden);
    }
  });
});
