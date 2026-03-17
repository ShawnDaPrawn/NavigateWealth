/**
 * Estate Planning FNA Calculation Utilities
 * Core estate planning logic and death estate modeling
 */

import type {
  EstatePlanningInputs,
  EstatePlanningResults,
  DeathBalanceSheet,
  LiquidityAnalysis,
  BeneficiaryAlignment,
  MinorChildrenAnalysis,
  BusinessContinuityAnalysis,
  StructuralRisk,
  BusinessAsset,
} from './types';

import { ESTATE_PLANNING_CONSTANTS } from './constants';

/**
 * Helper Functions
 */

export function classifyLiquidity(assetType: string, subType: string): 'liquid' | 'semi_liquid' | 'illiquid' {
  if (assetType === 'financial') {
    if (['bank_account', 'cash', 'money_market'].includes(subType)) {
      return 'liquid';
    }
    if (['unit_trust', 'shares'].includes(subType)) {
      return 'liquid';
    }
    if (['endowment'].includes(subType)) {
      return 'semi_liquid';
    }
  }

  if (assetType === 'property' || assetType === 'business') {
    return 'illiquid';
  }

  if (assetType === 'personal') {
    return 'illiquid';
  }

  return 'semi_liquid';
}

export function assessLiquidityRisk(shortfall: number): 'none' | 'moderate' | 'severe' {
  if (shortfall <= 0) {
    return 'none';
  }
  if (shortfall < ESTATE_PLANNING_CONSTANTS.LIQUIDITY_SHORTFALL_MODERATE_THRESHOLD) {
    return 'none';
  }
  if (shortfall < ESTATE_PLANNING_CONSTANTS.LIQUIDITY_SHORTFALL_SEVERE_THRESHOLD) {
    return 'moderate';
  }
  return 'severe';
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return Math.round(amount).toLocaleString('en-ZA');
}

/**
 * Step 1: Build Death Balance Sheet
 */
