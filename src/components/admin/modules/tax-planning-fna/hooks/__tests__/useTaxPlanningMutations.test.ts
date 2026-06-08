import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTaxPlanningMutations } from '../useTaxPlanningMutations';

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

vi.mock('../../api', () => ({
  TaxPlanningFnaAPI: {
    saveSession: (...args: unknown[]) => mockSaveSession(...args),
    getAllSessions: vi.fn(),
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
 * useTaxPlanningMutations calls useMutation 1 time:
 *   0: saveSession
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

const baseSaveParams = {
  clientId: 'c-1',
  inputs: {
    grossIncome: 500000,
    taxYear: '2025',
    filingStatus: 'individual',
    deductions: [],
    taxCredits: [],
    otherIncome: [],
    businessIncome: 0,
    rentalIncome: 0,
    investmentIncome: 0,
    retirementContributions: 0,
    medicalExpenses: 0,
    charitableContributions: 0,
  },
  finalResults: { taxLiability: 150000, effectiveRate: 0.3, marginalRate: 0.45, netIncome: 350000 },
  adjustments: [],
  recommendations: [],
  adviserNotes: '',
  status: 'draft' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// STRUCTURE
// ============================================================================

describe('useTaxPlanningMutations — return shape', () => {
  it('returns all expected action and pending-state properties', () => {
    captureAllMutations();
    const { result } = renderHook(() => useTaxPlanningMutations());

    expect(typeof result.current.saveSession).toBe('function');

    expect(result.current.isSaving).toBe(false);
    expect(result.current.isPublishing).toBe(false);
  });
});

// ============================================================================
// SAVE SESSION (index 0)
// ============================================================================

describe('saveSession mutation', () => {
  it('mutationFn calls TaxPlanningFnaAPI.saveSession with clientId and data', async () => {
    const captured = captureAllMutations();
    renderHook(() => useTaxPlanningMutations());

    const { clientId, ...data } = baseSaveParams;
    mockSaveSession.mockResolvedValue({ id: 's-1' });
    await (captured[0].mutationFn as (args: unknown) => Promise<unknown>)(baseSaveParams);

    expect(mockSaveSession).toHaveBeenCalledWith(clientId, data);
  });

  it('onSuccess invalidates sessions query and shows draft toast', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useTaxPlanningMutations());

    const variables = { ...baseSaveParams, status: 'draft' as const };
    captured[0].onSuccess?.({ id: 's-1' }, variables);

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['tax-planning-fna', 'sessions', 'c-1'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['tax-planning-fna', 'latest-published', 'c-1'],
    });
    expect(toast.success).toHaveBeenCalledWith('Tax Planning FNA saved as draft successfully');
  });

  it('onSuccess shows published toast when status is published', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useTaxPlanningMutations());

    const variables = { ...baseSaveParams, status: 'published' as const };
    captured[0].onSuccess?.({ id: 's-1' }, variables);

    expect(toast.success).toHaveBeenCalledWith('Tax Planning FNA published successfully');
  });

  it('onError shows save toast.error for draft status', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useTaxPlanningMutations());

    const variables = { ...baseSaveParams, status: 'draft' as const };
    captured[0].onError?.(new Error('save failed'), variables);

    expect(toast.error).toHaveBeenCalledWith('Failed to save Tax Planning FNA');
  });

  it('onError shows publish toast.error for published status', async () => {
    const { toast } = await import('sonner');
    const captured = captureAllMutations();
    renderHook(() => useTaxPlanningMutations());

    const variables = { ...baseSaveParams, status: 'published' as const };
    captured[0].onError?.(new Error('publish failed'), variables);

    expect(toast.error).toHaveBeenCalledWith('Failed to publish Tax Planning FNA');
  });
});
