/**
 * The redesigned Resources page, reached the way production reaches it:
 * ResourcesPage with the design switch on lazy-loads NavigatorResourcesPage.
 * Covers what the redesign must not lose (one H1 and the live SEO data, every
 * `?section=` deep link, articles as crawlable links, the topic filter and the
 * search with its `?q=` address, the newsletter sign-up's endpoint and
 * payload, the newsletter archive's links, the same data routes) and its
 * empty and loading states. It also holds the page to companyFacts.ts: the
 * counts it shows are counted, and the board's compliance line is left out.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../utils/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/api/client')>()),
  api,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const { ResourcesPage } = await import('../../components/pages/ResourcesPage');
const { getSEOData } = await import('../../components/seo/seo-config');

const CATEGORIES = [
  {
    id: 'c-ret',
    name: 'Retirement Planning',
    slug: 'retirement-planning',
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'c-est',
    name: 'Estate & Tax Planning',
    slug: 'estate-tax-planning',
    sort_order: 2,
    is_active: true,
  },
  { id: 'c-old', name: 'Retired topic', slug: 'retired-topic', sort_order: 3, is_active: false },
];

function article(n: number, over: Record<string, unknown> = {}) {
  return {
    id: `a${n}`,
    title: `Article number ${n}`,
    slug: `article-${n}`,
    excerpt: `Excerpt ${n}.`,
    category_id: 'c-ret',
    category_name: 'Retirement Planning',
    status: 'published',
    is_featured: false,
    published_at: `2026-10-${String(28 - n).padStart(2, '0')}T08:00:00Z`,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    reading_time_minutes: 4,
    thumbnail_image_url: `https://cdn.test/thumb-${n}.jpg`,
    hero_image_url: `https://cdn.test/hero-${n}.jpg`,
    ...over,
  };
}

const ARTICLES = [
  article(1, {
    title: 'The will you signed may not be valid',
    slug: 'the-will-you-signed',
    category_id: 'c-est',
    category_name: 'Estate & Tax Planning',
    is_featured: true,
  }),
  article(2, { title: 'Your savings pot allows one withdrawal a tax year' }),
  article(3, { is_featured: true, thumbnail_image_url: '', hero_image_url: '' }),
  ...Array.from({ length: 9 }, (_, i) => article(i + 4)),
];

const NEWSLETTERS = [
  {
    slug: '2026-10-the-wealth-compass-make-room',
    title: 'Navigate Wealth | October 2026 | The Wealth Compass: Make room for 2027',
    description: 'The October issue.',
    issueMonth: '2026-10',
    year: 2026,
    month: 10,
    pdfUrl: 'https://cdn.test/2026-10.pdf',
    pdfFileName: 'Navigate_Wealth_Newsletter_2026-10.pdf',
    pdfSizeBytes: 1888630,
    publishedAt: '2026-10-10T09:44:07.072Z',
  },
];

const RSS = {
  status: 'ok',
  feed: { title: 'Investing.com' },
  items: [
    {
      title: 'Rand firms as inflation cools',
      pubDate: '2026-11-19T07:00:00Z',
      author: 'Reuters',
      link: 'https://news.test/rand-firms',
      thumbnail: '',
    },
  ],
};

interface Data {
  articles?: unknown[];
  categories?: unknown[];
  newsletters?: unknown[];
}

function stubData({
  articles = ARTICLES,
  categories = CATEGORIES,
  newsletters = NEWSLETTERS,
}: Data = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      const body = u.includes('/publications/categories')
        ? { success: true, data: categories }
        : u.includes('/publications/articles')
          ? { success: true, data: articles }
          : u.includes('/rss-proxy')
            ? RSS
            : {};
      return { ok: true, status: 200, json: async () => body };
    }),
  );
  api.get.mockImplementation(async (path: string) =>
    path === '/newsletter-site/newsletters' ? { newsletters } : {},
  );
}

function fetchedUrls(): string[] {
  return vi.mocked(fetch).mock.calls.map(([url]) => String(url));
}

let location = '';
function LocationProbe() {
  const here = useLocation();
  location = `${here.pathname}${here.search}`;
  return null;
}

function renderPage(path = '/resources') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ResourcesPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Renders the page and waits for the library to finish loading. */
async function renderLoaded(path = '/resources') {
  renderPage(path);
  await screen.findByRole('heading', { level: 1 });
  await waitFor(() => expect(screen.queryByText('Loading articles…')).toBeNull());
}

