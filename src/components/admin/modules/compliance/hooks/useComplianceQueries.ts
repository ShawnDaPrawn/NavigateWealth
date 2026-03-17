/**
 * Compliance Query Hooks
 * Navigate Wealth Admin Dashboard
 * 
 * React Query hooks for fetching compliance data with caching and automatic refetching.
 */

import { useQuery } from '@tanstack/react-query';
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
import { QUERY_STALE_TIME, QUERY_GC_TIME } from '../constants';

// ============================================================================
// QUERY KEY FACTORY
// ============================================================================

export const complianceKeys = {
  all: ['compliance'] as const,
  
  // FAIS
  fais: () => [...complianceKeys.all, 'fais'] as const,
  faisRecord: (id: string) => [...complianceKeys.fais(), id] as const,
  faisByAdviser: (id: string) => [...complianceKeys.fais(), 'adviser', id] as const,
  
  // AML/FICA
  amlFica: () => [...complianceKeys.all, 'aml-fica'] as const,
  amlFicaRecord: (id: string) => [...complianceKeys.amlFica(), id] as const,
  amlFicaByClient: (id: string) => [...complianceKeys.amlFica(), 'client', id] as const,
  
  // POPI/PAIA
  popiPaia: () => [...complianceKeys.all, 'popi-paia'] as const,
  popiaConsents: () => [...complianceKeys.popiPaia(), 'consents'] as const,
  popiaConsentsByUser: (id: string) => [...complianceKeys.popiaConsents(), 'user', id] as const,
  paiaRequests: () => [...complianceKeys.popiPaia(), 'paia-requests'] as const,
  
  // Statutory
  statutory: () => [...complianceKeys.all, 'statutory'] as const,
  statutoryRecord: (id: string) => [...complianceKeys.statutory(), id] as const,
  
  // TCF
  tcf: () => [...complianceKeys.all, 'tcf'] as const,
  
  // Record Keeping
  recordKeeping: () => [...complianceKeys.all, 'record-keeping'] as const,
  
  // Debarment & Supervision
  debarmentSupervision: () => [...complianceKeys.all, 'debarment-supervision'] as const,
  debarments: () => [...complianceKeys.debarmentSupervision(), 'debarments'] as const,
  supervision: () => [...complianceKeys.debarmentSupervision(), 'supervision'] as const,
  
  // Conflicts & Marketing
  conflictsMarketing: () => [...complianceKeys.all, 'conflicts-marketing'] as const,
  conflicts: () => [...complianceKeys.conflictsMarketing(), 'conflicts'] as const,
  marketing: () => [...complianceKeys.conflictsMarketing(), 'marketing'] as const,
  
  // Documents & Insurance
  documentsInsurance: () => [...complianceKeys.all, 'documents-insurance'] as const,
  
  // New Business
  newBusiness: () => [...complianceKeys.all, 'new-business'] as const,
  newBusinessByClient: (id: string) => [...complianceKeys.newBusiness(), 'client', id] as const,
  
  // Complaints
  complaints: () => [...complianceKeys.all, 'complaints'] as const,
  complaint: (id: string) => [...complianceKeys.complaints(), id] as const,
  
  // Overview
  activities: () => [...complianceKeys.all, 'activities'] as const,
  deadlines: () => [...complianceKeys.all, 'deadlines'] as const,
  stats: () => [...complianceKeys.all, 'stats'] as const,
};

// ============================================================================
// FAIS QUERIES
// ============================================================================

/**
 * Hook to fetch all FAIS records
 */
export function useFAISRecords(enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.fais(),
    queryFn: faisApi.getAll,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled,
  });
}

/**
 * Hook to fetch single FAIS record
 */
export function useFAISRecord(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.faisRecord(id),
    queryFn: () => faisApi.getById(id),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled: enabled && !!id,
  });
}

/**
 * Hook to fetch FAIS records by adviser
 */
export function useFAISByAdviser(adviserId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.faisByAdviser(adviserId),
    queryFn: () => faisApi.getByAdviser(adviserId),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled: enabled && !!adviserId,
  });
}

// ============================================================================
// AML/FICA QUERIES
// ============================================================================

/**
 * Hook to fetch all AML/FICA records
 */
export function useAMLFICARecords(enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.amlFica(),
    queryFn: amlFicaApi.getAll,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled,
  });
}

/**
 * Hook to fetch AML/FICA records by client
 */
export function useAMLFICAByClient(clientId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.amlFicaByClient(clientId),
    queryFn: () => amlFicaApi.getByClient(clientId),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled: enabled && !!clientId,
  });
}

// ============================================================================
// POPI/PAIA QUERIES
// ============================================================================

/**
 * Hook to fetch all POPIA consents
 */
export function usePOPIAConsents(enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.popiaConsents(),
    queryFn: popiPaiaApi.getAllConsents,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled,
  });
}

/**
 * Hook to fetch consents by user
 */
