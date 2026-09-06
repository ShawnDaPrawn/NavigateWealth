import { afterEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isStaleChunkLoadFailure, reloadOnceForStaleChunk } from '../staleChunkRecovery';

describe('isStaleChunkLoadFailure', () => {
  it('matches Vite/webpack chunk-load messages', () => {
    expect(isStaleChunkLoadFailure(new Error('Failed to fetch dynamically imported module'))).toBe(
      true,
    );
    expect(isStaleChunkLoadFailure('Importing a module script failed')).toBe(true);
    expect(isStaleChunkLoadFailure(new Error('ChunkLoadError: Loading chunk 3 failed'))).toBe(true);
  });

  it('matches the production React.lazy missing-default throw after a stale deploy', () => {
    expect(
      isStaleChunkLoadFailure(
        new TypeError("Cannot read properties of undefined (reading 'default')"),
      ),
    ).toBe(true);
    expect(isStaleChunkLoadFailure('Cannot read property of undefined (reading "default")')).toBe(
      true,
    );
  });

  it('matches the same missing-default throw for named lazy-loaded exports', () => {
    // The app's `.then((m) => ({ default: m.SomeComponent }))` lazy-loading
    // idiom throws this same TypeError naming the re-exported component
    // (e.g. AdminDashboardPage.tsx's `m.ResourcesModule`) instead of
    // `default` when the dynamically imported module resolves to
    // `undefined` after a stale deploy.
    expect(
      isStaleChunkLoadFailure(
        new TypeError("Cannot read properties of undefined (reading 'ResourcesModule')"),
      ),
    ).toBe(true);
    expect(
      isStaleChunkLoadFailure(
        new TypeError("Cannot read properties of undefined (reading 'NotesModule')"),
      ),
    ).toBe(true);
  });

  it('matches the minified React invariant for a lazy chunk resolving to a non-component', () => {
    // Production React ships minified: when the stale-chunk's `{ default:
    // undefined }` reaches React.lazy itself (instead of the app's `.then()`
    // callback throwing first), React throws its own invariant #306
    // ("Element type is invalid. Received a promise that resolves to:
    // undefined. Lazy element type must resolve to a class or function.")
    // rather than a raw TypeError. #283 is the same failure for a bare
    // promise used directly as an element. Reproduced from a real production
    // report on /admin?module=esign.
    expect(
      isStaleChunkLoadFailure(
        new Error(
          'Minified React error #306; visit https://reactjs.org/docs/error-decoder.html?invariant=306&args[]=%5Bobject%20Object%5D&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.',
        ),
      ),
    ).toBe(true);
    expect(isStaleChunkLoadFailure(new Error('Minified React error #283; visit ...'))).toBe(true);
  });

  it('does not swallow unrelated runtime errors', () => {
    // A lowercase business-data field read on undefined is a real bug, not
    // a stale-chunk failure — only `*Module` / `*Page` component exports
    // (or `default`) are ever the right-hand side of the lazy-loading idiom.
    expect(
      isStaleChunkLoadFailure(
        new TypeError("Cannot read properties of undefined (reading 'name')"),
      ),
    ).toBe(false);
    // A PascalCase property alone isn't enough either: a genuine third-party
    // failure (e.g. pdf.js's `pdfjsLib.GlobalWorkerOptions.workerSrc = ...`
    // running against an undefined namespace) throws this same TypeError
    // shape without being a stale lazy-loaded chunk. Only a suffix this
    // codebase's own lazy exports actually use should match.
    expect(
      isStaleChunkLoadFailure(
        new TypeError("Cannot read properties of undefined (reading 'GlobalWorkerOptions')"),
      ),
    ).toBe(false);
    // Minified React error #130 ("Element type is invalid: expected a
    // string ... or a class/function ... but got: undefined") is the
    // generic invalid-element invariant — it also fires for an ordinary
    // forgotten export or a broken import, not just a stale lazy chunk, so
    // it must not be swallowed the way #283/#306 are.
    expect(isStaleChunkLoadFailure(new Error('Minified React error #130; visit ...'))).toBe(false);
    expect(isStaleChunkLoadFailure(new Error('RoA draft not found'))).toBe(false);
    expect(isStaleChunkLoadFailure(null)).toBe(false);
  });
});

/**
 * Finds every `.then((m) => ({ default: m.<Name> }))` lazy-export name under
 * `src`, the same idiom `isStaleChunkLoadFailure`'s comment documents. This
 * is what keeps the suffix list in staleChunkRecovery.ts honest: a new lazy
 * export whose name ends in a suffix not already covered fails the test
 * below instead of silently going unrecognised the next time a stale deploy
 * throws for it, the way `*Tab` (e.g. EsignTab) did before this suffix list
 * grew past `Module` / `Page`.
 */
function findLazyExportNames(dir: string, names: Set<string> = new Set()): Set<string> {
  const pattern = /\.then\(\(m\) => \(\{ default: m\.([A-Za-z0-9]+)/g;

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue;
      findLazyExportNames(fullPath, names);
      continue;
    }

    // staleChunkRecovery.ts itself only mentions the idiom in prose (the
    // literal string 'SomeComponent'); it is not a lazy-loading call site.
    if (entry.includes('.test.') || entry === 'staleChunkRecovery.ts' || !/\.(ts|tsx)$/.test(entry))
      continue;

    const source = readFileSync(fullPath, 'utf8');
    for (const match of source.matchAll(pattern)) {
      names.add(match[1]);
    }
  }

  return names;
}

describe('the lazy-export suffix list stays complete', () => {
  it('recognises every `.then((m) => ({ default: m.<Name> }))` export currently in src/', () => {
    const repoSrc = resolve(__dirname, '../..');
    const names = findLazyExportNames(repoSrc);

    expect(names.size).toBeGreaterThan(20); // sanity check the scan itself still finds real hits

    const unmatched = [...names].filter(
      (name) =>
        !isStaleChunkLoadFailure(
          new TypeError(`Cannot read properties of undefined (reading '${name}')`),
        ),
    );

    expect(unmatched).toEqual([]);
  });
});

describe('reloadOnceForStaleChunk', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reloads once, then refuses inside the 60s window', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });

    expect(reloadOnceForStaleChunk()).toBe(true);
    expect(reload).toHaveBeenCalledOnce();

    expect(reloadOnceForStaleChunk()).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });
});
