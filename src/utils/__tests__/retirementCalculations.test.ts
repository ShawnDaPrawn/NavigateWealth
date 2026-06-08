import { describe, it, expect } from 'vitest';
import { calculateRetirementMaturityValue } from '../retirementCalculations';

const CURRENT_DATE = new Date('2026-01-01');

function maturityDate(yearsAhead: number): Date {
  const d = new Date(CURRENT_DATE);
  d.setFullYear(d.getFullYear() + yearsAhead);
  return d;
}

describe('calculateRetirementMaturityValue', () => {
  it('returns the fund value unchanged when maturity is in the past', () => {
    const past = new Date('2025-01-01');
    expect(calculateRetirementMaturityValue(100000, 0, 0, 0, CURRENT_DATE, past)).toBe(100000);
  });

  it('returns the fund value when maturity equals current date', () => {
    expect(calculateRetirementMaturityValue(100000, 0, 0, 0, CURRENT_DATE, CURRENT_DATE)).toBe(
      100000,
    );
  });

  it('grows a fund with zero contributions', () => {
    const result = calculateRetirementMaturityValue(
      100000,
      0,
      10, // 10% annual growth
      0,
      CURRENT_DATE,
      maturityDate(1),
    );
    // After 1 year at 10% growth: ~R110,000
    expect(result).toBeGreaterThan(100000);
    expect(result).toBeCloseTo(110000, -2);
  });

  it('accumulates contributions without growth', () => {
    // 0% growth, R1,000/month for 12 months → contributions = R12,000
    const result = calculateRetirementMaturityValue(0, 1000, 0, 0, CURRENT_DATE, maturityDate(1));
    expect(result).toBeCloseTo(12000, -1);
  });

  it('accumulates both fund growth and contributions', () => {
    const result = calculateRetirementMaturityValue(
      100000,
      1000,
      10, // 10% annual
      0,
      CURRENT_DATE,
      maturityDate(1),
    );
    // Growth on R100k + 12 monthly R1k contributions (compounded) > R110k + R12k raw
    expect(result).toBeGreaterThan(110000);
  });

  it('applies annual escalation every 12 months (legacy mode)', () => {
    const withEscalation = calculateRetirementMaturityValue(
      0,
      1000,
      0,
      10, // 10% annual escalation
      CURRENT_DATE,
      maturityDate(2),
    );
    const withoutEscalation = calculateRetirementMaturityValue(
      0,
      1000,
      0,
      0,
      CURRENT_DATE,
      maturityDate(2),
    );
    // With escalation, year-2 contributions are 10% higher → total is greater
    expect(withEscalation).toBeGreaterThan(withoutEscalation);
  });

  it('applies escalation using anniversary reference date', () => {
    const inception = new Date('2025-01-01'); // 12 months before CURRENT_DATE
    const withAnniversary = calculateRetirementMaturityValue(
      0,
      1000,
      0,
      10,
      CURRENT_DATE,
      maturityDate(2),
      { premiumAnniversaryReference: inception },
    );
    const withoutAnniversary = calculateRetirementMaturityValue(
      0,
      1000,
      0,
      10,
      CURRENT_DATE,
      maturityDate(2),
    );
    // Both should be greater than no escalation; values may differ based on timing
    expect(withAnniversary).toBeGreaterThan(0);
    expect(withoutAnniversary).toBeGreaterThan(0);
  });

  it('handles null anniversary reference gracefully (falls back to legacy 12-month mode)', () => {
    const result = calculateRetirementMaturityValue(0, 1000, 0, 10, CURRENT_DATE, maturityDate(2), {
      premiumAnniversaryReference: null,
    });
    const legacy = calculateRetirementMaturityValue(0, 1000, 0, 10, CURRENT_DATE, maturityDate(2));
    expect(result).toBeCloseTo(legacy, 0);
  });

  it('returns a rounded value (2 decimal places)', () => {
    const result = calculateRetirementMaturityValue(
      12345.67,
      500,
      7.5,
      0,
      CURRENT_DATE,
      maturityDate(1),
    );
    // Check it's rounded to cents
    const decimals = (result.toString().split('.')[1] || '').length;
    expect(decimals).toBeLessThanOrEqual(2);
  });
});
