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
import { formatCurrencyWhole } from '../../../../utils/currencyFormatter';

/**
 * Helper Functions
 */

export function classifyLiquidity(
  assetType: string,
  subType: string,
): 'liquid' | 'semi_liquid' | 'illiquid' {
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

/**
 * Any shortfall is a risk: the executor cannot pay debts, costs and taxes from
 * cash and policies payable to the estate. It is severe from R500,000, or
 * when it is more than a quarter of the liquidity the estate needs.
 */
export function assessLiquidityRisk(
  shortfall: number,
  liquidityRequired = 0,
): 'none' | 'moderate' | 'severe' {
  if (shortfall <= 0) {
    return 'none';
  }
  if (
    shortfall >= ESTATE_PLANNING_CONSTANTS.LIQUIDITY_SHORTFALL_SEVERE_THRESHOLD ||
    (liquidityRequired > 0 &&
      shortfall > liquidityRequired * ESTATE_PLANNING_CONSTANTS.LIQUIDITY_SHORTFALL_SEVERE_RATIO)
  ) {
    return 'severe';
  }
  return 'moderate';
}

/**
 * A whole-rand amount with comma thousands, without the "R" (callers add it):
 * 2000000 → "2,000,000".
 */
export function formatCurrency(amount: number): string {
  return formatCurrencyWhole(amount).replace('R', '');
}

export type ResolvedEstateAssumptions = Required<EstatePlanningInputs['assumptions']>;

/**
 * The assumptions with defaults for the values added after analyses were
 * first published, so an older stored analysis recalculates the same way a
 * new one does.
 */
export function resolveEstateAssumptions(
  assumptions: EstatePlanningInputs['assumptions'],
): ResolvedEstateAssumptions {
  const ported = Number(assumptions.predeceasedSpouseUnusedAbatement) || 0;
  return {
    ...assumptions,
    cgtMarginalRate:
      assumptions.cgtMarginalRate ?? ESTATE_PLANNING_CONSTANTS.DEFAULT_CGT_MARGINAL_RATE,
    predeceasedSpouseUnusedAbatement: Math.min(
      Math.max(0, ported),
      ESTATE_PLANNING_CONSTANTS.MAX_PORTED_ABATEMENT,
    ),
  };
}

export function isMarried(maritalStatus: string | undefined): boolean {
  return String(maritalStatus ?? '').startsWith('married');
}

/** Estate duty: the first-tier rate up to R30m of the dutiable amount, 25% above. */
export function calculateEstateDutyTiers(dutiableAmount: number, firstRate: number) {
  const threshold = ESTATE_PLANNING_CONSTANTS.ESTATE_DUTY_UPPER_RATE_THRESHOLD;
  const upperRate = ESTATE_PLANNING_CONSTANTS.ESTATE_DUTY_UPPER_RATE;
  const amount = Math.max(0, dutiableAmount);
  const dutyAtFirstRate = Math.min(amount, threshold) * firstRate;
  const dutyAtUpperRate = Math.max(0, amount - threshold) * upperRate;
  return {
    dutyAtFirstRate,
    dutyAtUpperRate,
    total: dutyAtFirstRate + dutyAtUpperRate,
    threshold,
    upperRate,
  };
}

/**
 * The client's share of the gain on an asset at death (deemed disposal at
 * market value). Retirement funds are outside the estate; personal-use assets
 * (para 53) and endowment policies (taxed inside the policy fund) carry no
 * CGT for the client. A recorded gain wins; otherwise value less base cost.
 */
export function assetGainOnDeath(asset: EstatePlanningInputs['assets'][number]): number {
  if (asset.type === 'retirement' || asset.type === 'personal') return 0;
  if (asset.type === 'financial' && asset.subType === 'endowment') return 0;
  let gain = Number(asset.unrealisedGain) || 0;
  if (gain === 0) {
    const baseCost = Number(asset.purchasePrice) || 0;
    if (baseCost > 0) gain = (Number(asset.currentValue) || 0) - baseCost;
  }
  return gain * (asset.ownershipPercentage / 100);
}

/** A policy on the client's life that is deemed property but paid outside the estate. */
function isNominatedDeemedPolicy(policy: EstatePlanningInputs['lifePolicies'][number]): boolean {
  return (
    policy.ownership === 'client' &&
    !policy.payableToEstate &&
    !policy.isBuyAndSellPolicy &&
    policy.policyType !== 'group_life'
  );
}

/**
 * Step 1: Build Death Balance Sheet
 */
function buildDeathBalanceSheet(inputs: EstatePlanningInputs): DeathBalanceSheet {
  const { assets, liabilities, lifePolicies } = inputs;
  const assumptions = resolveEstateAssumptions(inputs.assumptions);
  const married = isMarried(inputs.familyInfo.maritalStatus);
  const spousalApplies = assumptions.spousalBequest && married;

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
  let primaryResidenceExclusion = 0;

  assets.forEach((asset) => {
    const assetValue = asset.currentValue * (asset.ownershipPercentage / 100);

    if (!asset.includeInEstate) {
      return; // Skip assets not in estate (e.g., trust-owned)
    }

    const gain = assetGainOnDeath(asset);
    totalUnrealisedGains += gain;
    if (asset.type === 'property' && asset.subType === 'primary_residence' && gain > 0) {
      // The R3m exclusion is shared between co-owners by interest held (para 45(2)).
      primaryResidenceExclusion += Math.min(
        gain,
        ESTATE_PLANNING_CONSTANTS.CGT_PRIMARY_RESIDENCE_EXCLUSION *
          (asset.ownershipPercentage / 100),
      );
    }

    if (asset.type === 'retirement') {
      // Retirement funds - separate treatment
      if (asset.subType === 'pension') retirementFunds.pension += assetValue;
      if (asset.subType === 'provident') retirementFunds.provident += assetValue;
      if (asset.subType === 'ra') retirementFunds.ra += assetValue;
      retirementFunds.total += assetValue;
    } else if (asset.type === 'property') {
      grossEstateAssets.property += assetValue;
    } else if (asset.type === 'financial') {
      grossEstateAssets.financial += assetValue;
    } else if (asset.type === 'business') {
      grossEstateAssets.business += assetValue;
    } else if (asset.type === 'personal') {
      grossEstateAssets.personal += assetValue;
    }
  });

  // Deemed property paid into the estate: part of the gross estate.
  // Deemed property paid to nominated beneficiaries: dutiable (s3(3)(a)), but
  // outside the estate, so no executor's fee and no estate liquidity.
  let nominatedDeemedProperty = 0;
  let nominatedToSpouse = 0;
  lifePolicies.forEach((policy) => {
    if (policy.payableToEstate && policy.ownership === 'client') {
      grossEstateAssets.deemedProperty += policy.sumAssured;
    } else if (isNominatedDeemedPolicy(policy)) {
      nominatedDeemedProperty += policy.sumAssured;
      if (policy.beneficiaryType === 'spouse') nominatedToSpouse += policy.sumAssured;
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

  // Calculate administration costs. The executor's tariff is quoted
  // excluding VAT; VAT is added on top.
  const propertyCount = assets.filter((a) => a.type === 'property').length;
  const executorFees = grossEstateAssets.total * (assumptions.executorFeePercentage / 100);
  const executorFeesVat = executorFees * ESTATE_PLANNING_CONSTANTS.VAT_RATE;

  const administrationCosts = {
    funeralCosts: assumptions.funeralCostsEstimate,
    executorFees,
    executorFeesVat,
    conveyancingFees: propertyCount * assumptions.conveyancingFeesPerProperty,
    masterFees: assumptions.masterFeesEstimate,
    otherCosts: 0,
    total: 0,
  };

  administrationCosts.total =
    administrationCosts.funeralCosts +
    administrationCosts.executorFees +
    administrationCosts.executorFeesVat +
    administrationCosts.conveyancingFees +
    administrationCosts.masterFees +
    administrationCosts.otherCosts;

  // Capital Gains Tax on Death (s9HA deemed disposal). Assets left to a
  // surviving spouse roll over (s9HA(2)): no CGT now, the spouse takes over
  // the base cost.
  const gainAfterResidence = totalUnrealisedGains - primaryResidenceExclusion;
  let spousalRolloverGain = 0;
  let annualExclusionOnDeath = 0;
  let taxableGain = 0;
  if (spousalApplies) {
    spousalRolloverGain = Math.max(0, gainAfterResidence);
  } else {
    annualExclusionOnDeath = Math.min(
      Math.max(0, gainAfterResidence),
      ESTATE_PLANNING_CONSTANTS.CGT_DEATH_EXCLUSION,
    );
    taxableGain = Math.max(0, gainAfterResidence - ESTATE_PLANNING_CONSTANTS.CGT_DEATH_EXCLUSION);
  }
  const inclusionAmount = taxableGain * assumptions.cgtInclusionRate;
  const estimatedCGT = inclusionAmount * assumptions.cgtMarginalRate;

  const cgtOnDeath = {
    totalUnrealisedGains,
    primaryResidenceExclusion,
    spousalRolloverGain,
    annualExclusionOnDeath,
    taxableGain,
    inclusionAmount,
    marginalRate: assumptions.cgtMarginalRate,
    estimatedCGT,
  };

  // Estate Duty Calculation. CGT on death is a debt of the deceased (s4(b)),
  // so it comes off before duty.
  const grossEstate = grossEstateAssets.total;
  const netEstateBeforeDuty = grossEstate - liabilitiesBreakdown.total - administrationCosts.total;
  const propertyForDuty = netEstateBeforeDuty - estimatedCGT + nominatedDeemedProperty;

  // s4(q): what accrues to a surviving spouse — the residue when the estate
  // passes to the spouse, and policies paid to the spouse.
  const estateToSpouse = spousalApplies ? Math.max(0, netEstateBeforeDuty - estimatedCGT) : 0;
  const policiesToSpouse = married ? nominatedToSpouse : 0;
  const spousalDeduction = Math.min(
    Math.max(0, propertyForDuty),
    estateToSpouse + policiesToSpouse,
  );

  const portedAbatement = assumptions.predeceasedSpouseUnusedAbatement;
  const totalAbatement = assumptions.estateDutyAbatement + portedAbatement;

  const dutiableEstate = Math.max(0, propertyForDuty - spousalDeduction - totalAbatement);
  const duty = calculateEstateDutyTiers(dutiableEstate, assumptions.estateDutyRate);
  const estimatedEstateDuty = duty.total;

  // s13: the duty on policies paid to beneficiaries is recoverable from them.
  const dutiableBeforeAbatement = propertyForDuty - spousalDeduction;
  const nominatedNotToSpouse = Math.max(0, nominatedDeemedProperty - policiesToSpouse);
  const dutyOnNominatedPolicies =
    dutiableBeforeAbatement > 0
      ? estimatedEstateDuty * Math.min(1, nominatedNotToSpouse / dutiableBeforeAbatement)
      : 0;

  const estateDuty = {
    grossEstate,
    lessLiabilities: liabilitiesBreakdown.total,
    lessCosts: administrationCosts.total,
    netEstateBeforeDuty,
    lessCGT: estimatedCGT,
    addDeemedPropertyNominated: nominatedDeemedProperty,
    lessAbatement: totalAbatement,
    portedAbatement,
    lessSpousalDeduction: spousalDeduction,
    dutiableEstate,
    dutyAtFirstRate: duty.dutyAtFirstRate,
    dutyAtUpperRate: duty.dutyAtUpperRate,
    upperRateThreshold: duty.threshold,
    upperRate: duty.upperRate,
    estimatedEstateDuty,
    dutyRecoverableFromBeneficiaries: dutyOnNominatedPolicies,
  };

  // Net Estate for Heirs: the estate bears the duty on its own assets; the
  // duty on policies paid to beneficiaries is recovered from them.
  const netEstateForHeirs =
    netEstateBeforeDuty - (estimatedEstateDuty - dutyOnNominatedPolicies) - estimatedCGT;

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
  balanceSheet: DeathBalanceSheet,
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
      } else if ((asset.subType as string) === 'money_market') {
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
    // s13: duty on policies paid to beneficiaries is recovered from them, so
    // the estate only needs cash for the duty on its own assets.
    estateDuty: Math.max(
      0,
      balanceSheet.estateDuty.estimatedEstateDuty -
        (balanceSheet.estateDuty.dutyRecoverableFromBeneficiaries ?? 0),
    ),
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
  const liquidityRisk = assessLiquidityRisk(liquidityShortfall, liquidityRequired.total);

  // Recommendations
  const liquidityRecommendations: string[] = [];

  if (liquidityRisk === 'severe') {
    liquidityRecommendations.push(
      `Critical liquidity shortfall of R${formatCurrency(liquidityShortfall)} identified`,
    );
    liquidityRecommendations.push(
      'Estate may need to sell property or business interests under pressure',
    );
    liquidityRecommendations.push(
      'Consider increasing life cover payable to the estate to address shortfall',
    );
  } else if (liquidityRisk === 'moderate') {
    liquidityRecommendations.push(
      `Liquidity shortfall of R${formatCurrency(liquidityShortfall)}: cash and policies payable to the estate do not cover its debts, costs and taxes`,
    );
    liquidityRecommendations.push(
      semiLiquidAssets.total >= liquidityShortfall
        ? 'Semi-liquid assets could cover it, but may be slow or costly to realise - ensure executors are aware, or add life cover payable to the estate'
        : 'Consider life cover payable to the estate to close the shortfall',
    );
  } else {
    liquidityRecommendations.push('Estate has sufficient liquidity to cover obligations');
  }

  if (illiquidAssets.total > liquidAssets.total * 3) {
    liquidityRecommendations.push(
      'Estate is heavily weighted towards illiquid assets - plan for potential forced sales',
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
    .forEach((asset) => {
      const beneficiaryDetails = (asset as { beneficiaryDetails?: string }).beneficiaryDetails;
      if (beneficiaryDetails) {
        retirementBeneficiaries.push(beneficiaryDetails);
      }
    });

  // Check alignment
  const misalignmentIssues: string[] = [];

  // Check for estate vs nominated beneficiaries
  const estatePayouts = lifePolicies.filter((p) => p.beneficiaryType === 'estate').length;
  const nominatedPayouts = lifePolicies.filter((p) => p.beneficiaryType === 'nominated').length;

  if (estatePayouts > 0 && nominatedPayouts > 0) {
    misalignmentIssues.push(
      'Mix of estate and nominated beneficiaries - ensure this aligns with intentions',
    );
  }

  // Check for ceded policies
  const cededPolicies = lifePolicies.filter((p) => p.cededTo);
  if (cededPolicies.length > 0) {
    misalignmentIssues.push(
      `${cededPolicies.length} policy/policies ceded to creditors - may not be available for family`,
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
  balanceSheet: DeathBalanceSheet,
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
  let capitalManagementStructure:
    'guardian_fund' | 'testamentary_trust' | 'inter_vivos_trust' | 'none' = 'none';

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
    risks.push("Capital for minors may end up in Guardian's Fund with restricted access");
    recommendations.push(
      'Consider establishing a testamentary trust for flexible capital management',
    );
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
  const businessAssets = inputs.assets.filter((a) => a.type === 'business') as BusinessAsset[];

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
    recommendations.push('Establish buy-and-sell agreements with co-owners to prevent disruption');
  }

  if (buyAndSellInPlace && !buyAndSellFunded) {
    continuityRisks.push('Buy-and-sell agreements exist but are not funded');
    recommendations.push('Fund buy-and-sell with life cover to ensure liquidity');
  }

  businessAssets.forEach((asset) => {
    if (asset.currentValue > 500000 && !asset.hasBuyAndSellAgreement) {
      continuityRisks.push(
        `Substantial business interest (${asset.description}) lacks succession planning`,
      );
    }
  });

  if (businessAssets.length > 0) {
    recommendations.push(
      'Review will provisions for business interests - consider specific bequests vs residue',
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
  business: BusinessContinuityAnalysis,
): StructuralRisk[] {
  const risks: StructuralRisk[] = [];

  // Will risks
  if (inputs.willInfo.hasValidWill === 'no') {
    risks.push({
      category: 'will',
      severity: 'high',
      issue: 'No valid will in place',
      impact:
        'Estate will be distributed according to intestate succession law, which may not align with your wishes',
      recommendation: 'Draft a comprehensive will immediately',
    });
  } else if (inputs.willInfo.willNeedsUpdate) {
    risks.push({
      category: 'will',
      severity: 'medium',
      issue: 'Will needs updating',
      impact:
        inputs.willInfo.willUpdateReason || 'Current will may not reflect current circumstances',
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
      recommendation:
        'Increase life cover payable to estate or restructure assets for better liquidity',
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
  risks: StructuralRisk[],
) {
  const criticalRisks = risks.filter((r) => r.severity === 'high');

  const keyRecommendations: string[] = [];

  if (criticalRisks.length > 0) {
    keyRecommendations.push(
      `Address ${criticalRisks.length} critical estate planning risk(s) urgently`,
    );
  }

  if (liquidity.liquidityShortfall > 0) {
    keyRecommendations.push(
      `Resolve liquidity shortfall of R${formatCurrency(liquidity.liquidityShortfall)}`,
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
function analyzeIntegration(inputs: EstatePlanningInputs, balanceSheet: DeathBalanceSheet) {
  // Calculate total death benefits
  // Policies payable to the estate are already inside netEstateForHeirs.
  const totalDeathBenefits =
    inputs.lifePolicies
      .filter((p) => !(p.payableToEstate && p.ownership === 'client'))
      .reduce((sum, p) => sum + p.sumAssured, 0) +
    balanceSheet.retirementFunds.total +
    balanceSheet.netEstateForHeirs;

  // Simplified adequacy check
  const lifeCoverAdequacy: 'adequate' | 'shortfall' | 'unknown' =
    totalDeathBenefits > balanceSheet.liabilities.total * 2 ? 'adequate' : 'shortfall';

  const notes: string[] = [];

  notes.push(
    `Total death benefits (life cover + retirement + estate): R${formatCurrency(totalDeathBenefits)}`,
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

function formatPercent(rate: number): string {
  const pct = rate * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(3).replace(/0+$/, '')}%`;
}

/**
 * Step 9: The assumptions behind the numbers, in words, and the points the
 * adviser must check that the calculation does not model.
 */
function describeAssumptions(
  inputs: EstatePlanningInputs,
  balanceSheet: DeathBalanceSheet,
): { assumptions: string[]; advisoryNotes: string[] } {
  const a = resolveEstateAssumptions(inputs.assumptions);
  const C = ESTATE_PLANNING_CONSTANTS;
  const married = isMarried(inputs.familyInfo.maritalStatus);
  const effectiveExecutorRate = (a.executorFeePercentage / 100) * (1 + C.VAT_RATE);

  const assumptions = [
    `Executor's fee: ${formatPercent(a.executorFeePercentage / 100)} of gross estate assets plus ${formatPercent(C.VAT_RATE)} VAT (${formatPercent(effectiveExecutorRate)} in total)`,
    `Funeral costs R${formatCurrency(a.funeralCostsEstimate)}; Master's fees R${formatCurrency(a.masterFeesEstimate)}; conveyancing R${formatCurrency(a.conveyancingFeesPerProperty)} per property`,
    `Estate duty: ${formatPercent(a.estateDutyRate)} on the first R${formatCurrency(C.ESTATE_DUTY_UPPER_RATE_THRESHOLD)} of the dutiable amount and ${formatPercent(C.ESTATE_DUTY_UPPER_RATE)} above it`,
    a.predeceasedSpouseUnusedAbatement > 0
      ? `Abatement: R${formatCurrency(a.estateDutyAbatement)} plus R${formatCurrency(a.predeceasedSpouseUnusedAbatement)} unused by a predeceased spouse (s4A)`
      : `Abatement: R${formatCurrency(a.estateDutyAbatement)} (s4A)`,
    "Policies on the client's life, owned by the client and paid to nominated beneficiaries, are deemed property for estate duty (s3(3)(a)); they are not estate assets, so they carry no executor's fee and do not help estate liquidity. The duty on them is recoverable from the beneficiaries (s13)",
    `CGT on death: deemed disposal at market value; primary residence exclusion R${formatCurrency(C.CGT_PRIMARY_RESIDENCE_EXCLUSION)} (shared by interest held); R${formatCurrency(C.CGT_DEATH_EXCLUSION)} annual exclusion in the year of death; ${formatPercent(a.cgtInclusionRate)} inclusion; taxed at a ${formatPercent(a.cgtMarginalRate)} marginal rate`,
    'CGT on death is deducted as a debt of the deceased before estate duty is worked out',
    'Retirement funds pass outside the estate; personal-use assets and endowment policies carry no CGT for the client',
  ];

  if (a.spousalBequest && married) {
    assumptions.push(
      'The estate passes to the surviving spouse: section 4(q) deduction and section 9HA(2) CGT rollover applied (the spouse takes over the base cost, so CGT is deferred, not saved)',
    );
  } else if (a.spousalBequest && !married) {
    assumptions.push(
      'A spousal bequest is set, but the client is not recorded as married, so no spousal deduction or CGT rollover is applied',
    );
  }

  const advisoryNotes: string[] = [];
  const status = inputs.familyInfo.maritalStatus;
  if (status === 'married_cop' || status === 'married_customary') {
    advisoryNotes.push(
      status === 'married_cop'
        ? "Married in community of property: only half of the joint estate belongs to the deceased. Check that ownership percentages and liabilities reflect the client's half; the surviving spouse's half is not part of this estate."
        : 'Customary marriage: unless an antenuptial contract excludes it, the marriage is in community of property and only half of the joint estate belongs to the deceased. Check ownership percentages and liabilities.',
    );
  } else if (status === 'married_anc') {
    advisoryNotes.push(
      "Married out of community of property: if the antenuptial contract includes the accrual system, an accrual claim arises on death. It is a liability of this estate if it grew more than the spouse's, or an asset if it grew less. It is not modelled here; obtain both spouses' net asset values.",
    );
  }

  if (a.predeceasedSpouseUnusedAbatement > 0 && status !== 'widowed') {
    advisoryNotes.push(
      "A ported abatement is applied, but the client is not recorded as widowed. It only applies to the estate of a surviving spouse of a previous marriage; confirm with the predeceased spouse's estate records.",
    );
  }

  const groupLife = inputs.lifePolicies.filter(
    (p) => p.policyType === 'group_life' && !p.payableToEstate,
  );
  if (groupLife.length > 0) {
    advisoryNotes.push(
      'Group life benefits paid to beneficiaries are left out of the dutiable estate, as they usually are when paid through an approved retirement fund. Cover under an unapproved scheme is dutiable deemed property; confirm the scheme type.',
    );
  }

  if (inputs.lifePolicies.some((p) => p.isBuyAndSellPolicy)) {
    advisoryNotes.push(
      'Buy-and-sell policies are excluded from deemed property (s3(3)(a)(iii)), on the basis that the premiums were not paid by the client. Confirm this with the policy and the agreement.',
    );
  }

  if (balanceSheet.estateDuty.addDeemedPropertyNominated) {
    advisoryNotes.push(
      'Policies taken out under a registered antenuptial contract for the spouse or children may be excluded from deemed property (s3(3)(a)(ii)); they are treated as dutiable here.',
    );
  }

  return { assumptions, advisoryNotes };
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
      businessContinuity,
    );

    // Step 7: Executive Summary
    const executiveSummary = generateExecutiveSummary(
      deathBalanceSheet,
      liquidityAnalysis,
      structuralRisks,
    );

    // Step 8: Integration with Other FNAs
    const integrationWithOtherFNAs = analyzeIntegration(inputs, deathBalanceSheet);

    // Step 9: Assumptions and advisory notes
    const { assumptions, advisoryNotes } = describeAssumptions(inputs, deathBalanceSheet);

    return {
      deathBalanceSheet,
      liquidityAnalysis,
      beneficiaryAlignment,
      minorChildrenAnalysis,
      businessContinuity,
      structuralRisks,
      executiveSummary,
      integrationWithOtherFNAs,
      assumptions,
      advisoryNotes,
    };
  },
};
