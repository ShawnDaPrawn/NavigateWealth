/**
 * What a medical aid quote is made of: the option lists, the state shapes, the
 * draft persistence, and the five steps.
 *
 * Split out of `MedicalAidQuoteWizard.tsx` (1,534 lines). No React here.
 */
import { ClipboardList, FileText, Shield, Stethoscope, Users } from 'lucide-react';
import { type WizardStep } from '../wizard/StepIndicator';

export const DRAFT_KEY = 'nw_medical_aid_quote_draft';

export const MEMBERSHIP_TYPES = [
  { value: 'main_only', label: 'Main member only' },
  { value: 'main_spouse', label: 'Main member + spouse/partner' },
  { value: 'family', label: 'Family (adults + children)' },
] as const;

export const COVER_TYPES = [
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

export const NETWORK_OPTIONS = [
  { value: 'open_access', label: 'Any hospital/doctor (open access)' },
  { value: 'network', label: 'Network / designated providers (lower cost)' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const BUDGET_BANDS = [
  { value: 'under_2500', label: 'Under R2,500' },
  { value: '2500_4000', label: 'R2,500–R4,000' },
  { value: '4000_6000', label: 'R4,000–R6,000' },
  { value: '6000_8500', label: 'R6,000–R8,500' },
  { value: '8500_plus', label: 'R8,500+' },
  { value: 'no_budget', label: 'No budget' },
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

export const TENURE_ON_OPTIONS = [
  { value: 'less_3_months', label: 'Less than 3 months' },
  { value: '3_12_months', label: '3–12 months' },
  { value: '1_3_years', label: '1–3 years' },
  { value: '3_plus_years', label: '3+ years' },
] as const;

export const TENURE_OFF_OPTIONS = [
  { value: 'less_3_months', label: 'Less than 3 months' },
  { value: '3_12_months', label: '3–12 months' },
  { value: '1_3_years', label: '1–3 years' },
  { value: '3_plus_years', label: '3+ years' },
  { value: 'never_had', label: 'Never had a South African medical aid' },
] as const;

export const LPJ_OPTIONS = [
  { value: '0_months', label: '0 months (never off since 35)' },
  { value: 'less_3_months', label: 'Less than 3 months' },
  { value: '3_12_months', label: '3–12 months' },
  { value: '1_3_years', label: '1–3 years' },
  { value: '3_plus_years', label: '3+ years' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const COMMON_SCHEMES = [
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

export const CHRONIC_PRESETS = [
  'High blood pressure',
  'High cholesterol',
  'Diabetes',
  'Asthma',
  'Thyroid condition',
  'Depression/anxiety',
  'Other',
] as const;

// ── State types ─────────────────────────────────────────────────────────────────

export interface MemberEntry {
  dob: string; // YYYY-MM-DD or empty
  age: string; // fallback if no DOB
}

export interface MembersState {
  membership_type: string;
  main: MemberEntry;
  spouse: MemberEntry;
  children: MemberEntry[];
}

export interface PreferencesState {
  cover_type: string;
  network: string;
  budget_band: string;
  province: string;
}

export interface MedicalAidHistoryState {
  current_status: string; // 'currently_on' | 'not_currently_on' | ''
  current_scheme: string;
  current_plan: string;
  current_tenure_band: string;
  time_without_sa_medical_aid: string;
  lpj_time_off_since_35: string;
}

export interface HealthState {
  has_chronic_conditions: boolean | null;
  selected_conditions: string[];
  applies_to_members: string[];
  notes: string;
}

export interface WizardDraft {
  members: MembersState;
  preferences: PreferencesState;
  medical_aid_history: MedicalAidHistoryState;
  health: HealthState;
  currentStep: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

export function getInitialMembers(): MembersState {
  return {
    membership_type: '',
    main: { dob: '', age: '' },
    spouse: { dob: '', age: '' },
    children: [],
  };
}

export function getInitialPreferences(): PreferencesState {
  return { cover_type: '', network: '', budget_band: '', province: '' };
}

export function getInitialHistory(): MedicalAidHistoryState {
  return {
    current_status: '',
    current_scheme: '',
    current_plan: '',
    current_tenure_band: '',
    time_without_sa_medical_aid: '',
    lpj_time_off_since_35: '',
  };
}

export function getInitialHealth(): HealthState {
  return {
    has_chronic_conditions: null,
    selected_conditions: [],
    applies_to_members: [],
    notes: '',
  };
}

export function calcAge(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function getMainMemberAge(main: MemberEntry): number | null {
  const fromDob = calcAge(main.dob);
  if (fromDob !== null) return fromDob;
  if (main.age) {
    const n = parseInt(main.age, 10);
    return isNaN(n) ? null : n;
  }
  return null;
}

export function hasMemberAge(m: MemberEntry): boolean {
  return Boolean(m.dob || m.age);
}

export function displayDob(m: MemberEntry): string {
  if (m.dob) {
    try {
      return new Date(m.dob).toLocaleDateString('en-ZA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return m.dob;
    }
  }
  return m.age ? `Age: ${m.age}` : 'Not provided';
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

/** Build list of member labels for the "applies to" multi-select in Step 4 */
export function getMemberLabels(members: MembersState): string[] {
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

/** This wizard's steps. The indicator itself is shared — see wizard/StepIndicator. */
export const WIZARD_STEPS: WizardStep[] = [
  { num: 1, label: 'Members', icon: Users },
  { num: 2, label: 'Preferences', icon: Shield },
  { num: 3, label: 'History', icon: FileText },
  { num: 4, label: 'Health', icon: Stethoscope },
  { num: 5, label: 'Review', icon: ClipboardList },
];

// ── Step 1: Members ─────────────────────────────────────────────────────────────
