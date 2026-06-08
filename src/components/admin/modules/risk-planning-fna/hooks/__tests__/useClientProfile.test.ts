/**
 * Tests for useClientProfile (risk-planning-fna)
 * Navigate Wealth Admin Dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useClientProfile } from '../useClientProfile';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const mockGetClientProfile = vi.fn();

vi.mock('../../api', () => ({
  RiskPlanningFnaAPI: {
    getClientProfile: (...args: unknown[]) => mockGetClientProfile(...args),
  },
}));

vi.mock('../queryKeys', () => ({
  riskFnaKeys: {
    clientProfile: (id: string) => ['risk-fna', 'client-profile', id],
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
    enabled: boolean;
    staleTime: number;
    gcTime: number;
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('useClientProfile (risk-planning-fna)', () => {
  it('is disabled when clientId is undefined', () => {
    renderHook(() => useClientProfile(undefined));
    const opts = getCapturedOpts();
    expect(opts.enabled).toBe(false);
  });

  it('is enabled when clientId is a non-empty string', () => {
    renderHook(() => useClientProfile('client-123'));
    const opts = getCapturedOpts();
    expect(opts.enabled).toBe(true);
  });

  it('queryKey uses riskFnaKeys.clientProfile(clientId)', () => {
    renderHook(() => useClientProfile('client-123'));
    const opts = getCapturedOpts();
    expect(opts.queryKey).toEqual(['risk-fna', 'client-profile', 'client-123']);
  });

  it('staleTime is 5 minutes (300000ms)', () => {
    renderHook(() => useClientProfile('client-123'));
    const opts = getCapturedOpts();
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('gcTime is 10 minutes (600000ms)', () => {
    renderHook(() => useClientProfile('client-123'));
    const opts = getCapturedOpts();
    expect(opts.gcTime).toBe(10 * 60 * 1000);
  });

  it('queryFn returns null when clientId is falsy', async () => {
    renderHook(() => useClientProfile(undefined));
    const opts = getCapturedOpts();
    const result = await opts.queryFn();
    expect(result).toBeNull();
  });

  it('queryFn calls RiskPlanningFnaAPI.getClientProfile when clientId is defined', async () => {
    const profileData = { id: 'client-123', firstName: 'John', lastName: 'Smith' };
    mockGetClientProfile.mockResolvedValue(profileData);
    renderHook(() => useClientProfile('client-123'));
    const opts = getCapturedOpts();
    const result = await opts.queryFn();
    expect(mockGetClientProfile).toHaveBeenCalledWith('client-123');
    expect(result).toEqual(profileData);
  });
});
