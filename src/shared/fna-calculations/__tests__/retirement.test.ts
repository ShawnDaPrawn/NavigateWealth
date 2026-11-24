/**
 * Shared retirement engine — hand-computed expectations.
 *
 * Where a case sets the post-retirement return equal to inflation, the real
 * return is zero and required capital is simply annual income × years, so the
 * expected figure can be checked by hand.
 */
import { describe, expect, it } from 'vitest';
import {
  RETIREMENT_S11F,
  RetirementCalculationError,
  calculateRetirement,
  retirementInputProblem,
} from '../retirement';

/** Zero real post-retirement return: required = annual income × 25. */
const FLAT = { postRetirementReturn: 0.06, inflationRate: 0.06 };

describe('age is required', () => {
  it('refuses to calculate without an age instead of assuming 30', () => {
    expect(() => calculateRetirement({ currentMonthlyIncome: 50_000 })).toThrow(
      RetirementCalculationError,
    );
    expect(() => calculateRetirement({ currentAge: 0 })).toThrow(/current age is required/);
  });

  it('names the problem for callers that check first', () => {
    expect(retirementInputProblem({})).toMatch(/current age is required/);
    expect(retirementInputProblem({ currentAge: '' })).not.toBeNull();
    expect(retirementInputProblem({ currentAge: 41 })).toBeNull();
  });
});

describe('income basis', () => {
  it('applies the replacement ratio to gross income when it is known', () => {
    const r = calculateRetirement(
      {
        currentAge: 65,
        retirementAge: 65,
        currentGrossMonthlyIncome: 100_000,
        currentMonthlyIncome: 70_000,
      },
      FLAT,
    );
    expect(r.incomeBasis).toBe('gross');
    expect(r.targetMonthlyIncome).toBeCloseTo(75_000, 6); // 75% × 100 000
    expect(r.requiredCapital).toBeCloseTo(75_000 * 12 * 25, 2); // 22 500 000
    expect(r.assumptionNotes?.[0]).toMatch(/gross income/);
  });

  it('falls back to net income for records without gross, and says so', () => {
    const r = calculateRetirement(
      { currentAge: 65, retirementAge: 65, currentMonthlyIncome: 70_000 },
      FLAT,
    );
    expect(r.incomeBasis).toBe('net');
    expect(r.targetMonthlyIncome).toBeCloseTo(52_500, 6); // 75% × 70 000
    expect(r.requiredCapital).toBeCloseTo(52_500 * 12 * 25, 2); // 15 750 000
    expect(r.assumptionNotes?.[0]).toMatch(/NET income/);
  });
});

describe('contribution escalation', () => {
  // One year to go, R1 000 p.m. at 10% growth. The FV factor of an escalating
  // monthly payment over 12 months is (1.10 − (1+e)) / (r − g) with monthly r, g.
  const base = { currentAge: 64, retirementAge: 65, currentMonthlyContribution: 1_000 };

  it('defaults to salary escalation, since contributions are a % of salary', () => {
    const r = calculateRetirement(base, { preRetirementReturn: 0.1, salaryEscalation: 0.07 });
    expect(r.premiumEscalation).toBe(0.07);
    // (1.10 − 1.07) / (0.0079741404 − 0.0056541454) = 12.9310621
    expect(r.projectedContributions).toBeCloseTo(12_931.06, 1);
    expect(r.assumptionNotes?.join(' ')).toMatch(/escalate with salary/);
  });

  it('still honours an adviser override', () => {
    const r = calculateRetirement(base, {
      preRetirementReturn: 0.1,
      salaryEscalation: 0.07,
      premiumEscalation: 0.06,
    });
    expect(r.premiumEscalation).toBe(0.06);
    // (1.10 − 1.06) / (0.0079741404 − 0.0048675506) = 12.8758548
    expect(r.projectedContributions).toBeCloseTo(12_875.85, 1);
    expect(r.assumptionNotes?.join(' ')).toMatch(/adviser override/);
  });
});

describe('other retirement provision', () => {
  it('reduces the income the capital must fund by other guaranteed income', () => {
    const r = calculateRetirement(
      {
        currentAge: 65,
        retirementAge: 65,
        currentGrossMonthlyIncome: 100_000,
        otherMonthlyRetirementIncome: 25_000,
      },
      FLAT,
    );
    expect(r.targetMonthlyIncome).toBeCloseTo(75_000, 6);
    expect(r.monthlyIncomeFromCapital).toBeCloseTo(50_000, 6);
    expect(r.requiredCapital).toBeCloseTo(50_000 * 12 * 25, 2); // 15 000 000
  });

  it('inflates other income to retirement and grows other capital', () => {
    const r = calculateRetirement(
      {
        currentAge: 60,
        retirementAge: 65,
        currentGrossMonthlyIncome: 50_000,
        otherMonthlyRetirementIncome: 10_000,
        otherRetirementCapital: 100_000,
      },
      { inflationRate: 0.06, preRetirementReturn: 0.1 },
    );
    expect(r.otherMonthlyIncomeAtRetirement).toBeCloseTo(13_382.26, 2); // 10 000 × 1.06^5
    expect(r.projectedOtherCapital).toBeCloseTo(161_051, 2); // 100 000 × 1.1^5
    expect(r.projectedCapital).toBeCloseTo(161_051, 2);
  });

  it('never asks the capital to fund a negative income', () => {
    const r = calculateRetirement(
      {
        currentAge: 65,
        retirementAge: 65,
        currentGrossMonthlyIncome: 10_000,
        otherMonthlyRetirementIncome: 20_000,
      },
      FLAT,
    );
    expect(r.monthlyIncomeFromCapital).toBe(0);
    expect(r.requiredCapital).toBe(0);
    expect(r.drawdownStatus).toBe('not-required');
    expect(r.initialDrawdownRate).toBe(0);
  });
});

