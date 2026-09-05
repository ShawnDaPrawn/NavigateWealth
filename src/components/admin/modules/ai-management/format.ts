/**
 * AI Management — small formatting helpers shared by the tab components.
 */

const DATE_OPTS: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
const DATE_TIME_OPTS: Intl.DateTimeFormatOptions = {
  ...DATE_OPTS,
  hour: '2-digit',
  minute: '2-digit',
};

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-ZA', DATE_OPTS);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-ZA', DATE_TIME_OPTS);
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
