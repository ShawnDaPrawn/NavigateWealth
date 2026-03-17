/**
 * Medical FNA (Financial Needs Analysis) Type Definitions
 * "Lightweight" Gap Analysis Version
 */

// ==================== WIZARD STEP TYPE ====================

/**
 * Standard 4-step wizard type — consistent across Risk, Retirement, Tax, Medical FNA modules.
 * Estate Planning and Investment INA use multi-step string-based workflows by design.
 */
export type WizardStep = 1 | 2 | 3 | 4;

// ==================== INPUT TYPES ====================

export interface MedicalFNAInputs {
  // A. Household
  spousePartner: boolean;
  childrenCount: number;
  adultDependantsCount: number;

  // B. Risk & Utilisation
  chronicPmbCount: number; // 0, 1, 2+
  plannedProcedures24m: boolean;
  specialistVisitFreq: '0-1' | '2-4' | '5+';
  providerChoicePreference: 'Network OK' | 'Any provider';

  // C. Day-to-day
  annualDayToDayEstimate: number;
  cashflowSensitivity: 'Low' | 'Medium' | 'High';

  // D. LJP
  currentAge: number;
  yearsWithoutCoverAfter35: number;

  // E. Existing Policy (Optional)
  existingPlanType?: string;
  existingTotalPremium?: number;
  existingMSA?: number;
  existingLJP?: number;
  existingHospitalCover?: string;
  existingDependents?: number;
}

// ==================== CALCULATION RESULT TYPES ====================

export interface MedicalFNARationale {
  hospital: string;
  msa: string;
  ljp: string;
  dependents: string;
}

export interface MedicalFNAResults {
  recommendedDependents: string;
  recommendedInHospitalCover: string; // '100%' | '200%'
  msaRecommended: boolean;
  ljpBand: string; // '0%', '5%', '25%', '50%', '75%'
  rationale: MedicalFNARationale;
}

// ==================== ADJUSTMENTS & FINAL TYPES ====================

export interface MedicalFNAAdjustments {
  // Overrides
  dependentsOverride?: string;
  hospitalCoverOverride?: string;
  msaOverride?: boolean;
  ljpBandOverride?: string;
  
  // Justification
  notes: string;
}

export interface MedicalFNAFinalNeeds {
  dependents: string;
  hospitalCover: string;
  msa: boolean;
  ljpBand: string;
}

// ==================== WIZARD STATE ====================

export interface MedicalFNAWizardState {
  currentStep: WizardStep;
  clientId?: string;
  clientName?: string;
  inputs: Partial<MedicalFNAInputs>;
  calculations: MedicalFNAResults | null;
  adjustments: MedicalFNAAdjustments;
  isPublishing: boolean;
}

// Moved to constants.ts — re-exported for backward compatibility
export { WIZARD_STEPS } from './constants';