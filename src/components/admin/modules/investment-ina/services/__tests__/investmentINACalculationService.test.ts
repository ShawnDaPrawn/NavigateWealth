/**
 * Investment Needs Analysis (INA) Calculation Service Tests
 *
 * Unit tests for the pure financial math and validation helpers that back the
 * INA module: future/present value, annuity future value, required monthly
 * contributions, affordability, discretionary aggregation, input/goal
 * validation, and the display helpers. Errors here feed directly into client
 * investment projections, so the formulas are pinned against hand-computed
 * expectations.
 *
 * @module investment-ina/services/__tests__/investmentINACalculationService
 */

import { describe, it, expect } from 'vitest';
import {
  validateInputs,
  validateGoal,
  calculateYearsToGoal,
  formatCurrency,
  formatPercentage,
  calculateFutureValue,
  calculateAnnuityFutureValue,
  calculateRequiredMonthlyPayment,
  calculatePresentValue,
  getGoalStatusColor,
  getGoalStatusLabel,
  getPortfolioHealthColor,
  calculateTotalDiscretionaryCapital,
  calculateTotalDiscretionaryContributions,
  getExpectedRealReturn,
  generateGoalSummary,
  calculateAffordability,
} from '../investmentINACalculationService';
import type {
  InvestmentGoal,
  DiscretionaryInvestment,
  GoalCalculationResult,
  RiskProfile,
  RiskProfileReturns,
  InvestmentINAInputs,
} from '../../types';

// ============================================================================
// FIXTURES
// ============================================================================

function createGoal(overrides?: Partial<InvestmentGoal>): InvestmentGoal {
  return {
    id: 'goal-1',
    goalName: 'Retirement',
    goalType: 'retirement' as InvestmentGoal['goalType'],
    goalAmountToday: 1_000_000,
    targetDate: '2050-01-01',
    targetYear: new Date().getFullYear() + 20,
    priorityLevel: 'high' as InvestmentGoal['priorityLevel'],
    linkedInvestmentIds: [],
    currentContributionToGoal: 5_000,
    expectedLumpSums: [],
    useClientRiskProfile: true,
    ...overrides,
  };
}

function createInvestment(overrides?: Partial<DiscretionaryInvestment>): DiscretionaryInvestment {
  return {
    id: 'inv-1',
    productName: 'Unit Trust',
    provider: 'Provider A',
    currentValue: 100_000,
    monthlyContribution: 2_000,
    isDiscretionary: true,
    ...overrides,
  };
}

const realReturns: RiskProfileReturns = {
  conservative: 0.02,
  moderate: 0.03,
  balanced: 0.04,
  growth: 0.05,
  aggressive: 0.06,
};

// ============================================================================
// FINANCIAL MATH
// ============================================================================

describe('calculateFutureValue', () => {
  it('compounds a lump sum at the annual rate', () => {
    // 100000 * 1.05^10
    expect(calculateFutureValue(100_000, 0.05, 10)).toBeCloseTo(162_889.46, 2);
  });

  it('returns the present value when years is 0', () => {
    expect(calculateFutureValue(100_000, 0.05, 0)).toBe(100_000);
  });
});

describe('calculatePresentValue', () => {
  it('discounts a future value back to today', () => {
    expect(calculatePresentValue(162_889.46, 0.05, 10)).toBeCloseTo(100_000, 1);
  });

  it('is the inverse of calculateFutureValue', () => {
    const fv = calculateFutureValue(50_000, 0.04, 7);
    expect(calculatePresentValue(fv, 0.04, 7)).toBeCloseTo(50_000, 6);
  });
});

describe('calculateAnnuityFutureValue', () => {
  it('returns 0 when the monthly payment is 0', () => {
    expect(calculateAnnuityFutureValue(0, 0.05, 10)).toBe(0);
  });

  it('returns 0 when years is 0 or negative', () => {
    expect(calculateAnnuityFutureValue(1_000, 0.05, 0)).toBe(0);
    expect(calculateAnnuityFutureValue(1_000, 0.05, -5)).toBe(0);
  });

  it('computes the future value of annual-equivalent contributions', () => {
    // monthly 1000 -> 12000/yr; factor = (1.05^10 - 1)/0.05
    const factor = (Math.pow(1.05, 10) - 1) / 0.05;
    expect(calculateAnnuityFutureValue(1_000, 0.05, 10)).toBeCloseTo(12_000 * factor, 4);
  });
});

describe('calculateRequiredMonthlyPayment', () => {
  it('returns 0 when years is 0 or negative', () => {
    expect(calculateRequiredMonthlyPayment(1_000_000, 0.05, 0)).toBe(0);
  });

  it('inverts calculateAnnuityFutureValue', () => {
    const monthly = 1_500;
    const fv = calculateAnnuityFutureValue(monthly, 0.05, 15);
    expect(calculateRequiredMonthlyPayment(fv, 0.05, 15)).toBeCloseTo(monthly, 4);
  });
});

