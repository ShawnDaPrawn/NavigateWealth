/**
 * Advice Engine Module - Validation Schemas
 * Fresh file moved to root to fix bundling issues
 * 
 * Comprehensive validation for Financial Needs Analysis (FNA) system.
 * Covers 6 FNA types + AI features = 40+ routes
 * 
 * Phase 3 - Increment 3.2
 * VERSION: 3.3.9 - Fix .partial() on refined schemas
 */

import { z } from 'npm:zod';
import {
  UuidSchema,
  NonEmptyStringSchema,
  OptionalStringSchema,
  PositiveIntSchema,
  NonNegativeIntSchema,
  PositiveNumberSchema,
  PercentageSchema,
  DecimalPercentageSchema,
  DecimalCurrencySchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  PastDateSchema,
  EmailSchema,
  OptionalEmailSchema,
  SaPhoneSchema,
  OptionalSaPhoneSchema,
} from './common-schemas.ts';

// Inlined validation utilities to avoid bundler import issues
function stripHtml(text: string): string {
  return text.replace(/<[^>]*>?/gm, '');
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// ============================================================================
// ENUMS & SHARED TYPES
// ============================================================================

/**
 * FNA Type enum
 */
export const FNATypeSchema = z.enum([
  'risk',
  'medical',
  'retirement',
  'investment',
  'tax',
  'estate',
]);

/**
 * FNA Status enum
 */
export const FNAStatusSchema = z.enum(['draft', 'published', 'archived']);

/**
 * Recommendation Priority
 */
export const RecommendationPrioritySchema = z.enum([
  'low',
  'medium',
  'high',
  'critical',
]);

/**
 * Relationship types for dependants
 */
export const RelationshipSchema = z.enum([
  'spouse',
  'child',
  'parent',
  'sibling',
  'other',
]);

/**
 * Risk tolerance levels
 */
export const RiskToleranceSchema = z.enum([
  'conservative',
  'moderate',
  'aggressive',
]);

// ============================================================================
// NESTED OBJECT SCHEMAS
// ============================================================================

/**
 * Dependant schema
 */
export const DependantSchema = z.object({
  name: NonEmptyStringSchema,
  dateOfBirth: IsoDateSchema,
  age: NonNegativeIntSchema,
  relationship: RelationshipSchema,
  financiallyDependent: z.boolean(),
  expectedSupportEndAge: PositiveIntSchema
    .min(1, 'Support end age must be at least 1')
    .max(99, 'Support end age cannot exceed 99'),
  financialDependencyPercent: PercentageSchema,
});

/**
 * Liability schema
 */
export const LiabilitySchema = z.object({
  id: UuidSchema.optional(), // Optional for new liabilities
  type: z.enum([
    'home_loan',
    'vehicle_finance',
    'personal_loan',
    'credit_card',
    'student_loan',
    'other',
  ]),
  description: NonEmptyStringSchema,
  outstandingBalance: DecimalCurrencySchema,
  monthlyPayment: DecimalCurrencySchema,
  interestRate: PercentageSchema,
  remainingTerm: NonNegativeIntSchema, // in months
});

/**
 * Asset schema
 */
export const AssetSchema = z.object({
  id: UuidSchema.optional(),
  type: z.enum([
    'property',
    'vehicle',
    'investment',
    'savings',
    'retirement',
    'business',
    'other',
  ]),
  description: NonEmptyStringSchema,
  currentValue: DecimalCurrencySchema,
});

/**
 * Recommendation schema
 */
export const RecommendationSchema = z.object({
  type: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description cannot exceed 2000 characters')
    .transform(stripHtml),
  priority: RecommendationPrioritySchema,
  products: z.array(NonEmptyStringSchema).optional(),
  estimatedCost: DecimalCurrencySchema.optional(),
});

/**
 * Deduction schema (for tax planning)
 */
export const DeductionSchema = z.object({
  type: NonEmptyStringSchema,
  amount: DecimalCurrencySchema,
});

/**
 * Tax Credit schema
 */
export const TaxCreditSchema = z.object({
  type: NonEmptyStringSchema,
  amount: DecimalCurrencySchema,
});

/**
 * Beneficiary schema (for estate planning)
 */
export const BeneficiarySchema = z.object({
  name: NonEmptyStringSchema,
  relationship: RelationshipSchema,
  percentage: PercentageSchema,
}).refine(
  (data) => data.percentage > 0,
  { message: 'Beneficiary percentage must be greater than 0' }
);

// ============================================================================
// BASE FNA SCHEMAS
// ============================================================================

/**
 * Base create FNA schema (common fields)
 */
export const BaseFNACreateSchema = z.object({
  clientId: UuidSchema,
  autoPopulate: z.boolean().optional(),
  inputs: z.record(z.unknown()).optional(),
  outputs: z.record(z.unknown()).optional(),
  recommendations: z.array(RecommendationSchema).optional(),
});

/**
 * Base update FNA schema
 */
export const BaseFNAUpdateSchema = z.object({
  inputs: z.record(z.unknown()).optional(),
  outputs: z.record(z.unknown()).optional(),
  recommendations: z.array(RecommendationSchema).optional(),
  status: FNAStatusSchema.optional(),
});

// ============================================================================
// RISK PLANNING FNA SCHEMAS
// ============================================================================

/**
 * Risk Planning FNA Inputs - Base Schema (No refinements)
 * Needed because .partial() cannot be used on schemas with refinements
 */
const RiskFNAInputsBaseSchema = z.object({
  // Personal information
  clientAge: PositiveIntSchema.min(18).max(99),
  hasSpouse: z.boolean(),
  spouseAge: PositiveIntSchema.min(18).max(99).optional(),
  dependants: z.array(DependantSchema).default([]),
  
  // Financial information
  monthlyIncome: DecimalCurrencySchema,
  monthlyExpenses: DecimalCurrencySchema,
  
  // Current cover
  currentLifeCover: DecimalCurrencySchema.default(0),
  currentDisabilityCover: DecimalCurrencySchema.default(0),
  currentDreadDiseaseCover: DecimalCurrencySchema.default(0),
  
  // Assets & liabilities
  liabilities: z.array(LiabilitySchema).default([]),
  assets: z.array(AssetSchema).default([]),
  
  // Planning parameters
  emergencyFundMonths: PositiveIntSchema
    .min(3, 'Emergency fund should be at least 3 months')
    .max(24, 'Emergency fund cannot exceed 24 months'),
  educationFundRequired: DecimalCurrencySchema.default(0),
  retirementAge: PositiveIntSchema.min(55).max(75),
});

/**
 * Risk Planning FNA Inputs - Refined Schema
 */
export const RiskFNAInputsSchema = RiskFNAInputsBaseSchema.refine(
  (data) => data.monthlyExpenses <= data.monthlyIncome * 1.5,
  {
    message: 'Monthly expenses cannot exceed 150% of monthly income',
    path: ['monthlyExpenses'],
  }
).refine(
  (data) => !data.hasSpouse || data.spouseAge !== undefined,
  {
    message: 'Spouse age is required when hasSpouse is true',
    path: ['spouseAge'],
  }
);

/**
 * Create Risk Planning FNA
 */
export const CreateRiskFNASchema = BaseFNACreateSchema.extend({
  inputs: RiskFNAInputsSchema.optional(),
});

/**
 * Update Risk Planning FNA
 * Uses partial of Base Schema to avoid Zod refinement error
 */
export const UpdateRiskFNASchema = BaseFNAUpdateSchema.extend({
  inputs: RiskFNAInputsBaseSchema.partial().optional(),
});

// ============================================================================
// MEDICAL AID FNA SCHEMAS
// ============================================================================

/**
 * Medical Aid FNA Inputs - Base Schema
 */
const MedicalFNAInputsBaseSchema = z.object({
  // Personal information
  clientAge: PositiveIntSchema.min(18).max(99),
  hasSpouse: z.boolean(),
  spouseAge: PositiveIntSchema.min(18).max(99).optional(),
  dependants: z.array(DependantSchema).default([]),
  numberOfBeneficiaries: PositiveIntSchema.min(1).max(20),
  
  // Current medical aid
  currentMedicalAid: OptionalStringSchema,
  currentOption: OptionalStringSchema,
  currentPremium: DecimalCurrencySchema.default(0),
  
  // Medical history
  chronicConditions: z.array(NonEmptyStringSchema).default([]),
  medicalHistory: z.array(NonEmptyStringSchema).default([]),
});

/**
 * Medical Aid FNA Inputs - Refined Schema
 */
export const MedicalFNAInputsSchema = MedicalFNAInputsBaseSchema.refine(
  (data) => !data.hasSpouse || data.spouseAge !== undefined,
  {
    message: 'Spouse age is required when hasSpouse is true',
    path: ['spouseAge'],
  }
);

/**
 * Create Medical Aid FNA
 */
export const CreateMedicalFNASchema = BaseFNACreateSchema.extend({
  inputs: MedicalFNAInputsSchema.optional(),
});

/**
 * Update Medical Aid FNA
 */
export const UpdateMedicalFNASchema = BaseFNAUpdateSchema.extend({
  inputs: MedicalFNAInputsBaseSchema.partial().optional(),
});

// ============================================================================
// RETIREMENT FNA SCHEMAS
// ============================================================================

/**
 * Retirement FNA Inputs - Base Schema
 */
const RetirementFNAInputsBaseSchema = z.object({
  // Personal information
  clientAge: PositiveIntSchema.min(18).max(75),
  desiredRetirementAge: PositiveIntSchema.min(55).max(75),
  hasSpouse: z.boolean(),
  spouseAge: PositiveIntSchema.min(18).max(75).optional(),
  
  // Current savings
  currentSavings: DecimalCurrencySchema.default(0),
  monthlyContribution: DecimalCurrencySchema.default(0),
  
  // Assumptions
  expectedInflationRate: PercentageSchema
    .min(0, 'Inflation rate cannot be negative')
    .max(20, 'Inflation rate seems unrealistic'),
  expectedReturnRate: PercentageSchema
    .min(0, 'Return rate cannot be negative')
    .max(30, 'Return rate seems unrealistic'),
  desiredRetirementIncome: DecimalCurrencySchema,
});

/**
 * Retirement FNA Inputs - Refined Schema
 */
export const RetirementFNAInputsSchema = RetirementFNAInputsBaseSchema.refine(
  (data) => data.desiredRetirementAge > data.clientAge,
  {
    message: 'Retirement age must be greater than current age',
    path: ['desiredRetirementAge'],
  }
).refine(
  (data) => data.expectedReturnRate > data.expectedInflationRate,
  {
    message: 'Expected return rate should be higher than inflation rate',
    path: ['expectedReturnRate'],
  }
).refine(
  (data) => !data.hasSpouse || data.spouseAge !== undefined,
  {
    message: 'Spouse age is required when hasSpouse is true',
    path: ['spouseAge'],
  }
);

/**
 * Create Retirement FNA
 */
export const CreateRetirementFNASchema = BaseFNACreateSchema.extend({
  inputs: RetirementFNAInputsSchema.optional(),
});

/**
 * Update Retirement FNA
 */
export const UpdateRetirementFNASchema = BaseFNAUpdateSchema.extend({
  inputs: RetirementFNAInputsBaseSchema.partial().optional(),
});

// ============================================================================
// INVESTMENT INA SCHEMAS
// ============================================================================

/**
 * Investment INA Inputs - Base Schema
 */
const InvestmentINAInputsBaseSchema = z.object({
  // Investment goals
  investmentGoal: z.enum([
    'wealth_creation',
    'income_generation',
    'capital_preservation',
    'education',
    'retirement',
    'other',
  ]),
  investmentHorizon: PositiveIntSchema
    .min(1, 'Investment horizon must be at least 1 year')
    .max(50, 'Investment horizon cannot exceed 50 years'),
  
  // Investment amounts
  lumpSumAmount: DecimalCurrencySchema.default(0),
  monthlyContribution: DecimalCurrencySchema.default(0),
  
  // Risk profile
  riskTolerance: RiskToleranceSchema,
  expectedReturn: PercentageSchema
    .min(0, 'Expected return cannot be negative')
    .max(30, 'Expected return seems unrealistic'),
  
  // Current investments
  currentInvestments: z.array(AssetSchema).default([]),
});

/**
 * Investment INA Inputs - Refined Schema
 */
export const InvestmentINAInputsSchema = InvestmentINAInputsBaseSchema.refine(
  (data) => data.lumpSumAmount > 0 || data.monthlyContribution > 0,
  {
    message: 'Either lump sum or monthly contribution must be greater than 0',
    path: ['lumpSumAmount'],
  }
);

/**
 * Create Investment INA
 */
export const CreateInvestmentINASchema = BaseFNACreateSchema.extend({
  inputs: InvestmentINAInputsSchema.optional(),
});

/**
 * Update Investment INA
 */
export const UpdateInvestmentINASchema = BaseFNAUpdateSchema.extend({
  inputs: InvestmentINAInputsBaseSchema.partial().optional(),
});

// ============================================================================
// TAX PLANNING FNA SCHEMAS
// ============================================================================

/**
 * Tax Planning FNA Inputs - Base Schema
 */
const TaxFNAInputsBaseSchema = z.object({
  // Income
  taxableIncome: DecimalCurrencySchema,
  
  // Deductions
  deductions: z.array(DeductionSchema).default([]),
  taxCredits: z.array(TaxCreditSchema).default([]),
  
  // Contributions
  retirementContributions: DecimalCurrencySchema.default(0),
  medicalAidContributions: DecimalCurrencySchema.default(0),
  donationsTax: DecimalCurrencySchema.default(0),
});

/**
 * Tax Planning FNA Inputs - Refined Schema
 */
export const TaxFNAInputsSchema = TaxFNAInputsBaseSchema.refine(
  (data) => {
    const totalDeductions = data.deductions.reduce((sum, d) => sum + d.amount, 0);
    return totalDeductions <= data.taxableIncome;
  },
  {
    message: 'Total deductions cannot exceed taxable income',
    path: ['deductions'],
  }
);

/**
 * Create Tax Planning FNA
 */
export const CreateTaxFNASchema = BaseFNACreateSchema.extend({
  inputs: TaxFNAInputsSchema.optional(),
});

/**
 * Update Tax Planning FNA
 */
export const UpdateTaxFNASchema = BaseFNAUpdateSchema.extend({
  inputs: TaxFNAInputsBaseSchema.partial().optional(),
});

// ============================================================================
// ESTATE PLANNING FNA SCHEMAS
// ============================================================================

/**
 * Estate Planning FNA Inputs - Base Schema
 */
const EstateFNAInputsBaseSchema = z.object({
  // Estate value
  estateValue: DecimalCurrencySchema,
  
  // Will & Trust
  hasWill: z.boolean(),
  willLastUpdated: IsoDateSchema.optional(),
  hasTrust: z.boolean(),
  trustType: z.enum(['testamentary', 'inter_vivos', 'special', 'other']).optional(),
  
  // Beneficiaries
  beneficiaries: z.array(BeneficiarySchema).default([]),
  
  // Liabilities
  liabilities: z.array(LiabilitySchema).default([]),
  
  // Estate duty
  estatedutyExemption: DecimalCurrencySchema.default(3500000), // 2026 threshold
  liquidAssets: DecimalCurrencySchema.default(0),
});

/**
 * Estate Planning FNA Inputs - Refined Schema
 */
export const EstateFNAInputsSchema = EstateFNAInputsBaseSchema.refine(
  (data) => {
    if (data.beneficiaries.length === 0) return true;
    const totalPercentage = data.beneficiaries.reduce((sum, b) => sum + b.percentage, 0);
    return Math.abs(totalPercentage - 100) < 0.01; // Allow for floating point precision
  },
  {
    message: 'Total beneficiary percentages must equal 100%',
    path: ['beneficiaries'],
  }
).refine(
  (data) => !data.hasTrust || data.trustType !== undefined,
  {
    message: 'Trust type is required when hasTrust is true',
    path: ['trustType'],
  }
).refine(
  (data) => data.liquidAssets <= data.estateValue,
  {
    message: 'Liquid assets cannot exceed total estate value',
    path: ['liquidAssets'],
  }
);

/**
 * Create Estate Planning FNA
 */
export const CreateEstateFNASchema = BaseFNACreateSchema.extend({
  inputs: EstateFNAInputsSchema.optional(),
});

/**
 * Update Estate Planning FNA
 */
export const UpdateEstateFNASchema = BaseFNAUpdateSchema.extend({
  inputs: EstateFNAInputsBaseSchema.partial().optional(),
});

// ============================================================================
// PATH PARAMETER SCHEMAS
// ============================================================================

/**
 * FNA ID parameter
 */
export const FNAIdParamSchema = z.object({
  id: UuidSchema,
});

/**
 * Client ID parameter
 */
export const ClientIdParamSchema = z.object({
  clientId: UuidSchema,
});

// ============================================================================
// AI ADVISOR SCHEMAS
// ============================================================================

/**
 * AI Chat Request
 */
export const AIChatRequestSchema = z.object({
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message cannot exceed 2000 characters')
    .transform(stripHtml),
  context: z.record(z.unknown()).optional(),
});

/**
 * AI Analysis Request
 */
export const AIAnalysisRequestSchema = z.object({
  clientId: UuidSchema,
  analysisType: z.enum([
    'risk_assessment',
    'retirement_readiness',
    'investment_portfolio',
    'tax_optimization',
    'estate_efficiency',
    'comprehensive',
  ]),
  data: z.record(z.unknown()),
});

// ============================================================================
// TYPE EXPORTS (for TypeScript inference)
// ============================================================================

export type FNAType = z.infer<typeof FNATypeSchema>;
export type FNAStatus = z.infer<typeof FNAStatusSchema>;
export type Dependant = z.infer<typeof DependantSchema>;
export type Liability = z.infer<typeof LiabilitySchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type Beneficiary = z.infer<typeof BeneficiarySchema>;

// Create schemas
export type CreateRiskFNA = z.infer<typeof CreateRiskFNASchema>;
export type CreateMedicalFNA = z.infer<typeof CreateMedicalFNASchema>;
export type CreateRetirementFNA = z.infer<typeof CreateRetirementFNASchema>;
export type CreateInvestmentINA = z.infer<typeof CreateInvestmentINASchema>;
export type CreateTaxFNA = z.infer<typeof CreateTaxFNASchema>;
export type CreateEstateFNA = z.infer<typeof CreateEstateFNASchema>;

// Update schemas
export type UpdateRiskFNA = z.infer<typeof UpdateRiskFNASchema>;
export type UpdateMedicalFNA = z.infer<typeof UpdateMedicalFNASchema>;
export type UpdateRetirementFNA = z.infer<typeof UpdateRetirementFNASchema>;
export type UpdateInvestmentINA = z.infer<typeof UpdateInvestmentINASchema>;
export type UpdateTaxFNA = z.infer<typeof UpdateTaxFNASchema>;
export type UpdateEstateFNA = z.infer<typeof UpdateEstateFNASchema>;

// AI schemas
export type AIChatRequest = z.infer<typeof AIChatRequestSchema>;
export type AIAnalysisRequest = z.infer<typeof AIAnalysisRequestSchema>;