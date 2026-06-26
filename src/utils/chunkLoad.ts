/**
 * Shared helpers for recovering from dynamic-import ("chunk load") failures.
 *
 * Every page in the app is code-split via `React.lazy`, so each navigation
 * fetches a JS chunk on demand. Two real-world conditions make that fetch fail:
 *
 *   1. A transient network blip (common on mobile data and inside the installed
 *      PWA) drops the request for a route's chunk.
 *   2. A new version was deployed while the user's tab was open, so the old app
 *      shell references chunk hashes that no longer exist on the server.
 *
 * Without handling, a single failed request surfaces to the nearest error
 * boundary and shows a scary "Page Error" card. These helpers let us retry the
 * import in place (case 1) and, as a last resort, reload once to pick up the new
 * shell (case 2) — all without flashing an error message at the user.
 */

const CHUNK_LOAD_RELOAD_KEY = 'navigate-wealth:chunk-load-reload-at';
const CHUNK_LOAD_RELOAD_WINDOW_MS = 60_000;

/**
 * Detects the browser-specific error messages produced when a dynamically
 * imported module (ES module chunk) fails to load.
 */
export function isChunkLoadError(value: unknown): boolean {
  const message =
    value instanceof Error
      ? `${value.name} ${value.message}`
      : typeof value === 'string'
        ? value
        : String(value ?? '');

  return (
    // Chrome / Edge
    message.includes('Failed to fetch dynamically imported module') ||
    // Safari
    message.includes('Importing a module script failed') ||
    // Firefox
    message.includes('error loading dynamically imported module') ||
    // Generic / bundler conventions
    message.includes('ChunkLoadError') ||
    /loading chunk \d+ failed/i.test(message)
  );
}

/**
 * Reloads the page at most once per {@link CHUNK_LOAD_RELOAD_WINDOW_MS} window to
 * recover from a stale deploy. The throttle (persisted in sessionStorage) is the
 * critical safety valve: it prevents an infinite reload loop when a chunk is
 * genuinely and permanently unavailable.
 *
 * @returns true if a reload was triggered, false if suppressed by the throttle.
 */
export function reloadOnceForChunkLoadFailure(): boolean {
  try {
    const now = Date.now();
    const lastReload = Number(window.sessionStorage.getItem(CHUNK_LOAD_RELOAD_KEY) || '0');

    if (Number.isFinite(lastReload) && now - lastReload < CHUNK_LOAD_RELOAD_WINDOW_MS) {
      return false;
    }

    window.sessionStorage.setItem(CHUNK_LOAD_RELOAD_KEY, String(now));
    window.location.reload();
    return true;
  } catch {
    // sessionStorage can throw (private mode / disabled storage). Reloading once
    // is still better than showing an error, so fall through to a plain reload.
    window.location.reload();
    return true;
  }
}