function buildDeathBalanceSheet(inputs: EstatePlanningInputs): DeathBalanceSheet {
  const { assets, liabilities, lifePolicies, assumptions } = inputs;

  // Calculate gross estate assets
  const grossEstateAssets = {
    property: 0,
    financial: 0,
    business: 0,
    personal: 0,
    deemedProperty: 0,
    total: 0,
  };

  const retirementFunds = {
    pension: 0,
    provident: 0,
    ra: 0,
    total: 0,
  };

  let totalUnrealisedGains = 0;

  assets.forEach((asset) => {
    const assetValue = asset.currentValue * (asset.ownershipPercentage / 100);

    if (!asset.includeInEstate) {
      return; // Skip assets not in estate (e.g., trust-owned)
    }

    if (asset.type === 'retirement') {
      // Retirement funds - separate treatment
      if (asset.subType === 'pension') retirementFunds.pension += assetValue;
      if (asset.subType === 'provident') retirementFunds.provident += assetValue;
      if (asset.subType === 'ra') retirementFunds.ra += assetValue;
      retirementFunds.total += assetValue;
    } else if (asset.type === 'property') {
      grossEstateAssets.property += assetValue;
      const propAsset = asset as Record<string, unknown>;
      if (propAsset.unrealisedGain) {
        totalUnrealisedGains += (propAsset.unrealisedGain as number) * (asset.ownershipPercentage / 100);
      }
    } else if (asset.type === 'financial') {
      grossEstateAssets.financial += assetValue;
    } else if (asset.type === 'business') {
      grossEstateAssets.business += assetValue;
    } else if (asset.type === 'personal') {
      grossEstateAssets.personal += assetValue;
    }
  });

  // Deemed property - life policies payable to estate
  lifePolicies.forEach((policy) => {
    if (policy.payableToEstate && policy.ownership === 'client') {
      grossEstateAssets.deemedProperty += policy.sumAssured;
    }
  });

  grossEstateAssets.total =
    grossEstateAssets.property +
    grossEstateAssets.financial +
    grossEstateAssets.business +
    grossEstateAssets.personal +
    grossEstateAssets.deemedProperty;

  // Calculate liabilities
  const liabilitiesBreakdown = {
    homeLoan: 0,
    vehicleFinance: 0,
    personalLoans: 0,
    creditCards: 0,
    businessDebts: 0,
    taxLiabilities: 0,
    total: 0,
  };

  liabilities.forEach((liability) => {
    const amount = liability.outstandingBalance;
    
    switch (liability.type) {
      case 'home_loan':
        liabilitiesBreakdown.homeLoan += amount;
        break;
      case 'vehicle_finance':
        liabilitiesBreakdown.vehicleFinance += amount;
        break;
      case 'personal_loan':
        liabilitiesBreakdown.personalLoans += amount;
        break;
      case 'credit_card':
        liabilitiesBreakdown.creditCards += amount;
        break;
      case 'business_debt':
        liabilitiesBreakdown.businessDebts += amount;
        break;
      case 'tax_liability':
        liabilitiesBreakdown.taxLiabilities += amount;
        break;
    }
    
    liabilitiesBreakdown.total += amount;
  });

  // Calculate administration costs
  const propertyCount = assets.filter((a) => a.type === 'property').length;
  
  const administrationCosts = {
    funeralCosts: assumptions.funeralCostsEstimate,
    executorFees: grossEstateAssets.total * (assumptions.executorFeePercentage / 100),
    conveyancingFees: propertyCount * assumptions.conveyancingFeesPerProperty,
    masterFees: assumptions.masterFeesEstimate,
    otherCosts: 0,
    total: 0,
  };

  administrationCosts.total =
    administrationCosts.funeralCosts +
    administrationCosts.executorFees +
    administrationCosts.conveyancingFees +
    administrationCosts.masterFees +
    administrationCosts.otherCosts;

  // Estate Duty Calculation
  const grossEstate = grossEstateAssets.total;
  const netEstateBeforeDuty = grossEstate - liabilitiesBreakdown.total - administrationCosts.total;

  let spousalDeduction = 0;
  if (assumptions.spousalBequest && inputs.familyInfo.maritalStatus.startsWith('married')) {
    // Simplified: assume all goes to spouse, so full spousal deduction
    spousalDeduction = Math.max(0, netEstateBeforeDuty);
  }

  const dutiableEstate = Math.max(
    0,
    netEstateBeforeDuty - assumptions.estateDutyAbatement - spousalDeduction
  );

  const estimatedEstateDuty = dutiableEstate * assumptions.estateDutyRate;

  const estateDuty = {
    grossEstate,
    lessLiabilities: liabilitiesBreakdown.total,
    lessCosts: administrationCosts.total,
    netEstateBeforeDuty,
    lessAbatement: assumptions.estateDutyAbatement,
    lessSpousalDeduction: spousalDeduction,
    dutiableEstate,
    estimatedEstateDuty,
  };

  // Capital Gains Tax on Death
  const inclusionAmount = totalUnrealisedGains * assumptions.cgtInclusionRate;
  // CGT rate = marginal rate (assume 45% for high net worth estates)
  const marginalRate = 0.45;
  const estimatedCGT = inclusionAmount * marginalRate;

  const cgtOnDeath = {
    totalUnrealisedGains,
    inclusionAmount,
    estimatedCGT,
  };

  // Net Estate for Heirs
  const netEstateForHeirs = netEstateBeforeDuty - estimatedEstateDuty - estimatedCGT;

  return {
    grossEstateAssets,
    retirementFunds,
    liabilities: liabilitiesBreakdown,
    administrationCosts,
    estateDuty,
    cgtOnDeath,
    netEstateForHeirs,
  };
}

/**
 * Step 2: Analyze Liquidity
 */
