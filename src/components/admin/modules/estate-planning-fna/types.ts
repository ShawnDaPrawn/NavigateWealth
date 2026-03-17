/**
 * Estate Planning FNA Types
 * Comprehensive estate planning analysis on death
 */

// ============= PERSONAL & FAMILY INFORMATION =============

export interface FamilyInformation {
  fullName: string;
  dateOfBirth: string;
  age: number;
  maritalStatus: 'single' | 'married_cop' | 'married_anc' | 'married_customary' | 'divorced' | 'widowed';
  spouseName?: string;
  spouseId?: string;
  spouseAge?: number;
  citizenship: string;
  taxResidency: string;
}

export interface Dependant {
  name: string;
  age: number;
  relationship: string;
  specialNeeds: boolean;
}

// ============= WILL & ESTATE DOCUMENTS =============

export interface WillInformation {
  hasValidWill: 'yes' | 'no' | 'unknown';
  dateOfLastWill?: string;
  executorNominated: 'person' | 'professional' | 'none' | 'unknown';
  executorName?: string;
  guardianNominated: 'yes' | 'no' | 'unknown';
  guardianName?: string;
  specialBequests: string[];
  willNeedsUpdate: boolean;
  willUpdateReason?: string;
}

// ============= ASSETS =============

export interface AssetItem {
  id: string;
  type: 'property' | 'financial' | 'business' | 'personal' | 'retirement';
  subType: string;
  description: string;
  currentValue: number;
  ownership: 'sole' | 'joint' | 'trust' | 'company';
  ownershipPercentage: number;
  location: 'south_africa' | 'offshore';
  liquidity: 'liquid' | 'semi_liquid' | 'illiquid';
  includeInEstate: boolean;
}

export interface PropertyAsset extends AssetItem {
  type: 'property';
  subType: 'primary_residence' | 'rental' | 'commercial' | 'farm' | 'vacant_land';
  purchasePrice: number;
  unrealisedGain: number;
  bondedAmount: number;
}

export interface FinancialAsset extends AssetItem {
  type: 'financial';
  subType: 'bank_account' | 'unit_trust' | 'shares' | 'endowment' | 'cash';
}

export interface BusinessAsset extends AssetItem {
  type: 'business';
  subType: 'private_company_shares' | 'cc_membership' | 'partnership' | 'sole_proprietor';
  hasBuyAndSellAgreement: boolean;
  buyAndSellFunded: boolean;
}

export interface PersonalAsset extends AssetItem {
  type: 'personal';
  subType: 'vehicle' | 'art' | 'jewellery' | 'other';
}

export interface RetirementAsset extends AssetItem {
  type: 'retirement';
  subType: 'pension' | 'provident' | 'ra' | 'preservation';
  beneficiaryNominated: boolean;
  beneficiaryDetails?: string;
}

export type EstatePlanningAsset = PropertyAsset | FinancialAsset | BusinessAsset | PersonalAsset | RetirementAsset;

// ============= LIABILITIES =============

export interface LiabilityItem {
  id: string;
  type: 'home_loan' | 'vehicle_finance' | 'personal_loan' | 'credit_card' | 'business_debt' | 'tax_liability' | 'other';
  description: string;
  outstandingBalance: number;
  securedAgainst?: string;
  lifeCoverCeded: boolean;
  creditorName?: string;
}

// ============= RISK POLICIES & BENEFICIARIES =============

export interface LifePolicyBeneficiary {
  name: string;
  relationship: string;
  percentage: number;
}

export interface LifePolicy {
  id: string;
  policyType: 'life_cover' | 'group_life' | 'funeral';
  sumAssured: number;
  ownership: 'client' | 'spouse' | 'trust' | 'company' | 'other';
  beneficiaryType: 'estate' | 'nominated' | 'trust' | 'spouse' | 'children';
  beneficiaries: LifePolicyBeneficiary[];
  cededTo?: string;
  payableToEstate: boolean;
}

// ============= ESTATE PLANNING INPUTS =============

export interface EstatePlanningInputs {
  // Personal & Family
  familyInfo: FamilyInformation;
  dependants: Dependant[];

  // Will & Documents
  willInfo: WillInformation;

  // Assets
  assets: EstatePlanningAsset[];

  // Liabilities
  liabilities: LiabilityItem[];

  // Life Policies
  lifePolicies: LifePolicy[];

  // Administration Assumptions
  assumptions: {
    executorFeePercentage: number; // e.g., 3.5%
    conveyancingFeesPerProperty: number;
    masterFeesEstimate: number;
    funeralCostsEstimate: number;
    estateDutyRate: number; // e.g., 0.20 for 20%
    estateDutyAbatement: number; // e.g., R3.5 million
    spousalBequest: boolean; // Whether spouse inherits (affects estate duty)
    cgtInclusionRate: number; // e.g., 0.40 for individuals
  };

  // Cross-border & Trust Flags
  hasOffshorAssets: boolean;
  hasTrusts: boolean;
  trustDetails?: string;

  // Planning Context
  planningNotes: string;
}

// ============= DEATH BALANCE SHEET =============

export interface DeathBalanceSheet {
  // Gross Estate
  grossEstateAssets: {
    property: number;
    financial: number;
    business: number;
    personal: number;
    deemedProperty: number; // Certain life policies
    total: number;
  };

  // Retirement (separate - not part of estate for duty calc)
  retirementFunds: {
    pension: number;
    provident: number;
    ra: number;
    total: number;
  };

