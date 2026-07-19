/**
 * Tests for the chunk-load recovery helpers.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { isChunkLoadError, reloadOnceForChunkLoadFailure } from '../chunkLoad';

describe('isChunkLoadError', () => {
  it('matches Chrome/Edge dynamic import failures', () => {
    expect(
      isChunkLoadError(new Error('Failed to fetch dynamically imported module: https://x/y.js')),
    ).toBe(true);
  });

  it('matches Safari module-script failures', () => {
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
  });

  it('matches Firefox dynamic import failures', () => {
    expect(
      isChunkLoadError(new Error('error loading dynamically imported module: https://x/y.js')),
    ).toBe(true);
  });

  it('matches bundler-style ChunkLoadError and "Loading chunk N failed"', () => {
    expect(isChunkLoadError(new Error('ChunkLoadError: something'))).toBe(true);
    expect(isChunkLoadError('Loading chunk 42 failed')).toBe(true);
  });

  it('accepts plain strings as well as Error instances', () => {
    expect(isChunkLoadError('Failed to fetch dynamically imported module: a.js')).toBe(true);
  });

  it('does not match unrelated errors', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError(new TypeError('NetworkError when attempting to fetch resource'))).toBe(
      false,
    );
  });
});

describe('reloadOnceForChunkLoadFailure', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.sessionStorage.clear();
    reloadSpy = vi.fn();
    // jsdom's location.reload is not implemented; replace it.
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it('reloads the first time and records the timestamp', () => {
    const result = reloadOnceForChunkLoadFailure();
    expect(result).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('does not reload again within the throttle window', () => {
    expect(reloadOnceForChunkLoadFailure()).toBe(true);
    expect(reloadOnceForChunkLoadFailure()).toBe(false);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('reloads again once the throttle window has elapsed', () => {
    const now = 1_000_000;
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(now);
    expect(reloadOnceForChunkLoadFailure()).toBe(true);

    nowSpy.mockReturnValue(now + 61_000);
    expect(reloadOnceForChunkLoadFailure()).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(2);
  });
});
