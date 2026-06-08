/**
 * Tests for useDocumentsInsuranceRecords
 * Navigate Wealth Admin Dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocumentsInsuranceRecords } from '../useDocumentsInsuranceRecords';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockGetDocumentsInsuranceRecords = vi.fn();

vi.mock('../../api', () => ({
  complianceApi: {
    getDocumentsInsuranceRecords: (...args: unknown[]) => mockGetDocumentsInsuranceRecords(...args),
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

describe('useDocumentsInsuranceRecords', () => {
  it('initial loading is true', () => {
    mockGetDocumentsInsuranceRecords.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDocumentsInsuranceRecords());
    expect(result.current.loading).toBe(true);
  });

  it('sets records to data returned by API on success', async () => {
    const mockData = [{ id: '1', documentType: 'PI Insurance', status: 'active' }];
    mockGetDocumentsInsuranceRecords.mockResolvedValue(mockData);
    const { result } = renderHook(() => useDocumentsInsuranceRecords());
    await act(async () => {});
    expect(result.current.records).toEqual(mockData);
  });

  it('sets loading to false after fetch', async () => {
    mockGetDocumentsInsuranceRecords.mockResolvedValue([]);
    const { result } = renderHook(() => useDocumentsInsuranceRecords());
    await act(async () => {});
    expect(result.current.loading).toBe(false);
  });

  it('calls getDocumentsInsuranceRecords on mount', async () => {
    mockGetDocumentsInsuranceRecords.mockResolvedValue([]);
    renderHook(() => useDocumentsInsuranceRecords());
    await act(async () => {});
    expect(mockGetDocumentsInsuranceRecords).toHaveBeenCalledTimes(1);
  });

  it('calls toast.error on API failure', async () => {
    const { toast } = await import('sonner');
    mockGetDocumentsInsuranceRecords.mockRejectedValue(new Error('Network error'));
    renderHook(() => useDocumentsInsuranceRecords());
    await act(async () => {});
    expect(toast.error).toHaveBeenCalledWith('Failed to load documents & insurance records');
  });

  it('refetch re-calls the API', async () => {
    mockGetDocumentsInsuranceRecords.mockResolvedValue([]);
    const { result } = renderHook(() => useDocumentsInsuranceRecords());
    await act(async () => {});
    expect(mockGetDocumentsInsuranceRecords).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });
    expect(mockGetDocumentsInsuranceRecords).toHaveBeenCalledTimes(2);
  });

  it('on error, records remain empty', async () => {
    mockGetDocumentsInsuranceRecords.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useDocumentsInsuranceRecords());
    await act(async () => {});
    expect(result.current.records).toEqual([]);
  });
});
