import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCustomTemplates } from '../useCustomTemplates';

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

const mockGetAllCustomTemplates = vi.fn();
const mockCreateCustomTemplate = vi.fn();
const mockUpdateCustomTemplate = vi.fn();
const mockDeleteCustomTemplate = vi.fn();

vi.mock('../../api', () => ({
  socialMediaAIApi: {
    getAllCustomTemplates: (...args: unknown[]) => mockGetAllCustomTemplates(...args),
    createCustomTemplate: (...args: unknown[]) => mockCreateCustomTemplate(...args),
    updateCustomTemplate: (...args: unknown[]) => mockUpdateCustomTemplate(...args),
    deleteCustomTemplate: (...args: unknown[]) => mockDeleteCustomTemplate(...args),
  },
}));

const defaultMutationReturn = {
  mutateAsync: vi.fn(),
  isPending: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
  mockUseMutation.mockReturnValue({ ...defaultMutationReturn });
});

// ============================================================================
// templatesQuery
// ============================================================================

describe('useCustomTemplates — query', () => {
  it('passes correct queryKey', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => useCustomTemplates());

    // socialMediaKeys.ai.templates() from queryKeys.ts
    expect(captured.queryKey).toEqual(expect.arrayContaining(['social-media']));
  });

  it('queryFn calls socialMediaAIApi.getAllCustomTemplates', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => useCustomTemplates());

    mockGetAllCustomTemplates.mockResolvedValue({ data: [], success: true });
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockGetAllCustomTemplates).toHaveBeenCalled();
  });

  it('staleTime is 60 seconds', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => useCustomTemplates());

    expect(captured.staleTime).toBe(60 * 1000);
  });

  it('returns empty templates array when data is undefined', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useCustomTemplates());

    expect(result.current.templates).toEqual([]);
  });

  it('returns templates from data.data when available', () => {
    const mockTemplates = [{ id: 't-1', name: 'Template 1' }];
    mockUseQuery.mockReturnValue({ data: { data: mockTemplates }, isLoading: false });

    const { result } = renderHook(() => useCustomTemplates());

    expect(result.current.templates).toBe(mockTemplates);
  });

  it('exposes templatesLoading from query isLoading', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });

    const { result } = renderHook(() => useCustomTemplates());

    expect(result.current.templatesLoading).toBe(true);
  });
});

// ============================================================================
// createMutation
// ============================================================================

