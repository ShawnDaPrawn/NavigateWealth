/**
 * Newsletter intake routes — where a routine hands over a finished PDF.
 *
 *   GET  /newsletter-intake/lists   — the audience ids a routine may name
 *   POST /newsletter-intake/submit  — multipart PDF + title + description → draft
 *
 * Auth: dedicated NW_NEWSLETTER_INTAKE_TOKEN (x-nw-newsletter-intake-token)
 * or the shared cron token / service-role fallback from cron-auth.ts — the
 * goaml-digest precedent. Kept in its own router so this machine gate can
 * never leak onto the admin studio routes.
 *
 * The routine's own environment may not be able to reach this endpoint at
 * all (docs/runbooks/newsletter-intake.md); the SQL path in
 * newsletter-intake-service.ts exists for that case and lands in the same
 * place.
 */

import { Hono } from 'npm:hono';
import { asyncHandler, ValidationError } from './error.middleware.ts';
import { constantTimeEqual } from './crypto-utils.ts';
import { isAuthorizedCronRequest } from './cron-auth.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { listAudienceLists } from './newsletter-studio-audience.ts';
import {
  assertValidPdf,
  MAX_NEWSLETTER_PDF_BYTES,
  NewsletterPdfValidationError,
} from './newsletter-studio-storage.ts';
import { NewsletterIntakeFieldsSchema } from './newsletter-intake-validation.ts';
import { assertKnownLists, createDraftFromIntake } from './newsletter-intake-service.ts';
import { NEWSLETTER_INTAKE_TOKEN_HEADER } from './newsletter-intake-types.ts';

const app = new Hono();
const log = createModuleLogger('newsletter-intake-routes');

app.use('*', async (c, next) => {
  const dedicated = (c.req.header(NEWSLETTER_INTAKE_TOKEN_HEADER) || '').trim();
  const expected = (Deno.env.get('NW_NEWSLETTER_INTAKE_TOKEN') || '').trim();
  if (expected !== '' && dedicated !== '' && constantTimeEqual(dedicated, expected)) {
    return next();
  }
  if (await isAuthorizedCronRequest(c)) return next();
  return c.json(
    {
      error: 'Unauthorized — newsletter intake auth required',
      code: 'NEWSLETTER_INTAKE_AUTH_REQUIRED',
    },
    401,
  );
});

const isUploadedFile = (value: unknown): value is File =>
  value instanceof File ||
  (typeof value === 'object' &&
    value !== null &&
    typeof (value as File).arrayBuffer === 'function' &&
    typeof (value as File).name === 'string' &&
    typeof (value as File).size === 'number');

app.get(
  '/lists',
  asyncHandler(async (c) => {
    const lists = await listAudienceLists();
    return c.json({
      success: true,
      lists: lists.map((l) => ({ id: l.id, name: l.name, memberCount: l.memberCount })),
    });
  }),
);

app.post(
  '/submit',
  asyncHandler(async (c) => {
    const form = await c.req.formData().catch(() => null);
    if (!form) {
      return c.json(
        { error: 'Send multipart/form-data with a "file" field and the text fields.' },
        400,
      );
    }
    const file = form.get('file');
    if (!isUploadedFile(file)) {
      return c.json({ error: 'Attach the newsletter PDF as the "file" field.' }, 400);
    }

    const parsed = NewsletterIntakeFieldsSchema.safeParse({
      title: form.get('title') ?? undefined,
      description: form.get('description') ?? undefined,
      listIds: form.get('listIds') ?? undefined,
      idempotencyKey: form.get('idempotencyKey') ?? undefined,
      submittedBy: form.get('submittedBy') ?? undefined,
      dryRun: form.get('dryRun') ?? undefined,
    });
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const fields = parsed.data;

    if (file.size > MAX_NEWSLETTER_PDF_BYTES) {
      return c.json(
        {
          error: `The PDF is too large; the limit is ${MAX_NEWSLETTER_PDF_BYTES / (1024 * 1024)} MB.`,
        },
        400,
      );
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      assertValidPdf(bytes);
    } catch (error) {
      if (error instanceof NewsletterPdfValidationError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }

    const submittedBy = fields.submittedBy ?? 'routine';

    if (fields.dryRun) {
      const listNames = await assertKnownLists(fields.listIds);
      return c.json({
        success: true,
        dryRun: true,
        wouldCreate: {
          title: fields.title,
          description: fields.description,
          listIds: fields.listIds,
          listNames,
          fileName: file.name || 'newsletter.pdf',
          sizeBytes: bytes.length,
          idempotencyKey: fields.idempotencyKey ?? null,
          submittedBy,
        },
      });
    }

    let outcome;
    try {
      outcome = await createDraftFromIntake({
        title: fields.title,
        description: fields.description,
        listIds: fields.listIds,
        fileName: file.name || 'newsletter.pdf',
        bytes,
        idempotencyKey: fields.idempotencyKey ?? null,
        submittedBy,
      });
    } catch (error) {
      if (error instanceof ValidationError) return c.json({ error: error.message }, 400);
      throw error;
    }

    log.info('Intake submission handled', {
      campaignId: outcome.campaignId,
      duplicate: outcome.duplicate,
      submittedBy,
    });
    return c.json(
      {
        success: true,
        campaignId: outcome.campaignId,
        duplicate: outcome.duplicate,
        reviewUrl: outcome.reviewUrl,
        notified: outcome.notified,
      },
      outcome.duplicate ? 200 : 201,
    );
  }),
);

export default app;
