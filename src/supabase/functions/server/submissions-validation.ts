/**
 * Submissions Validation Schemas
 *
 * Zod schemas for the Submissions Manager endpoints (§4.2 — validation
 * files live alongside their domain routes and services).
 *
 * The public POST /submissions endpoint is unauthenticated — validation
 * is the primary defence layer, matching the pattern used by contact-form
 * and quote-request routes.
 */

import { z } from 'npm:zod';

// ── Valid enum values (mirrors submissions-service.ts types) ────────────────

const SUBMISSION_TYPES = ['quote', 'will_draft', 'tax_planning', 'consultation', 'contact', 'client_signup'] as const;
const SUBMISSION_STATUSES = ['new', 'pending', 'completed', 'archived'] as const;
const SOURCE_CHANNELS = ['website_form', 'admin', 'client_portal'] as const;

// ── Public: Create Submission ───────────────────────────────────────────────

export const CreateSubmissionSchema = z.object({
  type: z.enum(SUBMISSION_TYPES, {
    errorMap: () => ({ message: `Invalid submission type. Must be one of: ${SUBMISSION_TYPES.join(', ')}` }),
  }),
  sourceChannel: z.enum(SOURCE_CHANNELS, {
    errorMap: () => ({ message: `Invalid source channel. Must be one of: ${SOURCE_CHANNELS.join(', ')}` }),
  }),
  payload: z.record(z.string(), z.unknown()).refine(
    (val) => val !== null && typeof val === 'object',
    'Payload must be a non-null object',
  ),
  submitterName: z.string().max(200).optional()
    .transform((v) => v?.trim()),
  submitterEmail: z.string().email('Invalid submitter email format').optional()
    .transform((v) => v?.trim().toLowerCase()),
  // Honeypot field — should be empty. Checked in the route handler (silent reject).
  website: z.string().max(500).optional().default(''),
});

// ── Admin: Update Submission ────────────────────────────────────────────────

export const UpdateSubmissionSchema = z.object({
  status: z.enum(SUBMISSION_STATUSES, {
    errorMap: () => ({ message: `Invalid status. Must be one of: ${SUBMISSION_STATUSES.join(', ')}` }),
  }).optional(),
  notes: z.string().max(5000).optional(),
  assignedTo: z.string().max(200).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  updatedBy: z.string().max(200).optional(),
});

// ── Admin: Invite Email ─────────────────────────────────────────────────────

export const InviteEmailSchema = z.object({
  recipientEmail: z.string().email('Recipient email is required and must be valid')
    .transform((v) => v.trim().toLowerCase()),
  recipientName: z.string().max(200).optional()
    .transform((v) => v?.trim()),
  inviteTypeId: z.string().max(100).optional(),
  formUrl: z.string().url('Form URL is required and must be a valid URL'),
  emailSubject: z.string().max(200).optional(),
  emailBody: z.string().max(10000).optional(),
  emailButtonLabel: z.string().max(100).optional(),
  personalMessage: z.string().max(5000).optional(),
});

// ── Query Filters ───────────────────────────────────────────────────────────

export const SubmissionListQuerySchema = z.object({
  type: z.enum(SUBMISSION_TYPES).optional(),
  status: z.enum(SUBMISSION_STATUSES).optional(),
});