// ==================== WIZARD STEPS & TAX CONSTANTS ====================
// Moved to constants.ts — re-exported for backward compatibility
export { WIZARD_STEPS, TAX_YEAR_2026_2027 } from './constants';

// ==================== WIZARD STEP TYPE ====================

/**
 * Standard 4-step wizard type — consistent across Risk, Retirement, Tax, Medical FNA modules.
 * Estate Planning and Investment INA use multi-step string-based workflows by design.
 */
export type WizardStep = 1 | 2 | 3 | 4;

// ==================== STEP 1: INPUTS ====================

export interface TaxPlanningInputs {
  // A) Client Profile (Prefilled/Confirmed)
  age: number;
  maritalStatus: 'single' | 'married_in_community' | 'married_out_community';
  taxResidency: 'resident' | 'non_resident' | 'dual';
  numberOfDependants: number; // For medical credits if needed

  // B) Income Streams (Raw, Gross, Annual)
  employmentIncome: number;    // Code 3601
  variableIncome: number;      // Commission, bonuses (Code 3606, etc.)
  businessIncome: number;      // Code 3605
  rentalIncome: number;        // Code 4201
  interestIncome: number;      // Code 4202 (Local)
  dividendIncome: number;      // Code 4204 (Local) - taxed at 20%
  foreignIncome: number;       // General foreign income
  capitalGainsRealised: number; // Total gains for the year

  // C) Contributions & Allowances
  raContributions: number;           // Current annual contribution
  tfsaContributionsLifetime: number; // Cumulative total
  medicalSchemeMembers: number;      // Total members on scheme (Main + Dependant)
}

// ==================== STEP 2: CALCULATION RESULTS ====================

export interface TaxCalculationResults {
  // 1. Income Base
  grossIncome: number; // Sum of taxable streams
  
  // 2. Exemptions
  interestExemption: number;
  taxableInterest: number;
  
  // 3. Deductions
  maxAllowedRADeduction: number; // The Cap
  actualRADeduction: number;     // The lesser of Cap vs Contribution
  taxableIncome: number;         // Gross - Deductions + Taxable Interest
  
  // 4. Tax Liability
  incomeTaxBeforeRebates: number;
  primaryRebate: number;
  secondaryRebate: number;
  tertiaryRebate: number;
  medicalTaxCredits: number;      // Section 6A medical scheme fees credit (annual)
  netIncomeTax: number;
  
  // 5. Special Taxes
  dividendTax: number;
  cgtPayable: number; // After exclusion and inclusion rate
  
  // 6. Totals
  totalTaxLiability: number;
  effectiveTaxRate: number; // Total Tax / Gross Income
  
  // 7. Gaps & Leakage (Math only)
  raGap: number;            // Unused deduction capacity
  raTaxSavingPotential: number; // If gap was filled
  interestTaxLeakage: number;   // Tax paid on interest above exemption
  tfsaRemainingLifetime: number;
}

// ==================== STEP 3: ADJUSTMENTS & SCENARIOS ====================

export interface AdjustmentLog {
  id: string;
  field: keyof TaxPlanningInputs;
  originalValue: number | string;
  newValue: number | string;
  reason: string;
  timestamp: Date;
}

export interface ScenarioComparison {
  baseline: TaxCalculationResults;
  adjusted: TaxCalculationResults;
  deltaTax: number; // adjusted - baseline
}

// ==================== STEP 4: RECOMMENDATIONS ====================

export interface TaxRecommendation {
  id: string;
  triggerType: 'RA_GAP' | 'INTEREST_LEAKAGE' | 'CGT_TIMING' | 'TFSA_CAPACITY' | 'FOREIGN_INCOME';
  title: string;
  description: string;
  impactValue: number; // e.g. R20,000 tax saving
  status: 'pending' | 'accepted' | 'rejected';
  adviserComment?: string;
}

export interface FinalTaxPlan {
  inputs: TaxPlanningInputs;
  adjustments: AdjustmentLog[];
  finalResults: TaxCalculationResults;
  recommendations: TaxRecommendation[];
  adviserNotes: string;
  generatedAt: string; // ISO Date
}

// ==================== STATE MANAGEMENT ====================

/**
 * Wizard State Management
 * Standardised shape: { currentStep, isPublishing, inputs, calculations/results, adjustments }
 */
export interface TaxPlanningWizardState {
  currentStep: WizardStep;
  isPublishing: boolean;
  
  // Data State
  inputs: TaxPlanningInputs;
  adjustments: AdjustmentLog[];
  
  // Computed State
  baselineResults: TaxCalculationResults | null;
  adjustedResults: TaxCalculationResults | null;
  
  // Output State
  recommendations: TaxRecommendation[];
}