/**
 * FNA API Service
 * Handles all client-side read-only API calls for Financial Needs Analysis data
 *
 * Converged in Phase 4 to use shared API client and logger.
 *
 * Types in this file MUST match the actual data shapes stored by each
 * backend route file. See each *-routes.tsx for the source of truth.
 */

import { api, APIError } from '../utils/api';
import { logger } from '../utils/logger';

// ==================== SHARED BASE TYPE ====================

export interface FNABase {
  id: string;
  clientId: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedBy?: string;
}

// ==================== RISK PLANNING FNA ====================
// Source of truth: /supabase/functions/server/risk-planning-fna-routes.tsx
// KV key: risk_planning_fna:{fnaId}
// Note: Uses "inputData" (not "inputs") and "calculations" (not "results")

export interface RiskPlanningFNA extends FNABase {
  clientName: string;
  inputData: {
    grossMonthlyIncome: number;
    grossAnnualIncome: number;
    netMonthlyIncome: number;
    netAnnualIncome: number;
    incomeEscalationAssumption: number;
    currentAge: number;
    retirementAge: number;
    employmentType: string;
    dependants: Array<{
      id: string;
      relationship: string;
      dependencyTerm: number;
      monthlyEducationCost: number;
    }>;
    totalOutstandingDebts: number;
    totalCurrentAssets: number;
    totalEstateValue: number;
    spouseFullName: string;
    spouseAverageMonthlyIncome: number;
    combinedHouseholdIncome: number;
    clientIncomePercentage: number;
    totalHouseholdMonthlyExpenditure: number;
    existingCover: {
      life: { personal: number; group: number };
      disability: { personal: number; group: number };
      severeIllness: { personal: number; group: number };
      incomeProtection: {
        temporary: { personal: number; group: number };
        permanent: { personal: number; group: number };
      };
    };
    incomeProtectionSettings: Record<string, unknown>;
  };
  calculations: {
    life: Record<string, unknown>;
    disability: Record<string, unknown>;
    severeIllness: Record<string, unknown>;
    incomeProtection: Record<string, unknown>;
    metadata: {
      calculatedAt: string;
      calculatedBy: string;
      systemVersion: string;
    };
  };
  adjustments: Record<string, unknown>;
  finalNeeds: Array<{
    riskType: string;
    label: string;
    grossNeed: number;
    existingCoverPersonal: number;
    existingCoverGroup: number;
    existingCoverTotal: number;
    netShortfall: number;
    isOverinsured?: boolean;
    overinsuredAmount?: number;
    advisorOverride?: {
      originalValue: number;
      overrideValue: number;
      reason: string;
      classification: string;
    };
    finalRecommendedCover: number;
    assumptions: string[];
    riskNotes: string[];
  }>;
  complianceDisclaimers: string[];
}

// ==================== RETIREMENT FNA ====================
// Source of truth: /supabase/functions/server/retirement-fna-routes.tsx
// KV key: retirement_fna:{fnaId}
// Response format: { success, data } wrapper

export interface RetirementFNA extends FNABase {
  inputs: {
    currentAge: number;
    intendedRetirementAge?: number;
    retirementAge?: number;
    grossMonthlyIncome: number;
    netMonthlyIncome: number;
    currentMonthlyIncome?: number;
    currentMonthlyContribution: number;
    totalMonthlyContribution?: number;
    currentRetirementSavings: number;
    totalCurrentRetirementCapital?: number;
  };
  adjustments: Record<string, unknown>;
  results: {
    yearsToRetirement: number;
    yearsInRetirement: number;
    realGrowthRate: number;
    realSalaryGrowth: number;
    targetMonthlyIncome: number;
    requiredCapital: number;
    projectedCapital: number;
    capitalShortfall: number;
    hasShortfall: boolean;
    shortfallPercentage: number;
    requiredAdditionalContribution: number;
    totalRecommendedContribution: number;
    percentageOfIncome: number;
  } | null;
  metadata?: {
    systemVersion: string;
    createdAt: string;
    createdBy: string;
  };
}

