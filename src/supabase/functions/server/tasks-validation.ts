/**
 * Tasks Validation Schemas
 *
 * Zod schemas for all task mutation endpoints.
 * Read-only GET routes do not require body validation.
 *
 * P1 — Zod validation for tasks-routes.ts
 */

import { z } from 'npm:zod';

// ============================================================================
// ENUMS
// ============================================================================

export const TaskStatusSchema = z.enum([
  'new',
  'in_progress',
  'completed',
  'archived',
]);

export const TaskPrioritySchema = z.enum([
  'low',
  'medium',
  'high',
  'critical',
]);

export const ReminderFrequencySchema = z.enum([
  'daily',
  'weekly',
  'biweekly',
  'monthly',
]).nullable().optional();

// ============================================================================
// CREATE
// ============================================================================

export const CreateTaskSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required').max(500, 'Title is too long'),
  description: z.string().max(5000).nullable().optional(),
  status: TaskStatusSchema.default('new'),
  priority: TaskPrioritySchema.default('medium'),
  due_date: z.string().nullable().optional(),
  assignee_initials: z.string().max(5).nullable().optional(),
  assignee_id: z.string().nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  category: z.string().max(100).nullable().optional(),
  is_template: z.boolean().default(false),
  reminder_frequency: ReminderFrequencySchema,
  created_by: z.string().default(''),
});

// ============================================================================
// UPDATE
// ============================================================================

export const UpdateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  due_date: z.string().nullable().optional(),
  assignee_initials: z.string().max(5).nullable().optional(),
  assignee_id: z.string().nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  category: z.string().max(100).nullable().optional(),
  is_template: z.boolean().optional(),
  reminder_frequency: ReminderFrequencySchema,
  completed_at: z.string().nullable().optional(),
  sort_order: z.number().int().nonnegative().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

// ============================================================================
// MOVE
// ============================================================================

export const MoveTaskSchema = z.object({
  status: TaskStatusSchema,
  sort_order: z.number().int().nonnegative().default(0),
});

// ============================================================================
// REORDER
// ============================================================================

export const ReorderTasksSchema = z.array(
  z.object({
    id: z.string().min(1),
    sort_order: z.number().int().nonnegative(),
  })
).min(1, 'At least one task update is required');

// ============================================================================
// UNARCHIVE
// ============================================================================

export const UnarchiveTaskSchema = z.object({
  status: TaskStatusSchema.exclude(['archived']).default('new'),
});

// ============================================================================
// DATE RANGE QUERY
// ============================================================================

export const DateRangeQuerySchema = z.object({
  start: z.string().min(1, 'start parameter is required'),
  end: z.string().min(1, 'end parameter is required'),
}).refine(
  (data) => {
    const s = new Date(data.start);
    const e = new Date(data.end);
    return !isNaN(s.getTime()) && !isNaN(e.getTime());
  },
  { message: 'Invalid date parameters' }
);
