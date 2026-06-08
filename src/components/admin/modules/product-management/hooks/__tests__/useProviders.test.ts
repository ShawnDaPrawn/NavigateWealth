import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProviders } from '../useProviders';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseQuery = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
  },
}));

const mockFetchProviders = vi.fn();
const mockCreateProvider = vi.fn();
const mockUpdateProvider = vi.fn();
const mockDeleteProvider = vi.fn();

vi.mock('../../api', () => ({
  productManagementApi: {
    fetchProviders: (...args: unknown[]) => mockFetchProviders(...args),
    createProvider: (...args: unknown[]) => mockCreateProvider(...args),
    updateProvider: (...args: unknown[]) => mockUpdateProvider(...args),
    deleteProvider: (...args: unknown[]) => mockDeleteProvider(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
});

// ============================================================================
// Query behaviour
// ============================================================================

describe('useProviders — query', () => {
  it('passes correct queryKey for providers', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false, error: null };
    });

    renderHook(() => useProviders());

    expect(captured.queryKey).toEqual(['product-management', 'providers']);
  });

  it('queryFn calls productManagementApi.fetchProviders', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false, error: null };
    });

    renderHook(() => useProviders());

    mockFetchProviders.mockResolvedValue([]);
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockFetchProviders).toHaveBeenCalled();
  });

  it('staleTime is 5 minutes', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false, error: null };
    });

    renderHook(() => useProviders());

    expect(captured.staleTime).toBe(5 * 60 * 1000);
  });

  it('defaults providers to empty array when data is undefined', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });

    const { result } = renderHook(() => useProviders());

    expect(result.current.providers).toEqual([]);
  });

  it('returns providers when data is available', () => {
    const mockProviders = [{ id: 'p-1', name: 'ProviderA' }];
    mockUseQuery.mockReturnValue({ data: mockProviders, isLoading: false, error: null });

    const { result } = renderHook(() => useProviders());

    expect(result.current.providers).toBe(mockProviders);
  });

  it('exposes isLoading and error from query', () => {
    const mockError = new Error('fetch failed');
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: mockError });

    const { result } = renderHook(() => useProviders());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(mockError);
  });
});

// ============================================================================
// addProvider
// ============================================================================

describe('useProviders — addProvider', () => {
  it('throws when a provider with the same name already exists (case-insensitive)', async () => {
    mockUseQuery.mockReturnValue({
      data: [{ id: 'p-1', name: 'Acme' }],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useProviders());

    await expect(result.current.addProvider({ name: 'acme' } as never)).rejects.toThrow(
      'Provider "acme" already exists.',
    );
  });

  it('calls createProvider and invalidates on success', async () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    const newProvider = { id: 'p-2', name: 'NewCo' };
    mockCreateProvider.mockResolvedValue(newProvider);
    mockInvalidateQueries.mockResolvedValue(undefined);

    const { result } = renderHook(() => useProviders());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.addProvider({ name: 'NewCo' } as never);
    });

    expect(mockCreateProvider).toHaveBeenCalledWith({ name: 'NewCo' });
    expect(mockInvalidateQueries).toHaveBeenCalled();
    expect(returned).toBe(newProvider);
  });

  it('shows error toast and rethrows when createProvider fails', async () => {
    const { toast } = await import('sonner');
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    const err = new Error('network error');
    mockCreateProvider.mockRejectedValue(err);

    const { result } = renderHook(() => useProviders());

    await expect(
      act(async () => {
        await result.current.addProvider({ name: 'X' } as never);
      }),
    ).rejects.toThrow('network error');

    expect(toast.error).toHaveBeenCalledWith('network error', expect.anything());
  });
});

// ============================================================================
// updateProvider
// ============================================================================

describe('useProviders — updateProvider', () => {
  it('throws when another provider already has the same name', async () => {
    mockUseQuery.mockReturnValue({
      data: [
        { id: 'p-1', name: 'Acme' },
        { id: 'p-2', name: 'BetaCo' },
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useProviders());

    await expect(result.current.updateProvider('p-1', { name: 'BetaCo' } as never)).rejects.toThrow(
      'Another provider is already named "BetaCo".',
    );
  });

  it('calls updateProvider API and invalidates on success', async () => {
    mockUseQuery.mockReturnValue({
      data: [{ id: 'p-1', name: 'Acme' }],
      isLoading: false,
      error: null,
    });
    mockUpdateProvider.mockResolvedValue(undefined);
    mockInvalidateQueries.mockResolvedValue(undefined);

    const { result } = renderHook(() => useProviders());

    await act(async () => {
      await result.current.updateProvider('p-1', { name: 'Acme Updated' } as never);
    });

    expect(mockUpdateProvider).toHaveBeenCalledWith('p-1', { name: 'Acme Updated' });
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });
});

// ============================================================================
// deleteProvider
// ============================================================================

describe('useProviders — deleteProvider', () => {
  it('calls deleteProvider API and invalidates on success', async () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    mockDeleteProvider.mockResolvedValue(undefined);
    mockInvalidateQueries.mockResolvedValue(undefined);

    const { result } = renderHook(() => useProviders());

    await act(async () => {
      await result.current.deleteProvider('p-1');
    });

    expect(mockDeleteProvider).toHaveBeenCalledWith('p-1');
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it('shows error toast and rethrows when deleteProvider fails', async () => {
    const { toast } = await import('sonner');
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    mockDeleteProvider.mockRejectedValue(new Error('delete failed'));

    const { result } = renderHook(() => useProviders());

    await expect(
      act(async () => {
        await result.current.deleteProvider('p-1');
      }),
    ).rejects.toThrow('delete failed');

    expect(toast.error).toHaveBeenCalledWith('delete failed', expect.anything());
  });
});
