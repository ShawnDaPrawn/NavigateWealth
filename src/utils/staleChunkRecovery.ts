/**
 * Detect stale-deploy chunk failures and recover with a single reload.
 *
 * After a frontend deploy, an old tab or service-worker shell can import a
 * module graph that no longer exists. React.lazy then resolves to `undefined`
 * and production React throws `Cannot read properties of undefined (reading
 * 'default')`. That is the same class of failure as `ChunkLoadError` — not a
 * product bug — and should reload once instead of filling Issue Manager.
 */

const RELOAD_KEY = 'navigate-wealth:chunk-load-reload-at';
const RELOAD_WINDOW_MS = 60_000;

const STALE_CHUNK_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /chunkloaderror/i,
  /cannot read propert(?:y|ies) of undefined \(reading ['"]default['"]\)/i,
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
