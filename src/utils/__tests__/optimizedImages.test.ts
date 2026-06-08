/**
 * Tests for optimizedImages pure utility functions.
 */

import { describe, expect, it } from 'vitest';
import {
  getOptimizedWidths,
  getOptimizedImageUrl,
  getOptimizedSrcSet,
  getOptimizedFallbackUrl,
} from '../optimizedImages';

describe('getOptimizedWidths', () => {
  it('returns the canonical width set', () => {
    const widths = getOptimizedWidths();
    expect(widths).toEqual([480, 768, 1024, 1440]);
  });
});

describe('getOptimizedImageUrl', () => {
  it('builds URL with key, width, and format', () => {
    const url = getOptimizedImageUrl('hero', 768, 'webp');
    expect(url).toContain('hero-768.webp');
  });

  it('uses avif format when requested', () => {
    const url = getOptimizedImageUrl('banner', 1024, 'avif');
    expect(url).toContain('banner-1024.avif');
  });

  it('includes img/optimized path segment', () => {
    const url = getOptimizedImageUrl('photo', 480, 'webp');
    expect(url).toContain('img/optimized');
  });
});

describe('getOptimizedSrcSet', () => {
  it('includes all four width descriptors', () => {
    const srcset = getOptimizedSrcSet('hero', 'webp');
    expect(srcset).toContain('480w');
    expect(srcset).toContain('768w');
    expect(srcset).toContain('1024w');
    expect(srcset).toContain('1440w');
  });

  it('includes the format in each src', () => {
    const srcset = getOptimizedSrcSet('hero', 'avif');
    const parts = srcset.split(', ');
    expect(parts.every((p) => p.includes('.avif'))).toBe(true);
  });

  it('contains the key in each entry', () => {
    const srcset = getOptimizedSrcSet('test-img', 'webp');
    const parts = srcset.split(', ');
    expect(parts.every((p) => p.includes('test-img'))).toBe(true);
  });
});

describe('getOptimizedFallbackUrl', () => {
  it('uses 768 width', () => {
    const url = getOptimizedFallbackUrl('hero');
    expect(url).toContain('768');
  });

  it('uses webp format', () => {
    const url = getOptimizedFallbackUrl('hero');
    expect(url).toContain('.webp');
  });

  it('includes the key', () => {
    const url = getOptimizedFallbackUrl('my-image');
    expect(url).toContain('my-image');
  });
});