// ==================== TAX PLANNING FNA ====================
// Source of truth: /supabase/functions/server/tax-planning-fna-routes.tsx
// KV key: tax-planning-fna:client:{clientId}:{sessionId}
// Note: Uses "finalResults" (not "results")

export interface TaxPlanningFNA extends FNABase {
  adviserId: string;
  inputs: {
    age: number;
    maritalStatus: string;
    taxResidency: string;
    numberOfDependants: number;
    employmentIncome: number;
    variableIncome: number;
    businessIncome: number;
    rentalIncome: number;
    interestIncome: number;
    dividendIncome: number;
    foreignIncome: number;
    capitalGainsRealised: number;
    raContributions: number;
    tfsaContributionsLifetime: number;
    medicalSchemeMembers: number;
  };
  finalResults: {
    grossIncome: number;
    interestExemption: number;
    taxableInterest: number;
    maxAllowedRADeduction: number;
    actualRADeduction: number;
    taxableIncome: number;
    incomeTaxBeforeRebates: number;
    primaryRebate: number;
    secondaryRebate: number;
    tertiaryRebate: number;
    netIncomeTax: number;
    dividendTax: number;
    cgtPayable: number;
    totalTaxLiability: number;
    effectiveTaxRate: number;
    raGap: number;
    raTaxSavingPotential: number;
    interestTaxLeakage: number;
    tfsaRemainingLifetime: number;
  };
  adjustments: Array<{
    id: string;
    field: string;
    originalValue: number | string;
    newValue: number | string;
    reason: string;
    timestamp: string;
  }>;
  recommendations: Array<{
    id: string;
    triggerType: string;
    title: string;
    description: string;
    impactValue: number;
    status: string;
    adviserComment?: string;
  }>;
  adviserNotes: string;
  generatedAt: string;
}

// ==================== MEDICAL FNA ====================
// Source of truth: /supabase/functions/server/medical-fna-routes.tsx
// KV key: medical-fna:{fnaId}
// Response format: { success, data } wrapper
// Note: Backend stores inputs from autoPopulateFromProfile() which uses
// nested structures: currentPlan, healthNeeds, preferences

