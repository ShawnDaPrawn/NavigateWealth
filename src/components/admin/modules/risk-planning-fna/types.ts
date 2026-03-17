/**
 * Risk Planning FNA (Financial Needs Analysis) Type Definitions
 * South African FAIS-compliant risk planning module
 * 
 * Non-Negotiable: No `any` types, all boundaries strictly typed
 */

// ==================== ENUMS & CONSTANTS ====================

export type EmploymentType = 'employed' | 'self-employed';

export type OverrideClassification = 
  | 'Affordability Constraint'
  | 'Client Specific Request'
  | 'Underwriting Limitation'
  | 'Self-Insured / Asset Base'
  | 'Incorrect Assumption'
  | 'Other';

export type IPBenefitPeriod = '6-months' | '12-months' | '24-months';

export type IPEscalationType = 'fixed-1' | 'fixed-2' | 'fixed-3' | 'fixed-4' | 'fixed-5' | 'cpi-linked' | 'level';

// ==================== INPUT TYPES ====================

export interface Dependant {
  id: string;
  relationship: string;
  dependencyTerm: number; // years
  monthlyEducationCost: number;
}

export interface ExistingCover {
  life: {
    personal: number;
    group: number;
  };
  disability: {
    personal: number;
    group: number;
  };
  severeIllness: {
    personal: number;
    group: number;
  };
  incomeProtection: {
    temporary: {
      personal: number;
      group: number;
    };
    permanent: {
      personal: number;
      group: number;
    };
  };
}

export interface IncomeProtectionSettings {
  temporary: {
    benefitPeriod: IPBenefitPeriod;
  };
  permanent: {
    escalation: IPEscalationType;
  };
}

/**
 * Step 1: Information Gathering Input
 * All fields must be collected or derived from client profile
 */
export interface InformationGatheringInput {
  // Income Information
  grossMonthlyIncome: number;
  grossAnnualIncome: number; // Derived: grossMonthlyIncome × 12
  netMonthlyIncome: number;
  netAnnualIncome: number; // Derived: netMonthlyIncome × 12
  incomeEscalationAssumption: number; // Percentage (e.g., 6 for 6%)
  
  // Personal Information
  currentAge: number;
  retirementAge: number;
  employmentType: EmploymentType;
  
  // Dependants
  dependants: Dependant[];
  
  // Financial Position
  totalOutstandingDebts: number;
  totalCurrentAssets: number;
  totalEstateValue: number; // Derived: totalCurrentAssets - totalOutstandingDebts
  
  // Spouse Information (optional)
  spouseFullName?: string;
  spouseAverageMonthlyIncome?: number;
  combinedHouseholdIncome: number; // Derived: grossMonthlyIncome + (spouseAverageMonthlyIncome || 0)
  clientIncomePercentage: number; // Derived: (grossMonthlyIncome / combinedHouseholdIncome) × 100
  
  // Household
  totalHouseholdMonthlyExpenditure: number; // From budget module
  
  // Existing Cover
  existingCover: ExistingCover;
  
  // Income Protection Settings
  incomeProtectionSettings: IncomeProtectionSettings;
}

// ==================== CALCULATION RESULT TYPES ====================

export interface LifeCoverCalculation {
  immediateCapital: {
    outstandingDebt: number;
    funeralFinalExpenses: number;
    estateCosts: number;
    total: number;
  };
  incomeReplacementCapital: {
    netAnnualIncome: number;
    incomeMultiple: number;
    total: number;
  };
  educationCapital: {
    perDependant: Array<{
      dependantId: string;
      relationship: string;
      monthlyEducationCost: number;
      dependencyTerm: number;
      total: number;
    }>;
    total: number;
  };
  grossNeed: number;
  existingCover: {
    personal: number;
    group: number;
    total: number;
  };
  netShortfall: number;
  assumptions: string[];
  riskNotes: string[];
}

export interface DisabilityCoverCalculation {
  capitalisedIncomeLoss: {
    netAnnualIncome: number;
    disabilityMultiple: number;
    total: number;
  };
  additionalDisabilityCosts: {
    homeModifications: number;
    vehicleAdaptation: number;
    medicalEquipment: number;
    onceOffCareCosts: number;
    total: number;
  };
  grossNeed: number;
  existingCover: {
    personal: number;
    group: number;
    total: number;
  };
  netShortfall: number;
  assumptions: string[];
  riskNotes: string[];
}

export interface SevereIllnessCoverCalculation {
  grossAnnualIncome: number;
  incomeMultiple: number;
  grossNeed: number;
  existingCover: {
    personal: number;
    group: number;
    total: number;
  };
  netShortfall: number;
  assumptions: string[];
  riskNotes: string[];
}

export interface IncomeProtectionCalculation {
  temporary: {
    calculatedNeed: number; // 100% of Net Monthly Income
    benefitPeriod: IPBenefitPeriod;
    existingCover: {
      personal: number;
      group: number;
      total: number;
    };
    netShortfall: number;
  };
  permanent: {
    calculatedNeed: number; // 100% of Net Monthly Income
    escalation: IPEscalationType;
    benefitTerm: number; // retirementAge - currentAge
    existingCover: {
      personal: number;
      group: number;
      total: number;
    };
    netShortfall: number;
  };
  assumptions: string[];
  riskNotes: string[];
}

/**
 * Step 2: System Auto-Calculation Output
 * All calculations deterministic and auditable
 */
export interface RiskCalculations {
  life: LifeCoverCalculation;
  disability: DisabilityCoverCalculation;
  severeIllness: SevereIllnessCoverCalculation;
  incomeProtection: IncomeProtectionCalculation;
  metadata: {
    calculatedAt: string; // ISO timestamp
    calculatedBy: string; // User ID or name
    systemVersion: string; // For audit trail
  };
}

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
  riskType: 'life' | 'disability' | 'severeIllness' | 'incomeProtectionTemporary' | 'incomeProtectionPermanent';
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

/**
 * Standard 4-step wizard type — consistent across Risk, Retirement, Tax, Medical FNA modules.
 * Estate Planning and Investment INA use multi-step string-based workflows by design.
 */
export type WizardStep = 1 | 2 | 3 | 4;

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
  
  // Step 4
  isPublishing: boolean;
  publishError?: string;
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