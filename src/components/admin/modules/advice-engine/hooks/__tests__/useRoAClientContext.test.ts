/**
 * Tests for useRoAClientContext
 * Navigate Wealth Admin Dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRoAClientContext } from '../useRoAClientContext';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const mockGetClientContext = vi.fn();

vi.mock('../../api', () => ({
  adviceEngineApi: {
    roa: {
      getClientContext: (...args: unknown[]) => mockGetClientContext(...args),
    },
  },
}));

vi.mock('../queryKeys', () => ({
  adviceEngineKeys: {
    roa: {
      clientContext: (id: string) => ['roa', 'client-context', id],
    },
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
    retry: number;
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('useRoAClientContext', () => {
  it('is disabled when clientId is undefined', () => {
    renderHook(() => useRoAClientContext(undefined));
    const opts = getCapturedOpts();
    expect(opts.enabled).toBe(false);
  });

  it('is enabled when clientId is a non-empty string', () => {
    renderHook(() => useRoAClientContext('client-123'));
    const opts = getCapturedOpts();
    expect(opts.enabled).toBe(true);
  });

  it('queryKey uses adviceEngineKeys.roa.clientContext(clientId)', () => {
    renderHook(() => useRoAClientContext('client-123'));
    const opts = getCapturedOpts();
    expect(opts.queryKey).toEqual(['roa', 'client-context', 'client-123']);
  });

  it('staleTime is 2 minutes (120000ms)', () => {
    renderHook(() => useRoAClientContext('client-123'));
    const opts = getCapturedOpts();
    expect(opts.staleTime).toBe(2 * 60 * 1000);
  });

  it('queryFn returns null when clientId is falsy', async () => {
    renderHook(() => useRoAClientContext(undefined));
    const opts = getCapturedOpts();
    const result = await opts.queryFn();
    expect(result).toBeNull();
  });

  it('queryFn calls adviceEngineApi.roa.getClientContext when clientId is defined', async () => {
    const contextData = { clientId: 'client-123', riskProfile: 'moderate' };
    mockGetClientContext.mockResolvedValue(contextData);
    renderHook(() => useRoAClientContext('client-123'));
    const opts = getCapturedOpts();
    const result = await opts.queryFn();
    expect(mockGetClientContext).toHaveBeenCalledWith('client-123');
    expect(result).toEqual(contextData);
  });
});
