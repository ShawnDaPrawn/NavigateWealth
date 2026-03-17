/**
 * Social Marketing Validation Schemas
 *
 * P1 — Zod validation for social-marketing-routes.ts
 */

import { z } from 'npm:zod';

export const CreatePostSchema = z.object({
  platform: z.enum(['facebook', 'linkedin', 'twitter', 'instagram', 'all']).default('linkedin'),
  content: z.string().min(1, 'Post content is required').max(5000),
  title: z.string().max(200).optional(),
  mediaUrls: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  status: z.enum(['draft', 'scheduled', 'published', 'failed']).default('draft'),
  tags: z.array(z.string().max(50)).max(10).optional(),
  category: z.string().max(100).optional(),
}).passthrough();

export const UpdatePostSchema = CreatePostSchema.partial();
