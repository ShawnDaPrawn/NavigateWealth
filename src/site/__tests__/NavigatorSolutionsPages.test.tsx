/**
 * The three Navigator Solutions pages, reached the way production reaches
 * them: through the design switch in publicPages. Covers what the redesign
 * must not lose against the live page rendered in the same test (copy, link
 * targets, modals, SEO) and what it adds (search-led H1, the audience
 * switcher, the FAQ with answers kept in the document).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Suspense, type ComponentType } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

// jsdom has no element scrolling.
Element.prototype.scrollTo = () => {};

const Switched = await import('../../app/publicPages');
const { ForIndividualsPage } = await import('../../components/pages/ForIndividualsPage');
const { ForBusinessesPage } = await import('../../components/pages/ForBusinessesPage');
const { ForAdvisersPage } = await import('../../components/pages/ForAdvisersPage');

afterEach(() => {
  cleanup();
  document.getElementById('seo-structured-data')?.remove();
});

const SERVICE_LINKS = {
  individuals: [
    '/medical-aid',
    '/risk-management',
    '/retirement-planning',
    '/investment-management',
    '/estate-planning',
    '/tax-planning',
  ],
  businesses: ['/employee-benefits', '/risk-management', '/investment-management', '/tax-planning'],
  advisers: ['/contact?type=advisors', '/risk-management'],
};

const PAGES = [
  {
    name: 'individuals',
    path: '/solutions/individuals',
    Navigator: Switched.ForIndividualsPage,
    Live: ForIndividualsPage,
    h1: 'Financial Advice for Individuals and Families in South Africa',
    slogan: 'Financial Planning for Individuals' as string | null,
    liveHeadline: 'Financial Planning for Individuals',
    start: '/signup',
    quote: 'Get a Quote',
    title: 'Financial Planning for Individuals | Navigate Wealth',
    faqCount: 4,
    extra: [] as string[],
  },
  {
    name: 'businesses',
    path: '/solutions/businesses',
    Navigator: Switched.ForBusinessesPage,
    Live: ForBusinessesPage,
    h1: 'Financial Solutions for South African Businesses',
    slogan: null,
    liveHeadline: 'Financial Solutions for Businesses',
    start: '/signup',
    quote: 'Get Your Business Quote',
    title: 'Financial Solutions for Businesses | Navigate Wealth',
    faqCount: 4,
    extra: [] as string[],
  },
  {
    name: 'advisers',
    path: '/solutions/advisers',
    Navigator: Switched.ForAdvisersPage,
    Live: ForAdvisersPage,
    h1: 'Succession Planning for Financial Advisers in South Africa',
    slogan: null,
    liveHeadline: 'Succession Planning for Advisers',
    start: '/contact',
    quote: 'Get Your Succession Plan',
    title: 'For Advisers | Succession Planning | Navigate Wealth',
    faqCount: 3,
    extra: [] as string[],
  },
] as const;

function renderAt(Page: ComponentType, path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Suspense fallback={null}>
        <Page />
      </Suspense>
    </MemoryRouter>,
  );
}

const norm = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();

function hrefs(root: ParentNode = document): string[] {
  return [...root.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? '');
}

/** The live page's links and its h2/h3/p copy, read from a real render. */
function readLive(Live: ComponentType, path: string) {
  const { container, unmount } = renderAt(Live, path);
  const links = new Set(hrefs(container));
  const copy = [...container.querySelectorAll('h2, h3, p')]
    .map((el) => norm(el.textContent))
    .filter(Boolean);
  unmount();
  document.getElementById('seo-structured-data')?.remove();
  return { links, copy };
}

