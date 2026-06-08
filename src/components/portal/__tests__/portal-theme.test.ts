/**
 * Tests for portal-theme constants.
 * Importing the module exercises all constant assignments.
 */

import { describe, expect, it } from 'vitest';
import { ACTIVE_THEME, BRAND, NAV_STYLES, HERO_STYLES } from '../portal-theme';

describe('portal-theme', () => {
  it('ACTIVE_THEME is either branded or classic', () => {
    expect(['branded', 'classic']).toContain(ACTIVE_THEME);
  });

  it('BRAND has heroBg color', () => {
    expect(typeof BRAND.heroBg).toBe('string');
    expect(BRAND.heroBg).toMatch(/^#/);
  });

  it('BRAND has purple color', () => {
    expect(typeof BRAND.purple).toBe('string');
  });

  it('BRAND has textOnDark', () => {
    expect(BRAND.textOnDark).toBeDefined();
  });

  it('NAV_STYLES is defined', () => {
    expect(NAV_STYLES).toBeDefined();
    expect(typeof NAV_STYLES).toBe('object');
  });

  it('HERO_STYLES is defined', () => {
    expect(HERO_STYLES).toBeDefined();
    expect(typeof HERO_STYLES).toBe('object');
  });
});
