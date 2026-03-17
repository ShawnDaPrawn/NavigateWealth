/**
 * InvestmentQuoteWizard -- Phase 2 Investment Management "Get a Quote" Wizard
 *
 * A strict 4-step wizard + Review & Submit:
 *   Step 1: Investment Type Selection (multi-select with info blips)
 *   Step 2: Contribution Structure (per selected type — lump sum / monthly / both + amounts or adviser-assist)
 *   Step 3: Investment Objective, Time Horizon, Risk Comfort
 *   Step 4: Basic Financial Snapshot (income, existing investments, RA, tax bracket)
 *   Step 5: Review & Submit
 *
 * Hard rules:
 * - Quote/intention capture only — not full FNA
 * - No tax calculations, no auto-suggested amounts
 * - Adviser-assist never blocks progression
 * - Mirrors Risk Planning Phase 2 in simplicity and clarity
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  TrendingUp,
  DollarSign,
  Target,
  ClipboardList,
  Loader2,
  Info,
  Pencil,
  HelpCircle,
  Briefcase,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';

// ── Constants (§5.3) ────────────────────────────────────────────────────────────

const DRAFT_KEY = 'nw_investment_quote_draft';

interface InvestmentOption {
  id: string;
  label: string;
  info: string;
}

const INVESTMENT_OPTIONS: InvestmentOption[] = [
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

const CONTRIBUTION_TYPES = [
  { value: 'lump_sum', label: 'Lump sum' },
  { value: 'monthly', label: 'Monthly debit order' },
  { value: 'both', label: 'Both' },
  { value: 'not_sure', label: 'Not sure — adviser assistance' },
] as const;

const OBJECTIVE_OPTIONS = [
  { value: 'wealth_accumulation', label: 'Wealth accumulation / growth' },
  { value: 'retirement_planning', label: 'Retirement planning' },
  { value: 'education_funding', label: 'Education funding' },
  { value: 'capital_preservation', label: 'Capital preservation' },
  { value: 'income_generation', label: 'Income generation' },
  { value: 'estate_planning', label: 'Estate planning' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

const TIME_HORIZON_OPTIONS = [
  { value: 'less_2_years', label: 'Less than 2 years' },
  { value: '2_5_years', label: '2–5 years' },
  { value: '5_10_years', label: '5–10 years' },
  { value: '10_plus_years', label: '10+ years' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

const RISK_COMFORT_OPTIONS = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'aggressive', label: 'Aggressive' },
  { value: 'not_sure', label: 'Not sure — require adviser guidance' },
] as const;

const TAX_BRACKET_OPTIONS = [
  { value: 'below_18', label: 'Below 18%' },
  { value: '18_31', label: '18–31%' },
  { value: '31_39', label: '31–39%' },
  { value: '39_45', label: '39–45%' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

// ── State types ─────────────────────────────────────────────────────────────────

interface ContributionEntry {
  contribution_type: string; // lump_sum | monthly | both | not_sure
  lump_sum_amount: string;
  lump_sum_adviser_assist: boolean;
  monthly_amount: string;
  monthly_adviser_assist: boolean;
}

interface ObjectiveState {
  primary_objective: string;
  time_horizon: string;
  risk_comfort: string;
}

interface FinancialState {
  income_gross_monthly: string;
  income_net_monthly: string;
  existing_investments: string;
  has_retirement_annuity: boolean | null;
  tax_bracket: string;
}

interface WizardDraft {
  selected_types: string[];
  contributions: Record<string, ContributionEntry>;
  objective: ObjectiveState;
  financial: FinancialState;
  currentStep: number;
}

// ── Props ───────────────────────────────────────────────────────────────────────

interface InvestmentQuoteWizardProps {
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

function getInitialContribution(): ContributionEntry {
  return {
    contribution_type: '',
    lump_sum_amount: '',
    lump_sum_adviser_assist: false,
    monthly_amount: '',
    monthly_adviser_assist: false,
  };
}

function getInitialObjective(): ObjectiveState {
  return { primary_objective: '', time_horizon: '', risk_comfort: '' };
}

function getInitialFinancial(): FinancialState {
  return {
    income_gross_monthly: '',
    income_net_monthly: '',
    existing_investments: '',
    has_retirement_annuity: null,
    tax_bracket: '',
  };
}

function loadDraft(): WizardDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveDraft(draft: WizardDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch { /* non-critical */ }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch { /* non-critical */ }
}

function needsLumpSum(ct: string) {
  return ct === 'lump_sum' || ct === 'both';
}

