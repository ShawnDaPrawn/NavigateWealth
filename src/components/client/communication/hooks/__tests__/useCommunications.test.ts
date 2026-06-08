import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCommunications, useMarkAsRead } from '../useCommunications';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const mockUseAuth = vi.fn();

vi.mock('../../../../auth/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

const mockFetchInbox = vi.fn();
const mockMarkAsRead = vi.fn();

vi.mock('../../api', () => ({
  fetchInbox: (...args: unknown[]) => mockFetchInbox(...args),
  markAsRead: (...args: unknown[]) => mockMarkAsRead(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue({});
  mockUseMutation.mockReturnValue({});
  mockUseAuth.mockReturnValue({ user: { id: 'user-123' } });
});

// ============================================================================
// useCommunications
// ============================================================================

describe('useCommunications — queryKey', () => {
  it('passes communicationKeys.byUser with user id', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });
    mockUseAuth.mockReturnValue({ user: { id: 'user-123' } });

    renderHook(() => useCommunications());

    // communicationKeys.byUser('user-123') = ['communications', 'user-123']
    expect(captured.queryKey).toEqual(['communications', 'user-123']);
  });

  it('passes undefined user id when user is null', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });
    mockUseAuth.mockReturnValue({ user: null });

    renderHook(() => useCommunications());

    expect(captured.queryKey).toEqual(['communications', undefined]);
  });
});

describe('useCommunications — enabled', () => {
  it('is enabled when user is present', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });
    mockUseAuth.mockReturnValue({ user: { id: 'user-123' } });

    renderHook(() => useCommunications());

    expect(captured.enabled).toBe(true);
  });

  it('is disabled when user is null', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });
    mockUseAuth.mockReturnValue({ user: null });

    renderHook(() => useCommunications());

    expect(captured.enabled).toBe(false);
  });
});

describe('useCommunications — queryFn', () => {
  it('calls commApi.fetchInbox on success', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useCommunications());

    const inbox = [{ id: 'msg-1', subject: 'Hello' }];
    mockFetchInbox.mockResolvedValue(inbox);
    const result = await (captured.queryFn as () => Promise<unknown>)();

    expect(mockFetchInbox).toHaveBeenCalled();
    expect(result).toBe(inbox);
  });

  it('returns empty array on non-auth error (error suppression)', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useCommunications());

    mockFetchInbox.mockRejectedValue(new Error('network error'));
    const result = await (captured.queryFn as () => Promise<unknown>)();

    expect(result).toEqual([]);
  });

  it('rethrows 401 auth errors', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useCommunications());

    const authErr = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    mockFetchInbox.mockRejectedValue(authErr);

    await expect((captured.queryFn as () => Promise<unknown>)()).rejects.toThrow('Unauthorized');
  });
});

describe('useCommunications — retry function', () => {
  it('returns false for 401 errors regardless of failure count', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useCommunications());

    const authErr = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    const retryFn = captured.retry as (failureCount: number, error: unknown) => boolean;

    expect(retryFn(0, authErr)).toBe(false);
    expect(retryFn(3, authErr)).toBe(false);
  });

  it('retries up to 2 times for non-401 errors', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useCommunications());

    const genericErr = new Error('generic');
    const retryFn = captured.retry as (failureCount: number, error: unknown) => boolean;

    expect(retryFn(0, genericErr)).toBe(true);
    expect(retryFn(1, genericErr)).toBe(true);
    expect(retryFn(2, genericErr)).toBe(false);
  });
});

// ============================================================================
// useMarkAsRead
// ============================================================================

describe('useMarkAsRead', () => {
  it('mutationFn delegates to commApi.markAsRead', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });
    mockUseAuth.mockReturnValue({ user: { id: 'user-123' } });

    renderHook(() => useMarkAsRead());

    mockMarkAsRead.mockResolvedValue(undefined);
    await (captured.mutationFn as (id: string) => Promise<unknown>)('msg-1');

    expect(mockMarkAsRead).toHaveBeenCalledWith('msg-1');
  });

  it('onSuccess invalidates communications query for current user', () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });
    mockUseAuth.mockReturnValue({ user: { id: 'user-123' } });

    renderHook(() => useMarkAsRead());

    (captured.onSuccess as () => void)();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['communications', 'user-123'],
    });
  });

  it('onSuccess with null user passes undefined to communicationKeys.byUser', () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });
    mockUseAuth.mockReturnValue({ user: null });

    renderHook(() => useMarkAsRead());

    (captured.onSuccess as () => void)();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['communications', undefined],
    });
  });
});
