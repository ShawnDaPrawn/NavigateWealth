import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useTaxPlanningSessions,
  useTaxPlanningLatestPublished,
  useTaxPlanningAutoPopulate,
  TAX_PLANNING_QUERY_KEYS,
} from '../useTaxPlanningData';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const mockGetAllSessions = vi.fn();
const mockGetLatestPublished = vi.fn();
const mockAutoPopulateInputs = vi.fn();

vi.mock('../../api', () => ({
  TaxPlanningFnaAPI: {
    getAllSessions: (...args: unknown[]) => mockGetAllSessions(...args),
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

describe('TAX_PLANNING_QUERY_KEYS', () => {
  it('sessions key includes clientId', () => {
    expect(TAX_PLANNING_QUERY_KEYS.sessions('c-1')).toEqual([
      'tax-planning-fna',
      'sessions',
      'c-1',
    ]);
  });

  it('latestPublished key includes clientId', () => {
    expect(TAX_PLANNING_QUERY_KEYS.latestPublished('c-2')).toEqual([
      'tax-planning-fna',
      'latest-published',
      'c-2',
    ]);
  });

  it('autoPopulate key includes clientId', () => {
    expect(TAX_PLANNING_QUERY_KEYS.autoPopulate('c-3')).toEqual([
      'tax-planning-fna',
      'auto-populate',
      'c-3',
    ]);
  });

  it('all key is the root prefix', () => {
    expect(TAX_PLANNING_QUERY_KEYS.all).toEqual(['tax-planning-fna']);
  });
});

// ============================================================================
// useTaxPlanningSessions
// ============================================================================

describe('useTaxPlanningSessions', () => {
  it('uses correct queryKey with clientId', () => {
    const opts = captureQuery();
    renderHook(() => useTaxPlanningSessions('c-1'));
    expect(opts.queryKey).toEqual(['tax-planning-fna', 'sessions', 'c-1']);
  });

  it('is enabled when clientId is provided', () => {
    const opts = captureQuery();
    renderHook(() => useTaxPlanningSessions('c-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when clientId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useTaxPlanningSessions(undefined));
    expect(opts.enabled).toBe(false);
  });

  it('sets staleTime to 5 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useTaxPlanningSessions('c-1'));
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn calls TaxPlanningFnaAPI.getAllSessions with clientId', async () => {
    const opts = captureQuery();
    renderHook(() => useTaxPlanningSessions('c-1'));
    mockGetAllSessions.mockResolvedValue([]);
    await opts.queryFn();
    expect(mockGetAllSessions).toHaveBeenCalledWith('c-1');
  });

  it('uses empty string for queryKey when clientId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useTaxPlanningSessions(undefined));
    expect(opts.queryKey).toEqual(['tax-planning-fna', 'sessions', '']);
  });
});

// ============================================================================
// useTaxPlanningLatestPublished
// ============================================================================

describe('useTaxPlanningLatestPublished', () => {
  it('uses correct queryKey with clientId', () => {
    const opts = captureQuery();
    renderHook(() => useTaxPlanningLatestPublished('c-1'));
    expect(opts.queryKey).toEqual(['tax-planning-fna', 'latest-published', 'c-1']);
  });

  it('is enabled when clientId is provided', () => {
    const opts = captureQuery();
    renderHook(() => useTaxPlanningLatestPublished('c-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when clientId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useTaxPlanningLatestPublished(undefined));
    expect(opts.enabled).toBe(false);
  });

  it('sets staleTime to 5 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useTaxPlanningLatestPublished('c-1'));
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn calls TaxPlanningFnaAPI.getLatestPublished with clientId', async () => {
    const opts = captureQuery();
    renderHook(() => useTaxPlanningLatestPublished('c-1'));
    mockGetLatestPublished.mockResolvedValue(null);
    await opts.queryFn();
    expect(mockGetLatestPublished).toHaveBeenCalledWith('c-1');
  });
});

// ============================================================================
// useTaxPlanningAutoPopulate
// ============================================================================

describe('useTaxPlanningAutoPopulate', () => {
  it('uses correct queryKey with clientId', () => {
    const opts = captureQuery();
    renderHook(() => useTaxPlanningAutoPopulate('c-1'));
    expect(opts.queryKey).toEqual(['tax-planning-fna', 'auto-populate', 'c-1']);
  });

  it('is enabled when clientId is provided', () => {
    const opts = captureQuery();
    renderHook(() => useTaxPlanningAutoPopulate('c-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when clientId is undefined', () => {
    const opts = captureQuery();
    renderHook(() => useTaxPlanningAutoPopulate(undefined));
    expect(opts.enabled).toBe(false);
  });

  it('sets staleTime to 5 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useTaxPlanningAutoPopulate('c-1'));
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('sets gcTime to 10 minutes', () => {
    const opts = captureQuery();
    renderHook(() => useTaxPlanningAutoPopulate('c-1'));
    expect(opts.gcTime).toBe(10 * 60 * 1000);
  });

  it('queryFn calls TaxPlanningFnaAPI.autoPopulateInputs with clientId', async () => {
    const opts = captureQuery();
    renderHook(() => useTaxPlanningAutoPopulate('c-1'));
    mockAutoPopulateInputs.mockResolvedValue({});
    await opts.queryFn();
    expect(mockAutoPopulateInputs).toHaveBeenCalledWith('c-1');
  });
});
