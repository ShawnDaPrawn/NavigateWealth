import { describe, expect, it } from 'vitest';
import {
  LumpSumContributionSchema,
  InvestmentGoalSchema,
  DiscretionaryInvestmentSchema,
  RiskProfileReturnsSchema,
  InvestmentINAInputSchema,
} from '../schema';

const validLumpSum = {
  id: 'ls-1',
  amount: 50000,
  expectedDate: '2026-01-01',
};

const validGoal = {
  id: 'goal-1',
  goalName: 'Home Deposit',
  goalType: 'home-deposit',
  goalAmountToday: 500000,
  targetDate: '2030-01-01',
  targetYear: 2030,
  priorityLevel: 'high',
  linkedInvestmentIds: [],
  currentContributionToGoal: 5000,
  expectedLumpSums: [],
  useClientRiskProfile: true,
};

const validReturns = {
  conservative: 0.02,
  moderate: 0.035,
  balanced: 0.05,
  growth: 0.065,
  aggressive: 0.08,
};

describe('LumpSumContributionSchema', () => {
  it('accepts a valid lump sum contribution', () => {
    expect(LumpSumContributionSchema.safeParse(validLumpSum).success).toBe(true);
  });

  it('rejects negative amount', () => {
    expect(LumpSumContributionSchema.safeParse({ ...validLumpSum, amount: -1 }).success).toBe(
      false,
    );
  });
});

describe('InvestmentGoalSchema', () => {
  it('accepts a valid investment goal', () => {
    expect(InvestmentGoalSchema.safeParse(validGoal).success).toBe(true);
  });

  it('rejects invalid goalType', () => {
    expect(InvestmentGoalSchema.safeParse({ ...validGoal, goalType: 'invalid' }).success).toBe(
      false,
    );
  });

  it('rejects invalid priorityLevel', () => {
    expect(
      InvestmentGoalSchema.safeParse({ ...validGoal, priorityLevel: 'critical' }).success,
    ).toBe(false);
  });
});

describe('DiscretionaryInvestmentSchema', () => {
  it('accepts a valid discretionary investment', () => {
    const data = {
      id: 'inv-1',
      productName: 'Unit Trust',
      provider: 'Allan Gray',
      currentValue: 100000,
      monthlyContribution: 5000,
      isDiscretionary: true,
    };
    expect(DiscretionaryInvestmentSchema.safeParse(data).success).toBe(true);
  });

  it('rejects non-discretionary investments', () => {
    const data = {
      id: 'inv-1',
      productName: 'Unit Trust',
      provider: 'Allan Gray',
      currentValue: 100000,
      monthlyContribution: 5000,
      isDiscretionary: false,
    };
    expect(DiscretionaryInvestmentSchema.safeParse(data).success).toBe(false);
  });
});

describe('RiskProfileReturnsSchema', () => {
  it('accepts valid returns object', () => {
    expect(RiskProfileReturnsSchema.safeParse(validReturns).success).toBe(true);
  });
});

describe('InvestmentINAInputSchema', () => {
  it('accepts valid investment INA input with a goal', () => {
    const data = {
      currentAge: 35,
      dateOfBirth: '1989-01-01',
      householdDependants: 2,
      grossMonthlyIncome: 80000,
      netMonthlyIncome: 60000,
      clientRiskProfile: 'moderate',
      longTermInflationRate: 0.06,
      expectedRealReturns: validReturns,
      discretionaryInvestments: [],
      totalDiscretionaryCapitalCurrent: 0,
      totalDiscretionaryMonthlyContributions: 0,
      goals: [validGoal],
    };
    expect(InvestmentINAInputSchema.safeParse(data).success).toBe(true);
  });

  it('rejects input with no goals', () => {
    const data = {
      currentAge: 35,
      dateOfBirth: '1989-01-01',
      householdDependants: 0,
      grossMonthlyIncome: 80000,
      netMonthlyIncome: 60000,
      clientRiskProfile: 'moderate',
      longTermInflationRate: 0.06,
      expectedRealReturns: validReturns,
      discretionaryInvestments: [],
      totalDiscretionaryCapitalCurrent: 0,
      totalDiscretionaryMonthlyContributions: 0,
      goals: [],
    };
    expect(InvestmentINAInputSchema.safeParse(data).success).toBe(false);
  });

  it('rejects invalid risk profile', () => {
    const data = {
      currentAge: 35,
      dateOfBirth: '1989-01-01',
      householdDependants: 0,
      grossMonthlyIncome: 80000,
      netMonthlyIncome: 60000,
      clientRiskProfile: 'very-aggressive',
      longTermInflationRate: 0.06,
      expectedRealReturns: validReturns,
      discretionaryInvestments: [],
      totalDiscretionaryCapitalCurrent: 0,
      totalDiscretionaryMonthlyContributions: 0,
      goals: [validGoal],
    };
    expect(InvestmentINAInputSchema.safeParse(data).success).toBe(false);
  });
});
