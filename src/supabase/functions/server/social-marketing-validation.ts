/**
 * Social & Marketing — request schemas (Buffer-backed).
 */

import { z } from 'npm:zod';

const BUFFER_ID = /^[a-f\d]{24}$/;

export const ComposePostSchema = z
  .object({
    channelIds: z.array(z.string().regex(BUFFER_ID, 'Invalid Buffer channel id')).min(1).max(5),
    text: z.string().min(1, 'Post text is required').max(3000),
    mode: z.enum(['now', 'queue', 'scheduled', 'draft']).default('queue'),
    scheduledAt: z.string().datetime({ offset: true }).optional(),
    images: z
      .array(
        z
          .object({
            url: z.string().url().max(2000).optional(),
            storagePath: z.string().min(1).max(500).optional(),
            altText: z.string().max(500).optional(),
          })
          .refine((i) => Boolean(i.url) !== Boolean(i.storagePath), {
            message: 'Provide exactly one of url or storagePath',
          }),
      )
      .max(4)
      .optional(),
    link: z
      .object({
        url: z.string().url().max(2000),
        title: z.string().max(300).optional(),
        description: z.string().max(1000).optional(),
      })
      .optional(),
  })
  .refine((v) => v.mode !== 'scheduled' || Boolean(v.scheduledAt), {
    message: 'scheduledAt is required when mode is scheduled',
  });

export const PostsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  channelId: z.string().regex(BUFFER_ID).optional(),
});

export const AnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
});