export function usePOPIAConsentsByUser(userId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.popiaConsentsByUser(userId),
    queryFn: () => popiPaiaApi.getConsentsByUser(userId),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled: enabled && !!userId,
  });
}

/**
 * Hook to fetch all PAIA requests
 */
export function usePAIARequests(enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.paiaRequests(),
    queryFn: popiPaiaApi.getAllPAIARequests,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled,
  });
}

// ============================================================================
// STATUTORY QUERIES
// ============================================================================

/**
 * Hook to fetch all statutory records
 */
export function useStatutoryRecords(enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.statutory(),
    queryFn: statutoryApi.getAll,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled,
  });
}

/**
 * Hook to fetch single statutory record
 */
export function useStatutoryRecord(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.statutoryRecord(id),
    queryFn: () => statutoryApi.getById(id),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled: enabled && !!id,
  });
}

// ============================================================================
// TCF QUERIES
// ============================================================================

/**
 * Hook to fetch all TCF records
 */
export function useTCFRecords(enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.tcf(),
    queryFn: tcfApi.getAll,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled,
  });
}

// ============================================================================
// RECORD KEEPING QUERIES
// ============================================================================

/**
 * Hook to fetch all record keeping entries
 */
export function useRecordKeeping(enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.recordKeeping(),
    queryFn: recordKeepingApi.getAll,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled,
  });
}

// ============================================================================
// DEBARMENT & SUPERVISION QUERIES
// ============================================================================

/**
 * Hook to fetch all debarment records
 */
export function useDebarmentRecords(enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.debarments(),
    queryFn: debarmentSupervisionApi.getAllDebarments,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled,
  });
}

/**
 * Hook to fetch all supervision records
 */
export function useSupervisionRecords(enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.supervision(),
    queryFn: debarmentSupervisionApi.getAllSupervision,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled,
  });
}

// ============================================================================
// CONFLICTS & MARKETING QUERIES
// ============================================================================

/**
 * Hook to fetch all conflict records
 */
export function useConflictRecords(enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.conflicts(),
    queryFn: conflictsMarketingApi.getAllConflicts,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled,
  });
}

/**
 * Hook to fetch all marketing records
 */
export function useMarketingRecords(enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.marketing(),
    queryFn: conflictsMarketingApi.getAllMarketing,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled,
  });
}

// ============================================================================
// DOCUMENTS & INSURANCE QUERIES
// ============================================================================

/**
 * Hook to fetch all documents & insurance records
 */
export function useDocumentsInsuranceRecords(enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.documentsInsurance(),
    queryFn: documentsInsuranceApi.getAll,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled,
  });
}

// ============================================================================
// NEW BUSINESS QUERIES
// ============================================================================

/**
 * Hook to fetch all new business records
 */
export function useNewBusinessRecords(enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.newBusiness(),
    queryFn: newBusinessApi.getAll,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled,
  });
}

/**
 * Hook to fetch new business records by client
 */
export function useNewBusinessByClient(clientId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.newBusinessByClient(clientId),
    queryFn: () => newBusinessApi.getByClient(clientId),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled: enabled && !!clientId,
  });
}

// ============================================================================
// COMPLAINTS QUERIES
// ============================================================================

/**
 * Hook to fetch all complaints
 */
export function useComplaints(enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.complaints(),
    queryFn: complaintsApi.getAll,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled,
  });
}

/**
 * Hook to fetch single complaint
 */
export function useComplaint(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.complaint(id),
    queryFn: () => complaintsApi.getById(id),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled: enabled && !!id,
  });
}

// ============================================================================
// OVERVIEW QUERIES
// ============================================================================

/**
 * Hook to fetch recent compliance activities
 */
export function useComplianceActivities(limit: number = 20, enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.activities(),
    queryFn: () => complianceOverviewApi.getRecentActivities(limit),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled,
  });
}

/**
 * Hook to fetch upcoming deadlines
 */
export function useComplianceDeadlines(days: number = 30, enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.deadlines(),
    queryFn: () => complianceOverviewApi.getUpcomingDeadlines(days),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled,
  });
}

/**
 * Hook to fetch compliance statistics
 */
export function useComplianceStats(enabled: boolean = true) {
  return useQuery({
    queryKey: complianceKeys.stats(),
    queryFn: complianceOverviewApi.getStats,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled,
  });
}

// ============================================================================
// LEGACY HOOK (backward compatibility)
// ============================================================================

/**
 * Legacy hook for backward compatibility
 * Combines activities, deadlines, and stats
 */
export function useComplianceOverview() {
  const { data: activities = [], isLoading: activitiesLoading } = useComplianceActivities();
  const { data: deadlines = [], isLoading: deadlinesLoading } = useComplianceDeadlines();
  const { data: stats, isLoading: statsLoading } = useComplianceStats();

  return {
    activities,
    deadlines,
    stats,
    loading: activitiesLoading || deadlinesLoading || statsLoading,
  };
}