describe('useCustomTemplates — createMutation', () => {
  it('mutationFn calls socialMediaAIApi.createCustomTemplate with input', async () => {
    const mutations: Array<Record<string, unknown>> = [];
    mockUseMutation.mockImplementation((opts: Record<string, unknown>) => {
      mutations.push(opts);
      return { mutateAsync: vi.fn(), isPending: false };
    });

    renderHook(() => useCustomTemplates());

    const createOpts = mutations[0];
    const input = { name: 'New Template', content: 'Hello' };
    mockCreateCustomTemplate.mockResolvedValue({ success: true });
    await (createOpts.mutationFn as (input: unknown) => Promise<unknown>)(input);

    expect(mockCreateCustomTemplate).toHaveBeenCalledWith(input);
  });

  it('onSuccess with success=true shows toast and invalidates', async () => {
    const { toast } = await import('sonner');
    const mutations: Array<Record<string, unknown>> = [];
    mockUseMutation.mockImplementation((opts: Record<string, unknown>) => {
      mutations.push(opts);
      return { mutateAsync: vi.fn(), isPending: false };
    });

    renderHook(() => useCustomTemplates());

    const createOpts = mutations[0];
    (createOpts.onSuccess as (res: { success: boolean }) => void)({ success: true });

    expect(toast.success).toHaveBeenCalledWith('Custom template created');
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it('onSuccess with success=false shows toast.error', async () => {
    const { toast } = await import('sonner');
    const mutations: Array<Record<string, unknown>> = [];
    mockUseMutation.mockImplementation((opts: Record<string, unknown>) => {
      mutations.push(opts);
      return { mutateAsync: vi.fn(), isPending: false };
    });

    renderHook(() => useCustomTemplates());

    const createOpts = mutations[0];
    (createOpts.onSuccess as (res: { success: boolean; error?: string }) => void)({
      success: false,
      error: 'Duplicate name',
    });

    expect(toast.error).toHaveBeenCalledWith('Duplicate name');
  });

  it('onError shows toast.error with error message', async () => {
    const { toast } = await import('sonner');
    const mutations: Array<Record<string, unknown>> = [];
    mockUseMutation.mockImplementation((opts: Record<string, unknown>) => {
      mutations.push(opts);
      return { mutateAsync: vi.fn(), isPending: false };
    });

    renderHook(() => useCustomTemplates());

    const createOpts = mutations[0];
    (createOpts.onError as (error: Error) => void)(new Error('API error'));

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('API error'));
  });
});

// ============================================================================
// updateMutation
// ============================================================================

describe('useCustomTemplates — updateMutation', () => {
  it('mutationFn calls socialMediaAIApi.updateCustomTemplate with id and updates', async () => {
    const mutations: Array<Record<string, unknown>> = [];
    mockUseMutation.mockImplementation((opts: Record<string, unknown>) => {
      mutations.push(opts);
      return { mutateAsync: vi.fn(), isPending: false };
    });

    renderHook(() => useCustomTemplates());

    const updateOpts = mutations[1];
    const args = { id: 't-1', updates: { name: 'Updated' } };
    mockUpdateCustomTemplate.mockResolvedValue({ success: true });
    await (updateOpts.mutationFn as (args: unknown) => Promise<unknown>)(args);

    expect(mockUpdateCustomTemplate).toHaveBeenCalledWith('t-1', { name: 'Updated' });
  });

  it('onSuccess with success=true shows toast and invalidates', async () => {
    const { toast } = await import('sonner');
    const mutations: Array<Record<string, unknown>> = [];
    mockUseMutation.mockImplementation((opts: Record<string, unknown>) => {
      mutations.push(opts);
      return { mutateAsync: vi.fn(), isPending: false };
    });

    renderHook(() => useCustomTemplates());

    const updateOpts = mutations[1];
    (updateOpts.onSuccess as (res: { success: boolean }) => void)({ success: true });

    expect(toast.success).toHaveBeenCalledWith('Template updated');
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });
});

// ============================================================================
// deleteMutation
// ============================================================================

describe('useCustomTemplates — deleteMutation', () => {
  it('mutationFn calls socialMediaAIApi.deleteCustomTemplate with id', async () => {
    const mutations: Array<Record<string, unknown>> = [];
    mockUseMutation.mockImplementation((opts: Record<string, unknown>) => {
      mutations.push(opts);
      return { mutateAsync: vi.fn(), isPending: false };
    });

    renderHook(() => useCustomTemplates());

    const deleteOpts = mutations[2];
    mockDeleteCustomTemplate.mockResolvedValue({ success: true });
    await (deleteOpts.mutationFn as (id: string) => Promise<unknown>)('t-1');

    expect(mockDeleteCustomTemplate).toHaveBeenCalledWith('t-1');
  });

  it('onSuccess with success=true shows toast and invalidates', async () => {
    const { toast } = await import('sonner');
    const mutations: Array<Record<string, unknown>> = [];
    mockUseMutation.mockImplementation((opts: Record<string, unknown>) => {
      mutations.push(opts);
      return { mutateAsync: vi.fn(), isPending: false };
    });

    renderHook(() => useCustomTemplates());

    const deleteOpts = mutations[2];
    (deleteOpts.onSuccess as (res: { success: boolean }) => void)({ success: true });

    expect(toast.success).toHaveBeenCalledWith('Template deleted');
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it('onError shows toast.error for deletion failure', async () => {
    const { toast } = await import('sonner');
    const mutations: Array<Record<string, unknown>> = [];
    mockUseMutation.mockImplementation((opts: Record<string, unknown>) => {
      mutations.push(opts);
      return { mutateAsync: vi.fn(), isPending: false };
    });

    renderHook(() => useCustomTemplates());

    const deleteOpts = mutations[2];
    (deleteOpts.onError as (error: Error) => void)(new Error('delete failed'));

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('delete failed'));
  });
});
