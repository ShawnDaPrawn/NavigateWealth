import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEnvelopes } from '../useEnvelopes';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseQuery = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const mockGetClientEnvelopes = vi.fn();
const mockGetAllEnvelopes = vi.fn();
const mockGetEnvelope = vi.fn();

vi.mock('../../api', () => ({
  esignApi: {
    getClientEnvelopes: (...args: unknown[]) => mockGetClientEnvelopes(...args),
    getAllEnvelopes: (...args: unknown[]) => mockGetAllEnvelopes(...args),
    getEnvelope: (...args: unknown[]) => mockGetEnvelope(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
  mockInvalidateQueries.mockResolvedValue(undefined);
});

// ============================================================================
// Query key selection
// ============================================================================

describe('useEnvelopes — queryKey', () => {
  it('uses allEnvelopes key when no clientId is provided', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false, error: null };
    });

    renderHook(() => useEnvelopes());

    // esignKeys.allEnvelopes() = ['esign', 'envelopes', { status: undefined }]
    expect(captured.queryKey).toEqual(['esign', 'envelopes', { status: undefined }]);
  });

  it('uses clientEnvelopes key when clientId is provided', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false, error: null };
    });

    renderHook(() => useEnvelopes({ clientId: 'client-123' }));

    // esignKeys.clientEnvelopes('client-123') = ['esign', 'client', 'client-123']
    expect(captured.queryKey).toEqual(['esign', 'client', 'client-123']);
  });
});

// ============================================================================
// enabled / autoLoad
// ============================================================================

describe('useEnvelopes — enabled', () => {
  it('is enabled by default (autoLoad=true)', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false, error: null };
    });

    renderHook(() => useEnvelopes());

    expect(captured.enabled).toBe(true);
  });

  it('is disabled when autoLoad=false', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false, error: null };
    });

    renderHook(() => useEnvelopes({ autoLoad: false }));

    expect(captured.enabled).toBe(false);
  });
});

// ============================================================================
// staleTime
// ============================================================================

describe('useEnvelopes — staleTime', () => {
  it('sets staleTime to 2 minutes', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false, error: null };
    });

    renderHook(() => useEnvelopes());

    expect(captured.staleTime).toBe(2 * 60 * 1000);
  });
});

// ============================================================================
// queryFn
// ============================================================================

describe('useEnvelopes — queryFn', () => {
  it('calls esignApi.getAllEnvelopes when no clientId', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false, error: null };
    });

    renderHook(() => useEnvelopes());

    mockGetAllEnvelopes.mockResolvedValue({ envelopes: [{ id: 'e-1' }] });
    const result = await (captured.queryFn as () => Promise<unknown>)();

    expect(mockGetAllEnvelopes).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'e-1' }]);
  });

  it('returns empty array when getAllEnvelopes returns no envelopes', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false, error: null };
    });

    renderHook(() => useEnvelopes());

    mockGetAllEnvelopes.mockResolvedValue({});
    const result = await (captured.queryFn as () => Promise<unknown>)();

    expect(result).toEqual([]);
  });

  it('calls esignApi.getClientEnvelopes with clientId and clientEmail', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false, error: null };
    });

    renderHook(() => useEnvelopes({ clientId: 'client-123', clientEmail: 'client@test.com' }));

    mockGetClientEnvelopes.mockResolvedValue({ envelopes: [{ id: 'e-2' }] });
    const result = await (captured.queryFn as () => Promise<unknown>)();

    expect(mockGetClientEnvelopes).toHaveBeenCalledWith('client-123', 'client@test.com');
    expect(result).toEqual([{ id: 'e-2' }]);
  });
});

// ============================================================================
// Return values
// ============================================================================

describe('useEnvelopes — return values', () => {
  it('returns empty envelopes array when data is undefined', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });

    const { result } = renderHook(() => useEnvelopes());

    expect(result.current.envelopes).toEqual([]);
  });

  it('returns envelopes when data is available', () => {
    const mockEnvelopes = [{ id: 'e-1', title: 'Test' }];
    mockUseQuery.mockReturnValue({ data: mockEnvelopes, isLoading: false, error: null });

    const { result } = renderHook(() => useEnvelopes());

    expect(result.current.envelopes).toBe(mockEnvelopes);
  });

  it('returns loading state from query', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });

    const { result } = renderHook(() => useEnvelopes());

    expect(result.current.loading).toBe(true);
  });

  it('returns Error message string when query errors with Error instance', () => {
    const err = new Error('Network error');
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: err });

    const { result } = renderHook(() => useEnvelopes());

    expect(result.current.error).toBe('Network error');
  });

  it('returns fallback string when query errors with non-Error', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: 'unknown' });

    const { result } = renderHook(() => useEnvelopes());

    expect(result.current.error).toBe('Failed to load envelopes');
  });

  it('returns null error when no query error', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });

    const { result } = renderHook(() => useEnvelopes());

    expect(result.current.error).toBeNull();
  });
});

// ============================================================================
// refetch
// ============================================================================

describe('useEnvelopes — refetch', () => {
  it('calls queryClient.invalidateQueries with esign envelopes key', async () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });

    const { result } = renderHook(() => useEnvelopes());

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['esign', 'envelopes'],
    });
  });
});

// ============================================================================
// getEnvelope
// ============================================================================

describe('useEnvelopes — getEnvelope', () => {
  it('calls esignApi.getEnvelope with the given id', async () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    const mockEnvelope = { id: 'e-1', title: 'Test Envelope' };
    mockGetEnvelope.mockResolvedValue(mockEnvelope);

    const { result } = renderHook(() => useEnvelopes());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.getEnvelope('e-1');
    });

    expect(mockGetEnvelope).toHaveBeenCalledWith('e-1');
    expect(returned).toBe(mockEnvelope);
  });

  it('returns null and logs error when getEnvelope throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    mockGetEnvelope.mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useEnvelopes());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.getEnvelope('missing-id');
    });

    expect(returned).toBeNull();
    consoleSpy.mockRestore();
  });
});
