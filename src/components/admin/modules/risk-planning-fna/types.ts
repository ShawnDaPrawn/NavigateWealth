/**
 * Risk Planning FNA (Financial Needs Analysis) Type Definitions
 * South African FAIS-compliant risk planning module
 *
 * Non-Negotiable: No `any` types, all boundaries strictly typed
 */

import type { FNAWizardStepNumber } from '../fna';
import type {
  EmploymentType,
  IPBenefitPeriod,
  IPEscalationType,
  RiskCalculationInput as InformationGatheringInput,
  RiskCalculations,
} from '../../../../shared/fna-calculations/riskPlanning';

// ==================== ENUMS & CONSTANTS ====================

export type OverrideClassification =
  | 'Affordability Constraint'
  | 'Client Specific Request'
  | 'Underwriting Limitation'
  | 'Self-Insured / Asset Base'
  | 'Incorrect Assumption'
  | 'Other';

// ==================== INPUT & CALCULATION TYPES ====================
// The calculation engine lives in src/shared/fna-calculations/riskPlanning.ts,
// shared with the Edge Function, so its input and result types live there too.

export type {
  EmploymentType,
  IPBenefitPeriod,
  IPEscalationType,
  Dependant,
  ExistingCover,
  IncomeProtectionSettings,
  IncomeNeedBasis,
  RiskEconomicAssumptions,
  LifeCoverCalculation,
  DisabilityCoverCalculation,
  SevereIllnessCoverCalculation,
  IncomeProtectionCalculation,
  RiskCalculations,
} from '../../../../shared/fna-calculations/riskPlanning';

/**
 * Step 1: Information Gathering Input
 * All fields must be collected or derived from client profile. The assumption
 * fields (investment return, replacement ratios, education inflation, liquid
 * assets) were added in system version 3.0.0 and are optional.
 */
export type { RiskCalculationInput as InformationGatheringInput } from '../../../../shared/fna-calculations/riskPlanning';

// ==================== ADJUSTMENT TYPES ====================

export interface Override {
  originalValue: number;
  overrideValue: number;
  reason: string; // Mandatory
  classification: OverrideClassification; // Mandatory
  overriddenAt: string; // ISO timestamp
  overriddenBy: string; // User ID or name
}

export interface Adjustments {
  life?: Override;
  disability?: Override;
  severeIllness?: Override;
  incomeProtectionTemporary?: Override;
  incomeProtectionPermanent?: Override;
}

// ==================== FINAL OUTPUT TYPES ====================

export interface FinalRiskNeed {
  riskType:
    | 'life'
    | 'disability'
    | 'severeIllness'
    | 'incomeProtectionTemporary'
    | 'incomeProtectionPermanent';
  label: string;
  grossNeed: number;
  existingCoverPersonal: number;
  existingCoverGroup: number;
  existingCoverTotal: number;
  netShortfall: number;
  isOverinsured?: boolean;
  overinsuredAmount?: number;
  advisorOverride?: Override;
  finalRecommendedCover: number; // Either netShortfall or override value
  assumptions: string[];
  riskNotes: string[];
}

export interface PublishedFNA {
  id: string;
  clientId: string;
  clientName: string;
  status: 'draft' | 'published' | 'archived';

  // Step 1: Input Data
  inputData: InformationGatheringInput;

  // Step 2: Calculations
  calculations: RiskCalculations;

  // Step 3: Adjustments
  adjustments: Adjustments;

  // Step 4: Final Output
  finalNeeds: FinalRiskNeed[];
  complianceDisclaimers: string[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  createdBy: string;
  publishedBy?: string;
  version: number;
}

// ==================== WIZARD STATE ====================

/** A step of the shared four-step FNA flow — the same type in every wizard. */
export type WizardStep = FNAWizardStepNumber;

export interface WizardState {
  currentStep: WizardStep;
  clientId?: string;
  clientName?: string;

  // Step 1
  inputData: InformationGatheringInput | null;

  // Step 2
  calculations: RiskCalculations | null;

  // Step 3
  adjustments: Adjustments;
}

// ==================== API TYPES ====================

export interface CreateFNARequest {
  clientId: string;
  inputData: InformationGatheringInput;
}

export interface UpdateFNARequest {
  fnaId: string;
  inputData?: InformationGatheringInput;
  adjustments?: Adjustments;
}

export interface PublishFNARequest {
  fnaId: string;
  finalNeeds: FinalRiskNeed[];
}

export interface FNAListItem {
  id: string;
  clientId: string;
  clientName: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ==================== CLIENT PROFILE INTEGRATION ====================

/**
 * Expected shape from client profile for auto-population
 * Used to pre-fill Step 1 form
 */
export interface ClientProfileData {
  grossMonthlyIncome?: number;
  netMonthlyIncome?: number;
  currentAge?: number;
  retirementAge?: number;
  employmentType?: EmploymentType;
  dependants?: Array<{
    relationship: string;
    dependencyTerm?: number;
    monthlyEducationCost?: number;
  }>;
  totalOutstandingDebts?: number;
  totalCurrentAssets?: number;
  netWorth?: number; // From Assets & Liabilities tab
  spouseFullName?: string;
  spouseAverageMonthlyIncome?: number;
  totalHouseholdMonthlyExpenditure?: number;
}

// ==================== FORM STATE ====================

/**
 * Form values for Step 1: Information Gathering
 * Matches Zod schema validation
 */
export interface InformationGatheringFormValues {
  grossMonthlyIncome: string;
  netMonthlyIncome: string;
  incomeEscalationAssumption: string;
  currentAge: string;
  retirementAge: string;
  employmentType: EmploymentType;
  dependants: Array<{
    id: string;
    relationship: string;
    dependencyTerm: string;
    monthlyEducationCost: string;
  }>;
  totalOutstandingDebts: string;
  totalCurrentAssets: string;
  estateWorth: string; // Net Worth from Assets & Liabilities tab (editable)
  spouseFullName: string;
  spouseAverageMonthlyIncome: string;
  totalHouseholdMonthlyExpenditure: string;
  liquidAssetsAvailable: string;

  // Calculation assumptions (percentages)
  investmentReturnAssumption: string;
  incomeReplacementRatio: string;
  disabilityIncomeReplacementRatio: string;
  educationInflationAssumption: string;

  // Existing Cover
  existingCoverLifePersonal: string;
  existingCoverLifeGroup: string;
  existingCoverDisabilityPersonal: string;
  existingCoverDisabilityGroup: string;
  existingCoverSevereIllnessPersonal: string;
  existingCoverSevereIllnessGroup: string;
  existingCoverIPTemporaryPersonal: string;
  existingCoverIPTemporaryGroup: string;
  existingCoverIPPermanentPersonal: string;
  existingCoverIPPermanentGroup: string;

  // Income Protection Settings
  ipTemporaryBenefitPeriod: IPBenefitPeriod;
  ipPermanentEscalation: IPEscalationType;
}
