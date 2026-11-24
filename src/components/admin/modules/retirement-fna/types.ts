/**
 * Retirement FNA (Financial Needs Analysis) Type Definitions
 * Retirement Planning feature for Navigate Wealth Admin Portal
 *
 * Design Philosophy:
 * - Clear separation between inputs, calculations, and adjustments
 * - Strict typing (no `any` types)
 * - Aligned with Risk Planning FNA patterns
 */

import type { FNAWizardStepNumber } from '../fna';
import type { RetirementEngineResults } from '../../../../shared/fna-calculations/retirement';

// ==================== WIZARD STEPS ====================
// Moved to constants.ts — re-exported for backward compatibility
export { WIZARD_STEPS } from './constants';

// ==================== WIZARD STEP TYPE ====================

/** A step of the shared four-step FNA flow — the same type in every wizard. */
export type WizardStep = FNAWizardStepNumber;

// ==================== INPUT TYPES (Step 1) ====================

/**
 * Step 1: Information Gathering Input
 * All fields must be collected or derived from client profile
 */
export interface RetirementFNAInputs {
  // Client Profile
  currentAge: number;
  retirementAge: number; // Intended retirement age

  // Current Financial Position
  currentMonthlyIncome: number; // Net (take-home) monthly income
  /**
   * Gross monthly income before tax — the basis of the replacement ratio.
   * Optional because records published before it was captured do not have it;
   * the engine then falls back to net income and says so.
   */
  currentGrossMonthlyIncome?: number;
  currentMonthlyContribution: number; // Total monthly retirement contributions (incl. employer)
  currentRetirementSavings: number; // Total current retirement capital

  // Other retirement provision (optional, default 0)
  /** Other capital earmarked for retirement, e.g. discretionary investments. */
  otherRetirementCapital?: number;
  /** Other guaranteed retirement income per month, in today's money. */
  otherMonthlyRetirementIncome?: number;

  // Optional / Advanced
  existingProducts?: Record<string, unknown>[]; // For audit trail if needed
}

// ==================== CALCULATION RESULTS (Step 2) ====================

/**
 * Step 2: System Auto-Calculation Results.
 *
 * The shape is owned by the shared engine (src/shared/fna-calculations), which
 * documents each field. Capital and income fields are NOMINAL (future rands)
 * unless their name ends in `Today`. Fields added in engine v2 are optional
 * because older published records do not carry them.
 */
export type RetirementCalculationResults = RetirementEngineResults;

// ==================== ADJUSTMENTS (Step 3) ====================

/**
 * Step 3: Adviser Manual Adjustments
 * Override standard assumptions if client circumstances warrant
 */
export interface RetirementFNAAdjustments {
  // Planning Assumptions
  retirementAge?: number; // Override intended retirement age
  yearsInRetirement?: number; // Override life expectancy assumption (default: 25 years)
  replacementRatio?: number; // Override income replacement ratio (default: 0.75)

  // Economic Assumptions (Nominal Rates)
  inflationRate?: number; // Override CPI assumption (default: 0.06)
  preRetirementReturn?: number; // Override pre-retirement growth (default: 0.10)
  postRetirementReturn?: number; // Override post-retirement growth (default: 0.08)
  salaryEscalation?: number; // Override salary escalation rate
  premiumEscalation?: number; // Override contribution escalation (default: follows salaryEscalation)

  // Documentation
  adviserNotes?: string; // Justification for adjustments
}

// ==================== STATE MANAGEMENT ====================

/**
 * Wizard State Management
 * Tracks current step and accumulated data throughout the FNA process.
 * Standardised shape: { currentStep, clientId, clientName, inputs, calculations, adjustments }
 */
export interface RetirementFNAWizardState {
  currentStep: WizardStep;
  clientId?: string;
  clientName?: string;
  inputs: Partial<RetirementFNAInputs>;
  adjustments: RetirementFNAAdjustments;
  calculations: RetirementCalculationResults | null;
  fnaId?: string; // If working with an existing draft
}

// ==================== PERSISTENCE ====================

/**
 * Persisted FNA Session
 * Stored in database for audit trail and resumption
 */
export interface RetirementFNASession {
  id: string;
  clientId: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  inputs: RetirementFNAInputs;
  adjustments: RetirementFNAAdjustments;
  results: RetirementCalculationResults;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedBy?: string;
}
