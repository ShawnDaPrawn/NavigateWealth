/**
 * Risk Planning FNA Validation Schemas
 * Zod schemas for form validation and type inference
 */

import { z } from 'zod';
import { VALIDATION_RULES } from './constants';
import type { EmploymentType, IPBenefitPeriod, IPEscalationType } from './types';

// ==================== DEPENDANT SCHEMA ====================

export const DependantSchema = z.object({
  id: z.string(),
  relationship: z.string().min(1, 'Relationship is required'),
  dependencyTerm: z.string()
    .min(1, 'Dependency term is required')
    .refine((val) => !isNaN(Number(val)), 'Must be a valid number')
    .refine(
      (val) => Number(val) >= VALIDATION_RULES.MIN_DEPENDANCY_TERM,
      `Dependency term must be at least ${VALIDATION_RULES.MIN_DEPENDANCY_TERM} years`
    )
    .refine(
      (val) => Number(val) <= VALIDATION_RULES.MAX_DEPENDANCY_TERM,
      `Dependency term cannot exceed ${VALIDATION_RULES.MAX_DEPENDANCY_TERM} years`
    ),
  monthlyEducationCost: z.string()
    .min(1, 'Education cost is required')
    .refine((val) => !isNaN(Number(val)), 'Must be a valid number')
    .refine((val) => Number(val) >= 0, 'Education cost cannot be negative'),
});

// ==================== EXISTING COVER VALIDATION ====================

const positiveNumberString = z.string()
  .transform(val => val === '' ? '0' : val) // Default empty strings to '0'
  .refine((val) => !isNaN(Number(val)), 'Must be a valid number')
  .refine((val) => Number(val) >= 0, 'Cannot be negative');

// ==================== MAIN FORM SCHEMA ====================

export const InformationGatheringSchema = z.object({
  // Income Information
  grossMonthlyIncome: z.string()
    .min(1, 'Gross monthly income is required')
    .refine((val) => !isNaN(Number(val)), 'Must be a valid number')
    .refine((val) => Number(val) >= VALIDATION_RULES.MIN_INCOME, 'Income cannot be negative'),
  
  netMonthlyIncome: z.string()
    .min(1, 'Net monthly income is required')
    .refine((val) => !isNaN(Number(val)), 'Must be a valid number')
    .refine((val) => Number(val) >= VALIDATION_RULES.MIN_INCOME, 'Income cannot be negative'),
  
  incomeEscalationAssumption: z.string()
    .min(1, 'Income escalation is required')
    .refine((val) => !isNaN(Number(val)), 'Must be a valid number')
    .refine(
      (val) => Number(val) >= 0 && Number(val) <= VALIDATION_RULES.MAX_INCOME_ESCALATION,
      `Must be between 0 and ${VALIDATION_RULES.MAX_INCOME_ESCALATION}%`
    ),
  
  // Personal Information
  currentAge: z.string()
    .min(1, 'Current age is required')
    .refine((val) => !isNaN(Number(val)), 'Must be a valid number')
    .refine(
      (val) => Number(val) >= VALIDATION_RULES.MIN_AGE && Number(val) <= VALIDATION_RULES.MAX_AGE,
      `Age must be between ${VALIDATION_RULES.MIN_AGE} and ${VALIDATION_RULES.MAX_AGE}`
    ),
  
  retirementAge: z.string()
    .min(1, 'Retirement age is required')
    .refine((val) => !isNaN(Number(val)), 'Must be a valid number')
    .refine(
      (val) => Number(val) >= VALIDATION_RULES.MIN_RETIREMENT_AGE && Number(val) <= VALIDATION_RULES.MAX_RETIREMENT_AGE,
      `Retirement age must be between ${VALIDATION_RULES.MIN_RETIREMENT_AGE} and ${VALIDATION_RULES.MAX_RETIREMENT_AGE}`
    ),
  
  employmentType: z.enum(['employed', 'self-employed'] as const),
  
  // Dependants
  dependants: z.array(DependantSchema),
  
  // Financial Position
  totalOutstandingDebts: z.string()
    .transform(val => val === '' ? '0' : val) // Default empty to '0'
    .refine((val) => !isNaN(Number(val)), 'Must be a valid number')
    .refine((val) => Number(val) >= 0, 'Cannot be negative'),
  
  totalCurrentAssets: z.string()
    .transform(val => val === '' ? '0' : val) // Default empty to '0'
    .refine((val) => !isNaN(Number(val)), 'Must be a valid number')
    .refine((val) => Number(val) >= 0, 'Cannot be negative'),
  
  estateWorth: z.string()
    .transform(val => val === '' ? '0' : val) // Default empty to '0'
    .refine((val) => !isNaN(Number(val)), 'Must be a valid number'),
  
  // Spouse Information (optional)
  spouseFullName: z.string().optional(),
  
  spouseAverageMonthlyIncome: z.string().optional(),
  
  // Household
  totalHouseholdMonthlyExpenditure: z.string()
    .transform(val => val === '' ? '0' : val) // Default empty to '0'
    .refine((val) => !isNaN(Number(val)), 'Must be a valid number')
    .refine((val) => Number(val) >= 0, 'Cannot be negative'),
  
  // Existing Cover - Life
  existingCoverLifePersonal: positiveNumberString,
  existingCoverLifeGroup: positiveNumberString,
  
  // Existing Cover - Disability
  existingCoverDisabilityPersonal: positiveNumberString,
  existingCoverDisabilityGroup: positiveNumberString,
  
  // Existing Cover - Severe Illness
  existingCoverSevereIllnessPersonal: positiveNumberString,
  existingCoverSevereIllnessGroup: positiveNumberString,
  
  // Existing Cover - Income Protection Temporary
  existingCoverIPTemporaryPersonal: positiveNumberString,
  existingCoverIPTemporaryGroup: positiveNumberString,
  
  // Existing Cover - Income Protection Permanent
  existingCoverIPPermanentPersonal: positiveNumberString,
  existingCoverIPPermanentGroup: positiveNumberString,
  
  // Income Protection Settings
  ipTemporaryBenefitPeriod: z.enum(['6-months', '12-months', '24-months'] as const),
  ipPermanentEscalation: z.enum([
    'fixed-1', 'fixed-2', 'fixed-3', 'fixed-4', 'fixed-5', 'cpi-linked', 'level'
  ] as const),
}).refine(
  (data) => Number(data.retirementAge) > Number(data.currentAge),
  {
    message: 'Retirement age must be greater than current age',
    path: ['retirementAge'],
  }
).refine(
  (data) => Number(data.netMonthlyIncome) <= Number(data.grossMonthlyIncome),
  {
    message: 'Net income cannot exceed gross income',
    path: ['netMonthlyIncome'],
  }
);

