/**
 * Request-scoped context (Stage B / B4)
 * =====================================
 *
 * WHAT THIS SOLVES
 * ----------------
 * ~235 module-scoped loggers (`createModuleLogger('x')`) write lines with no
 * correlation id, so when something fails you cannot tell which request's log
 * lines belong together — on a backend that serves concurrent requests in one
 * isolate. Threading the Hono `Context` through every one of those call sites
 * is a mechanical change across hundreds of files; this reaches all of them at
 * once by putting the id in ambient async state that the logger reads.
 *
 * WHY AsyncLocalStorage AND NOT A MODULE-LEVEL VARIABLE
 * ----------------------------------------------------
 * A module-level `currentRequestId` would be shared by every request the
 * isolate is serving concurrently, so request A's log lines would be stamped
 * with request B's id. That is worse than no id at all: it produces confident,
 * wrong correlation. AsyncLocalStorage keeps a distinct store per async call
 * chain, which is exactly the shape of the problem.
 *
 * Verified under Deno 2.8.1 (the version CI pins): five concurrent `run()`
 * chains each observed only their own store across `await` boundaries, and
 * `getStore()` outside a `run()` returned `undefined`.
 *
 * WHY IT IS FEATURE-DETECTED
 * --------------------------
 * The DEPLOYED target is Supabase's edge runtime, a Deno fork — not stock Deno,
 * and not something this repo can execute. Rather than assert that
 * `node:async_hooks` is present there, this module imports it lazily and falls
 * back to a no-op if it is missing: logs then simply carry no request id, which
 * is today's behaviour. A correlation-id feature must never be able to take
 * down the request path it decorates.
 */

export interface RequestContext {
  requestId: string;
}

/** The subset of AsyncLocalStorage this module uses. */
interface AsyncStore {
  run<T>(store: RequestContext, fn: () => T): T;
  getStore(): RequestContext | undefined;
}

/**
 * Resolved AsyncLocalStorage instance, or null once we know it is unavailable.
 *
 * Module-level on purpose, and safe: the INSTANCE is shared, the STORE it hands
 * out is per-async-context. Sharing the instance is how AsyncLocalStorage is
 * meant to be used; sharing the request id would be the bug described above.
 */
let store: AsyncStore | null = null;
let initialisation: Promise<void> | null = null;

async function ensureInitialised(): Promise<void> {
  if (store !== null || initialisation !== null) {
    await initialisation;
    return;
  }
  initialisation = (async () => {
    try {
      const mod = await import('node:async_hooks');
      store = new mod.AsyncLocalStorage() as unknown as AsyncStore;
    } catch (err: unknown) {
      // Degrade, loudly enough that an operator can find it, once per isolate.
      console.error(
        '[REQUEST-CONTEXT] node:async_hooks unavailable — log lines will carry no ' +
          'request id. This is a degradation, not a failure:',
        err instanceof Error ? err.message : err,
      );
      store = null;
    }
  })();
  await initialisation;
}

/**
 * Run `fn` with `context` visible to `getRequestContext()` for the whole async
 * chain beneath it — including sub-routers dispatched via `router.fetch()`,
 * which run inside this same chain.
 */
export async function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  await ensureInitialised();
  if (!store) return fn();
  return store.run(context, fn);
}

/**
 * The current request's context, or undefined outside a request.
 *
 * Synchronous by necessity — the logger's formatting path is synchronous, and
 * making it async would change every log call site, which is the cost this
 * module exists to avoid. Safe because any log emitted during a request happens
 * after `runWithRequestContext` has already awaited initialisation.
 */
export function getRequestContext(): RequestContext | undefined {
  return store?.getStore();
}

/** Test seam: forget the resolved instance so a test can exercise both paths. */
export function __resetRequestContextForTests(): void {
  store = null;
  initialisation = null;
}
