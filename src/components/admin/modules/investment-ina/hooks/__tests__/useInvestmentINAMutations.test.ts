import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInvestmentINAMutations } from '../useInvestmentINAMutations';

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

const mockCalculateINA = vi.fn();
const mockSaveSession = vi.fn();
const mockPublishSession = vi.fn();
const mockUnpublishSession = vi.fn();
const mockDeleteSession = vi.fn();

vi.mock('../../api', () => ({
  InvestmentINAFnaAPI: {
    calculateINA: (...args: unknown[]) => mockCalculateINA(...args),
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
 * useInvestmentINAMutations calls useMutation 5 times:
 *   0: calculate, 1: saveSession, 2: publish, 3: unpublish, 4: delete
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

describe('useInvestmentINAMutations — return shape', () => {
  it('returns all expected action and pending-state properties', () => {
    captureAllMutations();
    const { result } = renderHook(() => useInvestmentINAMutations());

    expect(typeof result.current.calculateINA).toBe('function');
    expect(typeof result.current.saveSession).toBe('function');
    expect(typeof result.current.publishSession).toBe('function');
    expect(typeof result.current.unpublishSession).toBe('function');
    expect(typeof result.current.deleteSession).toBe('function');

    expect(result.current.isCalculating).toBe(false);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.isPublishing).toBe(false);
    expect(result.current.isUnpublishing).toBe(false);
    expect(result.current.isDeleting).toBe(false);
  });
});

// ============================================================================
// CALCULATE (index 0)
// ============================================================================

describe('calculate mutation', () => {
  it('mutationFn calls InvestmentINAFnaAPI.calculateINA with clientId and inputs', async () => {
    const captured = captureAllMutations();
    renderHook(() => useInvestmentINAMutations());

    const inputs = { riskProfile: 'moderate' };
    mockCalculateINA.mockResolvedValue({ results: {} });
    await (captured[0].mutationFn as (args: unknown) => Promise<unknown>)({
      clientId: 'c-1',
      inputs,
    });

    expect(mockCalculateINA).toHaveBeenCalledWith('c-1', inputs);
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useInvestmentINAMutations());

    captured[0].onError?.(new Error('calc failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to calculate Investment INA');
  });
});

// ============================================================================
// SAVE SESSION (index 1)
// ============================================================================

describe('saveSession mutation', () => {
  it('mutationFn calls InvestmentINAFnaAPI.saveSession with correct args', async () => {
    const captured = captureAllMutations();
    renderHook(() => useInvestmentINAMutations());

    const params = { clientId: 'c-2', inputs: {}, results: null, status: 'draft' as const };
    mockSaveSession.mockResolvedValue({ id: 's-1' });
    await (captured[1].mutationFn as (args: unknown) => Promise<unknown>)(params);

    expect(mockSaveSession).toHaveBeenCalledWith('c-2', params.inputs, null, 'draft');
  });

  it('onSuccess invalidates sessions and latestPublished queries and shows draft toast', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useInvestmentINAMutations());

    const variables = { clientId: 'c-2', inputs: {}, results: null, status: 'draft' as const };
    captured[1].onSuccess?.({ id: 's-1' }, variables);

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['investment-ina', 'sessions', 'c-2'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['investment-ina', 'latest-published', 'c-2'],
    });
    expect(toast.success).toHaveBeenCalledWith('Investment INA saved as draft successfully');
  });

  it('onSuccess shows published toast when status is published', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useInvestmentINAMutations());

    const variables = {
      clientId: 'c-2',
      inputs: {},
      results: null,
      status: 'published' as const,
    };
    captured[1].onSuccess?.({ id: 's-1' }, variables);

    expect(toast.success).toHaveBeenCalledWith('Investment INA published successfully');
  });

  it('onError shows save toast.error for draft status', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useInvestmentINAMutations());

    const variables = { clientId: 'c-2', inputs: {}, results: null, status: 'draft' as const };
    captured[1].onError?.(new Error('save failed'), variables);

    expect(toast.error).toHaveBeenCalledWith('Failed to save Investment INA');
  });

  it('onError shows publish toast.error for published status', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useInvestmentINAMutations());

    const variables = {
      clientId: 'c-2',
      inputs: {},
      results: null,
      status: 'published' as const,
    };
    captured[1].onError?.(new Error('publish failed'), variables);

    expect(toast.error).toHaveBeenCalledWith('Failed to publish Investment INA');
  });
});

// ============================================================================
// PUBLISH (index 2)
// ============================================================================

describe('publish mutation', () => {
  it('mutationFn calls InvestmentINAFnaAPI.publishSession with sessionId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useInvestmentINAMutations());

    mockPublishSession.mockResolvedValue({ id: 's-3' });
    await (captured[2].mutationFn as (id: string) => Promise<unknown>)('s-3');

    expect(mockPublishSession).toHaveBeenCalledWith('s-3');
  });

  it('onSuccess invalidates detail and all queries and shows toast', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useInvestmentINAMutations());

    captured[2].onSuccess?.({ id: 's-3' });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['investment-ina', 'detail', 's-3'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['investment-ina'],
    });
    expect(toast.success).toHaveBeenCalledWith('Investment INA published successfully');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useInvestmentINAMutations());

    captured[2].onError?.(new Error('publish failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to publish Investment INA');
  });
});

// ============================================================================
// UNPUBLISH (index 3)
// ============================================================================

describe('unpublish mutation', () => {
  it('mutationFn calls InvestmentINAFnaAPI.unpublishSession with sessionId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useInvestmentINAMutations());

    mockUnpublishSession.mockResolvedValue({ id: 's-4' });
    await (captured[3].mutationFn as (id: string) => Promise<unknown>)('s-4');

    expect(mockUnpublishSession).toHaveBeenCalledWith('s-4');
  });

  it('onSuccess invalidates detail and all queries and shows toast', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useInvestmentINAMutations());

    captured[3].onSuccess?.({ id: 's-4' });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['investment-ina', 'detail', 's-4'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['investment-ina'],
    });
    expect(toast.success).toHaveBeenCalledWith('Investment INA unpublished — reverted to draft');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useInvestmentINAMutations());

    captured[3].onError?.(new Error('unpublish failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to unpublish Investment INA');
  });
});

// ============================================================================
// DELETE (index 4)
// ============================================================================

describe('delete mutation', () => {
  it('mutationFn calls InvestmentINAFnaAPI.deleteSession with sessionId', async () => {
    const captured = captureAllMutations();
    renderHook(() => useInvestmentINAMutations());

    mockDeleteSession.mockResolvedValue(undefined);
    await (captured[4].mutationFn as (id: string) => Promise<unknown>)('s-5');

    expect(mockDeleteSession).toHaveBeenCalledWith('s-5');
  });

  it('onSuccess invalidates all investment-ina queries and shows toast', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useInvestmentINAMutations());

    captured[4].onSuccess?.();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['investment-ina'],
    });
    expect(toast.success).toHaveBeenCalledWith('Investment INA deleted');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useInvestmentINAMutations());

    captured[4].onError?.(new Error('delete failed'));

    expect(toast.error).toHaveBeenCalledWith('Failed to delete Investment INA');
  });
});
