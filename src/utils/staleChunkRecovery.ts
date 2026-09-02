/**
 * Detect stale-deploy chunk failures and recover with a single reload.
 *
 * After a frontend deploy, an old tab or service-worker shell can import a
 * module graph that no longer exists. React.lazy then resolves to `undefined`
 * and production React throws `Cannot read properties of undefined (reading
 * 'default')`. That is the same class of failure as `ChunkLoadError` — not a
 * product bug — and should reload once instead of filling Issue Manager.
 *
 * The app's own `.then((m) => ({ default: m.SomeComponent }))` lazy-loading
 * idiom (used throughout, not just for the outer `default`) throws the same
 * TypeError but naming the re-exported component instead: `reading
 * 'ResourcesModule'`, `reading 'NotesModule'`, etc. Every top-level lazy
 * export in this codebase (AdminDashboardPage.tsx, AppRoutes.tsx, and every
 * module barrel) follows the same `*Module` / `*Page` naming convention —
 * confirmed by grepping every `.SomeName` access matching that shape in the
 * whole source tree, which is exclusively these lazy-loaded components —
 * so matching on that suffix (not just any capitalised identifier) catches
 * the stale-deploy case without swallowing an unrelated genuine crash that
 * happens to read an undefined PascalCase property, e.g. a third-party
 * `somePdfLib.GlobalWorkerOptions.workerSrc = ...` failing for a real
 * reason.
 */

const RELOAD_KEY = 'navigate-wealth:chunk-load-reload-at';
const RELOAD_WINDOW_MS = 60_000;

const STALE_CHUNK_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /chunkloaderror/i,
  /[Cc]annot read propert(?:y|ies) of undefined \(reading ["'](?:default|[A-Z][A-Za-z0-9]*(?:Module|Page))["']\)/,
];

function errorText(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name} ${value.message}`;
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value ?? '');
}

export function isStaleChunkLoadFailure(value: unknown): boolean {
  const text = errorText(value);
  return STALE_CHUNK_PATTERNS.some((pattern) => pattern.test(text));
}

/** Reload once inside a 60s window. Returns true if a reload was triggered. */
export function reloadOnceForStaleChunk(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const now = Date.now();
    const lastReload = Number(window.sessionStorage.getItem(RELOAD_KEY) || '0');

    if (Number.isFinite(lastReload) && now - lastReload < RELOAD_WINDOW_MS) {
      return false;
    }

    window.sessionStorage.setItem(RELOAD_KEY, String(now));
    window.location.reload();
    return true;
  } catch {
    window.location.reload();
    return true;
  }
}