describe('calculateAffordability', () => {
  it('flags affordable when contribution is <= 30% of gross income', () => {
    const result = calculateAffordability(3_000, 10_000);
    expect(result.percentage).toBe(30);
    expect(result.isAffordable).toBe(true);
    expect(result.warningMessage).toBeUndefined();
  });

  it('flags unaffordable and warns when contribution exceeds 30%', () => {
    const result = calculateAffordability(4_000, 10_000);
    expect(result.percentage).toBe(40);
    expect(result.isAffordable).toBe(false);
    expect(result.warningMessage).toContain('40.0%');
  });

  it('treats zero or negative income as affordable with 0%', () => {
    expect(calculateAffordability(1_000, 0)).toEqual({ percentage: 0, isAffordable: true });
  });
});

// ============================================================================
// AGGREGATION
// ============================================================================

describe('calculateTotalDiscretionaryCapital', () => {
  it('sums currentValue only for discretionary investments', () => {
    const investments = [
      createInvestment({ currentValue: 100_000, isDiscretionary: true }),
      createInvestment({ id: 'inv-2', currentValue: 50_000, isDiscretionary: false }),
      createInvestment({ id: 'inv-3', currentValue: 25_000, isDiscretionary: true }),
    ];
    expect(calculateTotalDiscretionaryCapital(investments)).toBe(125_000);
  });

  it('returns 0 for an empty list', () => {
    expect(calculateTotalDiscretionaryCapital([])).toBe(0);
  });
});

describe('calculateTotalDiscretionaryContributions', () => {
  it('sums monthlyContribution only for discretionary investments', () => {
    const investments = [
      createInvestment({ monthlyContribution: 2_000, isDiscretionary: true }),
      createInvestment({ id: 'inv-2', monthlyContribution: 1_000, isDiscretionary: false }),
    ];
    expect(calculateTotalDiscretionaryContributions(investments)).toBe(2_000);
  });
});

describe('getExpectedRealReturn', () => {
  it('returns the configured return for a known risk profile', () => {
    expect(getExpectedRealReturn('growth', realReturns)).toBe(0.05);
  });

  it('falls back to 5% when the profile is missing', () => {
    expect(getExpectedRealReturn('unknown' as RiskProfile, {} as RiskProfileReturns)).toBe(0.05);
  });
});

// ============================================================================
// VALIDATION
// ============================================================================

describe('validateGoal', () => {
  it('accepts a fully specified valid goal', () => {
    expect(validateGoal(createGoal())).toEqual([]);
  });

  it('reports each missing/invalid field', () => {
    const errors = validateGoal(
      createGoal({
        goalName: '   ',
        goalAmountToday: 0,
        targetDate: '',
        targetYear: new Date().getFullYear() - 1,
        useClientRiskProfile: false,
        goalSpecificRiskProfile: undefined,
      }),
    );
    expect(errors).toContain('Goal name is required');
    expect(errors).toContain('Goal amount must be greater than 0');
    expect(errors).toContain('Target date is required');
    expect(errors).toContain('Target year must be in the future');
    expect(errors).toContain('Risk profile is required (either client or goal-specific)');
  });

  it('accepts a goal-specific risk profile in place of the client profile', () => {
    const errors = validateGoal(
      createGoal({ useClientRiskProfile: false, goalSpecificRiskProfile: 'balanced' }),
    );
    expect(errors).toEqual([]);
  });
});

