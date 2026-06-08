/**
 * Tests for useAIAnalytics
 * Navigate Wealth Admin Dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAIAnalytics } from '../useAIAnalytics';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const mockGetAIAnalyticsSummary = vi.fn();

vi.mock('../../api', () => ({
  socialMediaAIApi: {
    getAIAnalyticsSummary: (...args: unknown[]) => mockGetAIAnalyticsSummary(...args),
  },
}));

vi.mock('../queryKeys', () => ({
  socialMediaKeys: {
    ai: {
      analytics: () => ['social-media', 'ai', 'analytics'],
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue({
    data: undefined,
    isLoading: false,
    refetch: vi.fn(),
  });
});

// ============================================================================
// HELPERS
// ============================================================================

function getCapturedOpts() {
  return mockUseQuery.mock.calls[0][0] as {
    queryKey: unknown[];
    queryFn: () => Promise<unknown>;
    staleTime: number;
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('useAIAnalytics', () => {
  it('queryKey uses socialMediaKeys.ai.analytics()', () => {
    renderHook(() => useAIAnalytics());
    const opts = getCapturedOpts();
    expect(opts.queryKey).toEqual(['social-media', 'ai', 'analytics']);
  });

  it('staleTime is 2 minutes (120000ms)', () => {
    renderHook(() => useAIAnalytics());
    const opts = getCapturedOpts();
    expect(opts.staleTime).toBe(2 * 60 * 1000);
  });

  it('queryFn calls socialMediaAIApi.getAIAnalyticsSummary', async () => {
    const summaryData = { data: { totalGenerations: 10 }, error: null };
    mockGetAIAnalyticsSummary.mockResolvedValue(summaryData);
    renderHook(() => useAIAnalytics());
    const opts = getCapturedOpts();
    const result = await opts.queryFn();
    expect(mockGetAIAnalyticsSummary).toHaveBeenCalledTimes(1);
    expect(result).toEqual(summaryData);
  });

  it('analytics is null when query data is undefined', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, refetch: vi.fn() });
    const { result } = renderHook(() => useAIAnalytics());
    expect(result.current.analytics).toBeNull();
  });

  it('analytics returns data from query result when available', () => {
    const analyticsData = { totalGenerations: 42, successRate: 0.95 };
    mockUseQuery.mockReturnValue({
      data: { data: analyticsData, error: null },
      isLoading: false,
      refetch: vi.fn(),
    });
    const { result } = renderHook(() => useAIAnalytics());
    expect(result.current.analytics).toEqual(analyticsData);
  });

  it('analyticsLoading reflects query isLoading state', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, refetch: vi.fn() });
    const { result } = renderHook(() => useAIAnalytics());
    expect(result.current.analyticsLoading).toBe(true);
  });

  it('analyticsError is null when no error in query data', () => {
    mockUseQuery.mockReturnValue({
      data: { data: null, error: null },
      isLoading: false,
      refetch: vi.fn(),
    });
    const { result } = renderHook(() => useAIAnalytics());
    expect(result.current.analyticsError).toBeNull();
  });

  it('analyticsError reflects error from query data', () => {
    const errorMsg = 'API key invalid';
    mockUseQuery.mockReturnValue({
      data: { data: null, error: errorMsg },
      isLoading: false,
      refetch: vi.fn(),
    });
    const { result } = renderHook(() => useAIAnalytics());
    expect(result.current.analyticsError).toBe(errorMsg);
  });

  it('refetchAnalytics is the refetch function from the query', () => {
    const mockRefetch = vi.fn();
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, refetch: mockRefetch });
    const { result } = renderHook(() => useAIAnalytics());
    expect(result.current.refetchAnalytics).toBe(mockRefetch);
  });
});
