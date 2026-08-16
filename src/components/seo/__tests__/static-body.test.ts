/**
 * Tests for the build-time static body snapshots (scripts/seo-static-data.mjs)
 * that get prerendered inside #root. The article path cannot always be
 * exercised by a live build (the article fetch needs network), so it is
 * covered here with fixtures.
 */
import { describe, it, expect } from 'vitest';
// Plain-JS build script module (no type declarations).
import * as seoStaticData from '../../../../scripts/seo-static-data.mjs';
import faqData from '../faqs.json';

const {
  DEFAULT_SITE_URL,
  createArticleRoute,
  createArticleSchema,
  createArticleStaticBodyHtml,
  createStaticBodyHtml,
  faqsForRoute,
  publicSeoRoutes,
} = seoStaticData as unknown as {
  DEFAULT_SITE_URL: string;
  createArticleRoute: (article: Record<string, unknown>, siteUrl: string) => Record<string, any>;
  createArticleSchema: (route: Record<string, unknown>, siteUrl: string) => Record<string, any>;
  createArticleStaticBodyHtml: (
    route: Record<string, unknown>,
    siteUrl: string,
    sanitizedBodyHtml: string,
  ) => string;
  createStaticBodyHtml: (route: Record<string, unknown>, siteUrl: string) => string;
  faqsForRoute: (route: { schema?: string; path: string }) => Array<{ question: string }>;
  publicSeoRoutes: Array<Record<string, any>>;
};

const homeRoute = publicSeoRoutes.find((r) => r.path === '/')!;
const serviceRoute = publicSeoRoutes.find((r) => r.path === '/risk-management')!;

describe('createStaticBodyHtml', () => {
  it('renders visible content (no <noscript> wrapper)', () => {
    const html = createStaticBodyHtml(homeRoute, DEFAULT_SITE_URL);
    expect(html).not.toContain('<noscript');
    expect(html).toContain('data-seo-static-body="true"');
    expect(html).toContain('<h1>');
  });

  it('homepage snapshot links to every service page', () => {
    const html = createStaticBodyHtml(homeRoute, DEFAULT_SITE_URL);
    for (const svc of publicSeoRoutes.filter((r) => r.schema === 'service')) {
      expect(html).toContain(`${DEFAULT_SITE_URL}${svc.path}`);
    }
  });

  it('service snapshot contains the page FAQ questions and answers', () => {
    const html = createStaticBodyHtml(serviceRoute, DEFAULT_SITE_URL);
    for (const faq of faqData['risk-management']) {
      expect(html).toContain(faq.question.replace(/&/g, '&amp;').replace(/'/g, '&#39;'));
    }
  });

  it('includes the path guard so the SPA fallback shell hides mismatched snapshots', () => {
    const html = createStaticBodyHtml(serviceRoute, DEFAULT_SITE_URL);
    expect(html).toContain('seo-static-body-guard');
    expect(html).toContain('"/risk-management"');
  });
});

describe('faqsForRoute', () => {
  it('maps home to the common FAQs and services to their slug', () => {
    expect(faqsForRoute({ schema: 'home', path: '/' })).toEqual(faqData.common);
    expect(faqsForRoute({ schema: 'service', path: '/tax-planning' })).toEqual(
      faqData['tax-planning'],
    );
    expect(faqsForRoute({ schema: 'webpage', path: '/about' })).toEqual([]);
  });
});

describe('createArticleStaticBodyHtml', () => {
  const article = {
    slug: 'test-article',
    title: 'Understanding Retirement Annuities',
    excerpt: 'A practical guide to RAs for South African savers.',
    body: '<p>Full body content</p>',
    author_name: 'Jane Advisor',
    published_at: '2026-06-15T08:00:00.000Z',
    reading_time_minutes: 7,
    hero_image_url: 'https://cdn.example.com/hero.jpg',
  };
  const route = createArticleRoute(article, DEFAULT_SITE_URL)!;

  it('renders headline, byline, hero, sanitized body, and back link', () => {
    const html = createArticleStaticBodyHtml(
      route,
      DEFAULT_SITE_URL,
      '<p>Sanitized paragraph one.</p><h2>Section</h2><p>Paragraph two.</p>',
    );
    expect(html).toContain('<h1>Understanding Retirement Annuities</h1>');
    expect(html).toContain('Jane Advisor');
    expect(html).toContain('7 min read');
    expect(html).toContain('https://cdn.example.com/hero.jpg');
    expect(html).toContain('Sanitized paragraph one.');
    expect(html).toContain(`${DEFAULT_SITE_URL}/resources`);
    expect(html).not.toContain('<noscript');
  });

  it('guards against the wrong-path fallback shell', () => {
    const html = createArticleStaticBodyHtml(route, DEFAULT_SITE_URL, '<p>x</p>');
    expect(html).toContain('"/resources/article/test-article"');
  });
});

describe('createArticleRoute canonical override (seo_canonical_url)', () => {
  const survivor = `${DEFAULT_SITE_URL}/resources/article/holiday-scams`;

  it('self-canonicalises and stays in the sitemap when no override is set', () => {
    const route = createArticleRoute({ slug: 'holiday-scams', title: 'A' }, DEFAULT_SITE_URL)!;
    expect(route.canonicalUrl).toBeUndefined();
    expect(route.sitemap).toBeUndefined(); // sitemap !== false → included
    const schema = createArticleSchema(route, DEFAULT_SITE_URL);
    const article = (schema['@graph'] as Array<Record<string, unknown>>).find(
      (n) => n['@type'] === 'Article',
    )!;
    expect(article.url).toBe(survivor);
  });

  it('ignores a self-referential canonical (trailing slash tolerant)', () => {
    const route = createArticleRoute(
      { slug: 'holiday-scams', title: 'A', seo_canonical_url: `${survivor}/` },
      DEFAULT_SITE_URL,
    )!;
    expect(route.canonicalUrl).toBeUndefined();
    expect(route.sitemap).toBeUndefined();
  });

  it('honours an override to another page and drops it from the sitemap', () => {
    const route = createArticleRoute(
      {
        slug: 'holiday-scams-this-easter',
        title: 'Duplicate',
        seo_canonical_url: survivor,
      },
      DEFAULT_SITE_URL,
    )!;
    expect(route.canonicalUrl).toBe(survivor);
    expect(route.sitemap).toBe(false);
    const schema = createArticleSchema(route, DEFAULT_SITE_URL);
    const article = (schema['@graph'] as Array<Record<string, unknown>>).find(
      (n) => n['@type'] === 'Article',
    )!;
    expect(article.url).toBe(survivor);
    expect(article.mainEntityOfPage).toBe(survivor);
  });

  it('applies the known holiday-scam duplicate map without an admin canonical', () => {
    const route = createArticleRoute(
      {
        slug: 'holiday-scams-fake-deals-and-banking-fraud-how-to-protect-yourself-this-easter',
        title: 'Holiday scams',
      },
      DEFAULT_SITE_URL,
    )!;
    expect(route.canonicalUrl).toBe(
      `${DEFAULT_SITE_URL}/resources/article/holiday-scams-fake-deals-and-banking-fraud-how-to-protect-yourself`,
    );
    expect(route.sitemap).toBe(false);
  });
});
