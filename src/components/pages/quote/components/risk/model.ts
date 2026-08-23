/**
 * Model for the risk quote wizard: draft persistence, the cover/option
 * vocabularies, the wizard-state shapes, currency helpers, and the step
 * definitions. Mirrors investment/model.ts.
 */
import { Shield, User, Stethoscope, ClipboardList } from 'lucide-react';
import { type WizardStep } from '../wizard/StepIndicator';

// ---- Constants (SS5.3) --------------------------------------------------------

export const DRAFT_KEY = 'nw_risk_quote_draft';

export interface CoverOption {
  id: string;
  label: string;
  infoBlip: string;
  isMonthly: boolean; // true = per-month input, false = lump sum
}

export const COVER_OPTIONS: CoverOption[] = [
  {
    id: 'life_cover',
    label: 'Life Cover',
    infoBlip: 'Pays a lump sum if you pass away -- helps protect dependants and settle debt.',
    isMonthly: false,
  },
  {
    id: 'lump_sum_disability',
    label: 'Lump Sum Disability',
    infoBlip:
      'Pays a lump sum if a permanent disability prevents you from working or living independently.',
    isMonthly: false,
  },
  {
    id: 'severe_illness',
    label: 'Severe Illness',
    infoBlip:
      'Pays a lump sum on diagnosis of qualifying serious illnesses (e.g., cancer, heart attack, stroke).',
    isMonthly: false,
  },
  {
    id: 'income_protection',
    label: 'Income Protection',
    infoBlip:
      'Pays a monthly income if illness/injury stops you from earning -- designed to replace part of your income.',
    isMonthly: true,
  },
];

export const SMOKER_OPTIONS = [
  { value: 'non-smoker', label: 'Non-smoker' },
  { value: 'smoker', label: 'Smoker' },
  { value: 'occasional', label: 'Occasional / Social' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

export const QUALIFICATION_OPTIONS = [
  { value: 'matric', label: 'Matric / Grade 12' },
  { value: 'certificate', label: 'Certificate / Diploma' },
  { value: 'bachelors', label: "Bachelor's Degree" },
  { value: 'honours', label: 'Honours Degree' },
  { value: 'masters', label: "Master's Degree" },
  { value: 'doctorate', label: 'Doctorate / PhD' },
  { value: 'professional', label: 'Professional Qualification (CA, CFA, etc.)' },
  { value: 'other', label: 'Other' },
];

export const MARITAL_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'life-partner', label: 'Life Partner' },
];

export const CHRONIC_PRESETS = [
  'High blood pressure',
  'High cholesterol',
  'Diabetes (Type 1)',
  'Diabetes (Type 2)',
  'Hypothyroid / Hyperthyroid',
  'Asthma',
  'Depression / Anxiety',
  'Back / Spine issues',
];

// ---- State types ---------------------------------------------------------------

export interface CoverEntry {
  selected: boolean;
  amount: string; // stored as string for input, parsed to number on submit
  adviser_assist: boolean;
}

export type RiskNeeds = Record<string, CoverEntry>;

export interface PersonalDetails {
  occupation: string;
  income_gross_monthly: string;
  income_net_monthly: string;
  smoker_status: string;
  highest_qualification: string;
  marital_status: string;
  spouse_income_monthly: string;
}

export interface HealthDisclosures {
  has_conditions: boolean | null; // null = not answered
  selected_conditions: string[];
  free_text: string;
}

export interface WizardDraft {
  risk_needs: RiskNeeds;
  personal_details: PersonalDetails;
  health_disclosures: HealthDisclosures;
  currentStep: number;
}

// ---- Helpers -------------------------------------------------------------------

export function formatCurrency(value: string): string {
  const num = value.replace(/[^\d]/g, '');
  if (!num) return '';
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function parseCurrencyToNumber(value: string): number {
  const cleaned = value.replace(/[^\d]/g, '');
  return cleaned ? Number(cleaned) : 0;
}

export function getInitialRiskNeeds(): RiskNeeds {
  const needs: RiskNeeds = {};
  COVER_OPTIONS.forEach((c) => {
    needs[c.id] = { selected: false, amount: '', adviser_assist: false };
  });
  return needs;
}

export function getInitialPersonalDetails(): PersonalDetails {
  return {
    occupation: '',
    income_gross_monthly: '',
    income_net_monthly: '',
    smoker_status: '',
    highest_qualification: '',
    marital_status: '',
    spouse_income_monthly: '',
  };
}

export function getInitialHealthDisclosures(): HealthDisclosures {
  return { has_conditions: null, selected_conditions: [], free_text: '' };
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

export function needsSpouseIncome(status: string) {
  return status === 'married' || status === 'life-partner';
}

// ---- Step indicator -----------------------------------------------------------

/** This wizard's steps. The indicator itself is shared — see wizard/StepIndicator. */
export const WIZARD_STEPS: WizardStep[] = [
  { num: 1, label: 'Cover', icon: Shield },
  { num: 2, label: 'Details', icon: User },
  { num: 3, label: 'Health', icon: Stethoscope },
  { num: 4, label: 'Review', icon: ClipboardList },
];
