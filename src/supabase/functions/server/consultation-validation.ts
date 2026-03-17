/**
 * Consultation Booking Validation Schemas
 *
 * Zod schemas for the consultation request endpoint (§4.2).
 * This is a public-facing endpoint — validation is the primary defence layer.
 *
 * Date/time business rules (weekend check, minimum booking window) are enforced
 * separately in the route handler because they depend on runtime SAST clock state.
 */

import { z } from 'npm:zod';

export const ConsultationRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200)
    .transform((v) => v.trim()),
  email: z.string().email('Invalid email address format')
    .transform((v) => v.trim().toLowerCase()),
  phone: z.string().min(1, 'Phone number is required').max(30)
    .refine(
      (val) => /^[\d\s\-+()]{7,}$/.test(val),
      'Phone number must contain at least 7 digits',
    ),
  meetingType: z.enum(['virtual', 'telephonic'], {
    errorMap: () => ({ message: 'Meeting type must be "virtual" or "telephonic"' }),
  }),
  preferredDate1: z.string().min(1, 'At least one preferred date is required'),
  preferredTime1: z.string().min(1, 'At least one preferred time is required'),
  preferredDate2: z.string().optional().default(''),
  preferredTime2: z.string().optional().default(''),
  preferredDate3: z.string().optional().default(''),
  preferredTime3: z.string().optional().default(''),
  additionalNotes: z.string().max(5000).optional().default(''),
  // Honeypot field — should be empty. Checked in the route handler (silent reject).
  website: z.string().max(500).optional().default(''),
});