  // Liabilities
  liabilities: {
    homeLoan: number;
    vehicleFinance: number;
    personalLoans: number;
    creditCards: number;
    businessDebts: number;
    taxLiabilities: number;
    total: number;
  };

  // Administration Costs
  administrationCosts: {
    funeralCosts: number;
    executorFees: number;
    conveyancingFees: number;
    masterFees: number;
    otherCosts: number;
    total: number;
  };

  // Estate Duty Calculation
  estateDuty: {
    grossEstate: number;
    lessLiabilities: number;
    lessCosts: number;
    netEstateBeforeDuty: number;
    lessAbatement: number;
    lessSpousalDeduction: number;
    dutiableEstate: number;
    estimatedEstateDuty: number;
  };

  // Capital Gains Tax on Death
  cgtOnDeath: {
    totalUnrealisedGains: number;
    inclusionAmount: number;
    estimatedCGT: number;
  };

  // Net Estate
  netEstateForHeirs: number;
}

// ============= LIQUIDITY ANALYSIS =============

export interface LiquidityAnalysis {
  liquidAssets: {
    cash: number;
    moneyMarket: number;
    listedInvestments: number;
    total: number;
  };

  semiLiquidAssets: {
    endowments: number;
    unlisted: number;
    total: number;
  };

  illiquidAssets: {
    property: number;
    businessInterests: number;
    personalAssets: number;
    total: number;
  };

  policiesPayableToEstate: number;

  liquidityRequired: {
    liabilities: number;
    administrationCosts: number;
    estateDuty: number;
    cgt: number;
    cashBequests: number;
    total: number;
  };

  liquidityAvailable: number;
  liquidityShortfall: number;
  liquidityRisk: 'none' | 'moderate' | 'severe';
  liquidityRecommendations: string[];
}

// ============= BENEFICIARY ALIGNMENT =============

export interface BeneficiaryAlignment {
  willBeneficiaries: string[];
  policyBeneficiaries: string[];
  retirementBeneficiaries: string[];
  
  alignmentStatus: 'aligned' | 'misaligned' | 'unknown';
  misalignmentIssues: string[];
  recommendations: string[];
}

// ============= STRUCTURAL RISKS =============

export interface StructuralRisk {
  category: 'will' | 'guardianship' | 'beneficiary' | 'liquidity' | 'business' | 'cross_border' | 'trust';
  severity: 'high' | 'medium' | 'low';
  issue: string;
  impact: string;
  recommendation: string;
}

// ============= MINOR CHILDREN ANALYSIS =============

export interface MinorChildrenAnalysis {
  hasMinorChildren: boolean;
  minorChildren: Dependant[];
  guardianNominated: boolean;
  guardianDetails?: string;
  capitalForMinors: number;
  capitalManagementStructure: 'guardian_fund' | 'testamentary_trust' | 'inter_vivos_trust' | 'none';
  risks: string[];
  recommendations: string[];
}

// ============= BUSINESS CONTINUITY =============

export interface BusinessContinuityAnalysis {
  hasBusinessInterests: boolean;
  businessAssets: BusinessAsset[];
  buyAndSellAgreements: {
    inPlace: boolean;
    funded: boolean;
    fundingAmount: number;
  };
  continuityRisks: string[];
  recommendations: string[];
}

// ============= ESTATE PLANNING RESULTS =============

export interface EstatePlanningResults {
  deathBalanceSheet: DeathBalanceSheet;
  liquidityAnalysis: LiquidityAnalysis;
  beneficiaryAlignment: BeneficiaryAlignment;
  minorChildrenAnalysis: MinorChildrenAnalysis;
  businessContinuity: BusinessContinuityAnalysis;
  structuralRisks: StructuralRisk[];
  
  executiveSummary: {
    grossEstateValue: number;
    netEstateValue: number;
    liquidityShortfall: number;
    criticalRisksCount: number;
    keyRecommendations: string[];
  };

  integrationWithOtherFNAs: {
    lifeCoverAdequacy: 'adequate' | 'shortfall' | 'unknown';
    retirementAligned: boolean;
    notes: string[];
  };
}

// ============= ESTATE PLANNING SESSION =============

export interface EstatePlanningSession {
  id: string;
  clientId: string;
  adviserId: string;
  version: number;
  status: 'draft' | 'published';
  inputs: EstatePlanningInputs;
  results: EstatePlanningResults | null;
  adviserNotes: string;
  createdAt: string;
  updatedAt: string;
}

// ============= WIZARD STEPS =============

/**
 * INTENTIONAL DEVIATION from standard 4-step WizardStep = 1 | 2 | 3 | 4 pattern.
 *
 * Estate Planning uses a 7-step string-based workflow because the domain requires
 * dedicated steps for family overview, will documents, assets, liabilities,
 * policies/beneficiaries, assumptions, and final review — each with distinct
 * data collection needs that don't collapse into the standard 4-step model.
 *
 * The standard 4-step modules (Risk, Retirement, Tax, Medical) follow
 * WizardStep = 1 | 2 | 3 | 4 with a consistent state shape defined in their types.ts.
 */
export type EstatePlanningWizardStep =
  | 'family-overview'
  | 'will-documents'
  | 'assets-review'
  | 'liabilities-review'
  | 'policies-beneficiaries'
  | 'assumptions'
  | 'review-calculate';