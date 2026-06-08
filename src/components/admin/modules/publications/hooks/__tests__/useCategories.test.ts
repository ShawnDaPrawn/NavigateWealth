/**
 * Tests for useCategories hook.
 *
 * Strategy: mock @tanstack/react-query's useQuery, the API module, and queryKeys.
 * Use renderHook so that useMemo runs in a proper React context.
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

const mockGetCategories = vi.fn();

vi.mock('../../api', () => ({
  PublicationsAPI: {
    Categories: {
      getCategories: (...args: unknown[]) => mockGetCategories(...args),
    },
  },
}));

vi.mock('../queryKeys', () => ({
  publicationKeys: {
    categories: () => ['publications', 'categories'],
    types: () => ['publications', 'types'],
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useCategories } from '../useCategories';
import { publicationKeys } from '../queryKeys';
import type { Category } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueryOptions {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  staleTime?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Finance',
    slug: 'finance',
    description: '',
    sort_order: 0,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Category;
}

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

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useCategories — query configuration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes categories queryKey', () => {
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
    renderHook(() => useCategories());
    expect(captured!.queryKey).toEqual(publicationKeys.categories());
  });

  it('passes staleTime of 5 minutes', () => {
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
    renderHook(() => useCategories());
    expect(captured!.staleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn calls PublicationsAPI.Categories.getCategories', async () => {
    const categories = [makeCategory()];
    mockGetCategories.mockResolvedValue(categories);

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
    renderHook(() => useCategories());
    const result = await captured!.queryFn();
    expect(result).toEqual(categories);
    expect(mockGetCategories).toHaveBeenCalledOnce();
  });
});

describe('useCategories — returned state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('categories defaults to [] when data is undefined', () => {
    mockQueryWith(undefined);
    const { result } = renderHook(() => useCategories());
    expect(result.current.categories).toEqual([]);
  });

  it('categories reflects query data', () => {
    const cats = [makeCategory({ id: 'cat-1' }), makeCategory({ id: 'cat-2', slug: 'cat-2' })];
    mockQueryWith(cats);
    const { result } = renderHook(() => useCategories());
    expect(result.current.categories).toHaveLength(2);
  });

  it('isLoading reflects query loading state', () => {
    mockQueryWith(undefined, { isLoading: true });
    const { result } = renderHook(() => useCategories());
    expect(result.current.isLoading).toBe(true);
  });

  it('isRefreshing reflects isFetching', () => {
    mockQueryWith([], { isFetching: true });
    const { result } = renderHook(() => useCategories());
    expect(result.current.isRefreshing).toBe(true);
  });

  it('error is null when no error', () => {
    mockQueryWith([]);
    const { result } = renderHook(() => useCategories());
    expect(result.current.error).toBeNull();
  });

  it('error extracts message from Error instance', () => {
    mockQueryWith(undefined, { error: new Error('network error') });
    const { result } = renderHook(() => useCategories());
    expect(result.current.error).toBe('network error');
  });

  it('error uses fallback for non-Error objects', () => {
    mockQueryWith(undefined, { error: 'plain string' });
    const { result } = renderHook(() => useCategories());
    expect(result.current.error).toBe('Failed to fetch categories');
  });

  it('exposes refetch and refresh as functions', () => {
    mockQueryWith([]);
    const { result } = renderHook(() => useCategories());
    expect(typeof result.current.refetch).toBe('function');
    expect(typeof result.current.refresh).toBe('function');
  });
});

describe('useCategories — activeOnly filter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all categories when activeOnly is false (default)', () => {
    const cats = [
      makeCategory({ id: 'cat-1', is_active: true }),
      makeCategory({ id: 'cat-2', slug: 'cat-2', is_active: false }),
    ];
    mockQueryWith(cats);
    const { result } = renderHook(() => useCategories({ activeOnly: false }));
    expect(result.current.categories).toHaveLength(2);
  });

  it('filters inactive categories when activeOnly is true', () => {
    const cats = [
      makeCategory({ id: 'cat-1', is_active: true }),
      makeCategory({ id: 'cat-2', slug: 'cat-2', is_active: false }),
    ];
    mockQueryWith(cats);
    const { result } = renderHook(() => useCategories({ activeOnly: true }));
    expect(result.current.categories).toHaveLength(1);
    expect(result.current.categories[0].id).toBe('cat-1');
  });
});

describe('useCategories — autoSort', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sorts categories by sort_order when autoSort is true (default)', () => {
    const cats = [
      makeCategory({ id: 'cat-b', slug: 'cat-b', sort_order: 2 }),
      makeCategory({ id: 'cat-a', slug: 'cat-a', sort_order: 1 }),
      makeCategory({ id: 'cat-c', slug: 'cat-c', sort_order: 3 }),
    ];
    mockQueryWith(cats);
    const { result } = renderHook(() => useCategories({ autoSort: true }));
    expect(result.current.categories.map((c) => c.id)).toEqual(['cat-a', 'cat-b', 'cat-c']);
  });

  it('does not sort when autoSort is false', () => {
    const cats = [
      makeCategory({ id: 'cat-b', slug: 'cat-b', sort_order: 2 }),
      makeCategory({ id: 'cat-a', slug: 'cat-a', sort_order: 1 }),
    ];
    mockQueryWith(cats);
    const { result } = renderHook(() => useCategories({ autoSort: false }));
    // original order preserved
    expect(result.current.categories.map((c) => c.id)).toEqual(['cat-b', 'cat-a']);
  });
});
