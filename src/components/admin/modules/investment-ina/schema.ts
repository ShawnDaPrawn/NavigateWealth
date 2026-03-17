/**
 * Investment INA Validation Schemas
 * Zod schemas for form validation and type inference
 */

import { z } from 'zod';

// ==================== SUB-SCHEMAS ====================

const riskProfileEnum = z.enum(['conservative', 'moderate', 'balanced', 'growth', 'aggressive']);

export const LumpSumContributionSchema = z.object({
  id: z.string().min(1),
  amount: z.number().min(0, 'Amount cannot be negative'),
  expectedDate: z.string().min(1, 'Expected date is required'),
  description: z.string().optional(),
});

export const InvestmentGoalSchema = z.object({
  id: z.string().min(1),
  goalName: z.string().min(1, 'Goal name is required'),
  goalDescription: z.string().optional(),
  goalType: z.enum([
    'education', 'home-deposit', 'travel', 'emigration',
    'wealth-creation', 'business-funding', 'sabbatical',
    'financial-freedom', 'other',
  ]),
  goalAmountToday: z.number().min(0, 'Goal amount cannot be negative'),
  targetDate: z.string().min(1, 'Target date is required'),
  targetYear: z.number().min(2024),
  priorityLevel: z.enum(['low', 'medium', 'high']),
  linkedInvestmentIds: z.array(z.string()),
  currentContributionToGoal: z.number().min(0),
  expectedLumpSums: z.array(LumpSumContributionSchema),
  useClientRiskProfile: z.boolean(),
  goalSpecificRiskProfile: riskProfileEnum.optional(),
});

export const DiscretionaryInvestmentSchema = z.object({
  id: z.string().min(1),
  productName: z.string().min(1, 'Product name is required'),
  provider: z.string().min(1, 'Provider is required'),
  currentValue: z.number().min(0),
  monthlyContribution: z.number().min(0),
  expectedDrawdownDate: z.string().optional(),
  riskCategory: riskProfileEnum.optional(),
  isDiscretionary: z.boolean().refine((val) => val === true, 'Only discretionary investments are included'),
});

export const RiskProfileReturnsSchema = z.object({
  conservative: z.number(),
  moderate: z.number(),
  balanced: z.number(),
  growth: z.number(),
  aggressive: z.number(),
});

// ==================== MAIN INPUT SCHEMA ====================

export const InvestmentINAInputSchema = z.object({
  // Personal Information
  currentAge: z.number()
    .min(18, 'Minimum age is 18')
    .max(120, 'Maximum age is 120'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  householdDependants: z.number().int().min(0),
  grossMonthlyIncome: z.number().min(0),
  netMonthlyIncome: z.number().min(0),

  // Risk Profile
  clientRiskProfile: riskProfileEnum,

  // Economic Assumptions
  longTermInflationRate: z.number().min(0).max(0.20),
  expectedRealReturns: RiskProfileReturnsSchema,

  // Existing Discretionary Investments
  discretionaryInvestments: z.array(DiscretionaryInvestmentSchema),
  totalDiscretionaryCapitalCurrent: z.number().min(0),
  totalDiscretionaryMonthlyContributions: z.number().min(0),

  // Investment Goals
  goals: z.array(InvestmentGoalSchema).min(1, 'At least one investment goal is required'),
});

export type InvestmentINAFormValues = z.infer<typeof InvestmentINAInputSchema>;
