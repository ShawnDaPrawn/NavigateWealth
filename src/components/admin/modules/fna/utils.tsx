/**
 * FNA Calculation Logic
 * Performs all Financial Needs Analysis calculations
 */

import type {
  FNAInputs,
  FNAResults,
  LifeCoverBreakdown,
  SevereIllnessBreakdown,
  CapitalDisabilityBreakdown,
  IncomeProtectionBreakdown
} from './types';

/**
 * 4.1 Life Cover Calculation
 */
function calculateLifeCover(inputs: FNAInputs): LifeCoverBreakdown {
  const { 
    clientAge, 
    expectedRetirementAge, 
    netMonthlyIncome,
    monthlyEssentialExpenses,
    liabilities,
    assets,
    existingCover,
    assumptions,
    dependants
  } = inputs;

  // 4.1.1 Immediate lump-sum needs
  const totalDebtToSettle = liabilities
    .filter(l => l.settleOnDeath)
    .reduce((sum, l) => sum + l.outstandingBalance, 0);

  const emergencyFundNeed = monthlyEssentialExpenses * assumptions.emergencyFundMonths;
  const finalExpensesNeed = assumptions.funeralAndFinalExpenses;
  const educationNeed = assumptions.educationCapitalGoal;
  const bequestsNeed = assumptions.onceOffBequests;

  const lumpSumNeeds = 
    totalDebtToSettle + 
    emergencyFundNeed + 
    finalExpensesNeed + 
    educationNeed + 
    bequestsNeed;

  // 4.1.2 Income replacement capital
  const yearsToRetirement = Math.max(0, expectedRetirementAge - clientAge);

  // Calculate max years of support needed for dependants
  const maxYearsSupportDependants = dependants.length > 0
    ? Math.max(...dependants.map(d => Math.max(0, d.expectedSupportEndAge - d.age)))
    : 0;

  const yearsSupportForIncomeReplacement = Math.max(
    yearsToRetirement, 
    maxYearsSupportDependants
  );

  const targetFamilyIncomePerMonth = 
    netMonthlyIncome * (assumptions.targetIncomeReplacementPercent / 100);

  const incomeReplacementCapital = 
    targetFamilyIncomePerMonth * 12 * yearsSupportForIncomeReplacement;

  // 4.1.3 Required cover and gap
  const requiredLifeCover = lumpSumNeeds + incomeReplacementCapital;
  const existingLifeCover = existingCover.lifeCover;
  const availableLiquidAssets = 
    assets.emergencySavings +
    assets.unitTrustsInvestments +
    assets.discretionaryInvestments +
    assets.otherLiquidAssets;

  const lifeCoverGap = Math.max(
    0, 
    requiredLifeCover - (existingLifeCover + availableLiquidAssets)
  );

  return {
    totalDebtToSettle,
    emergencyFundNeed,
    finalExpensesNeed,
    educationNeed,
    bequestsNeed,
    lumpSumNeeds,
    yearsToRetirement,
    maxYearsSupportDependants,
    yearsSupportForIncomeReplacement,
    targetFamilyIncomePerMonth,
    incomeReplacementCapital,
    requiredLifeCover,
    existingLifeCover,
    availableLiquidAssets,
    lifeCoverGap,
  };
}

/**
 * 4.2 Severe Illness (Critical Illness) Calculation
 */
function calculateSevereIllness(inputs: FNAInputs): SevereIllnessBreakdown {
  const { netMonthlyIncome, liabilities, existingCover, assumptions } = inputs;

  const medicalGapNeed = netMonthlyIncome * assumptions.medicalGapMonths;
  const lifestyleAdjustmentNeed = netMonthlyIncome * assumptions.lifestyleAdjustmentMonths;
  
  const debtToSettleOnCI = liabilities
    .filter(l => l.settleOnSevereIllness)
    .reduce((sum, l) => sum + l.outstandingBalance, 0);

  const ciRequired = medicalGapNeed + lifestyleAdjustmentNeed + debtToSettleOnCI;
  const existingCICover = existingCover.severeCriticalIllnessCover;
  const ciGap = Math.max(0, ciRequired - existingCICover);

  return {
    medicalGapNeed,
    lifestyleAdjustmentNeed,
    debtToSettleOnCI,
    ciRequired,
    existingCICover,
    ciGap,
  };
}

/**
 * 4.3 Capital Disability Calculation
 */
function calculateCapitalDisability(inputs: FNAInputs): CapitalDisabilityBreakdown {
  const {
    clientAge,
    expectedRetirementAge,
    netMonthlyIncome,
    monthlyRetirementSaving,
    liabilities,
    assets,
    existingCover,
    assumptions
  } = inputs;

  // Debt to settle on disability
  const debtOnDisability = liabilities
    .filter(l => l.settleOnDisability)
    .reduce((sum, l) => sum + l.outstandingBalance, 0);

  // Home/vehicle adaptations
  const homeVehicleAdaptationNeed = netMonthlyIncome * assumptions.homeAdaptationMonths;

  // Retirement contribution gap
  const yearsToRetirement = Math.max(0, expectedRetirementAge - clientAge);
  const retirementContributionGapCapital = monthlyRetirementSaving * 12 * yearsToRetirement;

  const capitalDisabilityRequired = 
    debtOnDisability + 
    homeVehicleAdaptationNeed + 
    retirementContributionGapCapital;

  const existingCapitalDisabilityCover = existingCover.capitalDisabilityCover;
  
  const availableLiquidAssetsForDisability = 
    assets.emergencySavings +
    assets.unitTrustsInvestments +
    assets.discretionaryInvestments +
    assets.otherLiquidAssets;

  const capitalDisabilityGap = Math.max(
    0,
    capitalDisabilityRequired - (existingCapitalDisabilityCover + availableLiquidAssetsForDisability)
  );

  return {
    debtOnDisability,
    homeVehicleAdaptationNeed,
    retirementContributionGapCapital,
    capitalDisabilityRequired,
    existingCapitalDisabilityCover,
    availableLiquidAssetsForDisability,
    capitalDisabilityGap,
  };
}

/**
 * 4.4 Income Protection Calculation
 */
function calculateIncomeProtection(inputs: FNAInputs): IncomeProtectionBreakdown {
  const {
    grossMonthlyIncome,
    netMonthlyIncome,
    spouseIncome,
    existingCover,
    assumptions
  } = inputs;

  const regulatoryLimit = 
    grossMonthlyIncome * (assumptions.incomeProtectionMaxPercentOfGross / 100);
  
  const planningTarget = 
    netMonthlyIncome * (assumptions.targetIncomeReplacementPercent / 100);

  const targetIncomeProtectionMonthly = Math.min(regulatoryLimit, planningTarget);
  const existingIPMonthlyTotal = existingCover.incomeProtectionMonthly;
  const reliableOtherIncome = spouseIncome || 0;

  const incomeProtectionGapMonthly = Math.max(
    0,
    targetIncomeProtectionMonthly - existingIPMonthlyTotal - reliableOtherIncome
  );

  return {
    regulatoryLimit,
    planningTarget,
    targetIncomeProtectionMonthly,
    existingIPMonthlyTotal,
    reliableOtherIncome,
    incomeProtectionGapMonthly,
  };
}

/**
 * Main calculation entry point
 */
export const FNACalculationService = {
  calculate(inputs: FNAInputs): FNAResults {
    return {
      lifeCover: calculateLifeCover(inputs),
      severeIllness: calculateSevereIllness(inputs),
      capitalDisability: calculateCapitalDisability(inputs),
      incomeProtection: calculateIncomeProtection(inputs),
    };
  }
};
