/**
 * Client goals and planning preferences, kept on the client's profile record.
 *
 * Two top-level profile keys:
 * - `profileGoals` — the client's own stated goals (retire at 60, the
 *   children's university, a deposit on a house). The client keeps them in the
 *   portal; the adviser sees and edits the same list.
 * - `planningProfile` — the planning inputs a financial plan needs and the
 *   suitability facts FAIS asks for: retirement age and income target,
 *   emergency fund, investment knowledge and experience, capacity for loss.
 *
 * Not the Goal Planner. The adviser's Goal Planner (`src/shared/goals`, KV
 * `client_goals:{id}`) projects investment goals against linked policies with
 * growth and inflation assumptions; it is admin-only and saved as a whole list.
 * These goals are what the client says they want. The two share their core
 * fields (name, target amount, target date, priority) so a profile goal can be
 * taken into the planner later without translation.
 */

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

// ============================================================================
// Goals
// ============================================================================

export type ProfileGoalCategory =
  | 'retirement'
  | 'education'
  | 'property'
  | 'emergency-fund'
  | 'debt-freedom'
  | 'wealth-creation'
  | 'vehicle'
  | 'travel'
  | 'business'
  | 'legacy'
  | 'other';

export const PROFILE_GOAL_CATEGORY_OPTIONS: Option<ProfileGoalCategory>[] = [
  { value: 'retirement', label: 'Retirement' },
  { value: 'education', label: 'Education' },
  { value: 'property', label: 'Buying property' },
  { value: 'emergency-fund', label: 'Emergency fund' },
  { value: 'debt-freedom', label: 'Paying off debt' },
  { value: 'wealth-creation', label: 'Building wealth' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'travel', label: 'Travel' },
  { value: 'business', label: 'Starting or growing a business' },
  { value: 'legacy', label: 'Leaving a legacy' },
  { value: 'other', label: 'Other' },
];

export type GoalPriority = 'high' | 'medium' | 'low';
export const GOAL_PRIORITY_OPTIONS: Option<GoalPriority>[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export interface ProfileGoal {
  id: string;
  category: ProfileGoalCategory;
  name: string;
  /** Rand amount in today's money. 0 = not set. */
  targetAmount: number;
  /** YYYY-MM-DD */
  targetDate: string;
  priority: GoalPriority;
  /** Already put aside for this goal. */
  amountSaved: number;
  monthlyContribution: number;
  notes: string;
}

export function createProfileGoal(id: string): ProfileGoal {
  return {
    id,
    category: 'wealth-creation',
    name: '',
    targetAmount: 0,
    targetDate: '',
    priority: 'medium',
    amountSaved: 0,
    monthlyContribution: 0,
    notes: '',
  };
}

// ============================================================================
// Planning profile
// ============================================================================

export type InvestmentKnowledge = '' | 'none' | 'basic' | 'good' | 'advanced';
export const INVESTMENT_KNOWLEDGE_OPTIONS: Option<Exclude<InvestmentKnowledge, ''>>[] = [
  { value: 'none', label: 'None — I have not invested before' },
  { value: 'basic', label: 'Basic — I understand savings and unit trusts' },
  { value: 'good', label: 'Good — I understand shares, bonds and asset allocation' },
  { value: 'advanced', label: 'Advanced — I work in finance or invest actively' },
];

export const INVESTMENT_PRODUCT_OPTIONS: Option[] = [
  { value: 'savings-account', label: 'Savings or fixed deposits' },
  { value: 'unit-trusts', label: 'Unit trusts' },
  { value: 'tax-free-savings', label: 'Tax-free savings account' },
  { value: 'retirement-annuity', label: 'Retirement annuity' },
  { value: 'shares', label: 'Shares (direct)' },
  { value: 'etfs', label: 'ETFs' },
  { value: 'offshore', label: 'Offshore investments' },
  { value: 'property', label: 'Investment property' },
  { value: 'endowment', label: 'Endowment' },
  { value: 'crypto', label: 'Crypto assets' },
];

/**
 * Capacity for loss: how far a fall in value would hurt the client's plans, as
 * opposed to how they would feel about it (that is risk tolerance, which the
 * risk questionnaire measures).
 */
export type CapacityForLoss = '' | 'low' | 'medium' | 'high';
export const CAPACITY_FOR_LOSS_OPTIONS: Array<{
  value: Exclude<CapacityForLoss, ''>;
  label: string;
  description: string;
}> = [
  {
    value: 'low',
    label: 'It would seriously affect me',
    description:
      'A 20% fall would change my standard of living or put an important goal out of reach.',
  },
  {
    value: 'medium',
    label: 'It would delay my plans',
    description: 'I could absorb a 20% fall, but some goals would have to move out.',
  },
  {
    value: 'high',
    label: 'It would not change my plans',
    description: 'A 20% fall would not affect my lifestyle or my main goals.',
  },
];

export interface PlanningProfile {
  /** 0 = not set. */
  plannedRetirementAge: number;
  /** Desired retirement income as a percentage of today's income. 0 = not set. */
  retirementIncomeTargetPercent: number;
  /** 0 = not set. */
  emergencyFundTargetMonths: number;
  emergencyFundCurrentAmount: number;
  investmentKnowledge: InvestmentKnowledge;
  investmentExperienceYears: number;
  investmentProductsHeld: string[];
  capacityForLoss: CapacityForLoss;
  capacityForLossNotes: string;
}

export function emptyPlanningProfile(): PlanningProfile {
  return {
    plannedRetirementAge: 0,
    retirementIncomeTargetPercent: 0,
    emergencyFundTargetMonths: 0,
    emergencyFundCurrentAmount: 0,
    investmentKnowledge: '',
    investmentExperienceYears: 0,
    investmentProductsHeld: [],
    capacityForLoss: '',
    capacityForLossNotes: '',
  };
}

// ============================================================================
// Normalisation
// ============================================================================

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
};
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

