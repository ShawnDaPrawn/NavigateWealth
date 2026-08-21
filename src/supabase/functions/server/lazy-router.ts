/**
 * Lazy Router - Dynamic Import Proxy for Hono Sub-Routers
 *
 * Converts static route imports to on-demand dynamic imports.
 * Each route module is loaded only when the first request hits its path prefix,
 * dramatically reducing boot time and initial memory footprint.
 *
 * This is critical for Supabase Edge Function deployment limits.
 *
 * ── Error handling (Stage B / B1) ────────────────────────────────────────────
 * Sub-routers are dispatched with `router.fetch(...)`, i.e. each one is its OWN
 * Hono instance that handles errors internally and returns its own Response.
 * Nothing throws back out here, so an `app.onError(...)` on the PARENT app in
 * index.tsx can never see them — it would cover the three health routes and
 * none of the ~584 routes behind these mounts. A try/catch around
 * `router.fetch()` fails for the same reason: there is no throw to catch.
 *
 * The fix that does work is to install the shared handler on the sub-router
 * itself, once, at cache time (see `attachSharedErrorHandler` below).
 */

import { Hono } from 'npm:hono';
import type { Context } from 'npm:hono';

const PREFIX = '/make-server-91ed8379';

/**
 * The shape lazy-mounted modules actually export. Every one of them is a
 * `new Hono()` instance (verified across all 73 modules reachable from the
 * mount-*.ts registrars), but they are typed structurally so the mount files
 * can keep passing bare `() => import('./x.ts')` without their differing Hono
 * generic parameters having to line up.
 *
 * Deliberately UNCHANGED from before B1: the error-handling members live in
 * `HonoErrorSurface` below rather than being added here. Hono declares
 * `errorHandler` as `private`, and TypeScript compares private members
 * NOMINALLY — so merely mentioning it in this type makes every `Hono` instance
 * structurally incompatible and breaks all 77 `lazy(...)` call sites
 * (measured: `deno check` went 34 -> 111 errors on the first attempt).
 */
type LazyRouterModule = {
  fetch: (req: Request) => Response | Promise<Response>;
};

/**
 * Hono's error-handling surface, reached by an explicit cast at the one place
 * that needs it (see the note above for why it cannot go on LazyRouterModule).
 *
 * `errorHandler` is private in Hono's published types even though Hono itself
 * reads it as `app.errorHandler` in its own `mount()` implementation. That
 * makes it stable runtime surface but not a supported type-level contract, so
 * `lazy-router.test.ts` asserts the sentinel comparison below still works — a
 * Hono upgrade that renames it fails CI instead of silently disabling the
 * safety net.
 */
type HonoErrorSurface = {
  onError?: (handler: (err: Error, c: Context) => Response | Promise<Response>) => unknown;
  errorHandler?: unknown;
};

const routerCache = new Map<string, LazyRouterModule>();
// Prevents duplicate concurrent imports when multiple requests hit the same
// cold module simultaneously (thundering-herd dedup).
const pendingImports = new Map<string, Promise<void>>();

/**
 * Hono's built-in error handler, read off a throwaway instance. Hono assigns
 * the same module-level function to every new app, so identity comparison
 * against it is an exact test for "this router has NOT set its own handler".
 *
 * Captured lazily and memoised: constructing this at module scope would add
 * boot work to a file that is deliberately part of the minimal boot payload.
 */
let honoDefaultErrorHandler: unknown;

function usesHonoDefaultErrorHandler(router: HonoErrorSurface): boolean {
  if (honoDefaultErrorHandler === undefined) {
    honoDefaultErrorHandler = (new Hono() as unknown as HonoErrorSurface).errorHandler;
  }
  // If the sentinel could not be captured, fail SAFE: leave the router alone
  // rather than clobbering a handler we can no longer detect.
  if (honoDefaultErrorHandler === undefined) return false;
  return router.errorHandler === honoDefaultErrorHandler;
}