export interface MedicalFNA extends FNABase {
  inputs: {
    // Personal & Household
    clientAge: number;
    maritalStatus: string;
    spouseName?: string;
    spouseDateOfBirth?: string;
    spouseAge?: number;
    dependants: Array<{
      name: string;
      dateOfBirth: string;
      age: number;
      relationship: string;
      onMedicalScheme: boolean;
      chronicConditions: string[];
      specialHealthcareNeeds: string;
    }>;
    // Income & Affordability
    netMonthlyIncome: number;
    totalMonthlyExpenses: number;
    currentMedicalExpenses: number;
    discretionarySpending: number;
    // Health & Medical Needs
    healthNeeds: {
      expectedGPVisitsPerYear: number;
      expectedSpecialistVisitsPerYear: number;
      expectedDentistVisitsPerYear: number;
      expectedOptometryVisitsPerYear: number;
      chronicConditions: string[];
      isPMBQualifying: boolean;
      chronicMedicationCostMonthly: number;
      requiresDSPCompliance: boolean;
      recentHospitalAdmissions: number;
      upcomingPlannedProcedures: Array<Record<string, unknown>>;
      maternityPlanning: boolean;
      maternityTimeframe?: string;
      highRiskLifestyleFactors: string[];
    };
    // Current Medical Aid Policy
    currentPlan: {
      schemeName: string;
      planOptionName: string;
      monthlyPremium: number;
      dependantsCovered: number;
      planType: 'hospital-only' | 'saver' | 'comprehensive' | 'network';
      hospitalBenefitLevel: number;
      hospitalNetwork: string;
      hasMedicalSavingsAccount: boolean;
      msaAmountAnnual: number;
      dayToDayLimits: Record<string, unknown>;
      chronicCoverLevel: string;
      chronicFormularyRestrictions: boolean;
      hasGapCover: boolean;
      gapCoverProvider?: string;
      gapCoverType?: string;
      gapCoverMonthlyPremium?: number;
    };
    // Preferences
    preferences: {
      networkPreference: string;
      specialistPreference: string;
      maxTolerablePremium: number;
      outOfPocketTolerance: string;
      preferenceDirection: string;
      prioritizeHospitalCover: boolean;
      prioritizeDayToDay: boolean;
      willingToUseGapCover: boolean;
    };
    // Assets
    emergencyFundSavings: number;
    severeCriticalIllnessCover: number;
  };
  // Results from calculateMedicalFNA() on the backend
  results: {
    hospitalCover?: {
      requiredTier: number;
      requiredTierRationale: string;
      currentTier: number;
      hospitalBenefitAdequacy: string;
      networkAdequacy: string;
      specialistReimbursementRisk: string;
      gapCoverNecessity: string;
      gapCoverRationale: string;
      recommendations: string[];
    };
    dayToDayCare?: {
      expectedAnnualGPCost: number;
      expectedAnnualSpecialistCost: number;
      expectedAnnualDentistCost: number;
      expectedAnnualOptometryCost: number;
      expectedAnnualChronicMedication: number;
      expectedAnnualOtherCosts: number;
      totalExpectedDayToDayCost: number;
      currentMSAAllowance: number;
      currentDayToDayLimits: number;
      projectedOutOfPocketCost: number;
      adequacyScore: string;
      isOverinsured: boolean;
      recommendations: string[];
    };
    chronicCover?: {
      hasChronicConditions: boolean;
      chronicConditionsList: string[];
      isPMBQualifying: boolean;
      formularyAdequacy: string;
      dspComplianceRequired: boolean;
      dspAccessibility: string;
      chronicCoverAdequacy: string;
      identifiedGaps: string[];
      recommendations: string[];
    };
    affordability?: {
      currentTotalPremium: number;
      premiumToIncomeRatio: number;
      affordabilityLevel: string;
      isSustainable: boolean;
      sustainabilityRationale: string;
      recommendations: string[];
    };
  } | null;
  calculations?: Record<string, unknown> | null;
  adjustments?: Record<string, unknown>;
}

// ==================== ESTATE PLANNING FNA ====================
// Source of truth: /supabase/functions/server/estate-planning-fna-routes.tsx
// KV key: estate-planning-fna:client:{clientId}:{sessionId}
// Response format: { success, data } wrapper

export interface EstatePlanningFNA extends FNABase {
  adviserId: string;
  inputs: {
    familyInfo: {
      fullName: string;
      dateOfBirth: string;
      age: number;
      maritalStatus: string;
      spouseName?: string;
      spouseAge?: number;
      citizenship: string;
      taxResidency: string;
    };
    dependants: Array<{
      name: string;
      age: number;
      relationship: string;
      specialNeeds: boolean;
    }>;
    willInfo: Record<string, unknown>;
    assets: Array<Record<string, unknown>>;
    liabilities: Array<Record<string, unknown>>;
    lifePolicies: Array<Record<string, unknown>>;
    assumptions: {
      executorFeePercentage: number;
      conveyancingFeesPerProperty: number;
      masterFeesEstimate: number;
      funeralCostsEstimate: number;
      estateDutyRate: number;
      estateDutyAbatement: number;
      spousalBequest: boolean;
      cgtInclusionRate: number;
    };
    hasOffshorAssets: boolean;
    hasTrusts: boolean;
    trustDetails?: string;
    planningNotes: string;
  };
  results: Record<string, unknown> | null;
  adviserNotes: string;
}

// ==================== INVESTMENT INA ====================
// Source of truth: /supabase/functions/server/investment-ina-routes.tsx
// KV key: investment-ina:client:{clientId}:{sessionId}
// Response format: { success, data } wrapper

