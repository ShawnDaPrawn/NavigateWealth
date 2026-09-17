/**
 * The Newsletters tab's year/month arithmetic, kept out of the components so
 * it can be tested against a frozen clock.
 *
 * The tab strip is derived from the current date, never stored: on 1 January
 * the newest year becomes the first tab and everything shifts by one with no
 * deploy, no migration and no scheduled job.
 */

/** A newsletter as the public endpoint serves it. */
export interface PublicNewsletter {
  slug: string;
  title: string;
  description: string;
  issueMonth: string;
  year: number;
  /** 1–12. */
  month: number;
  pdfUrl: string;
  pdfFileName: string;
  pdfSizeBytes: number;
  publishedAt: string;
}

/** Years shown as their own tab, before the "Older" dropdown takes over. */
export const PRIMARY_YEAR_COUNT = 4;
/** How many further years the "Older" dropdown reaches back. */
export const OLDER_YEAR_COUNT = 5;

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function monthName(month: number): string {
  return MONTH_NAMES[Math.min(Math.max(month, 1), 12) - 1];
}

export interface YearTabs {
  /** The current year first, then the three before it. */
  primary: number[];
  /** The five years before those, shown in a dropdown. */
  older: number[];
}

/**
 * Which years the tab strip offers.
 *
 * Only years that actually have a newsletter appear, so the strip starts
 * small and fills in rather than showing four empty tabs on day one. The
 * current year is always offered when it has content, even before any older
 * year exists.
 */
export function buildYearTabs(now: Date, availableYears: number[]): YearTabs {
  const currentYear = now.getFullYear();
  const has = new Set(availableYears);
  const primaryRange: number[] = [];
  for (let i = 0; i < PRIMARY_YEAR_COUNT; i++) primaryRange.push(currentYear - i);
  const olderRange: number[] = [];
  for (let i = 0; i < OLDER_YEAR_COUNT; i++) {
    olderRange.push(currentYear - PRIMARY_YEAR_COUNT - i);
  }
  return {
    primary: primaryRange.filter((y) => has.has(y)),
    older: olderRange.filter((y) => has.has(y)),
  };
}

/** Every year a tab can reach. Anything older stays stored but is not listed. */
export function selectableYears(tabs: YearTabs): number[] {
  return [...tabs.primary, ...tabs.older];
}

/**
 * The year a visitor should land on: the newest year that has newsletters and
 * is reachable from the strip. Returns null when there is nothing to show.
 */
export function defaultYear(tabs: YearTabs): number | null {
  const all = selectableYears(tabs);
  return all.length > 0 ? Math.max(...all) : null;
}

export interface MonthGroup {
  month: number;
  label: string;
  items: PublicNewsletter[];
}

/**
 * One year's newsletters, newest month first. Only months that have something
 * appear — a year is not padded out to twelve empty rows.
 */
export function groupByMonth(items: PublicNewsletter[], year: number): MonthGroup[] {
  const byMonth = new Map<number, PublicNewsletter[]>();
  for (const item of items) {
    if (item.year !== year) continue;
    const list = byMonth.get(item.month);
    if (list) list.push(item);
    else byMonth.set(item.month, [item]);
  }
  return [...byMonth.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([month, monthItems]) => ({
      month,
      label: monthName(month),
      items: [...monthItems].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1)),
    }));
}

/** Distinct years present in a set of newsletters, newest first. */
export function yearsWithNewsletters(items: PublicNewsletter[]): number[] {
  return [...new Set(items.map((n) => n.year))].sort((a, b) => b - a);
}

/** `2026-09` → `September 2026`, for a card and a page heading. */
export function formatIssueMonth(issueMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(issueMonth ?? '');
  if (!match) return issueMonth ?? '';
  return `${monthName(Number(match[2]))} ${match[1]}`;
}

/** `1048576` → `1.0 MB`; small files read in KB. */
export function formatPdfSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
