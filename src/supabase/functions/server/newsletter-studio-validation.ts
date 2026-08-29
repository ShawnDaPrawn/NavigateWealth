/**
 * Newsletter Studio — Validation Schemas
 *
 * §4.2 — Validation schemas defined separately and applied at route
 * registration via validateBody/validateOptionalBody (validate.ts).
 */

import { z } from 'npm:zod';

/** Generous but bounded: a full HTML newsletter body. */
const BodyHtmlSchema = z
  .string()
  .min(1, 'Body is required')
  .max(500_000, 'Body exceeds the 500KB limit');

const CampaignNameSchema = z
  .string()
  .trim()
  .min(1, 'Campaign name is required')
  .max(200, 'Campaign name is too long');

const SubjectSchema = z
  .string()
  .trim()
  .min(1, 'Subject is required')
  .max(300, 'Subject is too long');

export const CreateNewsletterCampaignSchema = z
  .object({
    name: CampaignNameSchema,
    subject: SubjectSchema,
    preheader: z.string().trim().max(300).optional(),
    fromName: z.string().trim().max(120).optional(),
    listIds: z
      .array(z.string().trim().min(1).max(120))
      .min(1, 'Select at least one audience list')
      .max(20, 'Too many audience lists'),
    bodyHtml: BodyHtmlSchema,
    templateId: z.string().trim().max(120).nullish(),
    trackClicks: z.boolean().optional(),
  })
  .passthrough();

export const UpdateNewsletterCampaignSchema = z
  .object({
    name: CampaignNameSchema.optional(),
    subject: SubjectSchema.optional(),
    preheader: z.string().trim().max(300).nullish(),
    fromName: z.string().trim().max(120).optional(),
    listIds: z.array(z.string().trim().min(1).max(120)).min(1).max(20).optional(),
    bodyHtml: BodyHtmlSchema.optional(),
    templateId: z.string().trim().max(120).nullish(),
    trackClicks: z.boolean().optional(),
  })
  .passthrough();

export const ScheduleNewsletterCampaignSchema = z
  .object({
    scheduledAt: z
      .string()
      .datetime({ offset: true, message: 'scheduledAt must be an ISO-8601 timestamp' }),
  })
  .passthrough();

export const TestSendNewsletterCampaignSchema = z
  .object({
    emails: z
      .array(z.string().email('Invalid test recipient address'))
      .min(1, 'Provide at least one test address')
      .max(5, 'At most 5 test addresses per send'),
  })
  .passthrough();

export const NewsletterTemplateSchema = z
  .object({
    name: z.string().trim().min(1, 'Template name is required').max(200),
    description: z.string().trim().max(500).optional(),
    subject: z.string().trim().max(300).optional(),
    bodyHtml: BodyHtmlSchema,
  })
  .passthrough();

/** Manual/cron processor tick options — everything optional, `{}` is a valid body. */
export const ProcessNewsletterCampaignsSchema = z
  .object({
    maxCampaigns: z.number().int().min(1).max(5).optional(),
    maxBatchesPerCampaign: z.number().int().min(1).max(5).optional(),
  })
  .passthrough();

/** Public click-through ping. Ids are internal short tokens — tight bounds. */
export const NewsletterTrackClickSchema = z
  .object({
    campaignId: z.string().trim().min(1).max(120),
    token: z.string().trim().min(1).max(120),
    linkId: z.string().trim().min(1).max(24),
  })
  .passthrough();
