import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRetirementFNAMutations } from '../useRetirementFNAMutations';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseMutation = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockCreate = vi.fn();
const mockUpdateInputs = vi.fn();
const mockCalculate = vi.fn();
const mockPublish = vi.fn();
const mockUnpublish = vi.fn();
const mockArchive = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../api', () => ({
  RetirementFnaAPI: {
    create: (...args: unknown[]) => mockCreate(...args),
    updateInputs: (...args: unknown[]) => mockUpdateInputs(...args),
    calculate: (...args: unknown[]) => mockCalculate(...args),
    publish: (...args: unknown[]) => mockPublish(...args),
    unpublish: (...args: unknown[]) => mockUnpublish(...args),
    archive: (...args: unknown[]) => mockArchive(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

type MutationOptions = {
  mutationFn: (...args: unknown[]) => unknown;
  onSuccess?: (...args: unknown[]) => void;
  onError?: (error: unknown) => void;
};

/**
 * Capture all useMutation calls in order and return them.
 * useRetirementFNAMutations calls useMutation 7 times (create, updateInputs,
 * calculate, publish, unpublish, archive, delete).
 */
function captureAllMutations(): MutationOptions[] {
  const captured: MutationOptions[] = [];
  mockUseMutation.mockImplementation((opts: MutationOptions) => {
    captured.push(opts);
    return {
      mutateAsync: opts.mutationFn,
      isPending: false,
    };
  });
  return captured;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// STRUCTURE
// ============================================================================

describe('useRetirementFNAMutations — return shape', () => {
  it('returns all expected action and pending-state properties', () => {
    captureAllMutations();
    const { result } = renderHook(() => useRetirementFNAMutations());

    expect(typeof result.current.createFNA).toBe('function');
    expect(typeof result.current.updateInputs).toBe('function');
    expect(typeof result.current.calculate).toBe('function');
    expect(typeof result.current.publishFNA).toBe('function');
    expect(typeof result.current.unpublishFNA).toBe('function');
    expect(typeof result.current.archiveFNA).toBe('function');
    expect(typeof result.current.deleteFNA).toBe('function');

    expect(result.current.isCreating).toBe(false);
    expect(result.current.isUpdating).toBe(false);
    expect(result.current.isCalculating).toBe(false);
    expect(result.current.isPublishing).toBe(false);
    expect(result.current.isUnpublishing).toBe(false);
    expect(result.current.isArchiving).toBe(false);
    expect(result.current.isDeleting).toBe(false);
  });
});

// ============================================================================
// CREATE
// ============================================================================

describe('create mutation', () => {
  it('mutationFn calls RetirementFnaAPI.create with clientId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    mockCreate.mockResolvedValue({ id: 'fna-1', clientId: 'c-1' });
    await (captured[0].mutationFn as (id: string) => Promise<unknown>)('c-1');

    expect(mockCreate).toHaveBeenCalledWith('c-1');
  });

  it('onSuccess invalidates list query and shows toast.success', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    captured[0].onSuccess?.({ id: 'fna-1', clientId: 'c-1' });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['retirement-fna', 'list', 'c-1'],
    });
    expect(toast.success).toHaveBeenCalledWith('Retirement FNA draft created successfully');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    captured[0].onError?.(new Error('create failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to create Retirement FNA draft');
  });
});

// ============================================================================
// UPDATE INPUTS
// ============================================================================

describe('updateInputs mutation', () => {
  it('mutationFn calls RetirementFnaAPI.updateInputs with fnaId and inputs', async () => {
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    const inputs = { retirementAge: 65 };
    mockUpdateInputs.mockResolvedValue({ id: 'fna-2', clientId: 'c-2' });
    await (captured[1].mutationFn as (args: unknown) => Promise<unknown>)({
      fnaId: 'fna-2',
      inputs,
    });

    expect(mockUpdateInputs).toHaveBeenCalledWith('fna-2', inputs);
  });

  it('onSuccess invalidates detail and list queries', () => {
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    captured[1].onSuccess?.({ id: 'fna-2', clientId: 'c-2' });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['retirement-fna', 'detail', 'fna-2'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['retirement-fna', 'list', 'c-2'],
    });
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    captured[1].onError?.(new Error('update failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to update Retirement FNA inputs');
  });
});

