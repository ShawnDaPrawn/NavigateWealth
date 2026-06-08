import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useClientKeys, useRecalculateClientKeys, useClientKeyHistory } from '../useClientKeys';

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

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockGetClientKeys = vi.fn();
const mockRecalculateClientKeys = vi.fn();
const mockGetClientKeyHistory = vi.fn();

vi.mock('../../api', () => ({
  getClientKeys: (...args: unknown[]) => mockGetClientKeys(...args),
  recalculateClientKeys: (...args: unknown[]) => mockRecalculateClientKeys(...args),
  getClientKeyHistory: (...args: unknown[]) => mockGetClientKeyHistory(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue({});
  mockUseMutation.mockReturnValue({});
});

// ============================================================================
// useClientKeys
// ============================================================================

describe('useClientKeys', () => {
  it('passes correct queryKey with clientId', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClientKeys('client-123'));

    expect(captured.queryKey).toEqual(['client-keys', 'client-123']);
  });

  it('queryFn calls api.getClientKeys with clientId', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClientKeys('client-123'));

    mockGetClientKeys.mockResolvedValue({ keys: [], lastCalculated: '', totalCategories: 0 });
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockGetClientKeys).toHaveBeenCalledWith('client-123');
  });

  it('sets staleTime to 5 minutes', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClientKeys('client-123'));

    expect(captured.staleTime).toBe(5 * 60 * 1000);
  });

  it('sets enabled=true when clientId is non-empty', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClientKeys('client-123'));

    expect(captured.enabled).toBe(true);
  });

  it('sets enabled=false when clientId is empty', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClientKeys(''));

    expect(captured.enabled).toBe(false);
  });
});

// ============================================================================
// useRecalculateClientKeys
// ============================================================================

describe('useRecalculateClientKeys', () => {
  it('mutationFn calls api.recalculateClientKeys with clientId', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useRecalculateClientKeys());

    mockRecalculateClientKeys.mockResolvedValue({ keys: [] });
    await (captured.mutationFn as (id: string) => Promise<unknown>)('client-123');

    expect(mockRecalculateClientKeys).toHaveBeenCalledWith('client-123');
  });

  it('onSuccess invalidates client keys query for the given clientId', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useRecalculateClientKeys());

    (captured.onSuccess as (data: unknown, clientId: string) => void)(null, 'client-123');

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['client-keys', 'client-123'],
    });
  });

  it('onSuccess shows success toast', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useRecalculateClientKeys());

    (captured.onSuccess as (data: unknown, clientId: string) => void)(null, 'client-123');

    expect(toast.success).toHaveBeenCalledWith('Keys recalculated successfully', expect.anything());
  });

  it('onError shows error toast with error message', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useRecalculateClientKeys());

    const err = new Error('recalc failed');
    (captured.onError as (error: Error) => void)(err);

    expect(toast.error).toHaveBeenCalledWith('Recalculation failed', expect.anything());
  });
});

// ============================================================================
// useClientKeyHistory
// ============================================================================

describe('useClientKeyHistory', () => {
  it('passes correct queryKey with clientId and keyId', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClientKeyHistory('client-123', 'key-abc'));

    expect(captured.queryKey).toEqual(['client-key-history', 'client-123', 'key-abc']);
  });

  it('queryFn calls api.getClientKeyHistory with clientId and keyId', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClientKeyHistory('client-123', 'key-abc'));

    mockGetClientKeyHistory.mockResolvedValue([]);
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockGetClientKeyHistory).toHaveBeenCalledWith('client-123', 'key-abc');
  });

  it('sets staleTime to 10 minutes', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClientKeyHistory('client-123', 'key-abc'));

    expect(captured.staleTime).toBe(10 * 60 * 1000);
  });

  it('sets enabled=true when both clientId and keyId are non-empty', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClientKeyHistory('client-123', 'key-abc'));

    expect(captured.enabled).toBe(true);
  });

  it('sets enabled=false when clientId is empty', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClientKeyHistory('', 'key-abc'));

    expect(captured.enabled).toBe(false);
  });

  it('sets enabled=false when keyId is empty', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useClientKeyHistory('client-123', ''));

    expect(captured.enabled).toBe(false);
  });
});
