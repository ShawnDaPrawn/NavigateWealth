/**
 * Tests for useClientKeys (risk-planning-fna)
 * Navigate Wealth Admin Dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useClientKeys } from '../useClientKeys';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const mockGetClientKeys = vi.fn();

vi.mock('../../../client-keys', () => ({
  clientKeysApi: {
    getClientKeys: (...args: unknown[]) => mockGetClientKeys(...args),
  },
}));

vi.mock('../../../../../../utils/queryKeys', () => ({
  clientDataKeys: {
    byClient: (clientId: string) => ['client-keys', clientId],
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

describe('useClientKeys (risk-planning-fna)', () => {
  it('is disabled when clientId is undefined', () => {
    renderHook(() => useClientKeys(undefined));
    const opts = getCapturedOpts();
    expect(opts.enabled).toBe(false);
  });

  it('is enabled when clientId is a non-empty string', () => {
    renderHook(() => useClientKeys('client-123'));
    const opts = getCapturedOpts();
    expect(opts.enabled).toBe(true);
  });

  it('queryKey uses clientDataKeys.byClient(clientId)', () => {
    renderHook(() => useClientKeys('client-123'));
    const opts = getCapturedOpts();
    expect(opts.queryKey).toEqual(['client-keys', 'client-123']);
  });

  it('staleTime is 5 minutes (300000ms)', () => {
    renderHook(() => useClientKeys('client-123'));
    const opts = getCapturedOpts();
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn throws when clientId is undefined', () => {
    renderHook(() => useClientKeys(undefined));
    const opts = getCapturedOpts();
    expect(() => opts.queryFn()).toThrow('Client ID is required');
  });

  it('queryFn calls clientKeysApi.getClientKeys when clientId is defined', async () => {
    const keysData = { totalAssets: 500000, totalLiabilities: 200000 };
    mockGetClientKeys.mockResolvedValue(keysData);
    renderHook(() => useClientKeys('client-123'));
    const opts = getCapturedOpts();
    const result = await opts.queryFn();
    expect(mockGetClientKeys).toHaveBeenCalledWith('client-123');
    expect(result).toEqual(keysData);
  });
});
