/**
 * The redesigned Press page through the design switch, checked against the
 * live page: the same SEO, the same press feed and filters, every live link
 * target, the media-kit request by email, and filtered-out releases kept in
 * the document.
 */
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));

const { PressPage } = await import('../../app/publicPages');
const { PressPage: LivePressPage } = await import('../../components/pages/PressPage');

const ARTICLES = [
  {
    id: 'a1',
    title: 'Navigate Wealth receives its FSP licence',
    slug: 'fsp-licence',
    excerpt: 'The FSCA authorised the practice in February 2025.',
    press_category: 'company_news',
    published_at: '2025-02-10',
    reading_time_minutes: 3,
    hero_image_url: 'https://example.com/licence.jpg',
  },
  {
    id: 'a2',
    title: 'What the two-pot system means for you',
    slug: 'two-pot',
    excerpt: 'An explainer.',
    press_category: 'industry_insights',
  },
];

function mockArticles(data: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data }) }),
  );
}

async function renderNavigator() {
  render(
    <MemoryRouter initialEntries={['/press']}>
      <Suspense fallback={null}>
        <PressPage />
      </Suspense>
    </MemoryRouter>,
  );
  const h1 = await screen.findByRole('heading', { level: 1 });
  await waitFor(() => expect(screen.queryByText(/Loading press releases/)).toBeNull());
  return h1;
}

function hrefs(root: ParentNode = document): Set<string> {
  return new Set([...root.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? ''));
}

beforeEach(() => mockArticles(ARTICLES));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator Press page', () => {
  it('has one descriptive H1 and the same SEO as the live page', async () => {
    render(
      <MemoryRouter>
        <LivePressPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const liveTitle = document.title;
    const liveJsonLd = document.getElementById('seo-structured-data')?.textContent;
    cleanup();
    document.getElementById('seo-structured-data')?.remove();

    const h1 = await renderNavigator();
    expect(h1.textContent).toBe('Navigate Wealth Press and Media');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.title).toBe(liveTitle);
    expect(document.getElementById('seo-structured-data')?.textContent).toBe(liveJsonLd);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      'https://proj.supabase.co/functions/v1/make-server-91ed8379/publications/press/articles',
    );
  });

  it('keeps every live link target; adds only in-page and contact links', async () => {
    const { container } = render(
      <MemoryRouter>
        <LivePressPage />
      </MemoryRouter>,
    );
    await screen.findByText('Navigate Wealth receives its FSP licence');
    const live = hrefs(container);
    cleanup();
    await renderNavigator();
    const nav = hrefs();
    for (const target of live) expect(nav.has(target)).toBe(true);
    expect([...nav].filter((h) => !live.has(h)).sort()).toEqual([
      '#contact',
      'mailto:info@navigatewealth.co',
      'tel:+27126672505',
    ]);
  });

  it('filters by category and search, keeping filtered-out releases in the document', async () => {
    await renderNavigator();
    const results = document.getElementById('nwx-press-results')!;
    const card = (title: string) =>
      within(results).getByText(title, { selector: 'h3' }).closest('li')!;
    expect(card('Navigate Wealth receives its FSP licence').hidden).toBe(false);
    expect(
      within(results)
        .getByRole('link', { name: /receives its FSP licence/ })
        .getAttribute('href'),
    ).toBe('/resources/article/fsp-licence');

    const tabs = within(screen.getByRole('tablist', { name: 'Press categories' })).getAllByRole(
      'tab',
    );
    expect(tabs.map((t) => t.textContent)).toEqual([
      'All',
      'Company News',
      'Product Launch',
      'Industry Insights',
    ]);
    fireEvent.click(tabs[3]);
    expect(card('Navigate Wealth receives its FSP licence').hidden).toBe(true);
    expect(card('What the two-pot system means for you').hidden).toBe(false);

    fireEvent.keyDown(tabs[3], { key: 'Home' });
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    fireEvent.change(screen.getByLabelText('Search press releases'), {
      target: { value: 'nothing matches this' },
    });
    expect(screen.getByRole('heading', { name: 'No Matching Results' })).toBeDefined();
    expect(card('What the two-pot system means for you').hidden).toBe(true);
  });

  it('says there is no news when the feed is empty', async () => {
    mockArticles([]);
    await renderNavigator();
    expect(screen.getByRole('heading', { name: 'No News Available' })).toBeDefined();
    expect(screen.getByRole('link', { name: /Contact Us/ }).getAttribute('href')).toBe('/contact');
  });

  it('states only checkable company facts', async () => {
    await renderNavigator();
    const info = screen.getByRole('heading', { name: 'Company Information' }).parentElement!;
    for (const fact of ['Wealthfront (Pty) Ltd', 'Shawn Francisco', '2024', '54606']) {
      expect(within(info).getAllByText(fact).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/registration 2024\/071953\/07/)).toBeDefined();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/\d+\+ (clients|years)/i);
    expect(text).not.toMatch(/award/i);
  });

  it('requests the media kit by email, as the live page does', async () => {
    await renderNavigator();
    fireEvent.click(screen.getByRole('button', { name: /Request Media Kit/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Request Media Materials' });
    expect(
      within(dialog)
        .getByRole('link', { name: /Email Your Request/ })
        .getAttribute('href'),
    ).toBe('mailto:info@navigatewealth.co?subject=Media%20kit%20request');
    // The corner ✕ and the text button are both "Close".
    const closers = within(dialog).getAllByRole('button', { name: 'Close' });
    expect(closers).toHaveLength(2);
    fireEvent.click(closers[1]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Request Founder Photos' }));
    expect(await screen.findByRole('dialog')).toBeDefined();
  });

  it('copies the boilerplate', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await renderNavigator();
    fireEvent.click(screen.getByRole('button', { name: 'Copy boilerplate' }));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeDefined();
    expect(writeText.mock.calls[0][0]).toMatch(/^Navigate Wealth is the trading name of/);
  });
});
