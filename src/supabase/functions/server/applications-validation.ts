/**
 * Applications Module Validation Schemas
 *
 * P1 — Zod validation for applications-routes.ts
 */

import { z } from 'npm:zod';

export const InviteClientSchema = z.object({
  email: z.string().email('Valid email is required'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  accountType: z.enum(['personal', 'business']).default('personal'),
}).passthrough();

export const ResendInviteSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required'),
  email: z.string().email().optional(),
});

export const UpdateApplicationSchema = z.object({
  status: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
  assigneeId: z.string().optional(),
}).passthrough();

export const ApproveApplicationSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const DeclineApplicationSchema = z.object({
  reason: z.string().min(1, 'Decline reason is required').max(2000),
  notes: z.string().max(2000).optional(),
});

export const DeprecateApplicationsSchema = z.object({
  applicationIds: z.array(z.string().min(1)).min(1, 'At least one application ID is required'),
  reason: z.string().max(1000).optional(),
});
