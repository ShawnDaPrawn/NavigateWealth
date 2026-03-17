/**
 * Compliance Mutation Hooks
 * Navigate Wealth Admin Dashboard
 * 
 * React Query mutation hooks for compliance create, update, and delete operations.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import {
  faisApi,
  amlFicaApi,
  popiPaiaApi,
  statutoryApi,
  tcfApi,
  recordKeepingApi,
  debarmentSupervisionApi,
  conflictsMarketingApi,
  documentsInsuranceApi,
  newBusinessApi,
  complaintsApi,
  complianceOverviewApi,
} from '../api';
import { complianceKeys } from './useComplianceQueries';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '../constants';
import type {
  FAISRecord,
  AMLFICARecord,
  POPIAConsentRecord,
  PAIARequest,
  StatutoryRecord,
  TCFRecord,
  RecordKeepingEntry,
  SupervisionRecord,
  ConflictRecord,
  MarketingRecord,
  DocumentsInsuranceRecord,
  NewBusinessRecord,
  ComplaintRecord,
  CreateRecordRequest,
  UpdateRecordRequest,
} from '../types';

// ============================================================================
// FAIS MUTATIONS
// ============================================================================

/**
 * Hook to create FAIS record
 */
export function useCreateFAISRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecordRequest<FAISRecord>) => faisApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.fais() });
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() });
      toast.success(SUCCESS_MESSAGES.RECORD_CREATED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to create FAIS record:', error);
      toast.error(`${ERROR_MESSAGES.CREATE_FAILED}: ${error.message}`);
    },
  });
}

/**
 * Hook to update FAIS record
 */
export function useUpdateFAISRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRecordRequest<FAISRecord> }) =>
      faisApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.fais() });
      queryClient.invalidateQueries({ queryKey: complianceKeys.faisRecord(variables.id) });
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() });
      toast.success(SUCCESS_MESSAGES.RECORD_UPDATED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to update FAIS record:', error);
      toast.error(`${ERROR_MESSAGES.UPDATE_FAILED}: ${error.message}`);
    },
  });
}

/**
 * Hook to delete FAIS record
 */
export function useDeleteFAISRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => faisApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.fais() });
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() });
      toast.success(SUCCESS_MESSAGES.RECORD_DELETED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to delete FAIS record:', error);
      toast.error(`${ERROR_MESSAGES.DELETE_FAILED}: ${error.message}`);
    },
  });
}

// ============================================================================
// AML/FICA MUTATIONS
// ============================================================================

/**
 * Hook to create AML/FICA check
 */
export function useCreateAMLCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecordRequest<AMLFICARecord>) => amlFicaApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.amlFica() });
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() });
      toast.success(SUCCESS_MESSAGES.CHECK_COMPLETED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to create AML check:', error);
      toast.error(`${ERROR_MESSAGES.CHECK_FAILED}: ${error.message}`);
    },
  });
}

/**
 * Hook to run AML screening
 */
export function useRunAMLScreening() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clientId: string) => amlFicaApi.runScreening(clientId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.amlFica() });
      queryClient.invalidateQueries({ queryKey: complianceKeys.amlFicaByClient(data.clientId) });
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() });
      toast.success(SUCCESS_MESSAGES.CHECK_COMPLETED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to run screening:', error);
      toast.error(`${ERROR_MESSAGES.CHECK_FAILED}: ${error.message}`);
    },
  });
}

// ============================================================================
// POPI/PAIA MUTATIONS
// ============================================================================

/**
 * Hook to record POPIA consent
 */
export function useRecordConsent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecordRequest<POPIAConsentRecord>) => popiPaiaApi.recordConsent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.popiaConsents() });
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() });
      toast.success(SUCCESS_MESSAGES.CONSENT_RECORDED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to record consent:', error);
      toast.error(`${ERROR_MESSAGES.CONSENT_FAILED}: ${error.message}`);
    },
  });
}

/**
 * Hook to withdraw consent
 */
export function useWithdrawConsent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => popiPaiaApi.withdrawConsent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.popiaConsents() });
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() });
      toast.success('Consent withdrawn successfully');
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to withdraw consent:', error);
      toast.error(`Failed to withdraw consent: ${error.message}`);
    },
  });
}

/**
 * Hook to create PAIA request
 */
export function useCreatePAIARequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecordRequest<PAIARequest>) => popiPaiaApi.createPAIARequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.paiaRequests() });
      toast.success('PAIA request created successfully');
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to create PAIA request:', error);
      toast.error(`${ERROR_MESSAGES.CREATE_FAILED}: ${error.message}`);
    },
  });
}

