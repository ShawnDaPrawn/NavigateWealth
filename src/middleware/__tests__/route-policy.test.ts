import { describe, expect, it } from 'vitest';
import {
  LEGAL_DOCUMENT_SLUGS,
  QUOTE_SERVICE_SLUGS,
  shouldReturnNotFound,
  type SeoRouteManifest,
} from '../route-policy';
// The lists' agreement with the app lives in src/__tests__/middleware-slug-parity.test.ts:
// importing app modules here would pull SPA asset imports into `typecheck:middleware`.

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

  it('falls through to the SPA for unknown article slugs so newly published articles resolve before redeploy', () => {
    expect(shouldReturnNotFound('/resources/article/does-not-exist-123', manifest)).toBe(false);
    expect(shouldReturnNotFound('/resources/article/br%C3%A9aking-news', manifest)).toBe(false);
  });

  it('still returns 404 for malformed article paths', () => {
    expect(shouldReturnNotFound('/resources/article/some-slug/extra', manifest)).toBe(true);
    expect(shouldReturnNotFound('/resources/article/', manifest)).toBe(true);
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
    expect(shouldReturnNotFound('/legal/privacy-notice', manifest)).toBe(false);
    expect(shouldReturnNotFound('/get-quote/risk-management', manifest)).toBe(false);
    expect(shouldReturnNotFound('/get-quote/risk-management/contact', manifest)).toBe(false);
    expect(shouldReturnNotFound('/requests/abc-123', manifest)).toBe(false);
  });

  it('serves every published legal document and 404s any other legal slug', () => {
    for (const slug of LEGAL_DOCUMENT_SLUGS) {
      expect(shouldReturnNotFound(`/legal/${slug}`, manifest), slug).toBe(false);
    }
    // Made-up slugs used to get a 200 and a client-side "not found" — a soft 404.
    expect(shouldReturnNotFound('/legal/privacy-policy', manifest)).toBe(true);
    expect(shouldReturnNotFound('/legal/does-not-exist', manifest)).toBe(true);
    expect(shouldReturnNotFound('/legal/privacy-notice/extra', manifest)).toBe(true);
  });

  it('serves the quote flow for real services only', () => {
    for (const slug of QUOTE_SERVICE_SLUGS) {
      expect(shouldReturnNotFound(`/get-quote/${slug}`, manifest), slug).toBe(false);
      expect(shouldReturnNotFound(`/get-quote/${slug}/contact`, manifest), slug).toBe(false);
    }
    // Financial planning has no quote form; ServicesPage deliberately avoids linking it.
    expect(shouldReturnNotFound('/get-quote/financial-planning', manifest)).toBe(true);
    expect(shouldReturnNotFound('/get-quote/made-up/contact', manifest)).toBe(true);
    expect(shouldReturnNotFound('/get-quote/medical-aid/other', manifest)).toBe(true);
  });

  it('serves newsletter issues instead of answering 404', () => {
    // Every issue 404ed to crawlers before /resources/newsletter/ was recognised.
    expect(
      shouldReturnNotFound(
        '/resources/newsletter/2026-10-navigate-wealth-october-2026-the-wealth-compass-make-room',
        manifest,
      ),
    ).toBe(false);
    expect(shouldReturnNotFound('/resources/newsletter/', manifest)).toBe(true);
    expect(shouldReturnNotFound('/resources/newsletter/some-issue/extra', manifest)).toBe(true);
  });

  it('normalizes trailing slashes', () => {
    expect(shouldReturnNotFound('/services/', manifest)).toBe(false);
    expect(shouldReturnNotFound('/nonexistent-abc/', manifest)).toBe(true);
  });
});
