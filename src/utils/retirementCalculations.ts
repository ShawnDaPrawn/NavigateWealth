import { differenceInMonths, addMonths } from 'date-fns';

export interface RetirementMaturityCalculationOptions {
  /**
   * Policy inception (or other anniversary anchor). When set and escalation &gt; 0,
   * the monthly premium increases once per completed policy year from this date.
   * When omitted, escalation applies every 12 months from `currentDate` (legacy behaviour).
   */
  premiumAnniversaryReference?: Date | null;
}

/**
 * Calculates the estimated maturity value of a retirement annuity or similar product.
 *
 * @param currentFundValue Current value of the fund
 * @param monthlyContribution Current monthly premium
 * @param annualGrowthRate Expected annual growth rate (percentage, e.g., 10 for 10%)
 * @param annualEscalationRate Annual premium increase (percentage, e.g., 5 for 5%). Use 0 for no escalation.
 * @param currentDate Date of calculation (usually today)
 * @param maturityDate Date of maturity
 * @param options Optional anniversary anchor for escalation timing
 */
export function calculateRetirementMaturityValue(
  currentFundValue: number,
  monthlyContribution: number,
  annualGrowthRate: number,
  annualEscalationRate: number,
  currentDate: Date,
  maturityDate: Date,
  options?: RetirementMaturityCalculationOptions
): number {
  if (maturityDate <= currentDate) {
    return Math.round(currentFundValue * 100) / 100;
  }

  const growthRate = annualGrowthRate / 100;
  const escalationRate = annualEscalationRate / 100;
  const monthlyGrowthRate = Math.pow(1 + growthRate, 1 / 12) - 1;

  const totalMonths = differenceInMonths(maturityDate, currentDate);
  if (totalMonths <= 0) {
    return Math.round(currentFundValue * 100) / 100;
  }

  let value = currentFundValue;
  let currentMonthlyPremium = monthlyContribution;

  const inception = options?.premiumAnniversaryReference;
  const useAnniversary =
    annualEscalationRate > 0 &&
    inception instanceof Date &&
    !Number.isNaN(inception.getTime());

  for (let month = 1; month <= totalMonths; month++) {
    value = value * (1 + monthlyGrowthRate);
    value += currentMonthlyPremium;

    if (annualEscalationRate <= 0) {
      continue;
    }

    if (useAnniversary) {
      const atEnd = addMonths(currentDate, month);
      const atStart = addMonths(currentDate, month - 1);
      const fullYearsEnd = Math.floor(differenceInMonths(atEnd, inception) / 12);
      const fullYearsStart = Math.floor(differenceInMonths(atStart, inception) / 12);
      if (fullYearsEnd > fullYearsStart && fullYearsEnd >= 1) {
        currentMonthlyPremium = currentMonthlyPremium * (1 + escalationRate);
      }
    } else if (month % 12 === 0) {
      currentMonthlyPremium = currentMonthlyPremium * (1 + escalationRate);
    }
  }

  return Math.round(value * 100) / 100;
}
