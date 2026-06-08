import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  optimizeUnsplashUrl,
  generateUnsplashSrcSet,
  generatePlaceholderUrl,
  getOptimalImageWidth,
  applyImagePreset,
  getUnsplashDominantColor,
  IMAGE_PRESETS,
} from '../imageOptimization';

const UNSPLASH_URL = 'https://images.unsplash.com/photo-123?ixid=abc';

describe('optimizeUnsplashUrl', () => {
  it('returns non-Unsplash URLs unchanged', () => {
    const url = 'https://example.com/image.jpg';
    expect(optimizeUnsplashUrl(url)).toBe(url);
  });

  it('adds optimization parameters to Unsplash URL', () => {
    const result = optimizeUnsplashUrl(UNSPLASH_URL, { width: 400, quality: 70, dpr: 1 });
    expect(result).toContain('w=400');
    expect(result).toContain('q=70');
    expect(result).toContain('compress=true');
    expect(result).toContain('fit=crop');
  });

  it('adds height when provided', () => {
    const result = optimizeUnsplashUrl(UNSPLASH_URL, { height: 300, dpr: 1 });
    expect(result).toContain('h=300');
  });

  it('skips height when not provided', () => {
    const result = optimizeUnsplashUrl(UNSPLASH_URL, { dpr: 1 });
    expect(result).not.toContain('h=');
  });

  it('sets auto format parameters by default', () => {
    const result = optimizeUnsplashUrl(UNSPLASH_URL, { dpr: 1 });
    expect(result).toContain('auto=format');
    expect(result).toContain('fm=webp');
  });

  it('sets explicit format when not auto', () => {
    const result = optimizeUnsplashUrl(UNSPLASH_URL, { format: 'jpg', dpr: 1 });
    expect(result).toContain('fm=jpg');
    expect(result).not.toContain('auto=format');
  });

  it('scales width by dpr', () => {
    const result = optimizeUnsplashUrl(UNSPLASH_URL, { width: 400, dpr: 2 });
    expect(result).toContain('w=800');
  });

  it('uses default width of 800 when not specified', () => {
    const result = optimizeUnsplashUrl(UNSPLASH_URL, { dpr: 1 });
    expect(result).toContain('w=800');
  });
});

describe('generateUnsplashSrcSet', () => {
  it('returns empty string for non-Unsplash URL', () => {
    expect(generateUnsplashSrcSet('https://example.com/img.jpg')).toBe('');
  });

  it('returns srcset with multiple sizes for Unsplash URL', () => {
    const result = generateUnsplashSrcSet(UNSPLASH_URL, 400);
    expect(result).toContain('200w');
    expect(result).toContain('400w');
    expect(result).toContain('600w');
    expect(result).toContain('800w');
  });
});

describe('generatePlaceholderUrl', () => {
  it('returns original URL for non-Unsplash', () => {
    const url = 'https://example.com/img.jpg';
    expect(generatePlaceholderUrl(url)).toBe(url);
  });

  it('returns tiny low-quality URL for Unsplash', () => {
    const result = generatePlaceholderUrl(UNSPLASH_URL);
    expect(result).toContain('w=40');
    expect(result).toContain('q=30');
  });
});

describe('getOptimalImageWidth', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns containerWidth capped at maxWidth', () => {
    vi.stubGlobal('window', { innerWidth: 1920, devicePixelRatio: 1 });
    const result = getOptimalImageWidth(400, 2000);
    expect(result).toBe(400);
  });

  it('caps at maxWidth', () => {
    vi.stubGlobal('window', { innerWidth: 1920, devicePixelRatio: 1 });
    const result = getOptimalImageWidth(3000, 2000);
    expect(result).toBe(2000);
  });

  it('uses window.innerWidth when containerWidth is undefined', () => {
    vi.stubGlobal('window', { innerWidth: 1024, devicePixelRatio: 1 });
    const result = getOptimalImageWidth(undefined, 2000);
    expect(result).toBe(1024);
  });

  it('accounts for device pixel ratio capped at 2', () => {
    vi.stubGlobal('window', { innerWidth: 1920, devicePixelRatio: 3 });
    const result = getOptimalImageWidth(400, 2000);
    expect(result).toBe(800); // 400 × min(3, 2) = 800
  });

  it('returns 1920 when window is undefined', () => {
    vi.stubGlobal('window', undefined);
    const result = getOptimalImageWidth(undefined, 2000);
    expect(result).toBe(1920);
  });
});

describe('applyImagePreset', () => {
  it('applies hero preset to Unsplash URL', () => {
    const result = applyImagePreset(UNSPLASH_URL, 'hero');
    expect(result).toContain(`w=${IMAGE_PRESETS.hero.width}`);
  });

  it('applies thumbnail preset', () => {
    const result = applyImagePreset(UNSPLASH_URL, 'thumbnail');
    expect(result).toContain(`w=${IMAGE_PRESETS.thumbnail.width}`);
  });

  it('returns non-Unsplash URL unchanged', () => {
    const url = 'https://cdn.example.com/img.jpg';
    expect(applyImagePreset(url, 'card')).toBe(url);
  });
});

describe('getUnsplashDominantColor', () => {
  it('returns hex color from URL if present', () => {
    const url = 'https://images.unsplash.com/photo?color=FF5733';
    expect(getUnsplashDominantColor(url)).toBe('#FF5733');
  });

  it('returns null when color param is absent', () => {
    expect(getUnsplashDominantColor(UNSPLASH_URL)).toBeNull();
    expect(getUnsplashDominantColor('https://example.com/img.jpg')).toBeNull();
  });
});
