/**
 * RetirementQuoteWizard -- Phase 2 Retirement Planning "Get a Quote" Wizard
 *
 * A strict 4-step wizard + Review & Submit:
 *   Step 1: Which Retirement Product? (RA, Provident Preservation, Pension Preservation, Not Sure)
 *   Step 2: Contribution / Transfer Structure (context-dependent on product)
 *   Step 3: Retirement Timeline Context (planned age, current age, existing fund membership)
 *   Step 4: Basic Financial Snapshot (income, savings, tax bracket)
 *   Step 5: Review & Submit
 *
 * Hard rules:
 * - No projections, no tax calculations, no retirement gap analysis
 * - Intention + contribution capture only
 * - Do not mix preservation fund logic with RA contribution logic
 * - Adviser-assist never blocks progression
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
  Target,
  DollarSign,
  Clock,
  Briefcase,
  ClipboardList,
  Loader2,
  Info,
  Pencil,
  HelpCircle,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';

// ── Constants (§5.3) ────────────────────────────────────────────────────────────

const DRAFT_KEY = 'nw_retirement_quote_draft';

interface ProductOption {
  id: string;
  label: string;
  info: string;
}

const PRODUCT_OPTIONS: ProductOption[] = [
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

const RA_CONTRIBUTION_TYPES = [
  { value: 'monthly', label: 'Monthly contribution' },
  { value: 'lump_sum', label: 'Lump sum contribution' },
  { value: 'both', label: 'Both' },
  { value: 'not_sure', label: 'Not sure — adviser assistance' },
] as const;

const TAX_BRACKET_OPTIONS = [
  { value: 'below_18', label: 'Below 18%' },
  { value: '18_31', label: '18–31%' },
  { value: '31_39', label: '31–39%' },
  { value: '39_45', label: '39–45%' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

// ── State types ─────────────────────────────────────────────────────────────────

interface RAContributionState {
  contribution_type: string;
  monthly_amount: string;
  monthly_adviser_assist: boolean;
  lump_sum_amount: string;
  lump_sum_adviser_assist: boolean;
}

interface PreservationState {
  is_transferring: boolean | null;
  transfer_amount: string;
  transfer_not_sure: boolean;
}

interface NotSureState {
  currently_employed: boolean | null;
  leaving_employer_fund: boolean | null;
  want_monthly_contributions: string; // 'yes' | 'no' | 'not_sure' | ''
}

interface TimelineState {
  planned_retirement_age: string;
  current_age: string;
  member_of_retirement_fund: boolean | null;
  fund_details: string;
}

interface FinancialState {
  income_gross_monthly: string;
  income_net_monthly: string;
  current_retirement_savings: string;
  tax_bracket: string;
}

interface WizardDraft {
  selected_product: string;
  ra_contribution: RAContributionState;
  preservation: PreservationState;
  not_sure_context: NotSureState;
  timeline: TimelineState;
  financial: FinancialState;
  currentStep: number;
}

// ── Props ───────────────────────────────────────────────────────────────────────

interface RetirementQuoteWizardProps {
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

function getInitialRA(): RAContributionState {
  return {
    contribution_type: '',
    monthly_amount: '',
    monthly_adviser_assist: false,
    lump_sum_amount: '',
    lump_sum_adviser_assist: false,
  };
}

function getInitialPreservation(): PreservationState {
  return { is_transferring: null, transfer_amount: '', transfer_not_sure: false };
}

function getInitialNotSure(): NotSureState {
  return { currently_employed: null, leaving_employer_fund: null, want_monthly_contributions: '' };
}

function getInitialTimeline(): TimelineState {
  return { planned_retirement_age: '', current_age: '', member_of_retirement_fund: null, fund_details: '' };
}

function getInitialFinancial(): FinancialState {
  return { income_gross_monthly: '', income_net_monthly: '', current_retirement_savings: '', tax_bracket: '' };
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

function needsMonthly(ct: string) { return ct === 'monthly' || ct === 'both'; }
function needsLumpSum(ct: string) { return ct === 'lump_sum' || ct === 'both'; }

// ── Step Indicator ──────────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: 'Product', icon: Target },
    { num: 2, label: 'Funding', icon: DollarSign },
    { num: 3, label: 'Timeline', icon: Clock },
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

// ── Step 1: Which Retirement Product ────────────────────────────────────────────

function Step1Product({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">What retirement product are you looking for?</h2>
        <p className="text-sm text-gray-500">Select the retirement product that best fits your needs.</p>
      </div>

      <div className="space-y-2">
        {PRODUCT_OPTIONS.map((opt) => {
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

// ── Step 2: Contribution / Transfer Structure ───────────────────────────────────

function Step2RAContribution({
  state,
  onChange,
}: {
  state: RAContributionState;
  onChange: (s: RAContributionState) => void;
}) {
  const setCT = (ct: string) => {
    const next = { ...state, contribution_type: ct };
    if (!needsMonthly(ct)) { next.monthly_amount = ''; next.monthly_adviser_assist = false; }
    if (!needsLumpSum(ct)) { next.lump_sum_amount = ''; next.lump_sum_adviser_assist = false; }
    onChange(next);
  };

  const isAdviser = state.contribution_type === 'not_sure';
  const showMonthly = needsMonthly(state.contribution_type);
  const showLump = needsLumpSum(state.contribution_type);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Contribution type <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {RA_CONTRIBUTION_TYPES.map((ct) => (
            <button
              key={ct.value}
              type="button"
              onClick={() => setCT(ct.value)}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                state.contribution_type === ct.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {showMonthly && !isAdviser && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">Monthly contribution amount (ZAR)</Label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R</span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 3,000"
                value={state.monthly_amount}
                onChange={(e) => onChange({ ...state, monthly_amount: formatCurrency(e.target.value) })}
                disabled={state.monthly_adviser_assist}
                className="bg-white border-gray-300 h-10 pl-7"
              />
            </div>
            <button
              type="button"
              onClick={() => onChange({
                ...state,
                monthly_adviser_assist: !state.monthly_adviser_assist,
                monthly_amount: !state.monthly_adviser_assist ? '' : state.monthly_amount,
              })}
              className={`text-xs px-3 py-2 rounded-lg border font-medium whitespace-nowrap transition-all ${
                state.monthly_adviser_assist
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

      {showLump && !isAdviser && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">Lump sum contribution amount (ZAR)</Label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R</span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 100,000"
                value={state.lump_sum_amount}
                onChange={(e) => onChange({ ...state, lump_sum_amount: formatCurrency(e.target.value) })}
                disabled={state.lump_sum_adviser_assist}
                className="bg-white border-gray-300 h-10 pl-7"
              />
            </div>
            <button
              type="button"
              onClick={() => onChange({
                ...state,
                lump_sum_adviser_assist: !state.lump_sum_adviser_assist,
                lump_sum_amount: !state.lump_sum_adviser_assist ? '' : state.lump_sum_amount,
              })}
              className={`text-xs px-3 py-2 rounded-lg border font-medium whitespace-nowrap transition-all ${
                state.lump_sum_adviser_assist
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
          Your adviser will recommend the best contribution structure for your situation.
        </p>
      )}
    </div>
  );
}

function Step2Preservation({
  fundType,
  state,
  onChange,
}: {
  fundType: 'provident' | 'pension';
  state: PreservationState;
  onChange: (s: PreservationState) => void;
}) {
  const fundLabel = fundType === 'provident' ? 'provident' : 'pension';

  return (
    <div className="space-y-4">
      {/* Transferring? */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Are you transferring from a previous employer's {fundLabel} fund? <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: true, label: 'Yes' },
            { value: false, label: 'No' },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange({ ...state, is_transferring: opt.value })}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                state.is_transferring === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transfer amount */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Estimated transfer amount</Label>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R</span>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 250,000"
              value={state.transfer_amount}
              onChange={(e) => onChange({ ...state, transfer_amount: formatCurrency(e.target.value) })}
              disabled={state.transfer_not_sure}
              className="bg-white border-gray-300 h-10 pl-7"
            />
          </div>
          <button
            type="button"
            onClick={() => onChange({
              ...state,
              transfer_not_sure: !state.transfer_not_sure,
              transfer_amount: !state.transfer_not_sure ? '' : state.transfer_amount,
            })}
            className={`text-xs px-3 py-2 rounded-lg border font-medium whitespace-nowrap transition-all ${
              state.transfer_not_sure
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            Not sure
          </button>
        </div>
        <p className="text-xs text-gray-400">No new contributions are allowed on preservation funds.</p>
      </div>
    </div>
  );
}

function Step2NotSure({
  state,
  onChange,
}: {
  state: NotSureState;
  onChange: (s: NotSureState) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Currently employed */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Are you currently employed? <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {[true, false].map((val) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => onChange({ ...state, currently_employed: val })}
              className={`flex items-center justify-center p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                state.currently_employed === val
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {val ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </div>

      {/* Leaving employer fund */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Are you leaving an employer fund? <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {[true, false].map((val) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => onChange({ ...state, leaving_employer_fund: val })}
              className={`flex items-center justify-center p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                state.leaving_employer_fund === val
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {val ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </div>

      {/* Monthly contributions */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Would you like to make new contributions monthly? <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'not_sure', label: 'Not sure' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...state, want_monthly_contributions: opt.value })}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                state.want_monthly_contributions === opt.value
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

function Step2Funding({
  selectedProduct,
  raContribution,
  preservation,
  notSureContext,
  onChangeRA,
  onChangePreservation,
  onChangeNotSure,
}: {
  selectedProduct: string;
  raContribution: RAContributionState;
  preservation: PreservationState;
  notSureContext: NotSureState;
  onChangeRA: (s: RAContributionState) => void;
  onChangePreservation: (s: PreservationState) => void;
  onChangeNotSure: (s: NotSureState) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">How will this be funded?</h2>
        <p className="text-sm text-gray-500">
          {selectedProduct === 'ra'
            ? 'Tell us about your planned contributions.'
            : selectedProduct === 'provident_preservation' || selectedProduct === 'pension_preservation'
              ? 'Tell us about the transfer from your previous employer fund.'
              : 'A few questions to help your adviser recommend the right approach.'}
        </p>
      </div>

      {selectedProduct === 'ra' && (
        <Step2RAContribution state={raContribution} onChange={onChangeRA} />
      )}
      {selectedProduct === 'provident_preservation' && (
        <Step2Preservation fundType="provident" state={preservation} onChange={onChangePreservation} />
      )}
      {selectedProduct === 'pension_preservation' && (
        <Step2Preservation fundType="pension" state={preservation} onChange={onChangePreservation} />
      )}
      {selectedProduct === 'not_sure' && (
        <Step2NotSure state={notSureContext} onChange={onChangeNotSure} />
      )}
    </div>
  );
}

// ── Step 3: Retirement Timeline ─────────────────────────────────────────────────

function Step3Timeline({
  timeline,
  onChange,
}: {
  timeline: TimelineState;
  onChange: (t: TimelineState) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">When do you plan to retire?</h2>
        <p className="text-sm text-gray-500">This helps your adviser assess time horizon and product suitability.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            Current age <span className="text-red-500">*</span>
          </Label>
          <Input
            type="number"
            min={18}
            max={100}
            placeholder="e.g. 38"
            value={timeline.current_age}
            onChange={(e) => onChange({ ...timeline, current_age: e.target.value })}
            className="bg-white border-gray-300 h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            Planned retirement age <span className="text-red-500">*</span>
          </Label>
          <Input
            type="number"
            min={55}
            max={100}
            placeholder="e.g. 65"
            value={timeline.planned_retirement_age}
            onChange={(e) => onChange({ ...timeline, planned_retirement_age: e.target.value })}
            className="bg-white border-gray-300 h-11"
          />
        </div>
      </div>

      {/* Member of a retirement fund */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Are you currently a member of any retirement fund?
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
                ...timeline,
                member_of_retirement_fund: opt.value,
                fund_details: opt.value ? timeline.fund_details : '',
              })}
              className={`flex items-center justify-center p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                timeline.member_of_retirement_fund === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {timeline.member_of_retirement_fund === true && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">Which fund(s)?</Label>
          <Input
            type="text"
            placeholder="e.g. Old Mutual RA, Employer pension fund"
            value={timeline.fund_details}
            onChange={(e) => onChange({ ...timeline, fund_details: e.target.value })}
            className="bg-white border-gray-300 h-10"
          />
        </div>
      )}
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
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">A few quick details</h2>
        <p className="text-sm text-gray-500">Basic financial context to help your adviser prepare a suitable recommendation.</p>
      </div>

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
            onChange={(e) => onChange({ ...financial, income_gross_monthly: formatCurrency(e.target.value) })}
            className="bg-white border-gray-300 h-11 pl-7"
          />
        </div>
      </div>

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
            onChange={(e) => onChange({ ...financial, income_net_monthly: formatCurrency(e.target.value) })}
            className="bg-white border-gray-300 h-11 pl-7"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Current total retirement savings (optional)
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R</span>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 500,000"
            value={financial.current_retirement_savings}
            onChange={(e) => onChange({ ...financial, current_retirement_savings: formatCurrency(e.target.value) })}
            className="bg-white border-gray-300 h-11 pl-7"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">Tax bracket (optional)</Label>
        <div className="flex flex-wrap gap-2">
          {TAX_BRACKET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...financial, tax_bracket: opt.value })}
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

// ── Step 5: Review ──────────────────────────────────────────────────────────────

function Step5Review({
  selectedProduct,
  raContribution,
  preservation,
  notSureContext,
  timeline,
  financial,
  onEditStep,
}: {
  selectedProduct: string;
  raContribution: RAContributionState;
  preservation: PreservationState;
  notSureContext: NotSureState;
  timeline: TimelineState;
  financial: FinancialState;
  onEditStep: (step: number) => void;
}) {
  const productLabel = PRODUCT_OPTIONS.find((p) => p.id === selectedProduct)?.label ?? selectedProduct;
  const taxLabel = TAX_BRACKET_OPTIONS.find((o) => o.value === financial.tax_bracket)?.label ?? '';

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
        <p className="text-sm text-gray-500">Please review your details before submitting your retirement planning quote request.</p>
      </div>

      {/* Product */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Retirement Product" step={1} />
        <Row label="Selected product" value={productLabel} />
      </div>

      {/* Funding */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Funding" step={2} />
        {selectedProduct === 'ra' && (
          <div className="contents">
            <Row label="Contribution type" value={RA_CONTRIBUTION_TYPES.find((c) => c.value === raContribution.contribution_type)?.label ?? '—'} />
            {needsMonthly(raContribution.contribution_type) && (
              <Row
                label="Monthly amount"
                value={raContribution.monthly_adviser_assist ? 'Adviser assist' : raContribution.monthly_amount ? `R ${raContribution.monthly_amount}` : '—'}
              />
            )}
            {needsLumpSum(raContribution.contribution_type) && (
              <Row
                label="Lump sum amount"
                value={raContribution.lump_sum_adviser_assist ? 'Adviser assist' : raContribution.lump_sum_amount ? `R ${raContribution.lump_sum_amount}` : '—'}
              />
            )}
          </div>
        )}
        {(selectedProduct === 'provident_preservation' || selectedProduct === 'pension_preservation') && (
          <div className="contents">
            <Row label="Transferring from employer fund" value={preservation.is_transferring === null ? '—' : preservation.is_transferring ? 'Yes' : 'No'} />
            <Row
              label="Estimated transfer amount"
              value={preservation.transfer_not_sure ? 'Not sure' : preservation.transfer_amount ? `R ${preservation.transfer_amount}` : '—'}
            />
          </div>
        )}
        {selectedProduct === 'not_sure' && (
          <div className="contents">
            <Row label="Currently employed" value={notSureContext.currently_employed === null ? '—' : notSureContext.currently_employed ? 'Yes' : 'No'} />
            <Row label="Leaving employer fund" value={notSureContext.leaving_employer_fund === null ? '—' : notSureContext.leaving_employer_fund ? 'Yes' : 'No'} />
            <Row label="Want monthly contributions" value={
              notSureContext.want_monthly_contributions === 'yes' ? 'Yes'
              : notSureContext.want_monthly_contributions === 'no' ? 'No'
              : notSureContext.want_monthly_contributions === 'not_sure' ? 'Not sure' : '—'
            } />
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Retirement Timeline" step={3} />
        <Row label="Current age" value={timeline.current_age ? `${timeline.current_age} years` : '—'} />
        <Row label="Planned retirement age" value={timeline.planned_retirement_age ? `${timeline.planned_retirement_age} years` : '—'} />
        <Row label="Current retirement fund member" value={timeline.member_of_retirement_fund === null ? '—' : timeline.member_of_retirement_fund ? 'Yes' : 'No'} />
        {timeline.member_of_retirement_fund && timeline.fund_details && (
          <Row label="Fund(s)" value={timeline.fund_details} />
        )}
      </div>

      {/* Financial */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Financial Snapshot" step={4} />
        <Row label="Gross monthly income" value={financial.income_gross_monthly ? `R ${financial.income_gross_monthly}` : '—'} />
        <Row label="Net monthly income" value={financial.income_net_monthly ? `R ${financial.income_net_monthly}` : '—'} />
        <Row label="Current retirement savings" value={financial.current_retirement_savings ? `R ${financial.current_retirement_savings}` : '—'} />
        {taxLabel && <Row label="Tax bracket" value={taxLabel} />}
      </div>
    </div>
  );
}

// ── Main wizard component ───────────────────────────────────────────────────────

export function RetirementQuoteWizard({
  firstName,
  lastName,
  email,
  phone,
  parentSubmissionId,
  onSuccess,
}: RetirementQuoteWizardProps) {
  const draft = loadDraft();
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [selectedProduct, setSelectedProduct] = useState(draft?.selected_product ?? '');
  const [raContribution, setRAContribution] = useState<RAContributionState>(draft?.ra_contribution ?? getInitialRA());
  const [preservation, setPreservation] = useState<PreservationState>(draft?.preservation ?? getInitialPreservation());
  const [notSureContext, setNotSureContext] = useState<NotSureState>(draft?.not_sure_context ?? getInitialNotSure());
  const [timeline, setTimeline] = useState<TimelineState>(draft?.timeline ?? getInitialTimeline());
  const [financial, setFinancial] = useState<FinancialState>(draft?.financial ?? getInitialFinancial());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Persist draft
  useEffect(() => {
    saveDraft({
      selected_product: selectedProduct,
      ra_contribution: raContribution,
      preservation,
      not_sure_context: notSureContext,
      timeline,
      financial,
      currentStep,
    });
  }, [selectedProduct, raContribution, preservation, notSureContext, timeline, financial, currentStep]);

  // ── Validation ──

  const step1Valid = useMemo(() => Boolean(selectedProduct), [selectedProduct]);

  const step2Valid = useMemo(() => {
    if (selectedProduct === 'ra') {
      if (!raContribution.contribution_type) return false;
      if (raContribution.contribution_type === 'not_sure') return true;
      if (needsMonthly(raContribution.contribution_type)) {
        if (!raContribution.monthly_amount && !raContribution.monthly_adviser_assist) return false;
      }
      if (needsLumpSum(raContribution.contribution_type)) {
        if (!raContribution.lump_sum_amount && !raContribution.lump_sum_adviser_assist) return false;
      }
      return true;
    }
    if (selectedProduct === 'provident_preservation' || selectedProduct === 'pension_preservation') {
      if (preservation.is_transferring === null) return false;
      // Transfer amount is optional but encouraged — allow proceed
      return true;
    }
    if (selectedProduct === 'not_sure') {
      return (
        notSureContext.currently_employed !== null &&
        notSureContext.leaving_employer_fund !== null &&
        notSureContext.want_monthly_contributions !== ''
      );
    }
    return false;
  }, [selectedProduct, raContribution, preservation, notSureContext]);

  const step3Valid = useMemo(() => {
    return Boolean(timeline.current_age && timeline.planned_retirement_age);
  }, [timeline]);

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

  const goNext = useCallback(() => { if (currentStep < 5) setCurrentStep((s) => s + 1); }, [currentStep]);
  const goBack = useCallback(() => { if (currentStep > 1) setCurrentStep((s) => s - 1); }, [currentStep]);
  const goToStep = useCallback((step: number) => { setCurrentStep(step); }, []);

  // ── Submit ──

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const productLabel = PRODUCT_OPTIONS.find((p) => p.id === selectedProduct)?.label ?? selectedProduct;

      // Build funding payload based on product
      let fundingPayload: Record<string, unknown> = {};
      if (selectedProduct === 'ra') {
        const ctLabel = RA_CONTRIBUTION_TYPES.find((c) => c.value === raContribution.contribution_type)?.label ?? raContribution.contribution_type;
        fundingPayload = {
          contribution_type: ctLabel,
          adviser_assist: raContribution.contribution_type === 'not_sure',
        };
        if (needsMonthly(raContribution.contribution_type)) {
          fundingPayload.monthly = raContribution.monthly_adviser_assist
            ? { adviser_assist: true }
            : { amount_per_month: parseCurrencyToNumber(raContribution.monthly_amount) };
        }
        if (needsLumpSum(raContribution.contribution_type)) {
          fundingPayload.lump_sum = raContribution.lump_sum_adviser_assist
            ? { adviser_assist: true }
            : { amount: parseCurrencyToNumber(raContribution.lump_sum_amount) };
        }
      } else if (selectedProduct === 'provident_preservation' || selectedProduct === 'pension_preservation') {
        fundingPayload = {
          is_transferring: preservation.is_transferring,
          transfer_amount: preservation.transfer_not_sure ? null : parseCurrencyToNumber(preservation.transfer_amount) || null,
          transfer_not_sure: preservation.transfer_not_sure,
        };
      } else if (selectedProduct === 'not_sure') {
        fundingPayload = {
          currently_employed: notSureContext.currently_employed,
          leaving_employer_fund: notSureContext.leaving_employer_fund,
          want_monthly_contributions: notSureContext.want_monthly_contributions,
        };
      }

      const productDetails = {
        vertical: 'Retirement',
        phase: 2,
        selected_product: productLabel,
        selected_product_id: selectedProduct,
        funding: fundingPayload,
        timeline: {
          current_age: parseInt(timeline.current_age, 10) || null,
          planned_retirement_age: parseInt(timeline.planned_retirement_age, 10) || null,
          member_of_retirement_fund: timeline.member_of_retirement_fund,
          fund_details: timeline.fund_details || null,
        },
        financial_snapshot: {
          income_gross_monthly: parseCurrencyToNumber(financial.income_gross_monthly),
          income_net_monthly: parseCurrencyToNumber(financial.income_net_monthly),
          current_retirement_savings: parseCurrencyToNumber(financial.current_retirement_savings) || null,
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
            productName: 'Retirement Planning',
            stage: 'full',
            service: 'retirement-planning',
            parentSubmissionId: parentSubmissionId ?? undefined,
            productDetails,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        console.error('Retirement quote submission error:', result);
        toast.error(result.error || 'Something went wrong. Please try again.');
        return;
      }

      clearDraft();
      toast.success('Your retirement planning quote request has been submitted!');
      onSuccess();
    } catch (error) {
      console.error('Retirement quote network error:', error);
      toast.error('Unable to submit your request. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [firstName, lastName, email, phone, parentSubmissionId, selectedProduct, raContribution, preservation, notSureContext, timeline, financial, onSuccess]);

  // ── Render ──

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={currentStep} />

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-5 sm:p-6">
          {currentStep === 1 && <Step1Product selected={selectedProduct} onChange={setSelectedProduct} />}
          {currentStep === 2 && (
            <Step2Funding
              selectedProduct={selectedProduct}
              raContribution={raContribution}
              preservation={preservation}
              notSureContext={notSureContext}
              onChangeRA={setRAContribution}
              onChangePreservation={setPreservation}
              onChangeNotSure={setNotSureContext}
            />
          )}
          {currentStep === 3 && <Step3Timeline timeline={timeline} onChange={setTimeline} />}
          {currentStep === 4 && <Step4Financial financial={financial} onChange={setFinancial} />}
          {currentStep === 5 && (
            <Step5Review
              selectedProduct={selectedProduct}
              raContribution={raContribution}
              preservation={preservation}
              notSureContext={notSureContext}
              timeline={timeline}
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