describe.each(PAGES)('Navigator Solutions page: $name', (page) => {
  it('leads with the searched-for phrase as the only H1', async () => {
    renderAt(page.Navigator, page.path);
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(norm(h1.textContent)).toBe(page.h1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    if (page.slogan) expect(screen.getByText(page.slogan).tagName).toBe('P');
    // The live headline survives, as the slogan or inside the H1.
    const words = page.liveHeadline.split(' ').filter((w) => w !== 'for');
    for (const w of words) expect(norm(document.body.textContent)).toContain(w);
  });

  it('keeps every live link target and the live copy', async () => {
    const live = readLive(page.Live, page.path);
    renderAt(page.Navigator, page.path);
    await screen.findByRole('heading', { level: 1 });
    const nav = new Set(hrefs());
    for (const link of live.links) expect(nav, `missing ${link}`).toContain(link);
    const text = norm(document.body.textContent);
    for (const line of live.copy) expect(text, `missing copy: ${line}`).toContain(line);
  });

  it('links only to routes the site already serves', async () => {
    renderAt(page.Navigator, page.path);
    await screen.findByRole('heading', { level: 1 });
    expect(new Set(hrefs())).toEqual(
      new Set([
        page.start,
        ...SERVICE_LINKS[page.name],
        '/solutions/individuals',
        '/solutions/businesses',
        '/solutions/advisers',
        '/get-quote',
        '/ask-vasco',
        'tel:+27126672505',
        'mailto:info@navigatewealth.co',
      ]),
    );
  });

  it('marks the current page in the audience switcher', async () => {
    renderAt(page.Navigator, page.path);
    const nav = await screen.findByRole('navigation', { name: 'Choose your course' });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(3);
    const current = links.filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.getAttribute('href'))).toEqual([page.path]);
  });

  it('opens the live quote and consultation dialogs', async () => {
    renderAt(page.Navigator, page.path);
    await screen.findByRole('heading', { level: 1 });
    const quoteButtons = screen.getAllByRole('button', { name: page.quote });
    expect(quoteButtons).toHaveLength(2);
    fireEvent.click(quoteButtons[1]);
    const quote = await screen.findByRole('dialog');
    expect(within(quote).getByLabelText('First Name')).toBeDefined();
    fireEvent.keyDown(quote, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    for (const name of [/Book a Free Consultation/, /Book Consultation/]) {
      fireEvent.click(screen.getByRole('button', { name }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('button', { name: /Continue/ })).toBeDefined();
      fireEvent.keyDown(dialog, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }
  });

  it('keeps collapsed FAQ answers in the document, one open at a time', async () => {
    renderAt(page.Navigator, page.path);
    const faq = await screen.findByRole('region', { name: 'Frequently asked questions' });
    const questions = within(faq)
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-expanded'));
    expect(questions).toHaveLength(page.faqCount);
    const answer = (b: HTMLElement) => document.getElementById(b.getAttribute('aria-controls')!)!;
    expect(answer(questions[0]).hidden).toBe(false);
    expect(answer(questions[1]).hidden).toBe(true);
    expect(answer(questions[1]).textContent!.length).toBeGreaterThan(40);
    fireEvent.click(questions[1]);
    expect(answer(questions[0]).hidden).toBe(true);
    expect(answer(questions[1]).hidden).toBe(false);
  });

  it('keeps the live SEO tags and WebPage structured data', async () => {
    renderAt(page.Navigator, page.path);
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(document.title).toBe(page.title));
    await waitFor(() => expect(document.getElementById('seo-structured-data')).not.toBeNull());
    const data = JSON.parse(document.getElementById('seo-structured-data')!.textContent!);
    expect(JSON.stringify(data)).toContain('WebPage');
    expect(JSON.stringify(data)).toContain(page.path);
  });

  it('gives every image an alt and keeps heading order', async () => {
    const { container } = renderAt(page.Navigator, page.path);
    await screen.findByRole('heading', { level: 1 });
    for (const img of container.querySelectorAll('img')) expect(img.hasAttribute('alt')).toBe(true);
    const levels = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) =>
      Number(h.tagName[1]),
    );
    levels.forEach((level, i) => {
      if (i > 0) expect(level - levels[i - 1]).toBeLessThanOrEqual(1);
    });
  });
});
