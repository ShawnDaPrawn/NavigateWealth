/**
 * What a retirement quote is made of: product options, contribution types,
 * state shapes, draft persistence, currency helpers, and the five steps.
 *
 * Split out of `RetirementQuoteWizard.tsx` (1,407 lines). No React here.
 */
import { Briefcase, ClipboardList, Clock, DollarSign, Target } from 'lucide-react';
import { type WizardStep } from '../wizard/StepIndicator';

export const DRAFT_KEY = 'nw_retirement_quote_draft';

export interface ProductOption {
  id: string;
  label: string;
  info: string;
}

export const PRODUCT_OPTIONS: ProductOption[] = [
  {
    id: 'ra',
    label: 'Retirement Annuity (RA)',
    info: 'A personal retirement investment that allows ongoing monthly or lump sum contributions and offers tax-deductible contributions (subject to SARS limits). Funds are accessible from age 55.',
  },
  {
    id: 'provident_preservation',
    label: 'Provident Preservation Fund',
    info: 'Used to preserve funds when leaving an employer provident fund. No new contributions allowed. One full or partial withdrawal permitted before retirement.',
  },
  {
    id: 'pension_preservation',
    label: 'Pension Preservation Fund',
    info: 'Used to preserve funds when leaving an employer pension fund. No new contributions allowed. One withdrawal permitted before retirement.',
  },
  {
    id: 'not_sure',
    label: 'Not sure — require adviser assistance',
    info: "We'll confirm the correct structure based on your employment and fund history.",
  },
];

export const RA_CONTRIBUTION_TYPES = [
  { value: 'monthly', label: 'Monthly contribution' },
  { value: 'lump_sum', label: 'Lump sum contribution' },
  { value: 'both', label: 'Both' },
  { value: 'not_sure', label: 'Not sure — adviser assistance' },
] as const;

export const TAX_BRACKET_OPTIONS = [
  { value: 'below_18', label: 'Below 18%' },
  { value: '18_31', label: '18–31%' },
  { value: '31_39', label: '31–39%' },
  { value: '39_45', label: '39–45%' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

// ── State types ─────────────────────────────────────────────────────────────────

export interface RAContributionState {
  contribution_type: string;
  monthly_amount: string;
  monthly_adviser_assist: boolean;
  lump_sum_amount: string;
  lump_sum_adviser_assist: boolean;
}

export interface PreservationState {
  is_transferring: boolean | null;
  transfer_amount: string;
  transfer_not_sure: boolean;
}

export interface NotSureState {
  currently_employed: boolean | null;
  leaving_employer_fund: boolean | null;
  want_monthly_contributions: string; // 'yes' | 'no' | 'not_sure' | ''
}

export interface TimelineState {
  planned_retirement_age: string;
  current_age: string;
  member_of_retirement_fund: boolean | null;
  fund_details: string;
}

export interface FinancialState {
  income_gross_monthly: string;
  income_net_monthly: string;
  current_retirement_savings: string;
  tax_bracket: string;
}

export interface WizardDraft {
  selected_product: string;
  ra_contribution: RAContributionState;
  preservation: PreservationState;
  not_sure_context: NotSureState;
  timeline: TimelineState;
  financial: FinancialState;
  currentStep: number;
}

// ── Props ───────────────────────────────────────────────────────────────────────

export function formatCurrency(value: string): string {
  const num = value.replace(/[^\d]/g, '');
  if (!num) return '';
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function parseCurrencyToNumber(value: string): number {
  const cleaned = value.replace(/[^\d]/g, '');
  return cleaned ? Number(cleaned) : 0;
}

export function getInitialRA(): RAContributionState {
  return {
    contribution_type: '',
    monthly_amount: '',
    monthly_adviser_assist: false,
    lump_sum_amount: '',
    lump_sum_adviser_assist: false,
  };
}

export function getInitialPreservation(): PreservationState {
  return { is_transferring: null, transfer_amount: '', transfer_not_sure: false };
}

export function getInitialNotSure(): NotSureState {
  return { currently_employed: null, leaving_employer_fund: null, want_monthly_contributions: '' };
}

export function getInitialTimeline(): TimelineState {
  return {
    planned_retirement_age: '',
    current_age: '',
    member_of_retirement_fund: null,
    fund_details: '',
  };
}

export function getInitialFinancial(): FinancialState {
  return {
    income_gross_monthly: '',
    income_net_monthly: '',
    current_retirement_savings: '',
    tax_bracket: '',
  };
}

export function loadDraft(): WizardDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: WizardDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* non-critical */
  }
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* non-critical */
  }
}

export function needsMonthly(ct: string) {
  return ct === 'monthly' || ct === 'both';
}
export function needsLumpSum(ct: string) {
  return ct === 'lump_sum' || ct === 'both';
}

// ── Step Indicator ──────────────────────────────────────────────────────────────

/** This wizard's steps. The indicator itself is shared — see wizard/StepIndicator. */
export const WIZARD_STEPS: WizardStep[] = [
  { num: 1, label: 'Product', icon: Target },
  { num: 2, label: 'Funding', icon: DollarSign },
  { num: 3, label: 'Timeline', icon: Clock },
  { num: 4, label: 'Financial', icon: Briefcase },
  { num: 5, label: 'Review', icon: ClipboardList },
];

// ── Step 1: Which Retirement Product ────────────────────────────────────────────
