/**
 * Social channel assets — request schemas.
 *
 * Deliberately forgiving about where a value arrives from: the same fields
 * come through a multipart form (strings only) and through JSON (real types),
 * so numbers and arrays are coerced rather than demanded in one exact shape.
 * An integrating agent should not have to guess.
 */

import { z } from 'npm:zod';

const CHANNEL = z.enum(['linkedin', 'instagram', 'x']);
const STATUS = z.enum(['available', 'used', 'archived']);
const MEDIA_TYPE = z.enum(['image', 'video']);

/** `"a, b"`, `["a","b"]` or `'["a","b"]'` all mean the same thing. */
const TAGS = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (Array.isArray(value)) return value.map((t) => t.trim()).filter(Boolean);
    const text = value.trim();
    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text) as unknown;
        if (Array.isArray(parsed)) return parsed.map((t) => String(t).trim()).filter(Boolean);
      } catch {
        // Fall through to the comma-separated reading.
      }
    }
    return text
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  })
  .pipe(z.array(z.string().max(40)).max(20).optional());

export const AddChannelAssetSchema = z.object({
  channel: CHANNEL,
  /** Supply the file itself as multipart, or this for the server to fetch. */
  sourceUrl: z.string().url().max(2000).optional(),
  fileName: z.string().max(300).optional(),
  caption: z.string().max(3000).optional(),
  altText: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
  tags: TAGS,
  width: z.coerce.number().int().positive().max(20000).optional(),
  height: z.coerce.number().int().positive().max(20000).optional(),
  durationSeconds: z.coerce.number().positive().max(3600).optional(),
  source: z.string().max(60).optional(),
});

export const ListChannelAssetsQuerySchema = z.object({
  channel: CHANNEL.optional(),
  status: STATUS.optional(),
  mediaType: MEDIA_TYPE.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(60),
  offset: z.coerce.number().int().min(0).max(100000).optional().default(0),
});

export const UpdateChannelAssetSchema = z
  .object({
    channel: CHANNEL.optional(),
    caption: z.string().max(3000).nullable().optional(),
    altText: z.string().max(1000).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    tags: TAGS,
    status: STATUS.optional(),
  })
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: 'Nothing to update',
  });

export const MarkUsedSchema = z.object({
  bufferPostId: z.string().max(120).optional(),
});
