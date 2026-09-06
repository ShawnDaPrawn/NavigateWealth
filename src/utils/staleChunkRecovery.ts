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
 * export in this codebase follows a `*<Suffix>` naming convention, but that
 * suffix is not just `Module` / `Page` — dialogs, tabs, wizards, managers,
 * drawers and more all go through this same idiom. Matching a fixed suffix
 * list (not just any capitalised identifier) catches the stale-deploy case
 * without swallowing an unrelated genuine crash that happens to read an
 * undefined PascalCase property, e.g. a third-party
 * `somePdfLib.GlobalWorkerOptions.workerSrc = ...` failing for a real
 * reason.
 *
 * The suffix list is exactly the set found by scanning every
 * `.then((m) => ({ default: m.<Name> }))` call (the `.then(...)` can wrap
 * onto its own line — the scan tolerates that, it is not a single-line grep).
 * `src/utils/__tests__/staleChunkRecovery.test.ts` re-runs that scan and
 * fails if a new lazy export uses a suffix not covered here, so this list
 * cannot rot the way the old two-suffix version did.
 *
 * Production React ships minified, so the same failure can also surface as
 * React's own invariant instead of a raw property-read TypeError: when the
 * `{ default: undefined }` shape above reaches `React.lazy` itself (rather
 * than the app's `.then()` callback throwing first), React throws its own
 * "Element type is invalid. Received a promise that resolves to: undefined.
 * Lazy element type must resolve to a class or function." — minified error
 * #306 (or #283 for a bare `<SomePromise />` element).
 *
 * Unlike every pattern above, #283/#306 are NOT treated as definitive: this
 * codebase has also hit a genuine (non-stale) #306 by double-wrapping a
 * module barrel's own `lazy()` export in a second `React.lazy` at the call
 * site — see `src/components/pages/__tests__/noDoubleLazy.test.ts`, which
 * guards against that specific shape but cannot cover every way a `.then()`
 * callback could resolve to a non-component. So #283/#306 still trigger the
 * one-time reload (harmless either way, and fixes the real stale-chunk case
 * immediately), but — unlike the definitive patterns — the caller keeps
 * reporting it to Issue Manager: `isDefinitiveStaleChunkLoadFailure` is what
 * distinguishes "safe to reload AND silently drop" from "reload, but still
 * worth telling someone if it keeps happening."
 */

const RELOAD_KEY = 'navigate-wealth:chunk-load-reload-at';
const RELOAD_WINDOW_MS = 60_000;

// Suffixes used by this codebase's lazy-loaded `.then((m) => ({ default:
// m.<Name> }))` exports. See the module-level comment above for how this
// list is derived and kept honest.
const LAZY_EXPORT_SUFFIXES = [
  'Builder',
  'Dashboard',
  'Dialog',
  'Drawer',
  'Form',
  'Full',
  'Gathering',
  'Generator',
  'Handoff',
  'History',
  'Insights',
  'Inspector',
  'Interface',
  'Manager',
  'Modal',
  'Module',
  'Page',
  'Panel',
  'Picker',
  'Queue',
  'Renderer',
  'Repository',
  'Section',
  'Step',
  'Studio',
  'Subscribers',
  'Tab',
  'Tool',
  'View',
  'Viewer',
  'Wizard',
];

// These mean "definitely a stale chunk" — safe to reload AND to skip
// reporting entirely.
const DEFINITIVE_STALE_CHUNK_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /chunkloaderror/i,
  new RegExp(
    `[Cc]annot read propert(?:y|ies) of undefined \\(reading ["'](?:default|[A-Z][A-Za-z0-9]*(?:${LAZY_EXPORT_SUFFIXES.join('|')}))["']\\)`,
  ),
];

// Minified React errors #283 and #306: a promise (from React.lazy or a bare
// promise-as-element) resolved to something other than a class or function.
// Ambiguous — see the module comment above for why this is not definitive.
const AMBIGUOUS_LAZY_INVARIANT_PATTERN = /minified react error #(?:283|306)\b/i;

function errorText(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name} ${value.message}`;
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value ?? '');
}

/** True for a definitive OR ambiguous stale-chunk shape — use this to decide whether to reload. */
export function isStaleChunkLoadFailure(value: unknown): boolean {
  const text = errorText(value);
  return (
    DEFINITIVE_STALE_CHUNK_PATTERNS.some((pattern) => pattern.test(text)) ||
    AMBIGUOUS_LAZY_INVARIANT_PATTERN.test(text)
  );
}

/**
 * True only for the patterns that can *only* mean a stale chunk. Use this to
 * decide whether to also skip reporting to Issue Manager — the ambiguous
 * #283/#306 case should still reload (see `isStaleChunkLoadFailure`) but
 * keeps being reported, since it can also be a genuine miswiring bug that a
 * reload will not fix and that would otherwise go completely unreported.
 */
export function isDefinitiveStaleChunkLoadFailure(value: unknown): boolean {
  const text = errorText(value);
  return DEFINITIVE_STALE_CHUNK_PATTERNS.some((pattern) => pattern.test(text));
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
