/**
 * ****************************************************************************
 * NAVIGATE WEALTH ADMIN SERVER — APPLICATION FACTORY
 * ****************************************************************************
 *
 * WHY THIS FILE EXISTS (roadmap §5.4 / finding A18)
 * -------------------------------------------------
 * Everything below used to live at module scope in `index.tsx`, directly above
 * `Deno.serve(app.fetch)`. Importing that file to test any of it therefore
 * started a server — so the root `onError` handler, the request-id middleware,
 * the CORS allow-list and the three health probes, all of which sit on the
 * request path of every deployed request, had no direct tests at all.
 *
 * `createApp()` builds the same app and returns it. `index.tsx` is now
 * `Deno.serve(createApp().fetch)` and nothing else, so the only module-scope
 * side effect in the entry point is the serve call itself. This is also the
 * prerequisite for the Stage E function split (roadmap §7.2): a `public`
 * sibling function needs the app factored out of the serve call before it can
 * compose a different subset of mounts.
 *
 * BOOT FAILURES ARE NO LONGER SILENT
 * ----------------------------------
 * The three mount registrars were each wrapped in a `try/catch` that logged to
 * stderr and continued. Continuing is right — booting with two of three route
 * families beats a dead function, and the catch exists because a single bad
 * module must not take the whole surface down — but a `console.error` in a
 * platform log is not a signal anyone sees. A deploy could lose every core
 * route while `/health` and `/health/ready` both answered a cheerful 200, and
 * the post-deploy smoke (`scripts/ops/post-deploy-smoke.mjs`) would call it green.
 *
 * So failures are now recorded and the readiness probe reports them: a boot
 * with any failed registrar answers `/health/ready` with 503 `status:
 * 'unready'` and `checks.mounts: 'fail'`. Liveness stays 200 — the isolate is
 * up, it is just not fit to serve — and the existing smoke gate turns that
 * into a red deploy job without needing a new probe.
 * ****************************************************************************
 */

import { Hono } from 'npm:hono';
import type { Context } from 'npm:hono';
import { cors } from 'npm:hono/cors';

import { runWithRequestContext } from './request-context.ts';
import { resolveAllowedOrigins } from './cors-origin.ts';
import { mountCoreRoutes } from './mount-core.ts';
import { mountFnaRoutes } from './mount-fna.ts';
import { mountModuleRoutes } from './mount-modules.ts';

/** Reported by all three health probes. Single source so they cannot drift. */
export const SERVER_VERSION = '4.1.0';

/**
 * The function's route prefix — Supabase routes every request under it.
 *
 * The three health registrations below spell the prefix out as a literal
 * rather than interpolating this const. That is deliberate: the F3 route-auth
 * ratchet (`__tests__/route-auth-granular.test.ts`) discovers routes with a
 * regex that only matches literal paths, and the health probes are its
 * true-positive anchors — the routes it MUST keep reporting as public, or the
 * analysis has gone blind and the whole 123-route floor means nothing. An
 * interpolated path would drop them out of the scan silently. The two forms
 * cannot drift: `create-app.test.ts` fetches every probe through this const.
 */
export const SERVER_PREFIX = '/make-server-91ed8379';

