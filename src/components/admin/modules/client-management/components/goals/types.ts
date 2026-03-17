/**
 * Goal Planner Types
 * Defines the shape of the Goal entity and calculation results.
 */

export interface AdHocContribution {
  amount: number;
  date: string;
}

export type GoalType = 'Wealth Accumulation' | 'Capital Growth' | 'Offshore Exposure' | 'Education Funding' | 'Medium-term Lifestyle' | 'Other';

export interface Goal {
  id: string;
  clientId: string;
  name: string;
  type: GoalType;
  targetAmount: number;
  targetDate: string; // ISO Date String
  
  // Financial Inputs
  initialLumpSum: number;
  monthlyContribution: number;
  annualEscalation: number; // Percentage
  annualGrowthRate: number; // Percentage
  inflationRate: number; // Percentage
  adHocContributions: AdHocContribution[];

  notes?: string;
  createdAt: string;
  updatedAt: string;
  
  // Linkage: Array of Policy IDs from Voluntary Investments
  linkedInvestmentIds: string[]; 
}

export interface GoalCalculationResult {
  goalId: string;
  totalCurrentValue: number;
  totalMonthlyContribution: number;
  projectedValue: number; // FV at target date
  shortfall: number; // Positive = Shortfall, Negative = Surplus
  status: 'On Track' | 'At Risk' | 'Critical';
  requiredMonthlyContribution: number; // Adjustment needed
  monthsToTarget?: number;
}

export interface GoalFormData {
  name: string;
  type: GoalType;
  targetAmount: number;
  targetDate: string;
  initialLumpSum: number;
  monthlyContribution: number;
  annualEscalation: number;
  annualGrowthRate: number;
  inflationRate: number;
  linkedInvestmentIds: string[];
}
