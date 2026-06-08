import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ArticleDetailPage } from '../ArticleDetailPage';

// ── Sub-component stubs (avoid heavy rendering) ──────────────────────────────
vi.mock('../article-detail/ReadingProgressBar', () => ({
  ReadingProgressBar: () => null,
}));
vi.mock('../article-detail/TableOfContents', () => ({
  TableOfContents: () => null,
}));
vi.mock('../article-detail/RelatedArticles', () => ({
  RelatedArticles: () => null,
}));
vi.mock('../article-detail/AuthorCard', () => ({
  AuthorCard: () => null,
}));
vi.mock('../article-detail/BackToTop', () => ({
  BackToTop: () => null,
}));

// ── External service stubs ────────────────────────────────────────────────────
vi.mock('../../../utils/supabase/info', () => ({
  publicAnonKey: 'test-anon-key',
}));

vi.mock('../../../utils/api/config', () => ({
  API_CONFIG: { BASE_URL: 'https://api.test' },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// ── DOMPurify stub ────────────────────────────────────────────────────────────
vi.mock('dompurify', () => ({
  default: { sanitize: (html: string) => html },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function renderWithSlug(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/resources/article/${slug}`]}>
      <Routes>
        <Route path="/resources/article/:slug" element={<ArticleDetailPage />} />
        <Route path="/resources" element={<div>Resources Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockFetchNeverResolves() {
  vi.stubGlobal('fetch', () => new Promise(() => {}));
}

function mockFetchReturns404() {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }),
  );
}

function mockFetchReturnsArticle(article: Record<string, unknown>) {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: article }),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ArticleDetailPage', () => {
  it('shows loading skeleton when fetch is in flight', async () => {
    mockFetchNeverResolves();
    renderWithSlug('some-test-article');
    await waitFor(() => {
      expect(document.querySelector('.animate-pulse')).toBeTruthy();
    });
  });

  it('shows error state for an unknown slug when fetch returns 404', async () => {
    mockFetchReturns404();
    renderWithSlug('definitely-not-a-real-article-xyz');
    await waitFor(() => {
      expect(screen.getByText('Article Not Found')).toBeTruthy();
    });
  });

  it('shows Back to Resources link in error state', async () => {
    mockFetchReturns404();
    renderWithSlug('no-such-article-999');
    await waitFor(() => {
      expect(screen.getByText('Back to Resources')).toBeTruthy();
    });
  });

  it('renders demo article by slug without network calls', async () => {
    mockFetchReturns404();
    renderWithSlug('complete-guide-retirement-planning-2025');
    await waitFor(() => {
      expect(screen.getByText('The Complete Guide to Retirement Planning in 2025')).toBeTruthy();
    });
  });

  it('renders article title from API response', async () => {
    mockFetchReturnsArticle({
      id: 'art-001',
      slug: 'test-article',
      title: 'How to Save for Retirement',
      body: '<p>Some content here</p>',
    });
    renderWithSlug('test-article');
    await waitFor(() => {
      expect(screen.getByText('How to Save for Retirement')).toBeTruthy();
    });
  });

  it('renders article author name when provided', async () => {
    mockFetchReturnsArticle({
      id: 'art-002',
      slug: 'test-article-2',
      title: 'Investment Tips',
      author_name: 'Jane Adviser',
      body: '<p>Tips here</p>',
    });
    renderWithSlug('test-article-2');
    await waitFor(() => {
      expect(screen.getByText('Jane Adviser')).toBeTruthy();
    });
  });

  it('falls back to editorial team author when author_name is absent', async () => {
    mockFetchReturnsArticle({
      id: 'art-003',
      slug: 'no-author-article',
      title: 'Risk Management',
      body: '<p>Content</p>',
    });
    renderWithSlug('no-author-article');
    await waitFor(() => {
      expect(screen.getByText('Navigate Wealth Editorial Team')).toBeTruthy();
    });
  });

  it('renders article subtitle when provided', async () => {
    mockFetchReturnsArticle({
      id: 'art-004',
      slug: 'subtitle-article',
      title: 'Medical Aid Guide',
      subtitle: 'Everything you need to know',
      body: '<p>Medical aid basics</p>',
    });
    renderWithSlug('subtitle-article');
    await waitFor(() => {
      expect(screen.getByText('Everything you need to know')).toBeTruthy();
    });
  });

  it('renders no article message when slug is missing', async () => {
    // Render with a path that has no slug
    render(
      <MemoryRouter initialEntries={['/resources/article/']}>
        <Routes>
          <Route path="/resources/article" element={<ArticleDetailPage />} />
          <Route path="/resources" element={<div>Resources Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    // No slug → article remains null, error state shown
    await waitFor(() => {
      expect(screen.getByText('Article Not Found')).toBeTruthy();
    });
  });

  it('renders reading time for article with body text', async () => {
    mockFetchReturnsArticle({
      id: 'art-005',
      slug: 'long-article',
      title: 'Long Article',
      reading_time_minutes: 5,
      body: '<p>Some body text</p>',
    });
    renderWithSlug('long-article');
    await waitFor(() => {
      expect(screen.getByText('5 min read')).toBeTruthy();
    });
  });
});