function analyzeLiquidity(
  inputs: EstatePlanningInputs,
  balanceSheet: DeathBalanceSheet
): LiquidityAnalysis {
  const { assets, lifePolicies } = inputs;

  const liquidAssets = {
    cash: 0,
    moneyMarket: 0,
    listedInvestments: 0,
    total: 0,
  };

  const semiLiquidAssets = {
    endowments: 0,
    unlisted: 0,
    total: 0,
  };

  const illiquidAssets = {
    property: 0,
    businessInterests: 0,
    personalAssets: 0,
    total: 0,
  };

  assets.forEach((asset) => {
    if (!asset.includeInEstate || asset.type === 'retirement') {
      return;
    }

    const value = asset.currentValue * (asset.ownershipPercentage / 100);
    const liquidity = asset.liquidity || classifyLiquidity(asset.type, asset.subType);

    if (liquidity === 'liquid') {
      if (asset.subType === 'bank_account' || asset.subType === 'cash') {
        liquidAssets.cash += value;
      } else if (asset.subType === 'money_market') {
        liquidAssets.moneyMarket += value;
      } else {
        liquidAssets.listedInvestments += value;
      }
      liquidAssets.total += value;
    } else if (liquidity === 'semi_liquid') {
      if (asset.subType === 'endowment') {
        semiLiquidAssets.endowments += value;
      } else {
        semiLiquidAssets.unlisted += value;
      }
      semiLiquidAssets.total += value;
    } else {
      if (asset.type === 'property') {
        illiquidAssets.property += value;
      } else if (asset.type === 'business') {
        illiquidAssets.businessInterests += value;
      } else {
        illiquidAssets.personalAssets += value;
      }
      illiquidAssets.total += value;
    }
  });

  // Policies payable to estate
  let policiesPayableToEstate = 0;
  lifePolicies.forEach((policy) => {
    if (policy.payableToEstate) {
      policiesPayableToEstate += policy.sumAssured;
    }
  });

  // Liquidity required
  const liquidityRequired = {
    liabilities: balanceSheet.liabilities.total,
    administrationCosts: balanceSheet.administrationCosts.total,
    estateDuty: balanceSheet.estateDuty.estimatedEstateDuty,
    cgt: balanceSheet.cgtOnDeath.estimatedCGT,
    cashBequests: 0, // Could be added from will info
    total: 0,
  };

  liquidityRequired.total =
    liquidityRequired.liabilities +
    liquidityRequired.administrationCosts +
    liquidityRequired.estateDuty +
    liquidityRequired.cgt +
    liquidityRequired.cashBequests;

  // Liquidity available
  const liquidityAvailable = liquidAssets.total + policiesPayableToEstate;

  // Shortfall
  const liquidityShortfall = Math.max(0, liquidityRequired.total - liquidityAvailable);
  const liquidityRisk = assessLiquidityRisk(liquidityShortfall);

  // Recommendations
  const liquidityRecommendations: string[] = [];

  if (liquidityRisk === 'severe') {
    liquidityRecommendations.push(
      `Critical liquidity shortfall of R${formatCurrency(liquidityShortfall)} identified`
    );
    liquidityRecommendations.push(
      'Estate may need to sell property or business interests under pressure'
    );
    liquidityRecommendations.push(
      'Consider increasing life cover payable to the estate to address shortfall'
    );
  } else if (liquidityRisk === 'moderate') {
    liquidityRecommendations.push(
      `Moderate liquidity shortfall of R${formatCurrency(liquidityShortfall)}`
    );
    liquidityRecommendations.push(
      'Semi-liquid assets may need to be accessed - ensure executors are aware'
    );
  } else {
    liquidityRecommendations.push('Estate has sufficient liquidity to cover obligations');
  }

  if (illiquidAssets.total > liquidAssets.total * 3) {
    liquidityRecommendations.push(
      'Estate is heavily weighted towards illiquid assets - plan for potential forced sales'
    );
  }

  return {
    liquidAssets,
    semiLiquidAssets,
    illiquidAssets,
    policiesPayableToEstate,
    liquidityRequired,
    liquidityAvailable,
    liquidityShortfall,
    liquidityRisk,
    liquidityRecommendations,
  };
}

/**
 * Step 3: Check Beneficiary Alignment
 */
function checkBeneficiaryAlignment(inputs: EstatePlanningInputs): BeneficiaryAlignment {
  const { willInfo, lifePolicies, assets } = inputs;

  // Extract beneficiaries from will (simplified)
  const willBeneficiaries: string[] = [];
  if (inputs.familyInfo.spouseName) {
    willBeneficiaries.push(inputs.familyInfo.spouseName);
  }
  inputs.dependants.forEach((dep) => willBeneficiaries.push(dep.name));

  // Extract beneficiaries from policies
  const policyBeneficiaries: string[] = [];
  lifePolicies.forEach((policy) => {
    policy.beneficiaries.forEach((ben) => {
      if (!policyBeneficiaries.includes(ben.name)) {
        policyBeneficiaries.push(ben.name);
      }
    });
  });

  // Extract beneficiaries from retirement funds
  const retirementBeneficiaries: string[] = [];
  assets
    .filter((a) => a.type === 'retirement')
    .forEach((asset: { type: string; beneficiaryDetails?: string; [key: string]: unknown }) => {
      if (asset.beneficiaryDetails) {
        retirementBeneficiaries.push(asset.beneficiaryDetails);
      }
    });

  // Check alignment
  const misalignmentIssues: string[] = [];

  // Check for estate vs nominated beneficiaries
  const estatePayouts = lifePolicies.filter((p) => p.beneficiaryType === 'estate').length;
  const nominatedPayouts = lifePolicies.filter((p) => p.beneficiaryType === 'nominated').length;

  if (estatePayouts > 0 && nominatedPayouts > 0) {
    misalignmentIssues.push(
      'Mix of estate and nominated beneficiaries - ensure this aligns with intentions'
    );
  }

  // Check for ceded policies
  const cededPolicies = lifePolicies.filter((p) => p.cededTo);
  if (cededPolicies.length > 0) {
    misalignmentIssues.push(
      `${cededPolicies.length} policy/policies ceded to creditors - may not be available for family`
    );
  }

  const alignmentStatus: 'aligned' | 'misaligned' | 'unknown' =
    misalignmentIssues.length > 0 ? 'misaligned' : 'aligned';

  const recommendations: string[] = [];

  if (willInfo.hasValidWill === 'no' || willInfo.hasValidWill === 'unknown') {
    recommendations.push('Urgent: Draft or update will to ensure wishes are documented');
  }

  if (alignmentStatus === 'misaligned') {
    recommendations.push('Review all beneficiary nominations to ensure consistency with will');
  }

  recommendations.push('Conduct annual beneficiary nomination review');

  return {
    willBeneficiaries,
    policyBeneficiaries,
    retirementBeneficiaries,
    alignmentStatus,
    misalignmentIssues,
    recommendations,
  };
}

