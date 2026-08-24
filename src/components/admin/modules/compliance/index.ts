/**
 * compliance module — public API.
 *
 * Pure re-export barrel: the module component lives in ComplianceModule.tsx.
 * Everything other modules and outside code may use is named here, so the
 * module's internals stay private (see .dependency-cruiser.cjs).
 */
export { ComplianceModule } from './ComplianceModule';

// ==================== TYPES ====================
export * from './types';

// ==================== CONSTANTS ====================
export * from './constants';

// ==================== API ====================
export {
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
  complianceApi, // Legacy
} from './api';

// ==================== HOOKS ====================
// React Query hooks (recommended)
export {
  // Query keys
  complianceKeys,

  // FAIS queries
  useFAISRecords,
  useFAISRecord,
  useFAISByAdviser,
  useCreateFAISRecord,
  useUpdateFAISRecord,
  useDeleteFAISRecord,

  // AML/FICA queries & mutations
  useAMLFICARecords,
  useAMLFICAByClient,
  useCreateAMLCheck,
  useRunAMLScreening,

  // POPI/PAIA queries & mutations
  usePOPIAConsents,
  usePOPIAConsentsByUser,
  usePAIARequests,
  useRecordConsent,
  useWithdrawConsent,
  useCreatePAIARequest,
  useUpdatePAIARequest,

  // Statutory queries & mutations
  useStatutoryRecords,
  useStatutoryRecord,
  useCreateStatutoryRecord,
  useSubmitStatutoryRecord,

  // TCF queries & mutations
  useTCFRecords,
  useCreateTCFAssessment,
  useUpdateTCFAssessment,

  // Record Keeping queries & mutations
  useRecordKeeping,
  useCreateRecordKeepingEntry,
  useMarkForDisposal,

  // Debarment & Supervision queries & mutations
  useDebarmentRecords,
  useSupervisionRecords,
  useRunDebarmentCheck,
  useCreateSupervisionRecord,

  // Conflicts & Marketing queries & mutations
  useConflictRecords,
  useMarketingRecords,
  useCreateConflictRecord,
  useCreateMarketingRecord,
  useApproveMarketing,

  // Documents & Insurance queries & mutations
  useDocumentsInsuranceRecords,
  useCreateDocumentsInsuranceRecord,
  useRenewInsurance,

  // New Business queries & mutations
  useNewBusinessRecords,
  useNewBusinessByClient,
  useCreateNewBusinessRecord,

  // Complaints queries & mutations
  useComplaints,
  useComplaint,
  useCreateComplaint,
  useUpdateComplaint,
  useResolveComplaint,
  useEscalateComplaint,

  // Overview queries & mutations
  useComplianceActivities,
  useComplianceDeadlines,
  useComplianceStats,
  useComplianceOverview,
  useRefreshCompliance,
} from './hooks';

// ==================== LEGACY HOOKS (backward compatibility) ====================
export {
  useFAISRecordsLegacy,
  useStatutoryRecordsLegacy,
  useDocumentsInsuranceRecordsLegacy,
  useComplianceOverviewLegacy,
} from './hooks';

// --- public API used by other modules and by code outside admin/modules ---
export { ComplianceSkeleton } from './components/ComplianceSkeleton';
