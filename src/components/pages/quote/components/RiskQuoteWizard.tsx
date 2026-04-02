/**
 * RiskQuoteWizard -- Phase 2 Risk Planning "Get a Quote" Wizard
 *
 * A 4-step mobile-first wizard collecting:
 *   Step 1: Risk Cover Requirements (covers + amounts / adviser-assist)
 *   Step 2: Personal & Financial Details (underwriting / quoting inputs)
 *   Step 3: Chronic Conditions (quick-pick chips + free text)
 *   Step 4: Review & Submit
 *
 * Outputs a structured payload for the quote engine / adviser review.
 * Persists draft progress to sessionStorage for save-and-resume.
 *
 * $7   -- Presentation layer (UI only, no business logic)
 * $5.3 -- Constants centralised below
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner@2.0.3';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Badge } from '../../../ui/badge';
import { Checkbox } from '../../../ui/checkbox';
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
  Shield,
  Heart,
  Brain,
  DollarSign,
  AlertTriangle,
  HelpCircle,
  Loader2,
  Info,
  Pencil,
  User,
  Stethoscope,
  ClipboardList,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';

// ---- Constants (SS5.3) --------------------------------------------------------

const DRAFT_KEY = 'nw_risk_quote_draft';

interface CoverOption {
  id: string;
  label: string;
  infoBlip: string;
  isMonthly: boolean; // true = per-month input, false = lump sum
}

const COVER_OPTIONS: CoverOption[] = [
  {
    id: 'life_cover',
    label: 'Life Cover',
    infoBlip: 'Pays a lump sum if you pass away -- helps protect dependants and settle debt.',
    isMonthly: false,
  },
  {
    id: 'lump_sum_disability',
    label: 'Lump Sum Disability',
    infoBlip: 'Pays a lump sum if a permanent disability prevents you from working or living independently.',
    isMonthly: false,
  },
  {
    id: 'severe_illness',
    label: 'Severe Illness',
    infoBlip: 'Pays a lump sum on diagnosis of qualifying serious illnesses (e.g., cancer, heart attack, stroke).',
    isMonthly: false,
  },
  {
    id: 'income_protection',
    label: 'Income Protection',
    infoBlip: 'Pays a monthly income if illness/injury stops you from earning -- designed to replace part of your income.',
    isMonthly: true,
  },
];

const SMOKER_OPTIONS = [
  { value: 'non-smoker', label: 'Non-smoker' },
  { value: 'smoker', label: 'Smoker' },
  { value: 'occasional', label: 'Occasional / Social' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

const QUALIFICATION_OPTIONS = [
  { value: 'matric', label: 'Matric / Grade 12' },
  { value: 'certificate', label: 'Certificate / Diploma' },
  { value: 'bachelors', label: "Bachelor's Degree" },
  { value: 'honours', label: 'Honours Degree' },
  { value: 'masters', label: "Master's Degree" },
  { value: 'doctorate', label: 'Doctorate / PhD' },
  { value: 'professional', label: 'Professional Qualification (CA, CFA, etc.)' },
  { value: 'other', label: 'Other' },
];

const MARITAL_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'life-partner', label: 'Life Partner' },
];

const CHRONIC_PRESETS = [
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

interface CoverEntry {
  selected: boolean;
  amount: string; // stored as string for input, parsed to number on submit
  adviser_assist: boolean;
}

type RiskNeeds = Record<string, CoverEntry>;

interface PersonalDetails {
  occupation: string;
  income_gross_monthly: string;
  income_net_monthly: string;
  smoker_status: string;
  highest_qualification: string;
  marital_status: string;
  spouse_income_monthly: string;
}

interface HealthDisclosures {
  has_conditions: boolean | null; // null = not answered
  selected_conditions: string[];
  free_text: string;
}

interface WizardDraft {
  risk_needs: RiskNeeds;
  personal_details: PersonalDetails;
  health_disclosures: HealthDisclosures;
  currentStep: number;
}

// ---- Props ---------------------------------------------------------------------

interface RiskQuoteWizardProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  parentSubmissionId?: string;
  onSuccess: () => void;
}

// ---- Helpers -------------------------------------------------------------------

function formatCurrency(value: string): string {
  const num = value.replace(/[^\d]/g, '');
  if (!num) return '';
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function parseCurrencyToNumber(value: string): number {
  const cleaned = value.replace(/[^\d]/g, '');
  return cleaned ? Number(cleaned) : 0;
}

function getInitialRiskNeeds(): RiskNeeds {
  const needs: RiskNeeds = {};
  COVER_OPTIONS.forEach((c) => {
    needs[c.id] = { selected: false, amount: '', adviser_assist: false };
  });
  return needs;
}

function getInitialPersonalDetails(): PersonalDetails {
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

function getInitialHealthDisclosures(): HealthDisclosures {
  return { has_conditions: null, selected_conditions: [], free_text: '' };
}

function loadDraft(): WizardDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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

function needsSpouseIncome(status: string) {
  return status === 'married' || status === 'life-partner';
}

// ---- Step indicator -----------------------------------------------------------

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: 'Cover', icon: Shield },
    { num: 2, label: 'Details', icon: User },
    { num: 3, label: 'Health', icon: Stethoscope },
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

// ---- Step 1: Risk Cover Requirements ------------------------------------------

function Step1Covers({
  riskNeeds,
  onChange,
}: {
  riskNeeds: RiskNeeds;
  onChange: (needs: RiskNeeds) => void;
}) {
  const toggleCover = (id: string) => {
    onChange({
      ...riskNeeds,
      [id]: { ...riskNeeds[id], selected: !riskNeeds[id].selected },
    });
  };

  const setAmount = (id: string, value: string) => {
    onChange({
      ...riskNeeds,
      [id]: { ...riskNeeds[id], amount: formatCurrency(value) },
    });
  };

  const toggleAdviser = (id: string) => {
    onChange({
      ...riskNeeds,
      [id]: { ...riskNeeds[id], adviser_assist: !riskNeeds[id].adviser_assist },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">What cover do you want to quote?</h2>
        <p className="text-sm text-gray-500">Select one or more covers and enter amounts, or request adviser assistance.</p>
      </div>

      <div className="space-y-3">
        {COVER_OPTIONS.map((cover) => {
          const entry = riskNeeds[cover.id];
          return (
            <div
              key={cover.id}
              className={`rounded-xl border-2 transition-all ${
                entry.selected
                  ? 'border-primary/50 bg-primary/[0.02] shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {/* Header row */}
              <button
                type="button"
                onClick={() => toggleCover(cover.id)}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                    entry.selected ? 'bg-primary border-primary' : 'border-gray-300 bg-white'
                  }`}
                >
                  {entry.selected && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-gray-900 text-sm">{cover.label}</span>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0 text-gray-400" />
                    {cover.infoBlip}
                  </p>
                </div>
              </button>

              {/* Expanded inputs */}
              {entry.selected && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      {cover.isMonthly ? 'Monthly amount (ZAR / month, real value)' : 'Cover amount (ZAR)'}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder={cover.isMonthly ? 'e.g. 35 000' : 'e.g. 2 000 000'}
                        value={entry.amount}
                        onChange={(e) => setAmount(cover.id, e.target.value)}
                        disabled={entry.adviser_assist}
                        className={`pl-8 h-10 bg-white border-gray-300 ${entry.adviser_assist ? 'opacity-50' : ''}`}
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer group">
                    <Checkbox
                      checked={entry.adviser_assist}
                      onCheckedChange={() => toggleAdviser(cover.id)}
                    />
                    <span className="text-xs text-gray-600 group-hover:text-gray-900 transition-colors">
                      Require adviser assistance determining my cover amount
                    </span>
                  </label>

                  {!entry.adviser_assist && !entry.amount && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <HelpCircle className="h-3 w-3" />
                      Not sure? Choose adviser assistance and we'll calculate this with you.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Step 2: Personal & Financial Details -------------------------------------

function Step2Personal({
  details,
  onChange,
}: {
  details: PersonalDetails;
  onChange: (d: PersonalDetails) => void;
}) {
  const update = (field: keyof PersonalDetails, value: string) => {
    onChange({ ...details, [field]: value });
  };

  const grossNum = parseCurrencyToNumber(details.income_gross_monthly);
  const netNum = parseCurrencyToNumber(details.income_net_monthly);
  const showNetWarning = grossNum > 0 && netNum > 0 && netNum > grossNum;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Tell us a bit about you</h2>
        <p className="text-sm text-gray-500">These details help us provide an accurate quote.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Occupation */}
        <div className="sm:col-span-2 space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            Occupation <span className="text-red-500">*</span>
          </Label>
          <Input
            type="text"
            placeholder="e.g. Project Manager"
            value={details.occupation}
            onChange={(e) => update('occupation', e.target.value)}
            className="bg-white border-gray-300 h-11"
          />
        </div>

        {/* Gross income */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            Gross monthly income <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R</span>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 85 000"
              value={details.income_gross_monthly}
              onChange={(e) => update('income_gross_monthly', formatCurrency(e.target.value))}
              className="pl-8 bg-white border-gray-300 h-11"
            />
          </div>
        </div>

        {/* Net income */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            Net monthly income <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R</span>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 62 000"
              value={details.income_net_monthly}
              onChange={(e) => update('income_net_monthly', formatCurrency(e.target.value))}
              className="pl-8 bg-white border-gray-300 h-11"
            />
          </div>
          {showNetWarning && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Net income is usually lower than gross -- please double-check.
            </p>
          )}
        </div>

        {/* Smoker status */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            Smoker status <span className="text-red-500">*</span>
          </Label>
          <Select value={details.smoker_status} onValueChange={(v) => update('smoker_status', v)}>
            <SelectTrigger className="h-11 bg-white border-gray-300">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {SMOKER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Qualification */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">Highest qualification</Label>
          <Select value={details.highest_qualification} onValueChange={(v) => update('highest_qualification', v)}>
            <SelectTrigger className="h-11 bg-white border-gray-300">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {QUALIFICATION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Marital status */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">
            Marital status <span className="text-red-500">*</span>
          </Label>
          <Select value={details.marital_status} onValueChange={(v) => update('marital_status', v)}>
            <SelectTrigger className="h-11 bg-white border-gray-300">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {MARITAL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Spouse income (conditional) */}
        {needsSpouseIncome(details.marital_status) && (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Spouse / partner monthly income <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R</span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 45 000"
                value={details.spouse_income_monthly}
                onChange={(e) => update('spouse_income_monthly', formatCurrency(e.target.value))}
                className="pl-8 bg-white border-gray-300 h-11"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Step 3: Chronic Conditions ------------------------------------------------

function Step3Health({
  disclosures,
  onChange,
}: {
  disclosures: HealthDisclosures;
  onChange: (d: HealthDisclosures) => void;
}) {
  const toggleCondition = (condition: string) => {
    const current = disclosures.selected_conditions;
    const updated = current.includes(condition)
      ? current.filter((c) => c !== condition)
      : [...current, condition];
    onChange({ ...disclosures, has_conditions: updated.length > 0 || disclosures.free_text.trim().length > 0 ? true : disclosures.has_conditions, selected_conditions: updated });
  };

  const setNone = () => {
    onChange({ has_conditions: false, selected_conditions: [], free_text: '' });
  };

  const setHas = () => {
    onChange({ ...disclosures, has_conditions: true });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Any ongoing or chronic conditions?</h2>
        <p className="text-sm text-gray-500">
          This helps us pre-screen underwriting options. It's not a medical form -- just a light-touch disclosure.
        </p>
      </div>

      {/* Yes / No toggle */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={setNone}
          className={`flex-1 rounded-xl border-2 p-3 text-sm font-semibold transition-all ${
            disclosures.has_conditions === false
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
        >
          <CheckCircle className={`h-4 w-4 mx-auto mb-1 ${disclosures.has_conditions === false ? 'text-green-500' : 'text-gray-300'}`} />
          None
        </button>
        <button
          type="button"
          onClick={setHas}
          className={`flex-1 rounded-xl border-2 p-3 text-sm font-semibold transition-all ${
            disclosures.has_conditions === true
              ? 'border-primary/50 bg-primary/[0.03] text-primary'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
        >
          <Stethoscope className={`h-4 w-4 mx-auto mb-1 ${disclosures.has_conditions === true ? 'text-primary' : 'text-gray-300'}`} />
          Yes, I have conditions
        </button>
      </div>

      {/* Condition chips + free text (shown when has_conditions is true) */}
      {disclosures.has_conditions === true && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-2 block">Quick select (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {CHRONIC_PRESETS.map((condition) => {
                const isSelected = disclosures.selected_conditions.includes(condition);
                return (
                  <button
                    key={condition}
                    type="button"
                    onClick={() => toggleCondition(condition)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {condition}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">
              Additional details or other conditions
            </Label>
            <textarea
              rows={3}
              placeholder="e.g., high blood pressure, cholesterol, hyperthyroid..."
              value={disclosures.free_text}
              onChange={(e) => onChange({ ...disclosures, free_text: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Step 4: Review & Submit ---------------------------------------------------

function Step4Review({
  riskNeeds,
  personalDetails,
  healthDisclosures,
  firstName,
  lastName,
  email,
  phone,
  onEdit,
}: {
  riskNeeds: RiskNeeds;
  personalDetails: PersonalDetails;
  healthDisclosures: HealthDisclosures;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  onEdit: (step: number) => void;
}) {
  const selectedCovers = COVER_OPTIONS.filter((c) => riskNeeds[c.id].selected);
  const maritalLabel = MARITAL_OPTIONS.find((o) => o.value === personalDetails.marital_status)?.label || personalDetails.marital_status;
  const smokerLabel = SMOKER_OPTIONS.find((o) => o.value === personalDetails.smoker_status)?.label || personalDetails.smoker_status;
  const qualLabel = QUALIFICATION_OPTIONS.find((o) => o.value === personalDetails.highest_qualification)?.label || personalDetails.highest_qualification || 'Not specified';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Review & Submit</h2>
        <p className="text-sm text-gray-500">Please review your details before submitting.</p>
      </div>

      {/* Contact */}
      <ReviewSection title="Contact Details" onEdit={() => {}}>
        <ReviewField label="Name" value={`${firstName} ${lastName}`} />
        <ReviewField label="Email" value={email} />
        <ReviewField label="Phone" value={phone} />
      </ReviewSection>

      {/* Covers */}
      <ReviewSection title="Risk Cover Requirements" onEdit={() => onEdit(1)}>
        {selectedCovers.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No covers selected</p>
        ) : (
          selectedCovers.map((cover) => {
            const entry = riskNeeds[cover.id];
            return (
              <ReviewField
                key={cover.id}
                label={cover.label}
                value={
                  entry.adviser_assist
                    ? 'Adviser assistance requested'
                    : entry.amount
                      ? `R ${entry.amount}${cover.isMonthly ? ' /month' : ''}`
                      : 'Amount not specified'
                }
              />
            );
          })
        )}
      </ReviewSection>

      {/* Personal */}
      <ReviewSection title="Personal & Financial Details" onEdit={() => onEdit(2)}>
        <ReviewField label="Occupation" value={personalDetails.occupation || 'Not specified'} />
        <ReviewField label="Gross monthly income" value={personalDetails.income_gross_monthly ? `R ${personalDetails.income_gross_monthly}` : 'Not specified'} />
        <ReviewField label="Net monthly income" value={personalDetails.income_net_monthly ? `R ${personalDetails.income_net_monthly}` : 'Not specified'} />
        <ReviewField label="Smoker status" value={smokerLabel || 'Not specified'} />
        <ReviewField label="Qualification" value={qualLabel} />
        <ReviewField label="Marital status" value={maritalLabel || 'Not specified'} />
        {needsSpouseIncome(personalDetails.marital_status) && (
          <ReviewField
            label="Spouse income"
            value={personalDetails.spouse_income_monthly ? `R ${personalDetails.spouse_income_monthly} /month` : 'Not specified'}
          />
        )}
      </ReviewSection>

      {/* Health */}
      <ReviewSection title="Chronic Conditions" onEdit={() => onEdit(3)}>
        {healthDisclosures.has_conditions === false ? (
          <p className="text-sm text-green-600 font-medium">No chronic conditions declared</p>
        ) : healthDisclosures.has_conditions === true ? (
          <div className="space-y-1">
            {healthDisclosures.selected_conditions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {healthDisclosures.selected_conditions.map((c) => (
                  <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                ))}
              </div>
            )}
            {healthDisclosures.free_text && (
              <p className="text-sm text-gray-600 italic">"{healthDisclosures.free_text}"</p>
            )}
            {healthDisclosures.selected_conditions.length === 0 && !healthDisclosures.free_text && (
              <p className="text-sm text-gray-400 italic">Conditions indicated but none specified</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Not answered</p>
        )}
      </ReviewSection>
    </div>
  );
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5">
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        {onEdit && (
          <button type="button" onClick={onEdit} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
            <Pencil className="h-3 w-3" /> Edit
          </button>
        )}
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 font-medium text-right ml-4">{value}</span>
    </div>
  );
}

// ---- Main wizard component ----------------------------------------------------

export function RiskQuoteWizard({
  firstName,
  lastName,
  email,
  phone,
  parentSubmissionId,
  onSuccess,
}: RiskQuoteWizardProps) {
  const navigate = useNavigate();

  // Load draft or init
  const draft = loadDraft();
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [riskNeeds, setRiskNeeds] = useState<RiskNeeds>(draft?.risk_needs ?? getInitialRiskNeeds());
  const [personalDetails, setPersonalDetails] = useState<PersonalDetails>(draft?.personal_details ?? getInitialPersonalDetails());
  const [healthDisclosures, setHealthDisclosures] = useState<HealthDisclosures>(draft?.health_disclosures ?? getInitialHealthDisclosures());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Persist draft on changes
  useEffect(() => {
    saveDraft({ risk_needs: riskNeeds, personal_details: personalDetails, health_disclosures: healthDisclosures, currentStep });
  }, [riskNeeds, personalDetails, healthDisclosures, currentStep]);

  // ---- Validation per step ----

  const step1Valid = useMemo(() => {
    const selected = COVER_OPTIONS.filter((c) => riskNeeds[c.id].selected);
    if (selected.length === 0) return false;
    return selected.every((c) => {
      const entry = riskNeeds[c.id];
      return entry.adviser_assist || parseCurrencyToNumber(entry.amount) > 0;
    });
  }, [riskNeeds]);

  const step2Valid = useMemo(() => {
    const d = personalDetails;
    if (!d.occupation.trim()) return false;
    if (!d.income_gross_monthly.trim()) return false;
    if (!d.income_net_monthly.trim()) return false;
    if (!d.smoker_status) return false;
    if (!d.marital_status) return false;
    if (needsSpouseIncome(d.marital_status) && !d.spouse_income_monthly.trim()) return false;
    return true;
  }, [personalDetails]);

  const step3Valid = useMemo(() => {
    return healthDisclosures.has_conditions !== null;
  }, [healthDisclosures]);

  const canProceed = currentStep === 1 ? step1Valid : currentStep === 2 ? step2Valid : currentStep === 3 ? step3Valid : true;

  // ---- Navigation ----

  const goNext = useCallback(() => {
    if (currentStep < 4) setCurrentStep((s) => s + 1);
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  // ---- Submit ----

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);

    try {
      // Build structured payload matching the Phase 2 spec
      const riskNeedsPayload: Record<string, unknown> = {};
      COVER_OPTIONS.forEach((c) => {
        const entry = riskNeeds[c.id];
        const base: Record<string, unknown> = {
          selected: entry.selected,
          adviser_assist: entry.adviser_assist,
        };
        if (c.isMonthly) {
          base.amount_per_month = entry.selected ? parseCurrencyToNumber(entry.amount) : null;
        } else {
          base.amount = entry.selected ? parseCurrencyToNumber(entry.amount) : null;
        }
        riskNeedsPayload[c.id] = base;
      });

      const personalPayload: Record<string, unknown> = {
        occupation: personalDetails.occupation,
        income_gross_monthly: parseCurrencyToNumber(personalDetails.income_gross_monthly),
        income_net_monthly: parseCurrencyToNumber(personalDetails.income_net_monthly),
        smoker_status: personalDetails.smoker_status,
        highest_qualification: personalDetails.highest_qualification,
        marital_status: personalDetails.marital_status,
      };
      if (needsSpouseIncome(personalDetails.marital_status)) {
        personalPayload.spouse_income_monthly = parseCurrencyToNumber(personalDetails.spouse_income_monthly);
      }

      const healthPayload = {
        has_conditions: healthDisclosures.has_conditions,
        selected_conditions: healthDisclosures.selected_conditions,
        free_text: healthDisclosures.free_text,
      };

      const productDetails = {
        phase: 2,
        risk_needs: riskNeedsPayload,
        personal_details: personalPayload,
        health_disclosures: healthPayload,
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
            productName: 'Risk Management',
            stage: 'full',
            service: 'risk-management',
            parentSubmissionId: parentSubmissionId ?? undefined,
            productDetails,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('Risk quote submission error:', result);
        toast.error(result.error || 'Something went wrong. Please try again.');
        return;
      }

      clearDraft();
      toast.success('Your risk quote request has been submitted!');
      onSuccess();
    } catch (error) {
      console.error('Risk quote network error:', error);
      toast.error('Unable to submit your request. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [firstName, lastName, email, phone, parentSubmissionId, riskNeeds, personalDetails, healthDisclosures, onSuccess]);

  // ---- Render ----

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={currentStep} />

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-5 sm:p-6">
          {currentStep === 1 && <Step1Covers riskNeeds={riskNeeds} onChange={setRiskNeeds} />}
          {currentStep === 2 && <Step2Personal details={personalDetails} onChange={setPersonalDetails} />}
          {currentStep === 3 && <Step3Health disclosures={healthDisclosures} onChange={setHealthDisclosures} />}
          {currentStep === 4 && (
            <Step4Review
              riskNeeds={riskNeeds}
              personalDetails={personalDetails}
              healthDisclosures={healthDisclosures}
              firstName={firstName}
              lastName={lastName}
              email={email}
              phone={phone}
              onEdit={goToStep}
            />
          )}
        </div>

        {/* Navigation footer */}
        <div className="border-t border-gray-100 px-5 sm:px-6 py-4 bg-gray-50/50 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={currentStep === 1 ? () => navigate('/get-quote/risk-management/contact') : goBack}
            className="h-11 px-5 border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? 'Back' : 'Previous'}
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