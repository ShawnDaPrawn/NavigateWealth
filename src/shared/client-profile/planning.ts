/**
 * Planning preferences, kept on the client's profile record under
 * `planningProfile`: the planning inputs a financial plan needs and the
 * suitability facts FAIS asks for — retirement age and income target,
 * emergency fund, investment knowledge and experience, capacity for loss.
 *
 * Goals are deliberately NOT here. Investments have one goals model: "Goals",
 * which is the Investment INA (`docs/STATUS.md`, standing constraints). The
 * profile shows what the client wrote about their goals on the application and
 * points to Goals; it keeps no list of its own.
 */

export interface Option<T extends string = string> {
  value: T;
  label: string;
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
