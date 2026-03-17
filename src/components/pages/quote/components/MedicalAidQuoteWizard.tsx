/**
 * MedicalAidQuoteWizard -- Phase 2 Medical Aid "Get a Quote" Wizard
 *
 * A strict 4-step wizard + Review & Submit:
 *   Step 1: Members (Who needs cover? — ages/DOB + roles)
 *   Step 2: Preferences (Cover type, Network, Budget, Province)
 *   Step 3: Current Medical Aid History + LPJ (if main member age >= 35)
 *   Step 4: Health & Chronic Conditions (ask once, here only)
 *   Step 5: Review & Submit
 *
 * Hard rules:
 * - No employer sponsorship questions
 * - No income questions
 * - Health/chronic conditions asked once only (Step 4)
 * - LPJ question only if main member age >= 35
 * - All members must have DOB or age captured
 *
 * §7  — Presentation layer (UI only, no business logic)
 * §5.3 — Constants centralised below
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner@2.0.3';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Badge } from '../../../ui/badge';
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
  Stethoscope,
  ClipboardList,
  Users,
  HelpCircle,
  Loader2,
  Info,
  Pencil,
  Plus,
  Minus,
  MapPin,
  DollarSign,
  FileText,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';

// ── Constants (§5.3) ────────────────────────────────────────────────────────────

const DRAFT_KEY = 'nw_medical_aid_quote_draft';

const MEMBERSHIP_TYPES = [
  { value: 'main_only', label: 'Main member only' },
  { value: 'main_spouse', label: 'Main member + spouse/partner' },
  { value: 'family', label: 'Family (adults + children)' },
] as const;

const COVER_TYPES = [
  {
    value: 'hospital_only',
    label: 'Hospital-only',
    info: 'Covers in-hospital events and emergencies; limited day-to-day.',
  },
  {
    value: 'saver_day_to_day',
    label: 'Saver / day-to-day',
    info: 'Includes a savings-style benefit for GP, dentist, optometry and routine medication.',
  },
  {
    value: 'comprehensive',
    label: 'Comprehensive',
    info: 'Broader day-to-day benefits; higher premium.',
  },
  {
    value: 'not_sure',
    label: 'Not sure — adviser assistance',
    info: "We'll recommend based on your needs and budget.",
  },
] as const;

const NETWORK_OPTIONS = [
  { value: 'open_access', label: 'Any hospital/doctor (open access)' },
  { value: 'network', label: 'Network / designated providers (lower cost)' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

const BUDGET_BANDS = [
  { value: 'under_2500', label: 'Under R2,500' },
  { value: '2500_4000', label: 'R2,500–R4,000' },
  { value: '4000_6000', label: 'R4,000–R6,000' },
  { value: '6000_8500', label: 'R6,000–R8,500' },
  { value: '8500_plus', label: 'R8,500+' },
  { value: 'no_budget', label: 'No budget' },
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

const TENURE_ON_OPTIONS = [
  { value: 'less_3_months', label: 'Less than 3 months' },
  { value: '3_12_months', label: '3–12 months' },
  { value: '1_3_years', label: '1–3 years' },
  { value: '3_plus_years', label: '3+ years' },
] as const;

const TENURE_OFF_OPTIONS = [
  { value: 'less_3_months', label: 'Less than 3 months' },
  { value: '3_12_months', label: '3–12 months' },
  { value: '1_3_years', label: '1–3 years' },
  { value: '3_plus_years', label: '3+ years' },
  { value: 'never_had', label: 'Never had a South African medical aid' },
] as const;

const LPJ_OPTIONS = [
  { value: '0_months', label: '0 months (never off since 35)' },
  { value: 'less_3_months', label: 'Less than 3 months' },
  { value: '3_12_months', label: '3–12 months' },
  { value: '1_3_years', label: '1–3 years' },
  { value: '3_plus_years', label: '3+ years' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

const COMMON_SCHEMES = [
  'Bonitas',
  'Discovery Health',
  'Fedhealth',
  'GEMS',
  'Medihelp',
  'Medshield',
  'Momentum Health',
  'Old Mutual Health',
  'Profmed',
  'Sizwe Medical Fund',
  'Other',
] as const;

const CHRONIC_PRESETS = [
  'High blood pressure',
  'High cholesterol',
  'Diabetes',
  'Asthma',
  'Thyroid condition',
  'Depression/anxiety',
  'Other',
] as const;

// ── State types ─────────────────────────────────────────────────────────────────

interface MemberEntry {
  dob: string; // YYYY-MM-DD or empty
  age: string; // fallback if no DOB
}

interface MembersState {
  membership_type: string;
  main: MemberEntry;
  spouse: MemberEntry;
  children: MemberEntry[];
}

interface PreferencesState {
  cover_type: string;
  network: string;
  budget_band: string;
  province: string;
}

interface MedicalAidHistoryState {
  current_status: string; // 'currently_on' | 'not_currently_on' | ''
  current_scheme: string;
  current_plan: string;
  current_tenure_band: string;
  time_without_sa_medical_aid: string;
  lpj_time_off_since_35: string;
}

interface HealthState {
  has_chronic_conditions: boolean | null;
  selected_conditions: string[];
  applies_to_members: string[];
  notes: string;
}

interface WizardDraft {
  members: MembersState;
  preferences: PreferencesState;
  medical_aid_history: MedicalAidHistoryState;
  health: HealthState;
  currentStep: number;
}

// ── Props ───────────────────────────────────────────────────────────────────────

interface MedicalAidQuoteWizardProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  parentSubmissionId?: string;
  onSuccess: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function getInitialMembers(): MembersState {
  return {
    membership_type: '',
    main: { dob: '', age: '' },
    spouse: { dob: '', age: '' },
    children: [],
  };
}

function getInitialPreferences(): PreferencesState {
  return { cover_type: '', network: '', budget_band: '', province: '' };
}

function getInitialHistory(): MedicalAidHistoryState {
  return {
    current_status: '',
    current_scheme: '',
    current_plan: '',
    current_tenure_band: '',
    time_without_sa_medical_aid: '',
    lpj_time_off_since_35: '',
  };
}

function getInitialHealth(): HealthState {
  return { has_chronic_conditions: null, selected_conditions: [], applies_to_members: [], notes: '' };
}

function calcAge(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function getMainMemberAge(main: MemberEntry): number | null {
  const fromDob = calcAge(main.dob);
  if (fromDob !== null) return fromDob;
  if (main.age) {
    const n = parseInt(main.age, 10);
    return isNaN(n) ? null : n;
  }
  return null;
}

function hasMemberAge(m: MemberEntry): boolean {
  return Boolean(m.dob || m.age);
}

function displayAge(m: MemberEntry): string {
  const fromDob = calcAge(m.dob);
  if (fromDob !== null) return `${fromDob} years`;
  if (m.age) return `${m.age} years`;
  return 'Not provided';
}

function displayDob(m: MemberEntry): string {
  if (m.dob) {
    try {
      return new Date(m.dob).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return m.dob;
    }
  }
  return m.age ? `Age: ${m.age}` : 'Not provided';
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

/** Build list of member labels for the "applies to" multi-select in Step 4 */
function getMemberLabels(members: MembersState): string[] {
  const labels: string[] = ['Main'];
  if (members.membership_type === 'main_spouse' || members.membership_type === 'family') {
    labels.push('Spouse');
  }
  if (members.membership_type === 'family') {
    members.children.forEach((_, i) => labels.push(`Child ${i + 1}`));
  }
  return labels;
}

