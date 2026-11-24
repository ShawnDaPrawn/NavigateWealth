/**
 * Medical FNA (Financial Needs Analysis) Type Definitions
 * "Lightweight" Gap Analysis Version
 */

import type { FNAWizardStepNumber } from '../fna';

// ==================== WIZARD STEP TYPE ====================

/** A step of the shared four-step FNA flow — the same type in every wizard. */
export type WizardStep = FNAWizardStepNumber;

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
  /** Fallback LJP method: used only when creditableCoverageYearsAfter21 is absent. */
  yearsWithoutCoverAfter35: number;
  /**
   * Regulation 13 method: years of creditable SA medical scheme cover after
   * age 21. When present, penalty years = age − (35 + this).
   */
  creditableCoverageYearsAfter21?: number;
  /** Continuous medical scheme cover since before 1 April 2001 — exempt from LJP. */
  coveredBeforeApril2001?: boolean;

  /** Net monthly income, for the premium affordability check (optional). */
  netMonthlyIncome?: number;

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
  /** Absent on FNAs calculated before gap cover was assessed. */
  gapCover?: string;
  /** Present only when income and premium were both captured. */
  affordability?: string;
}

/** How the Late Joiner Penalty band was determined. */
export type LJPMethod = 'under-35' | 'exempt-pre-2001' | 'regulation-13' | 'years-without-cover';

export interface PremiumAffordability {
  netMonthlyIncome: number;
  monthlyPremium: number;
  /** Premium as a share of net monthly income (0.12 = 12%). */
  premiumToIncomeRatio: number;
  exceedsGuideline: boolean;
}

export interface MedicalFNAResults {
  recommendedDependents: string;
  recommendedInHospitalCover: string; // '100%' | '200%'
  msaRecommended: boolean;
  ljpBand: string; // '0%', '5%', '25%', '50%', '75%'
  rationale: MedicalFNARationale;

  // Added later — absent on FNAs published before them; readers must treat
  // them as optional.
  gapCoverRecommended?: boolean;
  ljpMethod?: LJPMethod;
  /** Penalty years used for the band (Regulation 13 or the fallback). */
  ljpPenaltyYears?: number;
  premiumAffordability?: PremiumAffordability;
}

// ==================== ADJUSTMENTS & FINAL TYPES ====================

export interface MedicalFNAAdjustments {
  // Overrides
  dependentsOverride?: string;
  hospitalCoverOverride?: string;
  msaOverride?: boolean;
  ljpBandOverride?: string;
  gapCoverOverride?: boolean;

  // Justification
  notes: string;
}

export interface MedicalFNAFinalNeeds {
  dependents: string;
  hospitalCover: string;
  msa: boolean;
  ljpBand: string;
  gapCover?: boolean;
}

// ==================== WIZARD STATE ====================

export interface MedicalFNAWizardState {
  currentStep: WizardStep;
  clientId?: string;
  clientName?: string;
  inputs: Partial<MedicalFNAInputs>;
  calculations: MedicalFNAResults | null;
  adjustments: MedicalFNAAdjustments;
}

/**
 * Persisted Medical FNA record (server-side session).
 * Mirrors the *Session shape used by sibling FNA modules.
 */
export interface MedicalFNASession {
  id: string;
  clientId: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  inputs: MedicalFNAInputs;
  adjustments: MedicalFNAAdjustments;
  results: MedicalFNAResults;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedBy?: string;
}

// Moved to constants.ts — re-exported for backward compatibility
export { WIZARD_STEPS } from './constants';
