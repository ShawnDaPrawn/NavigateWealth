import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDashboardStats } from '../useDashboardStats';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const mockApiGet = vi.fn();

vi.mock('../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

const mockUseAuth = vi.fn();

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

vi.mock('../../../../utils/errorUtils', () => ({
  logError: vi.fn(),
}));

vi.mock('../../../../utils/queryKeys', () => ({
  adminStatsKeys: { all: ['admin-stats'] },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue({});
  mockUseAuth.mockReturnValue({ isAuthenticated: true, user: { role: 'admin' } });
});

// ============================================================================
// enabled / isAdmin
// ============================================================================

describe('useDashboardStats — enabled', () => {
  it('enables query when user is admin', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: { role: 'admin' } });

    renderHook(() => useDashboardStats());

    expect(captured.enabled).toBe(true);
  });

  it('enables query when user is super_admin', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: { role: 'super_admin' } });

    renderHook(() => useDashboardStats());

    expect(captured.enabled).toBe(true);
  });

  it('disables query when user is not authenticated', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });
    mockUseAuth.mockReturnValue({ isAuthenticated: false, user: null });

    renderHook(() => useDashboardStats());

    expect(captured.enabled).toBe(false);
  });

  it('disables query when user role is not admin', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: { role: 'client' } });

    renderHook(() => useDashboardStats());

    expect(captured.enabled).toBe(false);
  });
});

// ============================================================================
// queryKey
// ============================================================================

describe('useDashboardStats — queryKey', () => {
  it('passes adminStatsKeys.all as the queryKey', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useDashboardStats());

    expect(captured.queryKey).toEqual(['admin-stats']);
  });
});

// ============================================================================
// refetchInterval
// ============================================================================

describe('useDashboardStats — refetchInterval', () => {
  it('sets refetchInterval to 60000 for admin', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: { role: 'admin' } });

    renderHook(() => useDashboardStats());

    expect(captured.refetchInterval).toBe(60000);
  });

  it('sets refetchInterval to false for non-admin', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });
    mockUseAuth.mockReturnValue({ isAuthenticated: false, user: null });

    renderHook(() => useDashboardStats());

    expect(captured.refetchInterval).toBe(false);
  });

  it('sets retry to false', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useDashboardStats());

    expect(captured.retry).toBe(false);
  });
});

// ============================================================================
// queryFn — success path
// ============================================================================

describe('useDashboardStats — queryFn', () => {
  it('calls api.get("/admin/stats") and returns stats', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useDashboardStats());

    const mockStats = { total: 10, approved: 5 };
    mockApiGet.mockResolvedValue({ stats: mockStats });

    const result = await (captured.queryFn as () => Promise<unknown>)();

    expect(mockApiGet).toHaveBeenCalledWith('/admin/stats');
    expect(result).toBe(mockStats);
  });

  it('returns empty stats object when API throws Unauthorized error', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useDashboardStats());

    mockApiGet.mockRejectedValue(new Error('Unauthorized'));

    const result = (await (captured.queryFn as () => Promise<unknown>)()) as Record<string, number>;

    expect(result.total).toBe(0);
    expect(result.approved).toBe(0);
  });

  it('returns empty stats object when API throws Forbidden error', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useDashboardStats());

    mockApiGet.mockRejectedValue(new Error('Forbidden'));

    const result = (await (captured.queryFn as () => Promise<unknown>)()) as Record<string, number>;

    expect(result.total).toBe(0);
  });

  it('returns empty stats on generic network error', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useDashboardStats());

    mockApiGet.mockRejectedValue(new Error('network timeout'));

    const result = (await (captured.queryFn as () => Promise<unknown>)()) as Record<string, number>;

    expect(result.total).toBe(0);
    expect(result.active_users).toBe(0);
  });
});
