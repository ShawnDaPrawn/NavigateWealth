/**
 * Retirement FNA Calculation Engine
 * 
 * Implements "Adviser-Grade" retirement planning formulas.
 * Focused on transparency, real-terms calculations, and regulator-sensible defaults.
 */

import { RetirementFNAInputs, RetirementFNAAdjustments, RetirementCalculationResults } from '../types';

export const DEFAULT_RETIREMENT_ASSUMPTIONS = {
  retirementAge: 65,
  yearsInRetirement: 25,
  preRetirementReturn: 0.10,  // Nominal 10%
  postRetirementReturn: 0.08, // Nominal 8%
  inflationRate: 0.06,        // CPI 6%
  replacementRatio: 0.75,     // 75%
  salaryEscalation: 0.07,     // 7%
  premiumEscalation: 0.06,    // 6%
};

/**
 * Calculates the full Retirement FNA based on inputs + adjustments
 */
export function calculateRetirementFNA(
  inputs: Partial<RetirementFNAInputs>, 
  adjustments: RetirementFNAAdjustments = {}
): RetirementCalculationResults {
  
  // 1. Merge Inputs with Defaults and Adjustments
  // Adjustments take precedence over Inputs (for retirementAge), which take precedence over Defaults
  
  const currentAge = inputs.currentAge || 30;
  const retirementAge = adjustments.retirementAge || inputs.retirementAge || DEFAULT_RETIREMENT_ASSUMPTIONS.retirementAge;
  
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const yearsInRetirement = adjustments.yearsInRetirement || DEFAULT_RETIREMENT_ASSUMPTIONS.yearsInRetirement;
  
  // Economic Assumptions
  const inflation = adjustments.inflationRate ?? DEFAULT_RETIREMENT_ASSUMPTIONS.inflationRate;
  const preRetReturn = adjustments.preRetirementReturn ?? DEFAULT_RETIREMENT_ASSUMPTIONS.preRetirementReturn;
  const postRetReturn = adjustments.postRetirementReturn ?? DEFAULT_RETIREMENT_ASSUMPTIONS.postRetirementReturn;
  const salaryEscalation = adjustments.salaryEscalation ?? DEFAULT_RETIREMENT_ASSUMPTIONS.salaryEscalation;
  const replaceRatio = adjustments.replacementRatio ?? DEFAULT_RETIREMENT_ASSUMPTIONS.replacementRatio;
  const premiumEscalation = adjustments.premiumEscalation ?? DEFAULT_RETIREMENT_ASSUMPTIONS.premiumEscalation;

  // 2. Rates (Nominal)
  // We use Nominal Rates to project Future Values as per user request
  
  // Nominal Monthly Rates
  const nominalMonthlyGrowth = Math.pow(1 + preRetReturn, 1/12) - 1;
  const nominalMonthlyEscalation = Math.pow(1 + premiumEscalation, 1/12) - 1;
  
  // Real Rates (kept only for specific internal logic if needed, but mostly we use nominal now)
  // For Annuity Factor (Capital at Retirement), we need to value an Inflation-Linked Income stream.
  // The Capital Required to fund an inflation-linked income stream starting at X is X * AnnuityFactor(RealRate).
  // So we still use Real Post-Retirement Return for the Annuity Factor calculation.
  const realPostReturn = (1 + postRetReturn) / (1 + inflation) - 1;
  const realSalaryGrowth = (1 + salaryEscalation) / (1 + inflation) - 1;

  // 3. Target Income (Future Value)
  // Project current income to retirement using Salary Escalation (Nominal)
  // Formula: Current * (1 + SalaryEscalation)^Years
  const currentIncome = inputs.currentMonthlyIncome || 0;
  
  // Calculate projected final nominal income
  // Note: standard is usually to use Salary Escalation (e.g. 7%) to project income
  const projectedFinalNominalIncome = currentIncome * Math.pow(1 + salaryEscalation, yearsToRetirement);
  
  // Target Income is % of Final Nominal Income
  const targetMonthlyIncome = projectedFinalNominalIncome * replaceRatio;
  const targetAnnualIncome = targetMonthlyIncome * 12;

  // 4. Required Capital (Future Value)
  // We need a Capital Sum at Retirement (Future Date) that can support the Target Annual Income (Future Value).
  // This income needs to grow with inflation during retirement.
  // The formula for Capital Required to fund an inflation-linked stream is based on the Real Return.
  // PV = PMT * [ (1 - (1+r)^-n) / r ] where r is Real Return and PMT is the first payment (Future Value).
  
  let requiredCapital = 0;
  if (realPostReturn === 0) {
    requiredCapital = targetAnnualIncome * yearsInRetirement;
  } else {
    requiredCapital = targetAnnualIncome * ((1 - Math.pow(1 + realPostReturn, -yearsInRetirement)) / realPostReturn);
  }

  // 5. Projected Capital (Future Value)
  // FV of Existing Lumpsum using Nominal Return
  const currentSavings = inputs.currentRetirementSavings || 0;
  const fvExisting = currentSavings * Math.pow(1 + preRetReturn, yearsToRetirement);

  // FV of Contributions (Annuity Due/Ordinary) using Nominal Return & Nominal Escalation
  const monthlyContrib = inputs.currentMonthlyContribution || 0;
  const months = yearsToRetirement * 12;
  
  let fvContribs = 0;
  if (monthlyContrib > 0 && months > 0) {
    if (Math.abs(nominalMonthlyGrowth - nominalMonthlyEscalation) < 0.000001) {
      // L'Hopital's rule approximation when r approx g
      fvContribs = monthlyContrib * months * Math.pow(1 + nominalMonthlyGrowth, months - 1);
    } else {
      // Growing Annuity Formula (Future Value)
      // FV = PMT * [ (1+r)^n - (1+g)^n ] / (r - g)
      fvContribs = monthlyContrib * (
        (Math.pow(1 + nominalMonthlyGrowth, months) - Math.pow(1 + nominalMonthlyEscalation, months)) / 
        (nominalMonthlyGrowth - nominalMonthlyEscalation)
      );
    }
  }

  const projectedCapital = fvExisting + fvContribs;

  // 6. Analysis
  const capitalShortfall = requiredCapital - projectedCapital;
  const hasShortfall = capitalShortfall > 0;
  const shortfallPercentage = requiredCapital > 0 ? (capitalShortfall / requiredCapital) * 100 : 0;

  // 7. Solve for Additional Contribution
  // We need to find the Additional PMT (starting today) that, when escalated at premiumEscalation,
  // fills the Gap (Future Value).
  // Gap = PMT_add * Factor
  // Where Factor is the same Growing Annuity Factor used above.
  
  let requiredAdditionalContribution = 0;
  if (hasShortfall && months > 0) {
    let annuityFactor = 0;
    
    if (Math.abs(nominalMonthlyGrowth - nominalMonthlyEscalation) < 0.000001) {
      annuityFactor = months * Math.pow(1 + nominalMonthlyGrowth, months - 1);
    } else {
      annuityFactor = (Math.pow(1 + nominalMonthlyGrowth, months) - Math.pow(1 + nominalMonthlyEscalation, months)) / 
                      (nominalMonthlyGrowth - nominalMonthlyEscalation);
    }
    
    if (annuityFactor > 0) {
      requiredAdditionalContribution = capitalShortfall / annuityFactor;
    }
  }

  const totalRecommendedContribution = monthlyContrib + requiredAdditionalContribution;
  
  // % of Income
  // Using current income for affordability check
  const percentageOfIncome = currentIncome > 0 
    ? (totalRecommendedContribution / currentIncome) * 100 
    : 0;

  return {
    yearsToRetirement,
    yearsInRetirement,
    // The UI expects "realGrowthRate" — we send the nominal pre-retirement return
    // and keep the key for type compatibility. Ideally rename to 'growthRate'.
    realGrowthRate: preRetReturn,
    realSalaryGrowth: salaryEscalation,
    targetMonthlyIncome,
    requiredCapital,
    projectedCapital,
    capitalShortfall,
    hasShortfall,
    shortfallPercentage,
    requiredAdditionalContribution,
    totalRecommendedContribution,
    percentageOfIncome
  };
}