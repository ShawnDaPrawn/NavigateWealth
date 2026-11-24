/**
 * Medical Aid FNA Calculations
 * Implements specific South African rules for Medical Aid needs analysis
 */

import type {
  LJPMethod,
  MedicalFNAInputs,
  MedicalFNAResults,
  PremiumAffordability,
} from '../types';
import {
  LJP_AGE_THRESHOLD,
  LJP_BANDS,
  MSA_DAY_TO_DAY_THRESHOLD_PER_BENEFICIARY,
  PREMIUM_AFFORDABILITY_GUIDELINE,
} from '../constants';
import { formatCurrencyWhole } from '../../../../../utils/currencyFormatter';

// ==================== LATE JOINER PENALTY ====================

interface LJPAssessment {
  band: string;
  method: LJPMethod;
  penaltyYears: number;
  rationale: string;
}

function bandForPenaltyYears(penaltyYears: number): string {
  return LJP_BANDS.find((b) => penaltyYears >= b.minYears)?.band ?? '0%';
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * Late Joiner Penalty — Regulation 13 of the Medical Schemes Act.
 *
 *   penalty years = age − (35 + years of creditable cover after age 21)
 *   1–4 → 5%, 5–14 → 25%, 15–24 → 50%, 25+ → 75%
 *
 * Continuous cover since before 1 April 2001 exempts the member. FNAs
 * captured before the creditable-cover input existed fall back to the
 * "years without cover after 35" input, which can overstate the penalty
 * because it ignores cover held between 21 and 35.
 */
export function assessLateJoinerPenalty(inputs: MedicalFNAInputs): LJPAssessment {
  const age = inputs.currentAge;

  if (age < LJP_AGE_THRESHOLD) {
    return {
      band: '0%',
      method: 'under-35',
      penaltyYears: 0,
      rationale: 'Client is under 35 years old - Late Joiner Penalty does not apply.',
    };
  }

  if (inputs.coveredBeforeApril2001 === true) {
    return {
      band: '0%',
      method: 'exempt-pre-2001',
      penaltyYears: 0,
      rationale:
        'Client has had continuous medical scheme cover since before 1 April 2001 and is exempt from the Late Joiner Penalty (Regulation 13).',
    };
  }

  const creditable = inputs.creditableCoverageYearsAfter21;
  if (typeof creditable === 'number' && Number.isFinite(creditable)) {
    const credited = Math.max(0, creditable);
    const penaltyYears = Math.max(0, age - (LJP_AGE_THRESHOLD + credited));
    const band = bandForPenaltyYears(penaltyYears);
    const formula = `Penalty years = age ${age} − (35 + ${plural(credited, 'year')} of creditable cover after age 21) = ${penaltyYears}`;
    return {
      band,
      method: 'regulation-13',
      penaltyYears,
      rationale:
        band === '0%'
          ? `${formula}. No Late Joiner Penalty applies (Regulation 13).`
          : `${formula}, which results in a ${band} Late Joiner Penalty (Regulation 13). Proof of further creditable cover can lower it.`,
    };
  }

  const uncoveredYears = Math.max(0, inputs.yearsWithoutCoverAfter35 || 0);
  const band = bandForPenaltyYears(uncoveredYears);
  return {
    band,
    method: 'years-without-cover',
    penaltyYears: uncoveredYears,
    rationale:
      band === '0%'
        ? 'No Late Joiner Penalty applicable - client has continuous medical scheme coverage.'
        : `${plural(uncoveredYears, 'year')} without coverage after age 35 results in a ${band} Late Joiner Penalty. Capture the years of creditable cover after age 21 to apply the Regulation 13 formula, which credits earlier cover and may lower the band.`,
  };
}

// ==================== GAP COVER ====================

function assessGapCover(
  inputs: MedicalFNAInputs,
  recommendedCover: string,
): { recommended: boolean; rationale: string } {
  const reasons: string[] = [];
  if (inputs.plannedProcedures24m) {
    reasons.push('a procedure is planned in the next 24 months');
  }
  if (inputs.providerChoicePreference === 'Any provider') {
    reasons.push('the client wants to use any provider, and many charge above the scheme rate');
  }
  if (recommendedCover === '100%' && inputs.specialistVisitFreq !== '0-1') {
    reasons.push(
      'with 100% in-hospital cover, regular specialist use makes in-hospital shortfalls likely',
    );
  }

  if (reasons.length > 0) {
    return {
      recommended: true,
      rationale: `Gap cover is recommended because ${reasons.join('; ')}. It pays in-hospital specialist shortfalls and co-payments above the scheme rate for a relatively small premium.`,
    };
  }
  return {
    recommended: false,
    rationale:
      'Gap cover is optional: low expected specialist and procedure use and a willingness to use networks make in-hospital shortfalls less likely, although an emergency admission can still cause one.',
  };
}

// ==================== AFFORDABILITY ====================

function assessAffordability(
  inputs: MedicalFNAInputs,
): { affordability: PremiumAffordability; rationale: string } | null {
  const income = inputs.netMonthlyIncome ?? 0;
  const premium = inputs.existingTotalPremium ?? 0;
  if (!(income > 0) || !(premium > 0)) return null;

  const premiumToIncomeRatio = premium / income;
  const exceedsGuideline = premiumToIncomeRatio > PREMIUM_AFFORDABILITY_GUIDELINE;
  const pct = (premiumToIncomeRatio * 100).toFixed(1);
  const guideline = `${Math.round(PREMIUM_AFFORDABILITY_GUIDELINE * 100)}%`;

  return {
    affordability: {
      netMonthlyIncome: income,
      monthlyPremium: premium,
      premiumToIncomeRatio,
      exceedsGuideline,
    },
    rationale: exceedsGuideline
      ? `The current premium of ${formatCurrencyWhole(premium)} is ${pct}% of net monthly income, above the ${guideline} guideline. Confirm the client can sustain it, or consider a network or lower option.`
      : `The current premium of ${formatCurrencyWhole(premium)} is ${pct}% of net monthly income, within the ${guideline} guideline.`,
  };
}

// ==================== MAIN CALCULATION ====================

export function calculateMedicalNeeds(inputs: MedicalFNAInputs): MedicalFNAResults {
  // 1. Recommended Number of Dependents
  // D = 1 + spouse_partner + children_count + adult_dependants_count
  const spouseCount = inputs.spousePartner ? 1 : 0;
  const totalDependents = 1 + spouseCount + inputs.childrenCount + inputs.adultDependantsCount;

  const recommendedDependents = totalDependents >= 6 ? '6+' : totalDependents.toString();

  // 2. Recommended In-Hospital Cover (100% vs 200%)
  // H-Score Calculation
  let hScore = 0;

  // Utilisation / medical risk
  // Chronic PMB conditions
  if (inputs.chronicPmbCount >= 2) hScore += 2;
  else if (inputs.chronicPmbCount === 1) hScore += 1;
  // 0 -> +0

  // Planned procedures in next 24 months
  if (inputs.plannedProcedures24m) hScore += 3;

  // Specialist visit frequency
  if (inputs.specialistVisitFreq === '5+') hScore += 2;
  else if (inputs.specialistVisitFreq === '2-4') hScore += 1;
  // '0-1' -> +0

  // Choice / exposure
  // Provider choice preference
  if (inputs.providerChoicePreference === 'Any provider') hScore += 2;
  // 'Network OK' -> +0

  // Decision rule
  // If H >= 5  → Recommend 200% in-hospital cover
  // Else       → Recommend 100% in-hospital cover
  const recommendedCover = hScore >= 5 ? '200%' : '100%';

  const hospitalRationale =
    recommendedCover === '200%'
      ? 'Based on expected specialist/procedure usage and preference for provider choice, 200% reduces the likelihood of co-payments when providers charge above scheme rates.'
      : 'Based on lower expected utilisation and willingness to use networks, 100% is typically adequate, noting PMBs remain covered subject to scheme rules/DSP.';

  // 3. Is an MSA recommended (Yes/No)
  // Threshold scales with the number of beneficiaries: an MSA is worth paying
  // for inside the premium only when expected day-to-day spend per person is
  // meaningful, or when the client values predictable monthly costs.
  const dayToDay = inputs.annualDayToDayEstimate;
  const msaThreshold = MSA_DAY_TO_DAY_THRESHOLD_PER_BENEFICIARY * totalDependents;
  const spendTrigger = dayToDay >= msaThreshold;
  const cashflowTrigger = inputs.cashflowSensitivity === 'High';
  const msaRecommended = spendTrigger || cashflowTrigger;

  const beneficiaries = `${totalDependents} ${totalDependents === 1 ? 'beneficiary' : 'beneficiaries'}`;
  const thresholdText = `${formatCurrencyWhole(MSA_DAY_TO_DAY_THRESHOLD_PER_BENEFICIARY)} × ${beneficiaries} = ${formatCurrencyWhole(msaThreshold)}`;
  const msaRationale = msaRecommended
    ? spendTrigger
      ? `Estimated day-to-day spend of ${formatCurrencyWhole(dayToDay)} meets the threshold (${thresholdText}); an MSA structures these costs into predictable monthly payments.`
      : `Day-to-day spend of ${formatCurrencyWhole(dayToDay)} is below the threshold (${thresholdText}), but high cashflow sensitivity favours the predictability of an MSA.`
    : `Day-to-day spend of ${formatCurrencyWhole(dayToDay)} is below the threshold (${thresholdText}); a core plan with self-funded day-to-day expenses is likely more cost-effective.`;

  // 4. Late Joiner Penalty band (Regulation 13)
  const ljp = assessLateJoinerPenalty(inputs);

  // 5. Gap cover
  const gapCover = assessGapCover(inputs, recommendedCover);

  // 6. Premium affordability (only when income and premium are known)
  const affordability = assessAffordability(inputs);

  return {
    recommendedDependents,
    recommendedInHospitalCover: recommendedCover,
    msaRecommended,
    ljpBand: ljp.band,
    rationale: {
      hospital: hospitalRationale,
      msa: msaRationale,
      ljp: ljp.rationale,
      dependents: `Family composition indicates ${recommendedDependents} members to be covered.`,
      gapCover: gapCover.rationale,
      ...(affordability ? { affordability: affordability.rationale } : {}),
    },
    gapCoverRecommended: gapCover.recommended,
    ljpMethod: ljp.method,
    ljpPenaltyYears: ljp.penaltyYears,
    ...(affordability ? { premiumAffordability: affordability.affordability } : {}),
  };
}