/**
 * Step 4: Analyze Minor Children
 */
function analyzeMinorChildren(
  inputs: EstatePlanningInputs,
  balanceSheet: DeathBalanceSheet
): MinorChildrenAnalysis {
  const minorChildren = inputs.dependants.filter((d) => d.age < 18);
  const hasMinorChildren = minorChildren.length > 0;

  if (!hasMinorChildren) {
    return {
      hasMinorChildren: false,
      minorChildren: [],
      guardianNominated: false,
      capitalForMinors: 0,
      capitalManagementStructure: 'none',
      risks: [],
      recommendations: [],
    };
  }

  const guardianNominated = inputs.willInfo.guardianNominated === 'yes';
  const capitalForMinors = balanceSheet.netEstateForHeirs; // Simplified

  // Determine capital management structure
  let capitalManagementStructure: 'guardian_fund' | 'testamentary_trust' | 'inter_vivos_trust' | 'none' = 'none';
  
  if (inputs.hasTrusts) {
    capitalManagementStructure = 'inter_vivos_trust';
  } else if (inputs.willInfo.specialBequests.some((b) => b.toLowerCase().includes('trust'))) {
    capitalManagementStructure = 'testamentary_trust';
  } else if (capitalForMinors > 0) {
    capitalManagementStructure = 'guardian_fund'; // Default for minors
  }

  const risks: string[] = [];
  const recommendations: string[] = [];

  if (!guardianNominated) {
    risks.push('No guardian nominated for minor children');
    recommendations.push('URGENT: Nominate guardians in your will');
  }

  if (capitalManagementStructure === 'guardian_fund') {
    risks.push(
      'Capital for minors may end up in Guardian\'s Fund with restricted access'
    );
    recommendations.push('Consider establishing a testamentary trust for flexible capital management');
  }

  if (capitalManagementStructure === 'none' && capitalForMinors > 50000) {
    risks.push('No structured plan for managing capital for minor children');
    recommendations.push('Establish trust structure or clear testamentary provisions');
  }

  return {
    hasMinorChildren,
    minorChildren,
    guardianNominated,
    guardianDetails: inputs.willInfo.guardianName,
    capitalForMinors,
    capitalManagementStructure,
    risks,
    recommendations,
  };
}

/**
 * Step 5: Analyze Business Continuity
 */
