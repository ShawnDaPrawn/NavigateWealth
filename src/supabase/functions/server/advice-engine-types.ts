/**
 * Advice Engine Module - Type Definitions
 * Fresh file moved to root to fix bundling issues
 */

// FNA Types
export type FNAType = 'risk' | 'medical' | 'retirement' | 'investment' | 'tax' | 'estate';

// FNA Status
export type FNAStatus = 'draft' | 'published' | 'archived';

// Dependant
export interface Dependant {
  name: string;
  dateOfBirth: string;
  age: number;
  relationship: string;
  financiallyDependent: boolean;
  expectedSupportEndAge: number;
  financialDependencyPercent: number;
}

// Liability
export interface Liability {
  id: string;
  type: string;
  description: string;
  outstandingBalance: number;
  monthlyPayment: number;
  interestRate: number;
  remainingTerm: number;
}

// Asset
export interface Asset {
  id: string;
  type: string;
  description: string;
  currentValue: number;
}

// FNA Recommendation
export interface Recommendation {
  type: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  products?: string[];
  estimatedCost?: number;
}

// Base FNA
export interface FNA {
  id: string;
  type: FNAType;
  version: number;
  clientId: string;
  advisorId: string;
  status: FNAStatus;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  recommendations: Recommendation[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedBy?: string;
}

// FNA creation data
export interface FNACreate {
  clientId: string;
  autoPopulate?: boolean;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  recommendations?: Recommendation[];
}

// FNA update data
export interface FNAUpdate {
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  recommendations?: Recommendation[];
  status?: FNAStatus;
}

// Risk Planning FNA specific
export interface RiskFNAInputs {
  clientAge: number;
  hasSpouse: boolean;
  spouseAge?: number;
  dependants: Dependant[];
  monthlyIncome: number;
  monthlyExpenses: number;
  currentLifeCover: number;
  currentDisabilityCover: number;
  currentDreadDiseaseCover: number;
  liabilities: Liability[];
  assets: Asset[];
  emergencyFundMonths: number;
  educationFundRequired: number;
  retirementAge: number;
}

// Medical Aid FNA specific
export interface MedicalFNAInputs {
  clientAge: number;
  hasSpouse: boolean;
  spouseAge?: number;
  dependants: Dependant[];
  numberOfBeneficiaries: number;
  currentMedicalAid: string | null;
  currentOption: string | null;
  currentPremium: number;
  chronicConditions: string[];
  medicalHistory: string[];
}

// Retirement FNA specific
export interface RetirementFNAInputs {
  clientAge: number;
  desiredRetirementAge: number;
  currentSavings: number;
  monthlyContribution: number;
  expectedInflationRate: number;
  expectedReturnRate: number;
  desiredRetirementIncome: number;
  hasSpouse: boolean;
  spouseAge?: number;
}

// Investment INA specific
export interface InvestmentINAInputs {
  investmentGoal: string;
  investmentHorizon: number;
  lumpSumAmount: number;
  monthlyContribution: number;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  expectedReturn: number;
  currentInvestments: Asset[];
}

// Tax Planning FNA specific
export interface TaxFNAInputs {
  taxableIncome: number;
  deductions: Array<{
    type: string;
    amount: number;
  }>;
  taxCredits: Array<{
    type: string;
    amount: number;
  }>;
  retirementContributions: number;
  medicalAidContributions: number;
  donationsTax: number;
}

// Estate Planning FNA specific
export interface EstateFNAInputs {
  estateValue: number;
  hasWill: boolean;
  willLastUpdated?: string;
  hasTrust: boolean;
  trustType?: string;
  beneficiaries: Array<{
    name: string;
    relationship: string;
    percentage: number;
  }>;
  liabilities: Liability[];
  estatedutyExemption: number;
  liquidAssets: number;
}

// AI Chat
export interface AIChatRequest {
  message: string;
  context?: Record<string, unknown>;
}

export interface AIChatResponse {
  response: string;
  timestamp: string;
}

// AI Analysis
export interface AIAnalysisRequest {
  clientId: string;
  analysisType: string;
  data: Record<string, unknown>;
}

export interface AIAnalysisResponse {
  analysis: string;
  insights: string[];
  recommendations: Recommendation[];
  timestamp: string;
}