import { describe, expect, it } from 'vitest';
import { shouldReturnNotFound, type SeoRouteManifest } from '../route-policy';

const manifest: SeoRouteManifest = {
  generated: true,
  generatedAt: '2026-05-29T00:00:00.000Z',
  paths: [
    '/',
    '/services',
    '/resources',
    '/resources/article/known-article-slug',
    '/schedule-consultation',
  ],
  articleSlugs: ['known-article-slug'],
};

describe('route-policy', () => {
  it('does not enforce when manifest was not generated (local dev)', () => {
    expect(
      shouldReturnNotFound('/nonexistent-abc', {
        generated: false,
        generatedAt: null,
        paths: [],
        articleSlugs: [],
      }),
    ).toBe(false);
  });

  it('returns 404 for fake top-level paths from the SEO audit', () => {
    expect(shouldReturnNotFound('/nonexistent-abc', manifest)).toBe(true);
    expect(shouldReturnNotFound('/services/fake-xyz', manifest)).toBe(true);
  });

  it('returns 404 for unknown article slugs', () => {
    expect(shouldReturnNotFound('/resources/article/does-not-exist-123', manifest)).toBe(true);
  });

  it('allows manifest paths and known articles', () => {
    expect(shouldReturnNotFound('/', manifest)).toBe(false);
    expect(shouldReturnNotFound('/services', manifest)).toBe(false);
    expect(shouldReturnNotFound('/resources/article/known-article-slug', manifest)).toBe(false);
  });

  it('allows SPA functional routes not in the SEO manifest', () => {
    expect(shouldReturnNotFound('/login', manifest)).toBe(false);
    expect(shouldReturnNotFound('/admin', manifest)).toBe(false);
    expect(shouldReturnNotFound('/dashboard', manifest)).toBe(false);
    expect(shouldReturnNotFound('/sitemap', manifest)).toBe(false);
    expect(shouldReturnNotFound('/legal/privacy-policy', manifest)).toBe(false);
    expect(shouldReturnNotFound('/get-quote/risk-management', manifest)).toBe(false);
    expect(shouldReturnNotFound('/get-quote/risk-management/contact', manifest)).toBe(false);
    expect(shouldReturnNotFound('/requests/abc-123', manifest)).toBe(false);
  });

  it('normalizes trailing slashes', () => {
    expect(shouldReturnNotFound('/services/', manifest)).toBe(false);
    expect(shouldReturnNotFound('/nonexistent-abc/', manifest)).toBe(true);
  });
});
