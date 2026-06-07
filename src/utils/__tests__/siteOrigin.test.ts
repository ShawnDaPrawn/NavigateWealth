import { describe, it, expect } from 'vitest';
import { SITE_ORIGIN, siteAbsoluteUrl } from '../siteOrigin';

describe('SITE_ORIGIN', () => {
  it('is the canonical www origin', () => {
    expect(SITE_ORIGIN).toBe('https://www.navigatewealth.co');
  });
});

describe('siteAbsoluteUrl', () => {
  it('prepends SITE_ORIGIN to a path starting with slash', () => {
    expect(siteAbsoluteUrl('/about')).toBe('https://www.navigatewealth.co/about');
  });

  it('adds a leading slash when path does not start with one', () => {
    expect(siteAbsoluteUrl('blog/post')).toBe('https://www.navigatewealth.co/blog/post');
  });

  it('handles empty string as root', () => {
    expect(siteAbsoluteUrl('')).toBe('https://www.navigatewealth.co/');
  });

  it('handles deeply nested paths', () => {
    expect(siteAbsoluteUrl('/a/b/c/d')).toBe('https://www.navigatewealth.co/a/b/c/d');
  });
});
