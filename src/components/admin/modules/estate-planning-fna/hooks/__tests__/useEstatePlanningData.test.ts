import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useEstatePlanningSessions,
  useEstatePlanningDetail,
  useEstatePlanningLatestPublished,
  useEstatePlanningAutoPopulate,
  ESTATE_PLANNING_QUERY_KEYS,
} from '../useEstatePlanningData';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const mockGetAllSessions = vi.fn();
const mockGetSessionById = vi.fn();
const mockGetLatestPublished = vi.fn();
const mockAutoPopulateInputs = vi.fn();

vi.mock('../../api', () => ({
  EstatePlanningAPI: {
    getAllSessions: (...args: unknown[]) => mockGetAllSessions(...args),
    getSessionById: (...args: unknown[]) => mockGetSessionById(...args),
    getLatestPublished: (...args: unknown[]) => mockGetLatestPublished(...args),
    autoPopulateInputs: (...args: unknown[]) => mockAutoPopulateInputs(...args),
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

describe('ESTATE_PLANNING_QUERY_KEYS', () => {
  it('sessions key includes clientId', () => {
    expect(ESTATE_PLANNING_QUERY_KEYS.sessions('c-1')).toEqual([
      'estate-planning-fna',
      'sessions',
      'c-1',
    ]);
  });

  it('detail key includes sessionId', () => {
    expect(ESTATE_PLANNING_QUERY_KEYS.detail('s-1')).toEqual([
      'estate-planning-fna',
      'detail',
      's-1',
    ]);
  });

  it('latestPublished key includes clientId', () => {
    expect(ESTATE_PLANNING_QUERY_KEYS.latestPublished('c-2')).toEqual([
      'estate-planning-fna',
      'latest-published',
      'c-2',
    ]);
  });

  it('autoPopulate key includes clientId', () => {
    expect(ESTATE_PLANNING_QUERY_KEYS.autoPopulate('c-3')).toEqual([
      'estate-planning-fna',
      'auto-populate',
      'c-3',
    ]);
  });
});

// ============================================================================
// useEstatePlanningSessions
// ============================================================================

describe('useEstatePlanningSessions', () => {
  it('uses correct queryKey with clientId', () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningSessions('c-1'));
    expect(opts.queryKey).toEqual(['estate-planning-fna', 'sessions', 'c-1']);
  });

  it('is enabled when clientId is provided', () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningSessions('c-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when clientId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningSessions(undefined));
    expect(opts.enabled).toBe(false);
  });

  it('sets staleTime to 5 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningSessions('c-1'));
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn calls EstatePlanningAPI.getAllSessions with clientId', async () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningSessions('c-1'));
    mockGetAllSessions.mockResolvedValue([]);
    await opts.queryFn();
    expect(mockGetAllSessions).toHaveBeenCalledWith('c-1');
  });

  it('uses empty string for queryKey when clientId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningSessions(undefined));
    expect(opts.queryKey).toEqual(['estate-planning-fna', 'sessions', '']);
  });
});

// ============================================================================
// useEstatePlanningDetail
// ============================================================================

describe('useEstatePlanningDetail', () => {
  it('uses correct queryKey with sessionId', () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningDetail('s-1'));
    expect(opts.queryKey).toEqual(['estate-planning-fna', 'detail', 's-1']);
  });

  it('is enabled when sessionId is provided', () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningDetail('s-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when sessionId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningDetail(undefined));
    expect(opts.enabled).toBe(false);
  });

  it('sets staleTime to 5 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningDetail('s-1'));
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn calls EstatePlanningAPI.getSessionById with sessionId', async () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningDetail('s-1'));
    mockGetSessionById.mockResolvedValue({ id: 's-1' });
    await opts.queryFn();
    expect(mockGetSessionById).toHaveBeenCalledWith('s-1');
  });
});

// ============================================================================
// useEstatePlanningLatestPublished
// ============================================================================

describe('useEstatePlanningLatestPublished', () => {
  it('uses correct queryKey with clientId', () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningLatestPublished('c-1'));
    expect(opts.queryKey).toEqual(['estate-planning-fna', 'latest-published', 'c-1']);
  });

  it('is enabled when clientId is provided', () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningLatestPublished('c-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when clientId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningLatestPublished(undefined));
    expect(opts.enabled).toBe(false);
  });

  it('sets staleTime to 5 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningLatestPublished('c-1'));
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn calls EstatePlanningAPI.getLatestPublished with clientId', async () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningLatestPublished('c-1'));
    mockGetLatestPublished.mockResolvedValue(null);
    await opts.queryFn();
    expect(mockGetLatestPublished).toHaveBeenCalledWith('c-1');
  });
});

// ============================================================================
// useEstatePlanningAutoPopulate
// ============================================================================

describe('useEstatePlanningAutoPopulate', () => {
  it('uses correct queryKey with clientId', () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningAutoPopulate('c-1'));
    expect(opts.queryKey).toEqual(['estate-planning-fna', 'auto-populate', 'c-1']);
  });

  it('is enabled when clientId is provided', () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningAutoPopulate('c-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when clientId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningAutoPopulate(undefined));
    expect(opts.enabled).toBe(false);
  });

  it('sets staleTime to 5 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningAutoPopulate('c-1'));
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('sets gcTime to 10 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningAutoPopulate('c-1'));
    expect(opts.gcTime).toBe(10 * 60 * 1000);
  });

  it('queryFn calls EstatePlanningAPI.autoPopulateInputs with clientId', async () => {
    const opts = captureQuery();
    renderHook(() => useEstatePlanningAutoPopulate('c-1'));
    mockAutoPopulateInputs.mockResolvedValue({});
    await opts.queryFn();
    expect(mockAutoPopulateInputs).toHaveBeenCalledWith('c-1');
  });
});
