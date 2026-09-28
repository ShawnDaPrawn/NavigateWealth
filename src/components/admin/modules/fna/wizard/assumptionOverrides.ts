/**
 * Assumption overrides — the rules behind FNAAssumptionOverrides.
 *
 * An override is any assumption whose adviser value differs from the system
 * value; an override needs a recorded reason.
 */

/**
 * - `fraction`: stored as a fraction (0.06), shown and edited as a percentage (6).
 * - `percent`:  stored and shown as a percentage (3.5).
 */
export type FNAAssumptionFormat = 'fraction' | 'percent' | 'currency';

export interface FNAAssumptionRow {
  id: string;
  label: string;
  systemValue: number;
  value: number;
  format: FNAAssumptionFormat;
  hint?: string;
}

export const MIN_OVERRIDE_REASON_LENGTH = 10;

export function toDisplay(value: number, format: FNAAssumptionFormat): number {
  return format === 'fraction' ? Math.round(value * 10000) / 100 : value;
}

export function fromDisplay(value: number, format: FNAAssumptionFormat): number {
  return format === 'fraction' ? value / 100 : value;
}

export function formatValue(value: number, format: FNAAssumptionFormat): string {
  if (format === 'currency') {
    return `R ${Math.round(value).toLocaleString('en-ZA')}`;
  }
  return `${toDisplay(value, format)}%`;
}

export function isAssumptionChanged(row: FNAAssumptionRow): boolean {
  return Math.abs(row.value - row.systemValue) > 1e-9;
}

export function hasAssumptionOverrides(rows: readonly FNAAssumptionRow[]): boolean {
  return rows.some(isAssumptionChanged);
}

/** An override needs a reason; no override needs nothing. */
export function isOverrideReasonValid(overridden: boolean, reason: string): boolean {
  return !overridden || reason.trim().length >= MIN_OVERRIDE_REASON_LENGTH;
}
