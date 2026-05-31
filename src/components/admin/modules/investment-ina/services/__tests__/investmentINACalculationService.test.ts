import { describe, expect, it } from 'vitest';
import {
  calculateAffordability,
  calculateAnnuityFutureValue,
  calculateFutureValue,
  calculatePresentValue,
  calculateRequiredMonthlyPayment,
  calculateTotalDiscretionaryCapital,
  calculateTotalDiscretionaryContributions,
  calculateYearsToGoal,
  formatCurrency,
  formatPercentage,
  generateGoalSummary,
  getExpectedRealReturn,
  getGoalStatusColor,
  getGoalStatusLabel,
  getPortfolioHealthColor,
  validateGoal,
  validateInputs,
} from '../investmentINACalculationService';
import type {
  DiscretionaryInvestment,
  GoalCalculationResult,
  InvestmentGoal,
  RiskProfileReturns,
} from '../../types';

const FUTURE_YEAR = new Date().getFullYear() + 5;

function makeGoal(overrides: Partial<InvestmentGoal> = {}): InvestmentGoal {
  return {
    goalName: 'Retirement',
    goalAmountToday: 1_000_000,
    targetDate: `${FUTURE_YEAR}-01-01`,
    targetYear: FUTURE_YEAR,
    useClientRiskProfile: true,
    ...overrides,
  } as unknown as InvestmentGoal;
}

function makeInvestment(overrides: Partial<DiscretionaryInvestment> = {}): DiscretionaryInvestment {
  return {
    id: 'inv',
    productName: 'Fund',
    provider: 'Provider',
    currentValue: 0,
    monthlyContribution: 0,
    isDiscretionary: true,
    ...overrides,
  };
}

