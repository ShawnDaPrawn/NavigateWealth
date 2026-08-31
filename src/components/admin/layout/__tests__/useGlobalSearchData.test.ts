/**
 * Tests for useGlobalSearchData hook.
 * Strategy: mock useQuery, clientApi, personnelApi, and queryKeys.
 * The hook uses two useQuery calls (shared module cache keys + `select`
 * mapping to SearchableAccount) + useMemo to filter results.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
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
    list: (filters?: unknown) => ['clients', 'list', filters],
  },
  personnelKeys: {
    all: ['personnel'],
    lists: () => ['personnel', 'list'],
    list: (filters?: unknown) => ['personnel', 'list', filters],
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
import type { SearchableAccount } from '../useGlobalSearchData';

// ── Helpers ───────────────────────────────────────────────────────────────────

type SelectFn = (raw: unknown[]) => SearchableAccount[];

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

  it("uses the Clients module's list key (clientKeys.lists()) so the cache entry is shared", () => {
    const captured: unknown[] = [];
    mockUseQuery.mockImplementation((opts: { queryKey: unknown }) => {
      captured.push(opts.queryKey);
      return makeQueryReturn([]);
    });
    renderHook(() => useGlobalSearchData(true, 'alice'));
    expect(captured[0]).toEqual(['clients', 'list']);
  });

  it("uses the Personnel module's unfiltered list key (personnelKeys.list()) so the cache entry is shared", () => {
    const captured: unknown[] = [];
    mockUseQuery.mockImplementation((opts: { queryKey: unknown }) => {
      captured.push(opts.queryKey);
      return makeQueryReturn([]);
    });
    renderHook(() => useGlobalSearchData(true, 'alice'));
    expect(captured[1]).toEqual(['personnel', 'list', undefined]);
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

describe('useGlobalSearchData — queryFn caches the module shape', () => {
  beforeEach(() => vi.clearAllMocks());

  it('client queryFn calls clientApi.getClients and returns Client-shaped rows (no `type` stored)', async () => {
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
    const result = (await clientQueryFn!()) as Array<Record<string, unknown>>;
    expect(mockGetClients).toHaveBeenCalledOnce();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
    // The cached shape is the Clients module's Client, not SearchableAccount —
    // the `type` discriminator is derived by `select`, never stored.
    expect(result[0].type).toBeUndefined();
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

  it('personnel queryFn calls personnelApi.fetch and returns the raw personnel list', async () => {
    const rawPersonnel = [
      {
        id: 'p1',
        firstName: 'Carol',
        lastName: 'Davis',
        email: 'carol@firm.com',
        status: 'active',
        role: 'adviser',
      },
    ];
    mockFetchPersonnel.mockResolvedValue(rawPersonnel);
    const queryFns: Array<() => Promise<unknown>> = [];
    mockUseQuery.mockImplementation((opts: { queryFn?: () => Promise<unknown> }) => {
      if (opts.queryFn) queryFns.push(opts.queryFn);
      return makeQueryReturn([]);
    });

    renderHook(() => useGlobalSearchData(true, 'ca'));
    const result = (await queryFns[1]!()) as unknown[];
    expect(mockFetchPersonnel).toHaveBeenCalledOnce();
    expect(result).toBe(rawPersonnel);
  });
});

describe('useGlobalSearchData — select derives SearchableAccount', () => {
  beforeEach(() => vi.clearAllMocks());

  function captureSelects(): SelectFn[] {
    const selects: SelectFn[] = [];
    mockUseQuery.mockImplementation((opts: { select?: SelectFn }) => {
      if (opts.select) selects.push(opts.select);
      return makeQueryReturn([]);
    });
    return selects;
  }

  it("client select stamps type 'client' — navigation depends on it even when the Clients module populated the cache", () => {
    const selects = captureSelects();
    renderHook(() => useGlobalSearchData(true, 'al'));

    const mapped = selects[0]([
      {
        id: 'c1',
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@test.com',
        accountStatus: 'active',
        deleted: false,
        suspended: false,
      },
    ]);
    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({
      id: 'c1',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@test.com',
      type: 'client',
      status: 'active',
    });
  });

  it('client select derives closed/suspended display status', () => {
    const selects = captureSelects();
    renderHook(() => useGlobalSearchData(true, 'al'));

    const mapped = selects[0]([
      { id: 'c1', firstName: 'A', lastName: 'B', email: 'a@b.co', deleted: true, suspended: false },
      { id: 'c2', firstName: 'C', lastName: 'D', email: 'c@d.co', deleted: false, suspended: true },
    ]);
    expect(mapped[0].status).toBe('closed');
    expect(mapped[1].status).toBe('suspended');
  });

  it("personnel select stamps type 'personnel' and a humanized role meta", () => {
    const selects = captureSelects();
    renderHook(() => useGlobalSearchData(true, 'ca'));

    const mapped = selects[1]([
      {
        id: 'p1',
        firstName: 'Carol',
        lastName: 'Davis',
        email: 'carol@firm.com',
        status: 'active',
        role: 'super_admin',
      },
    ]);
    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({
      id: 'p1',
      type: 'personnel',
      status: 'active',
      meta: 'Super Admin',
    });
  });
});
