/**
 * Tests for useClientProfile (medical-fna)
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

const mockFetchClientProfile = vi.fn();

vi.mock('../../../client-management/api', () => ({
  clientApi: {
    fetchClientProfile: (...args: unknown[]) => mockFetchClientProfile(...args),
  },
}));

vi.mock('../queryKeys', () => ({
  medicalFnaKeys: {
    clientProfile: (id: string) => ['medical-fna', 'client-profile', id],
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
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('useClientProfile (medical-fna)', () => {
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

  it('queryKey uses medicalFnaKeys.clientProfile(clientId)', () => {
    renderHook(() => useClientProfile('client-123'));
    const opts = getCapturedOpts();
    expect(opts.queryKey).toEqual(['medical-fna', 'client-profile', 'client-123']);
  });

  it('staleTime is 5 minutes (300000ms)', () => {
    renderHook(() => useClientProfile('client-123'));
    const opts = getCapturedOpts();
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn returns null when clientId is undefined', async () => {
    renderHook(() => useClientProfile(undefined));
    const opts = getCapturedOpts();
    const result = await opts.queryFn();
    expect(result).toBeNull();
  });

  it('queryFn returns data when API responds with success', async () => {
    const profileData = { id: 'client-123', firstName: 'Jane', lastName: 'Doe' };
    mockFetchClientProfile.mockResolvedValue({ success: true, data: profileData });
    renderHook(() => useClientProfile('client-123'));
    const opts = getCapturedOpts();
    const result = await opts.queryFn();
    expect(mockFetchClientProfile).toHaveBeenCalledWith('client-123');
    expect(result).toEqual(profileData);
  });

  it('queryFn returns null when API response has no data', async () => {
    mockFetchClientProfile.mockResolvedValue({ success: true, data: null });
    renderHook(() => useClientProfile('client-123'));
    const opts = getCapturedOpts();
    const result = await opts.queryFn();
    expect(result).toBeNull();
  });

  it('queryFn returns null on API error', async () => {
    mockFetchClientProfile.mockRejectedValue(new Error('Network error'));
    renderHook(() => useClientProfile('client-123'));
    const opts = getCapturedOpts();
    const result = await opts.queryFn();
    expect(result).toBeNull();
  });
});
