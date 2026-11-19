/**
 * The redesigned article page, reached the way production reaches it:
 * ArticleDetailPage with the design switch on lazy-loads NavigatorArticlePage.
 *
 * Covers what the redesign must not lose from the live page: the article
 * request and the view count, the sanitised body, one H1, the same SEO tags,
 * canonical URL and JSON-LD, the share targets, the print view, the
 * newsletter's email-engagement tracking, "Article Not Found" (noindex) for
 * an unknown slug and the related-articles request. And what the board adds:
 * the by-line table, the table of contents, the call to action's links and
 * the newsletter sign-up's endpoint and payload.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';

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

const { ArticleDetailPage } = await import('../../components/pages/ArticleDetailPage');
const { buildArticleTitle } = await import('../../components/seo/seo-config');

const SLUG = 'the-will-you-signed-may-not-be-valid';

const BODY = `
<p>An incorrectly signed will is one of the few financial planning failures that cannot be repaired after the fact.</p>
<p>Second paragraph <img src="https://cdn.test/x.png" alt="x" onerror="window.__pwned = true"></p>
<script>window.__pwned = true</script>
<h2>What the law requires</h2>
<p>Section 2(1)(a) of the Wills Act is prescriptive.</p>
<h3>Who may sign as a witness</h3>
<p>A witness must be at least 14.</p>
<h1>Where it goes wrong</h1>
<ul><li><strong>Only one witness.</strong> Both must be present.</li></ul>
<blockquote><p>A will that fails hands the estate to a formula.</p></blockquote>
<table><tr><th>Survivors</th><th>Spouse receives</th></tr><tr><td>Spouse only</td><td>Whole estate</td></tr></table>
<h2 id="sources">Sources and further reading</h2>
<p>Key Takeaway: re-executing a will is straightforward.</p>`;

function article(over: Record<string, unknown> = {}) {
  return {
    id: 'art-will',
    slug: SLUG,
    title: 'The will you signed may not be valid',
    excerpt: 'The errors are small and common.',
    body: BODY,
    status: 'published',
    category_id: 'cat-estate',
    category_name: 'Estate & Tax Planning',
    is_featured: true,
    reading_time_minutes: 4,
    view_count: 7,
    published_at: '2026-10-12T08:00:00Z',
    updated_at: '2026-11-03T09:30:00Z',
    hero_image_url: 'https://cdn.test/hero.jpg',
    ...over,
  };
}

const RELATED = [
  { id: 'art-will', slug: SLUG, title: 'The will you signed may not be valid' },
  {
    id: 'r1',
    slug: 'a-defective-will-can-sometimes-be-rescued',
    title: 'A defective will can sometimes be rescued',
    excerpt: 'It can be saved by a High Court order.',
    category_name: 'Estate & Tax Planning',
    published_at: '2026-11-14T10:00:00Z',
    reading_time_minutes: 4,
    thumbnail_image_url: 'https://cdn.test/r1.jpg',
  },
  {
    id: 'r2',
    slug: 'your-child-can-inherit-at-any-age',
    title: 'Your child can inherit at any age',
    category_name: 'Estate & Tax Planning',
    published_at: '2026-11-13T10:00:00Z',
    reading_time_minutes: 5,
  },
];

interface Stub {
  article?: Record<string, unknown> | null;
  status?: number;
  pending?: boolean;
  related?: unknown[];
}

function stub({
  article: data = article(),
  status = 200,
  pending = false,
  related = RELATED,
}: Stub = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/publications/articles/slug/')) {
        if (pending) return new Promise(() => {});
        return {
          ok: status === 200,
          status,
          json: async () => (status === 200 ? { success: true, data } : { success: false }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    }),
  );
  api.get.mockImplementation(async (path: string) =>
    path.startsWith('/publications/articles?') ? { success: true, data: related } : {},
  );
  api.post.mockResolvedValue({ success: true, requiresConfirmation: true });
}

function fetchCalls(): Array<[string, RequestInit | undefined]> {
  return vi.mocked(fetch).mock.calls.map(([url, init]) => [String(url), init as RequestInit]);
}

function renderPage(slug = SLUG) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/resources/article/${slug}`]}>
        <Routes>
          <Route path="/resources/article/:slug" element={<ArticleDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function renderLoaded(slug = SLUG) {
  const view = renderPage(slug);
  await screen.findByRole('heading', { level: 1 });
  return view;
}

const windowOpen = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('open', windowOpen);
  window.history.replaceState(null, '', `/resources/article/${SLUG}`);
  stub();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.getElementById('seo-structured-data')?.remove();
  document.head.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove());
  delete (window as unknown as { __pwned?: boolean }).__pwned;
});

describe('Navigator article page', () => {
  it('has one H1, the article title, in the redesign', async () => {
    await renderLoaded();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe('The will you signed may not be valid');
    expect(h1s[0].closest('.nw-site.nwar')).not.toBeNull();
    // The board's italic accent falls on the last words.
    expect(h1s[0].querySelector('.nwar-accent-l')?.textContent).toBe('not be valid');
  });

  it('loads the article by slug and counts the view, as the live page does', async () => {
    await renderLoaded();
    await waitFor(() =>
      expect(
        fetchCalls().some(([u]) => u.endsWith('/publications/articles/art-will/increment-views')),
      ).toBe(true),
    );
    const [load] = fetchCalls().filter(([u]) => u.includes('/publications/articles/slug/'));
    expect(load[0]).toMatch(
      new RegExp(`/make-server-91ed8379/publications/articles/slug/${SLUG}$`),
    );
    const view = fetchCalls().find(([u]) => u.endsWith('/increment-views'));
    expect(view?.[1]?.method).toBe('POST');
  });

  it('emits the live page’s SEO tags, canonical URL and Article/BreadcrumbList JSON-LD', async () => {
    await renderLoaded();
    await waitFor(() => expect(document.getElementById('seo-structured-data')).not.toBeNull());
    expect(document.title).toBe(buildArticleTitle('The will you signed may not be valid'));
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
    expect(canonical).toBe(`https://www.navigatewealth.co/resources/article/${SLUG}`);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'index, follow',
    );
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe(
      'article',
    );
    const data = JSON.parse(document.getElementById('seo-structured-data')!.textContent!);
    const graph = data['@graph'] as Array<Record<string, unknown>>;
    expect(graph.find((n) => n['@type'] === 'BreadcrumbList')).toMatchObject({
      itemListElement: [
        { name: 'Home' },
        { name: 'Resources' },
        { name: 'The will you signed may not be valid' },
      ],
    });
    expect(graph.find((n) => n['@type'] === 'Article')).toMatchObject({
      '@id': `${canonical}#article`,
      headline: 'The will you signed may not be valid',
      description: 'The errors are small and common.',
      image: 'https://cdn.test/hero.jpg',
      inLanguage: 'en-ZA',
      author: { '@type': 'Person', name: 'Navigate Wealth' },
      datePublished: '2026-10-12T08:00:00Z',
      dateModified: '2026-11-03T09:30:00Z',
      mainEntityOfPage: canonical,
    });
  });

  it('marks a duplicate noindex, follow when the article names another canonical', async () => {
    stub({
      article: article({
        seo_canonical_url: 'https://www.navigatewealth.co/resources/article/original',
      }),
    });
    await renderLoaded();
    await waitFor(() =>
      expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
        'noindex, follow',
      ),
    );
  });

  it('renders the body through the live sanitiser and shapes it for the page', async () => {
    const { container } = await renderLoaded();
    const prose = container.querySelector('.nwar-prose')!;
    expect(prose.querySelector('script')).toBeNull();
    expect(prose.querySelector('img')?.getAttribute('onerror')).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
    // The live enhancement: lead paragraph, pull quote, callout.
    expect(prose.querySelector('p')?.classList.contains('article-drop-cap')).toBe(true);
    expect(prose.querySelector('blockquote.article-pull-quote')).not.toBeNull();
    expect(prose.querySelector('.article-callout-takeaway')).not.toBeNull();
    // One H1 on the page: the body's own becomes an h2.
    expect(prose.querySelector('h1')).toBeNull();
    expect(
      within(prose as HTMLElement).getByRole('heading', { level: 2, name: 'Where it goes wrong' }),
    ).toBeDefined();
    // Headings keep their ids or get the live table of contents' ones.
    expect([...prose.querySelectorAll('h2, h3')].map((h) => h.id)).toEqual([
      'toc-heading-0',
      'toc-heading-1',
      'toc-heading-2',
      'sources',
    ]);
    // Tables scroll inside the column.
    expect(prose.querySelector('.nwar-table > table')).not.toBeNull();
  });

  it('shows the by-line table as the board draws it', async () => {
    await renderLoaded();
    const dl = document.querySelector('.nwar-meta') as HTMLElement;
    const rows = [...dl.querySelectorAll('.nwar-meta-row')].map((r) => [
      r.querySelector('dt')?.textContent,
      r.querySelector('dd')?.textContent,
    ]);
    expect(rows).toEqual([
      ['By', 'Navigate Wealth'],
      ['Published', '12 October 2026'],
      ['Updated', '3 November 2026'],
      ['Reading time', '4 min read · 7 views'],
    ]);
    expect(screen.getByText('Featured')).toBeDefined();
    expect(screen.getByText('The errors are small and common.')).toBeDefined();
    expect(screen.getByRole('img', { name: 'The will you signed may not be valid' })).toBeDefined();
  });

  it('leaves out Updated when it is the publication day, and views when there are none', async () => {
    stub({
      article: article({
        updated_at: '2026-10-12T15:00:00Z',
        view_count: 0,
        is_featured: false,
        author_name: 'Jane Adviser',
      }),
    });
    await renderLoaded();
    const dl = document.querySelector('.nwar-meta') as HTMLElement;
    expect(within(dl).queryByText('Updated')).toBeNull();
    expect(within(dl).getByText('4 min read')).toBeDefined();
    expect(within(dl).getByText('Jane Adviser')).toBeDefined();
    expect(screen.queryByText('Featured')).toBeNull();
  });

  it('links to real routes', async () => {
    await renderLoaded();
    const hrefOf = (name: string | RegExp) =>
      screen.getAllByRole('link', { name }).map((a) => a.getAttribute('href'));
    expect(hrefOf('Back to Resources')).toEqual(['/resources']);
    expect(hrefOf('Book a Free Consultation')).toEqual([
      '/schedule-consultation',
      '/schedule-consultation',
    ]);
    // The category picks the service page the call to action opens.
    expect(hrefOf('Estate Planning')).toEqual(['/estate-planning']);
    expect(hrefOf(/Explore More Insights/)).toEqual(['/resources']);
    expect(await screen.findByRole('link', { name: /View all articles/ })).toBeDefined();
  });

  it('lists the table of contents as links to the headings', async () => {
    await renderLoaded();
    const rail = screen.getAllByRole('navigation', { name: 'Table of contents' })[0];
    const links = within(rail).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['What the law requires', '#toc-heading-0'],
      ['Who may sign as a witness', '#toc-heading-1'],
      ['Where it goes wrong', '#toc-heading-2'],
      ['Sources and further reading', '#sources'],
    ]);
    expect(links[0].getAttribute('aria-current')).toBe('location');
    fireEvent.click(links[2]);
    expect(links[2].getAttribute('aria-current')).toBe('location');
    expect(document.activeElement?.id).toBe('toc-heading-2');
  });

  it('folds the table of contents away on narrow screens once an entry is chosen', async () => {
    await renderLoaded();
    const fold = screen.getByRole('button', { name: 'In this article' });
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(fold);
    expect(fold.getAttribute('aria-expanded')).toBe('true');
    const list = document.getElementById(fold.getAttribute('aria-controls')!)!;
    // The scroll must be measured with the list already folded away (review
    // finding): scrolling first, then collapsing, would leave the reader past
    // the heading by the list's height.
    const foldedWhenScrolled: boolean[] = [];
    const scrollIntoView = vi.fn(function scrolled() {
      foldedWhenScrolled.push(fold.getAttribute('aria-expanded') === 'false');
    });
    Element.prototype.scrollIntoView = scrollIntoView;
    fireEvent.click(within(list).getByRole('link', { name: 'Where it goes wrong' }));
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(foldedWhenScrolled).toEqual([true]);
  });

  it('leaves the table of contents out for an article with fewer than two headings', async () => {
    stub({
      article: article({
        body: '<p>A short note with no sections at all, just one paragraph.</p>',
      }),
    });
    await renderLoaded();
    expect(screen.queryByRole('navigation', { name: 'Table of contents' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Share' })).toBeDefined();
  });

  it('shares to the live page’s targets', async () => {
    await renderLoaded();
    const share = screen.getByRole('button', { name: 'Share' });
    fireEvent.click(share);
    const menu = screen.getByRole('menu', { name: 'Share this article' });
    expect(share.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(within(menu).getAllByRole('menuitem')[0]);
    const page = encodeURIComponent(window.location.href);
    expect(
      within(menu).getByRole('menuitem', { name: 'Share on LinkedIn' }).getAttribute('href'),
    ).toBe(`https://www.linkedin.com/sharing/share-offsite/?url=${page}`);

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Share on LinkedIn' }));
    expect(windowOpen).toHaveBeenCalledWith(
      `https://www.linkedin.com/sharing/share-offsite/?url=${page}`,
      '_blank',
      'width=600,height=400',
    );
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(share);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Share on Twitter' }));
    expect(windowOpen).toHaveBeenLastCalledWith(
      `https://twitter.com/intent/tweet?url=${page}&text=${encodeURIComponent('The will you signed may not be valid')}`,
      '_blank',
      'width=600,height=400',
    );

    fireEvent.click(screen.getByRole('link', { name: 'Share on WhatsApp' }));
    expect(windowOpen).toHaveBeenLastCalledWith(
      `https://wa.me/?text=${encodeURIComponent(`The will you signed may not be valid — ${window.location.href}`)}`,
      '_blank',
    );
  });

  it('closes the share menu with Escape and returns focus to its button', async () => {
    await renderLoaded();
    const share = screen.getByRole('button', { name: 'Share' });
    fireEvent.click(share);
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1], { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(share);
  });

  it('copies the page address and says so in place', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    await waitFor(() =>
      expect(screen.getAllByRole('status').some((s) => s.textContent === 'Link copied')).toBe(true),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('reports a failed copy in a toast, as the live page does', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to copy link'));
  });

  it('prints the live print view', async () => {
    const write = vi.fn();
    const printWin = { document: { write, close: vi.fn() }, print: vi.fn(), onload: null };
    windowOpen.mockReturnValueOnce(printWin);
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(windowOpen).toHaveBeenCalledWith('', '_blank', 'width=900,height=700');
    const html = String(write.mock.calls[0][0]);
    expect(html).toContain('<title>Navigate Wealth - The will you signed may not be valid</title>');
    expect(html).toContain('Section 2(1)(a) of the Wills Act is prescriptive.');
    expect(html).toContain('The errors are small and common.');
    expect(html).toContain('Navigate Wealth  |  October 12, 2026  |  4 min read  |  7 views');

    windowOpen.mockReturnValueOnce(null);
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(toast.error).toHaveBeenCalledWith('Pop-up blocked — please allow pop-ups to print.');
  });

  it('subscribes to the newsletter as the site footer does', async () => {
    await renderLoaded();
    const input = screen.getByLabelText('Email address');
    const form = input.closest('form') as HTMLFormElement;
    fireEvent.click(within(form).getByRole('button', { name: 'Subscribe' }));
    expect(toast.error).toHaveBeenCalledWith('Please enter your email address');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input);
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'reader@example.com' } });
    expect(input.getAttribute('aria-invalid')).toBeNull();
    fireEvent.click(within(form).getByRole('button', { name: 'Subscribe' }));
    await screen.findByText('Check your email!');
    expect(api.post).toHaveBeenCalledWith(
      '/newsletter/subscribe',
      { email: 'reader@example.com' },
      { retryTransientFailures: false },
    );
    expect(screen.getByText('Check your email!').closest('[role="status"]')).not.toBeNull();
  });

  it('reads the related articles from the live request and links them, without the current one', async () => {
    await renderLoaded();
    const section = (
      await screen.findByRole('heading', { level: 2, name: 'Continue Reading' })
    ).closest('section') as HTMLElement;
    expect(api.get).toHaveBeenCalledWith(
      '/publications/articles?status=published&category_id=cat-estate&limit=4',
      { retryTransientFailures: false },
    );
    const cards = within(section)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('/resources/article/'));
    expect(cards.map((a) => a.getAttribute('href'))).toEqual([
      '/resources/article/a-defective-will-can-sometimes-be-rescued',
      '/resources/article/your-child-can-inherit-at-any-age',
    ]);
    expect(within(cards[0]).getByRole('heading', { level: 3 }).textContent).toBe(
      'A defective will can sometimes be rescued',
    );
    expect(within(cards[0]).getByText('14 Nov 2026 · 4 min read')).toBeDefined();
    expect(cards[0].querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('leaves "Continue Reading" out when the category has nothing else', async () => {
    stub({ related: [RELATED[0]] });
    await renderLoaded();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Continue Reading' })).toBeNull(),
    );
    expect(screen.getByRole('link', { name: /Explore More Insights/ })).toBeDefined();
  });

  it('shows the topics when the article has tags', async () => {
    stub({ article: article({ tags: ['Wills', 'Estate duty'] }) });
    await renderLoaded();
    expect(screen.getByText('Topics')).toBeDefined();
    expect(screen.getByText('Estate duty')).toBeDefined();
  });

  it('shows a loading state while the article is on its way', async () => {
    stub({ pending: true });
    renderPage();
    expect(await screen.findByText('Loading article…')).toBeDefined();
    expect(document.querySelector('.nwar-loading[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('shows "Article Not Found", marked noindex, for an unknown slug, and retries', async () => {
    stub({ status: 404 });
    renderPage('no-such-article');
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Article Not Found');
    expect(screen.getByText('Failed to fetch article (404)')).toBeDefined();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
    expect(screen.getByRole('link', { name: 'Back to Resources' }).getAttribute('href')).toBe(
      '/resources',
    );
    const before = fetchCalls().length;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(fetchCalls().length).toBeGreaterThan(before));
    // No made-up article stands in for a missing one.
    expect(screen.queryByText('The will you signed may not be valid')).toBeNull();
  });

  it('tracks a newsletter reader’s open, once, through the live engagement route', async () => {
    window.history.replaceState(null, '', `/resources/article/${SLUG}?nt=tok-123`);
    window.sessionStorage.clear();
    await renderLoaded();
    // The token leaves the address at once.
    expect(window.location.search).toBe('');
    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'));
    });
    await waitFor(() =>
      expect(fetchCalls().some(([u]) => u.endsWith('/publications/email-engagement/open'))).toBe(
        true,
      ),
    );
    const [, init] = fetchCalls().find(([u]) => u.endsWith('/email-engagement/open'))!;
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ token: 'tok-123' });
    expect(window.sessionStorage.getItem('nw:article-email-open:tok-123')).toBe('1');
  });
});