/**
 * Give a freshly-imported sub-router the shared error handler, so an
 * unanticipated throw becomes a structured JSON 500 that is logged and recorded
 * to the quality-issues pipeline instead of Hono's bare "Internal Server Error"
 * text with no telemetry.
 *
 * Two deliberate properties:
 *
 *  - A router that already called `.onError(...)` KEEPS its own handler
 *    (honeycomb-routes.ts is the one such router today). Silently overwriting
 *    another module's explicit choice is precisely the class of bug this work
 *    exists to remove.
 *  - `error.middleware.ts` is imported DYNAMICALLY, not at the top of this
 *    file. This module is loaded at boot, and a static import would pull
 *    error.middleware plus `npm:zod`, the stderr logger and the quality-issues
 *    recorder into the boot payload that the lazy-mount architecture exists to
 *    keep small. By the time this runs we are already loading a route module,
 *    ~50 of which import error.middleware anyway.
 *
 * Fails OPEN: if the handler cannot be loaded or attached, the route still
 * serves. A missing safety net must never take down the thing it protects.
 */
async function attachSharedErrorHandler(router: LazyRouterModule, path: string): Promise<void> {
  try {
    const hono = router as unknown as HonoErrorSurface;
    if (typeof hono.onError !== 'function') return;
    if (!usesHonoDefaultErrorHandler(hono)) return;
    const { errorHandler } = await import('./error.middleware.ts');
    hono.onError(errorHandler);
  } catch (err: unknown) {
    console.error(
      `[LAZY] Could not attach shared error handler to ${path}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Register a lazily-loaded Hono sub-router at the given path.
 * The module is imported on first request and cached for subsequent requests.
 * Concurrent requests for the same unloaded module share a single import promise.
 *
 * @param app - The parent Hono app
 * @param path - The sub-path (without PREFIX), e.g. '/esign'
 * @param load - A function that returns a dynamic import, e.g. () => import('./esign-routes.ts')
 */
export function lazy(app: Hono, path: string, load: () => Promise<{ default: LazyRouterModule }>) {
  const base = `${PREFIX}${path}`;

  const handler = async (c: Context) => {
    if (!routerCache.has(base)) {
      // Dedup: if another request is already importing this module, await it
      if (!pendingImports.has(base)) {
        const importPromise = load()
          .then(async (mod) => {
            await attachSharedErrorHandler(mod.default, path);
            routerCache.set(base, mod.default);
          })
          .catch((err: unknown) => {
            console.error(
              `[LAZY] Failed to load module ${path}:`,
              err instanceof Error ? err.message : err,
            );
            throw err;
          })
          .finally(() => {
            pendingImports.delete(base);
          });
        pendingImports.set(base, importPromise);
      }

      try {
        await pendingImports.get(base);
      } catch (err: unknown) {
        return c.json(
          {
            error: `Failed to load module: ${path}`,
            details: err instanceof Error ? err.message : String(err),
          },
          500,
        );
      }
    }

    const router = routerCache.get(base)!;

    // Strip the base path so the sub-router can match its own routes.
    // e.g. /make-server-91ed8379/esign/envelopes → /envelopes
    const url = new URL(c.req.url);
    url.pathname = url.pathname.substring(base.length) || '/';

    const subRequest = new Request(url.toString(), c.req.raw);

    // Carry the request id across the dispatch boundary. The sub-router is a
    // separate Hono instance with its own Context, so the `c.set('requestId')`
    // done by index.tsx's middleware is NOT visible inside it; without this the
    // shared error handler would record every one of these routes' failures
    // with no correlation id. The header is the transport, and an id the caller
    // supplied is never overwritten.
    const requestId = c.get('requestId');
    if (typeof requestId === 'string' && !subRequest.headers.has('x-request-id')) {
      subRequest.headers.set('x-request-id', requestId);
    }

    return router.fetch(subRequest);
  };

  // Register both exact-match and wildcard to cover all cases:
  //   /make-server-91ed8379/esign       → exact match (sub-router sees '/')
  //   /make-server-91ed8379/esign/...   → wildcard match
  app.all(`${base}`, handler);
  app.all(`${base}/*`, handler);
}
