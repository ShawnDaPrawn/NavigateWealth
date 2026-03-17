/**
 * AI Analytics Hook
 *
 * React Query hook for fetching AI generation analytics data.
 *
 * @module social-media/hooks/useAIAnalytics
 */

import { useQuery } from '@tanstack/react-query';
import { socialMediaAIApi } from '../api';
import { socialMediaKeys } from './queryKeys';
import type { AIAnalyticsSummary } from '../types';

export function useAIAnalytics() {
  const analyticsQuery = useQuery({
    queryKey: socialMediaKeys.ai.analytics(),
    queryFn: () => socialMediaAIApi.getAIAnalyticsSummary(),
    staleTime: 2 * 60 * 1000,
  });

  return {
    analytics: (analyticsQuery.data?.data || null) as AIAnalyticsSummary | null,
    analyticsLoading: analyticsQuery.isLoading,
    analyticsError: analyticsQuery.data?.error || null,
    refetchAnalytics: analyticsQuery.refetch,
  };
}
