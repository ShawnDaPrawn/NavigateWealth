/**
 * Investment Needs Analysis (INA) Calculation Service
 * Client-side calculation utilities and validation
 */

import type {
  InvestmentINAInputs,
  InvestmentGoal,
  GoalCalculationResult,
  DiscretionaryInvestment,
  RiskProfile,
} from '../types';

/**
 * Validate INA inputs
 */
export function validateInputs(inputs: Partial<InvestmentINAInputs>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Personal information validation
  if (!inputs.currentAge || inputs.currentAge <= 0) {
    errors.push('Valid current age is required');
  }
  
  if (!inputs.dateOfBirth) {
    errors.push('Date of birth is required');
  }

  // Risk profile validation
  if (!inputs.clientRiskProfile) {
    errors.push('Client risk profile is required');
  }

  // Economic assumptions validation
  if (!inputs.longTermInflationRate || inputs.longTermInflationRate < 0) {
    errors.push('Valid inflation rate is required');
  }

  if (!inputs.expectedRealReturns) {
    errors.push('Expected real returns are required');
  }

  // Goals validation
  if (!inputs.goals || inputs.goals.length === 0) {
    errors.push('At least one investment goal is required');
  } else {
    inputs.goals.forEach((goal, index) => {
      const goalErrors = validateGoal(goal);
      if (goalErrors.length > 0) {
        errors.push(`Goal ${index + 1} (${goal.goalName}): ${goalErrors.join(', ')}`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate individual goal
 */
export function validateGoal(goal: InvestmentGoal): string[] {
  const errors: string[] = [];

  if (!goal.goalName || goal.goalName.trim() === '') {
    errors.push('Goal name is required');
  }

  if (!goal.goalAmountToday || goal.goalAmountToday <= 0) {
    errors.push('Goal amount must be greater than 0');
  }

  if (!goal.targetDate) {
    errors.push('Target date is required');
  }

  if (!goal.targetYear || goal.targetYear <= new Date().getFullYear()) {
    errors.push('Target year must be in the future');
  }

  if (!goal.useClientRiskProfile && !goal.goalSpecificRiskProfile) {
    errors.push('Risk profile is required (either client or goal-specific)');
  }

  return errors;
}

/**
 * Calculate years to goal
 */
export function calculateYearsToGoal(targetYear: number): number {
  const currentYear = new Date().getFullYear();
  return Math.max(0, targetYear - currentYear);
}

/**
 * Format currency (South African Rand)
 */
export function formatCurrency(amount: number, decimals: number = 0): string {
  return `R${amount.toLocaleString('en-ZA', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Calculate future value of lump sum
 */
export function calculateFutureValue(
  presentValue: number,
  rate: number,
  years: number
): number {
  return presentValue * Math.pow(1 + rate, years);
}

/**
 * Calculate future value of annuity (monthly contributions)
 */
export function calculateAnnuityFutureValue(
  monthlyPayment: number,
  annualRate: number,
  years: number
): number {
  if (monthlyPayment === 0 || years <= 0) return 0;
  
  const annuityFactor = (Math.pow(1 + annualRate, years) - 1) / annualRate;
  return monthlyPayment * 12 * annuityFactor;
}

/**
 * Calculate required monthly payment to reach goal
 */
export function calculateRequiredMonthlyPayment(
  futureValue: number,
  annualRate: number,
  years: number
): number {
  if (years <= 0) return 0;
  
  const annuityFactor = (Math.pow(1 + annualRate, years) - 1) / annualRate;
  return futureValue / (12 * annuityFactor);
}

/**
 * Calculate present value (today's value of future amount)
 */
export function calculatePresentValue(
  futureValue: number,
  rate: number,
  years: number
): number {
  return futureValue / Math.pow(1 + rate, years);
}

/**
 * Determine goal status color
 */
export function getGoalStatusColor(status: string): string {
  switch (status) {
    case 'on-track':
    case 'overfunded':
      return 'green';
    case 'slight-shortfall':
      return 'yellow';
    case 'moderate-shortfall':
      return 'orange';
    case 'significant-shortfall':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Determine goal status label
 */
export function getGoalStatusLabel(status: string): string {
  switch (status) {
    case 'on-track':
      return 'On Track';
    case 'overfunded':
      return 'Overfunded';
    case 'slight-shortfall':
      return 'Slight Shortfall';
    case 'moderate-shortfall':
      return 'Moderate Shortfall';
    case 'significant-shortfall':
      return 'Significant Shortfall';
    default:
      return 'Unknown';
  }
}

/**
 * Determine portfolio health color
 */
export function getPortfolioHealthColor(health: string): string {
  switch (health) {
    case 'excellent':
      return 'green';
    case 'good':
      return 'blue';
    case 'needs-attention':
      return 'orange';
    case 'critical':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Calculate total discretionary capital from investments
 */
export function calculateTotalDiscretionaryCapital(
  investments: DiscretionaryInvestment[]
): number {
  return investments
    .filter(inv => inv.isDiscretionary)
    .reduce((sum, inv) => sum + inv.currentValue, 0);
}

/**
 * Calculate total discretionary monthly contributions
 */
export function calculateTotalDiscretionaryContributions(
  investments: DiscretionaryInvestment[]
): number {
  return investments
    .filter(inv => inv.isDiscretionary)
    .reduce((sum, inv) => sum + inv.monthlyContribution, 0);
}

/**
 * Get expected real return for risk profile
 */
export function getExpectedRealReturn(
  riskProfile: RiskProfile,
  expectedReturns: Record<RiskProfile, number>
): number {
  return expectedReturns[riskProfile] || 0.05; // Default to 5% if not found
}

/**
 * Generate goal summary text for display
 */
export function generateGoalSummary(result: GoalCalculationResult): string {
  const fundingPercentage = Math.round(result.fundingGap.fundingPercentage);
  const yearsToGo = result.timeHorizon.yearsToGoal;
  
  if (result.fundingGap.hasShortfall) {
    const shortfall = formatCurrency(result.fundingGap.gapAmount);
    const additionalMonthly = formatCurrency(result.requiredContributions.requiredAdditionalMonthly);
    
    return `Goal is ${fundingPercentage}% funded with a shortfall of ${shortfall}. ` +
           `Increase monthly contributions by ${additionalMonthly} to stay on track over ${yearsToGo} years.`;
  } else {
    const surplus = formatCurrency(Math.abs(result.fundingGap.gapAmount));
    
    return `Goal is ${fundingPercentage}% funded${fundingPercentage > 100 ? ` with a surplus of ${surplus}` : ''}. ` +
           `Current trajectory will meet or exceed this goal in ${yearsToGo} years.`;
  }
}

/**
 * Calculate affordability check (as % of income)
 */
export function calculateAffordability(
  monthlyContribution: number,
  grossMonthlyIncome: number
): {
  percentage: number;
  isAffordable: boolean;
  warningMessage?: string;
} {
  if (grossMonthlyIncome <= 0) {
    return {
      percentage: 0,
      isAffordable: true,
    };
  }
  
  const percentage = (monthlyContribution / grossMonthlyIncome) * 100;
  
  // Generally, total savings should not exceed 20-30% of gross income
  const isAffordable = percentage <= 30;
  const warningMessage = percentage > 30
    ? `This represents ${percentage.toFixed(1)}% of gross income, which may be challenging to maintain`
    : undefined;
  
  return {
    percentage,
    isAffordable,
    warningMessage,
  };
}

export const InvestmentINACalculationService = {
  validateInputs,
  validateGoal,
  calculateYearsToGoal,
  formatCurrency,
  formatPercentage,
  calculateFutureValue,
  calculateAnnuityFutureValue,
  calculateRequiredMonthlyPayment,
  calculatePresentValue,
  getGoalStatusColor,
  getGoalStatusLabel,
  getPortfolioHealthColor,
  calculateTotalDiscretionaryCapital,
  calculateTotalDiscretionaryContributions,
  getExpectedRealReturn,
  generateGoalSummary,
  calculateAffordability,
};
