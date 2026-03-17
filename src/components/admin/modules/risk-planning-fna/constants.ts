/**
 * Risk Planning FNA System Constants
 * 
 * ⚠️ CRITICAL: Do NOT change, optimize, or reinterpret these formulas
 * All constants are explicit and auditable for FAIS compliance
 * 
 * Mandatory Fix #1: Additional Income Multiple per Additional Dependant = +1×
 * Mandatory Fix #2: Insurable Maximum Guardrail (admin-configurable)
 * Mandatory Fix #3: Existing Cover Offset Rules
 */

import type { OverrideClassification, IPBenefitPeriod, IPEscalationType } from './types';

// ==================== LIFE COVER CONSTANTS ====================

export const LIFE_COVER = {
  // Immediate Capital Components
  FUNERAL_FINAL_EXPENSES: 100_000, // Default R100,000
  ESTATE_COSTS_PERCENTAGE: 0.0399, // 3.99% of estate
  
  // Income Multiple Rules
  MULTIPLES: {
    SINGLE_NO_DEPENDANTS: 5,
    MARRIED_YOUNG_CHILDREN_BASE: 10, // For 1 dependant
    SINGLE_INCOME_HOUSEHOLD_BASE: 14, // For 1 dependant
    ADDITIONAL_PER_DEPENDANT: 1, // Mandatory Fix #1
  },
} as const;

// ==================== DISABILITY COVER CONSTANTS ====================

export const DISABILITY_COVER = {
  // Additional Disability Cost Defaults
  HOME_MODIFICATIONS: 0, // User-provided or 0
  VEHICLE_ADAPTATION: 150_000, // Default R150,000
  MEDICAL_EQUIPMENT: 200_000, // Default R200,000
  ONCE_OFF_CARE_COSTS: 150_000, // Default R150,000
  
  // Disability Multiple Rules
  MULTIPLES: {
    ONE_DEPENDANT: 6,
    TWO_TO_FOUR_DEPENDANTS: 10,
    FIVE_PLUS_DEPENDANTS: 15,
  },
} as const;

// ==================== SEVERE ILLNESS COVER CONSTANTS ====================

export const SEVERE_ILLNESS_COVER = {
  // Income Bands and Multiples
  BANDS: [
    {
      minIncome: 0,
      maxIncome: 500_000,
      multiple: 2,
      label: 'R0 – R500,000 p.a.',
    },
    {
      minIncome: 500_001,
      maxIncome: 1_500_000,
      multiple: 3,
      label: 'R501,000 – R1,500,000 p.a.',
    },
    {
      minIncome: 1_500_001,
      maxIncome: Infinity,
      multiple: 5,
      label: 'R1,500,001+',
    },
  ],
} as const;

// ==================== INCOME PROTECTION CONSTANTS ====================

export const INCOME_PROTECTION = {
  // Benefit Calculation
  NET_INCOME_PERCENTAGE: 1.0, // 100% of Net Monthly Income
  
  // Insurable Maximum Guardrail (Mandatory Fix #2)
  // Admin-configurable field - this is the default
  DEFAULT_INSURABLE_MAXIMUM_MONTHLY: 150_000,
  
  // Warning Message
  EXCEEDS_LIMIT_WARNING: 'Calculated need exceeds typical insurer limits and may be restricted by underwriting.',
  
  // Benefit Periods (Temporary IP)
  BENEFIT_PERIODS: [
    { value: '6-months', label: '6 months' },
    { value: '12-months', label: '12 months' },
    { value: '24-months', label: '24 months' },
  ] as const,
  
  // Escalation Options (Permanent IP)
  ESCALATION_OPTIONS: [
    { value: 'fixed-1', label: 'Fixed 1%' },
    { value: 'fixed-2', label: 'Fixed 2%' },
    { value: 'fixed-3', label: 'Fixed 3%' },
    { value: 'fixed-4', label: 'Fixed 4%' },
    { value: 'fixed-5', label: 'Fixed 5%' },
    { value: 'cpi-linked', label: 'CPI-Linked' },
    { value: 'level', label: 'Level' },
  ] as const,
} as const;

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

export const SYSTEM_VERSION = '2.0.0'; // FNA Risk Planning Tool Version

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
} as const;

// ==================== STEP CONFIGURATION ====================

export const WIZARD_STEPS = [
  {
    step: 1,
    title: 'Information Gathering',
    description: 'Collect client financial and personal information',
  },
  {
    step: 2,
    title: 'System Auto-Calculation',
    description: 'Review automated risk calculations',
  },
  {
    step: 3,
    title: 'Adviser Manual Adjustment',
    description: 'Apply Rand-value overrides if needed',
  },
  {
    step: 4,
    title: 'Finalise & Publish',
    description: 'Review and publish the FNA',
  },
] as const;

// ==================== QUERY KEYS ====================

export const QUERY_KEYS = {
  CLIENT_KEYS: (clientId: string) => ['client-keys', clientId] as const,
  CLIENT_PROFILE: (clientId: string) => ['risk-fna', 'client-profile', clientId] as const,
  FNA_LIST: (clientId: string) => ['risk-fna', 'list', clientId] as const,
  FNA_DETAIL: (id: string) => ['risk-fna', 'detail', id] as const,
  FNA_ALL: ['risk-fna'] as const,
};