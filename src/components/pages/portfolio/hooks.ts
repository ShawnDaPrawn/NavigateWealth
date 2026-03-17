/**
 * Client Portal — Portfolio Hooks
 * React Query hooks for the portfolio dashboard (Guidelines §6)
 *
 * All server state is managed by React Query.
 * Hooks are narrowly scoped and named after intent.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchPortfolioSummary } from './api';

/** Query key factory for portfolio data */
export const portfolioKeys = {
  all: ['portfolio'] as const,
  summary: (clientId: string) => [...portfolioKeys.all, 'summary', clientId] as const,
};

/**
 * Fetch the full portfolio summary for a client.
 * Enabled only when clientId is provided.
 */
export function usePortfolioSummary(clientId: string | undefined) {
  return useQuery({
    queryKey: portfolioKeys.summary(clientId || ''),
    queryFn: () => fetchPortfolioSummary(clientId!),
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ── Mutation hooks for portfolio actions ──

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookMeeting, uploadDocument } from './api';
import type { BookMeetingInput, UploadDocumentInput } from './api';

/**
 * Book a meeting via the calendar API.
 * On success, invalidates portfolio data to refresh upcoming events.
 *
 * Auth token is resolved internally by the API layer via getAccessToken()
 * — no need to pass it as a hook parameter.
 */
export function useBookMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BookMeetingInput) => bookMeeting(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.all });
    },
  });
}

/**
 * Upload a document via the documents API.
 * On success, invalidates portfolio data to refresh recent documents.
 *
 * Auth token is resolved internally by the API layer via getAccessToken()
 * — no need to pass it as a hook parameter.
 */
export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadDocumentInput) => uploadDocument(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.all });
    },
  });
}