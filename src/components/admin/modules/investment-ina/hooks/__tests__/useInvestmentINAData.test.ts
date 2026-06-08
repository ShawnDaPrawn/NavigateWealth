import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useInvestmentINASessions,
  useInvestmentINADetail,
  useInvestmentINALatestPublished,
  useInvestmentINAAutoPopulate,
  INVESTMENT_INA_QUERY_KEYS,
} from '../useInvestmentINAData';

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
  InvestmentINAFnaAPI: {
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

describe('INVESTMENT_INA_QUERY_KEYS', () => {
  it('sessions key includes clientId', () => {
    expect(INVESTMENT_INA_QUERY_KEYS.sessions('c-1')).toEqual([
      'investment-ina',
      'sessions',
      'c-1',
    ]);
  });

  it('detail key includes sessionId', () => {
    expect(INVESTMENT_INA_QUERY_KEYS.detail('s-1')).toEqual(['investment-ina', 'detail', 's-1']);
  });

  it('latestPublished key includes clientId', () => {
    expect(INVESTMENT_INA_QUERY_KEYS.latestPublished('c-2')).toEqual([
      'investment-ina',
      'latest-published',
      'c-2',
    ]);
  });

  it('autoPopulate key includes clientId', () => {
    expect(INVESTMENT_INA_QUERY_KEYS.autoPopulate('c-3')).toEqual([
      'investment-ina',
      'auto-populate',
      'c-3',
    ]);
  });

  it('all key is the root prefix', () => {
    expect(INVESTMENT_INA_QUERY_KEYS.all).toEqual(['investment-ina']);
  });
});

// ============================================================================
// useInvestmentINASessions
// ============================================================================

describe('useInvestmentINASessions', () => {
  it('uses correct queryKey with clientId', () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINASessions('c-1'));
    expect(opts.queryKey).toEqual(['investment-ina', 'sessions', 'c-1']);
  });

  it('is enabled when clientId is provided', () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINASessions('c-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when clientId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINASessions(undefined));
    expect(opts.enabled).toBe(false);
  });

  it('sets staleTime to 5 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINASessions('c-1'));
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn calls InvestmentINAFnaAPI.getAllSessions with clientId', async () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINASessions('c-1'));
    mockGetAllSessions.mockResolvedValue([]);
    await opts.queryFn();
    expect(mockGetAllSessions).toHaveBeenCalledWith('c-1');
  });

  it('uses empty string for queryKey when clientId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINASessions(undefined));
    expect(opts.queryKey).toEqual(['investment-ina', 'sessions', '']);
  });
});

// ============================================================================
// useInvestmentINADetail
// ============================================================================

describe('useInvestmentINADetail', () => {
  it('uses correct queryKey with sessionId', () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINADetail('s-1'));
    expect(opts.queryKey).toEqual(['investment-ina', 'detail', 's-1']);
  });

  it('is enabled when sessionId is provided', () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINADetail('s-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when sessionId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINADetail(undefined));
    expect(opts.enabled).toBe(false);
  });

  it('sets staleTime to 5 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINADetail('s-1'));
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn calls InvestmentINAFnaAPI.getSessionById with sessionId', async () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINADetail('s-1'));
    mockGetSessionById.mockResolvedValue({ id: 's-1' });
    await opts.queryFn();
    expect(mockGetSessionById).toHaveBeenCalledWith('s-1');
  });
});

// ============================================================================
// useInvestmentINALatestPublished
// ============================================================================

describe('useInvestmentINALatestPublished', () => {
  it('uses correct queryKey with clientId', () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINALatestPublished('c-1'));
    expect(opts.queryKey).toEqual(['investment-ina', 'latest-published', 'c-1']);
  });

  it('is enabled when clientId is provided', () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINALatestPublished('c-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when clientId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINALatestPublished(undefined));
    expect(opts.enabled).toBe(false);
  });

  it('sets staleTime to 5 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINALatestPublished('c-1'));
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn calls InvestmentINAFnaAPI.getLatestPublished with clientId', async () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINALatestPublished('c-1'));
    mockGetLatestPublished.mockResolvedValue(null);
    await opts.queryFn();
    expect(mockGetLatestPublished).toHaveBeenCalledWith('c-1');
  });
});

// ============================================================================
// useInvestmentINAAutoPopulate
// ============================================================================

describe('useInvestmentINAAutoPopulate', () => {
  it('uses correct queryKey with clientId', () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINAAutoPopulate('c-1'));
    expect(opts.queryKey).toEqual(['investment-ina', 'auto-populate', 'c-1']);
  });

  it('is enabled when clientId is provided', () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINAAutoPopulate('c-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when clientId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINAAutoPopulate(undefined));
    expect(opts.enabled).toBe(false);
  });

  it('sets staleTime to 5 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINAAutoPopulate('c-1'));
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('sets gcTime to 10 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINAAutoPopulate('c-1'));
    expect(opts.gcTime).toBe(10 * 60 * 1000);
  });

  it('queryFn calls InvestmentINAFnaAPI.autoPopulateInputs with clientId', async () => {
    const opts = captureQuery();
    renderHook(() => useInvestmentINAAutoPopulate('c-1'));
    mockAutoPopulateInputs.mockResolvedValue({});
    await opts.queryFn();
    expect(mockAutoPopulateInputs).toHaveBeenCalledWith('c-1');
  });
});
