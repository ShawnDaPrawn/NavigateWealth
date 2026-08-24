/**
 * lazy-router.ts — dispatch + shared error handler (Stage B / B1)
 * ==============================================================
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The obvious way to give the Edge Function a global error handler is
 * `app.onError(...)` in app.ts. It does not work here, and the reason is
 * structural rather than incidental: `lazy()` dispatches each sub-router with
 * `router.fetch(new Request(...))`, and every sub-router is its OWN Hono
 * instance whose `.fetch()` catches errors internally and returns its own
 * Response. Nothing throws back out, so the parent's handler never sees it —
 * it would cover the three health routes in app.ts and none of the ~584
 * routes behind the 77 lazy mounts. A try/catch around `router.fetch()` fails
 * identically, because there is no throw to catch.
 *
 * The first test below pins that premise directly. If a future Hono version
 * changed it, the fix in lazy-router would be unnecessary complexity, and this
 * test is how we would find out.
 *
 * The rest pin the behaviour of the fix:
 *   - an unguarded sub-router gets the shared handler (structured JSON 500 with
 *     telemetry, instead of Hono's bare "Internal Server Error" text);
 *   - a sub-router that set its OWN handler keeps it (honeycomb-routes.ts is
 *     the one such router today) — silently clobbering another module's
 *     explicit choice is the class of bug this work exists to remove;
 *   - the private-field sentinel that distinguishes those two cases still works
 *     against the installed Hono, so a Hono upgrade that renames `errorHandler`
 *     FAILS here rather than silently turning the safety net off;
 *   - the request id crosses the dispatch boundary, without which every one of
 *     those routes' failures would be recorded with no correlation id.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/lazy-router.test.ts
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';

beforeAll(() => {
  // error.middleware.ts reads Deno.env to decide whether to include stack
  // detail; 'test' is not 'production', so we assert on the development shape.
  vi.stubGlobal('Deno', { env: { get: () => 'test' } });
});

// Keep the real errorHandler (its response shape is what we are asserting) but
// silence its logging and stub the one dependency that touches KV.
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

// A17: error.middleware now SCHEDULES the write rather than awaiting it, so the
// telemetry assertions below track `scheduleRuntimeServerIssue`. The variable
// keeps its old name so the ~15 assertions that use it stay untouched — what is
// being asserted (an unexpected 500 produces exactly one telemetry record, with
// the right request id) is unchanged by A17.
const recordRuntimeServerIssue = vi.fn(async () => {});
vi.mock('../quality-issues-runtime-server.ts', () => ({
  scheduleRuntimeServerIssue: (...args: unknown[]) => recordRuntimeServerIssue(...args),
  recordRuntimeServerIssue: (...args: unknown[]) => recordRuntimeServerIssue(...args),
  RUNTIME_SERVER_ISSUES_KEY: 'quality_issues:runtime_server',
}));

const { lazy } = await import('../lazy-router.ts');

const PREFIX = '/make-server-91ed8379';

/**
 * Build a parent app shaped like app.ts: request-id middleware, then mounts.
 * The validation below is copied from app.ts deliberately — a parent that
 * accepted any header would make the propagation tests agree with a version of
 * lazy-router that leaks unvalidated ids downstream.
 */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function makeParent() {
  const app = new Hono();
  app.use('*', async (c, next) => {
    const incoming = c.req.header('x-request-id');
    c.set(
      'requestId',
      incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : 'generated-request-id',
    );
    await next();
  });
  return app;
}

/**
 * `lazy()` caches sub-routers in a module-level Map keyed by mount path, so
 * every test must mount at a path no other test used.
 */
let mountCounter = 0;
const nextPath = () => `/t${(mountCounter += 1)}`;

beforeEach(() => {
  recordRuntimeServerIssue.mockClear();
});

describe('lazy-router: the premise behind B1', () => {
  it('does NOT propagate a sub-router error to the parent onError', async () => {
    // This is the finding that invalidates `app.onError(...)` in app.ts.
    const parentSawError = vi.fn();
    const parent = new Hono();
    parent.onError((_err, c) => {
      parentSawError();
      return c.json({ from: 'parent' }, 500);
    });

    const child = new Hono();
    child.get('/boom', () => {
      throw new Error('kaboom');
    });

    parent.all('/mount/*', (c) => child.fetch(new Request('http://x/boom', c.req.raw)));

    const res = await parent.fetch(new Request('http://x/mount/boom'));

    expect(res.status).toBe(500);
    expect(parentSawError).not.toHaveBeenCalled();
  });
});

