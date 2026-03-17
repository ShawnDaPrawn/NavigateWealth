/**
 * LinkedIn Integration — Validation Schemas
 *
 * Zod schemas for all LinkedIn route inputs.
 *
 * @module linkedin/validation
 */

import { z } from 'npm:zod';

// ============================================================================
// OAuth
// ============================================================================

export const OAuthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
  redirectUri: z.string().url('Valid redirect URI is required'),
});

// ============================================================================
// Share Schemas
// ============================================================================

const VisibilityEnum = z.enum(['PUBLIC', 'CONNECTIONS']).default('PUBLIC');

export const ShareTextSchema = z.object({
  text: z.string().min(1, 'Post text is required').max(3000, 'LinkedIn text limit is 3000 characters'),
  visibility: VisibilityEnum,
});

export const ShareArticleSchema = z.object({
  text: z.string().min(1, 'Post text is required').max(3000, 'LinkedIn text limit is 3000 characters'),
  url: z.string().url('A valid URL is required'),
  title: z.string().max(200).optional(),
  description: z.string().max(256).optional(),
  visibility: VisibilityEnum,
});

export const ShareImageSchema = z.object({
  text: z.string().min(1, 'Post text is required').max(3000, 'LinkedIn text limit is 3000 characters'),
  imageUrl: z.string().url('A valid image URL is required'),
  title: z.string().max(200).optional(),
  description: z.string().max(256).optional(),
  visibility: VisibilityEnum,
});
