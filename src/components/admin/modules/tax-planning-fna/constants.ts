/**
 * Tax Planning FNA Constants
 * Extracted from types.ts for module structure alignment (Phase 5)
 */

import { buildFNAWizardSteps } from '../fna';

// ==================== WIZARD STEPS ====================

/**
 * The shared four-step FNA flow with this wizard's step descriptions. Step
 * titles and order come from the fna module and are the same in every wizard.
 */
export const WIZARD_STEPS = buildFNAWizardSteps({
  1: 'Confirm client profile and income streams',
  2: 'Deterministic tax projection engine',
  3: 'Scenario modelling and overrides',
  4: 'Generate recommendations and advice',
});

// ==================== TAX CONSTANTS (2026/2027) ====================

export const TAX_YEAR_2026_2027 = {
  INTEREST_EXEMPTION_UNDER_65: 23800,
  INTEREST_EXEMPTION_OVER_65: 34500,
  RA_DEDUCTION_RATE: 0.275,
  RA_ANNUAL_CAP: 430000,
  TFSA_ANNUAL_LIMIT: 46000,
  TFSA_LIFETIME_LIMIT: 500000,
  CGT_ANNUAL_EXCLUSION: 50000,
  CGT_INCLUSION_RATE_INDIVIDUAL: 0.4,
  PRIMARY_RESIDENCE_EXCLUSION: 3000000,
  DIVIDEND_WITHHOLDING_RATE: 0.2,
  // Medical credits (monthly per member)
  MEDICAL_CREDIT_MAIN: 376,
  MEDICAL_CREDIT_FIRST_DEP: 376,
  MEDICAL_CREDIT_ADDITIONAL: 254,
  // Section 6B additional medical expenses tax credit
  S6B_RATE_UNDER_65: 0.25,
  S6B_RATE_65_OR_DISABLED: 0.333,
  S6B_CONTRIBUTION_MULTIPLE_UNDER_65: 4, // contributions above 4 × the s6A credit
  S6B_CONTRIBUTION_MULTIPLE_65_OR_DISABLED: 3, // contributions above 3 × the s6A credit
  S6B_TAXABLE_INCOME_THRESHOLD: 0.075, // under 65: only the excess over 7.5% of taxable income
  // Tax inside an individual-policyholder endowment wrapper
  ENDOWMENT_WRAPPER_RATE: 0.3,
};

/**
 * @deprecated Use TAX_YEAR_2026_2027 instead — kept for backward compatibility.
 */
export const TAX_YEAR_2024_2025 = {
  INTEREST_EXEMPTION_UNDER_65: 23800,
  INTEREST_EXEMPTION_OVER_65: 34500,
  RA_DEDUCTION_RATE: 0.275,
  RA_ANNUAL_CAP: 350000,
  TFSA_ANNUAL_LIMIT: 36000,
  TFSA_LIFETIME_LIMIT: 500000,
  CGT_ANNUAL_EXCLUSION: 40000,
  CGT_INCLUSION_RATE_INDIVIDUAL: 0.4,
  PRIMARY_RESIDENCE_EXCLUSION: 2000000,
  DIVIDEND_WITHHOLDING_RATE: 0.2,
  // Medical credits (monthly)
  MEDICAL_CREDIT_MAIN: 364,
  MEDICAL_CREDIT_FIRST_DEP: 364,
  MEDICAL_CREDIT_ADDITIONAL: 246,
};
