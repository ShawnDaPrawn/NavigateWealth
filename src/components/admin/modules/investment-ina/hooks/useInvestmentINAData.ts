/**
 * useInvestmentINAData Hooks
 * React Query hooks for fetching Investment INA data
 */

import { useQuery } from '@tanstack/react-query';
import { InvestmentINAFnaAPI } from '../api';
import type { InvestmentINASession, InvestmentINAInputs } from '../types';

const QUERY_KEYS = {
  all: ['investment-ina'] as const,
  sessions: (clientId: string) => ['investment-ina', 'sessions', clientId] as const,
  detail: (sessionId: string) => ['investment-ina', 'detail', sessionId] as const,
  latestPublished: (clientId: string) => ['investment-ina', 'latest-published', clientId] as const,
  autoPopulate: (clientId: string) => ['investment-ina', 'auto-populate', clientId] as const,
};

export { QUERY_KEYS as INVESTMENT_INA_QUERY_KEYS };

/**
 * Fetch all Investment INA sessions for a client
 */
export function useInvestmentINASessions(clientId: string | undefined) {
  return useQuery<InvestmentINASession[]>({
    queryKey: QUERY_KEYS.sessions(clientId ?? ''),
    queryFn: () => InvestmentINAFnaAPI.getAllSessions(clientId!),
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a specific Investment INA session by ID
 */
export function useInvestmentINADetail(sessionId: string | undefined) {
  return useQuery<InvestmentINASession>({
    queryKey: QUERY_KEYS.detail(sessionId ?? ''),
    queryFn: () => InvestmentINAFnaAPI.getSessionById(sessionId!),
    enabled: !!sessionId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch the latest published Investment INA session for a client
 */
export function useInvestmentINALatestPublished(clientId: string | undefined) {
  return useQuery<InvestmentINASession | null>({
    queryKey: QUERY_KEYS.latestPublished(clientId ?? ''),
    queryFn: () => InvestmentINAFnaAPI.getLatestPublished(clientId!),
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Auto-populate Investment INA inputs from client profile
 */
export function useInvestmentINAAutoPopulate(clientId: string | undefined) {
  return useQuery<InvestmentINAInputs>({
    queryKey: QUERY_KEYS.autoPopulate(clientId ?? ''),
    queryFn: () => InvestmentINAFnaAPI.autoPopulateInputs(clientId!),
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
