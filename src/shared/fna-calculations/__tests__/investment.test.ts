/**
 * Investment INA engine — every expectation below is worked by hand (shown
 * in the comments), not read back from the code.
 */
import { describe, expect, it } from 'vitest';
import {
  INACalculationError,
  calculateINA,
  futureValueOfMonthlyContributions,
  goalHorizonMonths,
  monthlyAnnuityFactor,
  requiredMonthlyContribution,
  resolveInvestmentAllocations,
  suitableRiskProfileFor,
  validateINAInputs,
  wholeMonthsBetween,
  type INAGoalInput,
  type INAInputs,
} from '../investment';

const NOW = new Date('2026-11-24T00:00:00Z');

const RETURNS = {
  conservative: 0,
  moderate: 0.035,
  balanced: 0.05,
  growth: 0.065,
  aggressive: 0.08,
};

function goal(overrides: Partial<INAGoalInput> = {}): INAGoalInput {
  return {
    id: 'g1',
    goalName: 'Goal',
    goalAmountToday: 1_000_000,
    targetYear: 2036,
    targetDate: '2036-11-24', // exactly 120 months after NOW
    priorityLevel: 'medium',
    useClientRiskProfile: true,
    linkedInvestmentIds: [],
    currentContributionToGoal: 0,
    expectedLumpSums: [],
    ...overrides,
  };
}

function inputs(overrides: Partial<INAInputs> = {}): INAInputs {
  return {
    goals: [goal()],
    clientRiskProfile: 'balanced',
    expectedRealReturns: RETURNS,
    longTermInflationRate: 0.06,
    discretionaryInvestments: [],
    ...overrides,
  };
}

describe('money primitives', () => {
  it('uses the limit (n months) at a 0% rate instead of 0/0', () => {
    expect(monthlyAnnuityFactor(0, 24)).toBe(24);
    // R1,000 a month for 24 months at 0% = R24,000
    expect(futureValueOfMonthlyContributions(1000, 0, 24)).toBe(24_000);
    expect(requiredMonthlyContribution(24_000, 0, 24)).toBe(1000);
  });

  it('compounds monthly at the monthly equivalent of the annual real rate', () => {
    // rm = 1.05^(1/12) − 1 = 0.0040741238; factor = (1.05^10 − 1) / rm = 154.3632
    expect(monthlyAnnuityFactor(Math.pow(1.05, 1 / 12) - 1, 120)).toBeCloseTo(154.3632, 3);
    // R1,000 a month for 10 years at 5% real = R154,363.16
    // (the old annual approximation gave 12,000 × 12.5779 = R150,935)
    expect(futureValueOfMonthlyContributions(1000, 0.05, 120)).toBeCloseTo(154_363.16, 1);
    // ...and the solved contribution is its exact inverse: 500,000 / 154.3632
    expect(requiredMonthlyContribution(500_000, 0.05, 120)).toBeCloseTo(3239.11, 1);
  });
});

describe('horizon', () => {
  it('counts whole months to the target date', () => {
    expect(wholeMonthsBetween(NOW, new Date('2031-06-30T00:00:00Z'))).toBe(55);
    // one day short of a whole month does not count it
    expect(wholeMonthsBetween(NOW, new Date('2026-12-23T00:00:00Z'))).toBe(0);
    expect(goalHorizonMonths(goal(), NOW)).toBe(120);
  });

  it('falls back to whole years when no target date is held', () => {
    expect(goalHorizonMonths(goal({ targetDate: '', targetYear: 2030 }), NOW)).toBe(48);
  });
});

