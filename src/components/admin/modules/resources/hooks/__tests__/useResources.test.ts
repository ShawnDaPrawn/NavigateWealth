import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResources } from '../useResources';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockInvalidateQueries = vi.fn();
const mockQueryClient = { invalidateQueries: mockInvalidateQueries };

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => mockQueryClient,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockResourcesApiGetAll = vi.fn();
const mockResourcesApiCreate = vi.fn();
const mockResourcesApiUpdate = vi.fn();
const mockResourcesApiDelete = vi.fn();
const mockResourcesApiDuplicate = vi.fn();

vi.mock('../../api', () => ({
  resourcesApi: {
    getAll: (...args: unknown[]) => mockResourcesApiGetAll(...args),
    create: (...args: unknown[]) => mockResourcesApiCreate(...args),
    update: (...args: unknown[]) => mockResourcesApiUpdate(...args),
    delete: (...args: unknown[]) => mockResourcesApiDelete(...args),
    duplicate: (...args: unknown[]) => mockResourcesApiDuplicate(...args),
  },
}));

vi.mock('../queryKeys', () => ({
  resourceKeys: {
    all: ['resources'],
    lists: () => ['resources', 'list'],
    detail: (id: string) => ['resources', 'detail', id],
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** A minimal transformed FormDefinition */
const MOCK_FORM = {
  id: 'res-001',
  name: 'Application Form',
  category: 'Forms',
  description: 'A standard application',
  version: '1.0',
  lastUpdated: '1/1/2025',
  downloads: 0,
  size: 'Dynamic',
  isPopular: false,
  fields: [],
  clientTypes: ['Universal'],
  renderer: 'dynamic',
  blocks: [],
  letterMeta: undefined,
  status: 'draft',
};

const MOCK_LEGAL_FORM = {
  ...MOCK_FORM,
  id: 'res-002',
  name: 'Legal Agreement',
  category: 'Legal',
  description: 'A legal contract document',
  clientTypes: ['Institutional'],
  status: 'published',
};

function makeQueryResult(data: unknown = [], loading = false, error: Error | null = null) {
  return {
    data,
    isLoading: loading,
    isError: error !== null,
    error,
    isFetching: false,
  };
}

function makeMutationResult(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    reset: vi.fn(),
    ...overrides,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue(makeQueryResult([MOCK_FORM, MOCK_LEGAL_FORM]));
  mockUseMutation.mockReturnValue(makeMutationResult());
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useResources', () => {
  describe('initialization', () => {
    it('returns forms from query result', () => {
      const { result } = renderHook(() => useResources());
      expect(result.current.forms).toEqual([MOCK_FORM, MOCK_LEGAL_FORM]);
    });

    it('returns empty forms when query has no data', () => {
      mockUseQuery.mockReturnValue(makeQueryResult([]));
      const { result } = renderHook(() => useResources());
      expect(result.current.forms).toEqual([]);
    });

    it('reflects loading state from query', () => {
      mockUseQuery.mockReturnValue(makeQueryResult([], true));
      const { result } = renderHook(() => useResources());
      expect(result.current.loading).toBe(true);
    });

    it('returns null error when query succeeds', () => {
      const { result } = renderHook(() => useResources());
      expect(result.current.error).toBeNull();
    });

    it('returns error message when query fails with Error instance', () => {
      mockUseQuery.mockReturnValue(makeQueryResult([], false, new Error('Network error')));
      const { result } = renderHook(() => useResources());
      expect(result.current.error).toBe('Network error');
    });

    it('returns fallback error message when query error is not an Error instance', () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        isError: true,
        error: 'string error',
        isFetching: false,
      });
      const { result } = renderHook(() => useResources());
      expect(result.current.error).toBe('Failed to fetch resources');
    });

    it('initializes with default filters', () => {
      const { result } = renderHook(() => useResources());
      expect(result.current.filters).toEqual({
        search: '',
        category: 'Forms',
        clientType: 'all',
        sortBy: 'name',
        sortDirection: 'asc',
        status: 'all',
      });
    });
  });

  describe('categories (derived state)', () => {
    it('includes standard categories', () => {
      const { result } = renderHook(() => useResources());
      expect(result.current.categories).toContain('Forms');
      expect(result.current.categories).toContain('Legal');
      expect(result.current.categories).toContain('Requests');
      expect(result.current.categories).toContain('Letters');
    });

    it('standard categories come before additional ones', () => {
      mockUseQuery.mockReturnValue(
        makeQueryResult([
          { ...MOCK_FORM, category: 'Custom' },
          { ...MOCK_FORM, id: 'x', category: 'Forms' },
        ]),
      );
      const { result } = renderHook(() => useResources());
      const idx = (c: string) => result.current.categories.indexOf(c);
      expect(idx('Forms')).toBeLessThan(idx('Custom'));
    });

    it('deduplicates categories from data', () => {
      mockUseQuery.mockReturnValue(
        makeQueryResult([
          { ...MOCK_FORM, id: 'a', category: 'Forms' },
          { ...MOCK_FORM, id: 'b', category: 'Forms' },
        ]),
      );
      const { result } = renderHook(() => useResources());
      const formsCount = result.current.categories.filter((c) => c === 'Forms').length;
      expect(formsCount).toBe(1);
    });
  });

  describe('clientTypes (derived state)', () => {
    it('returns unique client types from all forms', () => {
      const { result } = renderHook(() => useResources());
      expect(result.current.clientTypes).toContain('Universal');
      expect(result.current.clientTypes).toContain('Institutional');
    });

    it('deduplicates client types', () => {
      mockUseQuery.mockReturnValue(
        makeQueryResult([
          { ...MOCK_FORM, id: 'a', clientTypes: ['Universal'] },
          { ...MOCK_FORM, id: 'b', clientTypes: ['Universal'] },
        ]),
      );
      const { result } = renderHook(() => useResources());
      const universalCount = result.current.clientTypes.filter((t) => t === 'Universal').length;
      expect(universalCount).toBe(1);
    });
  });

  describe('filteredForms (derived state)', () => {
    it('returns all forms when no filters are applied (category=all)', () => {
      mockUseQuery.mockReturnValue(makeQueryResult([MOCK_FORM, MOCK_LEGAL_FORM]));
      const { result } = renderHook(() => useResources());
      act(() => {
        result.current.updateFilters({ category: 'all' });
      });
      expect(result.current.filteredForms).toHaveLength(2);
    });

    it('filters by category', () => {
      const { result } = renderHook(() => useResources());
      act(() => {
        result.current.updateFilters({ category: 'Legal' });
      });
      expect(result.current.filteredForms).toHaveLength(1);
      expect(result.current.filteredForms[0].id).toBe('res-002');
    });

    it('filters by search matching name', () => {
      const { result } = renderHook(() => useResources());
      act(() => {
        result.current.updateFilters({ category: 'all', search: 'application' });
      });
      expect(result.current.filteredForms).toHaveLength(1);
      expect(result.current.filteredForms[0].id).toBe('res-001');
    });

    it('filters by search matching description', () => {
      const { result } = renderHook(() => useResources());
      act(() => {
        result.current.updateFilters({ category: 'all', search: 'standard' });
      });
      expect(result.current.filteredForms).toHaveLength(1);
    });

    it('filters by clientType', () => {
      const { result } = renderHook(() => useResources());
      act(() => {
        result.current.updateFilters({ category: 'all', clientType: 'Institutional' });
      });
      expect(result.current.filteredForms).toHaveLength(1);
      expect(result.current.filteredForms[0].id).toBe('res-002');
    });

    it('filters by status', () => {
      const { result } = renderHook(() => useResources());
      act(() => {
        result.current.updateFilters({ category: 'all', status: 'published' });
      });
      expect(result.current.filteredForms).toHaveLength(1);
      expect(result.current.filteredForms[0].id).toBe('res-002');
    });

    it('sorts by name ascending', () => {
      const { result } = renderHook(() => useResources());
      act(() => {
        result.current.updateFilters({ category: 'all', sortBy: 'name', sortDirection: 'asc' });
      });
      const names = result.current.filteredForms.map((f) => f.name);
      expect(names).toEqual([...names].sort());
    });

    it('sorts by name descending', () => {
      const { result } = renderHook(() => useResources());
      act(() => {
        result.current.updateFilters({ category: 'all', sortBy: 'name', sortDirection: 'desc' });
      });
      const names = result.current.filteredForms.map((f) => f.name);
      expect(names).toEqual([...names].sort().reverse());
    });

    it('returns empty array when search matches nothing', () => {
      const { result } = renderHook(() => useResources());
      act(() => {
        result.current.updateFilters({ category: 'all', search: 'xyznonexistent' });
      });
      expect(result.current.filteredForms).toHaveLength(0);
    });
  });

  describe('updateFilters', () => {
    it('merges partial filters', () => {
      const { result } = renderHook(() => useResources());
      act(() => {
        result.current.updateFilters({ search: 'hello' });
      });
      expect(result.current.filters.search).toBe('hello');
      // Other defaults remain
      expect(result.current.filters.category).toBe('Forms');
    });

    it('supports updating multiple filters at once', () => {
      const { result } = renderHook(() => useResources());
      act(() => {
        result.current.updateFilters({ search: 'test', status: 'published' });
      });
      expect(result.current.filters.search).toBe('test');
      expect(result.current.filters.status).toBe('published');
    });
  });

  describe('resetFilters', () => {
    it('resets filters to defaults', () => {
      const { result } = renderHook(() => useResources());
      act(() => {
        result.current.updateFilters({ search: 'changed', status: 'published', category: 'Legal' });
      });
      act(() => {
        result.current.resetFilters();
      });
      expect(result.current.filters).toEqual({
        search: '',
        category: 'Forms',
        clientType: 'all',
        sortBy: 'name',
        sortDirection: 'asc',
        status: 'all',
      });
    });
  });

  describe('refresh', () => {
    it('calls queryClient.invalidateQueries', async () => {
      const { result } = renderHook(() => useResources());
      await act(async () => {
        await result.current.refresh();
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['resources', 'list'],
      });
    });
  });

  describe('queryFn extraction', () => {
    it('queryFn maps API response to FormDefinitions', async () => {
      const rawResource = {
        id: 'r-1',
        title: 'Test Form',
        category: 'Forms',
        description: 'A test',
        version: '2.0',
        createdAt: '2025-06-01T00:00:00Z',
        clientTypes: ['Universal'],
        blocks: [],
        status: 'draft',
      };
      mockResourcesApiGetAll.mockResolvedValue([rawResource]);
      const capturedConfig = vi.fn();
      mockUseQuery.mockImplementation((config) => {
        capturedConfig(config);
        return makeQueryResult([MOCK_FORM]);
      });
      renderHook(() => useResources());
      const config = capturedConfig.mock.calls[0][0];
      const data = await config.queryFn();
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].id).toBe('r-1');
      expect(data[0].name).toBe('Test Form');
    });

    it('queryFn returns empty array when API returns empty', async () => {
      mockResourcesApiGetAll.mockResolvedValue([]);
      const capturedConfig = vi.fn();
      mockUseQuery.mockImplementation((config) => {
        capturedConfig(config);
        return makeQueryResult([]);
      });
      renderHook(() => useResources());
      const config = capturedConfig.mock.calls[0][0];
      const data = await config.queryFn();
      expect(data).toEqual([]);
    });

    it('queryFn sets renderer to "letter" for Letters category', async () => {
      const letterResource = {
        id: 'l-1',
        title: 'Welcome Letter',
        category: 'Letters',
        createdAt: '2025-01-01T00:00:00Z',
        clientTypes: ['Universal'],
        blocks: [],
        status: 'published',
      };
      mockResourcesApiGetAll.mockResolvedValue([letterResource]);
      const capturedConfig = vi.fn();
      mockUseQuery.mockImplementation((config) => {
        capturedConfig(config);
        return makeQueryResult([]);
      });
      renderHook(() => useResources());
      const config = capturedConfig.mock.calls[0][0];
      const data = await config.queryFn();
      expect(data[0].renderer).toBe('letter');
    });
  });

  describe('createResource wrapper', () => {
    it('returns resource on success and shows toast', async () => {
      const { toast } = await import('sonner');
      const mockMutateAsync = vi.fn().mockResolvedValue({ id: 'new', title: 'New' });
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult({ mutateAsync: mockMutateAsync })) // createMut
        .mockReturnValue(makeMutationResult());
      const { result } = renderHook(() => useResources());
      const data = { title: 'New', category: 'Forms' };
      const res = await result.current.createResource(data);
      expect(mockMutateAsync).toHaveBeenCalledWith(data);
      expect(res).toEqual({ id: 'new', title: 'New' });
      expect(toast.success).toHaveBeenCalledWith('Resource created successfully');
    });

    it('shows error toast and rethrows on failure', async () => {
      const { toast } = await import('sonner');
      const mockMutateAsync = vi.fn().mockRejectedValue(new Error('Create failed'));
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult({ mutateAsync: mockMutateAsync }))
        .mockReturnValue(makeMutationResult());
      const { result } = renderHook(() => useResources());
      await expect(
        result.current.createResource({ title: 'x', category: 'Forms' }),
      ).rejects.toThrow('Create failed');
      expect(toast.error).toHaveBeenCalledWith('Failed to create resource', {
        description: 'Create failed',
      });
    });
  });

  describe('updateResource wrapper', () => {
    it('returns resource on success and shows toast', async () => {
      const { toast } = await import('sonner');
      const mockMutateAsync = vi.fn().mockResolvedValue({ id: 'res-001', title: 'Updated' });
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult()) // createMut
        .mockReturnValueOnce(makeMutationResult({ mutateAsync: mockMutateAsync })) // updateMut
        .mockReturnValue(makeMutationResult());
      const { result } = renderHook(() => useResources());
      const res = await result.current.updateResource('res-001', { title: 'Updated' });
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: 'res-001',
        updates: { title: 'Updated' },
      });
      expect(res).toEqual({ id: 'res-001', title: 'Updated' });
      expect(toast.success).toHaveBeenCalledWith('Resource updated successfully');
    });

    it('shows error toast and rethrows on failure', async () => {
      const { toast } = await import('sonner');
      const mockMutateAsync = vi.fn().mockRejectedValue(new Error('Update failed'));
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult())
        .mockReturnValueOnce(makeMutationResult({ mutateAsync: mockMutateAsync }))
        .mockReturnValue(makeMutationResult());
      const { result } = renderHook(() => useResources());
      await expect(result.current.updateResource('res-001', {})).rejects.toThrow('Update failed');
      expect(toast.error).toHaveBeenCalledWith('Failed to update resource', {
        description: 'Update failed',
      });
    });
  });

  describe('deleteResource wrapper', () => {
    it('resolves without error and shows toast', async () => {
      const { toast } = await import('sonner');
      const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult()) // createMut
        .mockReturnValueOnce(makeMutationResult()) // updateMut
        .mockReturnValueOnce(makeMutationResult({ mutateAsync: mockMutateAsync })) // deleteMut
        .mockReturnValue(makeMutationResult());
      const { result } = renderHook(() => useResources());
      await expect(result.current.deleteResource('res-001')).resolves.toBeUndefined();
      expect(mockMutateAsync).toHaveBeenCalledWith('res-001');
      expect(toast.success).toHaveBeenCalledWith('Resource deleted successfully');
    });

    it('shows error toast and rethrows on failure', async () => {
      const { toast } = await import('sonner');
      const mockMutateAsync = vi.fn().mockRejectedValue(new Error('Delete failed'));
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult())
        .mockReturnValueOnce(makeMutationResult())
        .mockReturnValueOnce(makeMutationResult({ mutateAsync: mockMutateAsync }))
        .mockReturnValue(makeMutationResult());
      const { result } = renderHook(() => useResources());
      await expect(result.current.deleteResource('res-001')).rejects.toThrow('Delete failed');
      expect(toast.error).toHaveBeenCalledWith('Failed to delete resource', {
        description: 'Delete failed',
      });
    });
  });

  describe('duplicateResource wrapper', () => {
    it('returns duplicated resource and shows toast', async () => {
      const { toast } = await import('sonner');
      const mockMutateAsync = vi.fn().mockResolvedValue({ id: 'res-001-copy', title: 'Form Copy' });
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult()) // createMut
        .mockReturnValueOnce(makeMutationResult()) // updateMut
        .mockReturnValueOnce(makeMutationResult()) // deleteMut
        .mockReturnValueOnce(makeMutationResult({ mutateAsync: mockMutateAsync })); // duplicateMut
      const { result } = renderHook(() => useResources());
      const res = await result.current.duplicateResource('res-001');
      expect(mockMutateAsync).toHaveBeenCalledWith('res-001');
      expect(res).toEqual({ id: 'res-001-copy', title: 'Form Copy' });
      expect(toast.success).toHaveBeenCalledWith('Resource duplicated successfully');
    });

    it('shows error toast and rethrows on failure', async () => {
      const { toast } = await import('sonner');
      const mockMutateAsync = vi.fn().mockRejectedValue(new Error('Duplicate failed'));
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult())
        .mockReturnValueOnce(makeMutationResult())
        .mockReturnValueOnce(makeMutationResult())
        .mockReturnValueOnce(makeMutationResult({ mutateAsync: mockMutateAsync }));
      const { result } = renderHook(() => useResources());
      await expect(result.current.duplicateResource('res-001')).rejects.toThrow('Duplicate failed');
      expect(toast.error).toHaveBeenCalledWith('Failed to duplicate resource', {
        description: 'Duplicate failed',
      });
    });
  });

  describe('mutationFn extraction', () => {
    it('createMut mutationFn calls resourcesApi.create', async () => {
      const rawResult = { id: 'new-id', title: 'New' };
      mockResourcesApiCreate.mockResolvedValue(rawResult);
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useResources());
      const createConfig = capturedMutations[0] as {
        mutationFn: (d: unknown) => Promise<unknown>;
      };
      const result = await createConfig.mutationFn({ title: 'New', category: 'Forms' });
      expect(result).toEqual(rawResult);
    });

    it('updateMut mutationFn calls resourcesApi.update', async () => {
      const rawResult = { id: 'res-001', title: 'Updated' };
      mockResourcesApiUpdate.mockResolvedValue(rawResult);
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useResources());
      const updateConfig = capturedMutations[1] as {
        mutationFn: (d: { id: string; updates: unknown }) => Promise<unknown>;
      };
      const result = await updateConfig.mutationFn({
        id: 'res-001',
        updates: { title: 'Updated' },
      });
      expect(result).toEqual(rawResult);
    });

    it('deleteMut mutationFn calls resourcesApi.delete', async () => {
      mockResourcesApiDelete.mockResolvedValue(undefined);
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useResources());
      const deleteConfig = capturedMutations[2] as {
        mutationFn: (id: string) => Promise<void>;
      };
      await expect(deleteConfig.mutationFn('res-001')).resolves.toBeUndefined();
    });

    it('duplicateMut mutationFn calls resourcesApi.duplicate', async () => {
      const rawResult = { id: 'copy-id', title: 'Copy' };
      mockResourcesApiDuplicate.mockResolvedValue(rawResult);
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useResources());
      const duplicateConfig = capturedMutations[3] as {
        mutationFn: (id: string) => Promise<unknown>;
      };
      const result = await duplicateConfig.mutationFn('res-001');
      expect(result).toEqual(rawResult);
    });
  });

  describe('mutation onSuccess callbacks', () => {
    it('createMut onSuccess invalidates queries', () => {
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useResources());
      const createConfig = capturedMutations[0] as { onSuccess: () => void };
      createConfig.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['resources', 'list'],
      });
    });

    it('updateMut onSuccess invalidates queries', () => {
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useResources());
      const updateConfig = capturedMutations[1] as { onSuccess: () => void };
      updateConfig.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });

    it('deleteMut onSuccess invalidates queries', () => {
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useResources());
      const deleteConfig = capturedMutations[2] as { onSuccess: () => void };
      deleteConfig.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });
  });
});
