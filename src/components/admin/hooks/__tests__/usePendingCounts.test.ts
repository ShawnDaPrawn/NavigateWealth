import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePendingCounts, usePendingCountsWithPriority } from '../usePendingCounts';

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const mockApiGet = vi.fn();

vi.mock('../../../../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

const mockGetSession = vi.fn();

vi.mock('../../../../utils/auth', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('../../../../utils/queryKeys', () => ({
  pendingCountsKeys: { all: ['pending-counts'] },
}));

const mockGetIncompleteCount = vi.fn();

vi.mock('../../modules/applications/utils', () => ({
  getIncompleteCount: (...args: unknown[]) => mockGetIncompleteCount(...args),
}));

const ALL_MODULES = [
  'dashboard',
  'clients',
  'personnel',
  'advice-engine',
  'product-management',
  'resources',
  'publications',
  'compliance',
  'tasks',
  'notes',
  'applications',
  'submissions',
  'communication',
  'marketing',
  'reporting',
  'calendar',
  'esign',
  'issues',
  'ai-management',
] as const;

function buildEmptyCounts() {
  const result: Record<string, { count: number }> = {};
  for (const mod of ALL_MODULES) {
    result[mod] = { count: 0 };
  }
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue({ data: buildEmptyCounts() });
  mockGetIncompleteCount.mockReturnValue(0);
});

describe('usePendingCounts', () => {
  it('calls useQuery once', () => {
    renderHook(() => usePendingCounts());
    expect(mockUseQuery).toHaveBeenCalledTimes(1);
  });

  it('passes correct queryKey', () => {
    renderHook(() => usePendingCounts());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.queryKey).toEqual(['pending-counts']);
  });

  it('passes refetchInterval of 60 seconds', () => {
    renderHook(() => usePendingCounts());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.refetchInterval).toBe(60_000);
  });

  it('passes staleTime of 30 seconds', () => {
    renderHook(() => usePendingCounts());
    const config = mockUseQuery.mock.calls[0][0];
    expect(config.staleTime).toBe(30_000);
  });

  it('returns data from useQuery when available', () => {
    const mockCounts = buildEmptyCounts();
    mockCounts.tasks = { count: 5 };
    mockUseQuery.mockReturnValue({ data: mockCounts });
    const { result } = renderHook(() => usePendingCounts());
    expect(result.current.tasks).toEqual({ count: 5 });
  });

  it('returns empty counts when data is undefined', () => {
    mockUseQuery.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => usePendingCounts());
    expect(result.current.tasks).toEqual({ count: 0 });
    expect(result.current.applications).toEqual({ count: 0 });
  });

  it('returns all modules in result', () => {
    const { result } = renderHook(() => usePendingCounts());
    for (const mod of ALL_MODULES) {
      expect(result.current[mod]).toBeDefined();
      expect(result.current[mod]).toHaveProperty('count');
    }
  });

  it('queryFn returns empty counts when session has no access_token', async () => {
    mockGetSession.mockResolvedValue(null);
    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return { data: buildEmptyCounts() };
    });
    renderHook(() => usePendingCounts());
    const config = capturedConfig.mock.calls[0][0];
    const result = await config.queryFn();
    expect(mockApiGet).not.toHaveBeenCalled();
    expect(result.tasks).toEqual({ count: 0 });
  });

  it('queryFn fetches counts when session has access_token', async () => {
    mockGetSession.mockResolvedValue({ access_token: 'tok-abc' });
    mockApiGet
      .mockResolvedValueOnce({ stats: { submitted_for_review: 3 } })
      .mockResolvedValueOnce({ new: 2, in_progress: 1 })
      .mockResolvedValueOnce({ count: 5 })
      .mockResolvedValueOnce({ snapshot: { summary: { open: 2 } } });
    mockGetIncompleteCount.mockReturnValue(1);
    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return { data: buildEmptyCounts() };
    });
    renderHook(() => usePendingCounts());
    const config = capturedConfig.mock.calls[0][0];
    const result = await config.queryFn();
    expect(result.applications).toEqual({ count: 4 }); // 3 + 1 incomplete
    expect(result.tasks).toEqual({ count: 3 }); // 2 new + 1 in_progress
    expect(result.submissions).toEqual({ count: 5 });
    expect(result.issues).toEqual({ count: 2 });
  });

  it('queryFn handles API errors gracefully (returns zeroed counts)', async () => {
    mockGetSession.mockResolvedValue({ access_token: 'tok-abc' });
    mockApiGet.mockRejectedValue(new Error('Network error'));
    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return { data: buildEmptyCounts() };
    });
    renderHook(() => usePendingCounts());
    const config = capturedConfig.mock.calls[0][0];
    const result = await config.queryFn();
    // All API calls fail silently
    expect(result.applications).toEqual({ count: 0 });
    expect(result.tasks).toEqual({ count: 0 });
  });

  it('queryFn uses safeCount for non-numeric issue open count', async () => {
    mockGetSession.mockResolvedValue({ access_token: 'tok-abc' });
    mockApiGet
      .mockResolvedValueOnce({ stats: {} })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ snapshot: { summary: { open: 'not-a-number' } } });
    const capturedConfig = vi.fn();
    mockUseQuery.mockImplementation((config) => {
      capturedConfig(config);
      return { data: buildEmptyCounts() };
    });
    renderHook(() => usePendingCounts());
    const config = capturedConfig.mock.calls[0][0];
    const result = await config.queryFn();
    expect(result.issues).toEqual({ count: 0 });
  });
});

describe('usePendingCountsWithPriority', () => {
  it('is an alias for usePendingCounts', () => {
    expect(usePendingCountsWithPriority).toBe(usePendingCounts);
  });
});