/**
 * Incoming `x-request-id` values are echoed only when they look like an id we
 * would have generated. Anything else is replaced, so a caller cannot inject
 * newlines or control characters into every downstream log line.
 */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Request body ceilings (H-11).
 * =============================
 *
 * Until this, no route had an upper bound on the body it would be handed.
 * Four handlers checked a size after reading (`transcription-routes.ts`,
 * `client-management-profile-crud-routes.ts` and two others) and every one of
 * the remaining ~580 read `await c.req.json()` on whatever arrived. Storage
 * buckets carry a `fileSizeLimit`, but that is enforced by Storage at the END
 * of the upload — the isolate has already buffered the bytes by then.
 *
 * TWO CEILINGS, BY CONTENT TYPE, because one number cannot be both safe and
 * useful here. A single limit high enough for a 50 MB signed PDF would leave
 * every JSON endpoint accepting 50 MB of JSON to parse; a limit tight enough
 * for JSON would break document upload. So:
 *
 *   JSON / text / form-encoded → 2 MB. Well above the largest legitimate
 *     payload (the FNA intake session, itself already bounded by
 *     `intakePayloadSizeOk`) and far below what it takes to hurt an isolate.
 *
 *   multipart/form-data and binary → 55 MB. Just above the largest configured
 *     bucket limit (50 MB, `esign-storage.ts`), so no legitimate upload is
 *     refused here and everything larger is rejected before it is buffered.
 *
 * ENFORCED FROM `content-length`, NOT BY COUNTING BYTES. A body with no
 * declared length is passed through: streaming past this point to measure it
 * would mean buffering the very thing the limit exists to avoid, and every
 * client in this system (the SPA's `fetch`, the portal worker, SendGrid) sends
 * a length. This is a cheap guard against the ordinary case — a runaway client,
 * a mis-set retry, an accidental 200 MB paste — not a defence against a
 * deliberately chunked upload, which the platform's own limits still bound.
 */
const JSON_BODY_LIMIT_BYTES = 2 * 1024 * 1024;
const UPLOAD_BODY_LIMIT_BYTES = 55 * 1024 * 1024;

/**
 * Paths that legitimately carry a large JSON body, with their own ceiling.
 *
 * The one real case is transcription, which takes base64 audio inside JSON and
 * enforces its own 10 MB bound on the decoded field
 * (`transcription-routes.ts`). Base64 costs a third on top, and the JSON
 * envelope a little more, so the ceiling here has to clear ~13.4 MB or the
 * generic limit would reject payloads that route is designed to accept — a
 * body limit that breaks a working feature gets reverted, and then there is no
 * body limit at all.
 *
 * Kept as an explicit, short list rather than a raised global default: the
 * other ~580 routes should not inherit a 14 MB allowance because one of them
 * needs it. A new entry here should come with the route's own inner bound,
 * the way this one does.
 */
const LARGE_JSON_PATH_LIMITS: ReadonlyArray<{ prefix: string; bytes: number }> = [
  { prefix: `${SERVER_PREFIX}/transcription`, bytes: 15 * 1024 * 1024 },
];

/** Bodies of these types are uploads and get the larger ceiling. */
function isUploadContentType(contentType: string): boolean {
  return (
    contentType.startsWith('multipart/form-data') ||
    contentType.startsWith('application/octet-stream') ||
    contentType.startsWith('image/') ||
    contentType.startsWith('audio/') ||
    contentType.startsWith('video/') ||
    contentType === 'application/pdf'
  );
}

/**
 * Reject a request whose declared body is larger than its ceiling, with 413.
 *
 * Exported for test: the limits above are the kind of number that is easy to
 * change by accident and expensive to be wrong about in either direction.
 */
export function bodyLimitMiddleware(): (
  c: Context,
  next: () => Promise<void>,
) => Promise<Response | void> {
  return async (c, next) => {
    // GET/HEAD/OPTIONS carry no body worth bounding.
    if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
      return next();
    }

    const declared = c.req.header('content-length');
    if (!declared) return next();

    const length = Number.parseInt(declared, 10);
    if (!Number.isFinite(length) || length < 0) return next();

    const contentType = (c.req.header('content-type') ?? '').toLowerCase();
    const pathOverride = LARGE_JSON_PATH_LIMITS.find((entry) =>
      c.req.path.startsWith(entry.prefix),
    );
    const limit = pathOverride
      ? pathOverride.bytes
      : isUploadContentType(contentType)
        ? UPLOAD_BODY_LIMIT_BYTES
        : JSON_BODY_LIMIT_BYTES;

    if (length > limit) {
      console.warn(
        `[BODY-LIMIT] Rejected ${length} byte ${contentType || 'untyped'} body ` +
          `on ${c.req.path} (limit ${limit})`,
      );
      return c.json(
        {
          error: 'Request body too large',
          code: 'PAYLOAD_TOO_LARGE',
          maxBytes: limit,
        },
        413,
      );
    }

    return next();
  };
}

