/**
 * Medical Aid FNA Calculations
 * Implements specific South African rules for Medical Aid needs analysis
 */

import { MedicalFNAInputs, MedicalFNAResults } from '../types';

export function calculateMedicalNeeds(inputs: MedicalFNAInputs): MedicalFNAResults {
  // 1. Recommended Number of Dependents
  // D = 1 + spouse_partner + children_count + adult_dependants_count
  const spouseCount = inputs.spousePartner ? 1 : 0;
  const totalDependents = 1 + spouseCount + inputs.childrenCount + inputs.adultDependantsCount;
  
  const recommendedDependents = totalDependents >= 6 ? "6+" : totalDependents.toString();

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
  
  const hospitalRationale = recommendedCover === '200%'
    ? "Based on expected specialist/procedure usage and preference for provider choice, 200% reduces the likelihood of co-payments when providers charge above scheme rates."
    : "Based on lower expected utilisation and willingness to use networks, 100% is typically adequate, noting PMBs remain covered subject to scheme rules/DSP.";

  // 3. Is an MSA recommended (Yes/No)
  // Threshold T = annual_day_to_day_estimate
  const T = inputs.annualDayToDayEstimate;
  
  let msaRecommended = false;
  
  if (
    T >= 6000 || 
    inputs.cashflowSensitivity === 'High' || 
    inputs.childrenCount >= 2
  ) {
    msaRecommended = true;
  }

  const msaRationale = msaRecommended
    ? "Day-to-day estimate exceeds threshold and/or cashflow sensitivity suggests MSA structure for predictability."
    : "Day-to-day spend is low; a core plan with self-funded day-to-day expenses is likely more cost-effective.";

  // 4. LJP Band (5%, 25%, 50%, 75%)
  // Simplified calculation: directly use years without cover after age 35
  
  let ljpBand = '0%';
  const uncoveredYears = inputs.yearsWithoutCoverAfter35;
  
  // Only apply LJP if person is 35 or older
  if (inputs.currentAge >= 35) {
    // Map uncovered years to penalty bands
    if (uncoveredYears === 0) {
      ljpBand = '0%';
    } else if (uncoveredYears >= 1 && uncoveredYears <= 4) {
      ljpBand = '5%';
    } else if (uncoveredYears >= 5 && uncoveredYears <= 14) {
      ljpBand = '25%';
    } else if (uncoveredYears >= 15 && uncoveredYears <= 24) {
      ljpBand = '50%';
    } else if (uncoveredYears >= 25) {
      ljpBand = '75%';
    }
  }

  const ljpRationale = ljpBand === '0%'
    ? inputs.currentAge < 35 
      ? "Client is under 35 years old - Late Joiner Penalty does not apply."
      : "No Late Joiner Penalty applicable - client has continuous medical scheme coverage."
    : `${uncoveredYears} year${uncoveredYears > 1 ? 's' : ''} without coverage after age 35 results in a ${ljpBand} Late Joiner Penalty.`;

  return {
    recommendedDependents,
    recommendedInHospitalCover: recommendedCover,
    msaRecommended,
    ljpBand,
    rationale: {
      hospital: hospitalRationale,
      msa: msaRationale,
      ljp: ljpRationale,
      dependents: `Family composition indicates ${recommendedDependents} members to be covered.`
    }
  };
}