describe('a single goal, monthly compounding', () => {
  it('projects existing capital, contributions and the gap by hand', () => {
    const result = calculateINA(
      inputs({
        goals: [goal({ linkedInvestmentIds: ['a'], currentContributionToGoal: 2000 })],
        discretionaryInvestments: [{ id: 'a', productName: 'Unit trust', currentValue: 200_000 }],
      }),
      NOW,
    ).goalResults[0];

    // Existing: 200,000 × 1.05^10 = 325,778.93
    expect(result.projectedCapital.existingCapital.totalExistingFutureValue).toBeCloseTo(
      325_778.93,
      1,
    );
    // Contributions: 2,000 × 154.36316 = 308,726.32
    expect(result.projectedCapital.monthlyContributions.futureValueOfContributions).toBeCloseTo(
      308_726.32,
      1,
    );
    // Gap: 1,000,000 − 634,505.25 = 365,494.75
    expect(result.fundingGap.gapAmount).toBeCloseTo(365_494.75, 1);
    // Extra a month: 365,494.75 / 154.36316 = 2,367.76
    expect(result.requiredContributions.requiredAdditionalMonthly).toBeCloseTo(2367.76, 1);
    // Lump sum today: 365,494.75 / 1.05^10 = 224,382.07
    expect(result.requiredContributions.alternativeLumpSumToday).toBeCloseTo(224_382.07, 1);
    expect(result.timeHorizon.yearsToGoal).toBe(10);
    expect(result.timeHorizon.monthsToGoal).toBe(120);
  });

  it('projects at 0% real without producing NaN', () => {
    const result = calculateINA(
      inputs({
        clientRiskProfile: 'conservative',
        goals: [goal({ goalAmountToday: 240_000, currentContributionToGoal: 1000 })],
      }),
      NOW,
    ).goalResults[0];
    // 1,000 × 120 = 120,000 projected; 120,000 gap; 120,000 / 120 = 1,000 extra a month
    expect(result.projectedCapital.totalProjectedCapital).toBe(120_000);
    expect(result.requiredContributions.requiredAdditionalMonthly).toBe(1000);
    expect(Number.isFinite(result.requiredContributions.alternativeLumpSumToday)).toBe(true);
  });

  it('ignores a lump sum that arrives after the target date', () => {
    const result = calculateINA(
      inputs({
        goals: [
          goal({
            expectedLumpSums: [
              { id: 'early', amount: 100_000, expectedDate: '2031-11-24' },
              { id: 'late', amount: 100_000, expectedDate: '2037-01-01' },
            ],
          }),
        ],
      }),
      NOW,
    ).goalResults[0];
    const [early, late] = result.projectedCapital.lumpSums;
    // early: 5 years to the goal → 100,000 × 1.05^5 = 127,628.16
    expect(early.futureValue).toBeCloseTo(127_628.16, 1);
    expect(late.arrivesAfterGoal).toBe(true);
    expect(late.futureValue).toBe(0);
  });
});

describe('risk profile resolution', () => {
  it("falls back to the client's profile when the goal's has no return", () => {
    const result = calculateINA(
      inputs({
        expectedRealReturns: { balanced: 0.05 },
        goals: [goal({ useClientRiskProfile: false, goalSpecificRiskProfile: 'growth' })],
      }),
      NOW,
    ).goalResults[0];
    expect(result.applicableRiskProfile).toBe('balanced');
    expect(result.applicableRealReturn).toBe(0.05);
    expect(result.riskProfileNote).toContain('growth');
  });

  it('refuses to calculate when no return can be found, instead of using 0%', () => {
    const bad = inputs({ clientRiskProfile: 'balanced', expectedRealReturns: { growth: 0.06 } });
    expect(validateINAInputs(bad)[0]).toContain('no expected real return');
    expect(() => calculateINA(bad, NOW)).toThrow(INACalculationError);
  });
});

describe('investments linked to several goals', () => {
  const investments = [{ id: 'a', productName: 'Unit trust', currentValue: 100_000 }];

  it('splits an investment equally when no allocation is entered', () => {
    const results = calculateINA(
      inputs({
        clientRiskProfile: 'conservative',
        discretionaryInvestments: investments,
        goals: [
          goal({ id: 'g1', linkedInvestmentIds: ['a'] }),
          goal({ id: 'g2', linkedInvestmentIds: ['a'] }),
        ],
      }),
      NOW,
    );
    // At 0% each goal counts 50,000 — together the full 100,000, not 200,000
    for (const g of results.goalResults) {
      const linked = g.projectedCapital.existingCapital.linkedInvestments[0];
      expect(linked.allocationPercent).toBe(50);
      expect(linked.allocatedValue).toBe(50_000);
      expect(linked.isShared).toBe(true);
      expect(g.projectedCapital.totalProjectedCapital).toBe(50_000);
    }
    expect(results.portfolioSummary.totalProjectedCapital).toBe(100_000);
  });

  it('gives the remainder of an explicit allocation to the other goals', () => {
    const { allocations } = resolveInvestmentAllocations([
      goal({ id: 'g1', linkedInvestmentIds: ['a'], linkedInvestmentAllocations: { a: 70 } }),
      goal({ id: 'g2', linkedInvestmentIds: ['a'] }),
    ]);
    expect(allocations.get('g1')?.get('a')?.percent).toBe(70);
    expect(allocations.get('g2')?.get('a')?.percent).toBe(30);
  });

  it('refuses allocations of one investment above 100% in total', () => {
    const bad = inputs({
      discretionaryInvestments: investments,
      goals: [
        goal({ id: 'g1', linkedInvestmentIds: ['a'], linkedInvestmentAllocations: { a: 70 } }),
        goal({ id: 'g2', linkedInvestmentIds: ['a'], linkedInvestmentAllocations: { a: 50 } }),
      ],
    });
    expect(validateINAInputs(bad).join()).toContain('120%');
    expect(() => calculateINA(bad, NOW)).toThrow(INACalculationError);
  });
});

