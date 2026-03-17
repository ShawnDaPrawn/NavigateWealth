/**
 * EmployeeBenefitsQuoteWizard — Phase 2 Employee Benefits "Get a Quote" Wizard
 *
 * Audience: Employer / Business Owner
 * Purpose: Capture high-level requirements for an Employee Benefits proposal.
 *
 * 4-step wizard + Review & Submit:
 *   Step 1: Business Details (company name, industry, employee count, province)
 *   Step 2: Benefit Type Selection (risk, retirement, both, not sure)
 *   Step 3: Budget & Contribution Structure
 *   Step 4: Workforce Profile (high-level)
 *   Step 5: Review & Submit
 *
 * Hard rules:
 * - No actuarial modelling, no underwriting detail, no member-level data
 * - No employee personal data, no medical details, no payroll files
 * - No premium calculations
 * - Employer-focused, high-level only
 *
 * §7  — Presentation layer (UI only, no business logic)
 * §5.3 — Constants centralised below
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner@2.0.3';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Building2,
  Shield,
  DollarSign,
  Users,
  ClipboardList,
  Loader2,
  Info,
  Pencil,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';

// ── Constants (§5.3) ────────────────────────────────────────────────────────────

const DRAFT_KEY = 'nw_employee_benefits_quote_draft';

const INDUSTRY_SECTORS = [
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

const EMPLOYEE_COUNT_OPTIONS = [
  { value: '1-5', label: '1–5' },
  { value: '6-20', label: '6–20' },
  { value: '21-50', label: '21–50' },
  { value: '51-100', label: '51–100' },
  { value: '100+', label: '100+' },
] as const;

const SA_PROVINCES = [
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

interface BenefitTypeOption {
  id: string;
  label: string;
  info: string;
}

const BENEFIT_TYPE_OPTIONS: BenefitTypeOption[] = [
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

const CONTRIBUTION_STRUCTURE_OPTIONS = [
  { value: 'employer_funded', label: 'Employer-funded only' },
  { value: 'cost_shared', label: 'Cost shared between employer and employees' },
  { value: 'employee_funded', label: 'Employee-funded via payroll deduction' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

const COMPULSORY_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

const AGE_BAND_OPTIONS = [
  { value: 'under_30', label: 'Under 30' },
  { value: '30_40', label: '30–40' },
  { value: '40_50', label: '40–50' },
  { value: '50_plus', label: '50+' },
  { value: 'mixed', label: 'Mixed ages' },
] as const;

const WORKFORCE_TYPE_OPTIONS = [
  { value: 'office', label: 'Office-based' },
  { value: 'manual', label: 'Manual / operational' },
  { value: 'mixed', label: 'Mixed workforce' },
] as const;

// ── State types ─────────────────────────────────────────────────────────────────

interface BusinessState {
  company_name: string;
  trading_name: string;
  industry_sector: string;
  employee_count: string;
  province: string;
}

interface BudgetState {
  monthly_budget: string;
  budget_adviser_assist: boolean;
  contribution_structure: string;
  compulsory_for_all: string;
}

interface WorkforceState {
  average_age_band: string;
  workforce_type: string;
  has_existing_benefits: boolean | null;
  existing_benefits_description: string;
}

interface WizardDraft {
  business: BusinessState;
  benefit_type: string;
  budget: BudgetState;
  workforce: WorkforceState;
  currentStep: number;
}

// ── Props ───────────────────────────────────────────────────────────────────────

interface EmployeeBenefitsQuoteWizardProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  parentSubmissionId?: string;
  onSuccess: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function formatCurrency(value: string): string {
  const num = value.replace(/[^\d]/g, '');
  if (!num) return '';
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function parseCurrencyToNumber(value: string): number {
  const cleaned = value.replace(/[^\d]/g, '');
  return cleaned ? Number(cleaned) : 0;
}

function getInitialBusiness(): BusinessState {
  return { company_name: '', trading_name: '', industry_sector: '', employee_count: '', province: '' };
}

function getInitialBudget(): BudgetState {
  return { monthly_budget: '', budget_adviser_assist: false, contribution_structure: '', compulsory_for_all: '' };
}

function getInitialWorkforce(): WorkforceState {
  return { average_age_band: '', workforce_type: '', has_existing_benefits: null, existing_benefits_description: '' };
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

// ── Step Indicator ──────────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: 'Business', icon: Building2 },
    { num: 2, label: 'Benefits', icon: Shield },
    { num: 3, label: 'Budget', icon: DollarSign },
    { num: 4, label: 'Workforce', icon: Users },
    { num: 5, label: 'Review', icon: ClipboardList },
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

// ── Step 1: Business Details ────────────────────────────────────────────────────

function Step1Business({
  business,
  onChange,
}: {
  business: BusinessState;
  onChange: (b: BusinessState) => void;
}) {
  const [sectorOpen, setSectorOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Tell us about your business</h2>
        <p className="text-sm text-gray-500">Basic company information to help us prepare your employee benefits proposal.</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Registered company name <span className="text-red-500">*</span>
        </Label>
        <Input
          type="text"
          placeholder="e.g. Acme Holdings (Pty) Ltd"
          value={business.company_name}
          onChange={(e) => onChange({ ...business, company_name: e.target.value })}
          className="bg-white border-gray-300 h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Trading name <span className="text-gray-400 text-xs">(optional, if different)</span>
        </Label>
        <Input
          type="text"
          placeholder="e.g. Acme Solutions"
          value={business.trading_name}
          onChange={(e) => onChange({ ...business, trading_name: e.target.value })}
          className="bg-white border-gray-300 h-11"
        />
      </div>

      {/* Industry sector dropdown */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Industry sector <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setSectorOpen(!sectorOpen)}
            className={`w-full flex items-center justify-between h-11 px-3 rounded-md border text-sm text-left transition-colors ${
              business.industry_sector
                ? 'border-gray-300 bg-white text-gray-900'
                : 'border-gray-300 bg-white text-gray-400'
            }`}
          >
            {business.industry_sector || 'Select industry sector'}
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${sectorOpen ? 'rotate-180' : ''}`} />
          </button>
          {sectorOpen && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {INDUSTRY_SECTORS.map((sector) => (
                <button
                  key={sector}
                  type="button"
                  onClick={() => { onChange({ ...business, industry_sector: sector }); setSectorOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                    business.industry_sector === sector ? 'bg-primary/5 text-primary font-medium' : 'text-gray-700'
                  }`}
                >
                  {sector}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Employee count */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Number of employees <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {EMPLOYEE_COUNT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...business, employee_count: opt.value })}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                business.employee_count === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Province */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Location (Province) <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {SA_PROVINCES.map((prov) => (
            <button
              key={prov}
              type="button"
              onClick={() => onChange({ ...business, province: prov })}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                business.province === prov
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {prov}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Benefit Type ────────────────────────────────────────────────────────

function Step2BenefitType({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">What benefits are you looking to implement?</h2>
        <p className="text-sm text-gray-500">Select the type of employee benefits your business needs.</p>
      </div>

      <div className="space-y-2">
        {BENEFIT_TYPE_OPTIONS.map((opt) => {
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-primary/50 bg-primary/[0.03] shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                isSelected ? 'border-primary' : 'border-gray-300'
              }`}>
                {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
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

// ── Step 3: Budget & Contribution Structure ─────────────────────────────────────

function Step3Budget({
  budget,
  onChange,
}: {
  budget: BudgetState;
  onChange: (b: BudgetState) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">What is your intended monthly budget?</h2>
        <p className="text-sm text-gray-500">An estimate helps your adviser right-size the proposal.</p>
      </div>

      {/* Monthly budget */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Estimated total monthly budget for employee benefits <span className="text-red-500">*</span>
        </Label>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R</span>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 25,000"
              value={budget.monthly_budget}
              onChange={(e) => onChange({ ...budget, monthly_budget: formatCurrency(e.target.value) })}
              disabled={budget.budget_adviser_assist}
              className="bg-white border-gray-300 h-11 pl-7"
            />
          </div>
          <button
            type="button"
            onClick={() => onChange({
              ...budget,
              budget_adviser_assist: !budget.budget_adviser_assist,
              monthly_budget: !budget.budget_adviser_assist ? '' : budget.monthly_budget,
            })}
            className={`text-xs px-3 py-2.5 rounded-lg border font-medium whitespace-nowrap transition-all ${
              budget.budget_adviser_assist
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            <HelpCircle className="h-3 w-3 inline mr-1" />
            Adviser guidance
          </button>
        </div>
      </div>

      {/* Contribution structure */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Contribution structure preference <span className="text-red-500">*</span>
        </Label>
        <div className="space-y-2">
          {CONTRIBUTION_STRUCTURE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...budget, contribution_structure: opt.value })}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left text-sm font-medium transition-all ${
                budget.contribution_structure === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                budget.contribution_structure === opt.value ? 'border-primary' : 'border-gray-300'
              }`}>
                {budget.contribution_structure === opt.value && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Compulsory */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Are benefits compulsory for all staff? <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {COMPULSORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...budget, compulsory_for_all: opt.value })}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                budget.compulsory_for_all === opt.value
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

// ── Step 4: Workforce Profile ───────────────────────────────────────────────────

function Step4Workforce({
  workforce,
  onChange,
}: {
  workforce: WorkforceState;
  onChange: (w: WorkforceState) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Workforce overview</h2>
        <p className="text-sm text-gray-500">A high-level view of your workforce helps your adviser structure the right solution.</p>
      </div>

      {/* Average age band */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Average employee age band <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {AGE_BAND_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...workforce, average_age_band: opt.value })}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                workforce.average_age_band === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Workforce type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Are employees primarily: <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {WORKFORCE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...workforce, workforce_type: opt.value })}
              className={`flex items-center justify-center p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                workforce.workforce_type === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Existing benefits */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Do you currently have any employee benefits in place? <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: true, label: 'Yes' },
            { value: false, label: 'No' },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange({
                ...workforce,
                has_existing_benefits: opt.value,
                existing_benefits_description: opt.value ? workforce.existing_benefits_description : '',
              })}
              className={`flex items-center justify-center p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                workforce.has_existing_benefits === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {workforce.has_existing_benefits === true && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">
            Briefly describe current arrangement <span className="text-gray-400">(optional)</span>
          </Label>
          <textarea
            placeholder="e.g. Group RA with Old Mutual, basic group life cover"
            value={workforce.existing_benefits_description}
            onChange={(e) => onChange({ ...workforce, existing_benefits_description: e.target.value })}
            rows={3}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
          />
        </div>
      )}
    </div>
  );
}

// ── Step 5: Review ──────────────────────────────────────────────────────────────

function Step5Review({
  business,
  benefitType,
  budget,
  workforce,
  onEditStep,
}: {
  business: BusinessState;
  benefitType: string;
  budget: BudgetState;
  workforce: WorkforceState;
  onEditStep: (step: number) => void;
}) {
  const benefitLabel = BENEFIT_TYPE_OPTIONS.find((b) => b.id === benefitType)?.label ?? benefitType;
  const contribLabel = CONTRIBUTION_STRUCTURE_OPTIONS.find((c) => c.value === budget.contribution_structure)?.label ?? '';
  const compulsoryLabel = COMPULSORY_OPTIONS.find((c) => c.value === budget.compulsory_for_all)?.label ?? '';
  const ageBandLabel = AGE_BAND_OPTIONS.find((a) => a.value === workforce.average_age_band)?.label ?? '';
  const workforceTypeLabel = WORKFORCE_TYPE_OPTIONS.find((w) => w.value === workforce.workforce_type)?.label ?? '';
  const empCountLabel = EMPLOYEE_COUNT_OPTIONS.find((e) => e.value === business.employee_count)?.label ?? '';

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
        <p className="text-sm text-gray-500">Please review your details before submitting your employee benefits quote request.</p>
      </div>

      {/* Business */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Business Details" step={1} />
        <Row label="Company name" value={business.company_name} />
        {business.trading_name && <Row label="Trading name" value={business.trading_name} />}
        <Row label="Industry sector" value={business.industry_sector} />
        <Row label="Number of employees" value={empCountLabel} />
        <Row label="Province" value={business.province} />
      </div>

      {/* Benefit type */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Benefit Type" step={2} />
        <Row label="Selected benefit type" value={benefitLabel} />
      </div>

      {/* Budget */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Budget & Contribution" step={3} />
        <Row
          label="Monthly budget"
          value={budget.budget_adviser_assist ? 'Adviser guidance requested' : budget.monthly_budget ? `R ${budget.monthly_budget} /month` : '—'}
        />
        <Row label="Contribution structure" value={contribLabel} />
        <Row label="Compulsory for all staff" value={compulsoryLabel} />
      </div>

      {/* Workforce */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Workforce Overview" step={4} />
        <Row label="Average age band" value={ageBandLabel} />
        <Row label="Workforce type" value={workforceTypeLabel} />
        <Row label="Existing benefits" value={workforce.has_existing_benefits === null ? '—' : workforce.has_existing_benefits ? 'Yes' : 'No'} />
        {workforce.has_existing_benefits && workforce.existing_benefits_description && (
          <Row label="Current arrangement" value={workforce.existing_benefits_description} />
        )}
      </div>
    </div>
  );
}

// ── Main wizard component ───────────────────────────────────────────────────────

export function EmployeeBenefitsQuoteWizard({
  firstName,
  lastName,
  email,
  phone,
  parentSubmissionId,
  onSuccess,
}: EmployeeBenefitsQuoteWizardProps) {
  const draft = loadDraft();
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [business, setBusiness] = useState<BusinessState>(draft?.business ?? getInitialBusiness());
  const [benefitType, setBenefitType] = useState(draft?.benefit_type ?? '');
  const [budget, setBudget] = useState<BudgetState>(draft?.budget ?? getInitialBudget());
  const [workforce, setWorkforce] = useState<WorkforceState>(draft?.workforce ?? getInitialWorkforce());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Persist draft
  useEffect(() => {
    saveDraft({
      business,
      benefit_type: benefitType,
      budget,
      workforce,
      currentStep,
    });
  }, [business, benefitType, budget, workforce, currentStep]);

  // ── Validation ──

  const step1Valid = useMemo(() => {
    return Boolean(business.company_name.trim() && business.industry_sector && business.employee_count && business.province);
  }, [business]);

  const step2Valid = useMemo(() => Boolean(benefitType), [benefitType]);

  const step3Valid = useMemo(() => {
    const hasBudget = budget.budget_adviser_assist || Boolean(budget.monthly_budget);
    return hasBudget && Boolean(budget.contribution_structure) && Boolean(budget.compulsory_for_all);
  }, [budget]);

  const step4Valid = useMemo(() => {
    return Boolean(workforce.average_age_band && workforce.workforce_type && workforce.has_existing_benefits !== null);
  }, [workforce]);

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1: return step1Valid;
      case 2: return step2Valid;
      case 3: return step3Valid;
      case 4: return step4Valid;
      case 5: return true;
      default: return false;
    }
  }, [currentStep, step1Valid, step2Valid, step3Valid, step4Valid]);

  const goNext = useCallback(() => { if (currentStep < 5) setCurrentStep((s) => s + 1); }, [currentStep]);
  const goBack = useCallback(() => { if (currentStep > 1) setCurrentStep((s) => s - 1); }, [currentStep]);
  const goToStep = useCallback((step: number) => { setCurrentStep(step); }, []);

  // ── Submit ──

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const benefitLabel = BENEFIT_TYPE_OPTIONS.find((b) => b.id === benefitType)?.label ?? benefitType;
      const contribLabel = CONTRIBUTION_STRUCTURE_OPTIONS.find((c) => c.value === budget.contribution_structure)?.label ?? budget.contribution_structure;
      const compulsoryLabel = COMPULSORY_OPTIONS.find((c) => c.value === budget.compulsory_for_all)?.label ?? budget.compulsory_for_all;
      const ageBandLabel = AGE_BAND_OPTIONS.find((a) => a.value === workforce.average_age_band)?.label ?? workforce.average_age_band;
      const workforceTypeLabel = WORKFORCE_TYPE_OPTIONS.find((w) => w.value === workforce.workforce_type)?.label ?? workforce.workforce_type;
      const empCountLabel = EMPLOYEE_COUNT_OPTIONS.find((e) => e.value === business.employee_count)?.label ?? business.employee_count;

      const productDetails = {
        vertical: 'EmployeeBenefits',
        phase: 2,
        business: {
          company_name: business.company_name.trim(),
          trading_name: business.trading_name.trim() || null,
          industry_sector: business.industry_sector,
          employee_count: empCountLabel,
          employee_count_id: business.employee_count,
          province: business.province,
        },
        benefit_type: benefitLabel,
        benefit_type_id: benefitType,
        budget: {
          monthly_budget: budget.budget_adviser_assist ? null : parseCurrencyToNumber(budget.monthly_budget),
          budget_adviser_assist: budget.budget_adviser_assist,
          contribution_structure: contribLabel,
          contribution_structure_id: budget.contribution_structure,
          compulsory_for_all: compulsoryLabel,
          compulsory_for_all_id: budget.compulsory_for_all,
        },
        workforce: {
          average_age_band: ageBandLabel,
          average_age_band_id: workforce.average_age_band,
          workforce_type: workforceTypeLabel,
          workforce_type_id: workforce.workforce_type,
          has_existing_benefits: workforce.has_existing_benefits,
          existing_benefits_description: workforce.existing_benefits_description.trim() || null,
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
            productName: 'Employee Benefits',
            stage: 'full',
            service: 'employee-benefits',
            parentSubmissionId: parentSubmissionId ?? undefined,
            productDetails,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        console.error('Employee benefits quote submission error:', result);
        toast.error(result.error || 'Something went wrong. Please try again.');
        return;
      }

      clearDraft();
      toast.success('Your employee benefits quote request has been submitted!');
      onSuccess();
    } catch (error) {
      console.error('Employee benefits quote network error:', error);
      toast.error('Unable to submit your request. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [firstName, lastName, email, phone, parentSubmissionId, business, benefitType, budget, workforce, onSuccess]);

  // ── Render ──

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={currentStep} />

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-5 sm:p-6">
          {currentStep === 1 && <Step1Business business={business} onChange={setBusiness} />}
          {currentStep === 2 && <Step2BenefitType selected={benefitType} onChange={setBenefitType} />}
          {currentStep === 3 && <Step3Budget budget={budget} onChange={setBudget} />}
          {currentStep === 4 && <Step4Workforce workforce={workforce} onChange={setWorkforce} />}
          {currentStep === 5 && (
            <Step5Review
              business={business}
              benefitType={benefitType}
              budget={budget}
              workforce={workforce}
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

          {currentStep < 5 ? (
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