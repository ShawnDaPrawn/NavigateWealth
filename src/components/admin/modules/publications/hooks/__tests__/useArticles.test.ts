/**
 * Tests for useArticles hook.
 *
 * Strategy: mock @tanstack/react-query's useQuery, the API module, and queryKeys.
 * Use renderHook so the hook runs in a proper React context.
 *
 * NOTE: paths from __tests__/ need one extra ../ compared to the source file.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const mockGetArticles = vi.fn();

vi.mock('../../api', () => ({
  PublicationsAPI: {
    Articles: {
      getArticles: (...args: unknown[]) => mockGetArticles(...args),
    },
  },
}));

vi.mock('../queryKeys', () => ({
  publicationKeys: {
    articleList: (p: unknown) => ['publications', 'articles', p],
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useArticles } from '../useArticles';
import { publicationKeys } from '../queryKeys';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueryOptions {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  staleTime?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockQueryWith(
  data: unknown,
  extra?: Partial<{ isLoading: boolean; isFetching: boolean; error: unknown }>,
) {
  mockUseQuery.mockReturnValue({
    data,
    isLoading: extra?.isLoading ?? false,
    isFetching: extra?.isFetching ?? false,
    error: extra?.error ?? null,
    refetch: vi.fn().mockResolvedValue(undefined),
  });
}

function captureQueryOptions(): QueryOptions {
  let captured: QueryOptions | undefined;
  mockUseQuery.mockImplementationOnce((opts: unknown) => {
    captured = opts as QueryOptions;
    return {
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    };
  });
  renderHook(() => useArticles());
  return captured!;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useArticles — default state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty articles array when data is undefined', () => {
    mockQueryWith(undefined);
    const { result } = renderHook(() => useArticles());
    expect(result.current.articles).toEqual([]);
  });

  it('returns articles from query data', () => {
    const articles = [
      { id: 'a-1', title: 'Article 1' },
      { id: 'a-2', title: 'Article 2' },
    ];
    mockQueryWith(articles);
    const { result } = renderHook(() => useArticles());
    expect(result.current.articles).toEqual(articles);
  });
});

describe('useArticles — loading and fetching state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('isLoading reflects query isLoading', () => {
    mockQueryWith(undefined, { isLoading: true });
    const { result } = renderHook(() => useArticles());
    expect(result.current.isLoading).toBe(true);
  });

  it('isLoading is false when not loading', () => {
    mockQueryWith([]);
    const { result } = renderHook(() => useArticles());
    expect(result.current.isLoading).toBe(false);
  });

  it('isRefreshing reflects isFetching', () => {
    mockQueryWith([], { isFetching: true });
    const { result } = renderHook(() => useArticles());
    expect(result.current.isRefreshing).toBe(true);
  });

  it('isRefreshing is false when not fetching', () => {
    mockQueryWith([]);
    const { result } = renderHook(() => useArticles());
    expect(result.current.isRefreshing).toBe(false);
  });
});

describe('useArticles — error state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('error is null when query has no error', () => {
    mockQueryWith([]);
    const { result } = renderHook(() => useArticles());
    expect(result.current.error).toBeNull();
  });

  it('error converts Error message', () => {
    mockQueryWith(undefined, { error: new Error('fetch failed') });
    const { result } = renderHook(() => useArticles());
    expect(result.current.error).toBe('fetch failed');
  });

  it('error uses generic string for non-Error objects', () => {
    mockQueryWith(undefined, { error: 'plain string error' });
    const { result } = renderHook(() => useArticles());
    expect(result.current.error).toBe('Failed to fetch articles');
  });
});

describe('useArticles — query configuration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queryKey uses publicationKeys.articleList with params', () => {
    const params = { status: 'published' as unknown };
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return {
        data: undefined,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });
    renderHook(() => useArticles(params as never));
    expect(captured!.queryKey).toEqual(publicationKeys.articleList(params));
  });

  it('staleTime is 5 minutes', () => {
    const opts = captureQueryOptions();
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });
});

describe('useArticles — refetch and refresh', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exposes refetch as a function', () => {
    mockQueryWith([]);
    const { result } = renderHook(() => useArticles());
    expect(typeof result.current.refetch).toBe('function');
  });

  it('exposes refresh as a function', () => {
    mockQueryWith([]);
    const { result } = renderHook(() => useArticles());
    expect(typeof result.current.refresh).toBe('function');
  });
});
