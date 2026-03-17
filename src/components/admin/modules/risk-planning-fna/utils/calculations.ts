/**
 * Risk Planning FNA Calculation Utilities
 * 
 * ⚠️ CRITICAL: Do NOT change, optimize, or reinterpret these formulas
 * Implement calculations exactly as specified
 * All calculations must be deterministic and auditable
 */

import type { 
  InformationGatheringInput, 
  RiskCalculations,
  LifeCoverCalculation,
  DisabilityCoverCalculation,
  SevereIllnessCoverCalculation,
  IncomeProtectionCalculation,
} from '../types';
import { 
  LIFE_COVER, 
  DISABILITY_COVER, 
  SEVERE_ILLNESS_COVER, 
  INCOME_PROTECTION,
  SYSTEM_VERSION,
} from '../constants';

// ==================== LIFE COVER CALCULATION ====================

/**
 * Calculate Life Cover (Death) using Capital Replacement Model
 * 
 * Objective: Ensure dependants can clear liabilities, maintain lifestyle,
 * and fund education and final expenses
 */
export function calculateLifeCover(input: InformationGatheringInput): LifeCoverCalculation {
  const { 
    netAnnualIncome,
    totalOutstandingDebts,
    totalEstateValue,
    dependants,
    spouseFullName,
    spouseAverageMonthlyIncome,
    existingCover,
  } = input;
  
  // Step 1: Immediate Capital
  const estateCosts = Math.max(0, totalEstateValue * LIFE_COVER.ESTATE_COSTS_PERCENTAGE);
  const immediateCapital = {
    outstandingDebt: totalOutstandingDebts,
    funeralFinalExpenses: LIFE_COVER.FUNERAL_FINAL_EXPENSES,
    estateCosts,
    total: totalOutstandingDebts + LIFE_COVER.FUNERAL_FINAL_EXPENSES + estateCosts,
  };
  
  // Step 2: Income Replacement Capital
  const numDependants = dependants.length;
  const isMarried = !!spouseFullName && spouseFullName.trim().length > 0;
  const isSingleIncome = !spouseAverageMonthlyIncome || spouseAverageMonthlyIncome === 0;
  
  let incomeMultiple = 0;
  
  if (numDependants === 0) {
    // Single, no dependants: 5×
    incomeMultiple = LIFE_COVER.MULTIPLES.SINGLE_NO_DEPENDANTS;
  } else {
    // Has dependants
    let baseMultiple = 0;
    
    if (isSingleIncome) {
      // Single-income household: Base 14× for 1 dependant
      baseMultiple = LIFE_COVER.MULTIPLES.SINGLE_INCOME_HOUSEHOLD_BASE;
    } else {
      // Married, young children (dual income): Base 10× for 1 dependant
      baseMultiple = LIFE_COVER.MULTIPLES.MARRIED_YOUNG_CHILDREN_BASE;
    }
    
    // Mandatory Fix #1: Additional Income Multiple per Additional Dependant = +1×
    // For N dependants (N ≥ 1): Base + (N - 1) × 1
    incomeMultiple = baseMultiple + ((numDependants - 1) * LIFE_COVER.MULTIPLES.ADDITIONAL_PER_DEPENDANT);
  }
  
  const incomeReplacementCapital = {
    netAnnualIncome,
    incomeMultiple,
    total: netAnnualIncome * incomeMultiple,
  };
  
  // Step 3: Education Capital
  const educationCapitalPerDependant = dependants.map(dep => ({
    dependantId: dep.id,
    relationship: dep.relationship,
    monthlyEducationCost: dep.monthlyEducationCost,
    dependencyTerm: dep.dependencyTerm,
    total: dep.monthlyEducationCost * 12 * dep.dependencyTerm,
  }));
  
  const educationCapitalTotal = educationCapitalPerDependant.reduce(
    (sum, dep) => sum + dep.total, 
    0
  );
  
  const educationCapital = {
    perDependant: educationCapitalPerDependant,
    total: educationCapitalTotal,
  };
  
  // Step 4: Total Life Cover
  const grossNeed = immediateCapital.total + incomeReplacementCapital.total + educationCapital.total;
  
  // Existing Cover Offset
  const existingCoverData = {
    personal: existingCover.life.personal,
    group: existingCover.life.group,
    total: existingCover.life.personal + existingCover.life.group,
  };
  
  const netShortfall = Math.max(0, grossNeed - existingCoverData.total);
  
  // Assumptions and Risk Notes
  const assumptions = [
    `Income multiple: ${incomeMultiple}× (${numDependants} dependant${numDependants !== 1 ? 's' : ''}, ${isSingleIncome ? 'single-income' : 'dual-income'} household)`,
    `Estate costs: ${(LIFE_COVER.ESTATE_COSTS_PERCENTAGE * 100).toFixed(2)}% of net estate value`,
    `Funeral and final expenses: R${LIFE_COVER.FUNERAL_FINAL_EXPENSES.toLocaleString()}`,
    `Net annual income: R${netAnnualIncome.toLocaleString()}`,
  ];
  
  const riskNotes = [
    'Life cover ensures dependants can maintain their standard of living and complete education.',
    'Capital replacement model assumes lump sum investment at retirement return rates.',
    'Review upon material life events (marriage, birth, divorce, debt changes).',
  ];
  
  return {
    immediateCapital,
    incomeReplacementCapital,
    educationCapital,
    grossNeed,
    existingCover: existingCoverData,
    netShortfall,
    assumptions,
    riskNotes,
  };
}

