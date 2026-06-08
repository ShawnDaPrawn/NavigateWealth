/**
 * Tests for useClientSearch hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClientSearch } from '../useClientSearch';
import type { Client } from '../../types';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('../queryKeys', () => ({
  adviceEngineKeys: {
    ai: {
      all: ['ai-intelligence'],
      searchClients: (term: string) => ['ai-intelligence', 'search-clients', term],
    },
  },
}));

const mockSearchClients = vi.fn();

vi.mock('../../api', () => ({
  aiIntelligenceApi: {
    searchClients: (...args: unknown[]) => mockSearchClients(...args),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryResult(
  data: { clients: Client[]; totalCount: number } = { clients: [], totalCount: 0 },
  isLoading = false,
) {
  return { data, isLoading, isError: false, error: null };
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    user_id: 'client-1',
    first_name: 'Alice',
    last_name: 'Smith',
    email: 'alice@example.com',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue(makeQueryResult());
  vi.useFakeTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useClientSearch', () => {
  // ── Initial state ─────────────────────────────────────────────────────────

  it('has empty searchTerm on mount', () => {
    const { result } = renderHook(() => useClientSearch());
    expect(result.current.searchTerm).toBe('');
  });

  it('has empty results array on mount', () => {
    const { result } = renderHook(() => useClientSearch());
    expect(result.current.results).toEqual([]);
  });

  it('has isSearching false on mount', () => {
    const { result } = renderHook(() => useClientSearch());
    expect(result.current.isSearching).toBe(false);
  });

  it('has selectedClient null on mount', () => {
    const { result } = renderHook(() => useClientSearch());
    expect(result.current.selectedClient).toBeNull();
  });

  // ── setSearchTerm ─────────────────────────────────────────────────────────

  it('setSearchTerm updates the searchTerm immediately', () => {
    const { result } = renderHook(() => useClientSearch());

    act(() => {
      result.current.setSearchTerm('John');
    });

    expect(result.current.searchTerm).toBe('John');
  });

  // ── Debounce ──────────────────────────────────────────────────────────────

  it('query is disabled when search term is below min length (1 char)', () => {
    const { result } = renderHook(() => useClientSearch());

    act(() => {
      result.current.setSearchTerm('J');
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const config = mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1][0];
    expect(config.enabled).toBe(false);
  });

  it('query is enabled when debounced search term has min length (2 chars)', () => {
    const capturedConfigs: unknown[] = [];
    mockUseQuery.mockImplementation((config) => {
      capturedConfigs.push(config);
      return makeQueryResult();
    });

    const { result } = renderHook(() => useClientSearch());

    act(() => {
      result.current.setSearchTerm('Jo');
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const lastConfig = capturedConfigs[capturedConfigs.length - 1] as { enabled: boolean };
    expect(lastConfig.enabled).toBe(true);
  });

  it('debouncedSearchTerm is not updated before the delay elapses', () => {
    const capturedConfigs: unknown[] = [];
    mockUseQuery.mockImplementation((config) => {
      capturedConfigs.push(config);
      return makeQueryResult();
    });

    const { result } = renderHook(() => useClientSearch());

    act(() => {
      result.current.setSearchTerm('Jo');
      // advance only 100ms, not yet past the 300ms delay
      vi.advanceTimersByTime(100);
    });

    // The debounced term has not yet propagated — query key should still use ''
    const lastConfig = capturedConfigs[capturedConfigs.length - 1] as {
      queryKey: unknown[];
      enabled: boolean;
    };
    expect(lastConfig.enabled).toBe(false);
  });

  it('queryFn calls aiIntelligenceApi.searchClients with the debounced term', async () => {
    const clients = [makeClient()];
    mockSearchClients.mockResolvedValueOnce({ clients, totalCount: 1 });

    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult();
    });

    const { result } = renderHook(() => useClientSearch());

    act(() => {
      result.current.setSearchTerm('Alice');
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const config = capturedConfig.mock.calls[capturedConfig.mock.calls.length - 1][0];
    await config.queryFn();

    expect(mockSearchClients).toHaveBeenCalledWith('Alice');
  });

  it('queryFn returns empty result when debouncedSearchTerm is too short', async () => {
    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult();
    });

    // Don't advance timers so debounced term stays ''
    renderHook(() => useClientSearch());

    const config = capturedConfig.mock.calls[0][0];
    const result = await config.queryFn();

    expect(result).toEqual({ clients: [], totalCount: 0 });
  });

  // ── results from query ────────────────────────────────────────────────────

  it('results reflects clients array from useQuery data', () => {
    const clients = [makeClient(), makeClient({ user_id: 'client-2', first_name: 'Bob' })];
    mockUseQuery.mockReturnValue(makeQueryResult({ clients, totalCount: 2 }));

    const { result } = renderHook(() => useClientSearch());
    expect(result.current.results).toEqual(clients);
  });

  // ── isSearching ───────────────────────────────────────────────────────────

  it('isSearching is false when isLoading is true but debouncedSearchTerm is short', () => {
    mockUseQuery.mockReturnValue(makeQueryResult({ clients: [], totalCount: 0 }, true));

    const { result } = renderHook(() => useClientSearch());
    // searchTerm is '' so debouncedSearchTerm length < 2 → isSearching masked to false
    expect(result.current.isSearching).toBe(false);
  });

  it('isSearching is true when isLoading is true and debouncedSearchTerm is long enough', () => {
    mockUseQuery.mockReturnValue(makeQueryResult({ clients: [], totalCount: 0 }, true));

    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return makeQueryResult({ clients: [], totalCount: 0 }, true);
    });

    const { result } = renderHook(() => useClientSearch());

    act(() => {
      result.current.setSearchTerm('Alice');
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.isSearching).toBe(true);
  });

  // ── selectClient ──────────────────────────────────────────────────────────

  it('selectClient sets selectedClient', () => {
    const { result } = renderHook(() => useClientSearch());
    const client = makeClient();

    act(() => {
      result.current.selectClient(client);
    });

    expect(result.current.selectedClient).toEqual(client);
  });

  it('selectClient clears searchTerm when a client is selected', () => {
    const { result } = renderHook(() => useClientSearch());

    act(() => {
      result.current.setSearchTerm('Alice');
    });
    act(() => {
      result.current.selectClient(makeClient());
    });

    expect(result.current.searchTerm).toBe('');
  });

  it('selectClient with null does not clear searchTerm', () => {
    const { result } = renderHook(() => useClientSearch());

    act(() => {
      result.current.setSearchTerm('Alice');
    });
    act(() => {
      result.current.selectClient(null);
    });

    expect(result.current.searchTerm).toBe('Alice');
    expect(result.current.selectedClient).toBeNull();
  });

  // ── clearSelection ────────────────────────────────────────────────────────

  it('clearSelection sets selectedClient to null', () => {
    const { result } = renderHook(() => useClientSearch());

    act(() => {
      result.current.selectClient(makeClient());
    });
    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedClient).toBeNull();
  });

  it('clearSelection does not change searchTerm', () => {
    const { result } = renderHook(() => useClientSearch());

    act(() => {
      result.current.setSearchTerm('Bob');
    });
    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.searchTerm).toBe('Bob');
  });
});
