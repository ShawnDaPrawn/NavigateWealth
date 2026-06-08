/**
 * Tests for useArticle hook.
 *
 * Strategy: mock the API module so we can control resolved/rejected values.
 * Use renderHook + act because the hook relies on useState/useEffect.
 *
 * NOTE: paths from __tests__/ need one extra ../ compared to the source file.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockGetArticle = vi.fn();
const mockGetArticleBySlug = vi.fn();

vi.mock('../../api', () => ({
  ArticlesAPI: {
    getArticle: (...args: unknown[]) => mockGetArticle(...args),
    getArticleBySlug: (...args: unknown[]) => mockGetArticleBySlug(...args),
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useArticle } from '../useArticle';
import type { Article } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'article-1',
    title: 'Test Article',
    slug: 'test-article',
    content: 'Some content',
    status: 'draft',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Article;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useArticle — initial state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts with null article, not loading when no id or slug', () => {
    const { result } = renderHook(() => useArticle({}));
    expect(result.current.article).toBeNull();
  });

  it('starts with null error', () => {
    const { result } = renderHook(() => useArticle({}));
    expect(result.current.error).toBeNull();
  });
});

describe('useArticle — fetching by id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls getArticle with the given id', async () => {
    const article = makeArticle();
    mockGetArticle.mockResolvedValueOnce(article);

    await act(async () => {
      renderHook(() => useArticle({ id: 'article-1' }));
    });

    expect(mockGetArticle).toHaveBeenCalledWith('article-1');
  });

  it('sets article after successful fetch by id', async () => {
    const article = makeArticle();
    mockGetArticle.mockResolvedValueOnce(article);

    const { result } = renderHook(() => useArticle({ id: 'article-1' }));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.article).toEqual(article);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('sets error when getArticle throws', async () => {
    mockGetArticle.mockRejectedValueOnce(new Error('not found'));

    const { result } = renderHook(() => useArticle({ id: 'article-1' }));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.article).toBeNull();
    expect(result.current.error).toBe('not found');
    expect(result.current.isLoading).toBe(false);
  });

  it('uses fallback error message when thrown value is not an Error', async () => {
    mockGetArticle.mockRejectedValueOnce('plain string');

    const { result } = renderHook(() => useArticle({ id: 'article-1' }));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.error).toBe('Failed to fetch article');
  });
});

describe('useArticle — fetching by slug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls getArticleBySlug when slug is provided and no id', async () => {
    const article = makeArticle({ slug: 'my-slug' });
    mockGetArticleBySlug.mockResolvedValueOnce(article);

    await act(async () => {
      renderHook(() => useArticle({ slug: 'my-slug' }));
    });

    expect(mockGetArticleBySlug).toHaveBeenCalledWith('my-slug');
    expect(mockGetArticle).not.toHaveBeenCalled();
  });

  it('sets article after successful fetch by slug', async () => {
    const article = makeArticle({ slug: 'my-slug' });
    mockGetArticleBySlug.mockResolvedValueOnce(article);

    const { result } = renderHook(() => useArticle({ slug: 'my-slug' }));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.article).toEqual(article);
    expect(result.current.error).toBeNull();
  });
});

describe('useArticle — enabled flag', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not fetch when enabled is false', async () => {
    await act(async () => {
      renderHook(() => useArticle({ id: 'article-1', enabled: false }));
    });

    expect(mockGetArticle).not.toHaveBeenCalled();
  });

  it('does not fetch when neither id nor slug is provided', async () => {
    await act(async () => {
      renderHook(() => useArticle({ enabled: true }));
    });

    expect(mockGetArticle).not.toHaveBeenCalled();
    expect(mockGetArticleBySlug).not.toHaveBeenCalled();
  });
});

describe('useArticle — refetch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refetch triggers a second API call', async () => {
    const article = makeArticle();
    mockGetArticle.mockResolvedValue(article);

    const { result } = renderHook(() => useArticle({ id: 'article-1' }));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockGetArticle).toHaveBeenCalledTimes(2);
  });
});
