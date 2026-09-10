/**
 * useSocialAnalytics — aggregated Buffer metrics for the stat cards.
 *
 * Buffer refreshes metrics roughly daily, so a long stale time is honest
 * rather than lazy.
 *
 * @module social-media/hooks/useSocialAnalytics
 */

import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api';
import { socialMediaKeys } from './queryKeys';

const ANALYTICS_STALE_TIME = 15 * 60 * 1000; // 15 minutes

export function useSocialAnalytics(days = 30, enabled = true) {
  return useQuery({
    queryKey: socialMediaKeys.analytics.summary(days),
    queryFn: () => analyticsApi.getSummary(days),
    enabled,
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });
}
