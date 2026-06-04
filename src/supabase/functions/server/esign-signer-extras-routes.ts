import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import { getAuthContext, AuthError } from './auth-mw.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { getRequestMetadata, audActor, ensureStorageBuckets } from './esign-route-helpers.ts';
import { checkRateLimit } from './rateLimiter.ts';
import { PDFService } from './esign-pdf.service.ts';
import { EsignField } from './esign-types.ts';
import {
  getEnvelopeDetails,
  getEnvelopeSigners,
  getSignerByToken,
  updateFieldValue,
  logAuditEvent,
} from './esign-services.ts';
import {
  downloadDocument,
  calculateHash,
  uploadAttachment,
  getAttachmentUrl,
} from './esign-storage.ts';
import { generateCompletionCertificate } from './esign-certificates.ts';

const log = createModuleLogger('esign-signer-extras-routes');

const app = new Hono();

/**
 * GET /signer/download/:token
 * Download signed document using signer token (public endpoint)
 */
app.get('/signer/download/:token', async (c) => {
  try {
    const token = c.req.param('token')!;

    // Get signer by token
    const signer = await getSignerByToken(token);

    if (!signer) {
      return c.json({ error: 'Invalid or expired signing link' }, 404);
    }

    // Get envelope details
    const envelopeId = signer.envelope_id;
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Only allow download if completed
    if (envelope.status !== 'completed') {
      return c.json({ error: 'Document not completed yet' }, 400);
    }

    // Check if we have a pre-generated signed document
    if (envelope.signed_document_path) {
      const signedPdfBuffer = await downloadDocument(envelope.signed_document_path);

      if (signedPdfBuffer) {
        return new Response(signedPdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${envelope.document?.original_filename?.replace('.pdf', '_signed.pdf') || 'signed_document.pdf'}"`,
          },
        });
      }
    }

    // FALLBACK: On-the-fly generation
    const documentPath = envelope.document?.storage_path;
    if (!documentPath) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // 1. Download original PDF
    const pdfBuffer = await downloadDocument(documentPath);
    if (!pdfBuffer) {
      return c.json({ error: 'Failed to retrieve source document' }, 500);
    }

    // 2. Get signers
    const signers = await getEnvelopeSigners(envelopeId);

    // 3. Perform Burn-in
    try {
      const { pdfBuffer: burnedPdfBuffer } = await PDFService.burnIn(
        pdfBuffer,
        Array.isArray(envelope.fields) ? envelope.fields : [],
        signers,
      );

      let finalPdfBuffer = burnedPdfBuffer;

      try {
        const { pdfBuffer: certBuffer } = await generateCompletionCertificate(envelopeId);
        if (certBuffer) {
          finalPdfBuffer = await PDFService.mergeCertificate(burnedPdfBuffer, certBuffer);
        }
      } catch (certError) {
        log.warn('Certificate merge failed during fallback download', { error: String(certError) });
      }

      return new Response(finalPdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${envelope.document?.original_filename?.replace('.pdf', '_signed.pdf') || 'signed_document.pdf'}"`,
        },
      });
    } catch (burnInError: unknown) {
      log.error('❌ Burn-in error:', burnInError);
      return c.json({ error: 'Failed to generate signed PDF' }, 500);
    }
  } catch (error: unknown) {
    log.error('❌ Signer download error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to download document' },
      500,
    );
  }
});

/**
 * POST /signer/saved-signature
 * Persist the signer's adopted signature/initials so it can be reused on
 * future envelopes addressed to the same email. Public endpoint — must
 * present a valid signing token, which scopes the operation to the email
 * the token was issued for. Either field is optional; only the provided
 * one(s) are written.
 */
