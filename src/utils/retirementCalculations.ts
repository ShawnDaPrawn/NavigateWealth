import { differenceInYears, differenceInMonths } from 'date-fns';

/**
 * Calculates the estimated maturity value of a retirement annuity.
 * 
 * @param currentFundValue Current value of the fund
 * @param monthlyContribution Current monthly premium
 * @param annualGrowthRate Expected annual growth rate (percentage, e.g., 10 for 10%)
 * @param annualEscalationRate Annual premium increase (percentage, e.g., 5 for 5%)
 * @param currentDate Date of calculation (usually today)
 * @param maturityDate Date of maturity
 * @returns Estimated maturity value
 */
export function calculateRetirementMaturityValue(
  currentFundValue: number,
  monthlyContribution: number,
  annualGrowthRate: number,
  annualEscalationRate: number,
  currentDate: Date,
  maturityDate: Date
): number {
  if (maturityDate <= currentDate) {
    return currentFundValue;
  }

  const yearsToMaturity = differenceInYears(maturityDate, currentDate);
  // If less than a year, just use simple interest or 0 growth for simplicity on short term
  // But let's do a monthly simulation for better accuracy given the inputs
  
  let value = currentFundValue;
  let currentMonthlyPremium = monthlyContribution;
  
  // Convert annual rates to decimal
  const growthRate = annualGrowthRate / 100;
  const escalationRate = annualEscalationRate / 100;
  
  // Monthly growth rate
  const monthlyGrowthRate = Math.pow(1 + growthRate, 1/12) - 1;

  // Total months
  const totalMonths = differenceInMonths(maturityDate, currentDate);

  for (let month = 1; month <= totalMonths; month++) {
    // Apply growth
    value = value * (1 + monthlyGrowthRate);
    
    // Add contribution (assuming end of month or start, let's say start for simplicity, so it grows)
    // Actually, usually premiums are paid, then growth happens.
    value += currentMonthlyPremium;

    // Escalate premium every 12 months
    if (month % 12 === 0) {
      currentMonthlyPremium = currentMonthlyPremium * (1 + escalationRate);
    }
  }

  return Math.round(value * 100) / 100;
}
