import { describe, expect, it } from 'vitest';

import { goalLinksByPolicyId } from '../linkedGoalStatus';
import type { GoalCalculationResult, InvestmentGoal, InvestmentINASession } from '../types';

function goal(id: string, name: string, linkedInvestmentIds: string[]): InvestmentGoal {
  return {
    id,
    goalName: name,
    goalType: 'education',
    goalAmountToday: 500_000,
    targetDate: '2030-12-31',
    targetYear: 2030,
    priorityLevel: 'high',
    linkedInvestmentIds,
    currentContributionToGoal: 0,
    expectedLumpSums: [],
    useClientRiskProfile: true,
  };
}

function result(
  goalId: string,
  goalStatus: GoalCalculationResult['goalStatus'],
  requiredAdditionalMonthly: number,
): GoalCalculationResult {
  return {
    goalId,
    goalStatus,
    requiredContributions: { requiredAdditionalMonthly },
  } as unknown as GoalCalculationResult;
}

function session(
  goals: InvestmentGoal[],
  goalResults: GoalCalculationResult[] | null,
): Pick<InvestmentINASession, 'inputs' | 'results'> {
  return {
    inputs: { goals } as InvestmentINASession['inputs'],
    results: goalResults ? ({ goalResults } as unknown as InvestmentINASession['results']) : null,
  };
}

describe('goalLinksByPolicyId', () => {
  it('is empty without a published goals analysis', () => {
    expect(goalLinksByPolicyId(null)).toEqual({});
    expect(goalLinksByPolicyId(undefined)).toEqual({});
  });

  it('is empty when the analysis has not been calculated', () => {
    expect(goalLinksByPolicyId(session([goal('g1', 'Education', ['p1'])], null))).toEqual({});
  });

  it('marks each linked policy with its goal, status and monthly shortfall', () => {
    const links = goalLinksByPolicyId(
      session(
        [goal('g1', 'Education', ['p1', 'p2']), goal('g2', 'Home deposit', ['p3'])],
        [result('g1', 'on-track', 0), result('g2', 'moderate-shortfall', 1_250)],
      ),
    );

    expect(links.p1).toEqual({
      name: 'Education',
      status: 'On Track',
      targetAmount: 500_000,
      requiredMonthly: 0,
      targetDate: '2030-12-31',
    });
    expect(links.p2?.name).toBe('Education');
    expect(links.p3).toMatchObject({
      name: 'Home deposit',
      status: 'At Risk',
      requiredMonthly: 1_250,
    });
    expect(Object.keys(links).sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('maps every goal status onto the three policy-table states', () => {
    const statuses: GoalCalculationResult['goalStatus'][] = [
      'on-track',
      'overfunded',
      'slight-shortfall',
      'moderate-shortfall',
      'significant-shortfall',
    ];
    const links = goalLinksByPolicyId(
      session(
        statuses.map((_, i) => goal(`g${i}`, `Goal ${i}`, [`p${i}`])),
        statuses.map((s, i) => result(`g${i}`, s, 0)),
      ),
    );
    expect(statuses.map((_, i) => links[`p${i}`]?.status)).toEqual([
      'On Track',
      'On Track',
      'At Risk',
      'At Risk',
      'Critical',
    ]);
  });

  it('shows the worst goal when one investment funds several', () => {
    const links = goalLinksByPolicyId(
      session(
        [goal('g1', 'Travel', ['shared']), goal('g2', 'Education', ['shared'])],
        [result('g1', 'on-track', 0), result('g2', 'significant-shortfall', 3_000)],
      ),
    );
    expect(links.shared).toMatchObject({ name: 'Education', status: 'Critical' });
  });
});