describe('lazy-router: shared error handler attachment', () => {
  it('turns an unguarded sub-router throw into a structured JSON 500', async () => {
    const parent = makeParent();
    const path = nextPath();

    const child = new Hono();
    child.get('/boom', () => {
      throw new Error('unanticipated failure');
    });

    lazy(parent, path, () => Promise.resolve({ default: child }));

    const res = await parent.fetch(new Request(`http://x${PREFIX}${path}/boom`));
    const body = await res.json();

    expect(res.status).toBe(500);
    // Hono's built-in handler returns the text "Internal Server Error" with no
    // telemetry at all. This is the shape we replaced it with.
    expect(body).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      endpoint: '/boom',
      method: 'GET',
    });
    // The whole point: the failure is now recorded, not lost.
    expect(recordRuntimeServerIssue).toHaveBeenCalledTimes(1);
  });

  it('records the request id forwarded across the dispatch boundary', async () => {
    const parent = makeParent();
    const path = nextPath();

    const child = new Hono();
    child.get('/boom', () => {
      throw new Error('unanticipated failure');
    });

    lazy(parent, path, () => Promise.resolve({ default: child }));

    // Deliberately sends NO x-request-id. An earlier version of this test sent
    // one, which made it pass even with the forwarding deleted — the caller's
    // own header reached the sub-router on its own and the test could not tell
    // the difference. Only a PARENT-GENERATED id proves the forwarding works.
    await parent.fetch(new Request(`http://x${PREFIX}${path}/boom`));

    expect(recordRuntimeServerIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'generated-request-id',
        statusCode: 500,
        method: 'GET',
      }),
    );
  });

  it('maps APIError subclasses to their own status, not a blanket 500', async () => {
    const { NotFoundError } = await import('../error.middleware.ts');
    const parent = makeParent();
    const path = nextPath();

    const child = new Hono();
    child.get('/missing', () => {
      throw new NotFoundError('no such widget');
    });

    lazy(parent, path, () => Promise.resolve({ default: child }));

    const res = await parent.fetch(new Request(`http://x${PREFIX}${path}/missing`));

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'no such widget', code: 'NOT_FOUND' });
    // Expected errors must NOT pollute the unexpected-500 telemetry feed.
    expect(recordRuntimeServerIssue).not.toHaveBeenCalled();
  });

  it('leaves a sub-router that set its OWN onError alone', async () => {
    const parent = makeParent();
    const path = nextPath();

    const child = new Hono();
    child.onError((_err, c) => c.json({ from: 'the sub-router' }, 500));
    child.get('/boom', () => {
      throw new Error('unanticipated failure');
    });

    lazy(parent, path, () => Promise.resolve({ default: child }));

    const res = await parent.fetch(new Request(`http://x${PREFIX}${path}/boom`));

    expect(await res.json()).toEqual({ from: 'the sub-router' });
    expect(recordRuntimeServerIssue).not.toHaveBeenCalled();
  });
});

