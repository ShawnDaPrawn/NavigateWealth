/**
 * Tests for useStatutoryRecords
 * Navigate Wealth Admin Dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStatutoryRecords } from '../useStatutoryRecords';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockGetStatutoryRecords = vi.fn();

vi.mock('../../api', () => ({
  complianceApi: {
    getStatutoryRecords: (...args: unknown[]) => mockGetStatutoryRecords(...args),
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

describe('useStatutoryRecords', () => {
  it('initial loading is true', () => {
    mockGetStatutoryRecords.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useStatutoryRecords());
    expect(result.current.loading).toBe(true);
  });

  it('sets records to data returned by API on success', async () => {
    const mockData = [{ id: '1', returnType: 'annual', status: 'submitted' }];
    mockGetStatutoryRecords.mockResolvedValue(mockData);
    const { result } = renderHook(() => useStatutoryRecords());
    await act(async () => {});
    expect(result.current.records).toEqual(mockData);
  });

  it('sets loading to false after fetch', async () => {
    mockGetStatutoryRecords.mockResolvedValue([]);
    const { result } = renderHook(() => useStatutoryRecords());
    await act(async () => {});
    expect(result.current.loading).toBe(false);
  });

  it('calls getStatutoryRecords on mount', async () => {
    mockGetStatutoryRecords.mockResolvedValue([]);
    renderHook(() => useStatutoryRecords());
    await act(async () => {});
    expect(mockGetStatutoryRecords).toHaveBeenCalledTimes(1);
  });

  it('calls toast.error on API failure', async () => {
    const { toast } = await import('sonner');
    mockGetStatutoryRecords.mockRejectedValue(new Error('Network error'));
    renderHook(() => useStatutoryRecords());
    await act(async () => {});
    expect(toast.error).toHaveBeenCalledWith('Failed to load statutory records');
  });

  it('refetch re-calls the API', async () => {
    mockGetStatutoryRecords.mockResolvedValue([]);
    const { result } = renderHook(() => useStatutoryRecords());
    await act(async () => {});
    expect(mockGetStatutoryRecords).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });
    expect(mockGetStatutoryRecords).toHaveBeenCalledTimes(2);
  });

  it('on error, records remain empty', async () => {
    mockGetStatutoryRecords.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useStatutoryRecords());
    await act(async () => {});
    expect(result.current.records).toEqual([]);
  });
});