// ============================================================================
// CALCULATE
// ============================================================================

describe('calculate mutation', () => {
  it('mutationFn calls RetirementFnaAPI.calculate with fnaId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    mockCalculate.mockResolvedValue({ id: 'fna-3', clientId: 'c-3' });
    await (captured[2].mutationFn as (id: string) => Promise<unknown>)('fna-3');

    expect(mockCalculate).toHaveBeenCalledWith('fna-3');
  });

  it('onSuccess invalidates detail query', () => {
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    captured[2].onSuccess?.({ id: 'fna-3', clientId: 'c-3' });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['retirement-fna', 'detail', 'fna-3'],
    });
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    captured[2].onError?.(new Error('calc failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to calculate Retirement FNA');
  });
});

// ============================================================================
// PUBLISH
// ============================================================================

describe('publish mutation', () => {
  it('mutationFn calls RetirementFnaAPI.publish with fnaId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    mockPublish.mockResolvedValue({ id: 'fna-4', clientId: 'c-4' });
    await (captured[3].mutationFn as (id: string) => Promise<unknown>)('fna-4');

    expect(mockPublish).toHaveBeenCalledWith('fna-4');
  });

  it('onSuccess invalidates detail, list, and latestPublished queries and shows toast', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    captured[3].onSuccess?.({ id: 'fna-4', clientId: 'c-4' });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['retirement-fna', 'detail', 'fna-4'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['retirement-fna', 'list', 'c-4'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['retirement-fna', 'latest-published', 'c-4'],
    });
    expect(toast.success).toHaveBeenCalledWith('Retirement FNA published successfully');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    captured[3].onError?.(new Error('publish failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to publish Retirement FNA');
  });
});

// ============================================================================
// UNPUBLISH
// ============================================================================

describe('unpublish mutation', () => {
  it('mutationFn calls RetirementFnaAPI.unpublish with fnaId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    mockUnpublish.mockResolvedValue({ id: 'fna-5', clientId: 'c-5' });
    await (captured[4].mutationFn as (id: string) => Promise<unknown>)('fna-5');

    expect(mockUnpublish).toHaveBeenCalledWith('fna-5');
  });

  it('onSuccess invalidates detail, list, and latestPublished queries and shows toast', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    captured[4].onSuccess?.({ id: 'fna-5', clientId: 'c-5' });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['retirement-fna', 'detail', 'fna-5'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['retirement-fna', 'list', 'c-5'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['retirement-fna', 'latest-published', 'c-5'],
    });
    expect(toast.success).toHaveBeenCalledWith('Retirement FNA unpublished — reverted to draft');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    captured[4].onError?.(new Error('unpublish failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to unpublish Retirement FNA');
  });
});

// ============================================================================
// ARCHIVE
// ============================================================================

describe('archive mutation', () => {
  it('mutationFn calls RetirementFnaAPI.archive with fnaId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    mockArchive.mockResolvedValue({ id: 'fna-6', clientId: 'c-6' });
    await (captured[5].mutationFn as (id: string) => Promise<unknown>)('fna-6');

    expect(mockArchive).toHaveBeenCalledWith('fna-6');
  });

  it('onSuccess invalidates all retirement-fna queries and shows toast', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    captured[5].onSuccess?.(undefined, 'fna-6');

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['retirement-fna'],
    });
    expect(toast.success).toHaveBeenCalledWith('Retirement FNA archived successfully');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    captured[5].onError?.(new Error('archive failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to archive Retirement FNA');
  });
});

// ============================================================================
// DELETE
// ============================================================================

describe('delete mutation', () => {
  it('mutationFn calls RetirementFnaAPI.delete with fnaId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    mockDelete.mockResolvedValue(undefined);
    await (captured[6].mutationFn as (id: string) => Promise<unknown>)('fna-7');

    expect(mockDelete).toHaveBeenCalledWith('fna-7');
  });

  it('onSuccess invalidates all retirement-fna queries and shows toast', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    captured[6].onSuccess?.();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['retirement-fna'],
    });
    expect(toast.success).toHaveBeenCalledWith('Retirement FNA deleted');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useRetirementFNAMutations());

    captured[6].onError?.(new Error('delete failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to delete Retirement FNA');
  });
});
