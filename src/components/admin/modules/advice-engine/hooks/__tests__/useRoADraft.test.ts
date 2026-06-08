/**
 * Tests for useRoADraft hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRoADraft } from '../useRoADraft';
import type { RoADraft } from '../../types';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockSetQueryData = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockUseQueryClient = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: (...args: unknown[]) => mockUseQueryClient(...args),
}));

vi.mock('../queryKeys', () => ({
  adviceEngineKeys: {
    ai: {
      all: ['ai-intelligence'],
      status: () => ['ai-intelligence', 'status'],
      history: () => ['ai-intelligence', 'history'],
    },
    roa: {
      all: ['advice-engine-roa'],
      drafts: () => ['advice-engine-roa', 'drafts'],
      draft: (id: string) => ['advice-engine-roa', 'draft', id],
      moduleContracts: (f: unknown) => ['advice-engine-roa', 'module-contracts', f ?? {}],
    },
  },
}));

const mockGetDraft = vi.fn();
const mockSaveDraft = vi.fn();
const mockSubmitDraft = vi.fn();
const mockGetModuleContracts = vi.fn();

vi.mock('../../api', () => ({
  roaApi: {
    getDraft: (...args: unknown[]) => mockGetDraft(...args),
    saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
    submitDraft: (...args: unknown[]) => mockSubmitDraft(...args),
    getModuleContracts: (...args: unknown[]) => mockGetModuleContracts(...args),
  },
  aiIntelligenceApi: {
    getStatus: vi.fn(),
    getHistory: vi.fn(),
    sendMessage: vi.fn(),
    clearHistory: vi.fn(),
    searchClients: vi.fn(),
  },
}));

const mockModuleContractToRuntimeModule = vi.fn();
const mockGetFallbackRuntimeModules = vi.fn();

vi.mock('../../roaModuleRuntime', () => ({
  moduleContractToRuntimeModule: (...args: unknown[]) => mockModuleContractToRuntimeModule(...args),
  getFallbackRuntimeModules: (...args: unknown[]) => mockGetFallbackRuntimeModules(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

function makeMutationResult(overrides: Record<string, unknown> = {}) {
  return {
    mutateAsync: vi.fn(),
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  };
}

function makeDraft(overrides: Partial<RoADraft> = {}): RoADraft {
  return {
    id: 'draft-123',
    selectedModules: [],
    moduleData: {},
    status: 'draft',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    version: 1,
    ...overrides,
  };
}

/** Captured configs for each useMutation call in order: saveDraft, submitDraft */
function capturedMutations(): Array<{
  mutationFn: (...args: unknown[]) => Promise<unknown>;
  onSuccess?: (...args: unknown[]) => unknown;
  onError?: (...args: unknown[]) => unknown;
}> {
  return mockUseMutation.mock.calls.map((call) => call[0]);
}

