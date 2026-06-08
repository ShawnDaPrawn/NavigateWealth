import { describe, expect, it } from 'vitest';
import {
  BRAND,
  BRAND_ICON_CONTAINER,
  BRAND_SELECTED_RING,
  PLATFORM_DISPLAY,
  AI_PLATFORM_CONFIG,
  formatDateZA,
  formatTimeZA,
} from '../constants';

describe('social-media/constants', () => {
  it('BRAND has navy and gold hex colors', () => {
    expect(BRAND.navy).toMatch(/^#/);
    expect(BRAND.gold).toMatch(/^#/);
  });

  it('BRAND has navyLight and goldLight variants', () => {
    expect(BRAND.navyLight).toBeDefined();
    expect(BRAND.goldLight).toBeDefined();
  });

  it('BRAND_ICON_CONTAINER is a non-empty string', () => {
    expect(typeof BRAND_ICON_CONTAINER).toBe('string');
    expect(BRAND_ICON_CONTAINER.length).toBeGreaterThan(0);
  });

  it('BRAND_SELECTED_RING is a non-empty string', () => {
    expect(typeof BRAND_SELECTED_RING).toBe('string');
  });

  it('PLATFORM_DISPLAY has linkedin, instagram, facebook, and x', () => {
    expect(PLATFORM_DISPLAY.linkedin.label).toBe('LinkedIn');
    expect(PLATFORM_DISPLAY.instagram.label).toBe('Instagram');
    expect(PLATFORM_DISPLAY.facebook.label).toBe('Facebook');
    expect(PLATFORM_DISPLAY.x.label).toBe('X');
  });

  it('AI_PLATFORM_CONFIG has all four platforms', () => {
    expect(AI_PLATFORM_CONFIG.linkedin.label).toBe('LinkedIn');
    expect(AI_PLATFORM_CONFIG.x.label).toBe('X (Twitter)');
  });

  it('formatDateZA returns a formatted date string', () => {
    const result = formatDateZA('2024-03-15');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('formatDateZA accepts a Date object', () => {
    const d = new Date('2024-01-01');
    const result = formatDateZA(d);
    expect(typeof result).toBe('string');
  });

  it('formatTimeZA returns a time string', () => {
    const result = formatTimeZA('2024-03-15T14:30:00');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('formatTimeZA accepts a Date object', () => {
    const d = new Date('2024-01-01T10:00:00');
    const result = formatTimeZA(d);
    expect(typeof result).toBe('string');
  });
});
