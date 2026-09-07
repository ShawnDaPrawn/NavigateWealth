/**
 * Newsletter Studio — display formatters.
 *
 * Pure, locale-pinned (en-ZA) helpers shared by every studio view so dates,
 * counts and rates read identically on the dashboard, list and drill-down.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "5 Sept 2026" */
export function formatDate(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "5 Sept 2026, 08:30" */
export function formatDateTime(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "08:30" */
export function formatTime(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Human relative time in either direction: "just now", "4 min ago",
 * "in 2 h", "yesterday", "3 days ago". Falls back to the absolute date
 * beyond a week so old timestamps stay precise.
 */
export function formatRelative(
  value: string | null | undefined,
  now: number = Date.now(),
  fallback = 'never',
): string {
  const date = toDate(value);
  if (!date) return fallback;
  const diff = date.getTime() - now;
  const abs = Math.abs(diff);
  const future = diff > 0;

  if (abs < MINUTE) return future ? 'in under a minute' : 'just now';
  if (abs < HOUR) {
    const minutes = Math.round(abs / MINUTE);
    return future ? `in ${minutes} min` : `${minutes} min ago`;
  }
  if (abs < DAY) {
    const hours = Math.round(abs / HOUR);
    return future ? `in ${hours} h` : `${hours} h ago`;
  }
  if (abs < 2 * DAY) return future ? 'tomorrow' : 'yesterday';
  if (abs < 7 * DAY) {
    const days = Math.round(abs / DAY);
    return future ? `in ${days} days` : `${days} days ago`;
  }
  return formatDate(date.toISOString());
}

/** "1 234" — en-ZA grouping keeps large counts scannable. */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  return value.toLocaleString('en-ZA');
}

/** Ratio as a percentage string with one decimal, "—" when there is no base. */
export function formatRate(numerator: number, denominator: number, digits = 1): string {
  if (!denominator || denominator <= 0) return '—';
  const value = (numerator / denominator) * 100;
  return `${value.toFixed(digits).replace(/\.0+$/, '')}%`;
}

/** Percentage value (0–100) for progress bars; never NaN. */
export function ratePercent(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

/** Value for an `<input type="datetime-local">`, in the viewer's local time. */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/**
 * Subject-line guidance: most inbox previews truncate around 60 characters.
 * Returns a tone the counter can colour and a short hint for the author.
 */
export function subjectLengthHint(subject: string): {
  tone: 'ok' | 'warn' | 'empty';
  hint: string;
} {
  const length = subject.trim().length;
  if (length === 0) return { tone: 'empty', hint: 'Required' };
  if (length > 60) return { tone: 'warn', hint: 'May be cut off on mobile' };
  return { tone: 'ok', hint: 'Good length' };
}

/** Initials for avatar tiles — "Navigate Wealth" → "NW". */
export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?'
  );
}

/** Split a free-text address list on commas, semicolons and whitespace. */
export function parseEmailList(raw: string): { valid: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const token of raw.split(/[,;\s]+/)) {
    const email = token.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) valid.push(email);
    else invalid.push(email);
  }
  return { valid, invalid };
}
