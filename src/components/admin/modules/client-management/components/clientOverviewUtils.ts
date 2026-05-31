/**
 * Pure helpers extracted from ClientOverviewTab.tsx (Phase 6 god-file split).
 *
 * These are dependency-free formatting, date-math, policy-aggregation and
 * gap-status functions — no React, no hooks, no I/O. They were lifted out of
 * the 3.3k-line component verbatim (behaviour-preserving) so they can be
 * unit-tested and reused, and so the component file shrinks toward its
 * single responsibility (rendering). Tested in clientOverviewUtils.test.ts.
 */

import type { ProfileData } from '../types';

// ── Shared types (relocated from ClientOverviewTab) ──────────────────────

export interface Policy {
  id: string;
  providerName: string;
  categoryId: string;
  data: Record<string, unknown>;
  updatedAt: string;
}

export type GapStatus = 'good' | 'caution' | 'gap' | 'none';

/** Pillar health status derived from gap analysis */
export type PillarHealth = 'healthy' | 'attention' | 'critical' | 'no-data';

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

// ── Policy value access + aggregation ────────────────────────────────────

/**
 * Read a numeric value from policy.data by key.
 * After normalisation the data contains both field-ID and keyId entries,
 * so a simple direct lookup is sufficient.
 */
export const numVal = (policy: Policy, key: string): number => {
  const v = policy.data?.[key];
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

/**
 * Read a string value from policy.data by key.
 */
export const strVal = (policy: Policy, key: string): string | undefined => {
  const v = policy.data?.[key];
  if (v !== undefined && v !== null && v !== '' && typeof v === 'string') return v;
  return undefined;
};

export const sumField = (pols: Policy[], keyId: string): number =>
  pols.reduce((s, p) => s + numVal(p, keyId), 0);

/**
 * Sum investment monthly contributions, excluding lump-sum policies.
 *
 * When an investment policy's "Premium" field (invest_monthly_contribution)
 * equals its "Current Value" field (invest_current_value), the premium
 * represents the initial lump-sum investment — not a recurring monthly
 * contribution. This commonly happens when the AI extraction maps the
 * total investment amount to the schema's "Premium" field.
 *
 * Guard: skip the contribution when it matches the current value.
 */
export const sumInvestmentPremiums = (pols: Policy[]): number =>
  pols.reduce((s, p) => {
    const contribution = numVal(p, 'invest_monthly_contribution');
    if (contribution <= 0) return s;
    const currentValue = numVal(p, 'invest_current_value');
    // If the "premium" is >= the current portfolio value, it's almost
    // certainly a lump-sum initial investment, not a recurring monthly
    // contribution.  A genuine monthly contribution accumulates over time,
    // so the portfolio value will always exceed a single month's payment.
    if (currentValue > 0 && contribution >= currentValue) return s;
    return s + contribution;
  }, 0);

/** Sum the first non-zero value from a list of candidate keyIds per policy
 *  (avoids double-counting when e.g. retirement_fund_value and retirement_current_value
 *   both exist on the same policy) */
export const sumFirstNonZero = (pols: Policy[], ...keyIds: string[]): number =>
  pols.reduce((s, p) => {
    for (const k of keyIds) {
      const v = numVal(p, k);
      if (v > 0) return s + v;
    }
    return s;
  }, 0);

/** Sum all specified keyIds per policy (for additive fields, e.g. EB premiums) */
export const sumMultiField = (pols: Policy[], keyIds: string[]): number =>
  pols.reduce((s, p) => s + keyIds.reduce((fs, k) => fs + numVal(p, k), 0), 0);

// ── Gap status ─────────────────────────────────────────────────────────────

/** Derive worst gap status from a set of statuses */
export function worstGapStatus(statuses: GapStatus[]): PillarHealth {
  const filtered = statuses.filter((s) => s !== 'none');
  if (filtered.length === 0) return 'no-data';
  if (filtered.some((s) => s === 'gap')) return 'critical';
  if (filtered.some((s) => s === 'caution')) return 'attention';
  return 'healthy';
}
