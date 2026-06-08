import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useRetirementFNAList,
  useRetirementFNADetail,
  useRetirementFNALatestPublished,
  useRetirementFNAAutoPopulate,
  RETIREMENT_FNA_QUERY_KEYS,
} from '../useRetirementFNAData';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const mockGetAllForClient = vi.fn();
const mockGetById = vi.fn();
const mockGetLatestPublished = vi.fn();
const mockGetAutoPopulatedInputs = vi.fn();

vi.mock('../../api', () => ({
  RetirementFnaAPI: {
    getAllForClient: (...args: unknown[]) => mockGetAllForClient(...args),
    getById: (...args: unknown[]) => mockGetById(...args),
    getLatestPublished: (...args: unknown[]) => mockGetLatestPublished(...args),
    getAutoPopulatedInputs: (...args: unknown[]) => mockGetAutoPopulatedInputs(...args),
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

type QueryOptions = {
  queryKey: unknown[];
  queryFn: () => unknown;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
};

function captureQuery(): QueryOptions {
  let captured: QueryOptions | undefined;
  mockUseQuery.mockImplementation((opts: QueryOptions) => {
    captured = opts;
    return { data: undefined, isLoading: false, isError: false };
  });
  return new Proxy({} as QueryOptions, {
    get(_target, prop) {
      return (captured as QueryOptions)[prop as keyof QueryOptions];
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// QUERY KEY CONSTANTS
// ============================================================================

describe('RETIREMENT_FNA_QUERY_KEYS', () => {
  it('list key includes clientId', () => {
    expect(RETIREMENT_FNA_QUERY_KEYS.list('c-1')).toEqual(['retirement-fna', 'list', 'c-1']);
  });

  it('detail key includes fnaId', () => {
    expect(RETIREMENT_FNA_QUERY_KEYS.detail('f-1')).toEqual(['retirement-fna', 'detail', 'f-1']);
  });

  it('latestPublished key includes clientId', () => {
    expect(RETIREMENT_FNA_QUERY_KEYS.latestPublished('c-2')).toEqual([
      'retirement-fna',
      'latest-published',
      'c-2',
    ]);
  });

  it('autoPopulate key includes clientId', () => {
    expect(RETIREMENT_FNA_QUERY_KEYS.autoPopulate('c-3')).toEqual([
      'retirement-fna',
      'auto-populate',
      'c-3',
    ]);
  });

  it('all key is the root prefix', () => {
    expect(RETIREMENT_FNA_QUERY_KEYS.all).toEqual(['retirement-fna']);
  });
});

// ============================================================================
// useRetirementFNAList
// ============================================================================

describe('useRetirementFNAList', () => {
  it('uses correct queryKey with clientId', () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNAList('c-1'));
    expect(opts.queryKey).toEqual(['retirement-fna', 'list', 'c-1']);
  });

  it('is enabled when clientId is provided', () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNAList('c-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when clientId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNAList(undefined));
    expect(opts.enabled).toBe(false);
  });

  it('sets staleTime to 5 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNAList('c-1'));
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn calls RetirementFnaAPI.getAllForClient with clientId', async () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNAList('c-1'));
    mockGetAllForClient.mockResolvedValue([]);
    await opts.queryFn();
    expect(mockGetAllForClient).toHaveBeenCalledWith('c-1');
  });

  it('uses empty string for queryKey when clientId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNAList(undefined));
    expect(opts.queryKey).toEqual(['retirement-fna', 'list', '']);
  });
});

// ============================================================================
// useRetirementFNADetail
// ============================================================================

describe('useRetirementFNADetail', () => {
  it('uses correct queryKey with fnaId', () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNADetail('f-1'));
    expect(opts.queryKey).toEqual(['retirement-fna', 'detail', 'f-1']);
  });

  it('is enabled when fnaId is provided', () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNADetail('f-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when fnaId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNADetail(undefined));
    expect(opts.enabled).toBe(false);
  });

  it('sets staleTime to 5 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNADetail('f-1'));
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn calls RetirementFnaAPI.getById with fnaId', async () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNADetail('f-1'));
    mockGetById.mockResolvedValue({ id: 'f-1' });
    await opts.queryFn();
    expect(mockGetById).toHaveBeenCalledWith('f-1');
  });
});

// ============================================================================
// useRetirementFNALatestPublished
// ============================================================================

describe('useRetirementFNALatestPublished', () => {
  it('uses correct queryKey with clientId', () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNALatestPublished('c-1'));
    expect(opts.queryKey).toEqual(['retirement-fna', 'latest-published', 'c-1']);
  });

  it('is enabled when clientId is provided', () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNALatestPublished('c-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when clientId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNALatestPublished(undefined));
    expect(opts.enabled).toBe(false);
  });

  it('sets staleTime to 5 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNALatestPublished('c-1'));
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn calls RetirementFnaAPI.getLatestPublished with clientId', async () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNALatestPublished('c-1'));
    mockGetLatestPublished.mockResolvedValue(null);
    await opts.queryFn();
    expect(mockGetLatestPublished).toHaveBeenCalledWith('c-1');
  });
});

// ============================================================================
// useRetirementFNAAutoPopulate
// ============================================================================

describe('useRetirementFNAAutoPopulate', () => {
  it('uses correct queryKey with clientId', () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNAAutoPopulate('c-1'));
    expect(opts.queryKey).toEqual(['retirement-fna', 'auto-populate', 'c-1']);
  });

  it('is enabled when clientId is provided', () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNAAutoPopulate('c-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when clientId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNAAutoPopulate(undefined));
    expect(opts.enabled).toBe(false);
  });

  it('sets staleTime to 5 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNAAutoPopulate('c-1'));
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('sets gcTime to 10 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNAAutoPopulate('c-1'));
    expect(opts.gcTime).toBe(10 * 60 * 1000);
  });

  it('queryFn calls RetirementFnaAPI.getAutoPopulatedInputs with clientId', async () => {
    const opts = captureQuery();
    renderHook(() => useRetirementFNAAutoPopulate('c-1'));
    mockGetAutoPopulatedInputs.mockResolvedValue({});
    await opts.queryFn();
    expect(mockGetAutoPopulatedInputs).toHaveBeenCalledWith('c-1');
  });
});
