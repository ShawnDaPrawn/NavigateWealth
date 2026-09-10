/**
 * Buffer integration — Zod schemas for route inputs.
 *
 * @module buffer/validation
 */

import { z } from 'npm:zod';

export const ConnectBufferSchema = z.object({
  apiKey: z.string().min(8, 'Buffer API key is required'),
  organizationId: z.string().min(1).optional(),
});

export const CreateBufferPostSchema = z
  .object({
    channelIds: z.array(z.string().min(1)).min(1, 'Select at least one Buffer channel').max(20),
    text: z.string().min(1, 'Post text is required').max(5000),
    mode: z.enum(['addToQueue', 'shareNow', 'shareNext', 'customScheduled']).default('addToQueue'),
    dueAt: z.string().min(1).optional(),
    imageUrls: z.array(z.string().url()).max(10).optional(),
    saveToDraft: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'customScheduled' && !value.dueAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dueAt is required when mode is customScheduled',
        path: ['dueAt'],
      });
    }
    if (value.dueAt && Number.isNaN(Date.parse(value.dueAt))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dueAt must be a valid ISO-8601 datetime',
        path: ['dueAt'],
      });
    }
  });
