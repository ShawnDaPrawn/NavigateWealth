import type { FNAWizardStepNumber } from '../fna';

// ==================== WIZARD STEPS & TAX CONSTANTS ====================
// Moved to constants.ts — re-exported for backward compatibility
export { WIZARD_STEPS, TAX_YEAR_2026_2027 } from './constants';

/**
 * @deprecated Use TAX_YEAR_2026_2027 instead.
 */
export { TAX_YEAR_2024_2025 } from './constants';

// ==================== WIZARD STEP TYPE ====================

/** A step of the shared four-step FNA flow — the same type in every wizard. */
export type WizardStep = FNAWizardStepNumber;

// ==================== STEP 1: INPUTS ====================

export interface TaxPlanningInputs {
  // A) Client Profile (Prefilled/Confirmed)
  age: number;
  maritalStatus: 'single' | 'married_in_community' | 'married_out_community';
  taxResidency: 'resident' | 'non_resident' | 'dual';
  numberOfDependants: number; // For medical credits if needed

  // B) Income Streams (Raw, Gross, Annual)
  employmentIncome: number; // Code 3601
  variableIncome: number; // Commission, bonuses (Code 3606, etc.)
  businessIncome: number; // Code 3605
  rentalIncome: number; // Code 4201
  interestIncome: number; // Code 4202 (Local)
  dividendIncome: number; // Code 4204 (Local) - taxed at 20%
  foreignIncome: number; // General foreign income
  capitalGainsRealised: number; // Total gains for the year

  // C) Contributions & Allowances
  raContributions: number; // Own retirement annuity contributions (annual)
  tfsaContributionsLifetime: number; // Cumulative total
  medicalSchemeMembers: number; // Total members on scheme (Main + Dependant)

  // D) Optional refinements. Every one defaults to 0 / false, so FNAs saved
  // before these existed calculate exactly as they did.
  /**
   * Annual pension / provident fund contributions by the employee AND the
   * employer (including the employer-contribution fringe benefit). Shares the
   * single s11F limit with RA contributions.
   */
  employerFundContributions?: number;
  /** Allowable annual expenses against the gross rental income above. */
  rentalExpenses?: number;
  /** Allowable annual expenses against the gross business income above. */
  businessExpenses?: number;
  /** TFSA contributions already made in the current tax year. */
  tfsaContributionsThisYear?: number;
  /** Medical scheme contributions paid by the taxpayer this year (annual). */
  medicalSchemeContributions?: number;
  /** Qualifying medical expenses not recovered from the scheme (annual). */
  outOfPocketMedicalExpenses?: number;
  /** Taxpayer, spouse or child has a disability (s6B 33.3% rate). */
  hasDisability?: boolean;
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
  actualRADeduction: number; // The lesser of Cap vs Contribution
  taxableIncome: number; // Gross - Deductions + Taxable Interest

  // 4. Tax Liability
  incomeTaxBeforeRebates: number;
  primaryRebate: number;
  secondaryRebate: number;
  tertiaryRebate: number;
  medicalTaxCredits: number; // Section 6A medical scheme fees credit (annual)
  netIncomeTax: number;

  // 5. Special Taxes
  dividendTax: number;
  cgtPayable: number; // After exclusion and inclusion rate

  // 6. Totals
  totalTaxLiability: number;
  effectiveTaxRate: number; // Total Tax / Gross Income

  // 7. Gaps & Leakage (Math only)
  raGap: number; // Unused deduction capacity
  raTaxSavingPotential: number; // If gap was filled
  interestTaxLeakage: number; // Tax paid on interest above exemption
  tfsaRemainingLifetime: number;

  // 8. Refinements (added later — absent on FNAs published before them, so
  // every reader must treat them as optional).
  /** Rental + business expenses deducted from gross income. */
  allowableExpenses?: number;
  /** Total s11F contributions: RA + pension / provident (employee + employer). */
  totalRetirementContributions?: number;
  /** Base for the 27.5% s11F limit: greater of remuneration or taxable income. */
  retirementDeductionBase?: number;
  /** Contributions above the s11F limit, carried forward to later years. */
  nonDeductibleRetirementContributions?: number;
  /** Section 6B additional medical expenses tax credit (annual). */
  additionalMedicalTaxCredit?: number;
  /** Marginal rate on the final taxable income. */
  marginalRate?: number;
  /** TFSA capacity left this tax year (annual limit and lifetime limit). */
  tfsaRemainingThisYear?: number;
  /** What the calculation assumes or does not model for this client. */
  notes?: string[];
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
 * Standardised shape: { currentStep, inputs, calculations/results, adjustments }
 */
export interface TaxPlanningWizardState {
  currentStep: WizardStep;

  // Data State
  inputs: TaxPlanningInputs;
  adjustments: AdjustmentLog[];

  // Computed State
  baselineResults: TaxCalculationResults | null;
  adjustedResults: TaxCalculationResults | null;

  // Output State
  recommendations: TaxRecommendation[];
}
