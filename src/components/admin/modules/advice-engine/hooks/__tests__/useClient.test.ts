/**
 * Tests for useClient
 * Navigate Wealth Admin Dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useClient } from '../useClient';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const mockGetClient = vi.fn();

vi.mock('../../api', () => ({
  adviceEngineApi: {
    clients: {
      getClient: (...args: unknown[]) => mockGetClient(...args),
    },
  },
}));

vi.mock('../queryKeys', () => ({
  adviceEngineKeys: {
    client: (id: string) => ['client', id],
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

describe('useClient', () => {
  it('is disabled when clientId is undefined', () => {
    renderHook(() => useClient(undefined));
    const opts = getCapturedOpts();
    expect(opts.enabled).toBe(false);
  });

  it('is disabled when clientId is empty string', () => {
    renderHook(() => useClient(''));
    const opts = getCapturedOpts();
    expect(opts.enabled).toBe(false);
  });

  it('is enabled when clientId is a non-empty string', () => {
    renderHook(() => useClient('client-123'));
    const opts = getCapturedOpts();
    expect(opts.enabled).toBe(true);
  });

  it('queryKey uses adviceEngineKeys.client(clientId)', () => {
    renderHook(() => useClient('client-123'));
    const opts = getCapturedOpts();
    expect(opts.queryKey).toEqual(['client', 'client-123']);
  });

  it('staleTime is 5 minutes (300000ms)', () => {
    renderHook(() => useClient('client-123'));
    const opts = getCapturedOpts();
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('retry is 1', () => {
    renderHook(() => useClient('client-123'));
    const opts = getCapturedOpts();
    expect(opts.retry).toBe(1);
  });

  it('queryFn returns null when clientId is falsy', async () => {
    renderHook(() => useClient(undefined));
    const opts = getCapturedOpts();
    const result = await opts.queryFn();
    expect(result).toBeNull();
  });

  it('queryFn calls adviceEngineApi.clients.getClient when clientId is defined', async () => {
    const clientData = { id: 'client-123', name: 'Test Client' };
    mockGetClient.mockResolvedValue(clientData);
    renderHook(() => useClient('client-123'));
    const opts = getCapturedOpts();
    const result = await opts.queryFn();
    expect(mockGetClient).toHaveBeenCalledWith('client-123');
    expect(result).toEqual(clientData);
  });
});
