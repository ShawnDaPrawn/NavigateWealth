/**
 * Tax Planning FNA Validation Schemas
 * Zod schemas for form validation and type inference
 */

import { z } from 'zod';

// ==================== INPUT VALIDATION ====================

const positiveNumber = z.number().min(0, 'Cannot be negative');

export const TaxPlanningInputSchema = z.object({
  // A) Client Profile
  age: z.number()
    .min(18, 'Minimum age is 18')
    .max(120, 'Maximum age is 120'),
  maritalStatus: z.enum(['single', 'married_in_community', 'married_out_community']),
  taxResidency: z.enum(['resident', 'non_resident', 'dual']),
  numberOfDependants: z.number().int().min(0, 'Cannot be negative'),

  // B) Income Streams (Raw, Gross, Annual)
  employmentIncome: positiveNumber,
  variableIncome: positiveNumber,
  businessIncome: positiveNumber,
  rentalIncome: positiveNumber,
  interestIncome: positiveNumber,
  dividendIncome: positiveNumber,
  foreignIncome: positiveNumber,
  capitalGainsRealised: positiveNumber,

  // C) Contributions & Allowances
  raContributions: positiveNumber,
  tfsaContributionsLifetime: positiveNumber.refine(
    (val) => val <= 500000,
    'TFSA lifetime contributions cannot exceed R500,000'
  ),
  medicalSchemeMembers: z.number().int().min(0, 'Cannot be negative'),
});

export type TaxPlanningFormValues = z.infer<typeof TaxPlanningInputSchema>;

// ==================== ADJUSTMENT LOG VALIDATION ====================

export const AdjustmentLogSchema = z.object({
  id: z.string().min(1),
  field: z.string().min(1),
  originalValue: z.union([z.number(), z.string()]),
  newValue: z.union([z.number(), z.string()]),
  reason: z.string().min(5, 'Please provide a reason for the adjustment (minimum 5 characters)'),
  timestamp: z.date(),
});

export type AdjustmentLogFormValues = z.infer<typeof AdjustmentLogSchema>;
