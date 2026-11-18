/**
 * Pure stale-deploy chunk detection.
 *
 * Lives here, with no browser or React imports, so the Edge Function can
 * decide that a stored report is a stale chunk. The reload behaviour stays
 * in `src/utils/staleChunkRecovery.ts`, which re-exports these matchers.
 *
 * Definitive patterns are safe to reload and to drop from Issue Manager.
 * Minified React errors #283 and #306 are NOT definitive: this codebase has
 * also hit a genuine #306 by double-wrapping a lazy export, so those still
 * reload but keep being reported.
 */

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
  'Route',
  'Section',
  'Selection',
  'Step',
  'Studio',
  'Subscribers',
  'Tab',
  'Tool',
  'View',
  'Viewer',
  'Wizard',
];

const DEFINITIVE_STALE_CHUNK_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /chunkloaderror/i,
  new RegExp(
    `[Cc]annot read propert(?:y|ies) of undefined \\(reading ["'](?:default|[A-Z][A-Za-z0-9]*(?:${LAZY_EXPORT_SUFFIXES.join('|')}))["']\\)`,
  ),
];

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
 * True only for the patterns that can only mean a stale chunk. Use this to
 * decide whether to skip Issue Manager. The ambiguous #283/#306 case should
 * still reload but keeps being reported.
 */
export function isDefinitiveStaleChunkLoadFailure(value: unknown): boolean {
  const text = errorText(value);
  return DEFINITIVE_STALE_CHUNK_PATTERNS.some((pattern) => pattern.test(text));
}
