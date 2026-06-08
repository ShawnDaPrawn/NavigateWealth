/**
 * Tests for useClientList hook.
 *
 * Strategy: mock @tanstack/react-query so useQuery/useQueryClient are
 * controlled synchronously; capture the queryFn passed to useQuery so we can
 * exercise the transformation logic (transformApiUser) directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mutable state the tests drive
let mockIsLoading = false;
let mockData: unknown = undefined;

const mockInvalidateQueries = vi.fn();
const mockUseQueryClient = vi.fn(() => ({ invalidateQueries: mockInvalidateQueries }));

// Capture the options passed to useQuery so tests can invoke queryFn directly
let capturedQueryOptions: {
  queryKey?: unknown;
  queryFn?: () => Promise<unknown>;
  staleTime?: number;
} = {};

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((options: typeof capturedQueryOptions) => {
    capturedQueryOptions = options;
    return {
      data: mockData,
      isLoading: mockIsLoading,
    };
  }),
  useQueryClient: vi.fn(() => mockUseQueryClient()),
}));

vi.mock('../../api', () => ({
  clientApi: {
    getClients: vi.fn(),
  },
}));

vi.mock('../queryKeys', () => ({
  clientKeys: {
    all: ['clients'],
    lists: () => ['clients', 'list'],
  },
}));

vi.mock('../normalizeClientProfileKv', () => ({
  normalizeClientProfileKv: (p: unknown) => p,
}));

vi.mock('../../../../../../utils/personName', () => ({
  resolvePersonName: vi.fn(() => ({ firstName: 'Test', lastName: 'User' })),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { useClientList } from '../useClientList';
import { clientApi } from '../../api';
import { resolvePersonName } from '../../../../../../utils/personName';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApiUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    created_at: '2024-01-01T00:00:00Z',
    deleted: false,
    suspended: false,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useClientList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoading = false;
    mockData = undefined;
    capturedQueryOptions = {};
    // Reset useQueryClient to return fresh mock
    mockUseQueryClient.mockReturnValue({ invalidateQueries: mockInvalidateQueries });
  });

  // ── Return-shape tests ──────────────────────────────────────────────────────

  describe('return shape', () => {
    it('returns an object with clients, loading and refetch', () => {
      const { result } = renderHook(() => useClientList());
      expect(result.current).toHaveProperty('clients');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('refetch');
    });

    it('clients defaults to empty array when useQuery data is undefined', () => {
      mockData = undefined;
      const { result } = renderHook(() => useClientList());
      expect(result.current.clients).toEqual([]);
    });

    it('clients is null when useQuery returns null (default only applies to undefined)', () => {
      // React Query destructuring `data: clients = []` uses undefined-check;
      // the mock returning null exposes that. Document the actual hook behaviour.
      mockData = null;
      const { result } = renderHook(() => useClientList());
      // null is passed through as-is (not replaced by the [] default)
      expect(result.current.clients).toBeNull();
    });

    it('clients reflects the array returned by useQuery', () => {
      const fakeClients = [{ id: 'c1' }, { id: 'c2' }];
      mockData = fakeClients;
      const { result } = renderHook(() => useClientList());
      expect(result.current.clients).toBe(fakeClients);
    });

    it('loading is false when isLoading is false', () => {
      mockIsLoading = false;
      const { result } = renderHook(() => useClientList());
      expect(result.current.loading).toBe(false);
    });

    it('loading is true when isLoading is true', () => {
      mockIsLoading = true;
      const { result } = renderHook(() => useClientList());
      expect(result.current.loading).toBe(true);
    });

    it('refetch is a function', () => {
      const { result } = renderHook(() => useClientList());
      expect(typeof result.current.refetch).toBe('function');
    });
  });

  // ── refetch tests ───────────────────────────────────────────────────────────

  describe('refetch', () => {
    it('calls queryClient.invalidateQueries when refetch is called', async () => {
      const { result } = renderHook(() => useClientList());
      await act(async () => {
        await result.current.refetch();
      });
      expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    });

    it('passes the lists queryKey to invalidateQueries', async () => {
      const { result } = renderHook(() => useClientList());
      await act(async () => {
        await result.current.refetch();
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['clients', 'list'] }),
      );
    });
  });

  // ── queryKey / staleTime ────────────────────────────────────────────────────

  describe('query configuration', () => {
    it('uses clientKeys.lists() as the query key', () => {
      renderHook(() => useClientList());
      expect(capturedQueryOptions.queryKey).toEqual(['clients', 'list']);
    });

    it('sets staleTime to 5 minutes (300 000 ms)', () => {
      renderHook(() => useClientList());
      expect(capturedQueryOptions.staleTime).toBe(5 * 60 * 1000);
    });
  });

  // ── queryFn / transformApiUser ──────────────────────────────────────────────

  describe('queryFn — transformApiUser', () => {
    async function runQueryFn(
      apiResponse: Record<string, unknown>,
    ): Promise<ReturnType<typeof buildApiUser>[]> {
      vi.mocked(clientApi.getClients).mockResolvedValueOnce(apiResponse as never);
      renderHook(() => useClientList());
      return capturedQueryOptions.queryFn!() as Promise<ReturnType<typeof buildApiUser>[]>;
    }

    it('maps id from the raw user', async () => {
      const user = buildApiUser({ id: 'abc-123' });
      const [client] = await runQueryFn({ clients: [user] });
      expect(client.id).toBe('abc-123');
    });

    it('maps email from the raw user', async () => {
      const user = buildApiUser({ email: 'alice@example.com' });
      const [client] = await runQueryFn({ clients: [user] });
      expect(client.email).toBe('alice@example.com');
    });

    it('maps deleted flag from the raw user', async () => {
      const user = buildApiUser({ deleted: true });
      const [client] = await runQueryFn({ clients: [user] });
      expect(client.deleted).toBe(true);
    });

    it('deleted defaults to false when not provided', async () => {
      const { deleted: _d, ...user } = buildApiUser({ deleted: undefined });
      const [client] = await runQueryFn({ clients: [user] });
      expect(client.deleted).toBe(false);
    });

    it('maps suspended flag from the raw user', async () => {
      const user = buildApiUser({ suspended: true });
      const [client] = await runQueryFn({ clients: [user] });
      expect(client.suspended).toBe(true);
    });

    it('suspended defaults to false when not provided', async () => {
      const { suspended: _s, ...user } = buildApiUser({ suspended: undefined });
      const [client] = await runQueryFn({ clients: [user] });
      expect(client.suspended).toBe(false);
    });

    it('uses firstName returned by resolvePersonName', async () => {
      vi.mocked(resolvePersonName).mockReturnValueOnce({ firstName: 'Alice', lastName: 'Smith' });
      const user = buildApiUser();
      const [client] = await runQueryFn({ clients: [user] });
      expect(client.firstName).toBe('Alice');
    });

    it('uses lastName returned by resolvePersonName', async () => {
      vi.mocked(resolvePersonName).mockReturnValueOnce({ firstName: 'Bob', lastName: 'Jones' });
      const user = buildApiUser();
      const [client] = await runQueryFn({ clients: [user] });
      expect(client.lastName).toBe('Jones');
    });

    it('sets preferredName equal to firstName', async () => {
      vi.mocked(resolvePersonName).mockReturnValueOnce({ firstName: 'Carol', lastName: 'Doe' });
      const user = buildApiUser();
      const [client] = await runQueryFn({ clients: [user] });
      expect(client.preferredName).toBe('Carol');
    });

    it('reads users from response.clients array', async () => {
      const users = [buildApiUser({ id: 'u1' }), buildApiUser({ id: 'u2' })];
      const result = await runQueryFn({ clients: users });
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.id)).toEqual(['u1', 'u2']);
    });

    it('falls back to response.users array when .clients is absent', async () => {
      const users = [buildApiUser({ id: 'legacy-1' })];
      const result = await runQueryFn({ users });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('legacy-1');
    });

    it('prefers response.clients over response.users when both present', async () => {
      const clientUsers = [buildApiUser({ id: 'clients-1' })];
      const legacyUsers = [buildApiUser({ id: 'users-1' })];
      const result = await runQueryFn({ clients: clientUsers, users: legacyUsers });
      expect(result[0].id).toBe('clients-1');
    });

    it('returns empty array when neither .clients nor .users is present', async () => {
      const result = await runQueryFn({});
      expect(result).toEqual([]);
    });

    it('maps applicationStatus to "unknown" when not provided', async () => {
      const user = buildApiUser({ application_status: undefined });
      const [client] = await runQueryFn({ clients: [user] });
      expect(client.applicationStatus).toBe('unknown');
    });

    it('maps applicationStatus from the raw user', async () => {
      const user = buildApiUser({ application_status: 'approved' });
      const [client] = await runQueryFn({ clients: [user] });
      expect(client.applicationStatus).toBe('approved');
    });
  });
});
