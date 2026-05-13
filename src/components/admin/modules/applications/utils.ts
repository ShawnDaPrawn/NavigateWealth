import type { Application, ApplicationData, ApplicationStats } from './types';

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

export function normalizeApplicationStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => String(item || '').trim())
            .filter(Boolean);
        }
      } catch {
        // Fall through and treat the raw string as a single selection.
      }
    }

    return [trimmed];
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([key]) => String(key).trim())
      .filter(Boolean);
  }

  return [];
}

export function normalizeApplicationData(applicationData: ApplicationData | null | undefined): ApplicationData {
  const data = { ...(applicationData || {}) } as ApplicationData;

  return {
    ...data,
    accountReasons: normalizeApplicationStringArray(data.accountReasons),
    existingProducts: normalizeApplicationStringArray(data.existingProducts),
    externalProviders: normalizeApplicationStringArray(data.externalProviders),
    customProviders: normalizeApplicationStringArray(data.customProviders),
  };
}

export function normalizeApplication(application: Application): Application {
  return {
    ...application,
    application_data: normalizeApplicationData(application.application_data),
  };
}
