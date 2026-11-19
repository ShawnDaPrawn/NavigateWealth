/**
 * The redesigned Legal & Compliance hub, reached the way production reaches
 * it: LegalPage with the design switch on lazy-loads NavigatorLegalPage.
 * Covers what the redesign must not lose (one H1 and the live SEO data, every
 * document linking to /legal/<slug>, the `?section=` tabs the footer links
 * to, the live rewrite of an unknown section) and what it adds (the search,
 * its summary and empty state, the tabs' keyboard pattern).
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

const { LegalPage } = await import('../../components/pages/LegalPage');
const { getSEOData } = await import('../../components/seo/seo-config');
const { createWebPageSchema } = await import('../../components/seo/SEO');
const { LEGAL_DOCUMENTS_REGISTRY } = await import('../../shared/legal-documents-registry');
const { FOOTER_LINKS } = await import('../siteLinks');

let location = '';
function LocationProbe() {
  const here = useLocation();
  location = `${here.pathname}${here.search}`;
  return null;
}

async function renderPage(path = '/legal') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <LegalPage />
      <LocationProbe />
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

function tablist() {
  return screen.getByRole('tablist', { name: 'Legal sections' });
}

function selectedTab() {
  return within(tablist())
    .getAllByRole('tab')
    .find((t) => t.getAttribute('aria-selected') === 'true');
}

function panel() {
  return screen.getByRole('tabpanel');
}

let scrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  location = '';
  scrollTo = vi.fn();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator Legal hub', () => {
  it("has one H1, the board's headline, and headings in order", async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Legal & Compliance');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Legal Notices',
      'Need Legal Assistance?',
    ]);
    const levels = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) =>
      Number(h.tagName[1]),
    );
    levels.forEach((level, i) => {
      if (i > 0) expect(level - levels[i - 1]).toBeLessThanOrEqual(1);
    });
  });

  it("emits the live page's SEO tags and WebPage data", async () => {
    await renderPage();
    const seo = getSEOData('legal');
    await waitFor(() => expect(document.getElementById('seo-structured-data')).not.toBeNull());
    expect(document.title).toBe(seo.title);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      seo.canonicalUrl,
    );
    expect(JSON.parse(document.getElementById('seo-structured-data')!.textContent!)).toEqual(
      createWebPageSchema(seo.title, seo.description, seo.canonicalUrl),
    );
  });

  it('opens on Legal Notices, listing its documents with links to each', async () => {
    await renderPage();
    expect(selectedTab()?.textContent).toContain('Legal Notices');
    const links = within(panel()).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/legal/legal-conditions',
      '/legal/terms-of-use',
      '/legal/website-disclaimer',
      '/legal/whistleblowing-policy',
    ]);
    expect(within(panel()).getByText('Terms of service and legal agreements')).toBeTruthy();
    expect(within(panel()).getByText('4 documents')).toBeTruthy();
  });

  it.each([
    [
      'privacy-data-protection',
      'Privacy & Data Protection',
      5,
      'Contact Our Data Protection Officer',
    ],
    ['regulatory-disclosures', 'Regulatory Disclosures', 6, 'Compliance Officer'],
    ['other', 'Other Legal Information', 6, null],
  ])('opens ?section=%s on that section', async (key, title, count, officer) => {
    await renderPage(`/legal?section=${key}`);
    expect(within(panel()).getByRole('heading', { level: 2 }).textContent).toBe(title);
    const docs = LEGAL_DOCUMENTS_REGISTRY.filter((doc) => doc.section === key);
    expect(docs).toHaveLength(count);
    const hrefs = within(panel())
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
      .filter((href) => href?.startsWith('/legal/'));
    expect(hrefs).toEqual(docs.map((doc) => `/legal/${doc.slug}`));
    if (officer) {
      expect(within(panel()).getByRole('heading', { level: 3 }).textContent).toBe(officer);
      expect(
        within(panel()).getByRole('link', { name: 'info@navigatewealth.co' }).getAttribute('href'),
      ).toBe('mailto:info@navigatewealth.co');
      expect(
        within(panel()).getByRole('link', { name: '+27 (0) 12 667 2505' }).getAttribute('href'),
      ).toBe('tel:+27126672505');
    } else {
      expect(within(panel()).queryByRole('heading', { level: 3 })).toBeNull();
    }
  });

  it('lands every footer legal link on its section', async () => {
    for (const link of FOOTER_LINKS.legal) {
      const section = new URL(link.path, 'https://x').searchParams.get('section');
      await renderPage(link.path);
      expect(selectedTab()?.getAttribute('aria-controls')).toBe(panel().id);
      expect(panel().getAttribute('aria-labelledby')).toBe(selectedTab()?.id);
      const docs = LEGAL_DOCUMENTS_REGISTRY.filter((doc) => doc.section === section);
      expect(within(panel()).getAllByRole('link')[0].getAttribute('href')).toBe(
        `/legal/${docs[0].slug}`,
      );
      cleanup();
    }
  });

  it('rewrites an unknown section to Legal Notices, as the live hub does', async () => {
    await renderPage('/legal?section=nonsense');
    await waitFor(() => expect(location).toBe('/legal?section=legal-notices'));
    expect(selectedTab()?.textContent).toContain('Legal Notices');
  });

  it('keeps the chosen section in the address without scrolling away from it', async () => {
    await renderPage();
    scrollTo.mockClear();
    fireEvent.click(within(tablist()).getByRole('tab', { name: /Regulatory/ }));
    await waitFor(() => expect(location).toBe('/legal?section=regulatory-disclosures'));
    expect(within(panel()).getByRole('heading', { level: 2 }).textContent).toBe(
      'Regulatory Disclosures',
    );
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls to the top when the address changes from outside, as the live hub does', async () => {
    await renderPage('/legal?section=other');
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });

  it('moves between sections with the arrow keys, Home and End', async () => {
    await renderPage();
    const first = within(tablist()).getAllByRole('tab')[0];
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    await waitFor(() => expect(selectedTab()?.textContent).toContain('Privacy & Data'));
    expect(document.activeElement).toBe(selectedTab());
    fireEvent.keyDown(selectedTab()!, { key: 'End' });
    await waitFor(() => expect(selectedTab()?.textContent).toContain('Other'));
    fireEvent.keyDown(selectedTab()!, { key: 'ArrowRight' });
    await waitFor(() => expect(selectedTab()?.textContent).toContain('Legal Notices'));
    expect(
      within(tablist())
        .getAllByRole('tab')
        .map((t) => t.tabIndex),
    ).toEqual([0, -1, -1, -1]);
  });

  it('searches every document and says how many matched', async () => {
    await renderPage();
    const box = screen.getByRole('searchbox', { name: 'Search legal documents' });
    expect(box.getAttribute('placeholder')).toBe(
      'Search 21 documents — e.g. privacy, complaints, FAIS…',
    );
    fireEvent.change(box, { target: { value: 'complaints' } });
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe(
      'Showing 1 document matching “complaints”.',
    );
    const results = screen.getByRole('list');
    expect(within(results).getByRole('link').getAttribute('href')).toBe(
      '/legal/complaints-procedure',
    );

    fireEvent.change(box, { target: { value: 'privacy' } });
    expect(screen.getByRole('status').textContent).toMatch(
      /^Showing \d+ documents matching “privacy”\.$/,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect((box as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('tablist')).toBeTruthy();
  });

  it('says so when nothing matches, and offers to clear the search', async () => {
    await renderPage();
    const box = screen.getByRole('searchbox', { name: 'Search legal documents' });
    fireEvent.change(box, { target: { value: 'zzzz' } });
    expect(screen.getByRole('status').textContent).toBe('No documents match “zzzz”.');
    expect(screen.getByText('No matching documents')).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'clear your search' }));
    });
    expect(screen.getByRole('tablist')).toBeTruthy();
  });

  it('links only to legal documents and routes the site already serves', async () => {
    await renderPage();
    const hrefs = new Set(screen.getAllByRole('link').map((a) => a.getAttribute('href')));
    const slugs = new Set(LEGAL_DOCUMENTS_REGISTRY.map((doc) => `/legal/${doc.slug}`));
    for (const href of hrefs) {
      if (href === '/' || href?.startsWith('mailto:') || href?.startsWith('tel:')) continue;
      expect(slugs.has(href!), `${href}`).toBe(true);
    }
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');
    const routes = readFileSync('src/app/AppRoutes.tsx', 'utf8');
    expect(routes).toContain('path="/legal/:slug"');
  });
});
