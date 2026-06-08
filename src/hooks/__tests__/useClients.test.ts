import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useClients, clientKeys } from '../useClients';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const mockApiGet = vi.fn();

vi.mock('../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue({});
});

// ============================================================================
// clientKeys
// ============================================================================

describe('clientKeys', () => {
  it('all key is ["clients"]', () => {
    expect(clientKeys.all).toEqual(['clients']);
  });

  it('lists() returns ["clients", "list"]', () => {
    expect(clientKeys.lists()).toEqual(['clients', 'list']);
  });

  it('list() with no search returns ["clients", "list", undefined]', () => {
    expect(clientKeys.list()).toEqual(['clients', 'list', undefined]);
  });

  it('list(search) returns ["clients", "list", searchTerm]', () => {
    expect(clientKeys.list('Alice')).toEqual(['clients', 'list', 'Alice']);
  });
});

// ============================================================================
// useClients — query options
// ============================================================================

describe('useClients — query options', () => {
  it('passes correct queryKey without search', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClients());

    expect(captured.queryKey).toEqual(['clients', 'list', undefined]);
  });

  it('passes correct queryKey with search term', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClients('Alice'));

    expect(captured.queryKey).toEqual(['clients', 'list', 'Alice']);
  });

  it('sets staleTime to 60000ms (1 minute)', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClients());

    expect(captured.staleTime).toBe(60000);
  });

  it('sets retry to false', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClients());

    expect(captured.retry).toBe(false);
  });

  it('sets refetchOnWindowFocus to false', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClients());

    expect(captured.refetchOnWindowFocus).toBe(false);
  });
});

// ============================================================================
// useClients — queryFn
// ============================================================================

describe('useClients — queryFn', () => {
  it('calls api.get("profile/all-users")', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClients());

    mockApiGet.mockResolvedValue({
      count: 1,
      users: [
        {
          id: 'u-1',
          email: 'alice@example.com',
          user_metadata: { firstName: 'Alice', surname: 'Smith' },
        },
      ],
    });

    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockApiGet).toHaveBeenCalledWith('profile/all-users');
  });

  it('returns mapped Client objects with full_name', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClients());

    mockApiGet.mockResolvedValue({
      count: 1,
      users: [
        {
          id: 'u-1',
          email: 'alice@example.com',
          user_metadata: { firstName: 'Alice', surname: 'Smith' },
        },
      ],
    });

    const result = await (captured.queryFn as () => Promise<unknown[]>)();

    expect(result).toHaveLength(1);
    expect((result[0] as Record<string, unknown>).full_name).toBe('Alice Smith');
    expect((result[0] as Record<string, unknown>).email).toBe('alice@example.com');
  });

  it('returns empty array when API returns no users', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClients());

    mockApiGet.mockResolvedValue({ count: 0, users: [] });
    const result = await (captured.queryFn as () => Promise<unknown[]>)();

    expect(result).toEqual([]);
  });

  it('returns empty array when API returns null/undefined users', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClients());

    mockApiGet.mockResolvedValue({});
    const result = await (captured.queryFn as () => Promise<unknown[]>)();

    expect(result).toEqual([]);
  });

  it('returns empty array when API throws (error suppression)', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClients());

    mockApiGet.mockRejectedValue(new Error('network error'));
    const result = await (captured.queryFn as () => Promise<unknown[]>)();

    expect(result).toEqual([]);
  });

  it('filters clients by search term (case-insensitive) when search is provided', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClients('alice'));

    mockApiGet.mockResolvedValue({
      count: 2,
      users: [
        {
          id: 'u-1',
          email: 'alice@example.com',
          user_metadata: { firstName: 'Alice', surname: 'Smith' },
        },
        {
          id: 'u-2',
          email: 'bob@example.com',
          user_metadata: { firstName: 'Bob', surname: 'Jones' },
        },
      ],
    });

    const result = await (captured.queryFn as () => Promise<unknown[]>)();

    expect(result).toHaveLength(1);
    expect((result[0] as Record<string, unknown>).id).toBe('u-1');
  });

  it('falls back to profile.personalInformation for name fields', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClients());

    mockApiGet.mockResolvedValue({
      count: 1,
      users: [
        {
          id: 'u-1',
          email: 'carol@example.com',
          profile: {
            personalInformation: { firstName: 'Carol', lastName: 'White' },
          },
        },
      ],
    });

    const result = await (captured.queryFn as () => Promise<unknown[]>)();

    expect((result[0] as Record<string, unknown>).full_name).toBe('Carol White');
  });

  it('sorts results by full_name alphabetically', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClients());

    mockApiGet.mockResolvedValue({
      count: 2,
      users: [
        {
          id: 'u-2',
          email: 'bob@example.com',
          user_metadata: { firstName: 'Bob', surname: 'Jones' },
        },
        {
          id: 'u-1',
          email: 'alice@example.com',
          user_metadata: { firstName: 'Alice', surname: 'Smith' },
        },
      ],
    });

    const result = await (captured.queryFn as () => Promise<unknown[]>)();

    expect((result[0] as Record<string, unknown>).full_name).toBe('Alice Smith');
    expect((result[1] as Record<string, unknown>).full_name).toBe('Bob Jones');
  });
});