function needsMonthly(ct: string) {
  return ct === 'monthly' || ct === 'both';
}

function getLabelForType(id: string): string {
  return INVESTMENT_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

// ── Step Indicator ──────────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: 'Type', icon: TrendingUp },
    { num: 2, label: 'Amount', icon: DollarSign },
    { num: 3, label: 'Objective', icon: Target },
    { num: 4, label: 'Financial', icon: Briefcase },
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

// ── Step 1: Investment Type ─────────────────────────────────────────────────────

function Step1Types({
  selectedTypes,
  onChange,
}: {
  selectedTypes: string[];
  onChange: (types: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (selectedTypes.includes(id)) {
      onChange(selectedTypes.filter((t) => t !== id));
    } else {
      onChange([...selectedTypes, id]);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">What would you like to invest in?</h2>
        <p className="text-sm text-gray-500">Select one or more investment types. You can choose multiple.</p>
      </div>

      <div className="space-y-2">
        {INVESTMENT_OPTIONS.map((opt) => {
          const isSelected = selectedTypes.includes(opt.id);
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
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mt-0.5 flex-shrink-0 transition-colors ${
                  isSelected ? 'bg-primary border-primary' : 'border-gray-300 bg-white'
                }`}
              >
                {isSelected && <CheckCircle className="h-3.5 w-3.5 text-white" />}
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

// ── Step 2: Contribution Structure ──────────────────────────────────────────────

function Step2Contributions({
  selectedTypes,
  contributions,
  onChange,
}: {
  selectedTypes: string[];
  contributions: Record<string, ContributionEntry>;
  onChange: (c: Record<string, ContributionEntry>) => void;
}) {
  const updateEntry = (typeId: string, partial: Partial<ContributionEntry>) => {
    const current = contributions[typeId] || getInitialContribution();
    const next = { ...current, ...partial };

    // Reset amounts when switching contribution type
    if (partial.contribution_type !== undefined) {
      if (!needsLumpSum(partial.contribution_type)) {
        next.lump_sum_amount = '';
        next.lump_sum_adviser_assist = false;
      }
      if (!needsMonthly(partial.contribution_type)) {
        next.monthly_amount = '';
        next.monthly_adviser_assist = false;
      }
    }

    onChange({ ...contributions, [typeId]: next });
  };

  // Filter to actual investment types (skip 'not_sure')
  const typesToShow = selectedTypes.filter((t) => t !== 'not_sure');
  const onlyAdviserAssist = selectedTypes.length === 1 && selectedTypes[0] === 'not_sure';

  if (onlyAdviserAssist) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">How would you like to contribute?</h2>
          <p className="text-sm text-gray-500">You've selected adviser assistance for the investment type. Our adviser will recommend contribution structures based on your profile.</p>
        </div>
        <div className="p-4 rounded-xl bg-primary/[0.03] border border-primary/20 text-sm text-gray-700 flex items-start gap-2">
          <HelpCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <span>No contribution details required — your adviser will discuss this with you.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">How would you like to contribute?</h2>
        <p className="text-sm text-gray-500">For each selected investment, choose your contribution method and amount.</p>
      </div>

      {typesToShow.map((typeId) => {
        const entry = contributions[typeId] || getInitialContribution();
        const label = getLabelForType(typeId);
        const isAdviser = entry.contribution_type === 'not_sure';
        const showLump = needsLumpSum(entry.contribution_type);
        const showMonthly = needsMonthly(entry.contribution_type);

        return (
          <div key={typeId} className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {label}
            </h3>

            {/* Contribution type selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Contribution type <span className="text-red-500">*</span></Label>
              <div className="flex flex-wrap gap-2">
                {CONTRIBUTION_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => updateEntry(typeId, { contribution_type: ct.value })}
                    className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                      entry.contribution_type === ct.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lump sum amount */}
            {showLump && !isAdviser && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">Lump sum amount (ZAR)</Label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g. 50,000"
                      value={entry.lump_sum_amount}
                      onChange={(e) => updateEntry(typeId, { lump_sum_amount: formatCurrency(e.target.value) })}
                      disabled={entry.lump_sum_adviser_assist}
                      className="bg-white border-gray-300 h-10 pl-7"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => updateEntry(typeId, {
                      lump_sum_adviser_assist: !entry.lump_sum_adviser_assist,
                      lump_sum_amount: !entry.lump_sum_adviser_assist ? '' : entry.lump_sum_amount,
                    })}
                    className={`text-xs px-3 py-2 rounded-lg border font-medium whitespace-nowrap transition-all ${
                      entry.lump_sum_adviser_assist
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <HelpCircle className="h-3 w-3 inline mr-1" />
                    Adviser assist
                  </button>
                </div>
              </div>
            )}

            {/* Monthly amount */}
            {showMonthly && !isAdviser && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">Monthly amount (ZAR /month)</Label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g. 2,000"
                      value={entry.monthly_amount}
                      onChange={(e) => updateEntry(typeId, { monthly_amount: formatCurrency(e.target.value) })}
                      disabled={entry.monthly_adviser_assist}
                      className="bg-white border-gray-300 h-10 pl-7"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => updateEntry(typeId, {
                      monthly_adviser_assist: !entry.monthly_adviser_assist,
                      monthly_amount: !entry.monthly_adviser_assist ? '' : entry.monthly_amount,
                    })}
                    className={`text-xs px-3 py-2 rounded-lg border font-medium whitespace-nowrap transition-all ${
                      entry.monthly_adviser_assist
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <HelpCircle className="h-3 w-3 inline mr-1" />
                    Adviser assist
                  </button>
                </div>
              </div>
            )}

            {isAdviser && (
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                Your adviser will recommend the best contribution structure for this investment.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 3: Objective & Time Horizon ────────────────────────────────────────────

function Step3Objective({
  objective,
  onChange,
}: {
  objective: ObjectiveState;
  onChange: (o: ObjectiveState) => void;
}) {
  const update = (field: keyof ObjectiveState, value: string) => {
    onChange({ ...objective, [field]: value });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">What is this investment for?</h2>
        <p className="text-sm text-gray-500">Help us understand your goals so we can recommend the right approach.</p>
      </div>

      {/* Primary objective */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Primary objective <span className="text-red-500">*</span>
        </Label>
        <div className="grid gap-2">
          {OBJECTIVE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('primary_objective', opt.value)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                objective.primary_objective === opt.value
                  ? 'border-primary/50 bg-primary/[0.03]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                objective.primary_objective === opt.value ? 'border-primary' : 'border-gray-300'
              }`}>
                {objective.primary_objective === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-900">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Time horizon */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Time horizon <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {TIME_HORIZON_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('time_horizon', opt.value)}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                objective.time_horizon === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Risk comfort */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Risk comfort level <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {RISK_COMFORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('risk_comfort', opt.value)}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                objective.risk_comfort === opt.value
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

// ── Step 4: Financial Snapshot ───────────────────────────────────────────────────

function Step4Financial({
  financial,
  onChange,
}: {
  financial: FinancialState;
  onChange: (f: FinancialState) => void;
}) {
  const update = (field: keyof FinancialState, value: unknown) => {
    onChange({ ...financial, [field]: value });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">A few quick financial details</h2>
        <p className="text-sm text-gray-500">This helps us assess suitability and recommend the right investment structure.</p>
      </div>

      {/* Gross monthly income */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Gross monthly income <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R</span>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 45,000"
            value={financial.income_gross_monthly}
            onChange={(e) => update('income_gross_monthly', formatCurrency(e.target.value))}
            className="bg-white border-gray-300 h-11 pl-7"
          />
        </div>
      </div>

      {/* Net monthly income */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Net monthly income <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R</span>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 32,000"
            value={financial.income_net_monthly}
            onChange={(e) => update('income_net_monthly', formatCurrency(e.target.value))}
            className="bg-white border-gray-300 h-11 pl-7"
          />
        </div>
      </div>

      {/* Existing investments */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Existing investments (optional)
        </Label>
        <Input
          type="text"
          placeholder="e.g. Unit trust with Allan Gray, TFSA with Sygnia"
          value={financial.existing_investments}
          onChange={(e) => update('existing_investments', e.target.value)}
          className="bg-white border-gray-300 h-11"
        />
      </div>

      {/* Retirement annuity */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Do you currently have a retirement annuity?
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: true, label: 'Yes' },
            { value: false, label: 'No' },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => update('has_retirement_annuity', opt.value)}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                financial.has_retirement_annuity === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tax bracket */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Tax bracket (optional)
        </Label>
        <div className="flex flex-wrap gap-2">
          {TAX_BRACKET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('tax_bracket', opt.value)}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                financial.tax_bracket === opt.value
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

// ── Step 5: Review & Submit ─────────────────────────────────────────────────────

function Step5Review({
  selectedTypes,
  contributions,
  objective,
  financial,
  onEditStep,
}: {
  selectedTypes: string[];
  contributions: Record<string, ContributionEntry>;
  objective: ObjectiveState;
  financial: FinancialState;
  onEditStep: (step: number) => void;
}) {
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

  const objectiveLabel = OBJECTIVE_OPTIONS.find((o) => o.value === objective.primary_objective)?.label ?? objective.primary_objective;
  const horizonLabel = TIME_HORIZON_OPTIONS.find((o) => o.value === objective.time_horizon)?.label ?? objective.time_horizon;
  const riskLabel = RISK_COMFORT_OPTIONS.find((o) => o.value === objective.risk_comfort)?.label ?? objective.risk_comfort;
  const taxLabel = TAX_BRACKET_OPTIONS.find((o) => o.value === financial.tax_bracket)?.label ?? '';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Review & submit</h2>
        <p className="text-sm text-gray-500">Please review your details before submitting your investment quote request.</p>
      </div>

      {/* Investment types */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Investment Types" step={1} />
        <Row label="Selected" value={selectedTypes.map(getLabelForType).join(', ')} />
      </div>

      {/* Contributions */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Contributions" step={2} />
        {selectedTypes.filter((t) => t !== 'not_sure').map((typeId) => {
          const entry = contributions[typeId] || getInitialContribution();
          const ctLabel = CONTRIBUTION_TYPES.find((c) => c.value === entry.contribution_type)?.label ?? '—';

          const parts: string[] = [ctLabel];
          if (needsLumpSum(entry.contribution_type)) {
            parts.push(entry.lump_sum_adviser_assist
              ? 'Lump sum: adviser assist'
              : entry.lump_sum_amount
                ? `Lump sum: R ${entry.lump_sum_amount}`
                : 'Lump sum: not specified');
          }
          if (needsMonthly(entry.contribution_type)) {
            parts.push(entry.monthly_adviser_assist
              ? 'Monthly: adviser assist'
              : entry.monthly_amount
                ? `Monthly: R ${entry.monthly_amount}`
                : 'Monthly: not specified');
          }

          return <Row key={typeId} label={getLabelForType(typeId)} value={parts.join(' · ')} />;
        })}
        {selectedTypes.includes('not_sure') && selectedTypes.length === 1 && (
          <Row label="Adviser assistance" value="Full adviser guidance requested" />
        )}
      </div>

      {/* Objective */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Objective & Horizon" step={3} />
        <Row label="Primary objective" value={objectiveLabel} />
        <Row label="Time horizon" value={horizonLabel} />
        <Row label="Risk comfort" value={riskLabel} />
      </div>

      {/* Financial */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Financial Snapshot" step={4} />
        <Row label="Gross monthly income" value={financial.income_gross_monthly ? `R ${financial.income_gross_monthly}` : '—'} />
        <Row label="Net monthly income" value={financial.income_net_monthly ? `R ${financial.income_net_monthly}` : '—'} />
        <Row label="Existing investments" value={financial.existing_investments || '—'} />
        <Row label="Retirement annuity" value={financial.has_retirement_annuity === null ? '—' : financial.has_retirement_annuity ? 'Yes' : 'No'} />
        {taxLabel && <Row label="Tax bracket" value={taxLabel} />}
      </div>
    </div>
  );
}

// ── Main wizard component ───────────────────────────────────────────────────────

export function InvestmentQuoteWizard({
  firstName,
  lastName,
  email,
  phone,
  parentSubmissionId,
  onSuccess,
}: InvestmentQuoteWizardProps) {
  const draft = loadDraft();
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(draft?.selected_types ?? []);
  const [contributions, setContributions] = useState<Record<string, ContributionEntry>>(draft?.contributions ?? {});
  const [objective, setObjective] = useState<ObjectiveState>(draft?.objective ?? getInitialObjective());
  const [financial, setFinancial] = useState<FinancialState>(draft?.financial ?? getInitialFinancial());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Persist draft
  useEffect(() => {
    saveDraft({
      selected_types: selectedTypes,
      contributions,
      objective,
      financial,
      currentStep,
    });
  }, [selectedTypes, contributions, objective, financial, currentStep]);

  // ── Validation ──

  const step1Valid = useMemo(() => selectedTypes.length > 0, [selectedTypes]);

  const step2Valid = useMemo(() => {
    // If only "not_sure" selected, no contribution details needed
    if (selectedTypes.length === 1 && selectedTypes[0] === 'not_sure') return true;

    const typesToValidate = selectedTypes.filter((t) => t !== 'not_sure');
    return typesToValidate.every((typeId) => {
      const entry = contributions[typeId];
      if (!entry || !entry.contribution_type) return false;
      if (entry.contribution_type === 'not_sure') return true;

      // Validate lump sum path
      if (needsLumpSum(entry.contribution_type)) {
        if (!entry.lump_sum_amount && !entry.lump_sum_adviser_assist) return false;
      }
      // Validate monthly path
      if (needsMonthly(entry.contribution_type)) {
        if (!entry.monthly_amount && !entry.monthly_adviser_assist) return false;
      }
      return true;
    });
  }, [selectedTypes, contributions]);

  const step3Valid = useMemo(() => {
    return Boolean(objective.primary_objective && objective.time_horizon && objective.risk_comfort);
  }, [objective]);

  const step4Valid = useMemo(() => {
    return Boolean(financial.income_gross_monthly && financial.income_net_monthly);
  }, [financial]);

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

  // ── Navigation ──

  const goNext = useCallback(() => {
    if (currentStep < 5) setCurrentStep((s) => s + 1);
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  // ── Submit ──

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);

    try {
      // Build contributions payload
      const contributionsPayload: Record<string, unknown> = {};
      selectedTypes.filter((t) => t !== 'not_sure').forEach((typeId) => {
        const entry = contributions[typeId] || getInitialContribution();
        const ctLabel = CONTRIBUTION_TYPES.find((c) => c.value === entry.contribution_type)?.label ?? entry.contribution_type;
        const data: Record<string, unknown> = {
          contribution_type: ctLabel,
          adviser_assist: entry.contribution_type === 'not_sure',
        };
        if (needsLumpSum(entry.contribution_type)) {
          data.lump_sum = entry.lump_sum_adviser_assist
            ? { adviser_assist: true }
            : { amount: parseCurrencyToNumber(entry.lump_sum_amount) };
        }
        if (needsMonthly(entry.contribution_type)) {
          data.monthly = entry.monthly_adviser_assist
            ? { adviser_assist: true }
            : { amount_per_month: parseCurrencyToNumber(entry.monthly_amount) };
        }
        contributionsPayload[typeId] = data;
      });

      const productDetails = {
        vertical: 'Investment',
        phase: 2,
        selected_types: selectedTypes.map(getLabelForType),
        contributions: contributionsPayload,
        objective: {
          primary_objective: OBJECTIVE_OPTIONS.find((o) => o.value === objective.primary_objective)?.label ?? objective.primary_objective,
          time_horizon: TIME_HORIZON_OPTIONS.find((o) => o.value === objective.time_horizon)?.label ?? objective.time_horizon,
          risk_comfort: RISK_COMFORT_OPTIONS.find((o) => o.value === objective.risk_comfort)?.label ?? objective.risk_comfort,
        },
        financial_snapshot: {
          income_gross_monthly: parseCurrencyToNumber(financial.income_gross_monthly),
          income_net_monthly: parseCurrencyToNumber(financial.income_net_monthly),
          existing_investments: financial.existing_investments || null,
          has_retirement_annuity: financial.has_retirement_annuity,
          tax_bracket: TAX_BRACKET_OPTIONS.find((o) => o.value === financial.tax_bracket)?.label ?? null,
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
            productName: 'Investment Management',
            stage: 'full',
            service: 'investment-management',
            parentSubmissionId: parentSubmissionId ?? undefined,
            productDetails,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('Investment quote submission error:', result);
        toast.error(result.error || 'Something went wrong. Please try again.');
        return;
      }

      clearDraft();
      toast.success('Your investment quote request has been submitted!');
      onSuccess();
    } catch (error) {
      console.error('Investment quote network error:', error);
      toast.error('Unable to submit your request. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [firstName, lastName, email, phone, parentSubmissionId, selectedTypes, contributions, objective, financial, onSuccess]);

  // ── Render ──

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={currentStep} />

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-5 sm:p-6">
          {currentStep === 1 && <Step1Types selectedTypes={selectedTypes} onChange={setSelectedTypes} />}
          {currentStep === 2 && (
            <Step2Contributions
              selectedTypes={selectedTypes}
              contributions={contributions}
              onChange={setContributions}
            />
          )}
          {currentStep === 3 && <Step3Objective objective={objective} onChange={setObjective} />}
          {currentStep === 4 && <Step4Financial financial={financial} onChange={setFinancial} />}
          {currentStep === 5 && (
            <Step5Review
              selectedTypes={selectedTypes}
              contributions={contributions}
              objective={objective}
              financial={financial}
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