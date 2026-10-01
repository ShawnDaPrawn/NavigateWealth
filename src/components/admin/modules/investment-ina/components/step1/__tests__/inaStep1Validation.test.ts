import { describe, expect, it } from 'vitest';
import type { InvestmentGoal, InvestmentINAInputs } from '../../../types';
import { findINAStep1Problem } from '../inaStep1Validation';

const FUTURE_YEAR = new Date().getFullYear() + 5;

function goal(overrides: Partial<InvestmentGoal> = {}): InvestmentGoal {
  return {
    id: 'g1',
    goalName: 'Education',
    goalType: 'education',
    goalAmountToday: 250_000,
    targetDate: `${FUTURE_YEAR}-01-01`,
    targetYear: FUTURE_YEAR,
    priorityLevel: 'high',
    linkedInvestmentIds: [],
    currentContributionToGoal: 0,
    expectedLumpSums: [],
    useClientRiskProfile: true,
    ...overrides,
  };
}

function ready(overrides: Partial<InvestmentINAInputs> = {}): Partial<InvestmentINAInputs> {
  return {
    currentAge: 42,
    dateOfBirth: '1984-03-01',
    clientRiskProfile: 'balanced',
    goals: [goal()],
    ...overrides,
  };
}

describe('findINAStep1Problem', () => {
  it('sends the adviser to the first incomplete tab, in order', () => {
    expect(findINAStep1Problem({})).toEqual({
      tab: 'overview',
      message: 'Please provide the client’s age and date of birth',
    });
    expect(findINAStep1Problem(ready({ currentAge: 0 }))?.tab).toBe('overview');
    expect(findINAStep1Problem(ready({ dateOfBirth: '' }))?.tab).toBe('overview');
    expect(findINAStep1Problem(ready({ clientRiskProfile: undefined }))).toEqual({
      tab: 'risk-profile',
      message: 'Please select a risk profile',
    });
    expect(findINAStep1Problem(ready({ goals: [] }))).toEqual({
      tab: 'goals',
      message: 'Please add at least one investment goal',
    });
  });

  it('names the first invalid goal and ignores later ones', () => {
    const problem = findINAStep1Problem(
      ready({
        goals: [
          goal({ id: 'ok' }),
          goal({ id: 'bad', goalName: '', goalAmountToday: 0 }),
          goal({ id: 'later', goalName: '' }),
        ],
      }),
    );
    expect(problem).toEqual({
      tab: 'goals',
      message: 'Goal "Untitled": Goal name is required',
    });
  });

  it('lets a complete Step 1 run the calculation', () => {
    expect(findINAStep1Problem(ready())).toBeNull();
  });
});