// ── Step Indicator ──────────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: 'Members', icon: Users },
    { num: 2, label: 'Preferences', icon: Shield },
    { num: 3, label: 'History', icon: FileText },
    { num: 4, label: 'Health', icon: Stethoscope },
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

// ── Step 1: Members ─────────────────────────────────────────────────────────────

function Step1Members({
  members,
  onChange,
}: {
  members: MembersState;
  onChange: (m: MembersState) => void;
}) {
  const updateMain = (field: keyof MemberEntry, value: string) => {
    onChange({ ...members, main: { ...members.main, [field]: value } });
  };

  const updateSpouse = (field: keyof MemberEntry, value: string) => {
    onChange({ ...members, spouse: { ...members.spouse, [field]: value } });
  };

  const updateChild = (index: number, field: keyof MemberEntry, value: string) => {
    const updated = [...members.children];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...members, children: updated });
  };

  const setMembershipType = (type: string) => {
    const next: MembersState = { ...members, membership_type: type };
    // Reset spouse/children if switching to simpler type
    if (type === 'main_only') {
      next.spouse = { dob: '', age: '' };
      next.children = [];
    } else if (type === 'main_spouse') {
      next.children = [];
    } else if (type === 'family' && next.children.length === 0) {
      next.children = [{ dob: '', age: '' }];
    }
    onChange(next);
  };

  const addChild = () => {
    onChange({ ...members, children: [...members.children, { dob: '', age: '' }] });
  };

  const removeChild = (index: number) => {
    const updated = members.children.filter((_, i) => i !== index);
    onChange({ ...members, children: updated.length > 0 ? updated : [{ dob: '', age: '' }] });
  };

  const showSpouse = members.membership_type === 'main_spouse' || members.membership_type === 'family';
  const showChildren = members.membership_type === 'family';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Who needs cover?</h2>
        <p className="text-sm text-gray-500">Tell us about everyone who needs to be on the medical aid.</p>
      </div>

      {/* Membership type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Membership type <span className="text-red-500">*</span>
        </Label>
        <div className="grid gap-2">
          {MEMBERSHIP_TYPES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMembershipType(opt.value)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                members.membership_type === opt.value
                  ? 'border-primary/50 bg-primary/[0.03]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                members.membership_type === opt.value ? 'border-primary' : 'border-gray-300'
              }`}>
                {members.membership_type === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-900">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main member */}
      {members.membership_type && (
        <div className="space-y-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Main member
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Date of birth (preferred)</Label>
              <Input
                type="date"
                value={members.main.dob}
                onChange={(e) => updateMain('dob', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="bg-white border-gray-300 h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Or age</Label>
              <Input
                type="number"
                min={0}
                max={120}
                placeholder="e.g. 34"
                value={members.main.age}
                onChange={(e) => updateMain('age', e.target.value)}
                className="bg-white border-gray-300 h-10"
                disabled={!!members.main.dob}
              />
            </div>
          </div>
        </div>
      )}

      {/* Spouse */}
      {showSpouse && (
        <div className="space-y-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Heart className="h-4 w-4 text-pink-500" />
            Spouse / Partner
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Date of birth (preferred)</Label>
              <Input
                type="date"
                value={members.spouse.dob}
                onChange={(e) => updateSpouse('dob', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="bg-white border-gray-300 h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Or age</Label>
              <Input
                type="number"
                min={0}
                max={120}
                placeholder="e.g. 32"
                value={members.spouse.age}
                onChange={(e) => updateSpouse('age', e.target.value)}
                className="bg-white border-gray-300 h-10"
                disabled={!!members.spouse.dob}
              />
            </div>
          </div>
        </div>
      )}

      {/* Children */}
      {showChildren && (
        <div className="space-y-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Children</h3>
            <Button type="button" variant="outline" size="sm" onClick={addChild} className="h-8 text-xs">
              <Plus className="h-3 w-3 mr-1" /> Add child
            </Button>
          </div>
          {members.children.map((child, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">Child {i + 1}</span>
                {members.children.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeChild(i)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">Date of birth</Label>
                  <Input
                    type="date"
                    value={child.dob}
                    onChange={(e) => updateChild(i, 'dob', e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="bg-white border-gray-300 h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">Or age</Label>
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    placeholder="e.g. 7"
                    value={child.age}
                    onChange={(e) => updateChild(i, 'age', e.target.value)}
                    className="bg-white border-gray-300 h-10"
                    disabled={!!child.dob}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step 2: Preferences ─────────────────────────────────────────────────────────

function Step2Preferences({
  preferences,
  onChange,
}: {
  preferences: PreferencesState;
  onChange: (p: PreferencesState) => void;
}) {
  const update = (field: keyof PreferencesState, value: string) => {
    onChange({ ...preferences, [field]: value });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">What kind of cover do you want?</h2>
        <p className="text-sm text-gray-500">Help us narrow down the best options for you.</p>
      </div>

      {/* Cover type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Cover type <span className="text-red-500">*</span>
        </Label>
        <div className="grid gap-2">
          {COVER_TYPES.map((ct) => (
            <button
              key={ct.value}
              type="button"
              onClick={() => update('cover_type', ct.value)}
              className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                preferences.cover_type === ct.value
                  ? 'border-primary/50 bg-primary/[0.03]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                preferences.cover_type === ct.value ? 'border-primary' : 'border-gray-300'
              }`}>
                {preferences.cover_type === ct.value && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-900">{ct.label}</span>
                <p className="text-xs text-gray-500 mt-0.5 flex items-start gap-1">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0 text-gray-400" />
                  {ct.info}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Network */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Network preference <span className="text-red-500">*</span>
        </Label>
        <div className="grid gap-2">
          {NETWORK_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('network', opt.value)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                preferences.network === opt.value
                  ? 'border-primary/50 bg-primary/[0.03]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                preferences.network === opt.value ? 'border-primary' : 'border-gray-300'
              }`}>
                {preferences.network === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-900">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Budget */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Monthly budget <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {BUDGET_BANDS.map((band) => (
            <button
              key={band.value}
              type="button"
              onClick={() => update('budget_band', band.value)}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                preferences.budget_band === band.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {band.label}
            </button>
          ))}
        </div>
      </div>

      {/* Province */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          Province <span className="text-red-500">*</span>
        </Label>
        <Select value={preferences.province} onValueChange={(v) => update('province', v)}>
          <SelectTrigger className="bg-white border-gray-300 h-11">
            <SelectValue placeholder="Select your province" />
          </SelectTrigger>
          <SelectContent>
            {SA_PROVINCES.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ── Step 3: Medical Aid History + LPJ ───────────────────────────────────────────

function Step3History({
  history,
  mainMemberAge,
  onChange,
}: {
  history: MedicalAidHistoryState;
  mainMemberAge: number | null;
  onChange: (h: MedicalAidHistoryState) => void;
}) {
  const update = (field: keyof MedicalAidHistoryState, value: string) => {
    onChange({ ...history, [field]: value });
  };

  const setStatus = (status: string) => {
    // Reset dependent fields when switching
    const next = { ...history, current_status: status };
    if (status === 'currently_on') {
      next.time_without_sa_medical_aid = '';
    } else {
      next.current_scheme = '';
      next.current_plan = '';
      next.current_tenure_band = '';
    }
    onChange(next);
  };

  const isCurrentlyOn = history.current_status === 'currently_on';
  const isNotCurrentlyOn = history.current_status === 'not_currently_on';
  const showLpj = mainMemberAge !== null && mainMemberAge >= 35;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Current medical aid history</h2>
        <p className="text-sm text-gray-500">This helps us determine the best options and any applicable waiting periods.</p>
      </div>

      {/* Current status */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Current cover status <span className="text-red-500">*</span>
        </Label>
        <div className="grid gap-2">
          {[
            { value: 'currently_on', label: 'I am currently on a South African medical aid' },
            { value: 'not_currently_on', label: 'I am not currently on a South African medical aid' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                history.current_status === opt.value
                  ? 'border-primary/50 bg-primary/[0.03]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                history.current_status === opt.value ? 'border-primary' : 'border-gray-300'
              }`}>
                {history.current_status === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-900">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* If currently on */}
      {isCurrentlyOn && (
        <div className="space-y-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Current scheme name <span className="text-red-500">*</span>
            </Label>
            <Select value={history.current_scheme} onValueChange={(v) => update('current_scheme', v)}>
              <SelectTrigger className="bg-white border-gray-300 h-11">
                <SelectValue placeholder="Select your scheme" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_SCHEMES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Current plan name <span className="text-red-500">*</span>
            </Label>
            <Input
              type="text"
              placeholder="e.g. Classic Saver"
              value={history.current_plan}
              onChange={(e) => update('current_plan', e.target.value)}
              className="bg-white border-gray-300 h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              How long have you been on this scheme? <span className="text-red-500">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {TENURE_ON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update('current_tenure_band', opt.value)}
                  className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                    history.current_tenure_band === opt.value
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
      )}

      {/* If not currently on */}
      {isNotCurrentlyOn && (
        <div className="space-y-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
          <Label className="text-sm font-medium text-gray-700">
            How long have you been without a South African medical aid? <span className="text-red-500">*</span>
          </Label>
          <div className="flex flex-wrap gap-2">
            {TENURE_OFF_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update('time_without_sa_medical_aid', opt.value)}
                className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                  history.time_without_sa_medical_aid === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* LPJ question — only if main member age >= 35 */}
      {showLpj && history.current_status && (
        <div className="space-y-3 p-4 rounded-xl bg-amber-50/60 border border-amber-200/60">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <Label className="text-sm font-medium text-gray-900">
                Since turning 35, how long in total have you been without a South African medical aid? <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-amber-700 mt-1">
                Some schemes apply late-joiner penalties if you join later in life after being without cover.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {LPJ_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update('lpj_time_off_since_35', opt.value)}
                className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                  history.lpj_time_off_since_35 === opt.value
                    ? 'border-amber-500 bg-amber-100 text-amber-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 4: Health & Chronic Conditions ──────────────────────────────────────────

function Step4Health({
  health,
  memberLabels,
  onChange,
}: {
  health: HealthState;
  memberLabels: string[];
  onChange: (h: HealthState) => void;
}) {
  const toggleCondition = (condition: string) => {
    const selected = health.selected_conditions.includes(condition)
      ? health.selected_conditions.filter((c) => c !== condition)
      : [...health.selected_conditions, condition];
    onChange({ ...health, selected_conditions: selected });
  };

  const toggleMember = (label: string) => {
    const selected = health.applies_to_members.includes(label)
      ? health.applies_to_members.filter((m) => m !== label)
      : [...health.applies_to_members, label];
    onChange({ ...health, applies_to_members: selected });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Health & chronic conditions</h2>
        <p className="text-sm text-gray-500">This helps us identify plans that cover chronic medication benefits.</p>
      </div>

      {/* Has chronic conditions */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Any diagnosed chronic conditions? <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: false, label: 'No' },
            { value: true, label: 'Yes' },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange({
                ...health,
                has_chronic_conditions: opt.value,
                // Reset if switching to No
                ...(opt.value === false ? { selected_conditions: [], applies_to_members: [], notes: '' } : {}),
              })}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                health.has_chronic_conditions === opt.value
                  ? 'border-primary/50 bg-primary/[0.03] text-gray-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Condition chips + member selection (only if Yes) */}
      {health.has_chronic_conditions === true && (
        <div className="space-y-4">
          {/* Condition chips */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Select conditions</Label>
            <div className="flex flex-wrap gap-2">
              {CHRONIC_PRESETS.map((condition) => {
                const isSelected = health.selected_conditions.includes(condition);
                return (
                  <button
                    key={condition}
                    type="button"
                    onClick={() => toggleCondition(condition)}
                    className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {isSelected && <CheckCircle className="h-3 w-3 inline mr-1.5" />}
                    {condition}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Free text */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Add details (optional)</Label>
            <Input
              type="text"
              placeholder="e.g. Controlled with medication"
              value={health.notes}
              onChange={(e) => onChange({ ...health, notes: e.target.value })}
              className="bg-white border-gray-300 h-10"
            />
          </div>

          {/* Which members */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Which member(s) does this apply to? <span className="text-red-500">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {memberLabels.map((label) => {
                const isSelected = health.applies_to_members.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleMember(label)}
                    className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {isSelected && <CheckCircle className="h-3 w-3 inline mr-1.5" />}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 5: Review & Submit ─────────────────────────────────────────────────────

function Step5Review({
  members,
  preferences,
  history,
  health,
  mainMemberAge,
  onEditStep,
}: {
  members: MembersState;
  preferences: PreferencesState;
  history: MedicalAidHistoryState;
  health: HealthState;
  mainMemberAge: number | null;
  onEditStep: (step: number) => void;
}) {
  const coverTypeLabel = COVER_TYPES.find((c) => c.value === preferences.cover_type)?.label ?? preferences.cover_type;
  const networkLabel = NETWORK_OPTIONS.find((n) => n.value === preferences.network)?.label ?? preferences.network;
  const budgetLabel = BUDGET_BANDS.find((b) => b.value === preferences.budget_band)?.label ?? preferences.budget_band;
  const membershipLabel = MEMBERSHIP_TYPES.find((m) => m.value === members.membership_type)?.label ?? members.membership_type;

  const showLpj = mainMemberAge !== null && mainMemberAge >= 35;

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
        <p className="text-sm text-gray-500">Please review your details before submitting your medical aid quote request.</p>
      </div>

      {/* Members */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Members" step={1} />
        <Row label="Membership type" value={membershipLabel} />
        <Row label="Main member" value={displayDob(members.main)} />
        {(members.membership_type === 'main_spouse' || members.membership_type === 'family') && (
          <Row label="Spouse / Partner" value={displayDob(members.spouse)} />
        )}
        {members.membership_type === 'family' && members.children.map((child, i) => (
          <Row key={i} label={`Child ${i + 1}`} value={displayDob(child)} />
        ))}
      </div>

      {/* Preferences */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Cover Preferences" step={2} />
        <Row label="Cover type" value={coverTypeLabel} />
        <Row label="Network" value={networkLabel} />
        <Row label="Monthly budget" value={budgetLabel} />
        <Row label="Province" value={preferences.province} />
      </div>

      {/* Medical aid history */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Medical Aid History" step={3} />
        <Row
          label="Current status"
          value={
            history.current_status === 'currently_on'
              ? 'Currently on a SA medical aid'
              : history.current_status === 'not_currently_on'
                ? 'Not currently on a SA medical aid'
                : '—'
          }
        />
        {history.current_status === 'currently_on' && (
          <div className="contents">
            <Row label="Scheme" value={history.current_scheme} />
            <Row label="Plan" value={history.current_plan} />
            <Row label="Tenure" value={TENURE_ON_OPTIONS.find((o) => o.value === history.current_tenure_band)?.label ?? '—'} />
          </div>
        )}
        {history.current_status === 'not_currently_on' && (
          <Row
            label="Time without medical aid"
            value={TENURE_OFF_OPTIONS.find((o) => o.value === history.time_without_sa_medical_aid)?.label ?? '—'}
          />
        )}
        {showLpj && (
          <Row
            label="Time off since age 35 (LPJ)"
            value={LPJ_OPTIONS.find((o) => o.value === history.lpj_time_off_since_35)?.label ?? '—'}
          />
        )}
      </div>

      {/* Health */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
        <SectionHeader title="Health & Chronic Conditions" step={4} />
        <Row
          label="Chronic conditions"
          value={
            health.has_chronic_conditions === null
              ? '—'
              : health.has_chronic_conditions
                ? 'Yes'
                : 'No'
          }
        />
        {health.has_chronic_conditions && (
          <div className="contents">
            <Row label="Conditions" value={health.selected_conditions.join(', ') || '—'} />
            <Row label="Applies to" value={health.applies_to_members.join(', ') || '—'} />
            {health.notes && <Row label="Notes" value={health.notes} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main wizard component ───────────────────────────────────────────────────────

export function MedicalAidQuoteWizard({
  firstName,
  lastName,
  email,
  phone,
  parentSubmissionId,
  onSuccess,
}: MedicalAidQuoteWizardProps) {
  // Load draft or init
  const draft = loadDraft();
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [members, setMembers] = useState<MembersState>(draft?.members ?? getInitialMembers());
  const [preferences, setPreferences] = useState<PreferencesState>(draft?.preferences ?? getInitialPreferences());
  const [history, setHistory] = useState<MedicalAidHistoryState>(draft?.medical_aid_history ?? getInitialHistory());
  const [health, setHealth] = useState<HealthState>(draft?.health ?? getInitialHealth());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Persist draft
  useEffect(() => {
    saveDraft({
      members,
      preferences,
      medical_aid_history: history,
      health,
      currentStep,
    });
  }, [members, preferences, history, health, currentStep]);

  // Derived values
  const mainMemberAge = useMemo(() => getMainMemberAge(members.main), [members.main]);
  const memberLabels = useMemo(() => getMemberLabels(members), [members]);

  // ── Validation per step ──

  const step1Valid = useMemo(() => {
    if (!members.membership_type) return false;
    if (!hasMemberAge(members.main)) return false;
    const showSpouse = members.membership_type === 'main_spouse' || members.membership_type === 'family';
    if (showSpouse && !hasMemberAge(members.spouse)) return false;
    if (members.membership_type === 'family') {
      if (members.children.length === 0) return false;
      if (members.children.some((c) => !hasMemberAge(c))) return false;
    }
    return true;
  }, [members]);

  const step2Valid = useMemo(() => {
    return Boolean(preferences.cover_type && preferences.network && preferences.budget_band && preferences.province);
  }, [preferences]);

  const step3Valid = useMemo(() => {
    if (!history.current_status) return false;
    if (history.current_status === 'currently_on') {
      if (!history.current_scheme || !history.current_plan || !history.current_tenure_band) return false;
    }
    if (history.current_status === 'not_currently_on') {
      if (!history.time_without_sa_medical_aid) return false;
    }
    // LPJ validation
    const showLpj = mainMemberAge !== null && mainMemberAge >= 35;
    if (showLpj && !history.lpj_time_off_since_35) return false;
    return true;
  }, [history, mainMemberAge]);

  const step4Valid = useMemo(() => {
    if (health.has_chronic_conditions === null) return false;
    if (health.has_chronic_conditions) {
      if (health.selected_conditions.length === 0) return false;
      if (health.applies_to_members.length === 0) return false;
    }
    return true;
  }, [health]);

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1: return step1Valid;
      case 2: return step2Valid;
      case 3: return step3Valid;
      case 4: return step4Valid;
      case 5: return true; // review — always can submit
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
      // Build structured payload matching the spec
      const membersPayload: Record<string, unknown> = {
        membership_type: MEMBERSHIP_TYPES.find((m) => m.value === members.membership_type)?.label ?? members.membership_type,
        main: { dob: members.main.dob || null, age: members.main.age ? parseInt(members.main.age, 10) : null },
      };

      if (members.membership_type === 'main_spouse' || members.membership_type === 'family') {
        membersPayload.spouse = { dob: members.spouse.dob || null, age: members.spouse.age ? parseInt(members.spouse.age, 10) : null };
      }

      if (members.membership_type === 'family') {
        membersPayload.children = members.children.map((c) => ({
          dob: c.dob || null,
          age: c.age ? parseInt(c.age, 10) : null,
        }));
      }

      const preferencesPayload = {
        cover_type: COVER_TYPES.find((c) => c.value === preferences.cover_type)?.label ?? preferences.cover_type,
        network: NETWORK_OPTIONS.find((n) => n.value === preferences.network)?.label ?? preferences.network,
        budget_band: BUDGET_BANDS.find((b) => b.value === preferences.budget_band)?.label ?? preferences.budget_band,
        province: preferences.province,
      };

      const historyPayload: Record<string, unknown> = {
        current_status: history.current_status === 'currently_on'
          ? 'I am currently on a South African medical aid'
          : history.current_status === 'not_currently_on'
            ? 'I am not currently on a South African medical aid'
            : '',
      };

      if (history.current_status === 'currently_on') {
        historyPayload.current_scheme = history.current_scheme;
        historyPayload.current_plan = history.current_plan;
        historyPayload.current_tenure_band = TENURE_ON_OPTIONS.find((o) => o.value === history.current_tenure_band)?.label ?? null;
      } else {
        historyPayload.current_scheme = null;
        historyPayload.current_plan = null;
        historyPayload.current_tenure_band = null;
      }

      if (history.current_status === 'not_currently_on') {
        historyPayload.time_without_sa_medical_aid = TENURE_OFF_OPTIONS.find((o) => o.value === history.time_without_sa_medical_aid)?.label ?? null;
      } else {
        historyPayload.time_without_sa_medical_aid = null;
      }

      const showLpj = mainMemberAge !== null && mainMemberAge >= 35;
      historyPayload.lpj_time_off_since_35 = showLpj
        ? (LPJ_OPTIONS.find((o) => o.value === history.lpj_time_off_since_35)?.label ?? null)
        : null;

      const healthPayload = {
        has_chronic_conditions: health.has_chronic_conditions,
        selected_conditions: health.selected_conditions,
        applies_to_members: health.applies_to_members,
        notes: health.notes,
      };

      const productDetails = {
        vertical: 'MedicalAid',
        phase: 2,
        members: membersPayload,
        preferences: preferencesPayload,
        medical_aid_history: historyPayload,
        health: healthPayload,
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
            productName: 'Medical Aid',
            stage: 'full',
            service: 'medical-aid',
            parentSubmissionId: parentSubmissionId ?? undefined,
            productDetails,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('Medical aid quote submission error:', result);
        toast.error(result.error || 'Something went wrong. Please try again.');
        return;
      }

      clearDraft();
      toast.success('Your medical aid quote request has been submitted!');
      onSuccess();
    } catch (error) {
      console.error('Medical aid quote network error:', error);
      toast.error('Unable to submit your request. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [firstName, lastName, email, phone, parentSubmissionId, members, preferences, history, health, mainMemberAge, onSuccess]);

  // ── Render ──

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={currentStep} />

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-5 sm:p-6">
          {currentStep === 1 && <Step1Members members={members} onChange={setMembers} />}
          {currentStep === 2 && <Step2Preferences preferences={preferences} onChange={setPreferences} />}
          {currentStep === 3 && <Step3History history={history} mainMemberAge={mainMemberAge} onChange={setHistory} />}
          {currentStep === 4 && <Step4Health health={health} memberLabels={memberLabels} onChange={setHealth} />}
          {currentStep === 5 && (
            <Step5Review
              members={members}
              preferences={preferences}
              history={history}
              health={health}
              mainMemberAge={mainMemberAge}
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