describe('lazy-router: dispatch is otherwise unchanged', () => {
  /**
   * NOTE ON THE TEST ENVIRONMENT — requests with a BODY cannot be exercised
   * here. Vitest's jsdom compat `Request` (createCompatRequest in
   * vitest/dist/chunks) does `const compatInit = { ...init }` whenever
   * `init.body != null`, and spreading a `Request` copies nothing: all of its
   * members are prototype accessors, not own enumerable properties. So under
   * jsdom `new Request(url, someRequest)` with a body silently degrades to a
   * bodyless GET with no headers. Plain Node and Deno both copy method,
   * headers and body correctly (verified directly), so this is an artifact of
   * the harness, not of lazy-router.
   *
   * Bodyless requests take the shim's `super(...args)` path and are copied
   * faithfully, so method and header propagation is asserted with a DELETE.
   * Do not "fix" this by asserting on a POST body — it will fail for a reason
   * that has nothing to do with this code.
   */
  it('strips the mount prefix and preserves method and headers', async () => {
    const parent = makeParent();
    const path = nextPath();
    const seen: { url: string; method: string; auth: string | null; requestId: string | null }[] =
      [];

    const child = new Hono();
    child.delete('/widgets/7', (c) => {
      seen.push({
        url: new URL(c.req.url).pathname,
        method: c.req.method,
        auth: c.req.header('authorization') ?? null,
        requestId: c.req.header('x-request-id') ?? null,
      });
      return c.json({ ok: true });
    });

    lazy(parent, path, () => Promise.resolve({ default: child }));

    const res = await parent.fetch(
      new Request(`http://x${PREFIX}${path}/widgets/7`, {
        method: 'DELETE',
        headers: { authorization: 'Bearer token-abc' },
      }),
    );

    expect(res.status).toBe(200);
    expect(seen).toEqual([
      {
        url: '/widgets/7',
        method: 'DELETE',
        // Sub-routers apply their own requireAuth, so losing this header would
        // 401 every authenticated route behind a lazy mount.
        auth: 'Bearer token-abc',
        requestId: 'generated-request-id',
      },
    ]);
  });

  it('maps a bare mount hit to the sub-router root', async () => {
    const parent = makeParent();
    const path = nextPath();
    let seenPath: string | null = null;

    const child = new Hono();
    child.get('/', (c) => {
      seenPath = new URL(c.req.url).pathname;
      return c.json({ ok: true });
    });

    lazy(parent, path, () => Promise.resolve({ default: child }));

    const res = await parent.fetch(new Request(`http://x${PREFIX}${path}`));

    expect(res.status).toBe(200);
    expect(seenPath).toBe('/');
  });

  it('propagates a request id the caller supplied, when it passes validation', async () => {
    const parent = makeParent();
    const path = nextPath();
    let seenId: string | null = null;

    const child = new Hono();
    child.get('/id', (c) => {
      seenId = c.req.header('x-request-id') ?? null;
      return c.json({ ok: true });
    });

    lazy(parent, path, () => Promise.resolve({ default: child }));

    await parent.fetch(
      new Request(`http://x${PREFIX}${path}/id`, {
        headers: { 'x-request-id': 'caller-supplied' },
      }),
    );

    expect(seenId).toBe('caller-supplied');
  });

  it('still returns a 500 with details when the module fails to import', async () => {
    const parent = makeParent();
    const path = nextPath();

    lazy(parent, path, () => Promise.reject(new Error('module blew up')));

    const res = await parent.fetch(new Request(`http://x${PREFIX}${path}/anything`));

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({
      error: `Failed to load module: ${path}`,
      details: 'module blew up',
    });
  });
});