// ==================== DISABILITY COVER CALCULATION ====================

/**
 * Calculate Lump Sum Disability Cover
 */
export function calculateDisabilityCover(input: InformationGatheringInput): DisabilityCoverCalculation {
  const { netAnnualIncome, dependants, existingCover } = input;
  
  // Step 1: Capitalised Income Loss
  const numDependants = dependants.length;
  let disabilityMultiple = 0;
  
  if (numDependants === 1) {
    disabilityMultiple = DISABILITY_COVER.MULTIPLES.ONE_DEPENDANT;
  } else if (numDependants >= 2 && numDependants <= 4) {
    disabilityMultiple = DISABILITY_COVER.MULTIPLES.TWO_TO_FOUR_DEPENDANTS;
  } else if (numDependants >= 5) {
    disabilityMultiple = DISABILITY_COVER.MULTIPLES.FIVE_PLUS_DEPENDANTS;
  } else {
    // No dependants - use minimum multiple
    disabilityMultiple = DISABILITY_COVER.MULTIPLES.ONE_DEPENDANT;
  }
  
  const capitalisedIncomeLoss = {
    netAnnualIncome,
    disabilityMultiple,
    total: netAnnualIncome * disabilityMultiple,
  };
  
  // Step 2: Additional Disability Costs
  const additionalDisabilityCosts = {
    homeModifications: DISABILITY_COVER.HOME_MODIFICATIONS,
    vehicleAdaptation: DISABILITY_COVER.VEHICLE_ADAPTATION,
    medicalEquipment: DISABILITY_COVER.MEDICAL_EQUIPMENT,
    onceOffCareCosts: DISABILITY_COVER.ONCE_OFF_CARE_COSTS,
    total: 
      DISABILITY_COVER.HOME_MODIFICATIONS +
      DISABILITY_COVER.VEHICLE_ADAPTATION +
      DISABILITY_COVER.MEDICAL_EQUIPMENT +
      DISABILITY_COVER.ONCE_OFF_CARE_COSTS,
  };
  
  // Step 3: Total Disability Cover
  const grossNeed = capitalisedIncomeLoss.total + additionalDisabilityCosts.total;
  
  // Existing Cover Offset
  const existingCoverData = {
    personal: existingCover.disability.personal,
    group: existingCover.disability.group,
    total: existingCover.disability.personal + existingCover.disability.group,
  };
  
  const netShortfall = Math.max(0, grossNeed - existingCoverData.total);
  
  // Assumptions and Risk Notes
  const assumptions = [
    `Disability multiple: ${disabilityMultiple}× (${numDependants} dependant${numDependants !== 1 ? 's' : ''})`,
    `Vehicle adaptation: R${DISABILITY_COVER.VEHICLE_ADAPTATION.toLocaleString()}`,
    `Medical equipment: R${DISABILITY_COVER.MEDICAL_EQUIPMENT.toLocaleString()}`,
    `Once-off care costs: R${DISABILITY_COVER.ONCE_OFF_CARE_COSTS.toLocaleString()}`,
  ];
  
  const riskNotes = [
    'Lump sum disability cover provides capital for income loss and adaptation costs.',
    'Assumes total and permanent disability as defined by insurer.',
    'Consider pairing with income protection for ongoing income replacement.',
  ];
  
  return {
    capitalisedIncomeLoss,
    additionalDisabilityCosts,
    grossNeed,
    existingCover: existingCoverData,
    netShortfall,
    assumptions,
    riskNotes,
  };
}

// ==================== SEVERE ILLNESS COVER CALCULATION ====================

/**
 * Calculate Severe Illness Cover
 * Based on gross annual income bands
 */
