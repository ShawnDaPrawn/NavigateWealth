/**
 * Reading and aggregating values out of policy records.
 *
 * Split out of `clientOverviewUtils.ts` (1,650 lines), itself an earlier
 * extraction from `ClientOverviewTab.tsx`. Pure functions — no React, no
 * hooks, no I/O.
 */

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

// ── Schema-driven policy normalisation ───────────────────────────────────

export interface SchemaField {
  id: string;
  keyId?: string;
  name?: string;
  type?: string;
}

/**
 * Given a policy's data and the schema fields for its category, return a new
 * data object where every entry that has a keyId is ALSO keyed by that keyId.
 * Original field-ID entries are preserved for backward compat.
 */
export function normalizePolicyData(
  data: Record<string, unknown>,
  schemaFields: SchemaField[],
): Record<string, unknown> {
  const out = { ...data };
  for (const field of schemaFields) {
    if (field.keyId && data[field.id] !== undefined) {
      out[field.keyId] = data[field.id];
    }
  }
  return out;
}
