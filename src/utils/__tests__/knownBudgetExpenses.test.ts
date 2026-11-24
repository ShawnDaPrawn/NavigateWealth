import { describe, expect, it } from 'vitest';
import { deriveLiabilityBudgetExpenses, derivePolicyBudgetExpenses } from '../knownBudgetExpenses';

describe('deriveLiabilityBudgetExpenses', () => {
  it('turns each repayment into a Needs expense', () => {
    expect(
      deriveLiabilityBudgetExpenses([
        {
          id: 'l1',
          name: 'Credit Card',
          type: 'Credit Card',
          provider: 'Nedbank',
          monthlyPayment: 5000,
        },
        { id: 'l2', name: 'Paid-off loan', type: 'Personal Loan', monthlyPayment: 0 },
        { id: 'l3', type: 'Other', customType: 'Family loan', monthlyPayment: '1 200' },
      ]),
    ).toEqual([
      {
        id: 'liability-expense:l1',
        description: 'Credit Card',
        detail: 'Credit Card repayment · Nedbank',
        amount: 5000,
        category: 'needs',
        source: 'liability',
      },
      expect.objectContaining({
        id: 'liability-expense:l3',
        description: 'Family loan',
        amount: 1200,
      }),
    ]);
  });

  it('ignores anything that is not a list', () => {
    expect(deriveLiabilityBudgetExpenses(undefined)).toEqual([]);
    expect(deriveLiabilityBudgetExpenses({})).toEqual([]);
  });
});

describe('derivePolicyBudgetExpenses', () => {
  it('reads premiums as Needs and contributions as Savings', () => {
    const expenses = derivePolicyBudgetExpenses([
      {
        id: 'p1',
        categoryId: 'risk_planning',
        providerName: 'Brightrock',
        data: { rp_1: 'BR1', rp_6: 1450 },
      },
      {
        id: 'p2',
        categoryId: 'retirement_pre',
        providerName: 'Allan Gray',
        data: { ret_pre_1: 'RA1', ret_pre_6: '2500' },
      },
      {
        id: 'p3',
        categoryId: 'investments_voluntary',
        providerName: 'Allan Gray',
        data: { invest_monthly_contribution: 1000 },
      },
    ]);
    expect(expenses).toEqual([
      expect.objectContaining({
        id: 'policy-expense:p2',
        description: 'Allan Gray',
        detail: 'Retirement contribution · RA1',
        amount: 2500,
        category: 'savings',
        source: 'policy',
      }),
      expect.objectContaining({
        detail: 'Life cover premium · BR1',
        amount: 1450,
        category: 'needs',
      }),
      expect.objectContaining({ id: 'policy-expense:p3', amount: 1000, category: 'savings' }),
    ]);
  });

  it('finds a premium on a custom schema, but not its escalation', () => {
    expect(
      derivePolicyBudgetExpenses([
        {
          id: 'c1',
          categoryId: 'medical_aid',
          data: { premium_escalation: 8, monthly_premium: 4200 },
        },
      ]),
    ).toEqual([expect.objectContaining({ amount: 4200, category: 'needs' })]);
  });

  it('skips archived policies, payouts and salary deductions', () => {
    expect(
      derivePolicyBudgetExpenses([
        { id: 'a', categoryId: 'risk_planning', archived: true, data: { rp_6: 100 } },
        { id: 'b', categoryId: 'retirement_post', data: { ret_post_6: 9000 } },
        { id: 'c', categoryId: 'employee_benefits', data: { eb_5: 700 } },
        { id: 'd', categoryId: 'risk_planning', data: {} },
      ]),
    ).toEqual([]);
    expect(derivePolicyBudgetExpenses(undefined)).toEqual([]);
  });
});