export function calculateSevereIllnessCover(input: InformationGatheringInput): SevereIllnessCoverCalculation {
  const { grossAnnualIncome, existingCover } = input;
  
  // Find matching band
  let incomeMultiple = 0;
  let matchedBand = '';
  
  for (const band of SEVERE_ILLNESS_COVER.BANDS) {
    if (grossAnnualIncome >= band.minIncome && grossAnnualIncome <= band.maxIncome) {
      incomeMultiple = band.multiple;
      matchedBand = band.label;
      break;
    }
  }
  
  const grossNeed = grossAnnualIncome * incomeMultiple;
  
  // Existing Cover Offset
  const existingCoverData = {
    personal: existingCover.severeIllness.personal,
    group: existingCover.severeIllness.group,
    total: existingCover.severeIllness.personal + existingCover.severeIllness.group,
  };
  
  const netShortfall = Math.max(0, grossNeed - existingCoverData.total);
  
  // Assumptions and Risk Notes
  const assumptions = [
    `Income band: ${matchedBand}`,
    `Income multiple: ${incomeMultiple}×`,
    `Gross annual income: R${grossAnnualIncome.toLocaleString()}`,
  ];
  
  const riskNotes = [
    'Severe illness cover provides lump sum upon diagnosis of specified conditions.',
    'Common conditions include cancer, heart attack, stroke, and organ failure.',
    'Benefit typically pays out once, accelerating death benefit.',
  ];
  
  return {
    grossAnnualIncome,
    incomeMultiple,
    grossNeed,
    existingCover: existingCoverData,
    netShortfall,
    assumptions,
    riskNotes,
  };
}

// ==================== INCOME PROTECTION CALCULATION ====================

/**
 * Calculate Income Protection (Temporary and Permanent)
 * Mandatory Fix #2: Insurable Maximum Guardrail
 */
export function calculateIncomeProtection(input: InformationGatheringInput): IncomeProtectionCalculation {
  const { 
    netMonthlyIncome, 
    currentAge, 
    retirementAge, 
    existingCover,
    incomeProtectionSettings,
  } = input;
  
  // Calculated Need: 100% of Net Monthly Income
  const calculatedNeed = netMonthlyIncome * INCOME_PROTECTION.NET_INCOME_PERCENTAGE;
  
  // Insurable Maximum (admin-configurable guardrail)
  const insurableMaximum = INCOME_PROTECTION.DEFAULT_INSURABLE_MAXIMUM_MONTHLY;
  
  // Temporary Income Protection
  const tempExistingCover = {
    personal: existingCover.incomeProtection.temporary.personal,
    group: existingCover.incomeProtection.temporary.group,
    total: existingCover.incomeProtection.temporary.personal + existingCover.incomeProtection.temporary.group,
  };
  
  const tempShortfall = Math.max(0, calculatedNeed - tempExistingCover.total);
  const tempExceedsLimit = calculatedNeed > insurableMaximum;
  
  // Permanent Income Protection
  const permExistingCover = {
    personal: existingCover.incomeProtection.permanent.personal,
    group: existingCover.incomeProtection.permanent.group,
    total: existingCover.incomeProtection.permanent.personal + existingCover.incomeProtection.permanent.group,
  };
  
  const permShortfall = Math.max(0, calculatedNeed - permExistingCover.total);
  const permExceedsLimit = calculatedNeed > insurableMaximum;
  const benefitTerm = retirementAge - currentAge;
  
  // Assumptions and Risk Notes
  const assumptions = [
    `Calculated need: R${calculatedNeed.toLocaleString()} per month (100% of net income)`,
    `Insurable maximum: R${insurableMaximum.toLocaleString()} per month`,
    `Benefit term (permanent): ${benefitTerm} years (to age ${retirementAge})`,
    `Temporary benefit period: ${incomeProtectionSettings.temporary.benefitPeriod}`,
    `Permanent escalation: ${incomeProtectionSettings.permanent.escalation}`,
  ];
  
  const riskNotes = [
    'Income protection replaces income during disability, subject to waiting periods.',
    'Temporary IP typically covers short-term disabilities (6-24 months).',
    'Permanent IP provides income until recovery or retirement age.',
    'Do not cross-offset temporary and permanent benefits.',
  ];
  
  if (tempExceedsLimit || permExceedsLimit) {
    riskNotes.push(INCOME_PROTECTION.EXCEEDS_LIMIT_WARNING);
  }
  
  return {
    temporary: {
      calculatedNeed,
      insurableMaximum,
      exceedsLimit: tempExceedsLimit,
      benefitPeriod: incomeProtectionSettings.temporary.benefitPeriod,
      existingCover: tempExistingCover,
      netShortfall: tempShortfall,
    },
    permanent: {
      calculatedNeed,
      insurableMaximum,
      exceedsLimit: permExceedsLimit,
      escalation: incomeProtectionSettings.permanent.escalation,
      benefitTerm,
      existingCover: permExistingCover,
      netShortfall: permShortfall,
    },
    assumptions,
    riskNotes,
  };
}

// ==================== MASTER CALCULATION FUNCTION ====================

/**
 * Perform complete risk analysis calculation
 * This is the main entry point called after Step 1 submission
 */
export function calculateRiskAnalysis(
  input: InformationGatheringInput,
  calculatedBy: string = 'System'
): RiskCalculations {
  const life = calculateLifeCover(input);
  const disability = calculateDisabilityCover(input);
  const severeIllness = calculateSevereIllnessCover(input);
  const incomeProtection = calculateIncomeProtection(input);
  
  return {
    life,
    disability,
    severeIllness,
    incomeProtection,
    metadata: {
      calculatedAt: new Date().toISOString(),
      calculatedBy,
      systemVersion: SYSTEM_VERSION,
    },
  };
}
