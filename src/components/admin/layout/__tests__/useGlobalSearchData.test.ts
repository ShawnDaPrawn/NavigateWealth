/**
 * Tests for useGlobalSearchData hook.
 * Strategy: mock useQuery, clientApi, personnelApi, and queryKeys.
 * The hook uses two useQuery calls + useMemo to filter results.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const mockGetClients = vi.fn();
const mockFetchPersonnel = vi.fn();

vi.mock('../../modules/client-management/api', () => ({
  clientApi: {
    getClients: (...args: unknown[]) => mockGetClients(...args),
  },
}));

vi.mock('../../modules/personnel/api', () => ({
  personnelApi: {
    fetch: (...args: unknown[]) => mockFetchPersonnel(...args),
  },
}));

vi.mock('../../../../utils/queryKeys', () => ({
  clientKeys: {
    all: ['clients'],
    lists: () => ['clients', 'list'],
  },
  personnelKeys: {
    all: ['personnel'],
    lists: () => ['personnel', 'list'],
  },
}));

vi.mock('../../modules/client-management/normalizeClientProfileKv', () => ({
  normalizeClientProfileKv: (profile: unknown) => profile,
}));

vi.mock('../../../../utils/personName', () => ({
  resolvePersonName: (args: {
    profileFirstName?: string;
    profileLastName?: string;
    fallbackFirstName?: string;
    fallbackLastName?: string;
  }) => ({
    firstName: args.profileFirstName || args.fallbackFirstName || 'Unknown',
    lastName: args.profileLastName || args.fallbackLastName || 'User',
  }),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useGlobalSearchData } from '../useGlobalSearchData';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryReturn(data: unknown = [], isLoading = false) {
  return { data, isLoading, error: null };
}

function setupBothQueries(clients: unknown[] = [], personnel: unknown[] = []) {
  let callCount = 0;
  mockUseQuery.mockImplementation(() => {
    callCount++;
    if (callCount === 1) return makeQueryReturn(clients);
    return makeQueryReturn(personnel);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useGlobalSearchData — query config', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls useQuery twice (clients and personnel)', () => {
    setupBothQueries();
    renderHook(() => useGlobalSearchData(true, 'alice'));
    expect(mockUseQuery).toHaveBeenCalledTimes(2);
  });

  it('uses clientKeys.lists() for client query key', () => {
    const captured: unknown[] = [];
    mockUseQuery.mockImplementation((opts: { queryKey: unknown }) => {
      captured.push(opts.queryKey);
      return makeQueryReturn([]);
    });
    renderHook(() => useGlobalSearchData(true, 'alice'));
    expect(captured[0]).toEqual(['clients', 'list']);
  });

  it('uses personnelKeys.lists() for personnel query key', () => {
    const captured: unknown[] = [];
    mockUseQuery.mockImplementation((opts: { queryKey: unknown }) => {
      captured.push(opts.queryKey);
      return makeQueryReturn([]);
    });
    renderHook(() => useGlobalSearchData(true, 'alice'));
    expect(captured[1]).toEqual(['personnel', 'list']);
  });

  it('passes staleTime of 5 minutes', () => {
    const captured: unknown[] = [];
    mockUseQuery.mockImplementation((opts: { staleTime: unknown }) => {
      captured.push(opts.staleTime);
      return makeQueryReturn([]);
    });
    renderHook(() => useGlobalSearchData(true, 'alice'));
    expect(captured[0]).toBe(5 * 60 * 1000);
    expect(captured[1]).toBe(5 * 60 * 1000);
  });

  it('disables query when search is less than 2 chars', () => {
    const captured: boolean[] = [];
    mockUseQuery.mockImplementation((opts: { enabled: boolean }) => {
      captured.push(opts.enabled);
      return makeQueryReturn([]);
    });
    renderHook(() => useGlobalSearchData(true, 'a'));
    expect(captured[0]).toBe(false);
    expect(captured[1]).toBe(false);
  });

  it('disables query when enabled is false', () => {
    const captured: boolean[] = [];
    mockUseQuery.mockImplementation((opts: { enabled: boolean }) => {
      captured.push(opts.enabled);
      return makeQueryReturn([]);
    });
    renderHook(() => useGlobalSearchData(false, 'alice'));
    expect(captured[0]).toBe(false);
  });

  it('enables query when enabled=true and search >= 2 chars', () => {
    const captured: boolean[] = [];
    mockUseQuery.mockImplementation((opts: { enabled: boolean }) => {
      captured.push(opts.enabled);
      return makeQueryReturn([]);
    });
    renderHook(() => useGlobalSearchData(true, 'al'));
    expect(captured[0]).toBe(true);
    expect(captured[1]).toBe(true);
  });
});

describe('useGlobalSearchData — returned state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty clients and personnel when search < 2 chars', () => {
    setupBothQueries(
      [{ id: 'c1', firstName: 'Alice', lastName: 'Smith', email: 'a@t.com', type: 'client' }],
      [],
    );
    const { result } = renderHook(() => useGlobalSearchData(true, 'a'));
    expect(result.current.clients).toEqual([]);
    expect(result.current.personnel).toEqual([]);
  });

  it('hasSearchQuery is false when search < 2 chars', () => {
    setupBothQueries();
    const { result } = renderHook(() => useGlobalSearchData(true, 'a'));
    expect(result.current.hasSearchQuery).toBe(false);
  });

  it('hasSearchQuery is true when search >= 2 chars', () => {
    setupBothQueries();
    const { result } = renderHook(() => useGlobalSearchData(true, 'al'));
    expect(result.current.hasSearchQuery).toBe(true);
  });

  it('filters clients by first name match', () => {
    const client = {
      id: 'c1',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@test.com',
      type: 'client' as const,
      status: 'active',
      meta: 'Active',
    };
    setupBothQueries([client], []);
    const { result } = renderHook(() => useGlobalSearchData(true, 'alic'));
    expect(result.current.clients).toHaveLength(1);
  });

  it('filters out clients that do not match search', () => {
    const client = {
      id: 'c1',
      firstName: 'Bob',
      lastName: 'Jones',
      email: 'bob@test.com',
      type: 'client' as const,
      status: 'active',
      meta: 'Active',
    };
    setupBothQueries([client], []);
    const { result } = renderHook(() => useGlobalSearchData(true, 'alic'));
    expect(result.current.clients).toHaveLength(0);
  });

  it('filters personnel by email match', () => {
    const person = {
      id: 'p1',
      firstName: 'Carol',
      lastName: 'Davis',
      email: 'carol@firm.com',
      type: 'personnel' as const,
      status: 'active',
      meta: 'Adviser',
    };
    setupBothQueries([], [person]);
    const { result } = renderHook(() => useGlobalSearchData(true, 'carol'));
    expect(result.current.personnel).toHaveLength(1);
  });

  it('isLoading is false when not fetching', () => {
    setupBothQueries();
    const { result } = renderHook(() => useGlobalSearchData(true, 'al'));
    expect(result.current.isLoading).toBe(false);
  });

  it('isLoading is true when shouldFetch and either query is loading', () => {
    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? { data: [], isLoading: true } : { data: [], isLoading: false };
    });
    const { result } = renderHook(() => useGlobalSearchData(true, 'al'));
    expect(result.current.isLoading).toBe(true);
  });
});

describe('useGlobalSearchData — queryFn', () => {
  beforeEach(() => vi.clearAllMocks());

  it('client queryFn calls clientApi.getClients and maps users', async () => {
    mockGetClients.mockResolvedValue({
      users: [
        {
          id: 'c1',
          email: 'alice@test.com',
          name: 'Alice Smith',
          profile: {
            personalInformation: { firstName: 'Alice', lastName: 'Smith' },
          },
          account_status: 'active',
        },
      ],
    });
    let clientQueryFn: (() => Promise<unknown>) | undefined;
    mockUseQuery.mockImplementation((opts: { queryFn?: () => Promise<unknown> }) => {
      if (!clientQueryFn) clientQueryFn = opts.queryFn;
      return makeQueryReturn([]);
    });

    renderHook(() => useGlobalSearchData(true, 'al'));
    const result = await clientQueryFn!();
    expect(mockGetClients).toHaveBeenCalledOnce();
    expect(Array.isArray(result)).toBe(true);
  });

  it('client queryFn handles clients array key', async () => {
    mockGetClients.mockResolvedValue({
      clients: [{ id: 'c1', email: 'bob@test.com', account_status: 'active' }],
    });
    let clientQueryFn: (() => Promise<unknown>) | undefined;
    mockUseQuery.mockImplementation((opts: { queryFn?: () => Promise<unknown> }) => {
      if (!clientQueryFn) clientQueryFn = opts.queryFn;
      return makeQueryReturn([]);
    });

    renderHook(() => useGlobalSearchData(true, 'bo'));
    const result = (await clientQueryFn!()) as unknown[];
    expect(result).toHaveLength(1);
  });

  it('personnel queryFn calls personnelApi.fetch and maps results', async () => {
    mockFetchPersonnel.mockResolvedValue([
      {
        id: 'p1',
        firstName: 'Carol',
        lastName: 'Davis',
        email: 'carol@firm.com',
        status: 'active',
        role: 'adviser',
      },
    ]);
    const queryFns: Array<() => Promise<unknown>> = [];
    mockUseQuery.mockImplementation((opts: { queryFn?: () => Promise<unknown> }) => {
      if (opts.queryFn) queryFns.push(opts.queryFn);
      return makeQueryReturn([]);
    });

    renderHook(() => useGlobalSearchData(true, 'ca'));
    const result = (await queryFns[1]!()) as unknown[];
    expect(mockFetchPersonnel).toHaveBeenCalledOnce();
    expect(result).toHaveLength(1);
    expect((result[0] as { type: string }).type).toBe('personnel');
  });
});
