/**
 * Builds the Edge Function's Hono app.
 *
 * Split out of index.tsx (roadmap §5.4 / A18) so that constructing the app and
 * serving it are separate acts. index.tsx is now `Deno.serve(createApp().fetch)`
 * and nothing else, which means a test can build an app and send requests into
 * it without a socket ever being opened. Before this split the root `onError`
 * handler, the health probes and the boot-time mount behaviour could not be
 * reached by any test, because importing the module WAS starting the server.
 *
 * Security posture (Guidelines §12.4):
 *   - CORS origin is locked down to NW_ALLOWED_ORIGINS (comma-separated).
 *     If the env var is unset, startup logs a warning and reflects browser
 *     origins so production cannot be bricked by missing configuration.
 *   - Health endpoints are the ONLY routes that can be reached without a
 *     bearer token; every other sub-router applies `requireAuth` (or a stricter
 *     equivalent) at sub-router scope.
 *   - Every response carries an `x-request-id` header (Phase 1 §22).
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';

import { runWithRequestContext } from './request-context.ts';
import { mountCoreRoutes } from './mount-core.ts';
import { mountFnaRoutes } from './mount-fna.ts';
import { mountModuleRoutes } from './mount-modules.ts';

export function createApp(): Hono {
  const app = new Hono();

  /**
   * Route groups that threw while mounting.
   *
   * Local to this call, not module state: two isolates (or two tests) building
   * apps must never see each other's boot problems.
   */
  const failedMounts: string[] = [];

  // ── CORS ──────────────────────────────────────────────────────────────────
  // Allow-list from environment (Guidelines §12.4 / Phase 0.3).
  // Set `NW_ALLOWED_ORIGINS` in Supabase as a comma-separated list, e.g.
  //   NW_ALLOWED_ORIGINS="https://www.navigatewealth.co,https://navigatewealth.co"
  //
  // IMPORTANT — fail-OPEN fallback (deliberately):
  //   When `NW_ALLOWED_ORIGINS` is unset we reflect any origin and log a
  //   prominent warning every boot. CORS is defence-in-depth — every
  //   non-health route still requires a valid bearer token (`requireAuth`),
  //   so a permissive CORS default cannot by itself leak data. Failing
  //   closed on CORS would silently break every browser client (the
  //   incident captured on 2026-04-18 — dashboard "Network error" + super-
  //   admin lockout). Operators MUST set the env var before relying on the
  //   strict allow-list as a security boundary.
  const rawAllowedOrigins = Deno.env.get('NW_ALLOWED_ORIGINS');
  const allowedOrigins: string[] | null = rawAllowedOrigins
    ? rawAllowedOrigins
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  if (!allowedOrigins) {
    console.warn(
      '[CORS] NW_ALLOWED_ORIGINS is not set — falling back to permissive ' +
        'origin reflection. Set NW_ALLOWED_ORIGINS to lock this down ' +
        '(see Guidelines §12.4).',
    );
  }

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

  // ── Request-ID middleware (Guidelines §22 — Observability) ────────────────
  app.use('*', async (c, next) => {
    const incoming = c.req.header('x-request-id');
    const requestId =
      incoming && /^[A-Za-z0-9_-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
    c.set('requestId', requestId);
    // Everything downstream — including sub-routers dispatched by lazy-router via
    // router.fetch(), which run inside this same async chain — now logs with this
    // id attached (Stage B / B4). Degrades to today's behaviour if the deployed
    // runtime lacks node:async_hooks.
    await runWithRequestContext({ requestId }, () => next());
    c.header('x-request-id', requestId);
  });

  // ── Root error handler (Stage B / B1) ─────────────────────────────────────
  // Covers the routes this app dispatches ITSELF: the health probes above and
  // any throw inside lazy-router's own proxy handler. It deliberately does NOT
  // cover the ~584 routes behind the lazy mounts — those sub-routers are invoked
  // with `router.fetch()`, so each one handles its own errors internally and
  // nothing propagates here. lazy-router installs the same shared handler on
  // each of them at cache time instead; see the note at the top of that file.
  //
  // `error.middleware.ts` is imported dynamically so it (and `npm:zod`, the
  // stderr logger and the quality-issues recorder) stay out of the boot payload
  // this file exists to keep minimal.
  app.onError(async (err, c) => {
    const requestId = c.get('requestId');
    let response: Response;
    try {
      const { errorHandler } = await import('./error.middleware.ts');
      response = await errorHandler(err, c);
    } catch (handlerError: unknown) {
      // The safety net must not itself become the failure. Fall back to a plain
      // JSON 500 rather than letting Deno.serve emit an opaque one.
      console.error(
        '[ERROR] Shared error handler failed:',
        handlerError instanceof Error ? handlerError.message : handlerError,
      );
      response = Response.json(
        { message: 'An unexpected error occurred', code: 'INTERNAL_ERROR', requestId },
        { status: 500 },
      );
    }
    // The request-id middleware above stamps the header AFTER `await next()`,
    // which never runs when the handler throws — so stamp it here instead.
    if (typeof requestId === 'string') response.headers.set('x-request-id', requestId);
    return response;
  });

  // ── Health checks (unauthenticated) ───────────────────────────────────────
  // Only these two endpoints are reachable without a bearer token.
  app.get('/make-server-91ed8379', (c) =>
    c.json({
      status: 'ok',
      version: '4.1.0',
      requestId: c.get('requestId'),
    }),
  );

  // Liveness probe — static, never touches downstream services.
  app.get('/make-server-91ed8379/health', (c) =>
    c.json({
      status: 'healthy',
      version: '4.1.0',
      requestId: c.get('requestId'),
    }),
  );

  // Readiness probe — answers "can this instance serve traffic?"
  // (Guidelines §22 — Observability / Phase 1.5).
  //
  // Two independent ways to be unready, and both must be reported: the KV store
  // is unreachable, or a route group failed to mount at boot. The second used to
  // be invisible here, which made this probe actively misleading — see the note
  // on `failedMounts` below.
  app.get('/make-server-91ed8379/health/ready', async (c) => {
    let kvOk = true;
    let kvError: string | undefined;
    try {
      const kv = await import('./kv_store.tsx');
      // Trivial round-trip: read a sentinel key (returns null if missing — that's fine).
      await kv.get('__readiness_probe__');
    } catch (error) {
      kvOk = false;
      kvError = error instanceof Error ? error.message : 'unknown';
    }

    const mountsOk = failedMounts.length === 0;
    if (kvOk && mountsOk) {
      return c.json({
        status: 'ready',
        version: '4.1.0',
        requestId: c.get('requestId'),
        checks: { kv: 'ok', mounts: 'ok' },
      });
    }

    return c.json(
      {
        status: 'unready',
        version: '4.1.0',
        requestId: c.get('requestId'),
        checks: { kv: kvOk ? 'ok' : 'fail', mounts: mountsOk ? 'ok' : 'fail' },
        ...(failedMounts.length > 0 && { failedMounts: [...failedMounts] }),
        ...(kvError !== undefined && { error: kvError }),
      },
      503,
    );
  });

  // ── Mount the route groups ────────────────────────────────────────────────
  // A group that throws must not take the isolate down with it: the groups that
  // DID mount keep serving. But it must not pass unnoticed either, which is what
  // used to happen — the failure was logged and forgotten, the app booted with
  // entire route groups missing, and the readiness probe still answered "ready"
  // because it only checked KV. A load balancer saw a healthy instance and kept
  // routing traffic it could not serve. `failedMounts` is what the probe reads.
  for (const [name, mount] of [
    ['core', mountCoreRoutes],
    ['fna', mountFnaRoutes],
    ['modules', mountModuleRoutes],
  ] as const) {
    try {
      mount(app);
    } catch (error: unknown) {
      failedMounts.push(name);
      console.error(
        `[BOOT] Failed to register ${name} routes:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return app;
}
