/**
 * Model for the investment quote wizard: draft persistence, the option
 * vocabularies, the wizard-state shapes, currency helpers, and the step
 * definitions. Mirrors retirement/model.ts.
 */
import { TrendingUp, DollarSign, Target, ClipboardList, Briefcase } from 'lucide-react';
import { type WizardStep } from '../wizard/StepIndicator';

export const DRAFT_KEY = 'nw_investment_quote_draft';

export interface InvestmentOption {
  id: string;
  label: string;
  info: string;
}

export const INVESTMENT_OPTIONS: InvestmentOption[] = [
  {
    id: 'unit_trust',
    label: 'Unit Trust',
    info: 'A flexible investment in professionally managed funds. No fixed term. Accessible and suitable for medium to long-term growth.',
  },
  {
    id: 'tfsa',
    label: 'Tax-Free Savings Account (TFSA)',
    info: 'Growth and withdrawals are tax-free, subject to annual and lifetime contribution limits set by SARS.',
  },
  {
    id: 'endowment',
    label: 'Endowment',
    info: 'A 5-year investment policy with potential tax efficiency for higher-income earners and estate planning benefits.',
  },
  {
    id: 'offshore_unit_trust',
    label: 'Offshore Unit Trust',
    info: 'A foreign currency investment giving exposure to global markets outside South Africa.',
  },
  {
    id: 'offshore_endowment',
    label: 'Offshore Endowment',
    info: 'A foreign investment policy structure with estate planning and potential tax advantages.',
  },
  {
    id: 'not_sure',
    label: 'Not sure — require adviser assistance',
    info: "We'll recommend the most suitable structure based on your goals and tax position.",
  },
];

export const CONTRIBUTION_TYPES = [
  { value: 'lump_sum', label: 'Lump sum' },
  { value: 'monthly', label: 'Monthly debit order' },
  { value: 'both', label: 'Both' },
  { value: 'not_sure', label: 'Not sure — adviser assistance' },
] as const;

export const OBJECTIVE_OPTIONS = [
  { value: 'wealth_accumulation', label: 'Wealth accumulation / growth' },
  { value: 'retirement_planning', label: 'Retirement planning' },
  { value: 'education_funding', label: 'Education funding' },
  { value: 'capital_preservation', label: 'Capital preservation' },
  { value: 'income_generation', label: 'Income generation' },
  { value: 'estate_planning', label: 'Estate planning' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const TIME_HORIZON_OPTIONS = [
  { value: 'less_2_years', label: 'Less than 2 years' },
  { value: '2_5_years', label: '2–5 years' },
  { value: '5_10_years', label: '5–10 years' },
  { value: '10_plus_years', label: '10+ years' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const RISK_COMFORT_OPTIONS = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'aggressive', label: 'Aggressive' },
  { value: 'not_sure', label: 'Not sure — require adviser guidance' },
] as const;

export const TAX_BRACKET_OPTIONS = [
  { value: 'below_18', label: 'Below 18%' },
  { value: '18_31', label: '18–31%' },
  { value: '31_39', label: '31–39%' },
  { value: '39_45', label: '39–45%' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

// ── State types ─────────────────────────────────────────────────────────────────

export interface ContributionEntry {
  contribution_type: string; // lump_sum | monthly | both | not_sure
  lump_sum_amount: string;
  lump_sum_adviser_assist: boolean;
  monthly_amount: string;
  monthly_adviser_assist: boolean;
}

export interface ObjectiveState {
  primary_objective: string;
  time_horizon: string;
  risk_comfort: string;
}

export interface FinancialState {
  income_gross_monthly: string;
  income_net_monthly: string;
  existing_investments: string;
  has_retirement_annuity: boolean | null;
  tax_bracket: string;
}

export interface WizardDraft {
  selected_types: string[];
  contributions: Record<string, ContributionEntry>;
  objective: ObjectiveState;
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

export function getInitialContribution(): ContributionEntry {
  return {
    contribution_type: '',
    lump_sum_amount: '',
    lump_sum_adviser_assist: false,
    monthly_amount: '',
    monthly_adviser_assist: false,
  };
}

export function getInitialObjective(): ObjectiveState {
  return { primary_objective: '', time_horizon: '', risk_comfort: '' };
}

export function getInitialFinancial(): FinancialState {
  return {
    income_gross_monthly: '',
    income_net_monthly: '',
    existing_investments: '',
    has_retirement_annuity: null,
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

export function needsLumpSum(ct: string) {
  return ct === 'lump_sum' || ct === 'both';
}

export function needsMonthly(ct: string) {
  return ct === 'monthly' || ct === 'both';
}

export function getLabelForType(id: string): string {
  return INVESTMENT_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

// ── Step Indicator ──────────────────────────────────────────────────────────────

/** This wizard's steps. The indicator itself is shared — see wizard/StepIndicator. */
export const WIZARD_STEPS: WizardStep[] = [
  { num: 1, label: 'Type', icon: TrendingUp },
  { num: 2, label: 'Amount', icon: DollarSign },
  { num: 3, label: 'Objective', icon: Target },
  { num: 4, label: 'Financial', icon: Briefcase },
  { num: 5, label: 'Review', icon: ClipboardList },
];

// ── Step 1: Investment Type ─────────────────────────────────────────────────────
