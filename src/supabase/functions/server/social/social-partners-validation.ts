/**
 * Social & Marketing — partner advertisers (request schemas).
 */

import { z } from 'npm:zod@4.6.5';

const REFERRAL_CODE = /^[a-z0-9][a-z0-9-]{1,39}$/;

const PartnerFields = {
  name: z.string().trim().min(1, 'Partner name is required').max(120),
  contactName: z.string().trim().max(120).optional().default(''),
  contactEmail: z
    .union([z.literal(''), z.string().trim().email('Enter a valid email address').max(200)])
    .optional()
    .default(''),
  website: z
    .union([z.literal(''), z.string().trim().url('Enter a full web address').max(500)])
    .optional()
    .default(''),
  referralCode: z
    .string()
    .trim()
    .toLowerCase()
    .regex(REFERRAL_CODE, 'Use 2–40 lowercase letters, numbers or dashes'),
  status: z.enum(['active', 'paused', 'ended']).optional().default('active'),
  notes: z.string().trim().max(2000).optional().default(''),
};

export const CreatePartnerSchema = z.object(PartnerFields);

export const UpdatePartnerSchema = z
  .object({
    name: PartnerFields.name.optional(),
    contactName: z.string().trim().max(120).optional(),
    contactEmail: z
      .union([z.literal(''), z.string().trim().email('Enter a valid email address').max(200)])
      .optional(),
    website: z
      .union([z.literal(''), z.string().trim().url('Enter a full web address').max(500)])
      .optional(),
    referralCode: z
      .string()
      .trim()
      .toLowerCase()
      .regex(REFERRAL_CODE, 'Use 2–40 lowercase letters, numbers or dashes')
      .optional(),
    status: z.enum(['active', 'paused', 'ended']).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const PartnerIdSchema = z.string().uuid('Invalid partner id');

export type CreatePartnerInput = z.infer<typeof CreatePartnerSchema>;
export type UpdatePartnerInput = z.infer<typeof UpdatePartnerSchema>;
