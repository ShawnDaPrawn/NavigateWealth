/**
 * Investment Needs Analysis (INA) Type Definitions
 * Goal-Based Investment Planning for Navigate Wealth Admin Portal
 */

import type { FNAWizardStepNumber } from '../fna';

// ==================== GOAL TYPES ====================

export type GoalType =
  | 'education'
  | 'home-deposit'
  | 'travel'
  | 'emigration'
  | 'wealth-creation'
  | 'business-funding'
  | 'sabbatical'
  | 'financial-freedom'
  | 'other';

export type PriorityLevel = 'low' | 'medium' | 'high';

export type GoalStatus =
  'on-track' | 'slight-shortfall' | 'moderate-shortfall' | 'significant-shortfall' | 'overfunded';

export interface InvestmentGoal {
  id: string;
  goalName: string;
  goalDescription?: string;
  goalType: GoalType;
  goalAmountToday: number; // Required capital in today's rands
  targetDate: string; // ISO date string
  targetYear: number;
  priorityLevel: PriorityLevel;

  // Funding details
  linkedInvestmentIds: string[]; // IDs of discretionary investments earmarked for this goal
  /**
   * investmentId → % of that investment earmarked for this goal (0–100).
   * Optional: an investment linked to several goals with no allocation is
   * split equally between them, so it is never counted in full twice.
   */
  linkedInvestmentAllocations?: Record<string, number>;
  currentContributionToGoal: number; // Monthly contribution towards this goal
  expectedLumpSums: LumpSumContribution[];

  // Risk profile
  useClientRiskProfile: boolean;
  goalSpecificRiskProfile?: RiskProfile;
}

export interface LumpSumContribution {
  id: string;
  amount: number;
  expectedDate: string; // ISO date string
  description?: string;
}

// ==================== RISK PROFILE TYPES ====================

export type RiskProfile = 'conservative' | 'moderate' | 'balanced' | 'growth' | 'aggressive';

export interface RiskProfileReturns {
  conservative: number;
  moderate: number;
  balanced: number;
  growth: number;
  aggressive: number;
}

// ==================== DISCRETIONARY INVESTMENT TYPES ====================

export interface DiscretionaryInvestment {
  id: string;
  productName: string;
  provider: string;
  currentValue: number;
  monthlyContribution: number;
  expectedDrawdownDate?: string;
  riskCategory?: RiskProfile;
  isDiscretionary: boolean; // Must be true to be included in INA
}

// ==================== INPUT TYPES ====================

export interface InvestmentINAInputs {
  // Personal Information (auto-populated)
  currentAge: number;
  dateOfBirth: string;
  householdDependants: number;
  grossMonthlyIncome: number;
  netMonthlyIncome: number;

  // Risk Profile
  clientRiskProfile: RiskProfile;

  // Economic Assumptions
  longTermInflationRate: number; // e.g., 0.06 for 6%
  expectedRealReturns: RiskProfileReturns; // Real returns after fees and inflation, by risk profile

  // Existing Discretionary Investments (auto-populated from Investments tab)
  discretionaryInvestments: DiscretionaryInvestment[];
  totalDiscretionaryCapitalCurrent: number;
  totalDiscretionaryMonthlyContributions: number;

  // Investment Goals
  goals: InvestmentGoal[];

  // Adviser review (Steps 3 and 4 of the wizard), stored with the inputs
  adviserAdjustments?: InvestmentINAAdviserAdjustments;
  adviserNotes?: string;
}

// ==================== CALCULATION RESULT TYPES ====================

export interface GoalTimeHorizon {
  targetYear: number;
  currentYear: number;
  yearsToGoal: number; // to one decimal (monthsToGoal ÷ 12) on newer results
  /** Whole months to the target date. Absent on results calculated before 2026-11. */
  monthsToGoal?: number;
  isValidTimeHorizon: boolean; // false if yearsToGoal <= 0
  warningMessage?: string;
}

export interface ExistingCapitalProjection {
  linkedInvestments: {
    investmentId: string;
    investmentName: string;
    currentValue: number;
    /** % of the investment earmarked for this goal (newer results only). */
    allocationPercent?: number;
    /** currentValue × allocationPercent — the part counted for this goal. */
    allocatedValue?: number;
    /** Linked to more than one goal. */
    isShared?: boolean;
    sharedWithGoalCount?: number;
    yearsToGoal: number;
    applicableRealReturn: number;
    futureValue: number;
  }[];
  totalExistingFutureValue: number;
}

export interface MonthlyContributionsProjection {
  monthlyContributionReal: number;
  yearsToGoal: number;
  monthsToGoal?: number;
  applicableRealReturn: number;
  annuityFactor: number;
  /** 'monthly' on newer results; older results used an annual approximation. */
  compounding?: 'monthly';
  futureValueOfContributions: number;
}

export interface LumpSumProjection {
  lumpSumId: string;
  lumpSumAmount: number;
  lumpSumDate: string;
  yearsFromLumpToGoal: number;
  applicableRealReturn: number;
  futureValue: number;
  /** Arrives after the target date, so it does not count (newer results). */
  arrivesAfterGoal?: boolean;
}

export interface ProjectedCapitalBreakdown {
  existingCapital: ExistingCapitalProjection;
  monthlyContributions: MonthlyContributionsProjection;
  lumpSums: LumpSumProjection[];
  totalLumpSumFutureValue: number;
  totalProjectedCapital: number;
}

