/**
 * Tax Planning FNA Constants
 * Extracted from types.ts for module structure alignment (Phase 5)
 */

// ==================== WIZARD STEPS ====================

export const WIZARD_STEPS = [
  {
    step: 1,
    title: 'Information Gathering',
    description: 'Confirm client profile and income streams'
  },
  {
    step: 2,
    title: 'System Auto-Calculation',
    description: 'Deterministic tax projection engine'
  },
  {
    step: 3,
    title: 'Adviser Manual Adjustment',
    description: 'Scenario modelling and overrides'
  },
  {
    step: 4,
    title: 'Finalise & Publish',
    description: 'Generate recommendations and advice'
  }
] as const;

// ==================== TAX CONSTANTS (2026/2027) ====================

export const TAX_YEAR_2026_2027 = {
  INTEREST_EXEMPTION_UNDER_65: 23800,
  INTEREST_EXEMPTION_OVER_65: 34500,
  RA_DEDUCTION_RATE: 0.275,
  RA_ANNUAL_CAP: 430000,
  TFSA_ANNUAL_LIMIT: 46000,
  TFSA_LIFETIME_LIMIT: 500000,
  CGT_ANNUAL_EXCLUSION: 50000,
  CGT_INCLUSION_RATE_INDIVIDUAL: 0.40,
  PRIMARY_RESIDENCE_EXCLUSION: 3000000,
  DIVIDEND_WITHHOLDING_RATE: 0.20,
  // Medical credits (monthly per member)
  MEDICAL_CREDIT_MAIN: 376,
  MEDICAL_CREDIT_FIRST_DEP: 376,
  MEDICAL_CREDIT_ADDITIONAL: 254,
};