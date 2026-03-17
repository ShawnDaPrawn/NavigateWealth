/**
 * Investment Needs Analysis (INA) Type Definitions
 * Goal-Based Investment Planning for Navigate Wealth Admin Portal
 */

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

export type GoalStatus = 'on-track' | 'slight-shortfall' | 'moderate-shortfall' | 'significant-shortfall' | 'overfunded';

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
  expectedRealReturns: RiskProfileReturns; // Real returns after inflation by risk profile
  
  // Existing Discretionary Investments (auto-populated from Investments tab)
  discretionaryInvestments: DiscretionaryInvestment[];
  totalDiscretionaryCapitalCurrent: number;
  totalDiscretionaryMonthlyContributions: number;
  
  // Investment Goals
  goals: InvestmentGoal[];
}

// ==================== CALCULATION RESULT TYPES ====================

export interface GoalTimeHorizon {
  targetYear: number;
  currentYear: number;
  yearsToGoal: number;
  isValidTimeHorizon: boolean; // false if yearsToGoal <= 0
  warningMessage?: string;
}

export interface ExistingCapitalProjection {
  linkedInvestments: {
    investmentId: string;
    investmentName: string;
    currentValue: number;
    yearsToGoal: number;
    applicableRealReturn: number;
    futureValue: number;
  }[];
  totalExistingFutureValue: number;
}

export interface MonthlyContributionsProjection {
  monthlyContributionReal: number;
  yearsToGoal: number;
  applicableRealReturn: number;
  annuityFactor: number;
  futureValueOfContributions: number;
}

export interface LumpSumProjection {
  lumpSumId: string;
  lumpSumAmount: number;
  lumpSumDate: string;
  yearsFromLumpToGoal: number;
  applicableRealReturn: number;
  futureValue: number;
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
  canMeetGoal: boolean; // false if time horizon too short or return too low
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
  
  calculatedAt: string;
}

export interface GoalRecommendation {
  goalId: string;
  goalName: string;
  action: string;
  priority: PriorityLevel;
  impact: string;
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
}

export interface InvestmentINAResults {
  portfolioSummary: PortfolioSummary;
  goalResults: GoalCalculationResult[];
  recommendations: GoalRecommendation[];
  economicAssumptions: {
    inflationRate: number;
    realReturnsByProfile: RiskProfileReturns;
  };
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
 * INTENTIONAL DEVIATION from standard 4-step WizardStep = 1 | 2 | 3 | 4 pattern.
 *
 * Investment INA uses a 7-step string-based workflow because goal-based investment
 * planning requires dedicated steps for client overview, discretionary investments,
 * risk profiling, economic assumptions, goals setup, review, and results — each
 * representing a distinct data collection phase that doesn't map to the standard
 * 4-step model (Information Gathering → Auto-Calculation → Manual Adjustment → Finalise).
 *
 * The standard 4-step modules (Risk, Retirement, Tax, Medical) follow
 * WizardStep = 1 | 2 | 3 | 4 with a consistent state shape defined in their types.ts.
 */
export type InvestmentINAWizardStep =
  | 'client-overview'
  | 'discretionary-investments'
  | 'risk-profile'
  | 'economic-assumptions'
  | 'goals-setup'
  | 'review'
  | 'results';

export interface InvestmentINAWizardState {
  currentStep: InvestmentINAWizardStep;
  completedSteps: InvestmentINAWizardStep[];
  inputs: Partial<InvestmentINAInputs>;
  errors: Record<string, string>;
}

// ==================== HELPER TYPES ====================

export interface DefaultEconomicAssumptions {
  longTermInflationRate: number;
  expectedRealReturns: RiskProfileReturns;
}

// Moved to constants.ts — re-exported for backward compatibility
export { DEFAULT_ECONOMIC_ASSUMPTIONS, GOAL_TYPE_LABELS, RISK_PROFILE_LABELS } from './constants';