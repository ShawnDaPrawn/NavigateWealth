/**
 * Goal Planner Validation Schemas
 *
 * P1 — Zod validation for goal-routes.ts
 */

import { z } from 'npm:zod';

export const GoalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Goal name is required').max(200),
  type: z.string().max(100).optional(),
  targetAmount: z.number().nonnegative().optional(),
  currentAmount: z.number().nonnegative().optional(),
  requiredMonthly: z.number().nonnegative().optional(),
  targetDate: z.string().optional(),
  status: z.string().max(50).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  linkedPolicyIds: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional(),
}).passthrough(); // Allow additional fields from the dynamic form

export const SaveGoalsSchema = z.object({
  goals: z.array(GoalSchema).max(50, 'Maximum 50 goals per client'),
});