function analyzeBusinessContinuity(inputs: EstatePlanningInputs): BusinessContinuityAnalysis {
  const businessAssets = inputs.assets.filter(
    (a) => a.type === 'business'
  ) as BusinessAsset[];

  const hasBusinessInterests = businessAssets.length > 0;

  if (!hasBusinessInterests) {
    return {
      hasBusinessInterests: false,
      businessAssets: [],
      buyAndSellAgreements: {
        inPlace: false,
        funded: false,
        fundingAmount: 0,
      },
      continuityRisks: [],
      recommendations: [],
    };
  }

  const buyAndSellInPlace = businessAssets.some((b) => b.hasBuyAndSellAgreement);
  const buyAndSellFunded = businessAssets.some((b) => b.buyAndSellFunded);
  
  const fundingAmount = businessAssets
    .filter((b) => b.buyAndSellFunded)
    .reduce((sum, b) => sum + b.currentValue, 0);

  const continuityRisks: string[] = [];
  const recommendations: string[] = [];

  if (!buyAndSellInPlace) {
    continuityRisks.push('No buy-and-sell agreements in place for business interests');
    recommendations.push(
      'Establish buy-and-sell agreements with co-owners to prevent disruption'
    );
  }

  if (buyAndSellInPlace && !buyAndSellFunded) {
    continuityRisks.push('Buy-and-sell agreements exist but are not funded');
    recommendations.push('Fund buy-and-sell with life cover to ensure liquidity');
  }

  businessAssets.forEach((asset) => {
    if (asset.currentValue > 500000 && !asset.hasBuyAndSellAgreement) {
      continuityRisks.push(
        `Substantial business interest (${asset.description}) lacks succession planning`
      );
    }
  });

  if (businessAssets.length > 0) {
    recommendations.push(
      'Review will provisions for business interests - consider specific bequests vs residue'
    );
  }

  return {
    hasBusinessInterests,
    businessAssets,
    buyAndSellAgreements: {
      inPlace: buyAndSellInPlace,
      funded: buyAndSellFunded,
      fundingAmount,
    },
    continuityRisks,
    recommendations,
  };
}

/**
 * Step 6: Identify Structural Risks
 */
function identifyStructuralRisks(
  inputs: EstatePlanningInputs,
  liquidity: LiquidityAnalysis,
  beneficiaries: BeneficiaryAlignment,
  minorChildren: MinorChildrenAnalysis,
  business: BusinessContinuityAnalysis
): StructuralRisk[] {
  const risks: StructuralRisk[] = [];

  // Will risks
  if (inputs.willInfo.hasValidWill === 'no') {
    risks.push({
      category: 'will',
      severity: 'high',
      issue: 'No valid will in place',
      impact: 'Estate will be distributed according to intestate succession law, which may not align with your wishes',
      recommendation: 'Draft a comprehensive will immediately',
    });
  } else if (inputs.willInfo.willNeedsUpdate) {
    risks.push({
      category: 'will',
      severity: 'medium',
      issue: 'Will needs updating',
      impact: inputs.willInfo.willUpdateReason || 'Current will may not reflect current circumstances',
      recommendation: 'Review and update will with legal adviser',
    });
  }

  // Guardianship risks
  if (minorChildren.hasMinorChildren && !minorChildren.guardianNominated) {
    risks.push({
      category: 'guardianship',
      severity: 'high',
      issue: 'No guardian nominated for minor children',
      impact: 'Court will decide guardianship, which may not align with your preferences',
      recommendation: 'Nominate guardians in your will urgently',
    });
  }

  // Liquidity risks
  if (liquidity.liquidityRisk === 'severe') {
    risks.push({
      category: 'liquidity',
      severity: 'high',
      issue: `Severe liquidity shortfall of R${formatCurrency(liquidity.liquidityShortfall)}`,
      impact: 'Estate may be forced to sell assets at unfavorable prices to meet obligations',
      recommendation: 'Increase life cover payable to estate or restructure assets for better liquidity',
    });
  } else if (liquidity.liquidityRisk === 'moderate') {
    risks.push({
      category: 'liquidity',
      severity: 'medium',
      issue: `Moderate liquidity shortfall of R${formatCurrency(liquidity.liquidityShortfall)}`,
      impact: 'Estate may need to access semi-liquid assets or delay distributions',
      recommendation: 'Review asset allocation and consider additional liquidity provisions',
    });
  }

  // Beneficiary risks
  if (beneficiaries.alignmentStatus === 'misaligned') {
    risks.push({
      category: 'beneficiary',
      severity: 'medium',
      issue: 'Beneficiary nominations misaligned',
      impact: 'Potential conflicts between will provisions and policy/retirement nominations',
      recommendation: 'Align all beneficiary nominations with will provisions',
    });
  }

  // Business continuity risks
  if (business.hasBusinessInterests && !business.buyAndSellAgreements.inPlace) {
    risks.push({
      category: 'business',
      severity: 'high',
      issue: 'Business interests lack succession planning',
      impact: 'Heirs may inherit unwanted business interests; partners may face unwanted co-owners',
      recommendation: 'Establish funded buy-and-sell agreements',
    });
  }

  // Cross-border risks
  if (inputs.hasOffshorAssets) {
    risks.push({
      category: 'cross_border',
      severity: 'medium',
      issue: 'Estate includes offshore assets',
      impact: 'Cross-border estate and tax rules apply - complexity and potential double taxation',
      recommendation: 'Seek specialist cross-border estate planning advice',
    });
  }

  // Trust risks
  if (inputs.hasTrusts && !inputs.trustDetails) {
    risks.push({
      category: 'trust',
      severity: 'low',
      issue: 'Trust structures exist but details not fully documented',
      impact: 'May create administrative complexity on death',
      recommendation: 'Document all trust structures and ensure trustees are aware of their role',
    });
  }

  return risks;
}

