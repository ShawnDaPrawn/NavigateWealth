/**
 * The redesigned 404, reached the way production reaches it: NotFoundPage
 * with the design switch on lazy-loads NavigatorNotFoundPage. Covers what the
 * redesign must not lose — the "Page Not Found" title and noindex robots tag,
 * "Go back" through the history (home when there is none), the links home,
 * to the legal pages, the resources and the contact page — and the board's
 * page search: popular chips, results, no results, each page a real route.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

const { NotFoundPage } = await import('../../components/pages/NotFoundPage');
const { sitemapSections } = await import('../../components/pages/sitemap/sitemapData');
const { WHATSAPP_HREF } = await import('../siteLinks');

/** Every route path declared in src/app/AppRoutes.tsx. */
const SERVED_ROUTES = new Set(
  [
    ...readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../app/AppRoutes.tsx'),
      'utf8',
    ).matchAll(/path="([^"]+)"/g),
  ].map((m) => m[1]),
);

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/before', '/no-such-page']} initialIndex={1}>
      <Routes>
        <Route path="/before" element={<Where />} />
        <Route path="/" element={<Where />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

function search(value: string) {
  fireEvent.change(screen.getByLabelText('Search pages'), { target: { value } });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Navigator 404 page', () => {
  it("has one H1, the board's heading", async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe("We can't find this page");
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(h1.closest('.nw-site.nwnf')).not.toBeNull();
  });

  it('sets the live page’s title and keeps the page out of search engines', async () => {
    await renderPage();
    expect(document.title).toBe('Page Not Found | Navigate Wealth');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
  });

  it('goes back through the history when there is one', async () => {
    await renderPage();
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(3);
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect((await screen.findByTestId('where')).textContent).toBe('/before');
  });

  it('goes home when there is no history', async () => {
    await renderPage();
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(1);
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect((await screen.findByTestId('where')).textContent).toBe('/');
  });

  it('links home, to the legal pages, WhatsApp, the resources and the contact page', async () => {
    await renderPage();
    expect(screen.getByRole('link', { name: 'Go home' }).getAttribute('href')).toBe('/');
    const legal = screen.getByRole('link', { name: /^Legal/ });
    expect(legal.getAttribute('href')).toBe('/legal');
    const whatsApp = screen.getByRole('link', { name: /Chat to us on WhatsApp/ });
    expect(whatsApp.getAttribute('href')).toBe(WHATSAPP_HREF);
    expect(whatsApp.getAttribute('target')).toBe('_blank');
    expect(whatsApp.getAttribute('rel')).toBe('noopener noreferrer');
    expect(
      screen.getByRole('link', { name: /Read the latest posts on our blog/ }).getAttribute('href'),
    ).toBe('/resources');
    expect(screen.getByRole('link', { name: 'Contact us' }).getAttribute('href')).toBe('/contact');
  });

  it('offers the board’s popular pages, each a route the app serves', async () => {
    await renderPage();
    const chips = screen.getByText('Popular:').parentElement!;
    const links = within(chips).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual([
      'Our Services',
      'Get a Quote',
      'Book a Free Consultation',
      'Resources',
      'Ask Vasco',
      'Contact Us',
    ]);
    for (const a of links) expect(SERVED_ROUTES.has(a.getAttribute('href')!)).toBe(true);
  });

  it('searches the main pages, with their sitemap descriptions, six at most', async () => {
    await renderPage();
    search('planning');
    expect(screen.getByRole('status').textContent).toBe('Best matches for “planning”');
    expect(screen.queryByText('Popular:')).toBeNull();
    const list = screen.getByRole('list');
    const results = within(list).getAllByRole('link');
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(6);
    const descriptions = new Map(
      sitemapSections.flatMap((s) => s.links).map((link) => [link.path, link.description]),
    );
    for (const a of results) {
      const path = a.getAttribute('href')!;
      expect(SERVED_ROUTES.has(path)).toBe(true);
      expect(a.textContent).toContain(descriptions.get(path));
    }
    expect(
      within(list)
        .getByRole('link', { name: /Retirement Planning/ })
        .getAttribute('href'),
    ).toBe('/retirement-planning');
  });

  it('says when nothing matches, links the sitemap, and clears back to the chips', async () => {
    await renderPage();
    search('zzz');
    expect(screen.getByRole('status').textContent).toBe('No pages match “zzz”.');
    expect(screen.getByRole('link', { name: 'open the sitemap' }).getAttribute('href')).toBe(
      '/sitemap',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('Popular:')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('');
    expect(document.activeElement).toBe(screen.getByLabelText('Search pages'));
  });
});