function selectedTab(): string {
  const tablist = screen.getByRole('tablist', { name: 'Resource sections' });
  const tab = within(tablist)
    .getAllByRole('tab')
    .find((t) => t.getAttribute('aria-selected') === 'true');
  return tab?.querySelector('span')?.textContent ?? '';
}

beforeEach(() => {
  // The newsletter years are counted back from today: pin today.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-19T10:00:00Z') });
  vi.clearAllMocks();
  location = '';
  stubData();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator Resources page', () => {
  it('has one H1 and the live page’s SEO data', async () => {
    await renderLoaded();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].closest('.nw-site.nwrs')).not.toBeNull();
    expect(h1s[0].textContent).toContain('Market Intelligence');

    const seo = getSEOData('resources');
    await waitFor(() => expect(document.getElementById('seo-structured-data')).not.toBeNull());
    const data = JSON.parse(document.getElementById('seo-structured-data')!.textContent!);
    expect(data).toMatchObject({
      '@type': 'WebPage',
      name: seo.title,
      description: seo.description,
      url: seo.canonicalUrl,
    });
    expect(document.title).toBe(seo.title);
  });

  it.each([
    ['insights', 'Insights & Education', 'All articles'],
    ['market-watch', 'Market Watch', 'Live markets, at a glance'],
    ['market-updates', 'Market News', 'Headlines from the wire'],
    ['newsletters', 'Newsletters', 'The Wealth Compass archive'],
  ])('opens the %s tab from ?section=', async (section, tab, heading) => {
    renderPage(`/resources?section=${section}`);
    expect(await screen.findByRole('heading', { level: 2, name: heading })).toBeDefined();
    expect(selectedTab()).toBe(tab);
  });

  it('opens Insights when ?section= is missing or unknown', async () => {
    renderPage('/resources?section=nonsense');
    expect(await screen.findByRole('heading', { level: 2, name: 'All articles' })).toBeDefined();
    expect(selectedTab()).toBe('Insights & Education');
  });

  it('rewrites ?section= when a tab is chosen, and arrow keys move between tabs', async () => {
    await renderLoaded('/resources?q=will');
    fireEvent.click(screen.getByRole('tab', { name: /Newsletters/ }));
    expect(location).toBe('/resources?section=newsletters');
    expect(
      await screen.findByRole('heading', { name: 'The Wealth Compass archive' }),
    ).toBeDefined();

    const current = screen.getByRole('tab', { name: /Newsletters/ });
    expect(current.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(current, { key: 'ArrowLeft' });
    expect(location).toBe('/resources?section=market-updates');
    expect(document.activeElement?.textContent).toBe('Market News');
  });

  it('reads the live page’s routes', async () => {
    await renderLoaded();
    const urls = fetchedUrls();
    const route = (path: string) =>
      urls.some((u) => u.endsWith(`/functions/v1/make-server-91ed8379${path}`));
    expect(route('/publications/articles?status=published')).toBe(true);
    expect(route('/publications/categories')).toBe(true);
    expect(api.get).toHaveBeenCalledWith('/newsletter-site/newsletters');
    // Market news is fetched only once its tab is open, as on the live page.
    expect(urls.some((u) => u.includes('/rss-proxy'))).toBe(false);
  });

  it('renders articles as links to /resources/article/<slug>, newest first, nine at a time', async () => {
    await renderLoaded();
    const library = document.getElementById('articles')!;
    const links = within(library).getAllByRole('link');
    expect(links).toHaveLength(9);
    expect(links[0].getAttribute('href')).toBe('/resources/article/the-will-you-signed');
    expect(links[0].textContent).toContain('The will you signed may not be valid');
    expect(links[1].getAttribute('href')).toBe('/resources/article/article-2');
    for (const img of library.querySelectorAll('img')) expect(img.getAttribute('alt')).toBe('');

    expect(within(library).getByText('Showing 9 of 12')).toBeDefined();
    fireEvent.click(within(library).getByRole('button', { name: 'Load more articles' }));
    expect(within(library).getAllByRole('link')).toHaveLength(12);
    expect(within(library).queryByRole('button', { name: 'Load more articles' })).toBeNull();
  });

  it('shows the featured articles: the editors’ picks', async () => {
    await renderLoaded();
    const featured = screen.getByRole('region', { name: 'Featured insights' });
    const hrefs = within(featured)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '/resources/article/the-will-you-signed',
      '/resources/article/article-3',
    ]);
  });

  it('counts what it shows from the data', async () => {
    await renderLoaded();
    expect(within(screen.getByRole('tab', { name: /Insights/ })).getByText('12')).toBeDefined();
    expect(within(screen.getByRole('tab', { name: /Newsletters/ })).getByText('1')).toBeDefined();
    expect(screen.getByText('12 articles across 2 topics, newest first')).toBeDefined();
    expect(
      screen.getByRole('searchbox', { name: 'Search articles' }).getAttribute('placeholder'),
    ).toBe('Search 12 articles…');
    // A compliance claim companyFacts.ts does not list.
    expect(document.body.textContent).not.toMatch(/POPIA/);
  });

  it('narrows the library by topic', async () => {
    await renderLoaded();
    const group = screen.getByRole('group', { name: 'Filter articles by topic' });
    // Only active categories are offered.
    expect(within(group).queryByRole('button', { name: 'Retired topic' })).toBeNull();
    fireEvent.click(within(group).getByRole('button', { name: 'Estate & Tax Planning' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Estate & Tax Planning' })).toBeDefined();
    expect(screen.getByText('1 article · newest first')).toBeDefined();
    const links = within(document.getElementById('articles')!).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/resources/article/the-will-you-signed',
    ]);
    expect(
      within(group)
        .getByRole('button', { name: 'Estate & Tax Planning' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('searches after a pause, keeps the query in ?q=, and clears it', async () => {
    await renderLoaded();
    const box = screen.getByRole('searchbox', { name: 'Search articles' });
    fireEvent.change(box, { target: { value: 'savings pot' } });
    // Nothing is searched until the typing pauses.
    expect(screen.getByText('Searching…')).toBeDefined();
    expect(await screen.findByText('Top 1 match')).toBeDefined();
    const results = document.querySelector<HTMLElement>('.nwrs-results')!;
    const result = within(results).getByRole('link');
    expect(result.getAttribute('href')).toBe('/resources/article/article-2');
    expect(result.textContent).toContain('Your savings pot allows one withdrawal');
    await waitFor(() => expect(location).toBe('/resources?q=savings+pot'));
    // Announced politely, not just shown.
    expect(screen.getByText('1 match').getAttribute('role')).toBe('status');

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(location).toBe('/resources');
    expect(screen.queryByText('Top 1 match')).toBeNull();
  });

  it('opens a shared ?q= search, and says so when nothing matches', async () => {
    await renderLoaded('/resources?q=zzzz');
    expect(screen.getByRole('searchbox', { name: 'Search articles' })).toHaveProperty(
      'value',
      'zzzz',
    );
    expect(
      await screen.findByText('No results found', { selector: '.nwrs-noresults-t' }),
    ).toBeDefined();
    expect(screen.getAllByText('No results found').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Retirement' }));
    await waitFor(() => expect(location).toBe('/resources?q=Retirement'));
    expect(screen.getByText(/^Top \d+ match/)).toBeDefined();
  });

  it('subscribes with the live payload and confirms in place', async () => {
    api.post.mockResolvedValue({ requiresConfirmation: true });
    await renderLoaded();
    const band = screen.getByRole('region', { name: 'Newsletter' });
    fireEvent.change(within(band).getByLabelText('Email address'), {
      target: { value: 'person@example.com' },
    });
    fireEvent.click(within(band).getByRole('button', { name: 'Subscribe' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/newsletter/subscribe',
        { email: 'person@example.com' },
        { retryTransientFailures: false },
      ),
    );
    expect(await within(band).findByText('Check your email!')).toBeDefined();
  });

  it('refuses an invalid email without calling the endpoint', async () => {
    await renderLoaded();
    const band = screen.getByRole('region', { name: 'Newsletter' });
    fireEvent.change(within(band).getByLabelText('Email address'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(within(band).getByRole('button', { name: 'Subscribe' }));
    expect(toast.error).toHaveBeenCalledWith('Please enter a valid email address');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows the empty state when there are no articles', async () => {
    stubData({ articles: [] });
    await renderLoaded();
    expect(screen.getByText('No Articles Yet')).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Featured insights' })).toBeNull();
    expect(screen.getByText('0 articles across 2 topics, newest first')).toBeDefined();
  });

  it('lists the newsletter archive with both ways to read an issue', async () => {
    renderPage('/resources?section=newsletters');
    const title = await screen.findByRole('heading', {
      level: 4,
      name: NEWSLETTERS[0].title,
    });
    const card = title.closest('article')!;
    expect(within(card).getByRole('link', { name: 'Read online' }).getAttribute('href')).toBe(
      `/resources/newsletter/${NEWSLETTERS[0].slug}`,
    );
    const pdf = within(card).getByRole('link', { name: 'Download PDF' });
    expect(pdf.getAttribute('href')).toBe(NEWSLETTERS[0].pdfUrl);
    expect(pdf.getAttribute('download')).toBe(NEWSLETTERS[0].pdfFileName);
    expect(within(card).getByText('PDF · 1.8 MB')).toBeDefined();
    expect(screen.getByRole('heading', { level: 3, name: 'October 2026' })).toBeDefined();
    expect(screen.getByRole('tab', { name: '2026' }).getAttribute('aria-selected')).toBe('true');
  });

  it('keeps older years behind the "Older" menu, as the live archive does', async () => {
    stubData({
      newsletters: [
        ...NEWSLETTERS,
        {
          ...NEWSLETTERS[0],
          slug: '2021-05-review',
          title: 'May 2021 review',
          issueMonth: '2021-05',
          year: 2021,
          month: 5,
        },
      ],
    });
    renderPage('/resources?section=newsletters');
    await screen.findByRole('heading', { level: 4, name: NEWSLETTERS[0].title });
    expect(screen.getAllByRole('tab', { name: /^20/ }).map((t) => t.textContent)).toEqual(['2026']);
    const older = screen.getByRole('button', { name: 'Older years' });
    fireEvent.click(older);
    fireEvent.click(screen.getByRole('menuitem', { name: '2021' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: 'May 2021' })).toBeDefined();
    expect(older.textContent).toBe('2021');
  });

  it('"Read past issues" opens the newsletter archive', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Read past issues' }));
    expect(location).toBe('/resources?section=newsletters');
    expect(
      await screen.findByRole('heading', { name: 'The Wealth Compass archive' }),
    ).toBeDefined();
  });

  it('shows the archive’s empty state when nothing is published', async () => {
    stubData({ newsletters: [] });
    renderPage('/resources?section=newsletters');
    expect(await screen.findByText('No newsletters yet')).toBeDefined();
  });

  it('loads market news through the live proxy and opens headlines in a new tab', async () => {
    renderPage('/resources?section=market-updates');
    const link = await screen.findByRole('link', { name: /Rand firms as inflation cools/ });
    expect(link.getAttribute('href')).toBe('https://news.test/rand-firms');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(fetchedUrls().some((u) => u.includes('/rss-proxy?url='))).toBe(true);
  });

  it('switches Market Watch views as tabs', async () => {
    renderPage('/resources?section=market-watch');
    const list = await screen.findByRole('tablist', { name: 'Market Watch sections' });
    fireEvent.click(within(list).getByRole('tab', { name: 'View Forex Rates' }));
    expect(screen.getByRole('heading', { level: 3, name: 'Forex Rates' })).toBeDefined();
    expect(
      within(list).getByRole('tab', { name: 'View Forex Rates' }).getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('links only to routes the site serves, or out to publishers', async () => {
    await renderLoaded();
    const internal = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => !href.startsWith('/resources/article/'));
    expect(new Set(internal)).toEqual(
      new Set(['/ask-vasco', '/schedule-consultation', '/get-quote']),
    );
  });
});
