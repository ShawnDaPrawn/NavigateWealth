/**
 * Tests for the build-time llms.txt (https://llmstxt.org) written by
 * scripts/seo/generate-seo-files.mjs. The live article list needs network, so
 * articles are covered here with fixtures.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
// Plain-JS build script module (no type declarations).
import * as seoStaticData from '../../../../scripts/seo/seo-static-data.mjs';
import organization from '../organization.json';

interface LlmsArticle {
  path: string;
  title: string;
  description?: string;
  published?: string;
}

interface LlmsRoute {
  path: string;
  title: string;
  description: string;
  schema?: string;
  sitemap?: boolean;
}

const {
  DEFAULT_SITE_URL,
  LLMS_DISCLOSURE,
  createLlmsTxt,
  disallowPaths,
  parseLlmsTxtArticles,
  publicSeoRoutes,
} = seoStaticData as unknown as {
  DEFAULT_SITE_URL: string;
  LLMS_DISCLOSURE: string;
  createLlmsTxt: (
    siteUrl: string,
    options?: { routes?: LlmsRoute[]; articles?: LlmsArticle[] },
  ) => string;
  disallowPaths: string[];
  parseLlmsTxtArticles: (text: string, siteUrl: string) => LlmsArticle[];
  publicSeoRoutes: LlmsRoute[];
};

const SITE = DEFAULT_SITE_URL;

/** Every `- [name](url)` list item's URL, in order. */
function listedUrls(text: string): string[] {
  return [...text.matchAll(/^- \[(?:\\.|[^\\\]])*\]\(([^)\s]+)\)/gm)].map((m) => m[1]);
}

/** H2 headings in order. */
function headings(text: string): string[] {
  return [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
}

/** The list items under one H2. */
function section(text: string, heading: string): string[] {
  const body = text.split(`\n## ${heading}\n`)[1]?.split('\n## ')[0] ?? '';
  return body.split('\n').filter((line) => line.startsWith('- ['));
}

const articles: LlmsArticle[] = [
  {
    path: '/resources/article/older-piece',
    title: 'An older piece',
    description: 'Written first.',
    published: '2026-01-05',
  },
  {
    path: '/resources/article/newer-piece',
    title: 'Brackets [in] the title',
    description: 'Written   second,\n with stray whitespace.',
    published: '2026-11-18',
  },
  { path: '/resources/article/odd-(slug)', title: 'Parentheses in the slug', published: '' },
];

describe('createLlmsTxt', () => {
  const text = createLlmsTxt(SITE, { articles });

  it('opens with the spec layout: an H1, then a blockquote summary', () => {
    const [h1, blank, summary] = text.split('\n');
    expect(h1).toBe('# Navigate Wealth');
    expect(blank).toBe('');
    expect(summary).toBe(`> ${organization.description}`);
    expect(summary).toContain('FSP 54606');
  });

  it('states the business facts from organization.json', () => {
    expect(text).toContain(`- Legal name: ${organization.legalName}`);
    expect(text).toContain(`- Telephone: ${organization.telephone}`);
    expect(text).toContain(`- Email: ${organization.email}`);
    expect(text).toContain('- Office hours: Monday to Friday, 08:30 to 16:30');
    expect(text).toContain('Route 21 Business Park, Pretoria, Gauteng, 0157, South Africa');
    expect(text).toContain(`[sitemap](${SITE}/sitemap.xml)`);
  });

  it('quotes the footer disclosure word for word', () => {
    expect(text).toContain(LLMS_DISCLOSURE);

    const footer = fs
      .readFileSync(path.resolve('src/site/layout/NavigatorFooter.tsx'), 'utf8')
      .replace(/\s+/g, ' ');
    for (const sentence of LLMS_DISCLOSURE.split(/(?<=\.) /)) {
      expect(footer).toContain(sentence);
    }
  });

  it('lists every sitemap route exactly once, and nothing else from the site map', () => {
    const urls = listedUrls(createLlmsTxt(SITE));
    const expected = publicSeoRoutes
      .filter((route) => route.sitemap !== false)
      .map((route) => (route.path === '/' ? SITE : `${SITE}${route.path}`));

    expect([...urls].sort()).toEqual([...expected].sort());
    expect(new Set(urls).size).toBe(urls.length);
    // A non-canonical alias the sitemap leaves out stays out here too.
    expect(urls).not.toContain(`${SITE}/contact/consultation`);
  });

  it('never links a path robots.txt disallows', () => {
    for (const url of listedUrls(text)) {
      const urlPath = url.slice(SITE.length) || '/';
      for (const disallowed of disallowPaths) {
        const prefix = disallowed.replace(/\/$/, '');
        expect(urlPath === prefix || urlPath.startsWith(`${prefix}/`)).toBe(false);
      }
    }
  });

  it('groups pages into topic sections and puts articles last, under Optional', () => {
    expect(headings(text)).toEqual([
      'Services',
      'Who we help',
      'Get advice or a quote',
      'About Navigate Wealth',
      'Resources',
      'Optional',
    ]);
    expect(section(text, 'Services')[0]).toContain(`(${SITE}/services)`);
    expect(section(text, 'Services').join('\n')).toContain(`(${SITE}/risk-management)`);
    expect(section(text, 'About Navigate Wealth')[0]).toMatch(/^- \[Home\]\(/);
  });

  it('omits Optional when there are no articles', () => {
    expect(headings(createLlmsTxt(SITE))).not.toContain('Optional');
  });

  it('lists a route no section claims under "More pages" instead of dropping it', () => {
    const routes = [
      ...publicSeoRoutes,
      { path: '/brand-new-page', title: 'Brand New | Navigate Wealth', description: 'New.' },
    ];
    const out = createLlmsTxt(SITE, { routes });
    expect(section(out, 'More pages')).toEqual([`- [Brand New](${SITE}/brand-new-page): New.`]);
  });

  it('lists articles newest first, dated, with Markdown-safe names and URLs', () => {
    expect(section(text, 'Optional')).toEqual([
      `- [Brackets \\[in\\] the title](${SITE}/resources/article/newer-piece): Published 2026-11-18. Written second, with stray whitespace.`,
      `- [An older piece](${SITE}/resources/article/older-piece): Published 2026-01-05. Written first.`,
      `- [Parentheses in the slug](${SITE}/resources/article/odd-%28slug%29)`,
    ]);
  });

  it('ends with exactly one newline', () => {
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });
});

describe('parseLlmsTxtArticles', () => {
  it('reads back exactly the articles createLlmsTxt wrote', () => {
    const parsed = parseLlmsTxtArticles(createLlmsTxt(SITE, { articles }), SITE);
    const byPath = (a: LlmsArticle, b: LlmsArticle) => a.path.localeCompare(b.path);

    expect([...parsed].sort(byPath)).toEqual(
      articles
        .map((a) => ({
          path: a.path,
          title: a.title,
          published: a.published ?? '',
          description: (a.description ?? '').replace(/\s+/g, ' ').trim(),
        }))
        .sort(byPath),
    );
  });

  it('ignores the page sections and returns nothing for a file without Optional', () => {
    expect(parseLlmsTxtArticles(createLlmsTxt(SITE), SITE)).toEqual([]);
    expect(parseLlmsTxtArticles('', SITE)).toEqual([]);
  });
});
