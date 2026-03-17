/**
 * TaxPlanningQuoteWizard — Phase 2 Tax Planning / Tax Submissions "Get a Quote" Wizard
 *
 * Purpose: Identify what type of tax submission or SARS compliance assistance the client requires.
 *
 * 3-step wizard + Review & Submit:
 *   Step 1: Tax assistance type (multi-select from 10 options)
 *   Step 2: Taxpayer type & context (entity type, SARS registration, submission status, tax years)
 *   Step 3: Basic financial scope (turnover band, foreign income, audit status, penalties)
 *   Step 4: Review & Submit
 *
 * Hard rules:
 * - No tax calculations, no compliance advice, no document uploads
 * - No detailed financial capture, no financial statements
 * - Classification and scope capture only
 *
 * §7  — Presentation layer (UI only, no business logic)
 * §5.3 — Constants centralised below
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner@2.0.3';
import { Button } from '../../../ui/button';
import { Label } from '../../../ui/label';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Calculator,
  UserCheck,
  BarChart3,
  ClipboardList,
  Loader2,
  Info,
  Pencil,
  Check,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';

// ── Constants (§5.3) ────────────────────────────────────────────────────────────

const DRAFT_KEY = 'nw_tax_planning_quote_draft';

interface TaxTypeOption {
  id: string;
  label: string;
  info: string;
}

const TAX_TYPE_OPTIONS: TaxTypeOption[] = [
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

const TAXPAYER_TYPE_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'company', label: 'Company' },
  { value: 'trust', label: 'Trust' },
  { value: 'sole_proprietor', label: 'Sole Proprietor' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

const YES_NO_NOTSURE = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const;

const SUBMISSION_STATUS_OPTIONS = [
  { value: 'new', label: 'New submission' },
  { value: 'outstanding', label: 'Outstanding returns' },
  { value: 'both', label: 'Both' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

const TAX_YEAR_OPTIONS = [
  { value: 'current', label: 'Current tax year only' },
  { value: 'previous', label: 'Previous tax year' },
  { value: 'multiple', label: 'Multiple outstanding years' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

const TURNOVER_BAND_OPTIONS = [
  { value: 'under_500k', label: 'Under R500,000' },
  { value: '500k_1m', label: 'R500,000 – R1m' },
  { value: '1m_5m', label: 'R1m – R5m' },
  { value: '5m_plus', label: 'R5m+' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

// ── State types ─────────────────────────────────────────────────────────────────

interface TaxpayerContextState {
  taxpayer_type: string;
  sars_registered: string;
  submission_status: string;
  tax_years: string;
}

interface FinancialScopeState {
  turnover_band: string;
  has_foreign_income: string;
  under_sars_audit: string;
  has_penalties: string;
}

interface WizardDraft {
  selected_types: string[];
  taxpayer_context: TaxpayerContextState;
  financial_scope: FinancialScopeState;
  currentStep: number;
}

// ── Props ───────────────────────────────────────────────────────────────────────

interface TaxPlanningQuoteWizardProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  parentSubmissionId?: string;
  onSuccess: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function getInitialTaxpayerContext(): TaxpayerContextState {
  return { taxpayer_type: '', sars_registered: '', submission_status: '', tax_years: '' };
}

function getInitialFinancialScope(): FinancialScopeState {
  return { turnover_band: '', has_foreign_income: '', under_sars_audit: '', has_penalties: '' };
}

function loadDraft(): WizardDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveDraft(draft: WizardDraft) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* non-critical */ }
}

function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* non-critical */ }
}

function ynsLabel(val: string): string {
  if (val === 'yes') return 'Yes';
  if (val === 'no') return 'No';
  if (val === 'not_sure') return 'Not sure';
  return '—';
}