export interface InvestmentINA extends FNABase {
  inputs: {
    currentAge: number;
    dateOfBirth: string;
    householdDependants: number;
    grossMonthlyIncome: number;
    netMonthlyIncome: number;
    clientRiskProfile: string;
    longTermInflationRate: number;
    expectedRealReturns: Record<string, number>;
    discretionaryInvestments: Array<{
      id: string;
      productName: string;
      provider: string;
      currentValue: number;
      monthlyContribution: number;
      riskCategory?: string;
      isDiscretionary: boolean;
    }>;
    totalDiscretionaryCapitalCurrent: number;
    totalDiscretionaryMonthlyContributions: number;
    goals: Array<Record<string, unknown>>;
  };
  results: {
    portfolioSummary: {
      totalGoals: number;
      totalRequiredCapital: number;
      totalProjectedCapital: number;
      totalFundingGap: number;
      totalAdditionalMonthlyRequired: number;
      goalsOnTrack: number;
      goalsUnderfunded: number;
      goalsOverfunded: number;
      overallPortfolioHealth: string;
    };
    goalResults: Array<Record<string, unknown>>;
    recommendations: Array<{
      goalId: string;
      goalName: string;
      action: string;
      priority: string;
      impact: string;
    }>;
    economicAssumptions: {
      inflationRate: number;
      realReturnsByProfile: Record<string, number>;
    };
    calculatedAt: string;
  } | null;
}

// ==================== UNION TYPE ====================

export type AnyFNA = RiskPlanningFNA | MedicalFNA | RetirementFNA | InvestmentINA | TaxPlanningFNA | EstatePlanningFNA;

// ==================== API FUNCTIONS ====================

/**
 * Get latest published Risk Planning FNA for a client
 * Route: /risk-planning-fna/client/:clientId/latest
 * Response: { success: true, data: PublishedFNA }
 */
export async function getRiskPlanningFNA(clientId: string): Promise<RiskPlanningFNA | null> {
  logger.debug('[FNA-API] Fetching Risk Planning FNA', { clientId });
  try {
    const response = await api.get<{ success: boolean; data: RiskPlanningFNA | null }>(
      `/risk-planning-fna/client/${clientId}/latest`
    );
    return response.data || null;
  } catch (error) {
    const isNotFound =
      (error instanceof APIError && error.statusCode === 404) ||
      (error instanceof Error && error.message?.includes('404'));

    if (isNotFound) {
      logger.debug('No published Risk Planning FNA found', { clientId });
      return null;
    }

    logger.warn('Could not fetch Risk Planning FNA', error);
    return null;
  }
}

/**
 * Get latest published Medical FNA for a client
 * Route: /medical-fna/client/:clientId/latest-published
 * Response: { success: true, data: MedicalFNA | null }
 */
export async function getMedicalFNA(clientId: string): Promise<MedicalFNA | null> {
  logger.debug('[FNA-API] Fetching Medical FNA', { clientId });
  try {
    const response = await api.get<{ success: boolean; data: MedicalFNA | null }>(
      `/medical-fna/client/${clientId}/latest-published`
    );
    return response.data || null;
  } catch (error) {
    const isNotFound =
      (error instanceof APIError && error.statusCode === 404) ||
      (error instanceof Error && error.message?.includes('404'));

    const isForbidden =
      (error instanceof APIError && error.statusCode === 403);

    if (isNotFound || isForbidden) {
      logger.debug('No published Medical FNA found (or access denied)', { clientId });
      return null;
    }

    logger.warn('Could not fetch latest published Medical FNA', error);
    return null;
  }
}

/**
 * Get latest published Retirement FNA for a client
 * Route: /retirement-fna/client/:clientId/latest-published
 * Response: { success: true, data: RetirementFNA | null }
 */