describe('validateGoal', () => {
  it('accepts a complete goal', () => {
    expect(validateGoal(makeGoal())).toEqual([]);
  });

  it('flags each missing/invalid field', () => {
    const errors = validateGoal(
      makeGoal({
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

  it('accepts a goal-specific risk profile in lieu of the client profile', () => {
    const errors = validateGoal(
      makeGoal({ useClientRiskProfile: false, goalSpecificRiskProfile: 'growth' }),
    );
    expect(errors).toEqual([]);
  });
});

describe('validateInputs', () => {
  it('reports missing top-level fields and requires at least one goal', () => {
    const { isValid, errors } = validateInputs({});
    expect(isValid).toBe(false);
    expect(errors).toContain('Valid current age is required');
    expect(errors).toContain('Date of birth is required');
    expect(errors).toContain('Client risk profile is required');
    expect(errors).toContain('Valid inflation rate is required');
    expect(errors).toContain('Expected real returns are required');
    expect(errors).toContain('At least one investment goal is required');
  });

  it('passes for a fully-populated input set', () => {
    const { isValid, errors } = validateInputs({
      currentAge: 40,
      dateOfBirth: '1985-01-01',
      clientRiskProfile: 'balanced',
      longTermInflationRate: 0.06,
      expectedRealReturns: {} as RiskProfileReturns,
      goals: [makeGoal()],
    });
    expect(isValid).toBe(true);
    expect(errors).toEqual([]);
  });

  it('prefixes goal-level errors with the goal index and name', () => {
    const { errors } = validateInputs({
      currentAge: 40,
      dateOfBirth: '1985-01-01',
      clientRiskProfile: 'balanced',
      longTermInflationRate: 0.06,
      expectedRealReturns: {} as RiskProfileReturns,
      goals: [makeGoal({ goalName: 'House', goalAmountToday: 0 })],
    });
    expect(errors.some((e) => e.startsWith('Goal 1 (House):'))).toBe(true);
  });
});

describe('time + money math', () => {
  it('calculateYearsToGoal floors at zero and is relative to the current year', () => {
    const year = new Date().getFullYear();
    expect(calculateYearsToGoal(year + 10)).toBe(10);
    expect(calculateYearsToGoal(year - 3)).toBe(0);
  });

  it('calculateFutureValue compounds a lump sum', () => {
    expect(calculateFutureValue(1000, 0.1, 2)).toBeCloseTo(1210, 6);
  });

  it('calculatePresentValue is the inverse of future value', () => {
    expect(calculatePresentValue(1210, 0.1, 2)).toBeCloseTo(1000, 6);
  });

  it('calculateAnnuityFutureValue returns 0 for no payment or non-positive years', () => {
    expect(calculateAnnuityFutureValue(0, 0.1, 10)).toBe(0);
    expect(calculateAnnuityFutureValue(100, 0.1, 0)).toBe(0);
  });

  it('calculateAnnuityFutureValue accumulates contributions', () => {
    // 1 year, monthly 100 -> 1200 annual * factor((1.1^1 - 1)/0.1 = 1) = 1200
    expect(calculateAnnuityFutureValue(100, 0.1, 1)).toBeCloseTo(1200, 6);
  });

  it('calculateRequiredMonthlyPayment returns 0 when years <= 0, else inverts the annuity', () => {
    expect(calculateRequiredMonthlyPayment(1000, 0.1, 0)).toBe(0);
    const monthly = calculateRequiredMonthlyPayment(1200, 0.1, 1);
    expect(calculateAnnuityFutureValue(monthly, 0.1, 1)).toBeCloseTo(1200, 4);
  });
});

describe('formatting', () => {
  it('formatCurrency prefixes R and keeps the digits (locale-agnostic assertion)', () => {
    expect(formatCurrency(1000).startsWith('R')).toBe(true);
    expect(formatCurrency(1000).replace(/\D/g, '')).toBe('1000');
    expect(formatCurrency(1234.56, 2).replace(/\D/g, '')).toBe('123456');
  });

  it('formatPercentage multiplies by 100 with the given precision', () => {
    expect(formatPercentage(0.05)).toBe('5.0%');
    expect(formatPercentage(0.1234, 2)).toBe('12.34%');
  });
});

describe('status + health mappers', () => {
  it('maps goal status to a colour', () => {
    expect(getGoalStatusColor('on-track')).toBe('green');
    expect(getGoalStatusColor('overfunded')).toBe('green');
    expect(getGoalStatusColor('slight-shortfall')).toBe('yellow');
    expect(getGoalStatusColor('moderate-shortfall')).toBe('orange');
    expect(getGoalStatusColor('significant-shortfall')).toBe('red');
    expect(getGoalStatusColor('???')).toBe('gray');
  });

  it('maps goal status to a label', () => {
    expect(getGoalStatusLabel('on-track')).toBe('On Track');
    expect(getGoalStatusLabel('overfunded')).toBe('Overfunded');
    expect(getGoalStatusLabel('significant-shortfall')).toBe('Significant Shortfall');
    expect(getGoalStatusLabel('???')).toBe('Unknown');
  });

  it('maps portfolio health to a colour', () => {
    expect(getPortfolioHealthColor('excellent')).toBe('green');
    expect(getPortfolioHealthColor('good')).toBe('blue');
    expect(getPortfolioHealthColor('needs-attention')).toBe('orange');
    expect(getPortfolioHealthColor('critical')).toBe('red');
    expect(getPortfolioHealthColor('???')).toBe('gray');
  });
});

describe('discretionary aggregation', () => {
  const investments: DiscretionaryInvestment[] = [
    makeInvestment({ id: 'a', currentValue: 1000, monthlyContribution: 50, isDiscretionary: true }),
    makeInvestment({ id: 'b', currentValue: 2000, monthlyContribution: 75, isDiscretionary: true }),
    makeInvestment({
      id: 'c',
      currentValue: 9999,
      monthlyContribution: 999,
      isDiscretionary: false,
    }),
  ];

  it('sums only discretionary capital', () => {
    expect(calculateTotalDiscretionaryCapital(investments)).toBe(3000);
  });

  it('sums only discretionary contributions', () => {
    expect(calculateTotalDiscretionaryContributions(investments)).toBe(125);
  });
});

describe('getExpectedRealReturn', () => {
  const returns = {
    conservative: 0.02,
    moderate: 0.03,
    balanced: 0.04,
    growth: 0.06,
    aggressive: 0.08,
  };

  it('returns the configured rate', () => {
    expect(getExpectedRealReturn('growth', returns)).toBe(0.06);
  });

  it('defaults to 5% when the profile is missing', () => {
    expect(getExpectedRealReturn('balanced', { conservative: 0 } as never)).toBe(0.05);
  });
});

describe('generateGoalSummary', () => {
  it('describes a shortfall with the required additional contribution', () => {
    const result = {
      fundingGap: { fundingPercentage: 75.4, hasShortfall: true, gapAmount: 50000 },
      timeHorizon: { yearsToGoal: 10 },
      requiredContributions: { requiredAdditionalMonthly: 1500 },
    } as unknown as GoalCalculationResult;

    const summary = generateGoalSummary(result);
    expect(summary).toContain('75% funded');
    expect(summary).toContain('shortfall');
    expect(summary).toContain('Increase monthly contributions');
    expect(summary).toContain('10 years');
  });

  it('describes a surplus when overfunded (>100%)', () => {
    const result = {
      fundingGap: { fundingPercentage: 120, hasShortfall: false, gapAmount: -25000 },
      timeHorizon: { yearsToGoal: 8 },
      requiredContributions: { requiredAdditionalMonthly: 0 },
    } as unknown as GoalCalculationResult;

    const summary = generateGoalSummary(result);
    expect(summary).toContain('120% funded');
    expect(summary).toContain('surplus of');
    expect(summary).toContain('8 years');
  });

  it('omits the surplus phrase at exactly 100% funded', () => {
    const result = {
      fundingGap: { fundingPercentage: 100, hasShortfall: false, gapAmount: 0 },
      timeHorizon: { yearsToGoal: 5 },
      requiredContributions: { requiredAdditionalMonthly: 0 },
    } as unknown as GoalCalculationResult;

    const summary = generateGoalSummary(result);
    expect(summary).toContain('100% funded');
    expect(summary).not.toContain('surplus');
  });
});

describe('calculateAffordability', () => {
  it('treats non-positive income as affordable with 0%', () => {
    expect(calculateAffordability(1000, 0)).toEqual({ percentage: 0, isAffordable: true });
  });

  it('is affordable at or below 30% of gross income, with no warning', () => {
    const result = calculateAffordability(3000, 10000);
    expect(result.percentage).toBeCloseTo(30, 6);
    expect(result.isAffordable).toBe(true);
    expect(result.warningMessage).toBeUndefined();
  });

  it('flags a warning above 30% of gross income', () => {
    const result = calculateAffordability(4000, 10000);
    expect(result.isAffordable).toBe(false);
    expect(result.warningMessage).toContain('40.0%');
  });
});