function lookupLabel<T extends readonly { value: string; label: string }[]>(options: T, value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

// ── Step Indicator ──────────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: 'Tax Type', icon: Calculator },
    { num: 2, label: 'Taxpayer', icon: UserCheck },
    { num: 3, label: 'Scope', icon: BarChart3 },
    { num: 4, label: 'Review', icon: ClipboardList },
  ];

  return (
    <div className="flex items-center justify-between w-full mb-6">
      {steps.map((step, idx) => {
        const isCompleted = currentStep > step.num;
        const isActive = currentStep === step.num;
        const IconComp = step.icon;
        return (
          <React.Fragment key={step.num}>
            {idx > 0 && (
              <div className={`flex-1 h-0.5 mx-1 sm:mx-2 transition-colors ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isCompleted
                    ? 'bg-green-600 text-white'
                    : isActive
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-400 border border-gray-200'
                }`}
              >
                {isCompleted ? <CheckCircle className="h-4 w-4" /> : <IconComp className="h-4 w-4" />}
              </div>
              <span className={`text-[10px] sm:text-xs font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Step 1: Tax Assistance Type (multi-select) ─────────────────────────────────

function Step1TaxType({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    // "not_sure" is exclusive — selecting it deselects all others and vice versa
    if (id === 'not_sure') {
      onChange(selected.includes('not_sure') ? [] : ['not_sure']);
      return;
    }
    const without = selected.filter((s) => s !== 'not_sure');
    if (without.includes(id)) {
      onChange(without.filter((s) => s !== id));
    } else {
      onChange([...without, id]);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">What tax submission do you need help with?</h2>
        <p className="text-sm text-gray-500">Select all that apply. You can choose more than one.</p>
      </div>

      <div className="space-y-2">
        {TAX_TYPE_OPTIONS.map((opt) => {
          const isSelected = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              className={`w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-primary/50 bg-primary/[0.03] shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center mt-0.5 flex-shrink-0 border-2 transition-colors ${
                isSelected ? 'border-primary bg-primary' : 'border-gray-300 bg-white'
              }`}>
                {isSelected && <Check className="h-3 w-3 text-white" />}
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-gray-900 text-sm">{opt.label}</span>
                <p className="text-xs text-gray-500 mt-0.5 flex items-start gap-1">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0 text-gray-400" />
                  {opt.info}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 2: Taxpayer Type & Context ─────────────────────────────────────────────

function Step2TaxpayerContext({
  context,
  onChange,
}: {
  context: TaxpayerContextState;
  onChange: (c: TaxpayerContextState) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Tell us about the taxpayer</h2>
        <p className="text-sm text-gray-500">Basic details to route your request to the right specialist.</p>
      </div>

      {/* Taxpayer type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Taxpayer type <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {TAXPAYER_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...context, taxpayer_type: opt.value })}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                context.taxpayer_type === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* SARS registered */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Are you currently registered with SARS for this tax type? <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {YES_NO_NOTSURE.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...context, sars_registered: opt.value })}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                context.sars_registered === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Submission status */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Is this a new submission or are there outstanding returns? <span className="text-red-500">*</span>
        </Label>
        <div className="space-y-2">
          {SUBMISSION_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...context, submission_status: opt.value })}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left text-sm font-medium transition-all ${
                context.submission_status === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                context.submission_status === opt.value ? 'border-primary' : 'border-gray-300'
              }`}>
                {context.submission_status === opt.value && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tax years */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Tax year(s) involved <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {TAX_YEAR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...context, tax_years: opt.value })}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                context.tax_years === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Basic Financial Scope ───────────────────────────────────────────────

function Step3FinancialScope({
  scope,
  onChange,
}: {
  scope: FinancialScopeState;
  onChange: (s: FinancialScopeState) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Scope overview</h2>
        <p className="text-sm text-gray-500">High-level information to help us size your engagement.</p>
      </div>

      {/* Turnover band */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Estimated annual turnover or income <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {TURNOVER_BAND_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...scope, turnover_band: opt.value })}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                scope.turnover_band === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Foreign income */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Do you have foreign income or offshore assets? <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2 max-w-xs">
          {YES_NO.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...scope, has_foreign_income: opt.value })}
              className={`flex items-center justify-center p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                scope.has_foreign_income === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Under SARS audit */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Are you currently under SARS audit or verification? <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2 max-w-xs">
          {YES_NO.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...scope, under_sars_audit: opt.value })}
              className={`flex items-center justify-center p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                scope.under_sars_audit === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Penalties */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Have penalties or interest been raised? <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {YES_NO_NOTSURE.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...scope, has_penalties: opt.value })}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                scope.has_penalties === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Review ──────────────────────────────────────────────────────────────

function Step4Review({
  selectedTypes,
  taxpayerContext,
  financialScope,
  onEditStep,
}: {
  selectedTypes: string[];
  taxpayerContext: TaxpayerContextState;
  financialScope: FinancialScopeState;
  onEditStep: (step: number) => void;
}) {
  const typeLabels = selectedTypes.map((id) => TAX_TYPE_OPTIONS.find((t) => t.id === id)?.label ?? id);

  function SectionHeader({ title, step }: { title: string; step: number }) {
    return (
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <button
          type="button"
          onClick={() => onEditStep(step)}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>
    );
  }

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex justify-between py-1.5 text-sm">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-900 font-medium text-right max-w-[60%]">{value || '—'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Review & submit</h2>
        <p className="text-sm text-gray-500">Please review your details before submitting your tax planning quote request.</p>
      </div>

      {/* Tax types */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Tax Submission Type(s)" step={1} />
        <div className="space-y-1">
          {typeLabels.map((label) => (
            <div key={label} className="flex items-center gap-2 py-1 text-sm">
              <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
              <span className="text-gray-900 font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Taxpayer context */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Taxpayer Details" step={2} />
        <Row label="Taxpayer type" value={lookupLabel(TAXPAYER_TYPE_OPTIONS, taxpayerContext.taxpayer_type)} />
        <Row label="Registered with SARS" value={ynsLabel(taxpayerContext.sars_registered)} />
        <Row label="Submission status" value={lookupLabel(SUBMISSION_STATUS_OPTIONS, taxpayerContext.submission_status)} />
        <Row label="Tax year(s)" value={lookupLabel(TAX_YEAR_OPTIONS, taxpayerContext.tax_years)} />
      </div>

      {/* Financial scope */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Financial Scope" step={3} />
        <Row label="Annual turnover / income" value={lookupLabel(TURNOVER_BAND_OPTIONS, financialScope.turnover_band)} />
        <Row label="Foreign income / offshore assets" value={ynsLabel(financialScope.has_foreign_income)} />
        <Row label="Under SARS audit / verification" value={ynsLabel(financialScope.under_sars_audit)} />
        <Row label="Penalties or interest raised" value={ynsLabel(financialScope.has_penalties)} />
      </div>
    </div>
  );
}

// ── Main wizard component ───────────────────────────────────────────────────────

export function TaxPlanningQuoteWizard({
  firstName,
  lastName,
  email,
  phone,
  parentSubmissionId,
  onSuccess,
}: TaxPlanningQuoteWizardProps) {
  const draft = loadDraft();
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(draft?.selected_types ?? []);
  const [taxpayerContext, setTaxpayerContext] = useState<TaxpayerContextState>(draft?.taxpayer_context ?? getInitialTaxpayerContext());
  const [financialScope, setFinancialScope] = useState<FinancialScopeState>(draft?.financial_scope ?? getInitialFinancialScope());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Persist draft
  useEffect(() => {
    saveDraft({
      selected_types: selectedTypes,
      taxpayer_context: taxpayerContext,
      financial_scope: financialScope,
      currentStep,
    });
  }, [selectedTypes, taxpayerContext, financialScope, currentStep]);

  // ── Validation ──

  const step1Valid = useMemo(() => selectedTypes.length > 0, [selectedTypes]);

  const step2Valid = useMemo(() => {
    return Boolean(
      taxpayerContext.taxpayer_type &&
      taxpayerContext.sars_registered &&
      taxpayerContext.submission_status &&
      taxpayerContext.tax_years
    );
  }, [taxpayerContext]);

  const step3Valid = useMemo(() => {
    return Boolean(
      financialScope.turnover_band &&
      financialScope.has_foreign_income &&
      financialScope.under_sars_audit &&
      financialScope.has_penalties
    );
  }, [financialScope]);

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1: return step1Valid;
      case 2: return step2Valid;
      case 3: return step3Valid;
      case 4: return true;
      default: return false;
    }
  }, [currentStep, step1Valid, step2Valid, step3Valid]);

  const goNext = useCallback(() => { if (currentStep < 4) setCurrentStep((s) => s + 1); }, [currentStep]);
  const goBack = useCallback(() => { if (currentStep > 1) setCurrentStep((s) => s - 1); }, [currentStep]);
  const goToStep = useCallback((step: number) => { setCurrentStep(step); }, []);

  // ── Submit ──

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const typeLabels = selectedTypes.map((id) => TAX_TYPE_OPTIONS.find((t) => t.id === id)?.label ?? id);

      const productDetails = {
        vertical: 'TaxPlanning',
        phase: 2,
        selected_types: typeLabels,
        selected_type_ids: selectedTypes,
        taxpayer_context: {
          taxpayer_type: lookupLabel(TAXPAYER_TYPE_OPTIONS, taxpayerContext.taxpayer_type),
          taxpayer_type_id: taxpayerContext.taxpayer_type,
          sars_registered: ynsLabel(taxpayerContext.sars_registered),
          sars_registered_id: taxpayerContext.sars_registered,
          submission_status: lookupLabel(SUBMISSION_STATUS_OPTIONS, taxpayerContext.submission_status),
          submission_status_id: taxpayerContext.submission_status,
          tax_years: lookupLabel(TAX_YEAR_OPTIONS, taxpayerContext.tax_years),
          tax_years_id: taxpayerContext.tax_years,
        },
        financial_scope: {
          turnover_band: lookupLabel(TURNOVER_BAND_OPTIONS, financialScope.turnover_band),
          turnover_band_id: financialScope.turnover_band,
          has_foreign_income: ynsLabel(financialScope.has_foreign_income),
          under_sars_audit: ynsLabel(financialScope.under_sars_audit),
          has_penalties: ynsLabel(financialScope.has_penalties),
          has_penalties_id: financialScope.has_penalties,
        },
        metadata: {
          source: 'NavigateWealthApp',
          submitted_at: new Date().toISOString(),
          status: 'submitted',
        },
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/quote-request/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            productName: 'Tax Planning',
            stage: 'full',
            service: 'tax-planning',
            parentSubmissionId: parentSubmissionId ?? undefined,
            productDetails,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        console.error('Tax planning quote submission error:', result);
        toast.error(result.error || 'Something went wrong. Please try again.');
        return;
      }

      clearDraft();
      toast.success('Your tax planning quote request has been submitted!');
      onSuccess();
    } catch (error) {
      console.error('Tax planning quote network error:', error);
      toast.error('Unable to submit your request. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [firstName, lastName, email, phone, parentSubmissionId, selectedTypes, taxpayerContext, financialScope, onSuccess]);

  // ── Render ──

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={currentStep} />

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-5 sm:p-6">
          {currentStep === 1 && <Step1TaxType selected={selectedTypes} onChange={setSelectedTypes} />}
          {currentStep === 2 && <Step2TaxpayerContext context={taxpayerContext} onChange={setTaxpayerContext} />}
          {currentStep === 3 && <Step3FinancialScope scope={financialScope} onChange={setFinancialScope} />}
          {currentStep === 4 && (
            <Step4Review
              selectedTypes={selectedTypes}
              taxpayerContext={taxpayerContext}
              financialScope={financialScope}
              onEditStep={goToStep}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-t border-gray-100 bg-gray-50/50">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={currentStep === 1}
            className="h-11 px-5"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {currentStep < 4 ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={!canProceed}
              className="h-11 px-6 font-semibold"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-11 px-6 font-semibold"
            >
              {isSubmitting ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </div>
              ) : (
                <div className="contents">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Submit Quote Request
                </div>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