/**
 * Hook to update PAIA request
 */
export function useUpdatePAIARequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRecordRequest<PAIARequest> }) =>
      popiPaiaApi.updatePAIARequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.paiaRequests() });
      toast.success(SUCCESS_MESSAGES.RECORD_UPDATED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to update PAIA request:', error);
      toast.error(`${ERROR_MESSAGES.UPDATE_FAILED}: ${error.message}`);
    },
  });
}

// ============================================================================
// STATUTORY MUTATIONS
// ============================================================================

/**
 * Hook to create statutory record
 */
export function useCreateStatutoryRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecordRequest<StatutoryRecord>) => statutoryApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.statutory() });
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() });
      toast.success(SUCCESS_MESSAGES.RECORD_CREATED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to create statutory record:', error);
      toast.error(`${ERROR_MESSAGES.CREATE_FAILED}: ${error.message}`);
    },
  });
}

/**
 * Hook to mark statutory record as submitted
 */
export function useSubmitStatutoryRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, submittedBy }: { id: string; submittedBy: string }) =>
      statutoryApi.markAsSubmitted(id, submittedBy),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.statutory() });
      queryClient.invalidateQueries({ queryKey: complianceKeys.statutoryRecord(variables.id) });
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() });
      toast.success('Statutory return submitted successfully');
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to submit statutory record:', error);
      toast.error(`Failed to submit: ${error.message}`);
    },
  });
}

// ============================================================================
// TCF MUTATIONS
// ============================================================================

/**
 * Hook to create TCF assessment
 */
export function useCreateTCFAssessment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecordRequest<TCFRecord>) => tcfApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.tcf() });
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() });
      toast.success('TCF assessment created successfully');
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to create TCF assessment:', error);
      toast.error(`${ERROR_MESSAGES.CREATE_FAILED}: ${error.message}`);
    },
  });
}

/**
 * Hook to update TCF assessment
 */
export function useUpdateTCFAssessment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRecordRequest<TCFRecord> }) =>
      tcfApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.tcf() });
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() });
      toast.success(SUCCESS_MESSAGES.RECORD_UPDATED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to update TCF assessment:', error);
      toast.error(`${ERROR_MESSAGES.UPDATE_FAILED}: ${error.message}`);
    },
  });
}

// ============================================================================
// RECORD KEEPING MUTATIONS
// ============================================================================

/**
 * Hook to create record keeping entry
 */
export function useCreateRecordKeepingEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecordRequest<RecordKeepingEntry>) => recordKeepingApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.recordKeeping() });
      toast.success(SUCCESS_MESSAGES.RECORD_CREATED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to create record keeping entry:', error);
      toast.error(`${ERROR_MESSAGES.CREATE_FAILED}: ${error.message}`);
    },
  });
}

/**
 * Hook to mark record for disposal
 */
export function useMarkForDisposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => recordKeepingApi.markForDisposal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.recordKeeping() });
      toast.success('Record marked for disposal');
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to mark for disposal:', error);
      toast.error(`Failed: ${error.message}`);
    },
  });
}

// ============================================================================
// DEBARMENT & SUPERVISION MUTATIONS
// ============================================================================

/**
 * Hook to run debarment check
 */
export function useRunDebarmentCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (adviserId: string) => debarmentSupervisionApi.runCheck(adviserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.debarments() });
      toast.success(SUCCESS_MESSAGES.CHECK_COMPLETED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to run debarment check:', error);
      toast.error(`${ERROR_MESSAGES.CHECK_FAILED}: ${error.message}`);
    },
  });
}

/**
 * Hook to create supervision record
 */
export function useCreateSupervisionRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecordRequest<SupervisionRecord>) =>
      debarmentSupervisionApi.createSupervision(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.supervision() });
      toast.success(SUCCESS_MESSAGES.RECORD_CREATED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to create supervision record:', error);
      toast.error(`${ERROR_MESSAGES.CREATE_FAILED}: ${error.message}`);
    },
  });
}

// ============================================================================
// CONFLICTS & MARKETING MUTATIONS
// ============================================================================

/**
 * Hook to create conflict record
 */
export function useCreateConflictRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecordRequest<ConflictRecord>) => conflictsMarketingApi.createConflict(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.conflicts() });
      toast.success(SUCCESS_MESSAGES.RECORD_CREATED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to create conflict record:', error);
      toast.error(`${ERROR_MESSAGES.CREATE_FAILED}: ${error.message}`);
    },
  });
}

/**
 * Hook to create marketing record
 */
