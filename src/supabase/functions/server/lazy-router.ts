/**
 * Lazy Router - Dynamic Import Proxy for Hono Sub-Routers
 * 
 * Converts static route imports to on-demand dynamic imports.
 * Each route module is loaded only when the first request hits its path prefix,
 * dramatically reducing boot time and initial memory footprint.
 * 
 * This is critical for Supabase Edge Function deployment limits.
 */

import type { Hono, Context } from 'npm:hono';

const PREFIX = '/make-server-91ed8379';
const routerCache = new Map<string, { fetch: (req: Request) => Response | Promise<Response> }>();
// Prevents duplicate concurrent imports when multiple requests hit the same
// cold module simultaneously (thundering-herd dedup).
const pendingImports = new Map<string, Promise<void>>();

/**
 * Register a lazily-loaded Hono sub-router at the given path.
 * The module is imported on first request and cached for subsequent requests.
 * Concurrent requests for the same unloaded module share a single import promise.
 * 
 * @param app - The parent Hono app
 * @param path - The sub-path (without PREFIX), e.g. '/esign'
 * @param load - A function that returns a dynamic import, e.g. () => import('./esign-routes.ts')
 */
export function lazy(app: Hono, path: string, load: () => Promise<{ default: { fetch: (req: Request) => Response | Promise<Response> } }>) {
  const base = `${PREFIX}${path}`;

  const handler = async (c: Context) => {
    if (!routerCache.has(base)) {
      // Dedup: if another request is already importing this module, await it
      if (!pendingImports.has(base)) {
        const importPromise = load()
          .then((mod) => {
            routerCache.set(base, mod.default);
          })
          .catch((err: unknown) => {
            console.error(`[LAZY] Failed to load module ${path}:`, err instanceof Error ? err.message : err);
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
          { error: `Failed to load module: ${path}`, details: err instanceof Error ? err.message : String(err) },
          500,
        );
      }
    }

    const router = routerCache.get(base)!;

    // Strip the base path so the sub-router can match its own routes.
    // e.g. /make-server-91ed8379/esign/envelopes → /envelopes
    const url = new URL(c.req.url);
    url.pathname = url.pathname.substring(base.length) || '/';

    return router.fetch(new Request(url.toString(), c.req.raw));
  };

  // Register both exact-match and wildcard to cover all cases:
  //   /make-server-91ed8379/esign       → exact match (sub-router sees '/')
  //   /make-server-91ed8379/esign/...   → wildcard match
  app.all(`${base}`, handler);
  app.all(`${base}/*`, handler);
}