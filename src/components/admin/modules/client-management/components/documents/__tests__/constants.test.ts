import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_TYPES,
  DOCUMENT_STATUS,
  PRODUCT_CATEGORIES,
  CATEGORY_CONFIG,
  DATE_RANGE_OPTIONS,
  FILE_CONSTRAINTS,
  URL_REGEX,
} from '../constants';

describe('documents/constants', () => {
  it('DOCUMENT_TYPES has DOCUMENT and LINK', () => {
    expect(DOCUMENT_TYPES.DOCUMENT).toBe('document');
    expect(DOCUMENT_TYPES.LINK).toBe('link');
  });

  it('DOCUMENT_STATUS has NEW, VIEWED, and ARCHIVED', () => {
    expect(DOCUMENT_STATUS.NEW).toBe('new');
    expect(DOCUMENT_STATUS.VIEWED).toBe('viewed');
    expect(DOCUMENT_STATUS.ARCHIVED).toBe('archived');
  });

  it('PRODUCT_CATEGORIES includes General and Life', () => {
    expect(PRODUCT_CATEGORIES).toContain('General');
    expect(PRODUCT_CATEGORIES).toContain('Life');
  });

  it('CATEGORY_CONFIG has color and icon for each category', () => {
    Object.values(CATEGORY_CONFIG).forEach((cfg) => {
      expect(typeof cfg.color).toBe('string');
      expect(typeof cfg.icon).toBe('string');
    });
  });

  it('DATE_RANGE_OPTIONS has at least 3 entries including all-time', () => {
    expect(DATE_RANGE_OPTIONS.length).toBeGreaterThanOrEqual(3);
    const values = DATE_RANGE_OPTIONS.map((o) => o.value);
    expect(values).toContain('all');
  });

  it('FILE_CONSTRAINTS has MAX_SIZE_MB and ALLOWED_EXTENSIONS', () => {
    expect(FILE_CONSTRAINTS.MAX_SIZE_MB).toBeGreaterThan(0);
    expect(FILE_CONSTRAINTS.ALLOWED_EXTENSIONS).toContain('.pdf');
    expect(FILE_CONSTRAINTS.MAX_SIZE_BYTES).toBe(FILE_CONSTRAINTS.MAX_SIZE_MB * 1024 * 1024);
  });

  it('URL_REGEX matches valid URLs', () => {
    expect(URL_REGEX.test('https://example.com')).toBe(true);
    expect(URL_REGEX.test('http://test.co.za')).toBe(true);
  });
});
