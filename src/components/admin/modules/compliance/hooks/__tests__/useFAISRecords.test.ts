/**
 * Tests for useFAISRecords
 * Navigate Wealth Admin Dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFAISRecords } from '../useFAISRecords';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockGetFAISRecords = vi.fn();

vi.mock('../../api', () => ({
  complianceApi: {
    getFAISRecords: (...args: unknown[]) => mockGetFAISRecords(...args),
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

describe('useFAISRecords', () => {
  it('initial loading is true', () => {
    // Keep promise pending so loading stays true
    mockGetFAISRecords.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useFAISRecords());
    expect(result.current.loading).toBe(true);
  });

  it('sets records to data returned by API on success', async () => {
    const mockData = [{ id: '1', recordType: 'FAIS', status: 'active' }];
    mockGetFAISRecords.mockResolvedValue(mockData);
    const { result } = renderHook(() => useFAISRecords());
    await act(async () => {
      // wait for the async fetch to complete
    });
    expect(result.current.records).toEqual(mockData);
  });

  it('sets loading to false after fetch', async () => {
    mockGetFAISRecords.mockResolvedValue([]);
    const { result } = renderHook(() => useFAISRecords());
    await act(async () => {});
    expect(result.current.loading).toBe(false);
  });

  it('calls getFAISRecords on mount', async () => {
    mockGetFAISRecords.mockResolvedValue([]);
    renderHook(() => useFAISRecords());
    await act(async () => {});
    expect(mockGetFAISRecords).toHaveBeenCalledTimes(1);
  });

  it('calls toast.error on API failure', async () => {
    const { toast } = await import('sonner');
    mockGetFAISRecords.mockRejectedValue(new Error('Network error'));
    renderHook(() => useFAISRecords());
    await act(async () => {});
    expect(toast.error).toHaveBeenCalledWith('Failed to load FAIS records');
  });

  it('refetch re-calls the API', async () => {
    mockGetFAISRecords.mockResolvedValue([]);
    const { result } = renderHook(() => useFAISRecords());
    await act(async () => {});
    expect(mockGetFAISRecords).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });
    expect(mockGetFAISRecords).toHaveBeenCalledTimes(2);
  });

  it('on error, records remain empty', async () => {
    mockGetFAISRecords.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useFAISRecords());
    await act(async () => {});
    expect(result.current.records).toEqual([]);
  });
});
