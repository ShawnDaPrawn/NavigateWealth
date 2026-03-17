/**
 * useRetirementFNAData Hooks
 * React Query hooks for fetching Retirement FNA data
 */

import { useQuery } from '@tanstack/react-query';
import { RetirementFnaAPI } from '../api';
import type { RetirementFNASession, RetirementFNAInputs } from '../types';

const QUERY_KEYS = {
  all: ['retirement-fna'] as const,
  list: (clientId: string) => ['retirement-fna', 'list', clientId] as const,
  detail: (fnaId: string) => ['retirement-fna', 'detail', fnaId] as const,
  latestPublished: (clientId: string) => ['retirement-fna', 'latest-published', clientId] as const,
  autoPopulate: (clientId: string) => ['retirement-fna', 'auto-populate', clientId] as const,
};

export { QUERY_KEYS as RETIREMENT_FNA_QUERY_KEYS };

/**
 * Fetch all Retirement FNA sessions for a client
 */
export function useRetirementFNAList(clientId: string | undefined) {
  return useQuery<RetirementFNASession[]>({
    queryKey: QUERY_KEYS.list(clientId ?? ''),
    queryFn: () => RetirementFnaAPI.getAllForClient(clientId!),
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a specific Retirement FNA session by ID
 */
export function useRetirementFNADetail(fnaId: string | undefined) {
  return useQuery<RetirementFNASession>({
    queryKey: QUERY_KEYS.detail(fnaId ?? ''),
    queryFn: () => RetirementFnaAPI.getById(fnaId!),
    enabled: !!fnaId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch the latest published Retirement FNA for a client
 */
export function useRetirementFNALatestPublished(clientId: string | undefined) {
  return useQuery<RetirementFNASession | null>({
    queryKey: QUERY_KEYS.latestPublished(clientId ?? ''),
    queryFn: () => RetirementFnaAPI.getLatestPublished(clientId!),
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch auto-populated inputs from client profile
 */
export function useRetirementFNAAutoPopulate(clientId: string | undefined) {
  return useQuery<Partial<RetirementFNAInputs>>({
    queryKey: QUERY_KEYS.autoPopulate(clientId ?? ''),
    queryFn: () => RetirementFnaAPI.getAutoPopulatedInputs(clientId!),
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