export interface FundingGapAnalysis {
  goalRequiredReal: number; // Capital required at goal date (in today's rands)
  projectedCapitalAtGoal: number; // Total projected capital
  gapAmount: number; // Positive = shortfall, Negative = surplus
  hasShortfall: boolean;
  fundingPercentage: number; // (projected / required) * 100
  gapPercentage: number; // (gap / required) * 100
}

export interface RequiredContributions {
  currentMonthlyContribution: number;
  requiredAdditionalMonthly: number; // Extra monthly needed to close gap
  recommendedTotalMonthly: number; // Total monthly needed
  alternativeLumpSumToday: number; // One-time lump sum needed if no additional monthly
  canMeetGoal: boolean; // false if the horizon has passed or the budget cannot fund it
  canMeetGoalReason?: 'horizon' | 'affordability';
}

export interface GoalCalculationResult {
  goalId: string;
  goalName: string;
  goalType: GoalType;
  goalStatus: GoalStatus;
  statusRationale: string;

  timeHorizon: GoalTimeHorizon;
  projectedCapital: ProjectedCapitalBreakdown;
  fundingGap: FundingGapAnalysis;
  requiredContributions: RequiredContributions;

  applicableRiskProfile: RiskProfile;
  applicableRealReturn: number;

  priorityLevel?: PriorityLevel;
  /** The goal's own profile had no return, so the client's was used. */
  riskProfileNote?: string;
  /** The risk profile is too growth-oriented for the horizon (FAIS suitability). */
  suitabilityWarning?: string;
  suggestedRiskProfile?: RiskProfile;

  calculatedAt: string;
}

export interface GoalRecommendation {
  goalId: string;
  goalName: string;
  action: string;
  priority: PriorityLevel;
  impact: string;
  type?: 'funding' | 'affordability' | 'suitability' | 'timeline';
}

// ==================== AGGREGATE RESULTS ====================

export interface PortfolioSummary {
  totalGoals: number;
  totalRequiredCapital: number;
  totalProjectedCapital: number;
  totalFundingGap: number;
  totalAdditionalMonthlyRequired: number;

  goalsOnTrack: number;
  goalsUnderfunded: number;
  goalsOverfunded: number;

  overallPortfolioHealth: 'excellent' | 'good' | 'needs-attention' | 'critical';

  // Newer results only (calculated from 2026-11); older stored results lack them.
  /** Σ min(projected, required) ÷ Σ required × 100 — what the health is based on. */
  capitalWeightedFundingPercentage?: number;
  affordability?: INAAffordability;
  priorityFunding?: INAPriorityFundingRow[];
}

export interface INAAffordability {
  incomeBasis: 'gross' | 'net' | 'none';
  monthlyIncome: number;
  limitPercent: number;
  affordableMonthly: number | null;
  totalRecommendedMonthly: number;
  percentageOfIncome: number;
  isAffordable: boolean;
  warningMessage?: string;
}

export type INAPriorityFundingStatus =
  'fully-funded' | 'partially-funded' | 'not-funded' | 'horizon-passed' | 'not-assessed';

export interface INAPriorityFundingRow {
  goalId: string;
  goalName: string;
  priorityLevel: string;
  requiredMonthly: number;
  allocatedMonthly: number;
  cumulativeMonthly: number;
  fundingStatus: INAPriorityFundingStatus;
  projectedFundingPercentage: number;
}

export interface InvestmentINAResults {
  portfolioSummary: PortfolioSummary;
  goalResults: GoalCalculationResult[];
  recommendations: GoalRecommendation[];
  economicAssumptions: {
    inflationRate: number;
    realReturnsByProfile: RiskProfileReturns;
    realReturnBasis?: 'after fees and inflation';
  };
  /** The basis of the numbers, as sentences (newer results only). */
  assumptions?: string[];
  calculatedAt: string;
}

// ==================== INA SESSION TYPES ====================

export type InvestmentINAStatus = 'draft' | 'published' | 'archived';

export interface InvestmentINASession {
  id: string;
  clientId: string;
  version: number;
  status: InvestmentINAStatus;
  inputs: InvestmentINAInputs;
  results: InvestmentINAResults | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedBy?: string;
}

// ==================== WIZARD STEP TYPES ====================

/**
 * The INA runs the shared four-step FNA flow like every other analysis
 * (see fna/wizard/fnaWizardFlow.ts). Its Step 3 is an assumption override:
 * the adviser may replace the client's risk profile or the economic
 * assumptions, with a recorded reason.
 */
export type WizardStep = FNAWizardStepNumber;

type INAAdjustableInputs = Pick<
  InvestmentINAInputs,
  'clientRiskProfile' | 'longTermInflationRate' | 'expectedRealReturns'
>;

export interface InvestmentINAAdviserAdjustments {
  /** Only the values the adviser changed. */
  overrides: Partial<INAAdjustableInputs>;
  /** What the system used, kept for the audit trail once overrides apply. */
  systemValues?: Partial<INAAdjustableInputs>;
  reason: string;
}

// ==================== HELPER TYPES ====================

export interface DefaultEconomicAssumptions {
  longTermInflationRate: number;
  expectedRealReturns: RiskProfileReturns;
}

// Moved to constants.ts — re-exported for backward compatibility
export { DEFAULT_ECONOMIC_ASSUMPTIONS, GOAL_TYPE_LABELS, RISK_PROFILE_LABELS } from './constants';