describe('the shared handler is a superset of the one it replaces', () => {
  /**
   * lazy-router replaces Hono's built-in error handler on all 77 mounts. That
   * built-in handler has a branch this one did not: an error carrying its own
   * Response (`getResponse()`) is returned as-is. HTTPException uses it, and so
   * does every Hono middleware that throws one — jwt, bearerAuth, bodyLimit,
   * timeout, the validator.
   *
   * Nothing in this repo throws one today, so this is not a live bug; it is a
   * trap for whoever adds one of those middlewares next, who would watch a
   * deliberate 401 become a generic 500 across every mount. Replacing a
   * handler with one that handles strictly less is the defect — this test is
   * what stops it coming back.
   */
  class ResponseCarryingError extends Error {
    getResponse() {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
  }

  it('returns an error-carried Response untouched instead of a generic 500', async () => {
    const parent = makeParent();
    const path = nextPath();

    const child = new Hono();
    child.get('/guarded', () => {
      throw new ResponseCarryingError('unauthorized');
    });

    lazy(parent, path, () => Promise.resolve({ default: child }));

    const res = await parent.fetch(new Request(`http://x${PREFIX}${path}/guarded`));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    // A deliberate response is not an unexpected failure and must not pollute
    // the unexpected-500 telemetry feed.
    expect(recordRuntimeServerIssue).not.toHaveBeenCalled();
  });
});

describe('the error handler survives a non-Error throw', () => {
  /**
   * `throw null` and `throw 'a string'` are legal JavaScript, and B1 routes
   * every one of the ~584 lazily-mounted routes through this handler. A
   * handler that itself throws is the one failure mode with no recovery left,
   * so it must tolerate whatever it is handed.
   *
   * Nothing in this repo throws a non-Error today (verified: no
   * `throw null|undefined|'string'|{}` anywhere in the server tree), so these
   * are guards against a future one, not a fix for a live bug.
   */
  it('handles a thrown string without crashing', async () => {
    const parent = makeParent();
    const path = nextPath();

    const child = new Hono();
    child.get('/boom', () => {
      throw 'a bare string';
    });

    lazy(parent, path, () => Promise.resolve({ default: child }));

    const res = await parent.fetch(new Request(`http://x${PREFIX}${path}/boom`));

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ code: 'INTERNAL_ERROR' });
    // The point is not just "does not crash" — it is that the failure is now
    // RECORDED. Before, it escaped app.fetch() with no log and no telemetry.
    expect(recordRuntimeServerIssue).toHaveBeenCalledTimes(1);
    const recorded = recordRuntimeServerIssue.mock.calls[0][0] as { error?: Error };
    expect(recorded.error?.name).toBe('NonErrorThrow');
    expect(recorded.error?.message).toContain('a bare string');
  });

  it('handles a thrown null without crashing', async () => {
    const parent = makeParent();
    const path = nextPath();

    const child = new Hono();
    child.get('/boom', () => {
      throw null;
    });

    lazy(parent, path, () => Promise.resolve({ default: child }));

    const res = await parent.fetch(new Request(`http://x${PREFIX}${path}/boom`));

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('lazy-router: a caller cannot inject a request id downstream', () => {
  /**
   * app.ts accepts a caller-supplied x-request-id only if it matches
   * /^[A-Za-z0-9_-]{8,64}$/, and otherwise generates a UUID. That policy is
   * worthless if lazy-router then hands the sub-router the RAW header: the
   * shared error handler falls back to it, and recordRuntimeServerIssue
   * interpolates it unbounded into an issue message persisted to KV and
   * rendered on the admin quality dashboard — the one field it does not clip.
   *
   * So lazy-router overwrites unconditionally. These tests are the reason that
   * is not an oversight.
   */
  const MALFORMED = `${'a'.repeat(300)} <img src=x onerror=alert(1)> Request-ID: spoofed`;

  it('replaces a malformed caller id with the validated one before dispatch', async () => {
    const parent = makeParent();
    const path = nextPath();
    let seenId: string | null = null;

    const child = new Hono();
    child.get('/id', (c) => {
      seenId = c.req.header('x-request-id') ?? null;
      return c.json({ ok: true });
    });

    lazy(parent, path, () => Promise.resolve({ default: child }));

    await parent.fetch(
      new Request(`http://x${PREFIX}${path}/id`, { headers: { 'x-request-id': MALFORMED } }),
    );

    expect(seenId).toBe('generated-request-id');
  });

  it('never records a malformed caller id as telemetry', async () => {
    const parent = makeParent();
    const path = nextPath();

    const child = new Hono();
    child.get('/boom', () => {
      throw new Error('unanticipated failure');
    });

    lazy(parent, path, () => Promise.resolve({ default: child }));

    await parent.fetch(
      new Request(`http://x${PREFIX}${path}/boom`, { headers: { 'x-request-id': MALFORMED } }),
    );

    expect(recordRuntimeServerIssue).toHaveBeenCalledTimes(1);
    const recorded = recordRuntimeServerIssue.mock.calls[0][0] as { requestId?: string };
    expect(recorded.requestId).toBe('generated-request-id');
    expect(recorded.requestId ?? '').not.toContain('<img');
  });
});

describe('error.middleware: unexpected-500 disclosure fails closed', () => {
  it('does not return error details or a stack trace when DENO_ENV is unset', async () => {
    // DENO_ENV is set NOWHERE in this repo or its deployment config, so "unset"
    // is the production reality. The gate must therefore treat unset as
    // production — it previously read `!== 'production'` and disclosed on every
    // unexpected 500. B1 widened this path from ~50 asyncHandler modules to
    // every route behind a lazy mount, so it must not disclose by default.
    vi.stubGlobal('Deno', { env: { get: () => undefined } });

    const parent = makeParent();
    const path = nextPath();

    const child = new Hono();
    child.get('/boom', () => {
      throw new Error('secret internal detail: connection string leaked');
    });

    lazy(parent, path, () => Promise.resolve({ default: child }));

    const res = await parent.fetch(new Request(`http://x${PREFIX}${path}/boom`));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body).not.toHaveProperty('details');
    expect(body).not.toHaveProperty('stack');
    expect(body).not.toHaveProperty('errorName');
    expect(JSON.stringify(body)).not.toContain('connection string leaked');

    vi.stubGlobal('Deno', { env: { get: () => 'test' } });
  });

  it('still discloses when DENO_ENV is explicitly development', async () => {
    // The opt-in half — otherwise the gate is dead code rather than fail-closed.
    vi.stubGlobal('Deno', { env: { get: () => 'development' } });

    const parent = makeParent();
    const path = nextPath();

    const child = new Hono();
    child.get('/boom', () => {
      throw new Error('a developer needs to see this');
    });

    lazy(parent, path, () => Promise.resolve({ default: child }));

    const res = await parent.fetch(new Request(`http://x${PREFIX}${path}/boom`));
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.details).toBe('a developer needs to see this');

    vi.stubGlobal('Deno', { env: { get: () => 'test' } });
  });
});

describe('error.middleware: the request-id validation is defence in depth', () => {
  /**
   * lazy-router already overwrites x-request-id with the validated id, so the
   * validation inside errorHandler is unreachable THROUGH lazy-router — which
   * means a test that only goes through lazy-router does not exercise it at
   * all. (Confirmed by mutation: deleting the validation left every
   * lazy-router test passing.) This repo has been bitten by gates that
   * measured nothing, so the second line of defence gets its own test against
   * the path that actually reaches it: `asyncHandler`, used directly by ~50
   * modules, where no lazy-router overwrite has happened.
   */
  it('ignores a malformed x-request-id when there is no context id', async () => {
    const { asyncHandler } = await import('../error.middleware.ts');
    const app = new Hono();
    app.get(
      '/direct',
      asyncHandler(async () => {
        throw new Error('unanticipated failure');
      }),
    );

    await app.fetch(
      new Request('http://x/direct', {
        headers: { 'x-request-id': '<img src=x onerror=alert(1)>' },
      }),
    );

    expect(recordRuntimeServerIssue).toHaveBeenCalledTimes(1);
    const recorded = recordRuntimeServerIssue.mock.calls[0][0] as { requestId?: string };
    expect(recorded.requestId).toBeUndefined();
  });

  it('accepts a well-formed x-request-id on that same path', async () => {
    const { asyncHandler } = await import('../error.middleware.ts');
    const app = new Hono();
    app.get(
      '/direct',
      asyncHandler(async () => {
        throw new Error('unanticipated failure');
      }),
    );

    await app.fetch(
      new Request('http://x/direct', { headers: { 'x-request-id': 'well-formed-id-123' } }),
    );

    const recorded = recordRuntimeServerIssue.mock.calls[0][0] as { requestId?: string };
    expect(recorded.requestId).toBe('well-formed-id-123');
  });
});

describe('the request-id policy is stated identically everywhere it is enforced', () => {
  /**
   * The same pattern is enforced in three places that cannot import from each
   * other cheaply: app.ts (the boot module, which must stay minimal — §5.4 split
   * it out of index.tsx, taking this pattern with it), error.middleware.ts
   * (lazily loaded), and this test file's `makeParent`.
   * Three unlinked copies is exactly how a security policy rots — someone
   * loosens one and the others keep asserting the old rule.
   *
   * Rather than pay boot payload for a shared constant, this pins them: change
   * one and CI tells you about the other two.
   */
  it('app.ts, error.middleware.ts and this test agree on the pattern', () => {
    const read = (name: string) =>
      readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', name), 'utf8');
    const extract = (src: string, file: string) => {
      const m = src.match(/\/\^\[A-Za-z0-9_-\]\{8,64\}\$\//);
      expect(m, `no request-id pattern found in ${file}`).not.toBeNull();
      return m![0];
    };

    const inApp = extract(read('app.ts'), 'app.ts');
    const inMiddleware = extract(read('error.middleware.ts'), 'error.middleware.ts');

    expect(inApp).toBe(inMiddleware);
    expect(REQUEST_ID_PATTERN.source).toBe(new RegExp(inApp.slice(1, -1)).source);
  });
});

describe('lazy-router: the private-field sentinel', () => {
  /**
   * `usesHonoDefaultErrorHandler` decides "did this router set its own handler?"
   * by identity-comparing `router.errorHandler` against the value a fresh
   * `new Hono()` carries. Hono declares that field `private`, so it is stable
   * runtime surface but NOT a supported type-level contract — a Hono upgrade
   * could rename it, at which point the comparison would silently return false
   * for every router and the safety net would quietly stop being installed.
   *
   * These assertions make that a CI failure instead of silence.
   */
  it('exposes a shared default error handler on every fresh Hono instance', () => {
    const a = new Hono() as unknown as { errorHandler?: unknown };
    const b = new Hono() as unknown as { errorHandler?: unknown };
    expect(typeof a.errorHandler).toBe('function');
    expect(a.errorHandler).toBe(b.errorHandler);
  });

  it('replaces that field when a router calls onError', () => {
    const fresh = new Hono() as unknown as { errorHandler?: unknown };
    const customised = new Hono();
    customised.onError((_err, c) => c.text('mine', 500));
    expect((customised as unknown as { errorHandler?: unknown }).errorHandler).not.toBe(
      fresh.errorHandler,
    );
  });
});
