/**
 * Tests for useImagePrefetch hook and prefetchImages function.
 * Uses fake timers to control setTimeout delays.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImagePrefetch, prefetchImages } from '../useImagePrefetch';

// ── Image mock ────────────────────────────────────────────────────────────────

const createdImages: { src: string; decoding: string; loading: string }[] = [];

class MockImage {
  src: string = '';
  decoding: string = '';
  loading: string = '';

  constructor() {
    createdImages.push(this);
  }
}

beforeEach(() => {
  createdImages.length = 0;
  vi.stubGlobal('Image', MockImage);
  vi.useFakeTimers();
  // Default: no data-saving / constrained network
  Object.defineProperty(navigator, 'connection', {
    value: undefined,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ── prefetchImages ────────────────────────────────────────────────────────────

describe('prefetchImages', () => {
  it('creates Image instances for each URL', () => {
    prefetchImages(['a.jpg', 'b.jpg']);
    expect(createdImages.length).toBe(2);
    expect(createdImages[0].src).toBe('a.jpg');
    expect(createdImages[1].src).toBe('b.jpg');
  });

  it('sets decoding to async and loading to eager', () => {
    prefetchImages(['img.jpg']);
    expect(createdImages[0].decoding).toBe('async');
    expect(createdImages[0].loading).toBe('eager');
  });

  it('does nothing when urls is empty', () => {
    prefetchImages([]);
    expect(createdImages.length).toBe(0);
  });

  it('skips prefetch when navigator.connection.saveData is true', () => {
    Object.defineProperty(navigator, 'connection', {
      value: { saveData: true },
      configurable: true,
    });
    prefetchImages(['img.jpg']);
    expect(createdImages.length).toBe(0);
  });

  it('skips prefetch on slow-2g network', () => {
    Object.defineProperty(navigator, 'connection', {
      value: { effectiveType: 'slow-2g' },
      configurable: true,
    });
    prefetchImages(['img.jpg']);
    expect(createdImages.length).toBe(0);
  });

  it('skips prefetch on 2g network', () => {
    Object.defineProperty(navigator, 'connection', {
      value: { effectiveType: '2g' },
      configurable: true,
    });
    prefetchImages(['img.jpg']);
    expect(createdImages.length).toBe(0);
  });

  it('prefetches on 4g network', () => {
    Object.defineProperty(navigator, 'connection', {
      value: { effectiveType: '4g' },
      configurable: true,
    });
    prefetchImages(['img.jpg']);
    expect(createdImages.length).toBe(1);
  });
});

// ── useImagePrefetch ──────────────────────────────────────────────────────────

describe('useImagePrefetch', () => {
  it('does not prefetch immediately on mount — waits for delay', () => {
    renderHook(() => useImagePrefetch(['img.jpg']));
    expect(createdImages.length).toBe(0);
  });

  it('prefetches after the default delay (2500ms)', async () => {
    renderHook(() => useImagePrefetch(['img.jpg']));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(createdImages.length).toBe(1);
  });

  it('respects custom delayMs', async () => {
    renderHook(() => useImagePrefetch(['img.jpg'], { delayMs: 1000 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(createdImages.length).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(createdImages.length).toBe(1);
  });

  it('does not prefetch when enabled is false', async () => {
    renderHook(() => useImagePrefetch(['img.jpg'], { enabled: false }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(createdImages.length).toBe(0);
  });

  it('does not prefetch when urls is empty', async () => {
    renderHook(() => useImagePrefetch([]));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(createdImages.length).toBe(0);
  });

  it('clears timeout on unmount before delay completes', async () => {
    const { unmount } = renderHook(() => useImagePrefetch(['img.jpg']));
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(createdImages.length).toBe(0);
  });
});
