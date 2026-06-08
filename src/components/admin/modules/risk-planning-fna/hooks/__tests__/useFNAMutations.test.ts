import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFNAMutations } from '../useFNAMutations';

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

// Mock errorUtils to avoid Supabase dependency
vi.mock('../../../../../utils/errorUtils', () => ({
  logError: vi.fn(),
}));

// Mock queryKeys re-export
vi.mock('../queryKeys', () => ({
  riskFnaKeys: {
    all: ['risk-fna'],
    lists: () => ['risk-fna', 'list'],
    list: (clientId: string) => ['risk-fna', 'list', clientId],
    details: () => ['risk-fna', 'detail'],
    detail: (id: string) => ['risk-fna', 'detail', id],
    clientProfile: (clientId: string) => ['risk-fna', 'client-profile', clientId],
  },
}));

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockPublish = vi.fn();
const mockArchive = vi.fn();

vi.mock('../../api', () => ({
  RiskPlanningFnaAPI: {
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    publish: (...args: unknown[]) => mockPublish(...args),
    archive: (...args: unknown[]) => mockArchive(...args),
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
 * useFNAMutations calls useMutation 4 times:
 *   0: create, 1: update, 2: publish, 3: archive
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

describe('useFNAMutations — return shape', () => {
  it('returns all expected action and pending-state properties', () => {
    captureAllMutations();
    const { result } = renderHook(() => useFNAMutations());

    expect(typeof result.current.createFNA).toBe('function');
    expect(typeof result.current.updateFNA).toBe('function');
    expect(typeof result.current.publishFNA).toBe('function');
    expect(typeof result.current.archiveFNA).toBe('function');

    expect(result.current.isCreating).toBe(false);
    expect(result.current.isUpdating).toBe(false);
    expect(result.current.isPublishing).toBe(false);
    expect(result.current.isArchiving).toBe(false);
  });
});

// ============================================================================
// CREATE (index 0)
// ============================================================================

describe('create mutation', () => {
  it('mutationFn calls RiskPlanningFnaAPI.create with clientId and inputData', async () => {
    const captured = captureAllMutations();
    renderHook(() => useFNAMutations());

    const inputData = { riskTolerance: 'medium' };
    mockCreate.mockResolvedValue({ id: 'fna-1', clientId: 'c-1' });
    await (captured[0].mutationFn as (args: unknown) => Promise<unknown>)({
      clientId: 'c-1',
      inputData,
    });

    expect(mockCreate).toHaveBeenCalledWith('c-1', inputData);
  });

  it('onSuccess with data invalidates list query and shows toast.success', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useFNAMutations());

    captured[0].onSuccess?.({ id: 'fna-1', clientId: 'c-1' });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['risk-fna', 'list', 'c-1'],
    });
    expect(toast.success).toHaveBeenCalledWith('FNA draft created successfully');
  });

  it('onSuccess with null data shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useFNAMutations());

    captured[0].onSuccess?.(null);

    expect(toast.error).toHaveBeenCalledWith('Failed to create FNA draft');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useFNAMutations());

    captured[0].onError?.(new Error('create failed'));

    expect(toast.error).toHaveBeenCalledWith('An error occurred while creating the FNA');
  });
});

// ============================================================================
// UPDATE (index 1)
// ============================================================================

describe('update mutation', () => {
  it('mutationFn calls RiskPlanningFnaAPI.update with fnaId and updates', async () => {
    const captured = captureAllMutations();
    renderHook(() => useFNAMutations());

    mockUpdate.mockResolvedValue({ id: 'fna-2', clientId: 'c-2' });
    await (captured[1].mutationFn as (args: unknown) => Promise<unknown>)({
      fnaId: 'fna-2',
      status: 'draft',
    });

    expect(mockUpdate).toHaveBeenCalledWith('fna-2', { status: 'draft' });
  });

  it('onSuccess with data invalidates detail and list queries and shows toast', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useFNAMutations());

    captured[1].onSuccess?.({ id: 'fna-2', clientId: 'c-2' });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['risk-fna', 'detail', 'fna-2'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['risk-fna', 'list', 'c-2'],
    });
    expect(toast.success).toHaveBeenCalledWith('FNA updated successfully');
  });

  it('onSuccess with null data shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useFNAMutations());

    captured[1].onSuccess?.(null);

    expect(toast.error).toHaveBeenCalledWith('Failed to update FNA');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useFNAMutations());

    captured[1].onError?.(new Error('update failed'));

    expect(toast.error).toHaveBeenCalledWith('An error occurred while updating the FNA');
  });
});

// ============================================================================
// PUBLISH (index 2)
// ============================================================================

describe('publish mutation', () => {
  it('mutationFn calls RiskPlanningFnaAPI.publish with fnaId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useFNAMutations());

    mockPublish.mockResolvedValue({ id: 'fna-3', clientId: 'c-3' });
    await (captured[2].mutationFn as (id: string) => Promise<unknown>)('fna-3');

    expect(mockPublish).toHaveBeenCalledWith('fna-3');
  });

  it('onSuccess with data invalidates detail and list queries and shows toast', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useFNAMutations());

    captured[2].onSuccess?.({ id: 'fna-3', clientId: 'c-3' });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['risk-fna', 'detail', 'fna-3'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['risk-fna', 'list', 'c-3'],
    });
    expect(toast.success).toHaveBeenCalledWith('FNA published successfully');
  });

  it('onSuccess with null data shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useFNAMutations());

    captured[2].onSuccess?.(null);

    expect(toast.error).toHaveBeenCalledWith('Failed to publish FNA');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useFNAMutations());

    captured[2].onError?.(new Error('publish failed'));

    expect(toast.error).toHaveBeenCalledWith('An error occurred while publishing the FNA');
  });
});

// ============================================================================
// ARCHIVE (index 3)
// ============================================================================

describe('archive mutation', () => {
  it('mutationFn calls RiskPlanningFnaAPI.archive with fnaId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useFNAMutations());

    mockArchive.mockResolvedValue(true);
    await (captured[3].mutationFn as (id: string) => Promise<unknown>)('fna-4');

    expect(mockArchive).toHaveBeenCalledWith('fna-4');
  });

  it('onSuccess invalidates all risk-fna queries and shows toast', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useFNAMutations());

    captured[3].onSuccess?.(true, 'fna-4');

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['risk-fna'],
    });
    expect(toast.success).toHaveBeenCalledWith('FNA archived successfully');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useFNAMutations());

    captured[3].onError?.(new Error('archive failed'));

    expect(toast.error).toHaveBeenCalledWith('An error occurred while archiving the FNA');
  });
});
