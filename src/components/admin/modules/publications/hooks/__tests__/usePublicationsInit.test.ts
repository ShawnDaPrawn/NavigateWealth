/**
 * Tests for usePublicationsInit hook.
 *
 * Strategy: mock @tanstack/react-query, the PublicationsAPI, and publicationsKeys.
 * Capture the options objects to test configuration and callback behaviour.
 *
 * NOTE: paths from __tests__/ need one extra ../ compared to the source file.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const mockCheckStatus = vi.fn();
const mockInitialize = vi.fn();

vi.mock('../../api', () => ({
  PublicationsAPI: {
    Init: {
      checkStatus: (...args: unknown[]) => mockCheckStatus(...args),
      initialize: (...args: unknown[]) => mockInitialize(...args),
    },
  },
}));

vi.mock('../../../../../../utils/queryKeys', () => ({
  publicationsKeys: {
    initialization: () => ['publications', 'initialization'],
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { usePublicationsInit } from '../usePublicationsInit';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueryOptions {
  queryKey: unknown[];
  queryFn: unknown;
  staleTime?: number;
  retry?: number;
}

interface MutationOptions {
  mutationFn: (input?: unknown) => Promise<unknown>;
  onSuccess: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupMocks(
  queryData?: {
    is_initialized?: boolean;
    has_categories?: boolean;
    has_types?: boolean;
  },
  extraQuery?: Partial<{ isLoading: boolean; error: unknown }>,
  mutationExtra?: Partial<{ isPending: boolean; error: unknown; mutateAsync: unknown }>,
) {
  mockUseQuery.mockReturnValue({
    data: queryData,
    isLoading: extraQuery?.isLoading ?? false,
    error: extraQuery?.error ?? null,
    refetch: vi.fn(),
  });
  mockUseMutation.mockReturnValue({
    mutateAsync: mutationExtra?.mutateAsync ?? vi.fn(),
    isPending: mutationExtra?.isPending ?? false,
    error: mutationExtra?.error ?? null,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('usePublicationsInit — derived state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('isInitialized defaults to null when data is undefined', () => {
    setupMocks(undefined);
    const { result } = renderHook(() => usePublicationsInit());
    expect(result.current.isInitialized).toBeNull();
  });

  it('isInitialized reflects data.is_initialized', () => {
    setupMocks({ is_initialized: true });
    const { result } = renderHook(() => usePublicationsInit());
    expect(result.current.isInitialized).toBe(true);
  });

  it('hasCategories defaults to false when data is undefined', () => {
    setupMocks(undefined);
    const { result } = renderHook(() => usePublicationsInit());
    expect(result.current.hasCategories).toBe(false);
  });

  it('hasCategories reflects data.has_categories', () => {
    setupMocks({ has_categories: true });
    const { result } = renderHook(() => usePublicationsInit());
    expect(result.current.hasCategories).toBe(true);
  });

  it('hasTypes defaults to false when data is undefined', () => {
    setupMocks(undefined);
    const { result } = renderHook(() => usePublicationsInit());
    expect(result.current.hasTypes).toBe(false);
  });

  it('isLoading reflects query isLoading', () => {
    setupMocks(undefined, { isLoading: true });
    const { result } = renderHook(() => usePublicationsInit());
    expect(result.current.isLoading).toBe(true);
  });

  it('error is null when no query or mutation errors', () => {
    setupMocks({});
    const { result } = renderHook(() => usePublicationsInit());
    expect(result.current.error).toBeNull();
  });

  it('error reflects query error', () => {
    const err = new Error('query error');
    setupMocks(undefined, { error: err });
    const { result } = renderHook(() => usePublicationsInit());
    expect(result.current.error).toBe(err);
  });
});

describe('usePublicationsInit — query configuration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queryKey uses publicationsKeys.initialization()', () => {
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    mockUseMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false, error: null });
    renderHook(() => usePublicationsInit());
    expect(captured!.queryKey).toEqual(['publications', 'initialization']);
  });

  it('staleTime is 0', () => {
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    mockUseMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false, error: null });
    renderHook(() => usePublicationsInit());
    expect(captured!.staleTime).toBe(0);
  });

  it('retry is 1', () => {
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    mockUseMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false, error: null });
    renderHook(() => usePublicationsInit());
    expect(captured!.retry).toBe(1);
  });
});

describe('usePublicationsInit — mutation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mutation calls PublicationsAPI.Init.initialize', async () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    let captured: MutationOptions | undefined;
    mockUseMutation.mockImplementationOnce((opts: unknown) => {
      captured = opts as MutationOptions;
      return { mutateAsync: vi.fn(), isPending: false, error: null };
    });
    mockInitialize.mockResolvedValue({});
    renderHook(() => usePublicationsInit());
    await captured!.mutationFn({ categories: true });
    expect(mockInitialize).toHaveBeenCalledWith({ categories: true });
  });

  it('onSuccess invalidates initialization query', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    let captured: MutationOptions | undefined;
    mockUseMutation.mockImplementationOnce((opts: unknown) => {
      captured = opts as MutationOptions;
      return { mutateAsync: vi.fn(), isPending: false, error: null };
    });
    renderHook(() => usePublicationsInit());
    captured!.onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['publications', 'initialization'],
    });
  });
});