describe('suitability of the risk profile for the horizon', () => {
  it('warns when an aggressive profile is used for a 3-year goal', () => {
    const result = calculateINA(
      inputs({
        clientRiskProfile: 'aggressive',
        goals: [goal({ targetDate: '2029-11-24', targetYear: 2029 })],
      }),
      NOW,
    ).goalResults[0];
    // 3 years: aggressive needs 7, growth 5, balanced 3 → suggest balanced
    expect(result.suitabilityWarning).toContain('at least 7 years');
    expect(result.suggestedRiskProfile).toBe('balanced');
  });

  it('does not warn when the horizon is long enough', () => {
    const result = calculateINA(inputs({ clientRiskProfile: 'aggressive' }), NOW).goalResults[0];
    expect(result.suitabilityWarning).toBeUndefined();
  });

  it('suggests the most growth-oriented profile the horizon allows', () => {
    expect(suitableRiskProfileFor(1)).toBe('conservative');
    expect(suitableRiskProfileFor(2.5)).toBe('moderate');
    expect(suitableRiskProfileFor(10)).toBe('aggressive');
  });
});

describe('affordability and funding priority', () => {
  // At 0%: high-priority goal 60,000 in 24 months → R2,500 a month;
  // low-priority goal 48,000 in 24 months → R2,000 a month.
  const twoGoals = inputs({
    clientRiskProfile: 'conservative',
    grossMonthlyIncome: 10_000,
    goals: [
      goal({
        id: 'low',
        goalName: 'Holiday',
        priorityLevel: 'low',
        goalAmountToday: 48_000,
        targetDate: '2028-11-24',
      }),
      goal({
        id: 'high',
        goalName: 'Education',
        priorityLevel: 'high',
        goalAmountToday: 60_000,
        targetDate: '2028-11-24',
      }),
    ],
  });

  it('checks the total against 30% of gross income', () => {
    const { affordability } = calculateINA(twoGoals, NOW).portfolioSummary;
    expect(affordability.incomeBasis).toBe('gross');
    expect(affordability.affordableMonthly).toBe(3000); // 30% × 10,000
    expect(affordability.totalRecommendedMonthly).toBe(4500);
    expect(affordability.percentageOfIncome).toBe(45);
    expect(affordability.isAffordable).toBe(false);
  });

  it('funds goals in priority order within the budget', () => {
    const results = calculateINA(twoGoals, NOW);
    const [first, second] = results.portfolioSummary.priorityFunding;
    expect(first.goalId).toBe('high');
    expect(first.fundingStatus).toBe('fully-funded');
    expect(first.allocatedMonthly).toBe(2500);
    expect(second.goalId).toBe('low');
    expect(second.fundingStatus).toBe('partially-funded');
    expect(second.allocatedMonthly).toBe(500); // 3,000 − 2,500
    expect(second.projectedFundingPercentage).toBe(25); // 500 × 24 / 48,000

    const low = results.goalResults.find((g) => g.goalId === 'low');
    const high = results.goalResults.find((g) => g.goalId === 'high');
    expect(low?.requiredContributions.canMeetGoal).toBe(false);
    expect(low?.requiredContributions.canMeetGoalReason).toBe('affordability');
    expect(high?.requiredContributions.canMeetGoal).toBe(true);
    expect(results.recommendations.some((r) => r.type === 'affordability')).toBe(true);
  });

  it('marks a goal whose target date has passed as unmeetable', () => {
    const result = calculateINA(
      inputs({ goals: [goal({ targetDate: '2026-01-01', targetYear: 2026 })] }),
      NOW,
    ).goalResults[0];
    expect(result.timeHorizon.isValidTimeHorizon).toBe(false);
    expect(result.requiredContributions.canMeetGoal).toBe(false);
    expect(result.requiredContributions.canMeetGoalReason).toBe('horizon');
  });

  it('does not assess affordability without income', () => {
    const { affordability, priorityFunding } = calculateINA(
      { ...twoGoals, grossMonthlyIncome: 0, netMonthlyIncome: 0 },
      NOW,
    ).portfolioSummary;
    expect(affordability.affordableMonthly).toBeNull();
    expect(priorityFunding.every((r) => r.fundingStatus === 'not-assessed')).toBe(true);
  });
});

describe('portfolio health is capital-weighted', () => {
  it('weights by goal size and caps each goal at 100%', () => {
    // Big goal R1,000,000, overfunded at 0% by a R1,200,000 investment;
    // small goal R100,000 with nothing. min(1.2m, 1m) + 0 = 1,000,000 of 1,100,000 = 90.9%
    const results = calculateINA(
      inputs({
        clientRiskProfile: 'conservative',
        discretionaryInvestments: [{ id: 'a', productName: 'Shares', currentValue: 1_200_000 }],
        goals: [
          goal({ id: 'big', linkedInvestmentIds: ['a'] }),
          goal({ id: 'small', goalAmountToday: 100_000 }),
        ],
      }),
      NOW,
    );
    expect(results.portfolioSummary.capitalWeightedFundingPercentage).toBeCloseTo(90.909, 2);
    // One goal of two on track would have read "needs attention" before.
    expect(results.portfolioSummary.overallPortfolioHealth).toBe('excellent');
  });

  it('labels the real returns as after fees and inflation', () => {
    const results = calculateINA(inputs(), NOW);
    expect(results.economicAssumptions.realReturnBasis).toBe('after fees and inflation');
    expect(results.assumptions.join(' ')).toContain('after fees and inflation');
  });
});
