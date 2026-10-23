/**
 * Display formatting, search and sorting for the Portfolio tab.
 *
 * Kept apart from the components so a file that exports a component exports
 * nothing else (react-refresh/only-export-components), and so the logic can be
 * unit-tested without rendering.
 *
 * Money and numbers go through the app's canonical formatters, which format by
 * hand rather than through the browser locale, so the table reads the same on
 * every machine. Dates are written out by hand for the same reason: "05 Sep
 * 2026" rather than a locale's "9/5/2026", which a South African reader takes
 * for the 9th of May.
 */
import { formatCurrency, formatNumber } from '@/shared/formatting/format';
import {
  normaliseClientName,
  type PortfolioColumn,
  type PortfolioRow,
} from '@/shared/integrations/portfolio-table';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (value: number) => String(value).padStart(2, '0');

/** A calendar date stored as `YYYY-MM-DD`, optionally followed by a time. */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/;

function formatCalendarDate(year: number, monthIndex: number, day: number): string {
  return `${pad(day)} ${MONTHS[monthIndex]} ${year}`;
}

/** A timestamp in the reader's local time: `05 Sep 2026, 12:52`. */
export function formatPortfolioDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${formatCalendarDate(date.getFullYear(), date.getMonth(), date.getDate())}, ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** The date part of a timestamp in the reader's local time: `05 Sep 2026`. */
export function formatPortfolioDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatCalendarDate(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * A stored date field. `YYYY-MM-DD` is read as a calendar date, not an instant,
 * so it never slips a day across time zones; anything else (a portal may have
 * stored "02 Jul 2018") is shown as it was stored.
 */
function formatDateField(value: unknown): string {
  const text = String(value);
  const match = ISO_DATE.exec(text);
  if (!match) return text;
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return text;
  return formatCalendarDate(Number(match[1]), monthIndex, Number(match[3]));
}

const NUMERIC_TYPES = new Set(['currency', 'number', 'percentage']);

/** Numeric columns are right-aligned so their digits line up. */
export const isNumericColumn = (column: PortfolioColumn) => NUMERIC_TYPES.has(column.type);

/** A stored value rendered for its column type; empty reads as a dash. */
export function formatPortfolioValue(column: PortfolioColumn, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (column.type === 'boolean' && (value === 'true' || value === 'false')) {
    return value === 'true' ? 'Yes' : 'No';
  }
  if (typeof value === 'object') return JSON.stringify(value);
  const numeric = Number(value);
  if (column.type === 'currency' && Number.isFinite(numeric)) return formatCurrency(numeric);
  if (column.type === 'number' && Number.isFinite(numeric)) return formatNumber(numeric);
  if (column.type === 'percentage' && Number.isFinite(numeric)) return `${numeric}%`;
  if (column.type === 'date') return formatDateField(value);
  return String(value);
}

const SYNC_SOURCE_LABELS: Record<string, string> = {
  portal: 'Portal sync',
  spreadsheet: 'Spreadsheet upload',
  portfolio_table: 'Portfolio table',
};

/** Where the most recent automated change came from, in words. */
export const describeSyncSource = (source: string) =>
  SYNC_SOURCE_LABELS[source] ?? source.replace(/_/g, ' ');

/** `1 update` / `2 updates`. */
export const pluralise = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const compactPolicyNumber = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Rows whose client name or policy number contains the query. Names compare
 * without case or accents ("Zoe" finds "Zoë"); policy numbers ignore spaces
 * and dashes ("eb001" finds "EB-001").
 */
export function filterPortfolioRows(rows: PortfolioRow[], query: string): PortfolioRow[] {
  const nameQuery = normaliseClientName(query);
  const numberQuery = compactPolicyNumber(query);
  if (!nameQuery && !numberQuery) return rows;
  return rows.filter(
    (row) =>
      (nameQuery !== '' && normaliseClientName(row.clientName).includes(nameQuery)) ||
      (numberQuery !== '' && compactPolicyNumber(row.policyNumber).includes(numberQuery)),
  );
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/** Sort keys besides a schema field id. */
export const CLIENT_SORT_KEY = 'client';
export const UPDATED_SORT_KEY = 'updatedAt';
/** Sorts by the print's upload date; a policy with no print on file is empty. */
export const PRINT_SORT_KEY = 'policyPrint';

export type PortfolioSortDirection = 'asc' | 'desc';

export interface PortfolioSort {
  /** `client`, `updatedAt`, `policyPrint`, or a schema field id. */
  key: string;
  direction: PortfolioSortDirection;
}

/** The server already returns the book in client-name order. */
export const DEFAULT_PORTFOLIO_SORT: PortfolioSort = { key: CLIENT_SORT_KEY, direction: 'asc' };

type SortValue = { kind: 'number'; value: number } | { kind: 'text'; value: string } | null;

function parseDateValue(value: unknown): number | null {
  const text = String(value);
  const match = ISO_DATE.exec(text);
  if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

function sortValue(row: PortfolioRow, key: string, column?: PortfolioColumn): SortValue {
  if (key === CLIENT_SORT_KEY) return { kind: 'text', value: row.clientName };
  if (key === UPDATED_SORT_KEY) {
    const time = Date.parse(row.updatedAt);
    return Number.isNaN(time) ? null : { kind: 'number', value: time };
  }
  if (key === PRINT_SORT_KEY) {
    const time = row.policyPrint ? Date.parse(row.policyPrint.uploadDate) : Number.NaN;
    return Number.isNaN(time) ? null : { kind: 'number', value: time };
  }
  const raw = row.values[key];
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'boolean') return { kind: 'number', value: raw ? 1 : 0 };
  if (column && isNumericColumn(column)) {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) return { kind: 'number', value: numeric };
  }
  if (column?.type === 'date') {
    const time = parseDateValue(raw);
    if (time !== null) return { kind: 'number', value: time };
  }
  return { kind: 'text', value: typeof raw === 'object' ? JSON.stringify(raw) : String(raw) };
}

const textCollator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function compareSortValues(a: Exclude<SortValue, null>, b: Exclude<SortValue, null>): number {
  if (a.kind === 'number' && b.kind === 'number') return a.value - b.value;
  if (a.kind === 'text' && b.kind === 'text') return textCollator.compare(a.value, b.value);
  // A column that mixes the two: numbers before free text.
  return a.kind === 'number' ? -1 : 1;
}

/**
 * Rows ordered by one column. Empty cells always sort last, whichever the
 * direction, so "largest first" never opens on a screen of dashes; ties keep
 * the server's client-name order.
 */
export function sortPortfolioRows(
  rows: PortfolioRow[],
  columns: PortfolioColumn[],
  sort: PortfolioSort,
): PortfolioRow[] {
  const column = columns.find((candidate) => candidate.id === sort.key);
  const factor = sort.direction === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: sortValue(row, sort.key, column) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) {
        if (a.value === b.value) return a.index - b.index;
        return a.value === null ? 1 : -1;
      }
      return compareSortValues(a.value, b.value) * factor || a.index - b.index;
    })
    .map((entry) => entry.row);
}

/** Clicking a header sorts by it ascending; clicking it again reverses. */
export function nextPortfolioSort(current: PortfolioSort, key: string): PortfolioSort {
  if (current.key !== key) return { key, direction: 'asc' };
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}