app.post('/signer/saved-signature', async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const accessToken = typeof body.access_token === 'string' ? body.access_token : '';
    const signature = typeof body.signature === 'string' ? body.signature : null;
    const initials = typeof body.initials === 'string' ? body.initials : null;

    if (!accessToken) {
      return c.json({ error: 'access_token required' }, 400);
    }
    if (!signature && !initials) {
      return c.json({ error: 'signature or initials required' }, 400);
    }

    const { ip } = getRequestMetadata(c);
    const rateLimitResult = await checkRateLimit(ip, 'esign_saved_signature_save', {
      maxAttempts: 30,
      windowMs: 60 * 60 * 1000,
      blockDurationMs: 5 * 60 * 1000,
    });
    if (!rateLimitResult.allowed) {
      return c.json({ error: rateLimitResult.reason }, 429);
    }

    const signer = await getSignerByToken(accessToken);
    if (!signer) {
      return c.json({ error: 'Invalid or expired access token' }, 404);
    }

    const email = (signer.email || '').toLowerCase().trim();
    if (!email) {
      return c.json({ error: 'Signer email missing' }, 400);
    }

    // Reject obviously oversized payloads (data URLs > ~512KB) to avoid KV bloat.
    const tooLarge = (s: string | null) => !!s && s.length > 600_000;
    if (tooLarge(signature) || tooLarge(initials)) {
      return c.json({ error: 'Signature image is too large. Please use a smaller image.' }, 413);
    }

    const profileKey = `esign:signer-profile:${email}`;
    const existing = (await kv.get(profileKey)) as { signature?: string; initials?: string } | null;
    const next = {
      signature: signature ?? existing?.signature ?? null,
      initials: initials ?? existing?.initials ?? null,
      updated_at: new Date().toISOString(),
    };
    await kv.set(profileKey, next);

    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('❌ Save signer signature error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to save signature' },
      500,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// P3.5 — Envelope attachment listing (admin / sender)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /envelopes/:envelopeId/attachments
 *
 * Authenticated read of every attachment uploaded by every signer for an
 * envelope. Returns presigned URLs valid for 1h so the sender's UI can
 * download / preview without proxying through the worker.
 */
app.get('/envelopes/:envelopeId/attachments', async (c) => {
  try {
    await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;
    const records =
      ((await kv.get(EsignKeys.envelopeAttachments(envelopeId))) as Array<
        Record<string, unknown>
      >) ?? [];
    const enriched = await Promise.all(
      records.map(async (r) => ({
        ...r,
        url: await getAttachmentUrl(String(r.storage_path ?? '')),
      })),
    );
    return c.json({ attachments: enriched });
  } catch (err) {
    log.error('List attachments error:', err);
    const status = err instanceof AuthError ? err.statusCode : 500;
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to list attachments' }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// P3.5 — Signer attachment upload (public, token-scoped)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /signer/attachment
 *
 * Public endpoint a signer hits when filling an `attachment`-type field.
 * Authenticated by `access_token` only — same trust model as
 * `/signer/submit`.
 */
app.post('/signer/attachment', rateLimit('SIGNER_SUBMIT'), async (c) => {
  try {
    const body = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
    const accessToken =
      typeof body['access_token'] === 'string' ? (body['access_token'] as string) : '';
    const fieldId = typeof body['field_id'] === 'string' ? (body['field_id'] as string) : '';
    const file = body['file'];

    if (!accessToken) return c.json({ error: 'access_token required' }, 400);
    if (!fieldId) return c.json({ error: 'field_id required' }, 400);
    if (!(file instanceof File)) return c.json({ error: 'file required' }, 400);

    const signer = await getSignerByToken(accessToken);
    if (!signer) return c.json({ error: 'Invalid or expired access token' }, 404);
    if (signer.status === 'signed') return c.json({ error: 'Already signed' }, 409);

    // Confirm the field exists and is the attachment type assigned to this signer.
    const fields =
      ((await kv.get(EsignKeys.envelopeFields(signer.envelope_id))) as EsignField[]) ?? [];
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return c.json({ error: 'Field not found' }, 404);
    if (field.type !== 'attachment')
      return c.json({ error: 'Field is not an attachment field' }, 400);
    if (field.signer_id !== signer.id && field.signer_id !== signer.email) {
      return c.json({ error: 'Field is not assigned to this signer' }, 403);
    }

    await ensureStorageBuckets();

    const attachmentId = crypto.randomUUID();
    const buffer = new Uint8Array(await file.arrayBuffer());
    const { path, error: uploadErr } = await uploadAttachment(
      signer.envelope_id,
      attachmentId,
      file.name,
      buffer,
      file.type,
    );
    if (uploadErr || !path) return c.json({ error: uploadErr ?? 'Upload failed' }, 400);

    // Record attachment in the per-envelope index so the certificate
    // renderer can iterate over them.
    const indexKey = EsignKeys.envelopeAttachments(signer.envelope_id);
    const existing = ((await kv.get(indexKey)) as Array<Record<string, unknown>>) ?? [];
    const record = {
      id: attachmentId,
      envelope_id: signer.envelope_id,
      field_id: fieldId,
      signer_id: signer.id,
      signer_email: signer.email,
      filename: file.name,
      mime_type: file.type,
      size_bytes: buffer.length,
      storage_path: path,
      hash: await calculateHash(buffer),
      uploaded_at: new Date().toISOString(),
    };
    await kv.set(indexKey, [...existing, record]);

    // Stamp the field value so completeness checks pass.
    await updateFieldValue(fieldId, `attachment:${attachmentId}`);

    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: audActor(signer),
      actorId: signer.id,
      action: 'attachment_uploaded',
      email: signer.email,
      ip,
      userAgent,
      metadata: {
        fieldId,
        attachmentId,
        filename: record.filename,
        size: record.size_bytes,
        mimeType: record.mime_type,
      },
    });

    return c.json({
      success: true,
      attachmentId,
      path,
      filename: record.filename,
      size: record.size_bytes,
      mimeType: record.mime_type,
      fieldId,
    });
  } catch (err: unknown) {
    log.error('Attachment upload error:', err);
    return c.json({ error: err instanceof Error ? err.message : 'Attachment upload failed' }, 500);
  }
});

/**
 * POST /signer/pause
 * Record an audit-trail entry that the signer paused signing and intends
 * to return later. Does not change envelope or signer status — the link
 * remains valid until envelope expiry. Public endpoint, token-scoped.
 */
app.post('/signer/pause', async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const accessToken = typeof body.access_token === 'string' ? body.access_token : '';
    if (!accessToken) {
      return c.json({ error: 'access_token required' }, 400);
    }

    const signer = await getSignerByToken(accessToken);
    if (!signer) {
      return c.json({ error: 'Invalid or expired access token' }, 404);
    }

    const { ip, userAgent } = getRequestMetadata(c);
    const completedCount = Number.isFinite(body.completed_count as number)
      ? (body.completed_count as number)
      : undefined;
    const requiredCount = Number.isFinite(body.required_count as number)
      ? (body.required_count as number)
      : undefined;

    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: audActor(signer),
      actorId: signer.id,
      action: 'paused',
      email: signer.email,
      ip,
      userAgent,
      metadata: {
        signerId: signer.id,
        signerName: signer.name,
        completedCount,
        requiredCount,
      },
    });

    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('❌ Signer pause error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to record pause' },
      500,
    );
  }
});

export default app;
