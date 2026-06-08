import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProductSchema } from '../useProductSchema';

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

const mockFetchSchema = vi.fn();
const mockSaveSchema = vi.fn();

vi.mock('../../api', () => ({
  productManagementApi: {
    fetchSchema: (...args: unknown[]) => mockFetchSchema(...args),
    saveSchema: (...args: unknown[]) => mockSaveSchema(...args),
  },
}));

vi.mock('../../defaults', () => ({
  DEFAULT_SCHEMAS: [
    {
      categoryId: 'life_insurance' as never,
      fields: [{ id: 'f1', label: 'Field 1' }],
    },
  ],
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
  mockInvalidateQueries.mockResolvedValue(undefined);
});

// ============================================================================
// Query
// ============================================================================

describe('useProductSchema — query', () => {
  it('passes correct queryKey with selectedCategory', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => useProductSchema('life_insurance' as never));

    expect(captured.queryKey).toEqual(['product-management', 'schemas', 'life_insurance' as never]);
  });

  it('sets enabled=true when selectedCategory is non-empty', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => useProductSchema('life_insurance' as never));

    expect(captured.enabled).toBe(true);
  });

  it('sets enabled=false when selectedCategory is empty', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => useProductSchema(''));

    expect(captured.enabled).toBe(false);
  });

  it('staleTime is 5 minutes', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => useProductSchema('life_insurance' as never));

    expect(captured.staleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn returns schema from API when fetch succeeds', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => useProductSchema('life_insurance' as never));

    const mockSchema = { fields: [{ id: 'f1', label: 'Field 1' }] };
    mockFetchSchema.mockResolvedValue(mockSchema);
    const result = await (captured.queryFn as () => Promise<unknown>)();

    expect(result).toBe(mockSchema);
    expect(mockFetchSchema).toHaveBeenCalledWith('life_insurance' as never);
  });

  it('queryFn returns null when selectedCategory is empty', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => useProductSchema(''));

    const result = await (captured.queryFn as () => Promise<unknown>)();

    expect(result).toBeNull();
  });

  it('queryFn falls back to DEFAULT_SCHEMAS when fetch throws', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => useProductSchema('life_insurance' as never));

    mockFetchSchema.mockRejectedValue(new Error('network error'));
    const result = await (captured.queryFn as () => Promise<unknown>)();

    expect(result).toEqual({ fields: [{ id: 'f1', label: 'Field 1' }] });
  });

  it('queryFn returns empty fields when category not in DEFAULT_SCHEMAS', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => useProductSchema('unknown_category' as never));

    mockFetchSchema.mockRejectedValue(new Error('not found'));
    const result = await (captured.queryFn as () => Promise<unknown>)();

    expect(result).toEqual({ fields: [] });
  });
});

// ============================================================================
// Local state — currentFields and hasUnsavedChanges
// ============================================================================

describe('useProductSchema — local state', () => {
  it('starts with empty fields and no unsaved changes', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useProductSchema(''));

    expect(result.current.currentFields).toEqual([]);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('syncs currentFields from serverSchema when data arrives', () => {
    const fields = [{ id: 'f1', label: 'Field 1' }];
    mockUseQuery.mockReturnValue({ data: { fields }, isLoading: false });

    const { result } = renderHook(() => useProductSchema('life_insurance' as never));

    expect(result.current.currentFields).toEqual(fields);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('updateFields sets currentFields and marks unsaved changes', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useProductSchema('life_insurance' as never));

    const newFields = [{ id: 'f2', label: 'Field 2' }];
    act(() => {
      result.current.updateFields(newFields as never);
    });

    expect(result.current.currentFields).toEqual(newFields);
    expect(result.current.hasUnsavedChanges).toBe(true);
  });
});

// ============================================================================
// saveSchema
// ============================================================================

describe('useProductSchema — saveSchema', () => {
  it('returns false immediately when selectedCategory is empty', async () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useProductSchema(''));

    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.saveSchema();
    });

    expect(returnValue).toBe(false);
    expect(mockSaveSchema).not.toHaveBeenCalled();
  });

  it('calls saveSchema API with correct payload on success', async () => {
    const fields = [{ id: 'f1', label: 'Field 1' }];
    mockUseQuery.mockReturnValue({ data: { fields }, isLoading: false });
    mockSaveSchema.mockResolvedValue(undefined);

    const { result } = renderHook(() => useProductSchema('life_insurance' as never));

    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.saveSchema();
    });

    expect(mockSaveSchema).toHaveBeenCalledWith({
      categoryId: 'life_insurance' as never,
      fields,
    });
    expect(returnValue).toBe(true);
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it('returns false and shows error toast when saveSchema API fails', async () => {
    const { toast } = await import('sonner');
    mockUseQuery.mockReturnValue({ data: { fields: [] }, isLoading: false });
    mockSaveSchema.mockRejectedValue(new Error('save failed'));

    const { result } = renderHook(() => useProductSchema('life_insurance' as never));

    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.saveSchema();
    });

    expect(returnValue).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('save failed', expect.anything());
  });
});

// ============================================================================
// reloadSchema
// ============================================================================

describe('useProductSchema — reloadSchema', () => {
  it('invalidates schema query when category is set', async () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useProductSchema('life_insurance' as never));

    await act(async () => {
      await result.current.reloadSchema();
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product-management', 'schemas', 'life_insurance' as never],
    });
  });

  it('does not invalidate when category is empty', async () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useProductSchema(''));

    await act(async () => {
      await result.current.reloadSchema();
    });

    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });
});
