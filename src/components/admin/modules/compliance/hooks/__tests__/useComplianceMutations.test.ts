/**
 * Tests for useComplianceMutations
 * Navigate Wealth Admin Dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useCreateFAISRecord,
  useUpdateFAISRecord,
  useDeleteFAISRecord,
  useCreateAMLCheck,
  useRunAMLScreening,
  useRecordConsent,
  useWithdrawConsent,
  useCreatePAIARequest,
  useUpdatePAIARequest,
  useCreateStatutoryRecord,
  useSubmitStatutoryRecord,
  useCreateTCFAssessment,
  useUpdateTCFAssessment,
  useCreateRecordKeepingEntry,
  useMarkForDisposal,
  useRunDebarmentCheck,
  useCreateSupervisionRecord,
  useCreateConflictRecord,
  useCreateMarketingRecord,
  useApproveMarketing,
  useCreateDocumentsInsuranceRecord,
  useRenewInsurance,
  useCreateNewBusinessRecord,
  useCreateComplaint,
  useUpdateComplaint,
  useResolveComplaint,
  useEscalateComplaint,
  useRefreshCompliance,
} from '../useComplianceMutations';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockInvalidateQueries = vi.fn();
const mockSetQueryData = vi.fn();
const mockUseMutation = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
    setQueryData: mockSetQueryData,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../api', () => ({
  faisApi: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
    getByAdviser: vi.fn(),
  },
  amlFicaApi: {
    create: vi.fn(),
    runScreening: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
    getByClient: vi.fn(),
    update: vi.fn(),
  },
  popiPaiaApi: {
    recordConsent: vi.fn(),
    withdrawConsent: vi.fn(),
    createPAIARequest: vi.fn(),
    updatePAIARequest: vi.fn(),
    getAllConsents: vi.fn(),
    getConsentsByUser: vi.fn(),
    getAllPAIARequests: vi.fn(),
  },
  statutoryApi: {
    create: vi.fn(),
    markAsSubmitted: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
  },
  tcfApi: {
    create: vi.fn(),
    update: vi.fn(),
    getAll: vi.fn(),
  },
  recordKeepingApi: {
    create: vi.fn(),
    markForDisposal: vi.fn(),
    getAll: vi.fn(),
  },
  debarmentSupervisionApi: {
    runCheck: vi.fn(),
    createSupervision: vi.fn(),
    getAllDebarments: vi.fn(),
    getAllSupervision: vi.fn(),
    updateSupervision: vi.fn(),
  },
  conflictsMarketingApi: {
    createConflict: vi.fn(),
    createMarketing: vi.fn(),
    approveMarketing: vi.fn(),
    getAllConflicts: vi.fn(),
    getAllMarketing: vi.fn(),
    updateConflict: vi.fn(),
  },
  documentsInsuranceApi: {
    create: vi.fn(),
    markAsRenewed: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
  },
  newBusinessApi: {
    create: vi.fn(),
    getAll: vi.fn(),
    getByClient: vi.fn(),
    update: vi.fn(),
  },
  complaintsApi: {
    create: vi.fn(),
    update: vi.fn(),
    resolve: vi.fn(),
    escalate: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
  },
  complianceOverviewApi: {
    refreshAll: vi.fn(),
    getRecentActivities: vi.fn(),
    getUpcomingDeadlines: vi.fn(),
    getStats: vi.fn(),
  },
}));

vi.mock('../../constants', () => ({
  SUCCESS_MESSAGES: {
    RECORD_CREATED: 'Compliance record created successfully',
    RECORD_UPDATED: 'Compliance record updated successfully',
    RECORD_DELETED: 'Compliance record deleted successfully',
    CHECK_COMPLETED: 'Compliance check completed successfully',
    CONSENT_RECORDED: 'Consent recorded successfully',
    COMPLAINT_SUBMITTED: 'Complaint submitted successfully',
    COMPLAINT_RESOLVED: 'Complaint resolved successfully',
    DOCUMENT_UPLOADED: 'Document uploaded successfully',
    EXPORT_COMPLETED: 'Export completed successfully',
  },
  ERROR_MESSAGES: {
    CREATE_FAILED: 'Failed to create compliance record',
    UPDATE_FAILED: 'Failed to update compliance record',
    DELETE_FAILED: 'Failed to delete compliance record',
    CHECK_FAILED: 'Compliance check failed',
    CONSENT_FAILED: 'Failed to record consent',
    COMPLAINT_FAILED: 'Failed to submit complaint',
    FETCH_FAILED: 'Failed to load compliance records',
    UPLOAD_FAILED: 'Failed to upload document',
    EXPORT_FAILED: 'Failed to export data',
    INVALID_DATA: 'Invalid data provided',
    UNAUTHORIZED: 'You are not authorized to perform this action',
    NOT_FOUND: 'Compliance record not found',
  },
  QUERY_STALE_TIME: 60000,
  QUERY_GC_TIME: 300000,
}));

// Default mutation return value used by all hooks
const DEFAULT_MUTATION_RESULT = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  isSuccess: false,
  error: null,
  data: undefined,
  reset: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseMutation.mockReturnValue(DEFAULT_MUTATION_RESULT);
});

// ============================================================================
// HELPER: extract config passed to useMutation
// ============================================================================

function getLastMutationConfig() {
  const calls = mockUseMutation.mock.calls;
  return calls[calls.length - 1]?.[0] as {
    mutationFn: (...args: unknown[]) => unknown;
    onSuccess: (...args: unknown[]) => unknown;
    onError: (error: Error) => unknown;
  };
}

// ============================================================================
// FAIS MUTATIONS
// ============================================================================

describe('useCreateFAISRecord', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useCreateFAISRecord());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls useMutation once', () => {
    renderHook(() => useCreateFAISRecord());
    expect(mockUseMutation).toHaveBeenCalledTimes(1);
  });

  it('calls faisApi.create with the provided data in mutationFn', async () => {
    const { faisApi } = await import('../../api');
    renderHook(() => useCreateFAISRecord());
    const config = getLastMutationConfig();
    const data = { title: 'Test FAIS' };
    await config.mutationFn(data);
    expect(faisApi.create).toHaveBeenCalledWith(data);
  });

  it('onSuccess invalidates fais and stats query keys and calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreateFAISRecord());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('Compliance record created successfully');
  });

  it('onError calls toast.error with the error message', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreateFAISRecord());
    const config = getLastMutationConfig();
    const error = new Error('Network error');
    await config.onError(error);
    expect(toast.error).toHaveBeenCalledWith('Failed to create compliance record: Network error');
  });
});

describe('useUpdateFAISRecord', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useUpdateFAISRecord());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls faisApi.update with id and data in mutationFn', async () => {
    const { faisApi } = await import('../../api');
    renderHook(() => useUpdateFAISRecord());
    const config = getLastMutationConfig();
    await config.mutationFn({ id: 'fais-1', data: { title: 'Updated' } });
    expect(faisApi.update).toHaveBeenCalledWith('fais-1', { title: 'Updated' });
  });

  it('onSuccess invalidates fais, faisRecord, and stats, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useUpdateFAISRecord());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, { id: 'fais-1', data: {} }, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(3);
    expect(toast.success).toHaveBeenCalledWith('Compliance record updated successfully');
  });

  it('onError calls toast.error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useUpdateFAISRecord());
    const config = getLastMutationConfig();
    await config.onError(new Error('Update failed'));
    expect(toast.error).toHaveBeenCalledWith('Failed to update compliance record: Update failed');
  });
});

describe('useDeleteFAISRecord', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useDeleteFAISRecord());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls faisApi.delete with id in mutationFn', async () => {
    const { faisApi } = await import('../../api');
    renderHook(() => useDeleteFAISRecord());
    const config = getLastMutationConfig();
    await config.mutationFn('fais-1');
    expect(faisApi.delete).toHaveBeenCalledWith('fais-1');
  });

  it('onSuccess invalidates fais and stats, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useDeleteFAISRecord());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('Compliance record deleted successfully');
  });

  it('onError calls toast.error with delete message', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useDeleteFAISRecord());
    const config = getLastMutationConfig();
    await config.onError(new Error('Delete failed'));
    expect(toast.error).toHaveBeenCalledWith('Failed to delete compliance record: Delete failed');
  });
});

// ============================================================================
// AML/FICA MUTATIONS
// ============================================================================

describe('useCreateAMLCheck', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useCreateAMLCheck());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls amlFicaApi.create in mutationFn', async () => {
    const { amlFicaApi } = await import('../../api');
    renderHook(() => useCreateAMLCheck());
    const config = getLastMutationConfig();
    const data = { clientId: 'client-1' };
    await config.mutationFn(data);
    expect(amlFicaApi.create).toHaveBeenCalledWith(data);
  });

  it('onSuccess invalidates amlFica and stats, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreateAMLCheck());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('Compliance check completed successfully');
  });

  it('onError calls toast.error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreateAMLCheck());
    const config = getLastMutationConfig();
    await config.onError(new Error('Check failed'));
    expect(toast.error).toHaveBeenCalledWith('Compliance check failed: Check failed');
  });
});

describe('useRunAMLScreening', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useRunAMLScreening());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls amlFicaApi.runScreening with clientId in mutationFn', async () => {
    const { amlFicaApi } = await import('../../api');
    renderHook(() => useRunAMLScreening());
    const config = getLastMutationConfig();
    await config.mutationFn('client-123');
    expect(amlFicaApi.runScreening).toHaveBeenCalledWith('client-123');
  });

  it('onSuccess invalidates amlFica, amlFicaByClient, and stats', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useRunAMLScreening());
    const config = getLastMutationConfig();
    await config.onSuccess({ clientId: 'client-1' }, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(3);
    expect(toast.success).toHaveBeenCalledWith('Compliance check completed successfully');
  });

  it('onError calls toast.error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useRunAMLScreening());
    const config = getLastMutationConfig();
    await config.onError(new Error('Screening error'));
    expect(toast.error).toHaveBeenCalledWith('Compliance check failed: Screening error');
  });
});

// ============================================================================
// POPI/PAIA MUTATIONS
// ============================================================================

describe('useRecordConsent', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useRecordConsent());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls popiPaiaApi.recordConsent in mutationFn', async () => {
    const { popiPaiaApi } = await import('../../api');
    renderHook(() => useRecordConsent());
    const config = getLastMutationConfig();
    const data = { userId: 'user-1', type: 'marketing' };
    await config.mutationFn(data);
    expect(popiPaiaApi.recordConsent).toHaveBeenCalledWith(data);
  });

  it('onSuccess invalidates popiaConsents and stats, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useRecordConsent());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('Consent recorded successfully');
  });

  it('onError calls toast.error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useRecordConsent());
    const config = getLastMutationConfig();
    await config.onError(new Error('Consent error'));
    expect(toast.error).toHaveBeenCalledWith('Failed to record consent: Consent error');
  });
});

describe('useWithdrawConsent', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useWithdrawConsent());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls popiPaiaApi.withdrawConsent with id in mutationFn', async () => {
    const { popiPaiaApi } = await import('../../api');
    renderHook(() => useWithdrawConsent());
    const config = getLastMutationConfig();
    await config.mutationFn('consent-1');
    expect(popiPaiaApi.withdrawConsent).toHaveBeenCalledWith('consent-1');
  });

  it('onSuccess invalidates popiaConsents and stats, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useWithdrawConsent());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('Consent withdrawn successfully');
  });

  it('onError calls toast.error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useWithdrawConsent());
    const config = getLastMutationConfig();
    await config.onError(new Error('Withdraw error'));
    expect(toast.error).toHaveBeenCalledWith('Failed to withdraw consent: Withdraw error');
  });
});

describe('useCreatePAIARequest', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useCreatePAIARequest());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls popiPaiaApi.createPAIARequest in mutationFn', async () => {
    const { popiPaiaApi } = await import('../../api');
    renderHook(() => useCreatePAIARequest());
    const config = getLastMutationConfig();
    const data = { requestType: 'access' };
    await config.mutationFn(data);
    expect(popiPaiaApi.createPAIARequest).toHaveBeenCalledWith(data);
  });

  it('onSuccess invalidates paiaRequests, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreatePAIARequest());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('PAIA request created successfully');
  });
});

describe('useUpdatePAIARequest', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useUpdatePAIARequest());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls popiPaiaApi.updatePAIARequest with id and data', async () => {
    const { popiPaiaApi } = await import('../../api');
    renderHook(() => useUpdatePAIARequest());
    const config = getLastMutationConfig();
    await config.mutationFn({ id: 'paia-1', data: { status: 'approved' } });
    expect(popiPaiaApi.updatePAIARequest).toHaveBeenCalledWith('paia-1', { status: 'approved' });
  });

  it('onSuccess invalidates paiaRequests, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useUpdatePAIARequest());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Compliance record updated successfully');
  });
});

// ============================================================================
// STATUTORY MUTATIONS
// ============================================================================

describe('useCreateStatutoryRecord', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useCreateStatutoryRecord());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls statutoryApi.create in mutationFn', async () => {
    const { statutoryApi } = await import('../../api');
    renderHook(() => useCreateStatutoryRecord());
    const config = getLastMutationConfig();
    const data = { returnType: 'annual' };
    await config.mutationFn(data);
    expect(statutoryApi.create).toHaveBeenCalledWith(data);
  });

  it('onSuccess invalidates statutory and stats, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreateStatutoryRecord());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('Compliance record created successfully');
  });

  it('onError calls toast.error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreateStatutoryRecord());
    const config = getLastMutationConfig();
    await config.onError(new Error('Statutory error'));
    expect(toast.error).toHaveBeenCalledWith('Failed to create compliance record: Statutory error');
  });
});

describe('useSubmitStatutoryRecord', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useSubmitStatutoryRecord());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls statutoryApi.markAsSubmitted with id and submittedBy', async () => {
    const { statutoryApi } = await import('../../api');
    renderHook(() => useSubmitStatutoryRecord());
    const config = getLastMutationConfig();
    await config.mutationFn({ id: 'stat-1', submittedBy: 'adviser@example.com' });
    expect(statutoryApi.markAsSubmitted).toHaveBeenCalledWith('stat-1', 'adviser@example.com');
  });

  it('onSuccess invalidates statutory, statutoryRecord, and stats', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useSubmitStatutoryRecord());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, { id: 'stat-1', submittedBy: 'user' }, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(3);
    expect(toast.success).toHaveBeenCalledWith('Statutory return submitted successfully');
  });

  it('onError calls toast.error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useSubmitStatutoryRecord());
    const config = getLastMutationConfig();
    await config.onError(new Error('Submit error'));
    expect(toast.error).toHaveBeenCalledWith('Failed to submit: Submit error');
  });
});

// ============================================================================
// TCF MUTATIONS
// ============================================================================

describe('useCreateTCFAssessment', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useCreateTCFAssessment());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls tcfApi.create in mutationFn', async () => {
    const { tcfApi } = await import('../../api');
    renderHook(() => useCreateTCFAssessment());
    const config = getLastMutationConfig();
    const data = { outcome: 1 };
    await config.mutationFn(data);
    expect(tcfApi.create).toHaveBeenCalledWith(data);
  });

  it('onSuccess invalidates tcf and stats, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreateTCFAssessment());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('TCF assessment created successfully');
  });
});

describe('useUpdateTCFAssessment', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useUpdateTCFAssessment());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls tcfApi.update with id and data in mutationFn', async () => {
    const { tcfApi } = await import('../../api');
    renderHook(() => useUpdateTCFAssessment());
    const config = getLastMutationConfig();
    await config.mutationFn({ id: 'tcf-1', data: { notes: 'Updated notes' } });
    expect(tcfApi.update).toHaveBeenCalledWith('tcf-1', { notes: 'Updated notes' });
  });

  it('onSuccess invalidates tcf and stats, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useUpdateTCFAssessment());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('Compliance record updated successfully');
  });
});

// ============================================================================
// RECORD KEEPING MUTATIONS
// ============================================================================

describe('useCreateRecordKeepingEntry', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useCreateRecordKeepingEntry());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls recordKeepingApi.create in mutationFn', async () => {
    const { recordKeepingApi } = await import('../../api');
    renderHook(() => useCreateRecordKeepingEntry());
    const config = getLastMutationConfig();
    const data = { title: 'Record entry' };
    await config.mutationFn(data);
    expect(recordKeepingApi.create).toHaveBeenCalledWith(data);
  });

  it('onSuccess invalidates recordKeeping, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreateRecordKeepingEntry());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Compliance record created successfully');
  });

  it('onError calls toast.error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreateRecordKeepingEntry());
    const config = getLastMutationConfig();
    await config.onError(new Error('Record error'));
    expect(toast.error).toHaveBeenCalledWith('Failed to create compliance record: Record error');
  });
});

describe('useMarkForDisposal', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useMarkForDisposal());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls recordKeepingApi.markForDisposal with id', async () => {
    const { recordKeepingApi } = await import('../../api');
    renderHook(() => useMarkForDisposal());
    const config = getLastMutationConfig();
    await config.mutationFn('record-1');
    expect(recordKeepingApi.markForDisposal).toHaveBeenCalledWith('record-1');
  });

  it('onSuccess invalidates recordKeeping, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useMarkForDisposal());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Record marked for disposal');
  });
});

// ============================================================================
// DEBARMENT & SUPERVISION MUTATIONS
// ============================================================================

describe('useRunDebarmentCheck', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useRunDebarmentCheck());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls debarmentSupervisionApi.runCheck with adviserId in mutationFn', async () => {
    const { debarmentSupervisionApi } = await import('../../api');
    renderHook(() => useRunDebarmentCheck());
    const config = getLastMutationConfig();
    await config.mutationFn('adviser-1');
    expect(debarmentSupervisionApi.runCheck).toHaveBeenCalledWith('adviser-1');
  });

  it('onSuccess invalidates debarments, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useRunDebarmentCheck());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Compliance check completed successfully');
  });

  it('onError calls toast.error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useRunDebarmentCheck());
    const config = getLastMutationConfig();
    await config.onError(new Error('Debarment check failed'));
    expect(toast.error).toHaveBeenCalledWith('Compliance check failed: Debarment check failed');
  });
});

describe('useCreateSupervisionRecord', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useCreateSupervisionRecord());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls debarmentSupervisionApi.createSupervision in mutationFn', async () => {
    const { debarmentSupervisionApi } = await import('../../api');
    renderHook(() => useCreateSupervisionRecord());
    const config = getLastMutationConfig();
    const data = { adviserId: 'adviser-1' };
    await config.mutationFn(data);
    expect(debarmentSupervisionApi.createSupervision).toHaveBeenCalledWith(data);
  });

  it('onSuccess invalidates supervision, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreateSupervisionRecord());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Compliance record created successfully');
  });
});

// ============================================================================
// CONFLICTS & MARKETING MUTATIONS
// ============================================================================

describe('useCreateConflictRecord', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useCreateConflictRecord());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls conflictsMarketingApi.createConflict in mutationFn', async () => {
    const { conflictsMarketingApi } = await import('../../api');
    renderHook(() => useCreateConflictRecord());
    const config = getLastMutationConfig();
    const data = { description: 'Conflict description' };
    await config.mutationFn(data);
    expect(conflictsMarketingApi.createConflict).toHaveBeenCalledWith(data);
  });

  it('onSuccess invalidates conflicts, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreateConflictRecord());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Compliance record created successfully');
  });

  it('onError calls toast.error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreateConflictRecord());
    const config = getLastMutationConfig();
    await config.onError(new Error('Conflict error'));
    expect(toast.error).toHaveBeenCalledWith('Failed to create compliance record: Conflict error');
  });
});

describe('useCreateMarketingRecord', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useCreateMarketingRecord());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls conflictsMarketingApi.createMarketing in mutationFn', async () => {
    const { conflictsMarketingApi } = await import('../../api');
    renderHook(() => useCreateMarketingRecord());
    const config = getLastMutationConfig();
    const data = { title: 'Marketing campaign' };
    await config.mutationFn(data);
    expect(conflictsMarketingApi.createMarketing).toHaveBeenCalledWith(data);
  });

  it('onSuccess invalidates marketing, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreateMarketingRecord());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Compliance record created successfully');
  });
});

describe('useApproveMarketing', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useApproveMarketing());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls conflictsMarketingApi.approveMarketing with id and approvedBy', async () => {
    const { conflictsMarketingApi } = await import('../../api');
    renderHook(() => useApproveMarketing());
    const config = getLastMutationConfig();
    await config.mutationFn({ id: 'mkt-1', approvedBy: 'compliance-officer' });
    expect(conflictsMarketingApi.approveMarketing).toHaveBeenCalledWith(
      'mkt-1',
      'compliance-officer',
    );
  });

  it('onSuccess invalidates marketing, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useApproveMarketing());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Marketing material approved');
  });
});

// ============================================================================
// DOCUMENTS & INSURANCE MUTATIONS
// ============================================================================

describe('useCreateDocumentsInsuranceRecord', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useCreateDocumentsInsuranceRecord());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls documentsInsuranceApi.create in mutationFn', async () => {
    const { documentsInsuranceApi } = await import('../../api');
    renderHook(() => useCreateDocumentsInsuranceRecord());
    const config = getLastMutationConfig();
    const data = { documentType: 'PI Insurance' };
    await config.mutationFn(data);
    expect(documentsInsuranceApi.create).toHaveBeenCalledWith(data);
  });

  it('onSuccess invalidates documentsInsurance and stats, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreateDocumentsInsuranceRecord());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('Compliance record created successfully');
  });
});

describe('useRenewInsurance', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useRenewInsurance());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls documentsInsuranceApi.markAsRenewed with id', async () => {
    const { documentsInsuranceApi } = await import('../../api');
    renderHook(() => useRenewInsurance());
    const config = getLastMutationConfig();
    await config.mutationFn('ins-1');
    expect(documentsInsuranceApi.markAsRenewed).toHaveBeenCalledWith('ins-1');
  });

  it('onSuccess invalidates documentsInsurance, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useRenewInsurance());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Insurance renewed successfully');
  });
});

// ============================================================================
// NEW BUSINESS MUTATIONS
// ============================================================================

describe('useCreateNewBusinessRecord', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useCreateNewBusinessRecord());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls newBusinessApi.create in mutationFn', async () => {
    const { newBusinessApi } = await import('../../api');
    renderHook(() => useCreateNewBusinessRecord());
    const config = getLastMutationConfig();
    const data = { clientId: 'client-1', productType: 'RA' };
    await config.mutationFn(data);
    expect(newBusinessApi.create).toHaveBeenCalledWith(data);
  });

  it('onSuccess invalidates newBusiness and stats, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreateNewBusinessRecord());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('Compliance record created successfully');
  });

  it('onError calls toast.error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreateNewBusinessRecord());
    const config = getLastMutationConfig();
    await config.onError(new Error('New business error'));
    expect(toast.error).toHaveBeenCalledWith(
      'Failed to create compliance record: New business error',
    );
  });
});

// ============================================================================
// COMPLAINTS MUTATIONS
// ============================================================================

describe('useCreateComplaint', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useCreateComplaint());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls complaintsApi.create in mutationFn', async () => {
    const { complaintsApi } = await import('../../api');
    renderHook(() => useCreateComplaint());
    const config = getLastMutationConfig();
    const data = { category: 'service', description: 'Poor service' };
    await config.mutationFn(data);
    expect(complaintsApi.create).toHaveBeenCalledWith(data);
  });

  it('onSuccess invalidates complaints and stats, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreateComplaint());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('Complaint submitted successfully');
  });

  it('onError calls toast.error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useCreateComplaint());
    const config = getLastMutationConfig();
    await config.onError(new Error('Complaint error'));
    expect(toast.error).toHaveBeenCalledWith('Failed to submit complaint: Complaint error');
  });
});

describe('useUpdateComplaint', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useUpdateComplaint());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls complaintsApi.update with id and data', async () => {
    const { complaintsApi } = await import('../../api');
    renderHook(() => useUpdateComplaint());
    const config = getLastMutationConfig();
    await config.mutationFn({ id: 'comp-1', data: { status: 'acknowledged' } });
    expect(complaintsApi.update).toHaveBeenCalledWith('comp-1', { status: 'acknowledged' });
  });

  it('onSuccess invalidates complaints and complaint, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useUpdateComplaint());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, { id: 'comp-1', data: {} }, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('Compliance record updated successfully');
  });

  it('onError calls toast.error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useUpdateComplaint());
    const config = getLastMutationConfig();
    await config.onError(new Error('Update error'));
    expect(toast.error).toHaveBeenCalledWith('Failed to update compliance record: Update error');
  });
});

describe('useResolveComplaint', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useResolveComplaint());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls complaintsApi.resolve with id, resolution, and outcome', async () => {
    const { complaintsApi } = await import('../../api');
    renderHook(() => useResolveComplaint());
    const config = getLastMutationConfig();
    await config.mutationFn({
      id: 'comp-1',
      resolution: 'Resolved by refund',
      outcome: 'client-satisfied',
    });
    expect(complaintsApi.resolve).toHaveBeenCalledWith(
      'comp-1',
      'Resolved by refund',
      'client-satisfied',
    );
  });

  it('onSuccess invalidates complaints, complaint, and stats, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useResolveComplaint());
    const config = getLastMutationConfig();
    await config.onSuccess(
      undefined,
      { id: 'comp-1', resolution: 'resolved', outcome: 'satisfied' },
      undefined,
    );
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(3);
    expect(toast.success).toHaveBeenCalledWith('Complaint resolved successfully');
  });

  it('onError calls toast.error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useResolveComplaint());
    const config = getLastMutationConfig();
    await config.onError(new Error('Resolve error'));
    expect(toast.error).toHaveBeenCalledWith('Failed to resolve: Resolve error');
  });
});

describe('useEscalateComplaint', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useEscalateComplaint());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls complaintsApi.escalate with id and escalatedTo', async () => {
    const { complaintsApi } = await import('../../api');
    renderHook(() => useEscalateComplaint());
    const config = getLastMutationConfig();
    await config.mutationFn({ id: 'comp-1', escalatedTo: 'senior-manager' });
    expect(complaintsApi.escalate).toHaveBeenCalledWith('comp-1', 'senior-manager');
  });

  it('onSuccess invalidates complaints and complaint, calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useEscalateComplaint());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, { id: 'comp-1', escalatedTo: 'senior-manager' }, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('Complaint escalated successfully');
  });

  it('onError calls toast.error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useEscalateComplaint());
    const config = getLastMutationConfig();
    await config.onError(new Error('Escalation error'));
    expect(toast.error).toHaveBeenCalledWith('Failed to escalate: Escalation error');
  });
});

// ============================================================================
// OVERVIEW MUTATIONS
// ============================================================================

describe('useRefreshCompliance', () => {
  it('returns a mutation object with mutate property', () => {
    const { result } = renderHook(() => useRefreshCompliance());
    expect(result.current).toHaveProperty('mutate');
  });

  it('calls complianceOverviewApi.refreshAll in mutationFn', async () => {
    const { complianceOverviewApi } = await import('../../api');
    renderHook(() => useRefreshCompliance());
    const config = getLastMutationConfig();
    await config.mutationFn(undefined);
    expect(complianceOverviewApi.refreshAll).toHaveBeenCalled();
  });

  it('onSuccess invalidates all compliance queries and calls toast.success', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useRefreshCompliance());
    const config = getLastMutationConfig();
    await config.onSuccess(undefined, undefined, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    // The call should include the root 'compliance' key
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['compliance'],
    });
    expect(toast.success).toHaveBeenCalledWith('Compliance data refreshed successfully');
  });

  it('onError calls toast.error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useRefreshCompliance());
    const config = getLastMutationConfig();
    await config.onError(new Error('Refresh error'));
    expect(toast.error).toHaveBeenCalledWith('Failed to refresh: Refresh error');
  });
});