describe('validateInputs', () => {
  function createInputs(overrides?: Partial<InvestmentINAInputs>): Partial<InvestmentINAInputs> {
    return {
      currentAge: 40,
      dateOfBirth: '1986-01-01',
      clientRiskProfile: 'balanced',
      longTermInflationRate: 0.05,
      expectedRealReturns: realReturns,
      goals: [createGoal()],
      ...overrides,
    };
  }

  it('passes for a complete, valid input set', () => {
    const result = validateInputs(createInputs());
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('collects errors for missing personal and economic fields', () => {
    const result = validateInputs({ goals: [createGoal()] });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Valid current age is required');
    expect(result.errors).toContain('Date of birth is required');
    expect(result.errors).toContain('Client risk profile is required');
    expect(result.errors).toContain('Valid inflation rate is required');
    expect(result.errors).toContain('Expected real returns are required');
  });

  it('requires at least one goal', () => {
    const result = validateInputs(createInputs({ goals: [] }));
    expect(result.errors).toContain('At least one investment goal is required');
  });

  it('prefixes nested goal errors with the goal index and name', () => {
    const result = validateInputs(
      createInputs({ goals: [createGoal({ goalName: 'House', goalAmountToday: 0 })] }),
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('Goal 1 (House):'))).toBe(true);
  });
});

describe('calculateYearsToGoal', () => {
  it('returns the difference from the current year', () => {
    const future = new Date().getFullYear() + 10;
    expect(calculateYearsToGoal(future)).toBe(10);
  });

  it('never returns a negative number', () => {
    expect(calculateYearsToGoal(new Date().getFullYear() - 5)).toBe(0);
  });
});

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

describe('formatCurrency', () => {
  // NOTE: this helper uses `Number.toLocaleString('en-ZA')`, whose grouping and
  // decimal separators depend on the runtime's ICU/locale data. We therefore
  // assert on the R prefix and the digits rather than exact separator glyphs.
  it('prefixes R and groups the integer part', () => {
    const out = formatCurrency(1234567);
    expect(out.startsWith('R')).toBe(true);
    expect(out.replace(/\D/g, '')).toBe('1234567');
  });

  it('honours an explicit decimals argument', () => {
    const out = formatCurrency(1234.5, 2);
    expect(out.startsWith('R')).toBe(true);
    // 1234.50 -> digits "123450" regardless of separator style.
    expect(out.replace(/\D/g, '')).toBe('123450');
  });
});

describe('formatPercentage', () => {
  it('multiplies by 100 and appends %', () => {
    expect(formatPercentage(0.0532)).toBe('5.3%');
    expect(formatPercentage(0.05, 0)).toBe('5%');
  });
});

describe('status/health helpers', () => {
  it('maps goal status to colors', () => {
    expect(getGoalStatusColor('on-track')).toBe('green');
    expect(getGoalStatusColor('overfunded')).toBe('green');
    expect(getGoalStatusColor('slight-shortfall')).toBe('yellow');
    expect(getGoalStatusColor('moderate-shortfall')).toBe('orange');
    expect(getGoalStatusColor('significant-shortfall')).toBe('red');
    expect(getGoalStatusColor('???')).toBe('gray');
  });

  it('maps goal status to labels', () => {
    expect(getGoalStatusLabel('on-track')).toBe('On Track');
    expect(getGoalStatusLabel('significant-shortfall')).toBe('Significant Shortfall');
    expect(getGoalStatusLabel('???')).toBe('Unknown');
  });

  it('maps portfolio health to colors', () => {
    expect(getPortfolioHealthColor('excellent')).toBe('green');
    expect(getPortfolioHealthColor('good')).toBe('blue');
    expect(getPortfolioHealthColor('needs-attention')).toBe('orange');
    expect(getPortfolioHealthColor('critical')).toBe('red');
    expect(getPortfolioHealthColor('???')).toBe('gray');
  });
});

describe('generateGoalSummary', () => {
  function createResult(overrides?: Partial<GoalCalculationResult>): GoalCalculationResult {
    return {
      goalId: 'goal-1',
      goalName: 'Retirement',
      goalType: 'retirement' as GoalCalculationResult['goalType'],
      goalStatus: 'on-track' as GoalCalculationResult['goalStatus'],
      statusRationale: '',
      timeHorizon: {
        targetYear: 2050,
        currentYear: 2026,
        yearsToGoal: 24,
        isValidTimeHorizon: true,
      },
      projectedCapital: {} as GoalCalculationResult['projectedCapital'],
      fundingGap: {
        goalRequiredReal: 1_000_000,
        projectedCapitalAtGoal: 800_000,
        gapAmount: 200_000,
        hasShortfall: true,
        fundingPercentage: 80,
        gapPercentage: 20,
      },
      requiredContributions: {
        currentMonthlyContribution: 5_000,
        requiredAdditionalMonthly: 1_500,
        recommendedTotalMonthly: 6_500,
        alternativeLumpSumToday: 100_000,
        canMeetGoal: true,
      },
      applicableRiskProfile: 'balanced',
      applicableRealReturn: 0.04,
      calculatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it('describes a shortfall with the funded % and additional monthly amount', () => {
    const summary = generateGoalSummary(createResult());
    expect(summary).toContain('80% funded');
    // Amounts are locale-formatted (separators vary by ICU build), so match
    // on the surrounding wording and the digits rather than exact glyphs.
    expect(summary).toMatch(/shortfall of R200.?000/);
    expect(summary).toMatch(/by R1.?500/);
    expect(summary).toContain('24 years');
  });

  it('describes a surplus when there is no shortfall', () => {
    const summary = generateGoalSummary(
      createResult({
        fundingGap: {
          goalRequiredReal: 1_000_000,
          projectedCapitalAtGoal: 1_200_000,
          gapAmount: -200_000,
          hasShortfall: false,
          fundingPercentage: 120,
          gapPercentage: -20,
        },
      }),
    );
    expect(summary).toContain('120% funded');
    expect(summary).toMatch(/surplus of R200.?000/);
    expect(summary).toContain('meet or exceed');
  });
});
