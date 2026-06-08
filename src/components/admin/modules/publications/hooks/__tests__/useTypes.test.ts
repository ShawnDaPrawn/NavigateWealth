/**
 * Tests for useTypes hook.
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

const mockGetTypes = vi.fn();

vi.mock('../../api', () => ({
  PublicationsAPI: {
    Types: {
      getTypes: (...args: unknown[]) => mockGetTypes(...args),
    },
  },
}));

vi.mock('../queryKeys', () => ({
  publicationKeys: {
    types: () => ['publications', 'types'],
    categories: () => ['publications', 'categories'],
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useTypes } from '../useTypes';
import { publicationKeys } from '../queryKeys';
import type { ContentType } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueryOptions {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  staleTime?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeType(overrides: Partial<ContentType> = {}): ContentType {
  return {
    id: 'type-1',
    name: 'Article',
    slug: 'article',
    description: '',
    icon: null,
    sort_order: 0,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as ContentType;
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

describe('useTypes — query configuration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes types queryKey', () => {
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
    renderHook(() => useTypes());
    expect(captured!.queryKey).toEqual(publicationKeys.types());
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
    renderHook(() => useTypes());
    expect(captured!.staleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn calls PublicationsAPI.Types.getTypes', async () => {
    const types = [makeType()];
    mockGetTypes.mockResolvedValue(types);

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
    renderHook(() => useTypes());
    const result = await captured!.queryFn();
    expect(result).toEqual(types);
    expect(mockGetTypes).toHaveBeenCalledOnce();
  });
});

describe('useTypes — returned state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('types defaults to [] when data is undefined', () => {
    mockQueryWith(undefined);
    const { result } = renderHook(() => useTypes());
    expect(result.current.types).toEqual([]);
  });

  it('types reflects query data', () => {
    const types = [makeType({ id: 'type-1' }), makeType({ id: 'type-2', slug: 'type-2' })];
    mockQueryWith(types);
    const { result } = renderHook(() => useTypes());
    expect(result.current.types).toHaveLength(2);
  });

  it('isLoading reflects query loading state', () => {
    mockQueryWith(undefined, { isLoading: true });
    const { result } = renderHook(() => useTypes());
    expect(result.current.isLoading).toBe(true);
  });

  it('isRefreshing reflects isFetching', () => {
    mockQueryWith([], { isFetching: true });
    const { result } = renderHook(() => useTypes());
    expect(result.current.isRefreshing).toBe(true);
  });

  it('error is null when no error', () => {
    mockQueryWith([]);
    const { result } = renderHook(() => useTypes());
    expect(result.current.error).toBeNull();
  });

  it('error extracts message from Error instance', () => {
    mockQueryWith(undefined, { error: new Error('server error') });
    const { result } = renderHook(() => useTypes());
    expect(result.current.error).toBe('server error');
  });

  it('error uses fallback for non-Error objects', () => {
    mockQueryWith(undefined, { error: 'plain string' });
    const { result } = renderHook(() => useTypes());
    expect(result.current.error).toBe('Failed to fetch types');
  });

  it('exposes refetch and refresh as functions', () => {
    mockQueryWith([]);
    const { result } = renderHook(() => useTypes());
    expect(typeof result.current.refetch).toBe('function');
    expect(typeof result.current.refresh).toBe('function');
  });
});

describe('useTypes — activeOnly filter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all types when activeOnly is false (default)', () => {
    const types = [
      makeType({ id: 'type-1', is_active: true }),
      makeType({ id: 'type-2', slug: 'type-2', is_active: false }),
    ];
    mockQueryWith(types);
    const { result } = renderHook(() => useTypes({ activeOnly: false }));
    expect(result.current.types).toHaveLength(2);
  });

  it('filters inactive types when activeOnly is true', () => {
    const types = [
      makeType({ id: 'type-1', is_active: true }),
      makeType({ id: 'type-2', slug: 'type-2', is_active: false }),
    ];
    mockQueryWith(types);
    const { result } = renderHook(() => useTypes({ activeOnly: true }));
    expect(result.current.types).toHaveLength(1);
    expect(result.current.types[0].id).toBe('type-1');
  });
});

describe('useTypes — autoSort', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sorts types by sort_order when autoSort is true (default)', () => {
    const types = [
      makeType({ id: 'type-b', slug: 'type-b', sort_order: 2 }),
      makeType({ id: 'type-a', slug: 'type-a', sort_order: 1 }),
      makeType({ id: 'type-c', slug: 'type-c', sort_order: 3 }),
    ];
    mockQueryWith(types);
    const { result } = renderHook(() => useTypes({ autoSort: true }));
    expect(result.current.types.map((t) => t.id)).toEqual(['type-a', 'type-b', 'type-c']);
  });

  it('does not sort when autoSort is false', () => {
    const types = [
      makeType({ id: 'type-b', slug: 'type-b', sort_order: 2 }),
      makeType({ id: 'type-a', slug: 'type-a', sort_order: 1 }),
    ];
    mockQueryWith(types);
    const { result } = renderHook(() => useTypes({ autoSort: false }));
    expect(result.current.types.map((t) => t.id)).toEqual(['type-b', 'type-a']);
  });
});
