/**
 * Retirement FNA (Financial Needs Analysis) Type Definitions
 * Retirement Planning feature for Navigate Wealth Admin Portal
 * 
 * Design Philosophy:
 * - Clear separation between inputs, calculations, and adjustments
 * - Strict typing (no `any` types)
 * - Aligned with Risk Planning FNA patterns
 */

import { User, PiggyBank, Target, TrendingUp, Calculator, CheckCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ==================== WIZARD STEPS ====================
// Moved to constants.ts — re-exported for backward compatibility
export { WIZARD_STEPS } from './constants';

// ==================== WIZARD STEP TYPE ====================

/**
 * Standard 4-step wizard type — consistent across Risk, Retirement, Tax, Medical FNA modules.
 * Estate Planning and Investment INA use multi-step string-based workflows by design.
 */
export type WizardStep = 1 | 2 | 3 | 4;

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
  currentMonthlyIncome: number;      // Net monthly income
  currentMonthlyContribution: number; // Total monthly retirement contributions
  currentRetirementSavings: number;   // Total current retirement capital
  
  // Optional / Advanced
  existingProducts?: Record<string, unknown>[]; // For audit trail if needed
}

// ==================== CALCULATION RESULTS (Step 2) ====================

/**
 * Step 2: System Auto-Calculation Results
 * All values calculated based on standard actuarial assumptions
 */
export interface RetirementCalculationResults {
  // Timeline
  yearsToRetirement: number;
  yearsInRetirement: number;
  
  // Real Rates (Inflation-adjusted)
  realGrowthRate: number;       // Pre-retirement real growth
  realSalaryGrowth: number;     // Real salary escalation
  
  // Capital Requirements (Real Terms)
  targetMonthlyIncome: number;  // Required monthly income in retirement (today's value)
  requiredCapital: number;      // Total capital required at retirement
  projectedCapital: number;     // Projected capital at retirement with current contributions
  
  // Gap Analysis
  capitalShortfall: number;     // Difference between required and projected
  hasShortfall: boolean;        // True if shortfall exists
  shortfallPercentage: number;  // Percentage shortfall
  
  // Recommendations
  requiredAdditionalContribution: number; // Additional monthly contribution needed
  totalRecommendedContribution: number;   // Total recommended monthly contribution
  percentageOfIncome: number;             // Contribution as % of income
}

// ==================== ADJUSTMENTS (Step 3) ====================

/**
 * Step 3: Adviser Manual Adjustments
 * Override standard assumptions if client circumstances warrant
 */
export interface RetirementFNAAdjustments {
  // Planning Assumptions
  retirementAge?: number;       // Override intended retirement age
  yearsInRetirement?: number;   // Override life expectancy assumption (default: 25 years)
  replacementRatio?: number;    // Override income replacement ratio (default: 0.75)
  
  // Economic Assumptions (Nominal Rates)
  inflationRate?: number;            // Override CPI assumption (default: 0.06)
  preRetirementReturn?: number;      // Override pre-retirement growth (default: 0.10)
  postRetirementReturn?: number;     // Override post-retirement growth (default: 0.08)
  salaryEscalation?: number;         // Override salary escalation rate
  premiumEscalation?: number;        // Override premium escalation rate (default: 0.06)
  
  // Documentation
  adviserNotes?: string; // Justification for adjustments
}

// ==================== STATE MANAGEMENT ====================

/**
 * Wizard State Management
 * Tracks current step and accumulated data throughout the FNA process.
 * Standardised shape: { currentStep, clientId, clientName, inputs, calculations, adjustments, isPublishing }
 */
export interface RetirementFNAWizardState {
  currentStep: WizardStep;
  clientId?: string;
  clientName?: string;
  inputs: Partial<RetirementFNAInputs>;
  adjustments: RetirementFNAAdjustments;
  calculations: RetirementCalculationResults | null;
  isPublishing: boolean;
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