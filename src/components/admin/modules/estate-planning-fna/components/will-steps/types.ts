/**
 * Will Drafting Step Components — Prop Interfaces
 * Centralised prop definitions for each step component.
 * Guidelines §5.2 — types as documentation and contracts.
 */

import type {
  PersonalDetails,
  Executor,
  Beneficiary,
  Guardian,
  SpecificBequest,
  HealthcareAgent,
  WillData,
  LivingWillData,
} from '../WillDraftingTypes';

// ═══════════════════════════════════════════════════════
// Shared Steps
// ═══════════════════════════════════════════════════════

export interface StepPersonalDetailsProps {
  personalDetails: PersonalDetails;
  onUpdate: (field: keyof PersonalDetails, value: string) => void;
}

// ═══════════════════════════════════════════════════════
// Last Will Steps
// ═══════════════════════════════════════════════════════

export interface StepExecutorsProps {
  executors: Executor[];
  onAdd: () => void;
  onUpdate: (id: string, field: keyof Executor, value: string) => void;
  onRemove: (id: string) => void;
}

export interface StepBeneficiariesProps {
  beneficiaries: Beneficiary[];
  beneficiaryTotal: number;
  onAdd: () => void;
  onUpdate: (id: string, field: keyof Beneficiary, value: string | number) => void;
  onRemove: (id: string) => void;
}

export interface StepGuardiansProps {
  guardians: Guardian[];
  onAdd: () => void;
  onUpdate: (id: string, field: keyof Guardian, value: string) => void;
  onRemove: (id: string) => void;
}

export interface StepBequestsProps {
  bequests: SpecificBequest[];
  onAdd: () => void;
  onUpdate: (id: string, field: keyof SpecificBequest, value: string) => void;
  onRemove: (id: string) => void;
}

export interface StepFuneralWishesProps {
  funeralWishes: string;
  additionalClauses: string;
  onUpdate: (field: 'funeralWishes' | 'additionalClauses', value: string) => void;
}

// ═══════════════════════════════════════════════════════
// Living Will Steps
// ═══════════════════════════════════════════════════════

export interface StepHealthcareAgentsProps {
  agents: HealthcareAgent[];
  onAdd: () => void;
  onUpdate: (id: string, field: string, value: string | boolean) => void;
  onRemove: (id: string) => void;
}

export interface StepLifeSustainingProps {
  treatment: LivingWillData['lifeSustainingTreatment'];
  onTreatmentChange: (treatment: string, option: 'accept' | 'refuse' | 'limited') => void;
  onInstructionsChange: (instructions: string) => void;
}

export interface StepPainManagementProps {
  painManagement: LivingWillData['painManagement'];
  onToggle: (field: 'comfortCareOnly' | 'maximumPainRelief', value: boolean) => void;
  onInstructionsChange: (instructions: string) => void;
}

export interface StepOrganDonationProps {
  organDonation: LivingWillData['organDonation'];
  onDonorChange: (isDonor: boolean) => void;
  onTypeChange: (type: 'all' | 'specific' | 'none') => void;
  onSpecificOrgansChange: (organs: string) => void;
  onInstructionsChange: (instructions: string) => void;
}

export interface StepLivingWillWishesProps {
  funeralWishes: string;
  additionalDirectives: string;
  onUpdate: (field: 'funeralWishes' | 'additionalDirectives', value: string) => void;
}

// ═══════════════════════════════════════════════════════
// Review Steps
// ═══════════════════════════════════════════════════════

export interface StepReviewLastWillProps {
  personalDetails: PersonalDetails;
  executors: Executor[];
  beneficiaries: Beneficiary[];
  beneficiaryTotal: number;
  guardians: Guardian[];
  specificBequests: SpecificBequest[];
  funeralWishes: string;
  additionalClauses: string;
}

export interface StepReviewLivingWillProps {
  personalDetails: PersonalDetails;
  livingWillData: LivingWillData;
}
