/**
 * What a tax planning quote is made of: the option lists, the state shapes,
 * the draft persistence, the label helpers and the step definitions.
 *
 * Moved verbatim out of `TaxPlanningQuoteWizard.tsx` so the redesigned quote
 * page (src/site/sections/ProductQuoteTax.tsx) asks the same questions with
 * the same values and keeps its progress under the same key. No React here.
 */
import { BarChart3, Calculator, ClipboardList, UserCheck } from 'lucide-react';
import { type WizardStep } from '../wizard/StepIndicator';

// ── Constants (§5.3) ────────────────────────────────────────────────────────────

export const DRAFT_KEY = 'nw_tax_planning_quote_draft';

export interface TaxTypeOption {
  id: string;
  label: string;
  info: string;
}

export const TAX_TYPE_OPTIONS: TaxTypeOption[] = [
  {
    id: 'itr12',
    label: 'Individual Income Tax Return (ITR12)',
    info: 'Annual personal income tax return for individuals, including salary, investments and deductions.',
  },
  {
    id: 'irp6',
    label: 'Provisional Tax (IRP6)',
    info: 'Bi-annual provisional tax submissions for individuals earning income other than salary.',
  },
  {
    id: 'itr14',
    label: 'Company Income Tax (ITR14)',
    info: 'Annual tax return for registered companies.',
  },
  {
    id: 'itr12t',
    label: 'Trust Tax Return (ITR12T)',
    info: 'Annual income tax return for registered trusts.',
  },
  {
    id: 'vat201',
    label: 'VAT Returns (VAT201)',
    info: 'Periodic Value-Added Tax submissions for VAT-registered entities.',
  },
  {
    id: 'paye',
    label: 'PAYE / EMP201 / EMP501 Reconciliation',
    info: 'Monthly and annual payroll tax submissions to SARS.',
  },
  {
    id: 'cgt',
    label: 'Capital Gains Tax (CGT) Declaration',
    info: 'Reporting tax arising from the disposal of property, shares or other assets.',
  },
  {
    id: 'dwt',
    label: 'Dividend Withholding Tax',
    info: 'Declaration and reconciliation of dividends tax obligations.',
  },
  {
    id: 'sars_audit',
    label: 'SARS Audit / Verification Assistance',
    info: 'Assistance responding to SARS verification letters, audits or assessments.',
  },
  {
    id: 'not_sure',
    label: 'Not Sure — Require Adviser Assistance',
    info: "We'll assess your situation and confirm the correct submission type.",
  },
];

export const TAXPAYER_TYPE_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'company', label: 'Company' },
  { value: 'trust', label: 'Trust' },
  { value: 'sole_proprietor', label: 'Sole Proprietor' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const YES_NO_NOTSURE = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const;

export const SUBMISSION_STATUS_OPTIONS = [
  { value: 'new', label: 'New submission' },
  { value: 'outstanding', label: 'Outstanding returns' },
  { value: 'both', label: 'Both' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const TAX_YEAR_OPTIONS = [
  { value: 'current', label: 'Current tax year only' },
  { value: 'previous', label: 'Previous tax year' },
  { value: 'multiple', label: 'Multiple outstanding years' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const TURNOVER_BAND_OPTIONS = [
  { value: 'under_500k', label: 'Under R500,000' },
  { value: '500k_1m', label: 'R500,000 – R1m' },
  { value: '1m_5m', label: 'R1m – R5m' },
  { value: '5m_plus', label: 'R5m+' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

// ── State types ─────────────────────────────────────────────────────────────────

export interface TaxpayerContextState {
  taxpayer_type: string;
  sars_registered: string;
  submission_status: string;
  tax_years: string;
}

export interface FinancialScopeState {
  turnover_band: string;
  has_foreign_income: string;
  under_sars_audit: string;
  has_penalties: string;
}

export interface WizardDraft {
  selected_types: string[];
  taxpayer_context: TaxpayerContextState;
  financial_scope: FinancialScopeState;
  currentStep: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

export function getInitialTaxpayerContext(): TaxpayerContextState {
  return { taxpayer_type: '', sars_registered: '', submission_status: '', tax_years: '' };
}

export function getInitialFinancialScope(): FinancialScopeState {
  return { turnover_band: '', has_foreign_income: '', under_sars_audit: '', has_penalties: '' };
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

export function ynsLabel(val: string): string {
  if (val === 'yes') return 'Yes';
  if (val === 'no') return 'No';
  if (val === 'not_sure') return 'Not sure';
  return '—';
}

export function lookupLabel<T extends readonly { value: string; label: string }[]>(
  options: T,
  value: string,
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

// ── Step Indicator ──────────────────────────────────────────────────────────────

/** This wizard's steps. The indicator itself is shared — see wizard/StepIndicator. */
export const WIZARD_STEPS: WizardStep[] = [
  { num: 1, label: 'Tax Type', icon: Calculator },
  { num: 2, label: 'Taxpayer', icon: UserCheck },
  { num: 3, label: 'Scope', icon: BarChart3 },
  { num: 4, label: 'Review', icon: ClipboardList },
];
