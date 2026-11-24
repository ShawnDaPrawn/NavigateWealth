/**
 * Monthly expenses the platform already knows about, so a budget doesn't
 * have to capture them again: repayments on the client's liabilities and
 * premiums or contributions on their policies.
 *
 * They are derived each time from the source records and never written into
 * `budgetExpenses`, so they stay in step with Assets & liabilities and
 * Policy details and are changed there (the same rule as linked policy
 * assets in utils/derivedPolicyAssets).
 */
import type { PolicyAssetSourceRecord } from './derivedPolicyAssets';

export type BudgetCategory = 'needs' | 'wants' | 'savings';

export interface KnownBudgetExpense {
  id: string;
  /** Row title: the liability's name, or the policy's provider. */
  description: string;
  /** Second line: what the amount is, and the provider or policy number. */
  detail: string;
  /** Monthly amount in rands. */
  amount: number;
  category: BudgetCategory;
  source: 'liability' | 'policy';
}

interface PolicyExpenseRule {
  label: string;
  category: BudgetCategory;
  /** Premium fields: default-schema field IDs and their key IDs, in order. */
  keys: string[];
  /** Policy-number fields. */
  numberKeys: string[];
}

/**
 * Which policies cost the client money each month, and where.
 *
 * Insurance premiums are Needs; retirement and investment contributions are
 * Savings. Left out on purpose:
 *  - employee benefits: the employer deducts these before net pay, which is
 *    the income the budget starts from, so counting them would double-count;
 *  - post-retirement and guaranteed products: they pay out or were bought
 *    with a lump sum, so there is no monthly contribution;
 *  - tax planning: not a monthly cost.
 */
const POLICY_EXPENSE_RULES: Record<string, PolicyExpenseRule> = {
  risk_planning: {
    label: 'Life cover premium',
    category: 'needs',
    keys: ['rp_6'],
    numberKeys: ['rp_1'],
  },
  medical_aid: {
    label: 'Medical aid premium',
    category: 'needs',
    keys: ['ma_6'],
    numberKeys: ['ma_1'],
  },
  estate_planning: {
    label: 'Estate plan premium',
    category: 'needs',
    keys: ['est_5'],
    numberKeys: ['est_1'],
  },
  short_term: {
    label: 'Short-term insurance premium',
    category: 'needs',
    keys: [],
    numberKeys: [],
  },
  retirement_planning: {
    label: 'Retirement contribution',
    category: 'savings',
    keys: ['retirement_monthly_contribution', 'ret_6', 'ret_pre_6'],
    numberKeys: ['ret_1', 'ret_pre_1'],
  },
  retirement_pre: {
    label: 'Retirement contribution',
    category: 'savings',
    keys: ['retirement_monthly_contribution', 'ret_pre_6', 'ret_6'],
    numberKeys: ['ret_pre_1', 'ret_1'],
  },
  investments: {
    label: 'Investment contribution',
    category: 'savings',
    keys: ['invest_monthly_contribution', 'inv_6', 'inv_vol_6'],
    numberKeys: ['inv_1', 'inv_vol_1'],
  },
  investments_voluntary: {
    label: 'Investment contribution',
    category: 'savings',
    keys: ['invest_monthly_contribution', 'inv_vol_6', 'inv_6'],
    numberKeys: ['inv_vol_1', 'inv_1'],
  },
};

/** A field name that holds a premium amount, not its escalation or date. */
const PREMIUM_KEY = /premium|contribution/i;
const NOT_AN_AMOUNT = /escalat|increase|percent|pct|date|frequency|term|notes?$/i;

function toAmount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  return 0;
}

function firstText(data: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function premiumOf(data: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const amount = toAmount(data[key]);
    if (amount > 0) return amount;
  }
  // Custom schemas name their own fields: take the first one that is plainly
  // a premium or contribution amount.
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && typeof value === 'object') continue;
    if (!PREMIUM_KEY.test(key) || NOT_AN_AMOUNT.test(key)) continue;
    const amount = toAmount(value);
    if (amount > 0) return amount;
  }
  return 0;
}

/** Premiums and contributions on the client's active policies. */
export function derivePolicyBudgetExpenses(
  policies: PolicyAssetSourceRecord[] | null | undefined,
): KnownBudgetExpense[] {
  if (!Array.isArray(policies)) return [];

  const expenses: KnownBudgetExpense[] = [];
  for (const policy of policies) {
    if (!policy || policy.archived || !policy.data || typeof policy.data !== 'object') continue;
    const categoryId = String(policy.categoryId || policy.category || '').trim();
    const rule = POLICY_EXPENSE_RULES[categoryId];
    if (!rule) continue;

    const data = policy.data as Record<string, unknown>;
    const amount = premiumOf(data, rule.keys);
    if (amount <= 0) continue;

    const provider = policy.providerName?.trim() || 'Policy';
    const policyNumber = firstText(data, rule.numberKeys);
    expenses.push({
      id: `policy-expense:${policy.id}`,
      description: provider,
      detail: policyNumber ? `${rule.label} · ${policyNumber}` : rule.label,
      amount,
      category: rule.category,
      source: 'policy',
    });
  }
  return expenses.sort((a, b) => b.amount - a.amount);
}

interface LiabilityLike {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  customType?: unknown;
  provider?: unknown;
  monthlyPayment?: unknown;
}

/** Monthly repayments on the client's liabilities. Minimum repayments are Needs. */
export function deriveLiabilityBudgetExpenses(liabilities: unknown): KnownBudgetExpense[] {
  if (!Array.isArray(liabilities)) return [];

  const expenses: KnownBudgetExpense[] = [];
  liabilities.forEach((raw: unknown, index) => {
    if (!raw || typeof raw !== 'object') return;
    const liability = raw as LiabilityLike;
    const amount = toAmount(liability.monthlyPayment);
    if (amount <= 0) return;

    const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
    const type =
      (text(liability.type) === 'Other' && text(liability.customType)) || text(liability.type);
    const provider = text(liability.provider);
    const description = text(liability.name) || type || `Liability ${index + 1}`;
    expenses.push({
      id: `liability-expense:${text(liability.id) || index}`,
      description,
      detail: [type ? `${type} repayment` : 'Repayment', provider].filter(Boolean).join(' · '),
      amount,
      category: 'needs',
      source: 'liability',
    });
  });
  return expenses;
}
