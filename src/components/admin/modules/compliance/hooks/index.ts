/**
 * Compliance Hooks Index
 * Navigate Wealth Admin Dashboard
 * 
 * Barrel export for all Compliance React hooks.
 */

// ==================== QUERY HOOKS ====================
export {
  // Query keys
  complianceKeys,
  
  // FAIS
  useFAISRecords,
  useFAISRecord,
  useFAISByAdviser,
  
  // AML/FICA
  useAMLFICARecords,
  useAMLFICAByClient,
  
  // POPI/PAIA
  usePOPIAConsents,
  usePOPIAConsentsByUser,
  usePAIARequests,
  
  // Statutory
  useStatutoryRecords,
  useStatutoryRecord,
  
  // TCF
  useTCFRecords,
  
  // Record Keeping
  useRecordKeeping,
  
  // Debarment & Supervision
  useDebarmentRecords,
  useSupervisionRecords,
  
  // Conflicts & Marketing
  useConflictRecords,
  useMarketingRecords,
  
  // Documents & Insurance
  useDocumentsInsuranceRecords,
  
  // New Business
  useNewBusinessRecords,
  useNewBusinessByClient,
  
  // Complaints
  useComplaints,
  useComplaint,
  
  // Overview
  useComplianceActivities,
  useComplianceDeadlines,
  useComplianceStats,
  useComplianceOverview,
} from './useComplianceQueries';

// ==================== MUTATION HOOKS ====================
export {
  // FAIS
  useCreateFAISRecord,
  useUpdateFAISRecord,
  useDeleteFAISRecord,
  
  // AML/FICA
  useCreateAMLCheck,
  useRunAMLScreening,
  
  // POPI/PAIA
  useRecordConsent,
  useWithdrawConsent,
  useCreatePAIARequest,
  useUpdatePAIARequest,
  
  // Statutory
  useCreateStatutoryRecord,
  useSubmitStatutoryRecord,
  
  // TCF
  useCreateTCFAssessment,
  useUpdateTCFAssessment,
  
  // Record Keeping
  useCreateRecordKeepingEntry,
  useMarkForDisposal,
  
  // Debarment & Supervision
  useRunDebarmentCheck,
  useCreateSupervisionRecord,
  
  // Conflicts & Marketing
  useCreateConflictRecord,
  useCreateMarketingRecord,
  useApproveMarketing,
  
  // Documents & Insurance
  useCreateDocumentsInsuranceRecord,
  useRenewInsurance,
  
  // New Business
  useCreateNewBusinessRecord,
  
  // Complaints
  useCreateComplaint,
  useUpdateComplaint,
  useResolveComplaint,
  useEscalateComplaint,
  
  // Overview
  useRefreshCompliance,
} from './useComplianceMutations';

// ==================== LEGACY HOOKS (backward compatibility) ====================
export { useFAISRecords as useFAISRecordsLegacy } from './useFAISRecords';
export { useStatutoryRecords as useStatutoryRecordsLegacy } from './useStatutoryRecords';
export { useDocumentsInsuranceRecords as useDocumentsInsuranceRecordsLegacy } from './useDocumentsInsuranceRecords';
export { useComplianceOverview as useComplianceOverviewLegacy } from './useComplianceOverview';
