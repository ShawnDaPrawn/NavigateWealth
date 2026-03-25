import type { ApplicationStats } from './types';

/**
 * Incomplete onboarding count for stats cards and nav badge.
 * Prefer `draft` + `application_in_progress` when either field is present — that sum
 * matches the Incomplete tab (draft + in_progress) and avoids showing 0 when a stale
 * or partial JSON payload has `incomplete: 0` but the decomposed counts are non-zero.
 */
export function getIncompleteCount(stats: ApplicationStats | null | undefined): number {
  if (!stats) return 0;
  const fromComponents = (stats.draft ?? 0) + (stats.application_in_progress ?? 0);
  if (typeof stats.draft === 'number' || typeof stats.application_in_progress === 'number') {
    return fromComponents;
  }
  if (typeof stats.incomplete === 'number') return stats.incomplete;
  return 0;
}

export const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
