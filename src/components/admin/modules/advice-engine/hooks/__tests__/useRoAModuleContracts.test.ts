import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRoAModuleContracts } from '../useRoAModuleContracts';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockSetQueryData = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
    setQueryData: mockSetQueryData,
  }),
}));

const mockGetModuleContracts = vi.fn();
const mockGetModuleContractSchemaFormat = vi.fn();
const mockSaveModuleContract = vi.fn();
const mockPublishModuleContract = vi.fn();
const mockArchiveModuleContract = vi.fn();

vi.mock('../../api', () => ({
  roaApi: {
    getModuleContracts: (...args: unknown[]) => mockGetModuleContracts(...args),
    getModuleContractSchemaFormat: (...args: unknown[]) =>
      mockGetModuleContractSchemaFormat(...args),
    saveModuleContract: (...args: unknown[]) => mockSaveModuleContract(...args),
    publishModuleContract: (...args: unknown[]) => mockPublishModuleContract(...args),
    archiveModuleContract: (...args: unknown[]) => mockArchiveModuleContract(...args),
  },
}));

const defaultMutationReturn = { mutateAsync: vi.fn(), isPending: false };

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
  mockUseMutation.mockReturnValue({ ...defaultMutationReturn });
});

// ============================================================================
// contractsQuery
// ============================================================================

describe('useRoAModuleContracts — contractsQuery', () => {
  it('passes correct queryKey for contracts with no filters', () => {
    const captured: Array<Record<string, unknown>> = [];
    mockUseQuery.mockImplementation((opts: Record<string, unknown>) => {
      captured.push(opts);
      return { data: undefined, isLoading: false, error: null };
    });

    renderHook(() => useRoAModuleContracts());

    // First call is contractsQuery
    expect(captured[0].queryKey).toEqual(['roa', 'module-contracts', {}]);
  });

  it('passes status and includeArchived filters in queryKey', () => {
    const captured: Array<Record<string, unknown>> = [];
    mockUseQuery.mockImplementation((opts: Record<string, unknown>) => {
      captured.push(opts);
      return { data: undefined, isLoading: false, error: null };
    });

    renderHook(() => useRoAModuleContracts({ status: 'active' as never, includeArchived: true }));

    expect(captured[0].queryKey).toEqual([
      'roa',
      'module-contracts',
      { status: 'active', includeArchived: true },
    ]);
  });

  it('queryFn calls roaApi.getModuleContracts with filters', async () => {
    const captured: Array<Record<string, unknown>> = [];
    mockUseQuery.mockImplementation((opts: Record<string, unknown>) => {
      captured.push(opts);
      return { data: undefined, isLoading: false, error: null };
    });

    renderHook(() => useRoAModuleContracts());

    mockGetModuleContracts.mockResolvedValue([]);
    await (captured[0].queryFn as () => Promise<unknown>)();

    expect(mockGetModuleContracts).toHaveBeenCalledWith({
      status: undefined,
      includeArchived: undefined,
    });
  });

  it('sets staleTime to 5 minutes for contracts query', () => {
    const captured: Array<Record<string, unknown>> = [];
    mockUseQuery.mockImplementation((opts: Record<string, unknown>) => {
      captured.push(opts);
      return { data: undefined, isLoading: false, error: null };
    });

    renderHook(() => useRoAModuleContracts());

    expect(captured[0].staleTime).toBe(5 * 60 * 1000);
  });
});

// ============================================================================
// schemaQuery
// ============================================================================

describe('useRoAModuleContracts — schemaQuery', () => {
  it('passes correct queryKey for schema', () => {
    const captured: Array<Record<string, unknown>> = [];
    mockUseQuery.mockImplementation((opts: Record<string, unknown>) => {
      captured.push(opts);
      return { data: undefined, isLoading: false, error: null };
    });

    renderHook(() => useRoAModuleContracts());

    // Second call is schemaQuery
    expect(captured[1].queryKey).toEqual(['roa', 'module-contract-schema']);
  });

  it('queryFn calls roaApi.getModuleContractSchemaFormat', async () => {
    const captured: Array<Record<string, unknown>> = [];
    mockUseQuery.mockImplementation((opts: Record<string, unknown>) => {
      captured.push(opts);
      return { data: undefined, isLoading: false, error: null };
    });

    renderHook(() => useRoAModuleContracts());

    mockGetModuleContractSchemaFormat.mockResolvedValue({ format: {} });
    await (captured[1].queryFn as () => Promise<unknown>)();

    expect(mockGetModuleContractSchemaFormat).toHaveBeenCalled();
  });

  it('sets staleTime to 30 minutes for schema query', () => {
    const captured: Array<Record<string, unknown>> = [];
    mockUseQuery.mockImplementation((opts: Record<string, unknown>) => {
      captured.push(opts);
      return { data: undefined, isLoading: false, error: null };
    });

    renderHook(() => useRoAModuleContracts());

    expect(captured[1].staleTime).toBe(30 * 60 * 1000);
  });
});

