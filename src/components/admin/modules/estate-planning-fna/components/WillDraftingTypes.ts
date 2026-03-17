/**
 * Will Drafting Wizard — Type Definitions
 * Extracted from WillDraftingWizard.tsx for module boundary clarity (Guidelines S4.1)
 */

// ═══════════════════════════════════════════════════════
// Last Will Types
// ═══════════════════════════════════════════════════════

export interface PersonalDetails {
  fullName: string;
  idNumber: string;
  dateOfBirth: string;
  maritalStatus: 'single' | 'married_cop' | 'married_anc' | 'married_customary' | 'divorced' | 'widowed';
  spouseName?: string;
  spouseIdNumber?: string;
  physicalAddress: string;
}

export interface Beneficiary {
  id: string;
  name: string;
  idNumber: string;
  relationship: string;
  percentage: number;
}

export interface Guardian {
  id: string;
  name: string;
  idNumber: string;
  relationship: string;
  address: string;
}

export interface Executor {
  id: string;
  type: 'individual' | 'professional';
  name: string;
  idNumber?: string;
  company?: string;
  contactDetails: string;
}

export interface SpecificBequest {
  id: string;
  itemDescription: string;
  beneficiaryName: string;
  beneficiaryIdNumber: string;
}

export interface WillData {
  personalDetails: PersonalDetails;
  executors: Executor[];
  beneficiaries: Beneficiary[];
  guardians: Guardian[];
  specificBequests: SpecificBequest[];
  residueDistribution: 'equal' | 'specific';
  funeralWishes: string;
  additionalClauses: string;
}

// ═══════════════════════════════════════════════════════
// Living Will Types
// ═══════════════════════════════════════════════════════

export interface HealthcareAgent {
  id: string;
  name: string;
  idNumber: string;
  relationship: string;
  contactDetails: string;
  isPrimary: boolean;
}

export interface LivingWillData {
  personalDetails: PersonalDetails;
  healthcareAgents: HealthcareAgent[];
  lifeSustainingTreatment: {
    ventilator: 'accept' | 'refuse' | 'limited';
    cpr: 'accept' | 'refuse' | 'limited';
    artificialNutrition: 'accept' | 'refuse' | 'limited';
    dialysis: 'accept' | 'refuse' | 'limited';
    antibiotics: 'accept' | 'refuse' | 'limited';
    additionalInstructions: string;
  };
  painManagement: {
    comfortCareOnly: boolean;
    maximumPainRelief: boolean;
    additionalInstructions: string;
  };
  organDonation: {
    isDonor: boolean;
    donationType: 'all' | 'specific' | 'none';
    specificOrgans: string;
    additionalInstructions: string;
  };
  funeralWishes: string;
  additionalDirectives: string;
}

// ═══════════════════════════════════════════════════════
// Wizard Step Types
// ═══════════════════════════════════════════════════════

export type WizardStep =
  | 'personal-details'
  | 'executors'
  | 'beneficiaries'
  | 'guardians'
  | 'bequests'
  | 'funeral-wishes'
  | 'healthcare-agents'
  | 'life-sustaining'
  | 'pain-management'
  | 'organ-donation'
  | 'living-will-wishes'
  | 'review';

export interface WillDraftingWizardProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  onComplete: () => void;
  /** Will type -- defaults to 'last_will' */
  willType?: 'last_will' | 'living_will';
  /** If provided, the wizard loads this draft for editing (Resume Draft) */
  existingWillId?: string;
}

// ═══════════════════════════════════════════════════════
// Default State Factories
// ═══════════════════════════════════════════════════════

export const createDefaultWillData = (): WillData => ({
  personalDetails: {
    fullName: '',
    idNumber: '',
    dateOfBirth: '',
    maritalStatus: 'single',
    physicalAddress: '',
  },
  executors: [],
  beneficiaries: [],
  guardians: [],
  specificBequests: [],
  residueDistribution: 'equal',
  funeralWishes: '',
  additionalClauses: '',
});

export const createDefaultLivingWillData = (): LivingWillData => ({
  personalDetails: {
    fullName: '',
    idNumber: '',
    dateOfBirth: '',
    maritalStatus: 'single',
    physicalAddress: '',
  },
  healthcareAgents: [],
  lifeSustainingTreatment: {
    ventilator: 'refuse',
    cpr: 'refuse',
    artificialNutrition: 'refuse',
    dialysis: 'refuse',
    antibiotics: 'accept',
    additionalInstructions: '',
  },
  painManagement: {
    comfortCareOnly: true,
    maximumPainRelief: true,
    additionalInstructions: '',
  },
  organDonation: {
    isDonor: false,
    donationType: 'none',
    specificOrgans: '',
    additionalInstructions: '',
  },
  funeralWishes: '',
  additionalDirectives: '',
});
