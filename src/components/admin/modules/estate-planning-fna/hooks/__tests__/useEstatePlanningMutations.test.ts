import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEstatePlanningMutations } from '../useEstatePlanningMutations';

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

const mockSaveSession = vi.fn();
const mockPublishSession = vi.fn();
const mockUnpublishSession = vi.fn();
const mockDeleteSession = vi.fn();

vi.mock('../../api', () => ({
  EstatePlanningAPI: {
    saveSession: (...args: unknown[]) => mockSaveSession(...args),
    publishSession: (...args: unknown[]) => mockPublishSession(...args),
    unpublishSession: (...args: unknown[]) => mockUnpublishSession(...args),
    deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
    getAllSessions: vi.fn(),
    getSessionById: vi.fn(),
    getLatestPublished: vi.fn(),
    autoPopulateInputs: vi.fn(),
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

type MutationOptions = {
  mutationFn: (...args: unknown[]) => unknown;
  onSuccess?: (...args: unknown[]) => void;
  onError?: (error: unknown, variables?: unknown) => void;
};

/**
 * Capture all useMutation calls in order.
 * useEstatePlanningMutations calls useMutation 4 times:
 *   0: saveSession, 1: publish, 2: unpublish, 3: delete
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

describe('useEstatePlanningMutations — return shape', () => {
  it('returns all expected action and pending-state properties', () => {
    captureAllMutations();
    const { result } = renderHook(() => useEstatePlanningMutations());

    expect(typeof result.current.saveSession).toBe('function');
    expect(typeof result.current.publishSession).toBe('function');
    expect(typeof result.current.unpublishSession).toBe('function');
    expect(typeof result.current.deleteSession).toBe('function');

    expect(result.current.isSaving).toBe(false);
    expect(result.current.isPublishing).toBe(false);
    expect(result.current.isUnpublishing).toBe(false);
    expect(result.current.isDeleting).toBe(false);
  });
});

// ============================================================================
// SAVE SESSION (index 0)
// ============================================================================

describe('saveSession mutation', () => {
  it('mutationFn calls EstatePlanningAPI.saveSession with correct args', async () => {
    const captured = captureAllMutations();
    renderHook(() => useEstatePlanningMutations());

    const params = {
      clientId: 'c-1',
      inputs: {},
      results: null,
      status: 'draft' as const,
      adviserNotes: 'notes',
    };
    mockSaveSession.mockResolvedValue({ id: 's-1' });
    await (captured[0].mutationFn as (args: unknown) => Promise<unknown>)(params);

    expect(mockSaveSession).toHaveBeenCalledWith('c-1', params.inputs, null, 'draft', 'notes');
  });

  it('onSuccess invalidates sessions and latestPublished queries and shows draft toast', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useEstatePlanningMutations());

    const variables = {
      clientId: 'c-1',
      inputs: {},
      results: null,
      status: 'draft' as const,
    };
    captured[0].onSuccess?.({ id: 's-1' }, variables);

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['estate-planning-fna', 'sessions', 'c-1'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['estate-planning-fna', 'latest-published', 'c-1'],
    });
    expect(toast.success).toHaveBeenCalledWith('Estate Planning FNA saved as draft successfully');
  });

  it('onSuccess shows published toast when status is published', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useEstatePlanningMutations());

    const variables = {
      clientId: 'c-1',
      inputs: {},
      results: null,
      status: 'published' as const,
    };
    captured[0].onSuccess?.({ id: 's-1' }, variables);

    expect(toast.success).toHaveBeenCalledWith('Estate Planning FNA published successfully');
  });

  it('onError shows save toast.error for draft status', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useEstatePlanningMutations());

    const variables = {
      clientId: 'c-1',
      inputs: {},
      results: null,
      status: 'draft' as const,
    };
    captured[0].onError?.(new Error('save failed'), variables);

    expect(toast.error).toHaveBeenCalledWith('Failed to save Estate Planning FNA');
  });

  it('onError shows publish toast.error for published status', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useEstatePlanningMutations());

    const variables = {
      clientId: 'c-1',
      inputs: {},
      results: null,
      status: 'published' as const,
    };
    captured[0].onError?.(new Error('publish failed'), variables);

    expect(toast.error).toHaveBeenCalledWith('Failed to publish Estate Planning FNA');
  });
});

// ============================================================================
// PUBLISH (index 1)
// ============================================================================

describe('publish mutation', () => {
  it('mutationFn calls EstatePlanningAPI.publishSession with sessionId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useEstatePlanningMutations());

    mockPublishSession.mockResolvedValue({ id: 's-2' });
    await (captured[1].mutationFn as (id: string) => Promise<unknown>)('s-2');

    expect(mockPublishSession).toHaveBeenCalledWith('s-2');
  });

  it('onSuccess invalidates detail and all queries and shows toast', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useEstatePlanningMutations());

    captured[1].onSuccess?.({ id: 's-2' });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['estate-planning-fna', 'detail', 's-2'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['estate-planning-fna'],
    });
    expect(toast.success).toHaveBeenCalledWith('Estate Planning FNA published successfully');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useEstatePlanningMutations());

    captured[1].onError?.(new Error('publish failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to publish Estate Planning FNA');
  });
});

// ============================================================================
// UNPUBLISH (index 2)
// ============================================================================

describe('unpublish mutation', () => {
  it('mutationFn calls EstatePlanningAPI.unpublishSession with sessionId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useEstatePlanningMutations());

    mockUnpublishSession.mockResolvedValue({ id: 's-3' });
    await (captured[2].mutationFn as (id: string) => Promise<unknown>)('s-3');

    expect(mockUnpublishSession).toHaveBeenCalledWith('s-3');
  });

  it('onSuccess invalidates detail and all queries and shows toast', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useEstatePlanningMutations());

    captured[2].onSuccess?.({ id: 's-3' });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['estate-planning-fna', 'detail', 's-3'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['estate-planning-fna'],
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Estate Planning FNA unpublished — reverted to draft',
    );
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useEstatePlanningMutations());

    captured[2].onError?.(new Error('unpublish failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to unpublish Estate Planning FNA');
  });
});

// ============================================================================
// DELETE (index 3)
// ============================================================================

describe('delete mutation', () => {
  it('mutationFn calls EstatePlanningAPI.deleteSession with sessionId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useEstatePlanningMutations());

    mockDeleteSession.mockResolvedValue(undefined);
    await (captured[3].mutationFn as (id: string) => Promise<unknown>)('s-4');

    expect(mockDeleteSession).toHaveBeenCalledWith('s-4');
  });

  it('onSuccess invalidates all estate-planning-fna queries and shows toast', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useEstatePlanningMutations());

    captured[3].onSuccess?.();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['estate-planning-fna'],
    });
    expect(toast.success).toHaveBeenCalledWith('Estate Planning FNA deleted');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useEstatePlanningMutations());

    captured[3].onError?.(new Error('delete failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to delete Estate Planning FNA');
  });
});
