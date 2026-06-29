import { describe, it, expect } from 'vitest';
import { SITE_ORIGIN, SITE_ORIGIN_APEX, siteAbsoluteUrl } from '../siteOrigin';

describe('SITE_ORIGIN', () => {
  it('is the canonical www origin', () => {
    expect(SITE_ORIGIN).toBe('https://www.navigatewealth.co');
  });
});

describe('SITE_ORIGIN_APEX', () => {
  it('is the apex origin without www', () => {
    expect(SITE_ORIGIN_APEX).toBe('https://navigatewealth.co');
  });

  it('is a different origin from SITE_ORIGIN (so it is outside the PWA scope)', () => {
    expect(SITE_ORIGIN_APEX).not.toBe(SITE_ORIGIN);
    expect(new URL(SITE_ORIGIN_APEX).host).not.toBe(new URL(SITE_ORIGIN).host);
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
