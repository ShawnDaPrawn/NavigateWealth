/**
 * Risk Planning FNA System Constants
 *
 * The calculation constants (LIFE_COVER, DISABILITY_COVER, SEVERE_ILLNESS_COVER,
 * INCOME_PROTECTION, assumption defaults and the system version) live with the
 * calculation engine in src/shared/fna-calculations/riskPlanning.ts, which the
 * Edge Function shares, and are re-exported here. Since system version 3.0.0
 * the analysis is a capital needs analysis (present value of needs less
 * available assets), not income multiples — see that file for the method.
 * Constants stay explicit and auditable for FAIS compliance; change them there,
 * with tests, and bump RISK_SYSTEM_VERSION.
 */

import { buildFNAWizardSteps } from '../fna';
import type { OverrideClassification, IPBenefitPeriod, IPEscalationType } from './types';
import {
  LIFE_COVER,
  DISABILITY_COVER,
  SEVERE_ILLNESS_COVER,
  INCOME_PROTECTION,
  RISK_ASSUMPTION_DEFAULTS,
  RISK_SYSTEM_VERSION,
} from '../../../../shared/fna-calculations/riskPlanning';

export {
  LIFE_COVER,
  DISABILITY_COVER,
  SEVERE_ILLNESS_COVER,
  INCOME_PROTECTION,
  RISK_ASSUMPTION_DEFAULTS,
};

// ==================== OVERRIDE CLASSIFICATIONS ====================

export const OVERRIDE_CLASSIFICATIONS: readonly OverrideClassification[] = [
  'Affordability Constraint',
  'Client Specific Request',
  'Underwriting Limitation',
  'Self-Insured / Asset Base',
  'Incorrect Assumption',
  'Other',
] as const;

// ==================== COMPLIANCE DISCLAIMERS ====================

export const COMPLIANCE_DISCLAIMERS = [
  'Assumptions are estimates and not guarantees.',
  'Recommendations are subject to underwriting.',
  'Calculations are based on disclosed financial information.',
  'This analysis should be reviewed regularly or upon material life events.',
] as const;

// ==================== SYSTEM METADATA ====================

export const SYSTEM_VERSION = RISK_SYSTEM_VERSION; // FNA Risk Planning Tool Version (3.0.0)

// ==================== FORM DEFAULTS ====================

export const DEFAULT_FORM_VALUES = {
  grossMonthlyIncome: '',
  netMonthlyIncome: '',
  incomeEscalationAssumption: '6', // Default 6% escalation
  currentAge: '',
  retirementAge: '65', // Default retirement age
  employmentType: 'employed' as const,
  dependants: [],
  totalOutstandingDebts: '0', // Default to R0
  totalCurrentAssets: '0', // Default to R0
  estateWorth: '0', // Default to R0 (Net Worth from profile)
  spouseFullName: '',
  spouseAverageMonthlyIncome: '',
  totalHouseholdMonthlyExpenditure: '0', // Default to R0
  liquidAssetsAvailable: String(RISK_ASSUMPTION_DEFAULTS.LIQUID_ASSETS_AVAILABLE),

  // Calculation assumptions (3.0.0), as percentages
  investmentReturnAssumption: String(RISK_ASSUMPTION_DEFAULTS.INVESTMENT_RETURN),
  incomeReplacementRatio: String(RISK_ASSUMPTION_DEFAULTS.INCOME_REPLACEMENT_RATIO),
  disabilityIncomeReplacementRatio: String(
    RISK_ASSUMPTION_DEFAULTS.DISABILITY_INCOME_REPLACEMENT_RATIO,
  ),
  educationInflationAssumption: String(RISK_ASSUMPTION_DEFAULTS.EDUCATION_INFLATION),

  // Existing Cover Defaults (all zero)
  existingCoverLifePersonal: '0',
  existingCoverLifeGroup: '0',
  existingCoverDisabilityPersonal: '0',
  existingCoverDisabilityGroup: '0',
  existingCoverSevereIllnessPersonal: '0',
  existingCoverSevereIllnessGroup: '0',
  existingCoverIPTemporaryPersonal: '0',
  existingCoverIPTemporaryGroup: '0',
  existingCoverIPPermanentPersonal: '0',
  existingCoverIPPermanentGroup: '0',

  // Income Protection Settings Defaults
  ipTemporaryBenefitPeriod: '12-months' as IPBenefitPeriod,
  ipPermanentEscalation: 'cpi-linked' as IPEscalationType,
} as const;

// ==================== UI LABELS ====================

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  employed: 'Employed',
  'self-employed': 'Self-Employed',
} as const;

export const RELATIONSHIP_OPTIONS = [
  'Child',
  'Spouse',
  'Parent',
  'Sibling',
  'Dependent Adult',
  'Other',
] as const;

// ==================== VALIDATION RULES ====================

export const VALIDATION_RULES = {
  MIN_AGE: 18,
  MAX_AGE: 100,
  MIN_RETIREMENT_AGE: 50,
  MAX_RETIREMENT_AGE: 75,
  MIN_INCOME: 0,
  MAX_INCOME_ESCALATION: 100, // Percentage
  MIN_DEPENDANCY_TERM: 0,
  MAX_DEPENDANCY_TERM: 50, // Years
  MAX_ASSUMPTION_RATE: 30, // Percentage — return, escalation-style assumptions
  MAX_REPLACEMENT_RATIO: 100, // Percentage of net income
} as const;

// ==================== STEP CONFIGURATION ====================

/**
 * The shared four-step FNA flow with this wizard's step descriptions. Step
 * titles and order come from the fna module and are the same in every wizard.
 */
export const WIZARD_STEPS = buildFNAWizardSteps({
  1: 'Collect client financial and personal information',
  2: 'Review automated risk calculations',
  3: 'Apply Rand-value overrides if needed',
  4: 'Review and publish the FNA',
});

// ==================== QUERY KEYS ====================

export const QUERY_KEYS = {
  CLIENT_KEYS: (clientId: string) => ['client-keys', clientId] as const,
  CLIENT_PROFILE: (clientId: string) => ['risk-fna', 'client-profile', clientId] as const,
  FNA_LIST: (clientId: string) => ['risk-fna', 'list', clientId] as const,
  FNA_DETAIL: (id: string) => ['risk-fna', 'detail', id] as const,
  FNA_ALL: ['risk-fna'] as const,
};
