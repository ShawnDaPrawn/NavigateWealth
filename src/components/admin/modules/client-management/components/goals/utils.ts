import { Goal, GoalCalculationResult } from './types';
import { differenceInDays, isValid } from 'date-fns';

/** Policy record shape used by goal calculations */
interface GoalPolicyRecord {
  id: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Schema field mapping used for value resolution */
interface SchemaFieldRecord {
  [key: string]: unknown;
}

/**
 * Clean a raw policy field value to a number.
 * Handles strings like "R 100 000.00", comma decimals, etc.
 */
function cleanCurrencyValue(val: unknown): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let str = String(val);
  // Handle comma as decimal separator if no dots are present
  if (str.includes(',') && !str.includes('.')) {
    str = str.replace(',', '.');
  }
  return Number(str.replace(/[^0-9.-]+/g, "")) || 0;
}

/**
 * Calculates the future value of a single policy based on its current value, contribution, and assumptions.
 */
export function calculatePolicyFV(
  currentValue: number,
  monthlyContribution: number,
  growthRate: number, // Annual %
  escalationRate: number, // Annual %
  monthsToTarget: number
): number {
  if (monthsToTarget <= 0) return currentValue;

  const r = growthRate / 100 / 12; // Monthly growth
  const e = escalationRate / 100 / 12; // Monthly escalation (approx)
  
  // FV of Lump Sum
  const fvLumpSum = currentValue * Math.pow(1 + r, monthsToTarget);

  // FV of Annuity (Contributions) with Escalation
  let fvContributions = 0;
  
  if (monthlyContribution > 0) {
    if (Math.abs(r - e) < 0.0000001) {
       // Rates are equal
       fvContributions = monthlyContribution * monthsToTarget * Math.pow(1 + r, monthsToTarget - 1);
    } else {
       // Geometric series sum
       fvContributions = monthlyContribution * ( (Math.pow(1 + r, monthsToTarget) - Math.pow(1 + e, monthsToTarget)) / (r - e) );
    }
  }

  return fvLumpSum + fvContributions;
}

/**
 * Aggregates all linked policies for a goal and calculates the result.
 */
export function calculateGoalStatus(goal: Goal, policies: GoalPolicyRecord[], schemas: Record<string, SchemaFieldRecord[]> = {}): GoalCalculationResult {
  const linkedPolicies = policies.filter(p => goal.linkedInvestmentIds.includes(p.id));

  // Helper to resolve value from schema or fallback keys
  const getPolicyValue = (p: GoalPolicyRecord) => {
      return cleanCurrencyValue(p.data?.invest_current_value) || 
             cleanCurrencyValue(p.data?.inv_3) || 
             cleanCurrencyValue(p.data?.inv_vol_3) || 
             cleanCurrencyValue(p.data?.inv_gua_3) || 
             cleanCurrencyValue(p.data?.['Current Value']) ||
             cleanCurrencyValue(p.data?.['Fund Value']) ||
             cleanCurrencyValue(p.data?.['Capital Value']) ||
             cleanCurrencyValue(p.data?.['Amount Due/Refundable']) ||
             cleanCurrencyValue(p.data?.['Cover Amount']) ||
             0;
  };

  const getPolicyPremium = (p: GoalPolicyRecord) => {
      return cleanCurrencyValue(p.data?.invest_monthly_contribution) || 
             cleanCurrencyValue(p.data?.inv_6) || 
             cleanCurrencyValue(p.data?.inv_vol_6) || 
             cleanCurrencyValue(p.data?.['Premium']) ||
             cleanCurrencyValue(p.data?.['Monthly Contribution']) ||
             cleanCurrencyValue(p.data?.['Contribution']) ||
             0;
  };
  
  // 1. Calculate Aggregated Inputs (Base + Linked)
  const linkedCurrentValue = linkedPolicies.reduce((sum, p) => sum + getPolicyValue(p), 0);
  const linkedMonthlyContribution = linkedPolicies.reduce((sum, p) => sum + getPolicyPremium(p), 0);
  
  // Total Starting Inputs
  const totalCurrentValue = (goal.initialLumpSum || 0) + linkedCurrentValue;
  const totalMonthlyContribution = (goal.monthlyContribution || 0) + linkedMonthlyContribution;
  
  const targetDate = new Date(goal.targetDate);
  const today = new Date();
  
  // Robust date diff
  let monthsToTarget = 0;
  if (isValid(targetDate)) {
      const days = differenceInDays(targetDate, today);
      monthsToTarget = Math.max(0, days / 30.4375);
  }

  // 2. Future Value Calculation
  const growthRate = goal.annualGrowthRate || 10;
  const escalation = goal.annualEscalation || 0;
  
  const fvTotal = calculatePolicyFV(
    totalCurrentValue,
    totalMonthlyContribution,
    growthRate,
    escalation,
    monthsToTarget
  );

  // 3. Ad-Hoc Contributions FV
  let fvAdHoc = 0;
  if (goal.adHocContributions && goal.adHocContributions.length > 0) {
      goal.adHocContributions.forEach(contrib => {
          const contribDate = new Date(contrib.date);
          if (isValid(contribDate)) {
             const days = differenceInDays(targetDate, contribDate);
             const months = Math.max(0, days / 30.4375);
             if (months > 0) {
                 const r = growthRate / 100 / 12;
                 fvAdHoc += contrib.amount * Math.pow(1 + r, months);
             } else {
                 fvAdHoc += contrib.amount; 
             }
          }
      });
  }

  const projectedValue = fvTotal + fvAdHoc;
  const shortfall = Math.max(0, goal.targetAmount - projectedValue); 
  const surplus = projectedValue - goal.targetAmount;

  // 4. Reverse Calculation for Shortfall
  let requiredMonthlyContribution = 0;
  
  if (shortfall > 0) {
     // We assume payments are made at the start of each month/period.
     // By using Math.ceil, we treat "0.7 months" as "1 payment period" and "1.2 months" as "2 payment periods".
     // This provides a more realistic "budget-friendly" spread for slightly fractional durations.
     const effectiveMonths = Math.max(1, Math.ceil(monthsToTarget));

     const r = growthRate / 100 / 12;
     const e = escalation / 100 / 12;
     
     let annuityFactor = 0;
     if (Math.abs(r - e) < 0.0000001) {
         annuityFactor = effectiveMonths * Math.pow(1 + r, effectiveMonths - 1);
     } else {
         annuityFactor = (Math.pow(1 + r, effectiveMonths) - Math.pow(1 + e, effectiveMonths)) / (r - e);
     }
     
     if (annuityFactor > 0) {
        requiredMonthlyContribution = shortfall / annuityFactor;
     }
  }

  // Status Logic
  let status: 'On Track' | 'At Risk' | 'Critical' = 'Critical';
  const ratio = projectedValue / (goal.targetAmount || 1); // Avoid div by zero
  
  if (ratio >= 0.95) status = 'On Track';
  else if (ratio >= 0.75) status = 'At Risk';
  
  return {
    goalId: goal.id,
    totalCurrentValue,
    totalMonthlyContribution,
    projectedValue,
    shortfall: goal.targetAmount - projectedValue, // Return raw difference
    status,
    requiredMonthlyContribution,
    monthsToTarget
  };
}