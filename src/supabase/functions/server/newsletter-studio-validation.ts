/**
 * Newsletter Studio — Validation Schemas
 *
 * §4.2 — Validation schemas defined separately and applied at route
 * registration via validateBody/validateOptionalBody (validate.ts).
 */

import { z } from 'npm:zod';

export const TitleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(150, 'Title is too long (150 characters max)');

export const DescriptionSchema = z
  .string()
  .trim()
  .min(1, 'Description is required')
  .max(1000, 'Description is too long (1000 characters max)');

export const ListIdsSchema = z
  .array(z.string().trim().min(1).max(120))
  .min(1, 'Select at least one audience')
  .max(20, 'Too many audiences');

export const CreateNewsletterCampaignSchema = z
  .object({
    title: TitleSchema,
    description: DescriptionSchema,
    listIds: ListIdsSchema,
  })
  .passthrough();

export const UpdateNewsletterCampaignSchema = z
  .object({
    title: TitleSchema.optional(),
    description: DescriptionSchema.optional(),
    listIds: ListIdsSchema.optional(),
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

/**
 * RFC 8058 one-click unsubscribe. Providers POST a form-encoded body
 * (`List-Unsubscribe=One-Click`), so identification rides in query params:
 * `c` = campaign id, `t` = per-recipient token.
 */
export const OneClickUnsubscribeQuerySchema = z
  .object({
    c: z.string().trim().min(1).max(120),
    t: z.string().trim().min(1).max(120),
  })
  .passthrough();
