/**
 * What a will draft is made of: its field shapes, the six steps, and the two
 * pure helpers over them.
 *
 * Split out of `WillDraftingFlow.tsx` (1,605 lines). No React here — these are
 * the definitions the flow and each of its step components share.
 */
import { FileText, Gift, Heart, Shield, User, Users } from 'lucide-react';

export const SITE_SHELL = 'w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface ClientDetails {
  name: string;
  surname: string;
  email: string;
  cellphone: string;
}

export interface WillDraftingFlowProps {
  clientDetails: ClientDetails;
  onComplete: () => void;
  onBack: () => void;
}

export interface PersonalInfo {
  firstName: string;
  surname: string;
  idNumber: string;
  dateOfBirth: string;
  maritalStatus: string;
  spouseName: string;
  address: string;
  email: string;
  cellphone: string;
}

export interface Executor {
  fullName: string;
  idNumber: string;
  relationship: string;
  cellphone: string;
  email: string;
}

export interface Beneficiary {
  id: string;
  fullName: string;
  idNumber: string;
  relationship: string;
  sharePercentage: number;
  isAlternate: boolean;
}

export interface Guardian {
  id: string;
  fullName: string;
  relationship: string;
  cellphone: string;
  isAlternate: boolean;
}

export interface SpecialBequest {
  id: string;
  description: string;
  beneficiaryName: string;
  conditions: string;
}

// ═══════════════════════════════════════════════════════════════════
// STEP DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

export const STEPS = [
  { id: 1, label: 'Personal Details', icon: User, description: 'Your personal information' },
  { id: 2, label: 'Executor', icon: Shield, description: 'Appoint your executor' },
  { id: 3, label: 'Beneficiaries', icon: Users, description: 'Who inherits your estate' },
  { id: 4, label: 'Guardianship', icon: Heart, description: 'Guardians for minor children' },
  { id: 5, label: 'Special Bequests', icon: Gift, description: 'Specific gifts & wishes' },
  { id: 6, label: 'Review & Submit', icon: FileText, description: 'Review and save your draft' },
] as const;

export const MARITAL_OPTIONS = [
  'Single',
  'Married in Community of Property',
  'Married out of Community of Property (with Accrual)',
  'Married out of Community of Property (without Accrual)',
  'Divorced',
  'Widowed',
  'Civil Union',
  'Customary Marriage',
];

export const RELATIONSHIP_OPTIONS = [
  'Spouse',
  'Son',
  'Daughter',
  'Child',
  'Grandchild',
  'Parent',
  'Sibling',
  'Niece/Nephew',
  'Friend',
  'Charity/Organisation',
  'Trust',
  'Other',
];

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function totalSharePercentage(beneficiaries: Beneficiary[]): number {
  return beneficiaries
    .filter((b) => !b.isAlternate)
    .reduce((sum, b) => sum + (b.sharePercentage || 0), 0);
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════
