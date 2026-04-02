/**
 * Publications Module Validation Schemas
 *
 * P1 — Zod validation for publications-routes.tsx
 */

import { z } from 'npm:zod';

// --- Categories ---

export const CreateCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  description: z.string().max(500).optional(),
  slug: z.string().max(100).optional(),
  order: z.number().int().nonnegative().optional(),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

// --- Types ---

export const CreateTypeSchema = z.object({
  name: z.string().min(1, 'Type name is required').max(100),
  description: z.string().max(500).optional(),
  slug: z.string().max(100).optional(),
  icon: z.string().max(50).optional(),
});

export const UpdateTypeSchema = CreateTypeSchema.partial();

// --- Articles ---

export const CreateArticleSchema = z.object({
  title: z.string().min(1, 'Article title is required').max(300),
  subtitle: z.string().max(500).optional(),
  slug: z.string().max(300).optional(),
  content: z.string().min(1, 'Article content is required'),
  excerpt: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  type: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  imageUrl: z.string().max(1000).optional(),
  author: z.string().max(200).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
  publishDate: z.string().optional(),
  featured: z.boolean().optional(),
}).passthrough();

export const UpdateArticleSchema = CreateArticleSchema.partial();

// --- Notification ---

export const ArticleNotificationSchema = z.object({
  articleId: z.string().min(1, 'Article ID is required'),
  subject: z.string().min(1).max(500).optional(),
  recipientFilter: z.enum(['all', 'subscribed']).optional().default('subscribed'),
});

export const ArticleReshareSchema = z.object({
  dryRun: z.boolean().optional().default(true),
  targetMode: z.enum(['all', 'selected']).optional().default('all'),
  recipientEmails: z.array(z.string().email()).max(1000).optional().default([]),
});

export const ArticleDeliveryRetrySchema = z.object({
  dryRun: z.boolean().optional().default(false),
  source: z.enum(['publish', 'reshare']).optional().default('publish'),
});

export const ArticleEmailEngagementEventSchema = z.object({
  token: z.string().trim().min(1).max(120),
});
