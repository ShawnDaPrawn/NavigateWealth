/**
 * Risk Planning Calculation Utility
 * Specialized calculations for Risk Planning
 */

import { FNAInputs, FNAResults, LifeCoverBreakdown, SevereIllnessBreakdown, CapitalDisabilityBreakdown, IncomeProtectionBreakdown } from './types';

export const calculateRiskPlanning = (inputs: Partial<FNAInputs>): FNAResults => {
  const {
    liabilities = [],
    existingCover = {
      lifeCover: 0,
      severeCriticalIllnessCover: 0,
      capitalDisabilityCover: 0,
      incomeProtectionMonthly: 0
    },
    assumptions = {
      safeWithdrawalRate: 0.05,
      incomeReplacementYears: 0,
      finalExpensesEstimate: 0,
      educationFundingTotal: 0,
      estateCostsEstimate: 0,
      annualIncomeNeededForDependants: 0,
      lifestyleModificationsCost: 0,
      medicalAdaptationCost: 0,
      annualIncomeRequiredIfDisabled: 0,
      medicalShortfallsEstimate: 0,
      lifestyleAdjustmentsCost: 0,
      incomeGapMonthsUnableToWork: 0,
      debtBufferPercentage: 0,
      monthlyIncomeRequiredToMaintainLifestyle: 0,
      emergencyFundMonths: 3,
      funeralAndFinalExpenses: 0,
      educationCapitalGoal: 0,
      onceOffBequests: 0,
      targetIncomeReplacementPercent: 75,
      medicalGapMonths: 0,
      lifestyleAdjustmentMonths: 0,
      homeAdaptationMonths: 0,
      incomeProtectionMaxPercentOfGross: 75
    },
    overrides = {},
    lifeCoverMethod = 'years',
    disabilityMethod = 'years',
    clientAge = 0,
    expectedRetirementAge = 65
  } = inputs;

  // 1. Calculate Total Debt (sum of all current liabilities)
  const totalDebt = liabilities.reduce((sum, l) => sum + (l.outstandingBalance || 0), 0);

  // ==================== 2.1 Life Cover Needed ====================
  const finalExpenses = assumptions.finalExpensesEstimate || 0;
  const educationFunding = assumptions.educationFundingTotal || 0;
  const estateCosts = assumptions.estateCostsEstimate || 0;
  const annualIncomeNeeded = assumptions.annualIncomeNeededForDependants || 0;
  const existingLife = existingCover.lifeCover || 0;

  let incomeReplacement = 0;
  if (lifeCoverMethod === 'capitalisation') {
    // Method B: annual_income / safe_withdrawal_rate
    const rate = assumptions.safeWithdrawalRate || 0.05;
    incomeReplacement = rate !== 0 ? annualIncomeNeeded / rate : 0;
  } else {
    // Method A: annual_income * income_replacement_years
    const years = assumptions.incomeReplacementYears || 0;
    incomeReplacement = annualIncomeNeeded * years;
  }

  const lifeCalc = (totalDebt + finalExpenses + incomeReplacement + educationFunding + estateCosts) - existingLife;
  
  const lifeCoverBreakdown: LifeCoverBreakdown = {
    debt: totalDebt,
    finalExpenses,
    incomeReplacement,
    educationFunding,
    estateCosts,
    existingLifeCover: existingLife,
    calculatedNeed: lifeCalc,
    overrideNeed: overrides.lifeCoverRequiredOverride,
    finalRecommendedNeed: overrides.lifeCoverRequiredOverride ?? lifeCalc,
    shortfallSurplus: (overrides.lifeCoverRequiredOverride ?? lifeCalc), // This IS the shortfall
    // Required fields from type definition (filling with defaults or calc)
    totalDebtToSettle: totalDebt,
    emergencyFundNeed: 0,
    finalExpensesNeed: finalExpenses,
    educationNeed: educationFunding,
    bequestsNeed: 0,
    lumpSumNeeds: totalDebt + finalExpenses + educationFunding + estateCosts,
    yearsToRetirement: Math.max(0, expectedRetirementAge - clientAge),
    maxYearsSupportDependants: 0,
    yearsSupportForIncomeReplacement: assumptions.incomeReplacementYears || 0,
    targetFamilyIncomePerMonth: 0,
    incomeReplacementCapital: incomeReplacement,
    requiredLifeCover: lifeCalc + existingLife,
    availableLiquidAssets: 0,
    lifeCoverGap: lifeCalc
  };

  // ==================== 2.2 Lump-Sum Disability Needed ====================
  const annualIncomeDisabled = assumptions.annualIncomeRequiredIfDisabled || 0;
  const lifestyleMods = assumptions.lifestyleModificationsCost || 0;
  const medicalAdapt = assumptions.medicalAdaptationCost || 0;
  const existingDisability = existingCover.capitalDisabilityCover || 0;

  let incomeCapitalisation = 0;
  if (disabilityMethod === 'capitalisation') {
    // Method A: annual / rate
    const rate = assumptions.safeWithdrawalRate || 0.05;
    incomeCapitalisation = rate !== 0 ? annualIncomeDisabled / rate : 0;
  } else {
    // Method B: annual * years_to_retirement
    const years = (expectedRetirementAge || 65) - (clientAge || 0);
    const validYears = Math.max(0, years);
    incomeCapitalisation = annualIncomeDisabled * validYears;
  }

  const disabilityCalc = (totalDebt + incomeCapitalisation + lifestyleMods + medicalAdapt) - existingDisability;

  const capitalDisabilityBreakdown: CapitalDisabilityBreakdown = {
    debt: totalDebt,
    incomeCapitalisation,
    lifestyleModifications: lifestyleMods,
    medicalAdaptation: medicalAdapt,
    existingDisabilityCover: existingDisability,
    calculatedNeed: disabilityCalc,
    overrideNeed: overrides.disabilityCoverRequiredOverride,
    finalRecommendedNeed: overrides.disabilityCoverRequiredOverride ?? disabilityCalc,
    shortfallSurplus: (overrides.disabilityCoverRequiredOverride ?? disabilityCalc),
    // Required fields
    debtOnDisability: totalDebt,
    homeVehicleAdaptationNeed: lifestyleMods + medicalAdapt,
    retirementContributionGapCapital: 0,
    capitalDisabilityRequired: disabilityCalc + existingDisability,
    existingCapitalDisabilityCover: existingDisability,
    availableLiquidAssetsForDisability: 0,
    capitalDisabilityGap: disabilityCalc
  };

  // ==================== 2.3 Severe Illness Needed ====================
  const medicalShortfalls = assumptions.medicalShortfallsEstimate || 0;
  const lifestyleAdjustments = assumptions.lifestyleAdjustmentsCost || 0;
  const incomeGapMonths = assumptions.incomeGapMonthsUnableToWork || 0;
  const monthlyNetIncome = inputs.netMonthlyIncome || 0;
  const incomeGap = monthlyNetIncome * incomeGapMonths;
  
  const debtBufferPct = assumptions.debtBufferPercentage || 0; // e.g. 0.1
  const debtBuffer = totalDebt * debtBufferPct;
  
  const existingCI = existingCover.severeCriticalIllnessCover || 0;

  const ciCalc = (medicalShortfalls + lifestyleAdjustments + incomeGap + debtBuffer) - existingCI;

  const severeIllnessBreakdown: SevereIllnessBreakdown = {
    medicalShortfalls,
    lifestyleAdjustments,
    incomeGap,
    debtBuffer,
    existingSevereIllnessCover: existingCI,
    calculatedNeed: ciCalc,
    overrideNeed: overrides.severeIllnessRequiredOverride,
    finalRecommendedNeed: overrides.severeIllnessRequiredOverride ?? ciCalc,
    shortfallSurplus: (overrides.severeIllnessRequiredOverride ?? ciCalc),
    // Required fields
    medicalGapNeed: medicalShortfalls,
    lifestyleAdjustmentNeed: lifestyleAdjustments,
    debtToSettleOnCI: debtBuffer,
    ciRequired: ciCalc + existingCI,
    existingCICover: existingCI,
    ciGap: ciCalc
  };

  // ==================== 2.4 Income Protection Needed ====================
  const monthlyRequired = assumptions.monthlyIncomeRequiredToMaintainLifestyle || 0;
  const existingIP = existingCover.incomeProtectionMonthly || 0;
  
  const ipCalc = monthlyRequired - existingIP;

  const incomeProtectionBreakdown: IncomeProtectionBreakdown = {
    monthlyRequired,
    existingIP,
    calculatedNeed: ipCalc,
    overrideNeed: overrides.incomeProtectionRequiredMonthlyOverride,
    finalRecommendedNeed: overrides.incomeProtectionRequiredMonthlyOverride ?? ipCalc,
    shortfallSurplus: (overrides.incomeProtectionRequiredMonthlyOverride ?? ipCalc),
    // Required fields
    regulatoryLimit: 0,
    planningTarget: monthlyRequired,
    targetIncomeProtectionMonthly: monthlyRequired,
    existingIPMonthlyTotal: existingIP,
    reliableOtherIncome: 0,
    incomeProtectionGapMonthly: ipCalc
  };

  return {
    lifeCover: lifeCoverBreakdown,
    severeIllness: severeIllnessBreakdown,
    capitalDisability: capitalDisabilityBreakdown,
    incomeProtection: incomeProtectionBreakdown
  };
};
