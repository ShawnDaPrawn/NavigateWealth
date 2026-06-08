import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMedicalFNAMutations } from '../useMedicalFNAMutations';

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

const mockCreateMedicalFNA = vi.fn();
const mockUpdateMedicalFNAInputs = vi.fn();
const mockCalculateMedicalFNA = vi.fn();
const mockPublishMedicalFNA = vi.fn();
const mockUnpublishMedicalFNA = vi.fn();
const mockArchiveMedicalFNA = vi.fn();
const mockDeleteMedicalFNA = vi.fn();

vi.mock('../../api', () => ({
  MedicalFnaAPI: {
    createMedicalFNA: (...args: unknown[]) => mockCreateMedicalFNA(...args),
    updateMedicalFNAInputs: (...args: unknown[]) => mockUpdateMedicalFNAInputs(...args),
    calculateMedicalFNA: (...args: unknown[]) => mockCalculateMedicalFNA(...args),
    publishMedicalFNA: (...args: unknown[]) => mockPublishMedicalFNA(...args),
    unpublishMedicalFNA: (...args: unknown[]) => mockUnpublishMedicalFNA(...args),
    archiveMedicalFNA: (...args: unknown[]) => mockArchiveMedicalFNA(...args),
    deleteMedicalFNA: (...args: unknown[]) => mockDeleteMedicalFNA(...args),
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
 * Capture all useMutation calls in order.
 * useMedicalFNAMutations calls useMutation 7 times:
 *   0: create, 1: updateInputs, 2: calculate, 3: publish, 4: unpublish, 5: archive, 6: delete
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

const ALL_QUERY_KEY = ['medical-fna'];

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// STRUCTURE
// ============================================================================

describe('useMedicalFNAMutations — return shape', () => {
  it('returns all expected action and pending-state properties', () => {
    captureAllMutations();
    const { result } = renderHook(() => useMedicalFNAMutations());

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
  it('mutationFn calls MedicalFnaAPI.createMedicalFNA with clientId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    mockCreateMedicalFNA.mockResolvedValue({ id: 'mfna-1' });
    await (captured[0].mutationFn as (id: string) => Promise<unknown>)('c-1');

    expect(mockCreateMedicalFNA).toHaveBeenCalledWith('c-1');
  });

  it('onSuccess invalidates all medical-fna queries and shows toast.success', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    captured[0].onSuccess?.({ id: 'mfna-1' });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ALL_QUERY_KEY });
    expect(toast.success).toHaveBeenCalledWith('Medical FNA draft created successfully');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    captured[0].onError?.(new Error('create failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to create Medical FNA draft');
  });
});

// ============================================================================
// UPDATE INPUTS
// ============================================================================

describe('updateInputs mutation', () => {
  it('mutationFn calls MedicalFnaAPI.updateMedicalFNAInputs with fnaId and inputs', async () => {
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    const inputs = { coverAmount: 500000 };
    mockUpdateMedicalFNAInputs.mockResolvedValue({ id: 'mfna-2' });
    await (captured[1].mutationFn as (args: unknown) => Promise<unknown>)({
      fnaId: 'mfna-2',
      inputs,
    });

    expect(mockUpdateMedicalFNAInputs).toHaveBeenCalledWith('mfna-2', inputs);
  });

  it('onSuccess invalidates all medical-fna queries', () => {
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    captured[1].onSuccess?.();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ALL_QUERY_KEY });
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    captured[1].onError?.(new Error('update failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to update Medical FNA inputs');
  });
});

// ============================================================================
// CALCULATE
// ============================================================================

describe('calculate mutation', () => {
  it('mutationFn calls MedicalFnaAPI.calculateMedicalFNA with fnaId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    mockCalculateMedicalFNA.mockResolvedValue({ id: 'mfna-3' });
    await (captured[2].mutationFn as (id: string) => Promise<unknown>)('mfna-3');

    expect(mockCalculateMedicalFNA).toHaveBeenCalledWith('mfna-3');
  });

  it('onError shows toast.error (no onSuccess handler defined)', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    captured[2].onError?.(new Error('calc failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to calculate Medical FNA');
  });
});

// ============================================================================
// PUBLISH
// ============================================================================

describe('publish mutation', () => {
  it('mutationFn calls MedicalFnaAPI.publishMedicalFNA with fnaId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    mockPublishMedicalFNA.mockResolvedValue(undefined);
    await (captured[3].mutationFn as (id: string) => Promise<unknown>)('mfna-4');

    expect(mockPublishMedicalFNA).toHaveBeenCalledWith('mfna-4');
  });

  it('onSuccess invalidates all medical-fna queries and shows toast.success', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    captured[3].onSuccess?.();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ALL_QUERY_KEY });
    expect(toast.success).toHaveBeenCalledWith('Medical FNA published successfully');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    captured[3].onError?.(new Error('publish failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to publish Medical FNA');
  });
});

// ============================================================================
// UNPUBLISH
// ============================================================================

describe('unpublish mutation', () => {
  it('mutationFn calls MedicalFnaAPI.unpublishMedicalFNA with fnaId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    mockUnpublishMedicalFNA.mockResolvedValue(undefined);
    await (captured[4].mutationFn as (id: string) => Promise<unknown>)('mfna-5');

    expect(mockUnpublishMedicalFNA).toHaveBeenCalledWith('mfna-5');
  });

  it('onSuccess invalidates all medical-fna queries and shows toast.success', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    captured[4].onSuccess?.();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ALL_QUERY_KEY });
    expect(toast.success).toHaveBeenCalledWith('Medical FNA unpublished — reverted to draft');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    captured[4].onError?.(new Error('unpublish failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to unpublish Medical FNA');
  });
});

// ============================================================================
// ARCHIVE
// ============================================================================

describe('archive mutation', () => {
  it('mutationFn calls MedicalFnaAPI.archiveMedicalFNA with fnaId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    mockArchiveMedicalFNA.mockResolvedValue(undefined);
    await (captured[5].mutationFn as (id: string) => Promise<unknown>)('mfna-6');

    expect(mockArchiveMedicalFNA).toHaveBeenCalledWith('mfna-6');
  });

  it('onSuccess invalidates all medical-fna queries and shows toast.success', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    captured[5].onSuccess?.();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ALL_QUERY_KEY });
    expect(toast.success).toHaveBeenCalledWith('Medical FNA archived successfully');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    captured[5].onError?.(new Error('archive failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to archive Medical FNA');
  });
});

// ============================================================================
// DELETE
// ============================================================================

describe('delete mutation', () => {
  it('mutationFn calls MedicalFnaAPI.deleteMedicalFNA with fnaId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    mockDeleteMedicalFNA.mockResolvedValue(undefined);
    await (captured[6].mutationFn as (id: string) => Promise<unknown>)('mfna-7');

    expect(mockDeleteMedicalFNA).toHaveBeenCalledWith('mfna-7');
  });

  it('onSuccess invalidates all medical-fna queries and shows toast.success', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    captured[6].onSuccess?.();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ALL_QUERY_KEY });
    expect(toast.success).toHaveBeenCalledWith('Medical FNA deleted');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useMedicalFNAMutations());

    captured[6].onError?.(new Error('delete failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to delete Medical FNA');
  });
});
