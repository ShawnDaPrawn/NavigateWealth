/**
 * Tests for personnel query hooks.
 *
 * Strategy: mock @tanstack/react-query's useQuery, the API module, constants,
 * and queryKeys so we can inspect the options without a QueryClientProvider.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('../../api', () => ({
  personnelApi: {
    fetch: (...args: unknown[]) => mockFetch(...args),
    fetchById: (...args: unknown[]) => mockFetchById(...args),
    fetchClients: (...args: unknown[]) => mockFetchClients(...args),
    fetchSuperAdmin: (...args: unknown[]) => mockFetchSuperAdmin(...args),
  },
}));

vi.mock('../../constants', () => ({
  QUERY_STALE_TIME: 30000,
  QUERY_GC_TIME: 5 * 60 * 1000,
}));

vi.mock('../../../../../utils/queryKeys', () => ({
  personnelKeys: {
    all: ['personnel'],
    lists: () => ['personnel', 'list'],
    list: (filters?: Record<string, unknown>) => ['personnel', 'list', filters],
    details: () => ['personnel', 'detail'],
    detail: (id: string) => ['personnel', 'detail', id],
    clients: (personnelId: string) => ['personnel', 'detail', personnelId, 'clients'],
    superAdmin: () => ['personnel', 'super-admin'],
  },
}));

// ── Mock fn references ────────────────────────────────────────────────────────

const mockFetch = vi.fn();
const mockFetchById = vi.fn();
const mockFetchClients = vi.fn();
const mockFetchSuperAdmin = vi.fn();

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import {
  usePersonnel,
  usePersonnelById,
  usePersonnelClients,
  useSuperAdmin,
  personnelKeys,
} from '../usePersonnel';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueryOptions {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  staleTime?: number;
  gcTime?: number;
  retry?: boolean;
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchOnMount?: boolean | 'always';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function captureQueryOptions(invoke: () => void): QueryOptions {
  let captured: QueryOptions | undefined;
  mockUseQuery.mockImplementationOnce((opts: unknown) => {
    captured = opts as QueryOptions;
    return {};
  });
  invoke();
  return captured!;
}

// ── personnelKeys re-export ───────────────────────────────────────────────────

describe('personnelKeys (re-exported from usePersonnel)', () => {
  it('list(filters) includes filters in key', () => {
    const filters = { roles: ['admin'] };
    expect(personnelKeys.list(filters)).toEqual(['personnel', 'list', filters]);
  });

  it('detail(id) creates correct key', () => {
    expect(personnelKeys.detail('p-1')).toEqual(['personnel', 'detail', 'p-1']);
  });

  it('superAdmin() creates correct key', () => {
    expect(personnelKeys.superAdmin()).toEqual(['personnel', 'super-admin']);
  });
});

// ── usePersonnel ──────────────────────────────────────────────────────────────

describe('usePersonnel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes the correct queryKey with no filters', () => {
    const opts = captureQueryOptions(() => usePersonnel());
    expect(opts.queryKey).toEqual(personnelKeys.list(undefined));
  });

  it('passes the correct queryKey with filters', () => {
    const filters = { roles: ['adviser'] as unknown[] };
    const opts = captureQueryOptions(() => usePersonnel(filters as never));
    expect(opts.queryKey).toEqual(personnelKeys.list(filters as never));
  });

  it('passes staleTime of QUERY_STALE_TIME (30 000ms)', () => {
    const opts = captureQueryOptions(() => usePersonnel());
    expect(opts.staleTime).toBe(30000);
  });

  it('passes gcTime of QUERY_GC_TIME (5 minutes)', () => {
    const opts = captureQueryOptions(() => usePersonnel());
    expect(opts.gcTime).toBe(5 * 60 * 1000);
  });

  it('passes retry: false', () => {
    const opts = captureQueryOptions(() => usePersonnel());
    expect(opts.retry).toBe(false);
  });

  it('passes refetchOnWindowFocus: false', () => {
    const opts = captureQueryOptions(() => usePersonnel());
    expect(opts.refetchOnWindowFocus).toBe(false);
  });

  it('passes refetchOnMount: true', () => {
    const opts = captureQueryOptions(() => usePersonnel());
    expect(opts.refetchOnMount).toBe(true);
  });

  it('queryFn calls personnelApi.fetch with filters', async () => {
    const filters = { roles: ['adviser'] as unknown[] };
    mockFetch.mockResolvedValue([]);
    const opts = captureQueryOptions(() => usePersonnel(filters as never));
    await opts.queryFn();
    expect(mockFetch).toHaveBeenCalledWith(filters);
  });
});

// ── usePersonnelById ──────────────────────────────────────────────────────────

describe('usePersonnelById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes the correct queryKey', () => {
    const opts = captureQueryOptions(() => usePersonnelById('p-1'));
    expect(opts.queryKey).toEqual(personnelKeys.detail('p-1'));
  });

  it('passes staleTime of 30 000ms', () => {
    const opts = captureQueryOptions(() => usePersonnelById('p-1'));
    expect(opts.staleTime).toBe(30000);
  });

  it('passes retry: false', () => {
    const opts = captureQueryOptions(() => usePersonnelById('p-1'));
    expect(opts.retry).toBe(false);
  });

  it('is enabled when id is provided and enabled is true', () => {
    const opts = captureQueryOptions(() => usePersonnelById('p-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when enabled is explicitly false', () => {
    const opts = captureQueryOptions(() => usePersonnelById('p-1', false));
    expect(opts.enabled).toBe(false);
  });

  it('is disabled when id is empty string', () => {
    const opts = captureQueryOptions(() => usePersonnelById(''));
    expect(opts.enabled).toBe(false);
  });

  it('queryFn calls personnelApi.fetchById with id', async () => {
    mockFetchById.mockResolvedValue({ id: 'p-1' });
    const opts = captureQueryOptions(() => usePersonnelById('p-1'));
    await opts.queryFn();
    expect(mockFetchById).toHaveBeenCalledWith('p-1');
  });
});

// ── usePersonnelClients ───────────────────────────────────────────────────────

describe('usePersonnelClients', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes the correct queryKey', () => {
    const opts = captureQueryOptions(() => usePersonnelClients('p-1'));
    expect(opts.queryKey).toEqual(personnelKeys.clients('p-1'));
  });

  it('passes staleTime of 30 000ms', () => {
    const opts = captureQueryOptions(() => usePersonnelClients('p-1'));
    expect(opts.staleTime).toBe(30000);
  });

  it('is disabled by default (enabled defaults to false)', () => {
    const opts = captureQueryOptions(() => usePersonnelClients('p-1'));
    expect(opts.enabled).toBe(false);
  });

  it('is enabled when enabled is true and personnelId is provided', () => {
    const opts = captureQueryOptions(() => usePersonnelClients('p-1', true));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when personnelId is empty string even if enabled is true', () => {
    const opts = captureQueryOptions(() => usePersonnelClients('', true));
    expect(opts.enabled).toBe(false);
  });

  it('queryFn calls personnelApi.fetchClients with personnelId', async () => {
    mockFetchClients.mockResolvedValue([]);
    const opts = captureQueryOptions(() => usePersonnelClients('p-1', true));
    await opts.queryFn();
    expect(mockFetchClients).toHaveBeenCalledWith('p-1');
  });
});

// ── useSuperAdmin ─────────────────────────────────────────────────────────────

describe('useSuperAdmin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes the correct queryKey', () => {
    const opts = captureQueryOptions(() => useSuperAdmin());
    expect(opts.queryKey).toEqual(personnelKeys.superAdmin());
  });

  it('passes staleTime of 5 minutes', () => {
    const opts = captureQueryOptions(() => useSuperAdmin());
    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it('passes retry: false', () => {
    const opts = captureQueryOptions(() => useSuperAdmin());
    expect(opts.retry).toBe(false);
  });

  it('passes refetchOnMount: false', () => {
    const opts = captureQueryOptions(() => useSuperAdmin());
    expect(opts.refetchOnMount).toBe(false);
  });

  it('queryFn calls personnelApi.fetchSuperAdmin', async () => {
    mockFetchSuperAdmin.mockResolvedValue({ id: 'sa-1' });
    const opts = captureQueryOptions(() => useSuperAdmin());
    await opts.queryFn();
    expect(mockFetchSuperAdmin).toHaveBeenCalledOnce();
  });
});
