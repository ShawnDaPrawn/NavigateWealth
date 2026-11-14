/**
 * Social analytics — pure helpers over Buffer's aggregated metrics.
 */
import type { SocialAnalyticsSummary } from '../types';

export const PERIODS = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 3 months' },
  { days: 365, label: 'Last 12 months' },
] as const;

const ENGAGEMENT_KEYS = ['reactions', 'likes', 'comments', 'shares', 'reposts'] as const;

/** Sum of the engagement metrics Buffer reported; null when it reported none. */
export function engagementTotal(totals: Record<string, number> | undefined): number | null {
  if (!totals || !ENGAGEMENT_KEYS.some((k) => totals[k] !== undefined)) return null;
  return ENGAGEMENT_KEYS.reduce((sum, k) => sum + (totals[k] ?? 0), 0);
}

export function formatMetric(value: number | null | undefined, unit = ''): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (unit === '%' || unit === 'percent')
    return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}%`;
  return value.toLocaleString('en-ZA', { maximumFractionDigits: 2 });
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV of every metric for the period, built in the browser. */
export function analyticsToCsv(summary: SocialAnalyticsSummary): string {
  const rows: (string | number)[][] = [
    ['Metric', 'Type', 'Value', 'Unit', 'Description', 'From', 'To'],
    ...summary.metrics.map((m) => [
      m.name,
      m.type,
      m.value,
      m.unit,
      m.description,
      summary.from,
      summary.to,
    ]),
  ];
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}
