/**
 * Display formatting for the Portfolio tab.
 *
 * Kept apart from the component so the file that exports the component
 * exports nothing else (react-refresh/only-export-components), and so the
 * formatting can be unit-tested without rendering.
 */
import type { PortfolioColumn } from '@/shared/integrations/portfolio-table';

export function formatPortfolioDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/** A stored value rendered for its column type; empty reads as a dash. */
export function formatPortfolioValue(column: PortfolioColumn, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  const numeric = Number(value);
  if (column.type === 'currency' && Number.isFinite(numeric)) {
    return `R ${numeric.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`;
  }
  if (column.type === 'percentage' && Number.isFinite(numeric)) return `${numeric}%`;
  if (column.type === 'number' && Number.isFinite(numeric)) {
    return numeric.toLocaleString('en-ZA');
  }
  return String(value);
}

/** `1 update` / `2 updates`. */
export const pluralise = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`;
