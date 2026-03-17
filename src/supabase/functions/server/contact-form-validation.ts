/**
 * Contact Form & Quote Request Validation Schemas
 *
 * P1 — Zod validation for public-facing endpoints.
 * These endpoints have NO auth — validation is the primary defence.
 */

import { z } from 'npm:zod';

export const ContactFormSubmitSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100)
    .transform((v) => v.trim()),
  lastName: z.string().min(1, 'Last name is required').max(100)
    .transform((v) => v.trim()),
  email: z.string().email('Invalid email address format')
    .transform((v) => v.trim().toLowerCase()),
  phone: z.string().min(1, 'Phone number is required').max(30)
    .refine(
      (val) => /^[\d\s\-+()]{7,}$/.test(val),
      'Phone number must contain at least 7 digits',
    ),
  service: z.string().max(200).optional().default(''),
  message: z.string().max(5000).optional().default(''),
  clientType: z.string().max(50).optional().default(''),
  // Honeypot field — should be empty. Checked in the route handler (silent reject).
  website: z.string().max(500).optional().default(''),
});

export const QuoteRequestSubmitSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100)
    .transform((v) => v.trim()),
  lastName: z.string().min(1, 'Last name is required').max(100)
    .transform((v) => v.trim()),
  email: z.string().email('Invalid email address format')
    .transform((v) => v.trim().toLowerCase()),
  phone: z.string().min(1, 'Phone number is required').max(30)
    .refine(
      (val) => /^[\d\s\-+()]{7,}$/.test(val),
      'Phone number must contain at least 7 digits',
    ),
  productName: z.string().max(200).optional().default(''),
  coverage: z.number().nonnegative().optional().default(0),
  preferredProvider: z.string().max(200).optional().default(''),
  /** Two-stage flow: 'initial' from gateway, 'full' from product page */
  stage: z.enum(['initial', 'full']).optional().default('initial'),
  /** Service slug (e.g. 'risk-management') */
  service: z.string().max(100).optional().default(''),
  /** Submission ID from the initial gateway submission (links full → initial) */
  parentSubmissionId: z.string().max(200).optional().default(''),
  /** Product-specific form data — free-form key-value pairs */
  productDetails: z.record(z.string(), z.unknown()).optional().default({}),
  // Honeypot field — should be empty. Checked in the route handler (silent reject).
  website: z.string().max(500).optional().default(''),
});