// ============================================================================
// Return values
// ============================================================================

describe('useRoAModuleContracts — return values', () => {
  it('returns empty contracts array when contractsQuery data is undefined', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });

    const { result } = renderHook(() => useRoAModuleContracts());

    expect(result.current.contracts).toEqual([]);
  });

  it('returns contracts from contractsQuery.data', () => {
    const mockContracts = [{ id: 'c-1', moduleId: 'm-1' }];
    const callCount = { n: 0 };
    mockUseQuery.mockImplementation(() => {
      callCount.n++;
      if (callCount.n === 1) return { data: mockContracts, isLoading: false, error: null };
      return { data: undefined, isLoading: false, error: null };
    });

    const { result } = renderHook(() => useRoAModuleContracts());

    expect(result.current.contracts).toBe(mockContracts);
  });

  it('isLoading is true when either query is loading', () => {
    const callCount = { n: 0 };
    mockUseQuery.mockImplementation(() => {
      callCount.n++;
      if (callCount.n === 1) return { data: undefined, isLoading: true, error: null };
      return { data: undefined, isLoading: false, error: null };
    });

    const { result } = renderHook(() => useRoAModuleContracts());

    expect(result.current.isLoading).toBe(true);
  });
});

// ============================================================================
// saveMutation
// ============================================================================

describe('useRoAModuleContracts — saveMutation', () => {
  it('mutationFn calls roaApi.saveModuleContract', async () => {
    const mutations: Array<Record<string, unknown>> = [];
    mockUseMutation.mockImplementation((opts: Record<string, unknown>) => {
      mutations.push(opts);
      return { mutateAsync: vi.fn(), isPending: false };
    });

    renderHook(() => useRoAModuleContracts());

    const contract = { id: 'c-1', moduleId: 'm-1', content: {} };
    mockSaveModuleContract.mockResolvedValue(contract);
    await (mutations[0].mutationFn as (c: unknown) => Promise<unknown>)(contract);

    expect(mockSaveModuleContract).toHaveBeenCalledWith(contract);
  });

  it('onSuccess sets query data and invalidates module-contracts and modules', () => {
    const mutations: Array<Record<string, unknown>> = [];
    mockUseMutation.mockImplementation((opts: Record<string, unknown>) => {
      mutations.push(opts);
      return { mutateAsync: vi.fn(), isPending: false };
    });

    renderHook(() => useRoAModuleContracts());

    const contract = { id: 'c-1' };
    (mutations[0].onSuccess as (contract: { id: string }) => void)(contract);

    expect(mockSetQueryData).toHaveBeenCalledWith(['roa', 'module-contract', 'c-1'], contract);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: expect.arrayContaining(['roa', 'module-contracts']),
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['roa', 'modules'],
    });
  });
});

// ============================================================================
// publishMutation
// ============================================================================

describe('useRoAModuleContracts — publishMutation', () => {
  it('mutationFn calls roaApi.publishModuleContract with moduleId', async () => {
    const mutations: Array<Record<string, unknown>> = [];
    mockUseMutation.mockImplementation((opts: Record<string, unknown>) => {
      mutations.push(opts);
      return { mutateAsync: vi.fn(), isPending: false };
    });

    renderHook(() => useRoAModuleContracts());

    mockPublishModuleContract.mockResolvedValue({ id: 'm-1' });
    await (mutations[1].mutationFn as (id: string) => Promise<unknown>)('m-1');

    expect(mockPublishModuleContract).toHaveBeenCalledWith('m-1');
  });
});

// ============================================================================
// archiveMutation
// ============================================================================

describe('useRoAModuleContracts — archiveMutation', () => {
  it('mutationFn calls roaApi.archiveModuleContract with moduleId', async () => {
    const mutations: Array<Record<string, unknown>> = [];
    mockUseMutation.mockImplementation((opts: Record<string, unknown>) => {
      mutations.push(opts);
      return { mutateAsync: vi.fn(), isPending: false };
    });

    renderHook(() => useRoAModuleContracts());

    mockArchiveModuleContract.mockResolvedValue({ id: 'm-1' });
    await (mutations[2].mutationFn as (id: string) => Promise<unknown>)('m-1');

    expect(mockArchiveModuleContract).toHaveBeenCalledWith('m-1');
  });

  it('onSuccess sets query data for the contract', () => {
    const mutations: Array<Record<string, unknown>> = [];
    mockUseMutation.mockImplementation((opts: Record<string, unknown>) => {
      mutations.push(opts);
      return { mutateAsync: vi.fn(), isPending: false };
    });

    renderHook(() => useRoAModuleContracts());

    const contract = { id: 'm-1', status: 'archived' };
    (mutations[2].onSuccess as (contract: { id: string }) => void)(contract);

    expect(mockSetQueryData).toHaveBeenCalledWith(['roa', 'module-contract', 'm-1'], contract);
  });
});
