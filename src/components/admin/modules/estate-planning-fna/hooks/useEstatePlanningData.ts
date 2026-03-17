/**
 * useEstatePlanningData Hooks
 * React Query hooks for fetching Estate Planning FNA data
 */

import { useQuery } from '@tanstack/react-query';
import { EstatePlanningAPI } from '../api';
import type { EstatePlanningSession, EstatePlanningInputs } from '../types';

const QUERY_KEYS = {
  all: ['estate-planning-fna'] as const,
  sessions: (clientId: string) => ['estate-planning-fna', 'sessions', clientId] as const,
  detail: (sessionId: string) => ['estate-planning-fna', 'detail', sessionId] as const,
  latestPublished: (clientId: string) => ['estate-planning-fna', 'latest-published', clientId] as const,
  autoPopulate: (clientId: string) => ['estate-planning-fna', 'auto-populate', clientId] as const,
};

export { QUERY_KEYS as ESTATE_PLANNING_QUERY_KEYS };

/**
 * Fetch all Estate Planning sessions for a client
 */
export function useEstatePlanningSessions(clientId: string | undefined) {
  return useQuery<EstatePlanningSession[]>({
    queryKey: QUERY_KEYS.sessions(clientId ?? ''),
    queryFn: () => EstatePlanningAPI.getAllSessions(clientId!),
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a specific Estate Planning session by ID
 */
export function useEstatePlanningDetail(sessionId: string | undefined) {
  return useQuery<EstatePlanningSession>({
    queryKey: QUERY_KEYS.detail(sessionId ?? ''),
    queryFn: () => EstatePlanningAPI.getSessionById(sessionId!),
    enabled: !!sessionId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch the latest published Estate Planning session for a client
 */
export function useEstatePlanningLatestPublished(clientId: string | undefined) {
  return useQuery<EstatePlanningSession | null>({
    queryKey: QUERY_KEYS.latestPublished(clientId ?? ''),
    queryFn: () => EstatePlanningAPI.getLatestPublished(clientId!),
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Auto-populate Estate Planning inputs from client profile
 */
export function useEstatePlanningAutoPopulate(clientId: string | undefined) {
  return useQuery<Partial<EstatePlanningInputs>>({
    queryKey: QUERY_KEYS.autoPopulate(clientId ?? ''),
    queryFn: () => EstatePlanningAPI.autoPopulateInputs(clientId!),
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
