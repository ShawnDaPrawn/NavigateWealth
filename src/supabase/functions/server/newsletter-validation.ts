/**
 * Newsletter Module Validation Schemas
 *
 * §4.2 — Validation schemas defined separately and applied in route handlers.
 * Public-facing endpoint — validation is the primary defence.
 */

import { z } from 'npm:zod';

// ── Public endpoints ────────────────────────────────────────────────────

export const NewsletterSubscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
});

// ── Admin endpoints ─────────────────────────────────────────────────────

export const AdminAddSubscriberSchema = z.object({
  email: z.string().email('A valid email address is required'),
  firstName: z.string().optional().default(''),
  surname: z.string().optional().default(''),
  name: z.string().optional(),
});

export const AdminBulkSubscriberSchema = z.object({
  subscribers: z
    .array(
      z.object({
        email: z.string().optional(),
        firstName: z.string().optional(),
        surname: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .min(1, 'subscribers array is required and must not be empty')
    .max(500, 'Maximum 500 subscribers per batch'),
});

export const AdminEmailSchema = z.object({
  email: z.string().min(1, 'Email is required'),
});

export const AdminUpdateSubscriberSchema = z.object({
  currentEmail: z.string().email('A valid current email address is required'),
  email: z.string().email('A valid email address is required'),
  firstName: z.string().optional().default(''),
  surname: z.string().optional().default(''),
  name: z.string().optional(),
});
