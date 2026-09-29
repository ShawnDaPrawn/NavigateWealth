import { describe, expect, it } from 'vitest';
import {
  formatValue,
  fromDisplay,
  hasAssumptionOverrides,
  isAssumptionChanged,
  isOverrideReasonValid,
  toDisplay,
  type FNAAssumptionRow,
} from '../assumptionOverrides';

function row(overrides: Partial<FNAAssumptionRow> = {}): FNAAssumptionRow {
  return {
    id: 'growth',
    label: 'Growth',
    systemValue: 0.06,
    value: 0.06,
    format: 'fraction',
    ...overrides,
  };
}

describe('assumption display conversion', () => {
  it('shows a stored fraction as a percentage and writes the edit back as a fraction', () => {
    // 6% is stored as 0.06. Showing the stored number would publish a 0.06% rate.
    expect(toDisplay(0.06, 'fraction')).toBe(6);
    expect(toDisplay(0.125, 'fraction')).toBe(12.5);
    expect(fromDisplay(6, 'fraction')).toBeCloseTo(0.06);
    expect(fromDisplay(12.5, 'fraction')).toBeCloseTo(0.125);
  });

  it('leaves percent and currency values on the scale they are stored in', () => {
    expect(toDisplay(3.5, 'percent')).toBe(3.5);
    expect(fromDisplay(3.5, 'percent')).toBe(3.5);
    expect(toDisplay(1_500_000, 'currency')).toBe(1_500_000);
    expect(fromDisplay(1_500_000, 'currency')).toBe(1_500_000);
  });

  it('formats each scale the way an adviser reads it', () => {
    expect(formatValue(0.06, 'fraction')).toBe('6%');
    expect(formatValue(3.5, 'percent')).toBe('3.5%');
    const currency = formatValue(1_500_000, 'currency');
    expect(currency.startsWith('R ')).toBe(true);
    expect(currency.replace(/\D/g, '')).toBe('1500000');
  });
});

describe('assumption override gate', () => {
  it('treats a value as unchanged inside the float tolerance', () => {
    expect(isAssumptionChanged(row({ value: 0.06 + 1e-12 }))).toBe(false);
    expect(isAssumptionChanged(row({ value: 0.07 }))).toBe(true);
    expect(hasAssumptionOverrides([row(), row({ id: 'inflation', value: 0.06 })])).toBe(false);
    expect(hasAssumptionOverrides([row(), row({ id: 'inflation', value: 0.07 })])).toBe(true);
  });

  it('requires a real reason only once an assumption has changed', () => {
    expect(isOverrideReasonValid(false, '')).toBe(true);
    expect(isOverrideReasonValid(false, 'short')).toBe(true);
    expect(isOverrideReasonValid(true, 'too short')).toBe(false);
    expect(isOverrideReasonValid(true, '         ')).toBe(false);
    expect(isOverrideReasonValid(true, '123456789')).toBe(false);
    expect(isOverrideReasonValid(true, '  market view  ')).toBe(true);
  });
});
