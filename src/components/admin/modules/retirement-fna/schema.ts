/**
 * Retirement FNA Validation Schemas
 * Zod schemas for form validation and type inference
 */

import { z } from 'zod';

// ==================== INPUT VALIDATION ====================

const positiveNumber = z.number().min(0, 'Cannot be negative');
const positiveOptionalNumber = z.number().min(0, 'Cannot be negative').optional();

export const RetirementFNAInputSchema = z.object({
  // Client Profile
  currentAge: z.number()
    .min(18, 'Minimum age is 18')
    .max(100, 'Maximum age is 100'),
  retirementAge: z.number()
    .min(40, 'Minimum retirement age is 40')
    .max(80, 'Maximum retirement age is 80'),

  // Current Financial Position
  currentMonthlyIncome: positiveNumber.refine(
    (val) => val > 0,
    'Monthly income must be greater than zero'
  ),
  currentMonthlyContribution: positiveNumber,
  currentRetirementSavings: positiveNumber,

  // Optional / Advanced
  existingProducts: z.array(z.unknown()).optional(),
}).refine(
  (data) => data.retirementAge > data.currentAge,
  {
    message: 'Retirement age must be greater than current age',
    path: ['retirementAge'],
  }
);

export type RetirementFNAFormValues = z.infer<typeof RetirementFNAInputSchema>;

// ==================== ADJUSTMENTS VALIDATION ====================

export const RetirementFNAAdjustmentsSchema = z.object({
  // Planning Assumptions
  retirementAge: z.number().min(40).max(80).optional(),
  yearsInRetirement: z.number().min(5).max(50).optional(),
  replacementRatio: z.number().min(0.1).max(1.0).optional(),

  // Economic Assumptions (Nominal Rates)
  inflationRate: z.number().min(0).max(0.20).optional(),
  preRetirementReturn: z.number().min(0).max(0.30).optional(),
  postRetirementReturn: z.number().min(0).max(0.30).optional(),
  salaryEscalation: z.number().min(0).max(0.20).optional(),
  premiumEscalation: z.number().min(0).max(0.20).optional(),

  // Documentation
  adviserNotes: z.string().optional(),
});

export type RetirementFNAAdjustmentsFormValues = z.infer<typeof RetirementFNAAdjustmentsSchema>;
