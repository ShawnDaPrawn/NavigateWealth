/**
 * Retirement Maturity Calculation Tests
 *
 * Unit tests for `calculateRetirementMaturityValue` — the compound-growth +
 * escalating-contribution projection used for retirement annuity maturity
 * estimates. These projections feed client-facing advice, so the compounding,
 * escalation timing, and the anniversary-anchored escalation branch are all
 * exercised here.
 *
 * @module utils/__tests__/retirementCalculations
 */

import { describe, it, expect } from 'vitest';
import { calculateRetirementMaturityValue } from '../retirementCalculations';

describe('calculateRetirementMaturityValue', () => {
  describe('guard clauses', () => {
    it('returns the current fund value (rounded) when maturity is in the past', () => {
      const result = calculateRetirementMaturityValue(
        100_000.456,
        1_000,
        10,
        0,
        new Date('2026-01-01'),
        new Date('2025-01-01'),
      );
      // Past maturity short-circuits to round(currentFundValue * 100) / 100.
      expect(result).toBe(100_000.46);
    });

    it('returns the current fund value when maturity equals the current date', () => {
      const sameDay = new Date('2026-01-01');
      const result = calculateRetirementMaturityValue(50_000, 1_000, 10, 5, sameDay, sameDay);
      expect(result).toBe(50_000);
    });
  });

  describe('compound growth', () => {
    it('grows a lump sum with no contributions by the annual growth rate over one year', () => {
      // monthlyGrowthRate = (1.1)^(1/12) - 1; compounded 12x => exactly 1.1x.
      const result = calculateRetirementMaturityValue(
        100_000,
        0,
        10,
        0,
        new Date('2026-01-01'),
        new Date('2027-01-01'),
      );
      expect(result).toBe(110_000);
    });

    it('does not grow the fund when the growth rate is zero', () => {
      const result = calculateRetirementMaturityValue(
        100_000,
        0,
        0,
        0,
        new Date('2026-01-01'),
        new Date('2027-01-01'),
      );
      expect(result).toBe(100_000);
    });
  });

  describe('contributions', () => {
    it('adds 12 monthly contributions over a year with no growth and no escalation', () => {
      const result = calculateRetirementMaturityValue(
        0,
        1_000,
        0,
        0,
        new Date('2026-01-01'),
        new Date('2027-01-01'),
      );
      expect(result).toBe(12_000);
    });
  });

  describe('legacy escalation (no anniversary reference)', () => {
    it('escalates the premium once per 12 months from the current date', () => {
      // Year 1: 12 x 1000 = 12000, then premium escalates to 1100.
      // Year 2: 12 x 1100 = 13200. Total = 25200 (growth disabled).
      const result = calculateRetirementMaturityValue(
        0,
        1_000,
        0,
        10,
        new Date('2026-01-01'),
        new Date('2028-01-01'),
      );
      expect(result).toBe(25_200);
    });
  });

  describe('anniversary-anchored escalation', () => {
    it('escalates on the policy anniversary, not on the calculation anniversary', () => {
      // Inception is 6 months before "today", so the first completed policy
      // year lands at month 6 of the projection (not month 12).
      // Months 1-5: 5 x 1000 = 5000
      // Month 6: +1000 (still pre-escalation when added) => premium -> 1100
      // Months 7-12: 6 x 1100 = 6600
      // Total = 12600 (vs. 12000 under legacy 12-month escalation).
      const result = calculateRetirementMaturityValue(
        0,
        1_000,
        0,
        10,
        new Date('2026-01-01'),
        new Date('2027-01-01'),
        { premiumAnniversaryReference: new Date('2025-07-01') },
      );
      expect(result).toBe(12_600);
    });

    it('falls back to legacy 12-month escalation when the anniversary reference is invalid', () => {
      const result = calculateRetirementMaturityValue(
        0,
        1_000,
        0,
        10,
        new Date('2026-01-01'),
        new Date('2027-01-01'),
        { premiumAnniversaryReference: new Date('invalid') },
      );
      // Invalid date => useAnniversary is false => single escalation at month 12
      // (after the month-12 contribution), so a full year is 12 x 1000 = 12000.
      expect(result).toBe(12_000);
    });

    it('ignores the anniversary reference when escalation is zero', () => {
      const result = calculateRetirementMaturityValue(
        0,
        1_000,
        0,
        0,
        new Date('2026-01-01'),
        new Date('2027-01-01'),
        { premiumAnniversaryReference: new Date('2025-07-01') },
      );
      expect(result).toBe(12_000);
    });
  });

  it('rounds the final value to two decimal places', () => {
    const result = calculateRetirementMaturityValue(
      33_333.333,
      0,
      0,
      0,
      new Date('2026-01-01'),
      new Date('2027-01-01'),
    );
    expect(result).toBe(33_333.33);
  });
});
