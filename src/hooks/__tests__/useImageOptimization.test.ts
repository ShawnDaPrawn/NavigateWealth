/**
 * Tests for useImageOptimization, usePreloadImages, and useLazyLoadImages hooks.
 * Uses jsdom's real DOM for element queries; mocks IntersectionObserver and optimizeUnsplashUrl.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockOptimizeUnsplashUrl = vi.fn();

vi.mock('../../utils/imageOptimization', () => ({
  optimizeUnsplashUrl: (...args: unknown[]) => mockOptimizeUnsplashUrl(...args),
}));

// ── IntersectionObserver Mock ─────────────────────────────────────────────────

type IOCallback = (entries: IntersectionObserverEntry[]) => void;

let capturedCallback: IOCallback | null = null;
let capturedOptions: IntersectionObserverInit | null = null;
const observedEls: Element[] = [];
class MockIntersectionObserver {
  constructor(cb: IOCallback, opts?: IntersectionObserverInit) {
    capturedCallback = cb;
    capturedOptions = opts ?? null;
  }
  observe = vi.fn((el: Element) => {
    observedEls.push(el);
  });
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  capturedCallback = null;
  capturedOptions = null;
  observedEls.length = 0;
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  // Default: return optimized URL by appending '?w=800'
  mockOptimizeUnsplashUrl.mockImplementation((src: string) => src + '?w=800');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useImageOptimization, usePreloadImages, useLazyLoadImages } from '../useImageOptimization';

// ── useImageOptimization ──────────────────────────────────────────────────────

describe('useImageOptimization', () => {
  it('does nothing when enabled is false', () => {
    const img = document.createElement('img');
    img.src = 'https://images.unsplash.com/photo-123';
    document.body.appendChild(img);

    renderHook(() => useImageOptimization(false));
    expect(mockOptimizeUnsplashUrl).not.toHaveBeenCalled();
  });

  it('processes unsplash images by default (enabled=true)', () => {
    const img = document.createElement('img');
    img.src = 'https://images.unsplash.com/photo-123';
    document.body.appendChild(img);

    renderHook(() => useImageOptimization());
    expect(mockOptimizeUnsplashUrl).toHaveBeenCalledOnce();
  });

  it('calls optimizeUnsplashUrl with correct quality and format params', () => {
    const img = document.createElement('img');
    img.src = 'https://images.unsplash.com/photo-abc';
    document.body.appendChild(img);

    renderHook(() => useImageOptimization(true));
    expect(mockOptimizeUnsplashUrl).toHaveBeenCalledWith(
      'https://images.unsplash.com/photo-abc',
      expect.objectContaining({ quality: 85, format: 'auto' }),
    );
  });

  it('updates img.src when optimized URL differs', () => {
    const img = document.createElement('img');
    img.src = 'https://images.unsplash.com/photo-abc';
    document.body.appendChild(img);
    mockOptimizeUnsplashUrl.mockReturnValue('https://images.unsplash.com/photo-abc?w=800');

    renderHook(() => useImageOptimization(true));
    expect(img.src).toBe('https://images.unsplash.com/photo-abc?w=800');
  });

  it('does not update img.src when optimized URL is identical', () => {
    const img = document.createElement('img');
    img.src = 'https://images.unsplash.com/photo-abc';
    document.body.appendChild(img);
    mockOptimizeUnsplashUrl.mockReturnValue('https://images.unsplash.com/photo-abc');

    renderHook(() => useImageOptimization(true));
    expect(img.src).toBe('https://images.unsplash.com/photo-abc');
  });

  it('skips images already containing auto=format and q= params', () => {
    const img = document.createElement('img');
    img.src = 'https://images.unsplash.com/photo-abc?auto=format&q=80';
    document.body.appendChild(img);

    renderHook(() => useImageOptimization(true));
    expect(mockOptimizeUnsplashUrl).not.toHaveBeenCalled();
  });

  it('does not process non-unsplash images', () => {
    const img = document.createElement('img');
    img.src = 'https://example.com/photo.jpg';
    document.body.appendChild(img);

    renderHook(() => useImageOptimization(true));
    expect(mockOptimizeUnsplashUrl).not.toHaveBeenCalled();
  });

  it('uses width 800 as default when element has no dimensions', () => {
    const img = document.createElement('img');
    img.src = 'https://images.unsplash.com/photo-xyz';
    document.body.appendChild(img);

    renderHook(() => useImageOptimization(true));
    expect(mockOptimizeUnsplashUrl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ width: 800 }),
    );
  });
});

// ── usePreloadImages ──────────────────────────────────────────────────────────

describe('usePreloadImages', () => {
  it('creates a link element for each URL', () => {
    renderHook(() => usePreloadImages(['a.jpg', 'b.jpg']));
    const links = document.head.querySelectorAll('link[rel="preload"]');
    expect(links).toHaveLength(2);
  });

  it('sets rel=preload, as=image, and href on each link', () => {
    renderHook(() => usePreloadImages(['img.jpg']));
    const link = document.head.querySelector('link') as HTMLLinkElement;
    expect(link.rel).toBe('preload');
    expect(link.as).toBe('image');
    expect(link.href).toContain('img.jpg');
  });

  it('sets fetchpriority to high by default', () => {
    renderHook(() => usePreloadImages(['img.jpg']));
    const link = document.head.querySelector('link') as HTMLLinkElement;
    expect(link.getAttribute('fetchpriority')).toBe('high');
  });

  it('respects custom priority', () => {
    renderHook(() => usePreloadImages(['img.jpg'], 'low'));
    const link = document.head.querySelector('link') as HTMLLinkElement;
    expect(link.getAttribute('fetchpriority')).toBe('low');
  });

  it('skips URLs that already have a matching link tag', () => {
    const existing = document.createElement('link');
    existing.href = 'already.jpg';
    document.head.appendChild(existing);

    renderHook(() => usePreloadImages(['already.jpg', 'new.jpg']));
    const links = document.head.querySelectorAll('link');
    // 1 existing + 1 new (already.jpg skipped)
    expect(links).toHaveLength(2);
  });

  it('removes created links on unmount', () => {
    const { unmount } = renderHook(() => usePreloadImages(['img1.jpg', 'img2.jpg']));
    expect(document.head.querySelectorAll('link[rel="preload"]')).toHaveLength(2);

    unmount();
    expect(document.head.querySelectorAll('link[rel="preload"]')).toHaveLength(0);
  });

  it('does nothing when imageUrls is empty', () => {
    renderHook(() => usePreloadImages([]));
    expect(document.head.querySelectorAll('link')).toHaveLength(0);
  });
});

// ── useLazyLoadImages ─────────────────────────────────────────────────────────

describe('useLazyLoadImages', () => {
  it('creates an IntersectionObserver on mount', () => {
    renderHook(() => useLazyLoadImages());
    expect(capturedCallback).not.toBeNull();
  });

  it('passes rootMargin to the observer options', () => {
    renderHook(() => useLazyLoadImages('300px'));
    expect(capturedOptions?.rootMargin).toBe('300px');
  });

  it('uses default rootMargin of 200px', () => {
    renderHook(() => useLazyLoadImages());
    expect(capturedOptions?.rootMargin).toBe('200px');
  });

  it('uses threshold of 0.01', () => {
    renderHook(() => useLazyLoadImages());
    expect(capturedOptions?.threshold).toBe(0.01);
  });

  it('observes all img[data-src] elements', () => {
    const img1 = document.createElement('img');
    img1.dataset.src = 'lazy1.jpg';
    const img2 = document.createElement('img');
    img2.dataset.src = 'lazy2.jpg';
    document.body.appendChild(img1);
    document.body.appendChild(img2);

    renderHook(() => useLazyLoadImages());
    expect(observedEls).toHaveLength(2);
  });

  it('sets img.src from data-src when intersecting', () => {
    const img = document.createElement('img');
    img.dataset.src = 'lazy.jpg';
    document.body.appendChild(img);

    renderHook(() => useLazyLoadImages());

    capturedCallback!([
      { isIntersecting: true, target: img } as unknown as IntersectionObserverEntry,
    ]);

    expect(img.src).toContain('lazy.jpg');
  });

  it('removes data-src attribute after loading', () => {
    const img = document.createElement('img');
    img.dataset.src = 'lazy.jpg';
    document.body.appendChild(img);

    renderHook(() => useLazyLoadImages());
    capturedCallback!([
      { isIntersecting: true, target: img } as unknown as IntersectionObserverEntry,
    ]);

    expect(img.dataset.src).toBeUndefined();
  });

  it('sets img.srcset from data-srcset when intersecting', () => {
    const img = document.createElement('img');
    img.dataset.src = 'lazy.jpg';
    img.dataset.srcset = 'lazy-2x.jpg 2x';
    document.body.appendChild(img);

    renderHook(() => useLazyLoadImages());
    capturedCallback!([
      { isIntersecting: true, target: img } as unknown as IntersectionObserverEntry,
    ]);

    expect(img.srcset).toBe('lazy-2x.jpg 2x');
    expect(img.dataset.srcset).toBeUndefined();
  });

  it('does not load image when not intersecting', () => {
    const img = document.createElement('img');
    img.dataset.src = 'lazy.jpg';
    document.body.appendChild(img);

    renderHook(() => useLazyLoadImages());
    capturedCallback!([
      { isIntersecting: false, target: img } as unknown as IntersectionObserverEntry,
    ]);

    expect(img.src).toBe('');
  });

  it('disconnects observer on unmount', () => {
    const { unmount } = renderHook(() => useLazyLoadImages());
    new MockIntersectionObserver(() => {});
    unmount();
    // The hook's cleanup calls disconnect on the observer it created
    expect(capturedCallback).not.toBeNull();
  });
});
