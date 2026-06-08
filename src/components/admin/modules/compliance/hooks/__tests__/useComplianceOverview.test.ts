/**
 * Tests for useComplianceOverview
 * Navigate Wealth Admin Dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useComplianceOverview } from '../useComplianceOverview';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockGetRecentActivities = vi.fn();
const mockGetUpcomingDeadlines = vi.fn();
const mockGetComplianceStats = vi.fn();

vi.mock('../../api', () => ({
  complianceApi: {
    getRecentActivities: (...args: unknown[]) => mockGetRecentActivities(...args),
    getUpcomingDeadlines: (...args: unknown[]) => mockGetUpcomingDeadlines(...args),
    getComplianceStats: (...args: unknown[]) => mockGetComplianceStats(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// TESTS
// ============================================================================

describe('useComplianceOverview', () => {
  it('initial state has activities=[], deadlines=[], stats=null, loading=true', () => {
    // Keep promises pending so loading stays true
    mockGetRecentActivities.mockReturnValue(new Promise(() => {}));
    mockGetUpcomingDeadlines.mockReturnValue(new Promise(() => {}));
    mockGetComplianceStats.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useComplianceOverview());
    expect(result.current.activities).toEqual([]);
    expect(result.current.deadlines).toEqual([]);
    expect(result.current.stats).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('sets activities, deadlines, and stats after successful fetch', async () => {
    const mockActivities = [{ id: '1', description: 'Activity 1' }];
    const mockDeadlines = [{ id: '2', title: 'Deadline 1' }];
    const mockStats = { totalRecords: 10, compliantCount: 8, pendingCount: 2 };

    mockGetRecentActivities.mockResolvedValue(mockActivities);
    mockGetUpcomingDeadlines.mockResolvedValue(mockDeadlines);
    mockGetComplianceStats.mockResolvedValue(mockStats);

    const { result } = renderHook(() => useComplianceOverview());
    await act(async () => {});

    expect(result.current.activities).toEqual(mockActivities);
    expect(result.current.deadlines).toEqual(mockDeadlines);
    expect(result.current.stats).toEqual(mockStats);
  });

  it('sets loading to false after fetch', async () => {
    mockGetRecentActivities.mockResolvedValue([]);
    mockGetUpcomingDeadlines.mockResolvedValue([]);
    mockGetComplianceStats.mockResolvedValue(null);

    const { result } = renderHook(() => useComplianceOverview());
    await act(async () => {});

    expect(result.current.loading).toBe(false);
  });

  it('calls all three API methods on mount', async () => {
    mockGetRecentActivities.mockResolvedValue([]);
    mockGetUpcomingDeadlines.mockResolvedValue([]);
    mockGetComplianceStats.mockResolvedValue(null);

    renderHook(() => useComplianceOverview());
    await act(async () => {});

    expect(mockGetRecentActivities).toHaveBeenCalledTimes(1);
    expect(mockGetUpcomingDeadlines).toHaveBeenCalledTimes(1);
    expect(mockGetComplianceStats).toHaveBeenCalledTimes(1);
  });

  it('calls toast.error on failure', async () => {
    const { toast } = await import('sonner');
    mockGetRecentActivities.mockRejectedValue(new Error('Network error'));
    mockGetUpcomingDeadlines.mockResolvedValue([]);
    mockGetComplianceStats.mockResolvedValue(null);

    renderHook(() => useComplianceOverview());
    await act(async () => {});

    expect(toast.error).toHaveBeenCalledWith('Failed to load compliance overview');
  });

  it('refetch re-calls all three APIs', async () => {
    mockGetRecentActivities.mockResolvedValue([]);
    mockGetUpcomingDeadlines.mockResolvedValue([]);
    mockGetComplianceStats.mockResolvedValue(null);

    const { result } = renderHook(() => useComplianceOverview());
    await act(async () => {});

    expect(mockGetRecentActivities).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockGetRecentActivities).toHaveBeenCalledTimes(2);
    expect(mockGetUpcomingDeadlines).toHaveBeenCalledTimes(2);
    expect(mockGetComplianceStats).toHaveBeenCalledTimes(2);
  });
});