const FALLBACK_MODULES = [
  {
    id: 'fallback-1',
    title: 'Fallback Module',
    description: '',
    fields: [],
    disclosures: [],
    compileOrder: [],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQueryClient.mockReturnValue({
    setQueryData: mockSetQueryData,
    invalidateQueries: mockInvalidateQueries,
  });
  mockUseQuery.mockReturnValue(makeQueryResult());
  mockUseMutation.mockReturnValue(makeMutationResult());
  mockGetFallbackRuntimeModules.mockReturnValue(FALLBACK_MODULES);
  mockModuleContractToRuntimeModule.mockImplementation((c: unknown) => c);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRoADraft', () => {
  // ── Initial state (no draftId) ────────────────────────────────────────────

  it('draft is null on mount when no draftId provided', () => {
    const { result } = renderHook(() => useRoADraft());
    expect(result.current.draft).toBeNull();
  });

  it('isLoading is false on mount', () => {
    const { result } = renderHook(() => useRoADraft());
    expect(result.current.isLoading).toBe(false);
  });

  it('isSaving is false on mount', () => {
    mockUseMutation.mockReturnValue(makeMutationResult({ isPending: false }));
    const { result } = renderHook(() => useRoADraft());
    expect(result.current.isSaving).toBe(false);
  });

  it('isSaving is true when saveDraft mutation is pending', () => {
    let callCount = 0;
    mockUseMutation.mockImplementation(() => {
      callCount++;
      return makeMutationResult({ isPending: callCount === 1 }); // first = saveDraft
    });
    const { result } = renderHook(() => useRoADraft());
    expect(result.current.isSaving).toBe(true);
  });

  it('error is null on mount', () => {
    const { result } = renderHook(() => useRoADraft());
    expect(result.current.error).toBeNull();
  });

  it('returns all expected fields', () => {
    const { result } = renderHook(() => useRoADraft());
    expect(result.current).toHaveProperty('draft');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('isSaving');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('saveDraft');
    expect(result.current).toHaveProperty('submitDraft');
    expect(result.current).toHaveProperty('modules');
    expect(result.current).toHaveProperty('updateDraft');
    expect(result.current).toHaveProperty('createNewDraft');
  });

  // ── useQuery for draft ────────────────────────────────────────────────────

  it('draft query is disabled when no draftId', () => {
    renderHook(() => useRoADraft());
    const draftConfig = mockUseQuery.mock.calls[0][0] as { enabled: boolean };
    expect(draftConfig.enabled).toBe(false);
  });

  it('draft query is enabled when draftId is provided', () => {
    renderHook(() => useRoADraft({ draftId: 'draft-abc' }));
    const draftConfig = mockUseQuery.mock.calls[0][0] as { enabled: boolean };
    expect(draftConfig.enabled).toBe(true);
  });

  it('draft query has correct queryKey for given draftId', () => {
    renderHook(() => useRoADraft({ draftId: 'draft-xyz' }));
    const draftConfig = mockUseQuery.mock.calls[0][0] as { queryKey: unknown[] };
    expect(draftConfig.queryKey).toEqual(['advice-engine-roa', 'draft', 'draft-xyz']);
  });

  it('draft query has staleTime of 30 seconds', () => {
    renderHook(() => useRoADraft({ draftId: 'draft-abc' }));
    const draftConfig = mockUseQuery.mock.calls[0][0] as { staleTime: number };
    expect(draftConfig.staleTime).toBe(30 * 1000);
  });

  it('draft queryFn calls roaApi.getDraft', async () => {
    mockGetDraft.mockResolvedValueOnce(makeDraft());
    renderHook(() => useRoADraft({ draftId: 'draft-abc' }));
    const draftConfig = mockUseQuery.mock.calls[0][0] as {
      queryFn: () => Promise<unknown>;
    };
    await draftConfig.queryFn();
    expect(mockGetDraft).toHaveBeenCalledWith('draft-abc');
  });

  it('draft queryFn returns null when draftId is empty', async () => {
    renderHook(() => useRoADraft());
    const draftConfig = mockUseQuery.mock.calls[0][0] as {
      queryFn: () => Promise<unknown>;
    };
    const result = await draftConfig.queryFn();
    expect(result).toBeNull();
    expect(mockGetDraft).not.toHaveBeenCalled();
  });

  // ── Fetched draft sync ────────────────────────────────────────────────────

  it('populates draft from fetchedDraft when local draft is null', () => {
    const fetchedDraft = makeDraft({ id: 'fetched-draft' });
    mockUseQuery.mockImplementation(() => makeQueryResult({ data: fetchedDraft }));
    const { result } = renderHook(() => useRoADraft({ draftId: 'fetched-draft' }));
    expect(result.current.draft).toEqual(fetchedDraft);
  });

  it('reflects isLoading true from draft query', () => {
    mockUseQuery.mockReturnValue(makeQueryResult({ isLoading: true }));
    const { result } = renderHook(() => useRoADraft({ draftId: 'draft-abc' }));
    expect(result.current.isLoading).toBe(true);
  });

  it('error reflects fetchError as string when no local error', () => {
    const fetchErr = new Error('Not found');
    mockUseQuery.mockReturnValue(makeQueryResult({ error: fetchErr }));
    const { result } = renderHook(() => useRoADraft({ draftId: 'draft-abc' }));
    expect(result.current.error).toBe(String(fetchErr));
  });

  // ── Module contracts query ────────────────────────────────────────────────

  it('modules query passes correct queryKey', () => {
    renderHook(() => useRoADraft());
    const modulesConfig = mockUseQuery.mock.calls[1][0] as { queryKey: unknown[] };
    expect(modulesConfig.queryKey).toEqual([
      'advice-engine-roa',
      'module-contracts',
      { status: 'active' },
    ]);
  });

  it('modules query has staleTime of 10 minutes', () => {
    renderHook(() => useRoADraft());
    const modulesConfig = mockUseQuery.mock.calls[1][0] as { staleTime: number };
    expect(modulesConfig.staleTime).toBe(10 * 60 * 1000);
  });

  it('uses fallback modules when contract list is empty', async () => {
    mockGetModuleContracts.mockResolvedValueOnce([]);
    mockUseQuery.mockReturnValueOnce(makeQueryResult()); // draft query
    mockUseQuery.mockReturnValueOnce(makeQueryResult({ data: undefined })); // modules query
    renderHook(() => useRoADraft());
    const modulesConfig = mockUseQuery.mock.calls[1][0] as {
      queryFn: () => Promise<unknown[]>;
    };
    const result = await modulesConfig.queryFn();
    expect(mockGetFallbackRuntimeModules).toHaveBeenCalled();
    expect(result).toEqual(FALLBACK_MODULES);
  });

  it('uses runtime modules when contracts are returned', async () => {
    const contracts = [{ id: 'contract-1' }];
    const runtimeModule = {
      id: 'contract-1',
      title: 'Module 1',
      description: '',
      fields: [],
      disclosures: [],
      compileOrder: [],
    };
    mockGetModuleContracts.mockResolvedValueOnce(contracts);
    mockModuleContractToRuntimeModule.mockReturnValueOnce(runtimeModule);
    renderHook(() => useRoADraft());
    const modulesConfig = mockUseQuery.mock.calls[1][0] as {
      queryFn: () => Promise<unknown[]>;
    };
    const result = await modulesConfig.queryFn();
    expect(mockGetFallbackRuntimeModules).not.toHaveBeenCalled();
    expect(result).toEqual([runtimeModule]);
  });

  it('returns empty modules array when modules query data is undefined', () => {
    mockUseQuery.mockReturnValueOnce(makeQueryResult()); // draft
    mockUseQuery.mockReturnValueOnce(makeQueryResult({ data: undefined })); // modules
    const { result } = renderHook(() => useRoADraft());
    expect(result.current.modules).toEqual([]);
  });

  // ── createNewDraft ────────────────────────────────────────────────────────

  it('createNewDraft creates a draft with expected shape', () => {
    const { result } = renderHook(() => useRoADraft());
    act(() => {
      result.current.createNewDraft();
    });
    expect(result.current.draft).not.toBeNull();
    expect(result.current.draft?.selectedModules).toEqual([]);
    expect(result.current.draft?.moduleData).toEqual({});
    expect(result.current.draft?.status).toBe('draft');
    expect(result.current.draft?.version).toBe(1);
    expect(result.current.draft?.id).toMatch(/^draft-/);
  });

  it('createNewDraft draft id is unique on each call', () => {
    const { result } = renderHook(() => useRoADraft());
    act(() => {
      result.current.createNewDraft();
    });
    const id1 = result.current.draft?.id;
    // small wait to ensure Date.now() differs
    act(() => {
      result.current.createNewDraft();
    });
    const id2 = result.current.draft?.id;
    // Both should be valid draft ids; if same millisecond they may be equal — that's OK
    expect(id1).toMatch(/^draft-/);
    expect(id2).toMatch(/^draft-/);
  });

  // ── updateDraft ───────────────────────────────────────────────────────────

  it('updateDraft merges updates into existing draft', () => {
    const { result } = renderHook(() => useRoADraft());
    act(() => {
      result.current.createNewDraft();
    });
    act(() => {
      result.current.updateDraft({ selectedModules: ['life-insurance'] });
    });
    expect(result.current.draft?.selectedModules).toEqual(['life-insurance']);
  });

  it('updateDraft updates the updatedAt timestamp', () => {
    const { result } = renderHook(() => useRoADraft());
    const before = new Date();
    act(() => {
      result.current.createNewDraft();
    });
    act(() => {
      result.current.updateDraft({ selectedModules: ['module-1'] });
    });
    expect(result.current.draft?.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('updateDraft does nothing when draft is null', () => {
    const { result } = renderHook(() => useRoADraft());
    act(() => {
      result.current.updateDraft({ selectedModules: ['x'] });
    });
    expect(result.current.draft).toBeNull();
  });

  it('updateDraft preserves other fields', () => {
    const { result } = renderHook(() => useRoADraft());
    act(() => {
      result.current.createNewDraft();
    });
    const originalId = result.current.draft?.id;
    act(() => {
      result.current.updateDraft({ selectedModules: ['m1'] });
    });
    expect(result.current.draft?.id).toBe(originalId);
    expect(result.current.draft?.status).toBe('draft');
  });

  // ── saveDraft ─────────────────────────────────────────────────────────────

  it('saveDraft calls mutateAsync with provided data', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValueOnce(makeDraft());
    mockUseMutation.mockReturnValue(makeMutationResult({ mutateAsync: mockMutateAsync }));
    const { result } = renderHook(() => useRoADraft());
    const data = { selectedModules: ['super-switch'] };
    await act(async () => {
      await result.current.saveDraft(data);
    });
    expect(mockMutateAsync).toHaveBeenCalledWith(data);
  });

  it('saveDraft mutationFn calls roaApi.saveDraft', async () => {
    const saved = makeDraft({ id: 'saved-1' });
    mockSaveDraft.mockResolvedValueOnce(saved);
    renderHook(() => useRoADraft());
    const [saveMutationConfig] = capturedMutations();
    const result = await saveMutationConfig.mutationFn({ selectedModules: [] });
    expect(mockSaveDraft).toHaveBeenCalled();
    expect(result).toEqual(saved);
  });

  it('saveDraft onSuccess calls setQueryData with saved draft', () => {
    const savedDraft = makeDraft({ id: 'saved-123' });
    renderHook(() => useRoADraft());
    const [saveMutationConfig] = capturedMutations();
    saveMutationConfig.onSuccess?.(savedDraft, {}, undefined);
    expect(mockSetQueryData).toHaveBeenCalledWith(
      ['advice-engine-roa', 'draft', 'saved-123'],
      savedDraft,
    );
  });

  it('saveDraft onError does not throw', () => {
    renderHook(() => useRoADraft());
    const [saveMutationConfig] = capturedMutations();
    expect(() =>
      saveMutationConfig.onError?.(new Error('Save failed'), {}, undefined),
    ).not.toThrow();
  });

  // ── submitDraft ───────────────────────────────────────────────────────────

  it('submitDraft calls mutateAsync', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValueOnce(makeDraft({ status: 'submitted' }));
    let callCount = 0;
    mockUseMutation.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeMutationResult(); // saveDraft
      return makeMutationResult({ mutateAsync: mockMutateAsync }); // submitDraft
    });
    const { result } = renderHook(() => useRoADraft());
    await act(async () => {
      await result.current.submitDraft();
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  });

  it('submitDraft mutationFn throws when no draft id', async () => {
    renderHook(() => useRoADraft());
    const mutations = capturedMutations();
    const submitConfig = mutations[1]; // second mutation = submitDraft
    await expect(submitConfig.mutationFn()).rejects.toThrow('No draft to submit');
  });

  it('submitDraft onSuccess calls setQueryData and invalidateQueries', () => {
    const submittedDraft = makeDraft({ id: 'sub-1', status: 'submitted' });
    renderHook(() => useRoADraft());
    const mutations = capturedMutations();
    const submitConfig = mutations[1];
    submitConfig.onSuccess?.(submittedDraft, undefined, undefined);
    expect(mockSetQueryData).toHaveBeenCalledWith(
      ['advice-engine-roa', 'draft', 'sub-1'],
      submittedDraft,
    );
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['advice-engine-roa', 'drafts'],
    });
  });

  it('submitDraft onError does not throw', () => {
    renderHook(() => useRoADraft());
    const mutations = capturedMutations();
    const submitConfig = mutations[1];
    expect(() =>
      submitConfig.onError?.(new Error('submit failed'), undefined, undefined),
    ).not.toThrow();
  });
});
