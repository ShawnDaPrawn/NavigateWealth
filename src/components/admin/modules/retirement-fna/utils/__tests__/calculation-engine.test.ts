import { describe, expect, it } from 'vitest';
import { DEFAULT_RETIREMENT_ASSUMPTIONS, calculateRetirementFNA } from '../calculation-engine';
import type { RetirementFNAAdjustments, RetirementFNAInputs } from '../../types';

function run(
  inputs: Partial<RetirementFNAInputs> = {},
  adjustments: RetirementFNAAdjustments = {},
) {
  return calculateRetirementFNA(inputs, adjustments);
}

describe('calculateRetirementFNA — assumptions & merge', () => {
  it('applies defaults when inputs are empty', () => {
    const r = run({});
    expect(r.yearsToRetirement).toBe(DEFAULT_RETIREMENT_ASSUMPTIONS.retirementAge - 30); // currentAge default 30
    expect(r.yearsInRetirement).toBe(DEFAULT_RETIREMENT_ASSUMPTIONS.yearsInRetirement);
    expect(r.realGrowthRate).toBe(DEFAULT_RETIREMENT_ASSUMPTIONS.preRetirementReturn);
    expect(r.realSalaryGrowth).toBe(DEFAULT_RETIREMENT_ASSUMPTIONS.salaryEscalation);
    expect(r.hasShortfall).toBe(false); // no income -> no required capital
  });

  it('lets adjustments override the retirement age', () => {
    expect(
      run({ currentAge: 40, retirementAge: 65 }, { retirementAge: 60 }).yearsToRetirement,
    ).toBe(20);
  });

  it('floors years-to-retirement at zero', () => {
    expect(run({ currentAge: 70, retirementAge: 65 }).yearsToRetirement).toBe(0);
  });
});

describe('calculateRetirementFNA — required capital', () => {
  it('uses the simple n-year sum when the real post-retirement return is zero', () => {
    const r = run(
      { currentAge: 65, retirementAge: 65, currentMonthlyIncome: 100000 },
      { postRetirementReturn: 0.06, inflationRate: 0.06 }, // realPostReturn === 0
    );
    // target monthly = 100000 * replacementRatio(0.75) = 75000 (no escalation, 0 years)
    expect(r.targetMonthlyIncome).toBeCloseTo(75000, 2);
    // requiredCapital = targetAnnual(900000) * yearsInRetirement(25)
    expect(r.requiredCapital).toBeCloseTo(900000 * 25, 0);
    expect(r.hasShortfall).toBe(true);
    expect(r.shortfallPercentage).toBeCloseTo(100, 4); // projected capital is 0
  });

  it('reports no shortfall and 0% when there is no required capital', () => {
    const r = run({
      currentMonthlyIncome: 0,
      currentRetirementSavings: 100000,
      currentAge: 64,
      retirementAge: 65,
    });
    // fvExisting = 100000 * 1.10^1 = 110000
    expect(r.projectedCapital).toBeCloseTo(110000, 0);
    expect(r.hasShortfall).toBe(false);
    expect(r.shortfallPercentage).toBe(0);
    expect(r.requiredAdditionalContribution).toBe(0);
  });
});

describe('calculateRetirementFNA — contributions & shortfall solve', () => {
  it('grows existing capital + contributions and solves the additional contribution under a shortfall', () => {
    const r = run({
      currentAge: 40,
      retirementAge: 65,
      currentMonthlyIncome: 50000,
      currentMonthlyContribution: 5000,
      currentRetirementSavings: 200000,
    });

    expect(Number.isFinite(r.projectedCapital)).toBe(true);
    expect(r.projectedCapital).toBeGreaterThan(200000); // existing capital has grown
    expect(r.hasShortfall).toBe(true);
    expect(r.requiredAdditionalContribution).toBeGreaterThan(0);
    expect(r.totalRecommendedContribution).toBeCloseTo(5000 + r.requiredAdditionalContribution, 6);
    expect(r.percentageOfIncome).toBeGreaterThan(0);
  });

  it('handles the L’Hopital case where growth rate equals escalation rate without producing NaN', () => {
    const r = run(
      {
        currentAge: 40,
        retirementAge: 65,
        currentMonthlyIncome: 50000,
        currentMonthlyContribution: 5000,
      },
      { preRetirementReturn: 0.06, premiumEscalation: 0.06 }, // monthly growth === monthly escalation
    );
    expect(Number.isFinite(r.projectedCapital)).toBe(true);
    expect(r.projectedCapital).toBeGreaterThan(0);
    expect(Number.isFinite(r.requiredAdditionalContribution)).toBe(true);
  });
});
