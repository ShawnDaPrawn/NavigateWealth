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
 * the post-deploy smoke (`scripts/post-deploy-smoke.mjs`) would call it green.
 *
 * So failures are now recorded and the readiness probe reports them: a boot
 * with any failed registrar answers `/health/ready` with 503 `status:
 * 'unready'` and `checks.mounts: 'fail'`. Liveness stays 200 — the isolate is
 * up, it is just not fit to serve — and the existing smoke gate turns that
 * into a red deploy job without needing a new probe.
 * ****************************************************************************
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';

import { runWithRequestContext } from './request-context.ts';
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
 * Resolve the CORS allow-list from the environment.
 *
 * Read per `createApp()` call rather than once at module load: that is what
 * makes the fallback branch testable, and the value is only consulted at boot
 * either way.
 *
 * IMPORTANT — fail-OPEN fallback (deliberately):
 *   When `NW_ALLOWED_ORIGINS` is unset we reflect any origin and log a
 *   prominent warning every boot. CORS is defence-in-depth — every
 *   non-health route still requires a valid bearer token (`requireAuth`),
 *   so a permissive CORS default cannot by itself leak data. Failing
 *   closed on CORS would silently break every browser client (the
 *   incident captured on 2026-04-18 — dashboard "Network error" + super-
 *   admin lockout). Operators MUST set the env var before relying on the
 *   strict allow-list as a security boundary (Guidelines §12.4 / Phase 0.3),
 *   e.g. NW_ALLOWED_ORIGINS="https://www.navigatewealth.co,https://navigatewealth.co".
 *
 * KNOWN SHARP EDGE, PRESERVED VERBATIM FROM index.tsx:
 *   unset or empty-string  → permissive reflection + the warning above;
 *   `" , ,"` (only separators) → parses to an empty allow-list, which denies
 *   EVERY origin, silently, and is almost certainly a typo rather than intent.
 *   That inconsistency is real and is pinned by a test rather than quietly
 *   "fixed" here: this extraction is a pure move, and widening a CORS
 *   allow-list is not something a refactor gets to do on its own. Tightening
 *   it — treating the separators-only case as a misconfiguration and failing
 *   the boot loudly — is a deliberate decision for its own change.
 */
function resolveAllowedOrigins(): string[] | null {
  const raw = Deno.env.get('NW_ALLOWED_ORIGINS');
  if (!raw) {
    console.warn(
      '[CORS] NW_ALLOWED_ORIGINS is not set — falling back to permissive ' +
        'origin reflection. Set NW_ALLOWED_ORIGINS to lock this down ' +
        '(see Guidelines §12.4).',
    );
    return null;
  }

  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

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
        if (!allowedOrigins) return origin; // permissive fallback (see above)
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
      ],
      exposeHeaders: ['x-request-id'],
      credentials: false,
      maxAge: 86400,
    }),
  );

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