/**
 * Step 7: Generate Executive Summary
 */
function generateExecutiveSummary(
  balanceSheet: DeathBalanceSheet,
  liquidity: LiquidityAnalysis,
  risks: StructuralRisk[]
) {
  const criticalRisks = risks.filter((r) => r.severity === 'high');

  const keyRecommendations: string[] = [];

  if (criticalRisks.length > 0) {
    keyRecommendations.push(`Address ${criticalRisks.length} critical estate planning risk(s) urgently`);
  }

  if (liquidity.liquidityShortfall > 0) {
    keyRecommendations.push(
      `Resolve liquidity shortfall of R${formatCurrency(liquidity.liquidityShortfall)}`
    );
  }

  keyRecommendations.push('Conduct annual estate planning review');
  keyRecommendations.push('Ensure all beneficiary nominations are current');

  return {
    grossEstateValue: balanceSheet.grossEstateAssets.total,
    netEstateValue: balanceSheet.netEstateForHeirs,
    liquidityShortfall: liquidity.liquidityShortfall,
    criticalRisksCount: criticalRisks.length,
    keyRecommendations,
  };
}

/**
 * Step 8: Integration with Other FNAs
 */
function analyzeIntegration(
  inputs: EstatePlanningInputs,
  balanceSheet: DeathBalanceSheet
) {
  // Calculate total death benefits
  const totalDeathBenefits =
    inputs.lifePolicies.reduce((sum, p) => sum + p.sumAssured, 0) +
    balanceSheet.retirementFunds.total +
    balanceSheet.netEstateForHeirs;

  // Simplified adequacy check
  const lifeCoverAdequacy: 'adequate' | 'shortfall' | 'unknown' =
    totalDeathBenefits > balanceSheet.liabilities.total * 2 ? 'adequate' : 'shortfall';

  const notes: string[] = [];

  notes.push(
    `Total death benefits (life cover + retirement + estate): R${formatCurrency(totalDeathBenefits)}`
  );

  if (lifeCoverAdequacy === 'shortfall') {
    notes.push('Consider Risk Planning FNA for comprehensive needs analysis');
  }

  return {
    lifeCoverAdequacy,
    retirementAligned: true,
    notes,
  };
}

/**
 * Main calculation entry point
 */
export const EstatePlanningCalculationService = {
  calculateEstatePlan(inputs: EstatePlanningInputs): EstatePlanningResults {
    // Step 1: Build Death Balance Sheet
    const deathBalanceSheet = buildDeathBalanceSheet(inputs);

    // Step 2: Liquidity Analysis
    const liquidityAnalysis = analyzeLiquidity(inputs, deathBalanceSheet);

    // Step 3: Beneficiary Alignment Check
    const beneficiaryAlignment = checkBeneficiaryAlignment(inputs);

    // Step 4: Minor Children Analysis
    const minorChildrenAnalysis = analyzeMinorChildren(inputs, deathBalanceSheet);

    // Step 5: Business Continuity
    const businessContinuity = analyzeBusinessContinuity(inputs);

    // Step 6: Identify Structural Risks
    const structuralRisks = identifyStructuralRisks(
      inputs,
      liquidityAnalysis,
      beneficiaryAlignment,
      minorChildrenAnalysis,
      businessContinuity
    );

    // Step 7: Executive Summary
    const executiveSummary = generateExecutiveSummary(
      deathBalanceSheet,
      liquidityAnalysis,
      structuralRisks
    );

    // Step 8: Integration with Other FNAs
    const integrationWithOtherFNAs = analyzeIntegration(inputs, deathBalanceSheet);

    return {
      deathBalanceSheet,
      liquidityAnalysis,
      beneficiaryAlignment,
      minorChildrenAnalysis,
      businessContinuity,
      structuralRisks,
      executiveSummary,
      integrationWithOtherFNAs,
    };
  }
};