export async function getRetirementFNA(clientId: string): Promise<RetirementFNA | null> {
  logger.debug('[FNA-API] Fetching Retirement FNA', { clientId });
  try {
    const response = await api.get<{ success: boolean; data: RetirementFNA | null }>(
      `/retirement-fna/client/${clientId}/latest-published`
    );
    return response.data || null;
  } catch (error) {
    const isNotFound =
      (error instanceof APIError && error.statusCode === 404) ||
      (error instanceof Error && error.message?.includes('404'));

    if (isNotFound) {
      logger.debug('No published Retirement FNA found', { clientId });
      return null;
    }

    logger.warn('Could not fetch Retirement FNA', error);
    return null;
  }
}

/**
 * Get latest published Investment INA for a client
 * Route: /ina/investment/client/:clientId/latest-published
 * Response: { success: true, data: InvestmentINA | null }
 */
export async function getInvestmentINA(clientId: string): Promise<InvestmentINA | null> {
  logger.debug('[FNA-API] Fetching Investment INA', { clientId });
  try {
    const response = await api.get<{ success: boolean; data: InvestmentINA | null }>(
      `/ina/investment/client/${clientId}/latest-published`
    );
    return response.data || null;
  } catch (error) {
    const isNotFound =
      (error instanceof APIError && error.statusCode === 404) ||
      (error instanceof Error && error.message?.includes('404'));

    if (isNotFound) {
      logger.debug('No published Investment INA found', { clientId });
      return null;
    }

    logger.warn('Could not fetch Investment INA', error);
    return null;
  }
}

/**
 * Get latest published Tax Planning FNA for a client
 * Route: /tax-planning-fna/client/:clientId/latest-published
 * Response: { success: true, data: TaxPlanningFNA | null }
 */
export async function getTaxPlanningFNA(clientId: string): Promise<TaxPlanningFNA | null> {
  logger.debug('[FNA-API] Fetching Tax Planning FNA', { clientId });
  try {
    const response = await api.get<{ success: boolean; data: TaxPlanningFNA | null }>(
      `/tax-planning-fna/client/${clientId}/latest-published`
    );
    return response.data || null;
  } catch (error) {
    const isNotFound =
      (error instanceof APIError && error.statusCode === 404) ||
      (error instanceof Error && error.message?.includes('404'));

    if (isNotFound) {
      logger.debug('No published Tax Planning FNA found', { clientId });
      return null;
    }

    logger.warn('Could not fetch Tax Planning FNA', error);
    return null;
  }
}

/**
 * Get latest published Estate Planning FNA for a client
 * Route: /estate-planning-fna/client/:clientId/latest-published
 * Response: { success: true, data: EstatePlanningFNA | null }
 */
export async function getEstatePlanningFNA(clientId: string): Promise<EstatePlanningFNA | null> {
  logger.debug('[FNA-API] Fetching Estate Planning FNA', { clientId });
  try {
    const response = await api.get<{ success: boolean; data: EstatePlanningFNA | null }>(
      `/estate-planning-fna/client/${clientId}/latest-published`
    );
    return response.data || null;
  } catch (error) {
    const isNotFound =
      (error instanceof APIError && error.statusCode === 404) ||
      (error instanceof Error && error.message?.includes('404'));

    if (isNotFound) {
      logger.debug('No published Estate Planning FNA found', { clientId });
      return null;
    }

    logger.warn('Could not fetch Estate Planning FNA', error);
    return null;
  }
}

/**
 * Generic function to get any FNA type
 */
export async function getFNA(
  clientId: string,
  fnaType: 'risk' | 'medical' | 'retirement' | 'investment' | 'tax' | 'estate'
): Promise<AnyFNA | null> {
  switch (fnaType) {
    case 'risk':
      return getRiskPlanningFNA(clientId);
    case 'medical':
      return getMedicalFNA(clientId);
    case 'retirement':
      return getRetirementFNA(clientId);
    case 'investment':
      return getInvestmentINA(clientId);
    case 'tax':
      return getTaxPlanningFNA(clientId);
    case 'estate':
      return getEstatePlanningFNA(clientId);
    default:
      return null;
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Format currency for display (South African Rand)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Calculate time ago from date
 */
export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`;
    }
  }

  return 'just now';
}