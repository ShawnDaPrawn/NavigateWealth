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

  it('does not swallow unrelated runtime errors', () => {
    expect(
      isStaleChunkLoadFailure(
        new TypeError("Cannot read properties of undefined (reading 'NotesModule')"),
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
