/**
 * Formatting and date arithmetic for the client overview.
 *
 * Split out of `clientOverviewUtils.ts` (1,650 lines), itself an earlier
 * extraction from `ClientOverviewTab.tsx`. Pure functions — no React, no
 * hooks, no I/O.
 */
import type { ProfileData } from '../../types';

// ── Formatting helpers ───────────────────────────────────────────────────

export const fmt = (n: number | undefined | null): string => {
  if (n === undefined || n === null || isNaN(Number(n))) return 'R 0';
  return `R ${Number(n).toLocaleString('en-ZA')}`;
};

export const pct = (n: number): string => `${n.toFixed(1)}%`;

/** Compact currency for pillar cards: R 1.2m / R 450k / R 5 000 */
export const fmtCompact = (n: number | undefined | null): string => {
  if (n === undefined || n === null || isNaN(Number(n))) return 'R 0';
  const v = Number(n);
  if (Math.abs(v) >= 1_000_000) return `R ${(v / 1_000_000).toFixed(1)}m`;
  if (Math.abs(v) >= 100_000) return `R ${(v / 1_000).toFixed(0)}k`;
  return fmt(v);
};

export const calcAge = (dob: string | undefined): number | null => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

export const fmtDate = (d: string | undefined): string => {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtDateTime = (d: string | undefined): string => {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const fmtRelative = (d: string): string => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffMonth / 12)}y ago`;
};

// ── Date math ──────────────────────────────────────────────────────────────

/** Add months to a date string, return ISO string */
export const addMonths = (d: string, months: number): string => {
  const dt = new Date(d);
  dt.setMonth(dt.getMonth() + months);
  return dt.toISOString();
};

/** Is the date in the past? */
export const isPast = (d: string): boolean => new Date(d).getTime() < Date.now();

/** Get the next anniversary of a date (next occurrence in the future) */
export const nextAnniversary = (isoDate: string): Date | null => {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const thisYear = now.getFullYear();
  const candidate = new Date(thisYear, d.getMonth(), d.getDate());
  if (candidate.getTime() < now.getTime()) {
    candidate.setFullYear(thisYear + 1);
  }
  return candidate;
};

/** Days between two dates */
export const daysBetween = (a: Date, b: Date): number =>
  Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));

export const addressLine = (p: ProfileData | undefined): string => {
  if (!p) return '-';
  const parts = [
    p.residentialAddressLine1,
    p.residentialSuburb,
    p.residentialCity,
    p.residentialProvince,
    p.residentialPostalCode,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '-';
};
