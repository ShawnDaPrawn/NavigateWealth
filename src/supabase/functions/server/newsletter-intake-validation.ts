/**
 * Newsletter intake — validation of the multipart text fields.
 *
 * The PDF itself is validated by bytes (newsletter-studio-storage.ts); this
 * covers everything that arrives as a form field or a SQL column.
 */

import { z } from 'npm:zod';
import { DescriptionSchema, TitleSchema } from './newsletter-studio-validation.ts';
import { SUBSCRIBER_LIST_ID } from './newsletter-studio-audience.ts';

const ListIdSchema = z.string().trim().min(1).max(120);

/** `listIds` arrives as a JSON array, a comma list, or not at all (→ subscriber base). */
const ListIdsFieldSchema = z
  .union([z.array(ListIdSchema), z.string()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value === '') return [SUBSCRIBER_LIST_ID];
    if (Array.isArray(value)) return value;
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        const checked = z.array(ListIdSchema).min(1).max(20).safeParse(parsed);
        if (checked.success) return checked.data;
      } catch {
        // fall through to the error below
      }
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'listIds must be a JSON array of ids' });
      return z.NEVER;
    }
    const ids = trimmed
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return ids.length > 0 ? ids : [SUBSCRIBER_LIST_ID];
  })
  .pipe(z.array(ListIdSchema).min(1).max(20));

const BoolishSchema = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) =>
    typeof value === 'boolean' ? value : /^(1|true|yes)$/i.test((value ?? '').trim()),
  );

export const NewsletterIntakeFieldsSchema = z.object({
  title: TitleSchema,
  description: DescriptionSchema,
  listIds: ListIdsFieldSchema,
  idempotencyKey: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9._-]{1,64}$/,
      'idempotencyKey: 1–64 letters, digits, dot, dash or underscore',
    )
    .optional(),
  submittedBy: z.string().trim().min(1).max(64).optional(),
  dryRun: BoolishSchema,
});

export type NewsletterIntakeFields = z.infer<typeof NewsletterIntakeFieldsSchema>;
