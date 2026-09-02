import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('does not swallow unrelated runtime errors', () => {
    // A lowercase business-data field read on undefined is a real bug, not
    // a stale-chunk failure — only PascalCase component/module exports (or
    // `default`) are ever the right-hand side of the lazy-loading idiom.
    expect(
      isStaleChunkLoadFailure(
        new TypeError("Cannot read properties of undefined (reading 'name')"),
      ),
    ).toBe(false);
    expect(isStaleChunkLoadFailure(new Error('RoA draft not found'))).toBe(false);
    expect(isStaleChunkLoadFailure(null)).toBe(false);
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
