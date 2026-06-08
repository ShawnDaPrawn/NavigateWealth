/**
 * Tests for useImagePreload hook.
 * Mocks the Image constructor to verify URLs are loaded and cleanup works.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useImagePreload } from '../useImagePreload';

// ── Helpers ───────────────────────────────────────────────────────────────────

const createdImages: { src: string }[] = [];

class MockImage {
  src: string = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    createdImages.push(this);
  }
}

beforeEach(() => {
  createdImages.length = 0;
  vi.stubGlobal('Image', MockImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useImagePreload', () => {
  it('creates Image instances for each URL when priority is true', () => {
    renderHook(() => useImagePreload(['img1.jpg', 'img2.jpg']));
    expect(createdImages.length).toBe(2);
    expect(createdImages[0].src).toBe('img1.jpg');
    expect(createdImages[1].src).toBe('img2.jpg');
  });

  it('does not create Image instances when priority is false', () => {
    renderHook(() => useImagePreload(['img1.jpg'], false));
    expect(createdImages.length).toBe(0);
  });

  it('does not create Image instances when imageUrls is empty', () => {
    renderHook(() => useImagePreload([]));
    expect(createdImages.length).toBe(0);
  });

  it('skips falsy URLs', () => {
    renderHook(() => useImagePreload(['', 'valid.jpg', '']));
    expect(createdImages.length).toBe(1);
    expect(createdImages[0].src).toBe('valid.jpg');
  });

  it('default priority is true (preloads when not specified)', () => {
    renderHook(() => useImagePreload(['img.jpg']));
    expect(createdImages.length).toBe(1);
  });

  it('re-runs when imageUrls changes', () => {
    const { rerender } = renderHook(({ urls }) => useImagePreload(urls), {
      initialProps: { urls: ['img1.jpg'] },
    });
    expect(createdImages.length).toBe(1);

    rerender({ urls: ['img1.jpg', 'img2.jpg'] });
    expect(createdImages.length).toBe(3); // 1 from first render + 2 from second
  });
});
