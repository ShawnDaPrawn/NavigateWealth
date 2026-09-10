/**
 * Social automation — request schemas.
 *
 * Every body-accepting route in social-assets-routes.ts validates through one
 * of these. The maintenance jobs default to `dryRun: true` (§14.1): a run that
 * spends an OpenAI call per image must not be the thing that happens when a
 * hand-run curl forgets a flag. The scheduled jobs send `dryRun: false`
 * explicitly.
 */

import { z } from 'npm:zod';

const CHANNELS = ['linkedin', 'instagram', 'x'] as const;
const SLOT_RE = /^(mon|tue|wed|thu|fri|sat|sun)\s+([01]?\d|2[0-3]):[0-5]\d$/i;

export const ListAssetsQuerySchema = z.object({
  week: z
    .string()
    .regex(/^\d{4}-W\d{2}$/, 'week must look like 2026-W38')
    .optional(),
  channel: z.enum(CHANNELS).optional(),
  state: z
    .enum([
      'generated',
      'shortlisted',
      'selected',
      'scheduled',
      'published',
      'failed',
      'rejected',
      'expired',
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
});

export const ListBatchesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(52).optional().default(12),
});

/**
 * PATCH /social-assets/assets/:id — the human's two verbs on an asset: pull it
 * (rejected) or put it back (generated). Everything else is the routines' job.
 */
export const UpdateAssetSchema = z
  .object({
    state: z.enum(['rejected', 'generated']).optional(),
    /** Re-queue a failed or missing image. */
    retryImage: z.boolean().optional(),
  })
  .refine((v) => v.state !== undefined || v.retryImage === true, {
    message: 'Provide state or retryImage',
  });

export const UpdateSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    assets_per_channel: z.number().int().min(1).max(20).optional(),
    posts_per_channel_per_week: z.number().int().min(0).max(7).optional(),
    channels: z.array(z.enum(CHANNELS)).min(1).max(3).optional(),
    posting_timezone: z.string().min(1).max(64).optional(),
    site_origin: z.string().url().max(200).optional(),
    preferred_slots: z
      .record(
        z.enum(CHANNELS),
        z.array(z.string().regex(SLOT_RE, 'slot must be "dow HH:MM"')).max(14),
      )
      .optional(),
    style_guide: z.string().max(20000).optional(),
    compliance_rules: z.string().max(20000).optional(),
  })
  .refine((v) => Object.values(v).some((entry) => entry !== undefined), {
    message: 'At least one field must be provided',
  });

export const UpdatePlaybookSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    instructions: z.string().min(1).max(60000).optional(),
  })
  .refine((v) => v.title !== undefined || v.instructions !== undefined, {
    message: 'Provide title or instructions',
  });

export const RenderImagesSchema = z.object({
  dryRun: z.boolean().optional().default(true),
  maxImages: z.number().int().min(1).max(50).optional().default(12),
});

export const SyncBufferSchema = z.object({
  dryRun: z.boolean().optional().default(true),
  maxPosts: z.number().int().min(1).max(200).optional().default(50),
});
