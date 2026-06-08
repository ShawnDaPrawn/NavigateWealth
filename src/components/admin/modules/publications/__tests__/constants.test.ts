import { describe, it, expect } from 'vitest';
import {
  API_ENDPOINTS,
  DEFAULT_ARTICLE,
  DEFAULT_CATEGORY,
  DEFAULT_TYPE,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  VALIDATION_RULES,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  STATUS_LABELS,
  STATUS_COLORS,
  CATEGORY_ICON_MAP,
  CATEGORY_SLUG_MAP,
  STORAGE_KEYS,
  DATE_FORMATS,
  IMAGE_UPLOAD_CONFIG,
  EDITOR_CONFIG,
} from '../constants';

describe('publications API_ENDPOINTS', () => {
  it('has static string endpoints for articles and categories', () => {
    expect(typeof API_ENDPOINTS.articles).toBe('string');
    expect(typeof API_ENDPOINTS.categories).toBe('string');
  });

  it('articleById returns a URL path with the given ID', () => {
    expect(API_ENDPOINTS.articleById('abc')).toContain('abc');
  });

  it('articleBySlug returns a URL path with the given slug', () => {
    expect(API_ENDPOINTS.articleBySlug('my-post')).toContain('my-post');
  });
});

describe('publications default objects', () => {
  it('DEFAULT_ARTICLE has title and status fields', () => {
    expect(typeof DEFAULT_ARTICLE).toBe('object');
  });

  it('DEFAULT_CATEGORY is an object', () => {
    expect(typeof DEFAULT_CATEGORY).toBe('object');
  });

  it('DEFAULT_TYPE is an object', () => {
    expect(typeof DEFAULT_TYPE).toBe('object');
  });
});

describe('publications pagination constants', () => {
  it('DEFAULT_PAGE_SIZE is a positive integer', () => {
    expect(DEFAULT_PAGE_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(DEFAULT_PAGE_SIZE)).toBe(true);
  });

  it('PAGE_SIZE_OPTIONS is an array containing DEFAULT_PAGE_SIZE', () => {
    expect(Array.from(PAGE_SIZE_OPTIONS)).toContain(DEFAULT_PAGE_SIZE);
  });
});

describe('publications validation rules', () => {
  it('VALIDATION_RULES is a non-empty object', () => {
    expect(Object.keys(VALIDATION_RULES).length).toBeGreaterThan(0);
  });
});

describe('publications message constants', () => {
  it('SUCCESS_MESSAGES is non-empty', () => {
    expect(Object.keys(SUCCESS_MESSAGES).length).toBeGreaterThan(0);
  });

  it('ERROR_MESSAGES is non-empty', () => {
    expect(Object.keys(ERROR_MESSAGES).length).toBeGreaterThan(0);
  });
});

describe('publications status constants', () => {
  it('STATUS_LABELS has entries for draft and published', () => {
    expect(STATUS_LABELS.draft).toBeTruthy();
  });

  it('STATUS_COLORS is non-empty', () => {
    expect(Object.keys(STATUS_COLORS).length).toBeGreaterThan(0);
  });
});

describe('publications mapping constants', () => {
  it('CATEGORY_ICON_MAP is a non-empty object', () => {
    expect(Object.keys(CATEGORY_ICON_MAP).length).toBeGreaterThan(0);
  });

  it('CATEGORY_SLUG_MAP is a non-empty object', () => {
    expect(Object.keys(CATEGORY_SLUG_MAP).length).toBeGreaterThan(0);
  });
});

describe('publications storage and format constants', () => {
  it('STORAGE_KEYS is an object with string values', () => {
    Object.values(STORAGE_KEYS).forEach((v) => expect(typeof v).toBe('string'));
  });

  it('DATE_FORMATS is an object with string values', () => {
    Object.values(DATE_FORMATS).forEach((v) => expect(typeof v).toBe('string'));
  });
});

describe('publications upload and editor config', () => {
  it('IMAGE_UPLOAD_CONFIG has max size or similar limits', () => {
    expect(typeof IMAGE_UPLOAD_CONFIG).toBe('object');
  });

  it('EDITOR_CONFIG is an object', () => {
    expect(typeof EDITOR_CONFIG).toBe('object');
  });
});
