import { describe, expect, it } from 'vitest';
import { formatDate, hexToRgb, getContrastRatio } from '../corporateIdentityUtils';

describe('formatDate', () => {
  it('returns Never for null', () => {
    expect(formatDate(null)).toBe('Never');
  });

  it('formats an ISO date with the day, month and year', () => {
    const out = formatDate('2025-06-05T12:00:00Z');
    expect(out).toMatch(/2025/);
    expect(out).toMatch(/Jun/);
  });
});

describe('hexToRgb', () => {
  it('parses #rrggbb into channel values', () => {
    expect(hexToRgb('#ff8000')).toEqual({ r: 255, g: 128, b: 0 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe('getContrastRatio (relative luminance)', () => {
  it('is 0 for black and ~1 for white', () => {
    expect(getContrastRatio('#000000')).toBe(0);
    expect(getContrastRatio('#ffffff')).toBeCloseTo(1);
  });

  it('weights green above red per the perceptual formula', () => {
    expect(getContrastRatio('#00ff00')).toBeGreaterThan(getContrastRatio('#ff0000'));
  });
});
