/**
 * The redesigned sitemap, reached the way production reaches it: SitemapPage
 * with the design switch on lazy-loads NavigatorSitemapPage. Covers what the
 * redesign must not lose — every page of sitemapData.ts, each linked to a
 * route the app really serves, the live page's SEO tags and JSON-LD, its
 * figures and its search — and the board's states: browsing, results and no
 * results.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

const { SitemapPage } = await import('../../components/pages/SitemapPage');
const { sitemapSections } = await import('../../components/pages/sitemap/sitemapData');
const { SITEMAP_SEO, sitemapStructuredData, totalPages, publicPages, lastUpdatedLabel } =
  await import('../../components/pages/sitemap/sitemapMeta');

const ALL_LINKS = sitemapSections.flatMap((section) => section.links);

/** Every route path declared in src/app/AppRoutes.tsx. */
const SERVED_ROUTES = new Set(
  [
    ...readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../app/AppRoutes.tsx'),
      'utf8',
    ).matchAll(/path="([^"]+)"/g),
  ].map((m) => m[1]),
);

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/sitemap']}>
      <SitemapPage />
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

function search(value: string) {
  fireEvent.change(screen.getByLabelText('Search the sitemap'), { target: { value } });
}

afterEach(() => {
  cleanup();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator sitemap page', () => {
  it("has one H1, the board's heading", async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Navigate Wealth Sitemap');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(h1.closest('.nw-site.nwsm')).not.toBeNull();
  });

  it('emits the live page’s SEO tags and JSON-LD', async () => {
    await renderPage();
    expect(document.title).toBe(SITEMAP_SEO.title);
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      SITEMAP_SEO.description,
    );
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'index, follow',
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      SITEMAP_SEO.canonicalUrl,
    );
    const data = JSON.parse(document.getElementById('seo-structured-data')!.textContent!);
    expect(data).toEqual(sitemapStructuredData);
  });

  it('shows the live page’s figures', async () => {
    await renderPage();
    expect(screen.getByText(`${totalPages} pages`)).toBeTruthy();
    expect(screen.getByText(`${sitemapSections.length} categories`)).toBeTruthy();
    expect(screen.getByText(`${publicPages} public pages`)).toBeTruthy();
    expect(screen.getByText(`Updated ${lastUpdatedLabel}`)).toBeTruthy();
  });

  it('lists every page of the sitemap data, under its category, with its badge', async () => {
    await renderPage();
    for (const section of sitemapSections) {
      const card = document.getElementById(section.id)!;
      expect(within(card).getByRole('heading', { level: 2 }).textContent).toBe(section.title);
      expect(
        within(card)
          .getAllByRole('link')
          .map((a) => a.getAttribute('href')),
      ).toEqual(section.links.map((link) => link.path));
    }
    const loginOnly = ALL_LINKS.filter((link) => link.status === 'auth-required').length;
    // Each login-only page, plus the legend's badge.
    expect(screen.getAllByText('Login required')).toHaveLength(loginOnly + 1);
  });

  it('links only to routes the app serves and to its own categories', async () => {
    await renderPage();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href')!);
    const ids = new Set(sitemapSections.map((section) => `#${section.id}`));
    for (const href of hrefs) {
      if (href.startsWith('#')) {
        expect(ids.has(href), href).toBe(true);
      } else {
        expect(SERVED_ROUTES.has(href.split('?')[0]), href).toBe(true);
      }
    }
    expect(hrefs).toEqual(
      expect.arrayContaining(['/', '/contact', '/get-quote', '/resources', ...ids]),
    );
  });

  it('filters by title, description or path, announces the count, and clears', async () => {
    await renderPage();
    search('retirement');
    const matches = ALL_LINKS.filter(
      (link) =>
        link.title.toLowerCase().includes('retirement') ||
        link.description.toLowerCase().includes('retirement') ||
        link.path.includes('retirement'),
    );
    const label = `Showing ${matches.length} ${matches.length === 1 ? 'page' : 'pages'} matching “retirement”.`;
    expect(screen.getByRole('status').textContent).toBe(label);
    expect(screen.queryByText('Jump to a category')).toBeNull();
    const shown = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
      .filter((href) => matches.some((m) => m.path === href));
    expect(shown).toHaveLength(matches.length);
    expect(document.getElementById('legal')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('Jump to a category')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('');
    expect(document.activeElement).toBe(screen.getByLabelText('Search the sitemap'));
  });

  it('shows the no-results state and clears it from inside', async () => {
    await renderPage();
    search('zzz');
    expect(screen.getByRole('status').textContent).toBe('No pages match “zzz”.');
    expect(screen.getByText('No matching pages')).toBeTruthy();
    expect(sitemapSections.some((section) => document.getElementById(section.id))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'clear your search' }));
    expect(screen.queryByText('No matching pages')).toBeNull();
    expect(document.getElementById('main-navigation')).not.toBeNull();
  });
});