/** One route family's registrar, named so a failure can be reported. */
export interface MountRegistrar {
  name: string;
  register: (app: Hono) => void;
}

/** A registrar that threw during boot. */
export interface BootFailure {
  name: string;
  message: string;
}

export interface CreateAppOptions {
  /**
   * Route families to mount. Defaults to the three production registrars.
   * Overridable so tests can exercise boot behaviour without loading ~584
   * routes, and so a Stage E sibling function can compose its own subset.
   */
  mounts?: MountRegistrar[];
}

/** The production mount set, in registration order (order is significant). */
export const DEFAULT_MOUNTS: MountRegistrar[] = [
  { name: 'core', register: mountCoreRoutes },
  { name: 'fna', register: mountFnaRoutes },
  { name: 'modules', register: mountModuleRoutes },
];

/**
 * Build the Edge Function's Hono app: CORS, request-id, the root error
 * handler, the health probes, then every route family.
 *
 * Pure with respect to the process — it starts no server and registers no
 * global handlers, so a test can build as many apps as it needs.
 */
export function createApp(options: CreateAppOptions = {}): Hono {
  const app = new Hono();
  const mounts = options.mounts ?? DEFAULT_MOUNTS;

  /**
   * Registrars that threw. Per-app (not module-level) so one app's boot
   * failures can never be reported by another's readiness probe.
   */
  const bootFailures: BootFailure[] = [];

  // ── CORS ────────────────────────────────────────────────────────────────
  const allowedOrigins = resolveAllowedOrigins();

  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return null;
        if (!allowedOrigins) return origin; // permissive fallback (see cors-origin.ts)
        return allowedOrigins.includes(origin) ? origin : null;
      },
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowHeaders: [
        'Content-Type',
        'Authorization',
        'x-client-info',
        'apikey',
        'x-request-id',
        'X-OpenClaw-Secret',
        // Region pinning (see docs/runbooks/edge-function-latency.md). The
        // Supabase gateway reads `x-region` to choose which region runs this
        // function; the function itself never looks at it. It still has to be
        // allowed here, because the browser's preflight asks THIS app whether
        // the header may be sent, and a header that is not allowed is a
        // blocked request rather than an ignored one.
        //
        // Allowed before anything sends it, deliberately. The SPA and the Edge
        // Function deploy through different pipelines from the same merge, so
        // a client that sends the header first would fail every preflight for
        // as long as the two were out of step.
        'x-region',
      ],
      exposeHeaders: ['x-request-id'],
      credentials: false,
      maxAge: 86400,
    }),
  );

  // ── Body size ceiling (H-11) ────────────────────────────────────────────
  // Before the request-id middleware and everything downstream: an oversized
  // body should cost a header read, not a request id, a log line and a parse.
  app.use('*', bodyLimitMiddleware());

  // ── Request-ID middleware (Guidelines §22 — Observability) ──────────────
  app.use('*', async (c, next) => {
    const incoming = c.req.header('x-request-id');
    const requestId =
      incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID();
    c.set('requestId', requestId);
    // Everything downstream — including sub-routers dispatched by lazy-router
    // via router.fetch(), which run inside this same async chain — now logs
    // with this id attached (Stage B / B4). Degrades to today's behaviour if
    // the deployed runtime lacks node:async_hooks.
    await runWithRequestContext({ requestId }, () => next());
    c.header('x-request-id', requestId);
  });

  // ── Root error handler (Stage B / B1) ───────────────────────────────────
  // Covers the routes this app dispatches ITSELF: the health probes below and
  // any throw inside lazy-router's own proxy handler. It deliberately does NOT
  // cover the ~584 routes behind the lazy mounts — those sub-routers are
  // invoked with `router.fetch()`, so each one handles its own errors
  // internally and nothing propagates here. lazy-router installs the same
  // shared handler on each of them at cache time instead; see the note at the
  // top of that file.
  //
  // `error.middleware.ts` is imported dynamically so it (and `npm:zod`, the
  // stderr logger and the quality-issues recorder) stay out of the boot
  // payload the entry point exists to keep minimal.
  app.onError(async (err, c) => {
    const requestId = c.get('requestId');
    let response: Response;
    try {
      const { errorHandler } = await import('./error.middleware.ts');
      response = await errorHandler(err, c);
    } catch (handlerError: unknown) {
      // The safety net must not itself become the failure. Fall back to a
      // plain JSON 500 rather than letting Deno.serve emit an opaque one.
      console.error(
        '[ERROR] Shared error handler failed:',
        handlerError instanceof Error ? handlerError.message : handlerError,
      );
      response = Response.json(
        { message: 'An unexpected error occurred', code: 'INTERNAL_ERROR', requestId },
        { status: 500 },
      );
    }
    // Stamp the id here too. When a ROUTE throws, Hono resolves the enclosing
    // `await next()` normally (it handles the error at that dispatch level), so
    // the middleware's post-`next()` stamp still runs and this is a harmless
    // repeat — verified against the installed Hono. When the middleware chain
    // itself throws BEFORE `next()` returns — `runWithRequestContext` failing,
    // or any middleware added above this one later — that line never runs, and
    // this is the only thing keeping the correlation id on the response the
    // caller sees. Pinned by the request-context failure test.
    if (typeof requestId === 'string') response.headers.set('x-request-id', requestId);
    return response;
  });

  // ── Health checks (unauthenticated) ─────────────────────────────────────
  // Only these three endpoints are reachable without a bearer token.
  app.get('/make-server-91ed8379', (c) =>
    c.json({
      status: 'ok',
      version: SERVER_VERSION,
      requestId: c.get('requestId'),
    }),
  );

  // Liveness probe — static, never touches downstream services. Stays 200 even
  // with failed mounts: the isolate is alive, which is the question it answers.
  app.get('/make-server-91ed8379/health', (c) =>
    c.json({
      status: 'healthy',
      version: SERVER_VERSION,
      requestId: c.get('requestId'),
    }),
  );

  // Readiness probe — "can this isolate serve traffic": the KV store must be
  // reachable AND every route family must have registered
  // (Guidelines §22 — Observability / Phase 1.5).
  app.get('/make-server-91ed8379/health/ready', async (c) => {
    // Named `mountsCheck` to avoid shadowing the registrar list above.
    const mountsCheck: 'ok' | 'fail' = bootFailures.length === 0 ? 'ok' : 'fail';
    // Names only, never the caught message: this probe is unauthenticated, and
    // a module-load error string can carry paths and internals.
    const failedMounts = bootFailures.map((failure) => failure.name);

    let kv: 'ok' | 'fail' = 'ok';
    let kvError: string | undefined;
    try {
      const store = await import('./kv_store.tsx');
      // Trivial round-trip: read a sentinel key (returns null if missing — that's fine).
      await store.get('__readiness_probe__');
    } catch (error) {
      kv = 'fail';
      kvError = error instanceof Error ? error.message : 'unknown';
    }

    if (kv === 'ok' && mountsCheck === 'ok') {
      return c.json({
        status: 'ready',
        version: SERVER_VERSION,
        requestId: c.get('requestId'),
        checks: { kv, mounts: mountsCheck },
      });
    }

    return c.json(
      {
        status: 'unready',
        version: SERVER_VERSION,
        requestId: c.get('requestId'),
        checks: { kv, mounts: mountsCheck },
        ...(failedMounts.length > 0 ? { failedMounts } : {}),
        ...(kvError ? { error: kvError } : {}),
      },
      503,
    );
  });

  // ── Route families ──────────────────────────────────────────────────────
  // A registrar that throws costs its own routes, not the whole function — but
  // it is recorded, so `/health/ready` fails and the post-deploy smoke goes
  // red instead of the loss being a line in a platform log nobody reads.
  for (const mount of mounts) {
    try {
      mount.register(app);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      bootFailures.push({ name: mount.name, message });
      console.error(`[BOOT] Failed to register ${mount.name} routes:`, message);
    }
  }

  return app;
}
