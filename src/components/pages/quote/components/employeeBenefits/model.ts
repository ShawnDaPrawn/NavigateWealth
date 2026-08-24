/**
 * Model for the employee benefits quote wizard: draft persistence, the
 * option vocabularies, the wizard-state shapes, currency helpers, and the
 * step definitions. Mirrors risk/model.ts.
 */
import { Building2, Shield, DollarSign, Users, ClipboardList } from 'lucide-react';
import { type WizardStep } from '../wizard/StepIndicator';

// ── Constants (§5.3) ────────────────────────────────────────────────────────────

export const DRAFT_KEY = 'nw_employee_benefits_quote_draft';

export const INDUSTRY_SECTORS = [
  'Manufacturing',
  'Construction',
  'Professional Services',
  'Financial Services',
  'Retail',
  'Hospitality',
  'Technology',
  'Transport & Logistics',
  'Agriculture',
  'Other',
] as const;

export const EMPLOYEE_COUNT_OPTIONS = [
  { value: '1-5', label: '1–5' },
  { value: '6-20', label: '6–20' },
  { value: '21-50', label: '21–50' },
  { value: '51-100', label: '51–100' },
  { value: '100+', label: '100+' },
] as const;

export const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
] as const;

export interface BenefitTypeOption {
  id: string;
  label: string;
  info: string;
}

export const BENEFIT_TYPE_OPTIONS: BenefitTypeOption[] = [
  {
    id: 'risk_only',
    label: 'Risk Benefits Only',
    info: 'Group life, disability and funeral cover for employees.',
  },
  {
    id: 'retirement_only',
    label: 'Retirement Benefits Only',
    info: 'Group pension or provident fund to help employees save for retirement.',
  },
  {
    id: 'both',
    label: 'Both Retirement and Risk Benefits',
    info: 'Integrated retirement savings and group risk protection structure.',
  },
  {
    id: 'not_sure',
    label: 'Not sure — require adviser assistance',
    info: "We'll assess your workforce structure and recommend the right solution.",
  },
];

export const CONTRIBUTION_STRUCTURE_OPTIONS = [
  { value: 'employer_funded', label: 'Employer-funded only' },
  { value: 'cost_shared', label: 'Cost shared between employer and employees' },
  { value: 'employee_funded', label: 'Employee-funded via payroll deduction' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const COMPULSORY_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const AGE_BAND_OPTIONS = [
  { value: 'under_30', label: 'Under 30' },
  { value: '30_40', label: '30–40' },
  { value: '40_50', label: '40–50' },
  { value: '50_plus', label: '50+' },
  { value: 'mixed', label: 'Mixed ages' },
] as const;

export const WORKFORCE_TYPE_OPTIONS = [
  { value: 'office', label: 'Office-based' },
  { value: 'manual', label: 'Manual / operational' },
  { value: 'mixed', label: 'Mixed workforce' },
] as const;

// ── State types ─────────────────────────────────────────────────────────────────

export interface BusinessState {
  company_name: string;
  trading_name: string;
  industry_sector: string;
  employee_count: string;
  province: string;
}

export interface BudgetState {
  monthly_budget: string;
  budget_adviser_assist: boolean;
  contribution_structure: string;
  compulsory_for_all: string;
}

export interface WorkforceState {
  average_age_band: string;
  workforce_type: string;
  has_existing_benefits: boolean | null;
  existing_benefits_description: string;
}

export interface WizardDraft {
  business: BusinessState;
  benefit_type: string;
  budget: BudgetState;
  workforce: WorkforceState;
  currentStep: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

export function formatCurrency(value: string): string {
  const num = value.replace(/[^\d]/g, '');
  if (!num) return '';
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function parseCurrencyToNumber(value: string): number {
  const cleaned = value.replace(/[^\d]/g, '');
  return cleaned ? Number(cleaned) : 0;
}

export function getInitialBusiness(): BusinessState {
  return {
    company_name: '',
    trading_name: '',
    industry_sector: '',
    employee_count: '',
    province: '',
  };
}

export function getInitialBudget(): BudgetState {
  return {
    monthly_budget: '',
    budget_adviser_assist: false,
    contribution_structure: '',
    compulsory_for_all: '',
  };
}

export function getInitialWorkforce(): WorkforceState {
  return {
    average_age_band: '',
    workforce_type: '',
    has_existing_benefits: null,
    existing_benefits_description: '',
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

// ── Step Indicator ──────────────────────────────────────────────────────────────

/** This wizard's steps. The indicator itself is shared — see wizard/StepIndicator. */
export const WIZARD_STEPS: WizardStep[] = [
  { num: 1, label: 'Business', icon: Building2 },
  { num: 2, label: 'Benefits', icon: Shield },
  { num: 3, label: 'Budget', icon: DollarSign },
  { num: 4, label: 'Workforce', icon: Users },
  { num: 5, label: 'Review', icon: ClipboardList },
];