const CATEGORIES = PROFILE_GOAL_CATEGORY_OPTIONS.map((o) => o.value);

export function normalizeProfileGoals(raw: unknown): ProfileGoal[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((g, i) => {
    const r = asRecord(g);
    return {
      id: str(r.id) || `goal-${i + 1}`,
      category: oneOf(r.category, CATEGORIES, 'other'),
      name: str(r.name),
      targetAmount: num(r.targetAmount),
      targetDate: str(r.targetDate),
      priority: oneOf<GoalPriority>(r.priority, ['high', 'medium', 'low'], 'medium'),
      amountSaved: num(r.amountSaved),
      monthlyContribution: num(r.monthlyContribution),
      notes: str(r.notes),
    };
  });
}

export function normalizePlanningProfile(raw: unknown): PlanningProfile {
  const r = asRecord(raw);
  return {
    plannedRetirementAge: num(r.plannedRetirementAge),
    retirementIncomeTargetPercent: num(r.retirementIncomeTargetPercent),
    emergencyFundTargetMonths: num(r.emergencyFundTargetMonths),
    emergencyFundCurrentAmount: num(r.emergencyFundCurrentAmount),
    investmentKnowledge: oneOf<InvestmentKnowledge>(
      r.investmentKnowledge,
      ['', 'none', 'basic', 'good', 'advanced'],
      '',
    ),
    investmentExperienceYears: num(r.investmentExperienceYears),
    investmentProductsHeld: Array.isArray(r.investmentProductsHeld)
      ? r.investmentProductsHeld.filter((v): v is string => typeof v === 'string')
      : [],
    capacityForLoss: oneOf<CapacityForLoss>(r.capacityForLoss, ['', 'low', 'medium', 'high'], ''),
    capacityForLossNotes: str(r.capacityForLossNotes),
  };
}

// ============================================================================
// Derived figures
// ============================================================================

/** Whole years from `dateOfBirth` until the client turns `retirementAge`, or null. */
export function yearsToRetirement(
  dateOfBirth: string,
  retirementAge: number,
  today: Date,
): number | null {
  if (!retirementAge) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  let age = today.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return Math.max(0, retirementAge - age);
}

/** The rand target of an emergency fund of `months` × `monthlyBase`. */
export function emergencyFundTarget(months: number, monthlyBase: number): number {
  return months > 0 && monthlyBase > 0 ? Math.round(months * monthlyBase) : 0;
}

/** Share of a goal already saved, 0–100, or null when the goal has no target. */
export function goalProgressPercent(goal: ProfileGoal): number | null {
  if (!goal.targetAmount) return null;
  return Math.min(100, Math.round((goal.amountSaved / goal.targetAmount) * 100));
}
