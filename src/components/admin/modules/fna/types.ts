/**
 * FNA (Financial Needs Analysis) Type Definitions
 * Risk Planning feature for Navigate Wealth Admin Portal
 */

// ==================== INPUT TYPES ====================

export interface FNADependant {
  name: string;
  dateOfBirth: string;
  age: number;
  relationship: string;
  financiallyDependent: boolean;
  expectedSupportEndAge: number; // When financial support will end
  financialDependencyPercent: number; // % of household income needed
}

export interface FNALiability {
  id: string;
  type: string; // 'bond', 'vehicle', 'personal loan', 'credit card', etc.
  name: string;
  outstandingBalance: number;
  remainingTermMonths?: number;
  settleOnDeath: boolean;
  settleOnDisability: boolean;
  settleOnSevereIllness: boolean;
  isSecuredAgainstProperty: boolean;
  isBusinessLoan: boolean;
}

export interface FNAAssets {
  emergencySavings: number;
  unitTrustsInvestments: number;
  discretionaryInvestments: number;
  otherLiquidAssets: number;
}

export interface FNAExistingCover {
  lifeCover: number; // Personal + Group
  severeCriticalIllnessCover: number; // Personal + Group CI
  capitalDisabilityCover: number; // Lump sum disability
  incomeProtectionMonthly: number; // Monthly benefit
}

export interface FNAAssumptions {
  // General Assumptions
  safeWithdrawalRate: number; // default 0.05 (5%)
  incomeReplacementYears: number; // Method A

  // Life Cover Specific
  finalExpensesEstimate: number;
  educationFundingTotal: number;
  estateCostsEstimate: number;
  annualIncomeNeededForDependants: number;

  // Lump Sum Disability Specific
  lifestyleModificationsCost: number;
  medicalAdaptationCost: number;
  annualIncomeRequiredIfDisabled: number;
  
  // Severe Illness Specific
  medicalShortfallsEstimate: number;
  lifestyleAdjustmentsCost: number;
  incomeGapMonthsUnableToWork: number;
  debtBufferPercentage: number; // 0.1 to 0.3

  // Income Protection Specific
  monthlyIncomeRequiredToMaintainLifestyle: number;

  // Legacy/Other (checking if we can reuse or deprecate)
  funeralAndFinalExpenses?: number; // Replaced by finalExpensesEstimate
  educationCapitalGoal?: number; // Replaced by educationFundingTotal
  onceOffBequests?: number; // Can be part of estate costs or kept separate
  targetIncomeReplacementPercent?: number; 
  incomeProtectionMaxPercentOfGross?: number;
  inflationRate: number;
  expectedInvestmentReturnRate: number;
  emergencyFundMonths: number;
  medicalGapMonths: number;
  lifestyleAdjustmentMonths: number;
  homeAdaptationMonths: number;
}

export interface FNAOverrides {
  lifeCoverRequiredOverride?: number;
  lifeCoverOverrideReason?: string;
  
  severeIllnessRequiredOverride?: number;
  severeIllnessOverrideReason?: string;
  
  disabilityCoverRequiredOverride?: number;
  disabilityCoverOverrideReason?: string;
  
  incomeProtectionRequiredMonthlyOverride?: number;
  incomeProtectionOverrideReason?: string;
}

export interface FNAInputs {
  // Personal & Household
  clientAge: number;
  expectedRetirementAge: number;
  maritalStatus: string;
  spouseName?: string;
  spouseDateOfBirth?: string;
  spouseAge?: number;
  spouseIncome: number;
  dependants: FNADependant[];

  // Income & Expenses
  grossMonthlyIncome: number;
  netMonthlyIncome: number;
  monthlyEssentialExpenses: number;
  monthlyTotalExpenses: number;
  monthlyRetirementSaving: number;

  // Liabilities
  liabilities: FNALiability[];
  totalDebt?: number; // Helper for calculation

  // Assets
  assets: FNAAssets;

  // Existing Cover
  existingCover: FNAExistingCover;

  // Assumptions
  assumptions: FNAAssumptions;
  
  // Overrides
  overrides: FNAOverrides;
  
  // Method selections
  lifeCoverMethod: 'years' | 'capitalisation';
  disabilityMethod: 'years' | 'capitalisation';
}

// ==================== CALCULATION RESULT TYPES ====================

export interface LifeCoverBreakdown {
  debt: number;
  finalExpenses: number;
  incomeReplacement: number;
  educationFunding: number;
  estateCosts: number;
  existingLifeCover: number;
  
  calculatedNeed: number;
  overrideNeed?: number;
  finalRecommendedNeed: number;
  shortfallSurplus: number;
}

export interface SevereIllnessBreakdown {
  medicalShortfalls: number;
  lifestyleAdjustments: number;
  incomeGap: number;
  debtBuffer: number;
  existingSevereIllnessCover: number;
  
  calculatedNeed: number;
  overrideNeed?: number;
  finalRecommendedNeed: number;
  shortfallSurplus: number;
}

export interface CapitalDisabilityBreakdown {
  debt: number;
  incomeCapitalisation: number;
  lifestyleModifications: number;
  medicalAdaptation: number;
  existingDisabilityCover: number;
  
  calculatedNeed: number;
  overrideNeed?: number;
  finalRecommendedNeed: number;
  shortfallSurplus: number;
}

export interface IncomeProtectionBreakdown {
  monthlyRequired: number;
  existingIP: number;
  
  calculatedNeed: number;
  overrideNeed?: number;
  finalRecommendedNeed: number;
  shortfallSurplus: number;
}

export interface FNAResults {
  lifeCover: LifeCoverBreakdown;
  severeIllness: SevereIllnessBreakdown;
  capitalDisability: CapitalDisabilityBreakdown;
  incomeProtection: IncomeProtectionBreakdown;
}

// ==================== FNA SESSION TYPES ====================

export type FNAStatus = 'draft' | 'published' | 'archived';

export interface FNASession {
  id: string;
  clientId: string;
  version: number;
  status: FNAStatus;
  inputs: FNAInputs;
  results: FNAResults;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedBy?: string;
}

// ==================== WIZARD STEP TYPES ====================

export type FNAWizardStep = 
  | 'personal'
  | 'income'
  | 'liabilities'
  | 'assets'
  | 'existing-cover'
  | 'assumptions'
  | 'review';

export interface FNAWizardState {
  currentStep: FNAWizardStep;
  completedSteps: FNAWizardStep[];
  inputs: Partial<FNAInputs>;
  errors: Record<string, string>;
}