// Type inference
export type InformationGatheringFormValues = z.infer<typeof InformationGatheringSchema>;

// ==================== OVERRIDE SCHEMA ====================

export const OverrideSchema = z.object({
  originalValue: z.number().min(0),
  overrideValue: z.number().min(0),
  reason: z.string().min(10, 'Please provide a detailed reason (minimum 10 characters)'),
  classification: z.enum([
    'Affordability Constraint',
    'Client Specific Request',
    'Underwriting Limitation',
    'Self-Insured / Asset Base',
    'Incorrect Assumption',
    'Other',
  ] as const),
  overriddenAt: z.string(),
  overriddenBy: z.string(),
});

export const AdjustmentsSchema = z.object({
  life: OverrideSchema.optional(),
  disability: OverrideSchema.optional(),
  severeIllness: OverrideSchema.optional(),
  incomeProtectionTemporary: OverrideSchema.optional(),
  incomeProtectionPermanent: OverrideSchema.optional(),
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Convert form string values to typed numbers
 * Used after validation to transform data for calculations
 */
export function transformFormToInput(formValues: InformationGatheringFormValues) {
  const grossMonthlyIncome = Number(formValues.grossMonthlyIncome);
  const netMonthlyIncome = Number(formValues.netMonthlyIncome);
  const spouseMonthlyIncome = formValues.spouseAverageMonthlyIncome 
    ? Number(formValues.spouseAverageMonthlyIncome) 
    : 0;
  
  const grossAnnualIncome = grossMonthlyIncome * 12;
  const netAnnualIncome = netMonthlyIncome * 12;
  const combinedHouseholdIncome = grossMonthlyIncome + spouseMonthlyIncome;
  const clientIncomePercentage = combinedHouseholdIncome > 0 
    ? (grossMonthlyIncome / combinedHouseholdIncome) * 100 
    : 100;
  
  const totalCurrentAssets = Number(formValues.totalCurrentAssets);
  const totalOutstandingDebts = Number(formValues.totalOutstandingDebts);
  const totalEstateValue = totalCurrentAssets - totalOutstandingDebts;
  
  return {
    grossMonthlyIncome,
    grossAnnualIncome,
    netMonthlyIncome,
    netAnnualIncome,
    incomeEscalationAssumption: Number(formValues.incomeEscalationAssumption),
    currentAge: Number(formValues.currentAge),
    retirementAge: Number(formValues.retirementAge),
    employmentType: formValues.employmentType,
    dependants: formValues.dependants.map(dep => ({
      id: dep.id,
      relationship: dep.relationship,
      dependencyTerm: Number(dep.dependencyTerm),
      monthlyEducationCost: Number(dep.monthlyEducationCost),
    })),
    totalOutstandingDebts,
    totalCurrentAssets,
    totalEstateValue,
    spouseFullName: formValues.spouseFullName || undefined,
    spouseAverageMonthlyIncome: spouseMonthlyIncome > 0 ? spouseMonthlyIncome : undefined,
    combinedHouseholdIncome,
    clientIncomePercentage,
    totalHouseholdMonthlyExpenditure: Number(formValues.totalHouseholdMonthlyExpenditure),
    existingCover: {
      life: {
        personal: Number(formValues.existingCoverLifePersonal),
        group: Number(formValues.existingCoverLifeGroup),
      },
      disability: {
        personal: Number(formValues.existingCoverDisabilityPersonal),
        group: Number(formValues.existingCoverDisabilityGroup),
      },
      severeIllness: {
        personal: Number(formValues.existingCoverSevereIllnessPersonal),
        group: Number(formValues.existingCoverSevereIllnessGroup),
      },
      incomeProtection: {
        temporary: {
          personal: Number(formValues.existingCoverIPTemporaryPersonal),
          group: Number(formValues.existingCoverIPTemporaryGroup),
        },
        permanent: {
          personal: Number(formValues.existingCoverIPPermanentPersonal),
          group: Number(formValues.existingCoverIPPermanentGroup),
        },
      },
    },
    incomeProtectionSettings: {
      temporary: {
        benefitPeriod: formValues.ipTemporaryBenefitPeriod,
      },
      permanent: {
        escalation: formValues.ipPermanentEscalation,
      },
    },
  };
}