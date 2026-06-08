/**
 * Tests for usePersonnel
 * Navigate Wealth Admin Dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePersonnel } from '../usePersonnel';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const mockGetPersonnel = vi.fn();

vi.mock('../../api', () => ({
  adviceEngineApi: {
    personnel: {
      getPersonnel: (...args: unknown[]) => mockGetPersonnel(...args),
    },
  },
}));

vi.mock('../queryKeys', () => ({
  adviceEngineKeys: {
    personnel: () => ['personnel'],
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
});

// ============================================================================
// HELPERS
// ============================================================================

function getCapturedOpts() {
  return mockUseQuery.mock.calls[0][0] as {
    queryKey: unknown[];
    queryFn: () => Promise<unknown>;
    staleTime: number;
    refetchOnMount: boolean;
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('usePersonnel', () => {
  it('queryKey is adviceEngineKeys.personnel()', () => {
    renderHook(() => usePersonnel());
    const opts = getCapturedOpts();
    expect(opts.queryKey).toEqual(['personnel']);
  });

  it('staleTime is 30 minutes (1800000ms)', () => {
    renderHook(() => usePersonnel());
    const opts = getCapturedOpts();
    expect(opts.staleTime).toBe(30 * 60 * 1000);
  });

  it('refetchOnMount is false', () => {
    renderHook(() => usePersonnel());
    const opts = getCapturedOpts();
    expect(opts.refetchOnMount).toBe(false);
  });

  it('queryFn calls adviceEngineApi.personnel.getPersonnel', async () => {
    const personnelData = [{ id: '1', name: 'Adviser One' }];
    mockGetPersonnel.mockResolvedValue(personnelData);
    renderHook(() => usePersonnel());
    const opts = getCapturedOpts();
    const result = await opts.queryFn();
    expect(mockGetPersonnel).toHaveBeenCalledTimes(1);
    expect(result).toEqual(personnelData);
  });
});
