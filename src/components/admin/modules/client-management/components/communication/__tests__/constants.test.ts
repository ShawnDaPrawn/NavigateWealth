import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  PRIORITIES,
  CATEGORY_CONFIG,
  getCategoryIcon,
  getCategoryColor,
} from '../constants';

describe('client-management communication constants', () => {
  it('CATEGORIES contains expected values', () => {
    expect(CATEGORIES).toContain('General');
    expect(CATEGORIES).toContain('Policy Update');
    expect(CATEGORIES).toContain('FNA Available');
  });

  it('PRIORITIES has normal, high, and urgent entries', () => {
    const values = PRIORITIES.map((p) => p.value);
    expect(values).toContain('normal');
    expect(values).toContain('high');
    expect(values).toContain('urgent');
  });

  it('each priority has a label', () => {
    PRIORITIES.forEach((p) => {
      expect(typeof p.label).toBe('string');
      expect(p.label.length).toBeGreaterThan(0);
    });
  });

  it('CATEGORY_CONFIG has icon and color for known categories', () => {
    expect(CATEGORY_CONFIG['Policy Update']).toBeDefined();
    expect(CATEGORY_CONFIG['Policy Update'].color).toContain('text-');
    expect(CATEGORY_CONFIG['Important']).toBeDefined();
  });

  it('getCategoryIcon returns an icon for known categories', () => {
    const icon = getCategoryIcon('Policy Update');
    expect(icon).toBeDefined();
  });

  it('getCategoryIcon falls back to Bell for unknown categories', () => {
    const icon = getCategoryIcon('Unknown Category');
    expect(icon).toBeDefined();
  });

  it('getCategoryColor returns a text class for known categories', () => {
    const color = getCategoryColor('Appointment');
    expect(typeof color).toBe('string');
    expect(color).toContain('text-');
  });

  it('getCategoryColor returns a fallback for unknown categories', () => {
    const color = getCategoryColor('XYZ');
    expect(typeof color).toBe('string');
    expect(color).toContain('text-');
  });
});
