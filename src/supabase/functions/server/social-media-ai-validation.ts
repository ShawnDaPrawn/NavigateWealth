/**
 * Social Media AI Validation Schemas
 *
 * Zod validation for social-media-ai-routes.ts
 *
 * @module social-media/ai-validation
 */

import { z } from 'npm:zod';

export const GeneratePostTextSchema = z.object({
  platforms: z
    .array(z.enum(['linkedin', 'instagram', 'facebook', 'x']))
    .min(1, 'At least one platform is required')
    .max(4),
  topic: z
    .string()
    .min(3, 'Topic must be at least 3 characters')
    .max(500, 'Topic must not exceed 500 characters'),
  tone: z.enum([
    'professional',
    'conversational',
    'authoritative',
    'friendly',
    'educational',
  ]),
  goal: z.enum([
    'engagement',
    'awareness',
    'education',
    'promotion',
    'thought_leadership',
  ]),
  articleContent: z.string().max(10000).optional(),
  articleTitle: z.string().max(300).optional(),
  keyPoints: z.array(z.string().max(200)).max(5).optional(),
  includeHashtags: z.boolean().default(true),
  includeCTA: z.boolean().default(true),
  additionalInstructions: z.string().max(500).optional(),
});

export const GetHistorySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const GenerateImageSchema = z.object({
  platform: z.enum(['linkedin', 'instagram', 'instagram_story', 'facebook', 'x']),
  subject: z
    .string()
    .min(5, 'Image subject must be at least 5 characters')
    .max(500, 'Image subject must not exceed 500 characters'),
  style: z.enum([
    'photorealistic',
    'editorial',
    'abstract',
    'conceptual',
    'lifestyle',
    'data_visualisation',
  ]),
  topic: z.string().max(300).optional(),
  additionalInstructions: z.string().max(500).optional(),
  quality: z.enum(['standard', 'hd']).default('standard'),
});

export const RefreshImageUrlSchema = z.object({
  storagePath: z.string().min(1, 'Storage path is required'),
});

export const GenerateBundleSchema = z.object({
  text: GeneratePostTextSchema,
  image: GenerateImageSchema,
});

// ============================================================================
// Custom Brand Templates (Phase 3+)
// ============================================================================

const platformEnumVal = z.enum(['linkedin', 'instagram', 'facebook', 'x']);
const toneEnumVal = z.enum(['professional', 'conversational', 'authoritative', 'friendly', 'educational']);
const goalEnumVal = z.enum(['engagement', 'awareness', 'education', 'promotion', 'thought_leadership']);

export const CreateCustomTemplateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().min(5).max(300),
  icon: z.string().min(1).max(50),
  color: z.string().min(1).max(50),
  bgColor: z.string().min(1).max(50),
  platforms: z.array(platformEnumVal).min(1).max(4),
  tone: toneEnumVal,
  goal: goalEnumVal,
  topicPrompt: z.string().max(200).default(''),
  includeHashtags: z.boolean().default(true),
  includeCTA: z.boolean().default(true),
  additionalInstructions: z.string().max(1000),
});

export const UpdateCustomTemplateSchema = CreateCustomTemplateSchema.partial();