export function useCreateMarketingRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecordRequest<MarketingRecord>) => conflictsMarketingApi.createMarketing(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.marketing() });
      toast.success(SUCCESS_MESSAGES.RECORD_CREATED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to create marketing record:', error);
      toast.error(`${ERROR_MESSAGES.CREATE_FAILED}: ${error.message}`);
    },
  });
}

/**
 * Hook to approve marketing material
 */
export function useApproveMarketing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, approvedBy }: { id: string; approvedBy: string }) =>
      conflictsMarketingApi.approveMarketing(id, approvedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.marketing() });
      toast.success('Marketing material approved');
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to approve marketing:', error);
      toast.error(`Failed to approve: ${error.message}`);
    },
  });
}

// ============================================================================
// DOCUMENTS & INSURANCE MUTATIONS
// ============================================================================

/**
 * Hook to create documents & insurance record
 */
export function useCreateDocumentsInsuranceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecordRequest<DocumentsInsuranceRecord>) => documentsInsuranceApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.documentsInsurance() });
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() });
      toast.success(SUCCESS_MESSAGES.RECORD_CREATED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to create documents/insurance record:', error);
      toast.error(`${ERROR_MESSAGES.CREATE_FAILED}: ${error.message}`);
    },
  });
}

/**
 * Hook to mark insurance as renewed
 */
export function useRenewInsurance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => documentsInsuranceApi.markAsRenewed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.documentsInsurance() });
      toast.success('Insurance renewed successfully');
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to renew insurance:', error);
      toast.error(`Failed to renew: ${error.message}`);
    },
  });
}

// ============================================================================
// NEW BUSINESS MUTATIONS
// ============================================================================

/**
 * Hook to create new business record
 */
export function useCreateNewBusinessRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecordRequest<NewBusinessRecord>) => newBusinessApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.newBusiness() });
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() });
      toast.success(SUCCESS_MESSAGES.RECORD_CREATED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to create new business record:', error);
      toast.error(`${ERROR_MESSAGES.CREATE_FAILED}: ${error.message}`);
    },
  });
}

// ============================================================================
// COMPLAINTS MUTATIONS
// ============================================================================

/**
 * Hook to create complaint
 */
export function useCreateComplaint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecordRequest<ComplaintRecord>) => complaintsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.complaints() });
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() });
      toast.success(SUCCESS_MESSAGES.COMPLAINT_SUBMITTED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to create complaint:', error);
      toast.error(`${ERROR_MESSAGES.COMPLAINT_FAILED}: ${error.message}`);
    },
  });
}

/**
 * Hook to update complaint
 */
export function useUpdateComplaint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRecordRequest<ComplaintRecord> }) =>
      complaintsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.complaints() });
      queryClient.invalidateQueries({ queryKey: complianceKeys.complaint(variables.id) });
      toast.success(SUCCESS_MESSAGES.RECORD_UPDATED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to update complaint:', error);
      toast.error(`${ERROR_MESSAGES.UPDATE_FAILED}: ${error.message}`);
    },
  });
}

/**
 * Hook to resolve complaint
 */
export function useResolveComplaint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, resolution, outcome }: { id: string; resolution: string; outcome: string }) =>
      complaintsApi.resolve(id, resolution, outcome),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.complaints() });
      queryClient.invalidateQueries({ queryKey: complianceKeys.complaint(variables.id) });
      queryClient.invalidateQueries({ queryKey: complianceKeys.stats() });
      toast.success(SUCCESS_MESSAGES.COMPLAINT_RESOLVED);
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to resolve complaint:', error);
      toast.error(`Failed to resolve: ${error.message}`);
    },
  });
}

/**
 * Hook to escalate complaint
 */
export function useEscalateComplaint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, escalatedTo }: { id: string; escalatedTo: string }) =>
      complaintsApi.escalate(id, escalatedTo),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.complaints() });
      queryClient.invalidateQueries({ queryKey: complianceKeys.complaint(variables.id) });
      toast.success('Complaint escalated successfully');
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to escalate complaint:', error);
      toast.error(`Failed to escalate: ${error.message}`);
    },
  });
}

// ============================================================================
// OVERVIEW MUTATIONS
// ============================================================================

/**
 * Hook to refresh all compliance checks
 */
export function useRefreshCompliance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => complianceOverviewApi.refreshAll(),
    onSuccess: () => {
      // Invalidate all compliance queries
      queryClient.invalidateQueries({ queryKey: complianceKeys.all });
      toast.success('Compliance data refreshed successfully');
    },
    onError: (error: Error) => {
      console.error('❌ [Compliance Mutation] Failed to refresh compliance:', error);
      toast.error(`Failed to refresh: ${error.message}`);
    },
  });
}