describe("today's money", () => {
  it('deflates every capital figure by inflation over the years to retirement', () => {
    // Salary escalation equals inflation, so the target holds its real value:
    // 75% × 40 000 = 30 000 today; nominal 40 000 × 1.05^10 × 0.75 = 48 866.84.
    const r = calculateRetirement(
      {
        currentAge: 55,
        retirementAge: 65,
        currentGrossMonthlyIncome: 40_000,
        currentRetirementSavings: 1_000_000,
      },
      { inflationRate: 0.05, salaryEscalation: 0.05, preRetirementReturn: 0.05 },
    );
    const deflator = Math.pow(1.05, 10);
    expect(r.targetMonthlyIncome).toBeCloseTo(48_866.84, 2);
    expect(r.targetMonthlyIncomeToday).toBeCloseTo(30_000, 6);
    // Savings growing at inflation keep their value: 1 000 000 today.
    expect(r.projectedCapitalToday).toBeCloseTo(1_000_000, 4);
    expect(r.requiredCapitalToday).toBeCloseTo(r.requiredCapital / deflator, 6);
    expect(r.capitalShortfallToday).toBeCloseTo(r.capitalShortfall / deflator, 6);
  });
});

describe('initial drawdown', () => {
  // Retiring now: target 75 000 p.m. = 900 000 p.a., projected capital = savings.
  const at = (savings: number) =>
    calculateRetirement(
      {
        currentAge: 65,
        retirementAge: 65,
        currentGrossMonthlyIncome: 100_000,
        currentRetirementSavings: savings,
      },
      FLAT,
    );

  it('is sustainable at 5% or less', () => {
    const r = at(18_000_000); // 900 000 / 18 000 000 = 5.0%
    expect(r.initialDrawdownRate).toBeCloseTo(0.05, 10);
    expect(r.drawdownStatus).toBe('sustainable');
  });

  it('flags a high depletion risk above 5%', () => {
    const r = at(12_000_000); // 7.5%
    expect(r.initialDrawdownRate).toBeCloseTo(0.075, 10);
    expect(r.drawdownStatus).toBe('high');
    expect(r.assumptionNotes?.join(' ')).toMatch(/high risk of depletion/);
  });

  it('flags a drawdown above the 17.5% living annuity maximum', () => {
    expect(at(4_000_000).drawdownStatus).toBe('exceeds-maximum'); // 22.5%
  });

  it('reports no rate when there is no capital at all', () => {
    const r = at(0);
    expect(r.initialDrawdownRate).toBeNull();
    expect(r.drawdownStatus).toBe('exceeds-maximum');
  });
});

describe('s11F deductibility', () => {
  const run = (gross: number, contribution: number) =>
    calculateRetirement(
      {
        currentAge: 65,
        retirementAge: 65,
        currentGrossMonthlyIncome: gross,
        currentMonthlyContribution: contribution,
      },
      FLAT,
    );

  it('limits deductions to 27.5% of annual income', () => {
    // 27.5% × 1 200 000 = 330 000; 30 000 × 12 = 360 000 → 30 000 above.
    const r = run(100_000, 30_000);
    expect(r.deductibleContributionLimit).toBeCloseTo(330_000, 6);
    expect(r.annualRecommendedContribution).toBeCloseTo(360_000, 6);
    expect(r.contributionAboveDeductibleLimit).toBeCloseTo(30_000, 6);
    expect(r.exceedsDeductibleLimit).toBe(true);
  });

  it('caps the limit at R430 000 for high earners', () => {
    // 27.5% × 2 400 000 = 660 000 → capped.
    const r = run(200_000, 20_000);
    expect(r.deductibleContributionLimit).toBe(RETIREMENT_S11F.ANNUAL_CAP);
    expect(r.exceedsDeductibleLimit).toBe(false);
  });

  it('measures the contribution against gross income', () => {
    expect(run(100_000, 20_000).percentageOfIncome).toBeCloseTo(20, 10);
  });
});

describe('robustness', () => {
  it('produces finite numbers when growth equals escalation (L’Hôpital case)', () => {
    const r = calculateRetirement(
      {
        currentAge: 40,
        retirementAge: 65,
        currentGrossMonthlyIncome: 60_000,
        currentMonthlyContribution: 5_000,
      },
      { preRetirementReturn: 0.06, salaryEscalation: 0.06 },
    );
    for (const v of [r.projectedCapital, r.requiredAdditionalContribution, r.initialDrawdownRate]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});
