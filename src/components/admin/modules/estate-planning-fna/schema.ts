/**
 * Estate Planning FNA Validation Schemas
 * Zod schemas for form validation and type inference
 *
 * Note: Estate Planning has a complex nested input structure.
 * Sub-schemas are composed to mirror the type hierarchy in types.ts.
 */

import { z } from 'zod';

// ==================== SUB-SCHEMAS ====================

export const FamilyInformationSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  age: z.number().min(0).max(120),
  maritalStatus: z.enum(['single', 'married_cop', 'married_anc', 'married_customary', 'divorced', 'widowed']),
  spouseName: z.string().optional(),
  spouseId: z.string().optional(),
  spouseAge: z.number().min(0).max(120).optional(),
  citizenship: z.string().min(1, 'Citizenship is required'),
  taxResidency: z.string().min(1, 'Tax residency is required'),
});

export const DependantSchema = z.object({
  name: z.string().min(1, 'Dependant name is required'),
  age: z.number().min(0).max(120),
  relationship: z.string().min(1, 'Relationship is required'),
  specialNeeds: z.boolean(),
});

export const WillInformationSchema = z.object({
  hasValidWill: z.enum(['yes', 'no', 'unknown']),
  dateOfLastWill: z.string().optional(),
  executorNominated: z.enum(['person', 'professional', 'none', 'unknown']),
  executorName: z.string().optional(),
  guardianNominated: z.enum(['yes', 'no', 'unknown']),
  guardianName: z.string().optional(),
  specialBequests: z.array(z.string()),
  willNeedsUpdate: z.boolean(),
  willUpdateReason: z.string().optional(),
});

export const AssetItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['property', 'financial', 'business', 'personal', 'retirement']),
  subType: z.string().min(1),
  description: z.string().min(1, 'Asset description is required'),
  currentValue: z.number().min(0, 'Value cannot be negative'),
  ownership: z.enum(['sole', 'joint', 'trust', 'company']),
  ownershipPercentage: z.number().min(0).max(100),
  location: z.enum(['south_africa', 'offshore']),
  liquidity: z.enum(['liquid', 'semi_liquid', 'illiquid']),
  includeInEstate: z.boolean(),
  // Optional property-specific fields
  purchasePrice: z.number().min(0).optional(),
  unrealisedGain: z.number().optional(),
  bondedAmount: z.number().min(0).optional(),
  // Optional business-specific fields
  hasBuyAndSellAgreement: z.boolean().optional(),
  buyAndSellFunded: z.boolean().optional(),
  // Optional retirement-specific fields
  beneficiaryNominated: z.boolean().optional(),
  beneficiaryDetails: z.string().optional(),
});

export const LiabilityItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['home_loan', 'vehicle_finance', 'personal_loan', 'credit_card', 'business_debt', 'tax_liability', 'other']),
  description: z.string().min(1, 'Liability description is required'),
  outstandingBalance: z.number().min(0, 'Balance cannot be negative'),
  securedAgainst: z.string().optional(),
  lifeCoverCeded: z.boolean(),
  creditorName: z.string().optional(),
});

export const LifePolicyBeneficiarySchema = z.object({
  name: z.string().min(1),
  relationship: z.string().min(1),
  percentage: z.number().min(0).max(100),
});

export const LifePolicySchema = z.object({
  id: z.string().min(1),
  policyType: z.enum(['life_cover', 'group_life', 'funeral']),
  sumAssured: z.number().min(0),
  ownership: z.enum(['client', 'spouse', 'trust', 'company', 'other']),
  beneficiaryType: z.enum(['estate', 'nominated', 'trust', 'spouse', 'children']),
  beneficiaries: z.array(LifePolicyBeneficiarySchema),
  cededTo: z.string().optional(),
  payableToEstate: z.boolean(),
});

export const AssumptionsSchema = z.object({
  executorFeePercentage: z.number().min(0).max(10),
  conveyancingFeesPerProperty: z.number().min(0),
  masterFeesEstimate: z.number().min(0),
  funeralCostsEstimate: z.number().min(0),
  estateDutyRate: z.number().min(0).max(1),
  estateDutyAbatement: z.number().min(0),
  spousalBequest: z.boolean(),
  cgtInclusionRate: z.number().min(0).max(1),
});

// ==================== MAIN INPUT SCHEMA ====================

export const EstatePlanningInputSchema = z.object({
  familyInfo: FamilyInformationSchema,
  dependants: z.array(DependantSchema),
  willInfo: WillInformationSchema,
  assets: z.array(AssetItemSchema),
  liabilities: z.array(LiabilityItemSchema),
  lifePolicies: z.array(LifePolicySchema),
  assumptions: AssumptionsSchema,
  hasOffshorAssets: z.boolean(),
  hasTrusts: z.boolean(),
  trustDetails: z.string().optional(),
  planningNotes: z.string(),
});

export type EstatePlanningFormValues = z.infer<typeof EstatePlanningInputSchema>;
