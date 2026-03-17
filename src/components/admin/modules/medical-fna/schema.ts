/**
 * Medical FNA Input Schema
 */

import * as z from 'zod';

export const MedicalFNAInputSchema = z.object({
  // A. Household
  spousePartner: z.boolean().default(false),
  childrenCount: z.number().min(0).default(0),
  adultDependantsCount: z.number().min(0).default(0),

  // B. Risk & Utilisation
  chronicPmbCount: z.number().min(0).default(0),
  plannedProcedures24m: z.boolean().default(false),
  specialistVisitFreq: z.enum(['0-1', '2-4', '5+']).default('0-1'),
  providerChoicePreference: z.enum(['Network OK', 'Any provider']).default('Network OK'),

  // C. Day-to-day
  annualDayToDayEstimate: z.number().min(0).default(0),
  cashflowSensitivity: z.enum(['Low', 'Medium', 'High']).default('Medium'),

  // D. LJP
  currentAge: z.number().min(0).max(120).default(30),
  yearsWithoutCoverAfter35: z.number().min(0).default(0),

  // E. Existing Policy (Optional)
  existingPlanType: z.string().optional(),
  existingTotalPremium: z.number().min(0).optional(),
  existingMSA: z.number().min(0).optional(),
  existingLJP: z.number().min(0).optional(),
  existingHospitalCover: z.string().optional(),
  existingDependents: z.number().min(0).optional(),
});

export type MedicalFNAFormValues = z.infer<typeof MedicalFNAInputSchema>;