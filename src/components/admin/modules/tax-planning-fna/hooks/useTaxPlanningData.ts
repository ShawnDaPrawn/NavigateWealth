/**
 * useTaxPlanningData Hooks
 * React Query hooks for fetching Tax Planning FNA data
 */

import { useQuery } from '@tanstack/react-query';
import { TaxPlanningFnaAPI } from '../api';
import type { FinalTaxPlan, TaxPlanningInputs } from '../types';

const QUERY_KEYS = {
  all: ['tax-planning-fna'] as const,
  sessions: (clientId: string) => ['tax-planning-fna', 'sessions', clientId] as const,
  latestPublished: (clientId: string) => ['tax-planning-fna', 'latest-published', clientId] as const,
  autoPopulate: (clientId: string) => ['tax-planning-fna', 'auto-populate', clientId] as const,
};

export { QUERY_KEYS as TAX_PLANNING_QUERY_KEYS };

/**
 * Fetch all Tax Planning sessions for a client
 */
export function useTaxPlanningSessions(clientId: string | undefined) {
  return useQuery<FinalTaxPlan[]>({
    queryKey: QUERY_KEYS.sessions(clientId ?? ''),
    queryFn: () => TaxPlanningFnaAPI.getAllSessions(clientId!),
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch the latest published Tax Planning session for a client
 */
export function useTaxPlanningLatestPublished(clientId: string | undefined) {
  return useQuery<FinalTaxPlan | null>({
    queryKey: QUERY_KEYS.latestPublished(clientId ?? ''),
    queryFn: () => TaxPlanningFnaAPI.getLatestPublished(clientId!),
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Auto-populate Tax Planning inputs from client profile
 */
export function useTaxPlanningAutoPopulate(clientId: string | undefined) {
  return useQuery<Partial<TaxPlanningInputs>>({
    queryKey: QUERY_KEYS.autoPopulate(clientId ?? ''),
    queryFn: () => TaxPlanningFnaAPI.autoPopulateInputs(clientId!),
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
