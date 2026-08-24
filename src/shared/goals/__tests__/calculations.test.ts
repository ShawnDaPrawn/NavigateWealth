/**
 * goals/calculations — unit tests (Phase 4 coverage push).
 *
 * Financial goal projections: calculatePolicyFV (lump-sum + escalating-annuity
 * future value) and calculateGoalStatus (aggregate linked policies, project to
 * the target date, derive shortfall / required contribution / status). Pure
 * maths — asserted with exact fixtures where time-independent and relationally
 * where the projection depends on today's date.
 */
import { describe, expect, it } from 'vitest';
import { calculatePolicyFV, calculateGoalStatus } from '../calculations';
import type { Goal } from '../types';

function goal(over: Record<string, unknown> = {}): Goal {
  return {
    id: 'g1',
    linkedInvestmentIds: [],
    initialLumpSum: 0,
    monthlyContribution: 0,
    targetDate: '2035-01-01',
    targetAmount: 100000,
    annualGrowthRate: 10,
    annualEscalation: 0,
    adHocContributions: [],
    ...over,
  } as unknown as Goal;
}

describe('calculatePolicyFV', () => {
  it('returns the current value when there is no time to target', () => {
    expect(calculatePolicyFV(1000, 500, 12, 0, 0)).toBe(1000);
  });

  it('compounds a lump sum at the monthly growth rate', () => {
    expect(calculatePolicyFV(1000, 0, 12, 0, 12)).toBeCloseTo(1126.83, 1); // 1000 * 1.01^12
  });

  it('adds the future value of contributions when rates differ', () => {
    expect(calculatePolicyFV(0, 100, 12, 0, 12)).toBeCloseTo(1268.25, 1);
  });

  it('handles the equal growth/escalation branch', () => {
    expect(calculatePolicyFV(0, 100, 12, 12, 12)).toBeCloseTo(1338.8, 0);
  });
});

describe('calculateGoalStatus', () => {
  it('aggregates linked-policy values with the base lump sum (only linked ids)', () => {
    const res = calculateGoalStatus(goal({ linkedInvestmentIds: ['p1'], initialLumpSum: 50000 }), [
      { id: 'p1', data: { invest_current_value: 'R 100 000.00' } },
      { id: 'other', data: { invest_current_value: '999' } },
    ]);
    expect(res.totalCurrentValue).toBe(150000);
  });

  it('parses comma-decimal currency values', () => {
    const res = calculateGoalStatus(goal({ linkedInvestmentIds: ['p1'] }), [
      { id: 'p1', data: { invest_current_value: '2500,75' } },
    ]);
    expect(res.totalCurrentValue).toBeCloseTo(2500.75, 2);
  });

  it('reports On Track when the projection meets the target', () => {
    const res = calculateGoalStatus(goal({ initialLumpSum: 100000, targetAmount: 50000 }), []);
    expect(res.status).toBe('On Track');
    expect(res.projectedValue).toBeGreaterThan(100000);
  });

  it('reports Critical and a required contribution when far short', () => {
    const res = calculateGoalStatus(goal({ targetAmount: 1_000_000 }), []);
    expect(res.status).toBe('Critical');
    expect(res.requiredMonthlyContribution).toBeGreaterThan(0);
  });

  it('adds ad-hoc contributions to the projection', () => {
    const base = calculateGoalStatus(goal({ initialLumpSum: 100000 }), []);
    const withAdHoc = calculateGoalStatus(
      goal({ initialLumpSum: 100000, adHocContributions: [{ date: '2030-01-01', amount: 50000 }] }),
      [],
    );
    expect(withAdHoc.projectedValue).toBeGreaterThan(base.projectedValue);
  });

  it('treats an invalid target date as zero months (no growth applied)', () => {
    const res = calculateGoalStatus(goal({ targetDate: 'not-a-date', initialLumpSum: 1000 }), []);
    expect(res.monthsToTarget).toBe(0);
    expect(res.projectedValue).toBe(1000);
  });
});
