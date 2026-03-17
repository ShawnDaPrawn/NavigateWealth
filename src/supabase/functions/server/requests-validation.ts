/**
 * Requests Module Validation Schemas
 *
 * P1 — Zod validation for requests-routes.ts
 */

import { z } from 'npm:zod';

// ============================================================================
// TEMPLATE SCHEMAS
// ============================================================================

export const CreateRequestTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  lifecycleStages: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    order: z.number().int().nonnegative().optional(),
    requiresComplianceApproval: z.boolean().optional(),
    requiresSignOff: z.boolean().optional(),
  })).optional(),
  fields: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    type: z.string().min(1),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
  })).optional(),
  defaultAssignees: z.array(z.string()).optional(),
  status: z.enum(['active', 'draft', 'archived']).optional(),
}).passthrough();

export const UpdateRequestTemplateSchema = CreateRequestTemplateSchema.partial();

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const CreateRequestSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  clientId: z.string().min(1, 'Client ID is required'),
  clientName: z.string().max(200).optional(),
  requestDetails: z.record(z.unknown()).optional().default({}),
  assignees: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

export const UpdateRequestSchema = z.object({
  status: z.string().max(50).optional(),
  requestDetails: z.record(z.unknown()).optional(),
  assignees: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  notes: z.string().max(5000).optional(),
  complianceApproval: z.record(z.unknown()).optional(),
}).passthrough();

// ============================================================================
// LIFECYCLE SCHEMAS
// ============================================================================

export const MoveLifecycleSchema = z.object({
  targetStageId: z.string().min(1, 'Target stage ID is required'),
  notes: z.string().max(2000).optional(),
});

// ============================================================================
// COMPLIANCE SCHEMAS
// ============================================================================

export const ComplianceSignOffSchema = z.object({
  outcome: z.enum(['approved', 'rejected', 'deferred']),
  deficiencies: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional(),
});
