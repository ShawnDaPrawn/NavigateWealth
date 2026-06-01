/**
 * esign envelope CRUD + draft routes (Phase 5 decomposition).
 * ===========================================================
 *
 * Extracted verbatim from esign-routes.tsx: the envelope lifecycle surface —
 * the public /verify-hash document-hash check, list / wipe-all envelopes,
 * envelope upload (create from PDF), single-envelope fetch, and the draft
 * editing routes (draft-signers, draft-settings). Mounted via
 * `esignRoutes.route('/', envelopesRoutes)`. Depends on shared esign services
 * + esign-route-helpers; behaviour-preserving, guarded by the envelope CRUD +
 * draft contract group landed ahead of this cut.
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import { getAuthContext, AuthError } from './auth-mw.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { requireIdempotency } from './idempotency.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { DraftSignersSchema } from './esign-validation.ts';
import { getRequestMetadata, resolveFirmId, ensureStorageBuckets } from './esign-route-helpers.ts';
import { belongsToFirm } from './esign-firm-scope.ts';
import {
  createEnvelope,
  createDocument,
  getEnvelopeDetails,
  getAllEnvelopes,
  clearAllEsignData,
  logAuditEvent,
} from './esign-services.ts';
import {
  uploadDocument,
  validateDocument,
  calculateHash,
  extractPageCount,
  getDocumentUrl,
} from './esign-storage.ts';
import { analyzeUploadedPdf } from './esign-pdf-analysis.ts';
import { PDFService } from './esign-pdf.service.ts';

const log = createModuleLogger('esign-envelopes-routes');

const envelopesRoutes = new Hono();

envelopesRoutes.post('/verify-hash', async (c) => {
  try {
    const { hash } = await c.req.json();
    if (!hash || typeof hash !== 'string') {
      return c.json({ error: 'hash is required' }, 400);
    }

    // Search all envelopes for a matching document hash.
    // We check two possible locations:
    //   1. envelope.signed_document_hash — the sealed final PDF hash (most common for verification)
    //   2. document.hash — the original uploaded PDF hash
    const allValues = await kv.getByPrefix(EsignKeys.PREFIX_ENVELOPE);
    const envelopes = allValues.filter(
      (item: Record<string, unknown>) =>
        item &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        item.id &&
        item.status &&
        // P6.8 — soft-deleted envelopes don't take part in verify-hash
        // lookups. The document still exists in storage but is logically
        // gone from the user's perspective.
        !item.deleted_at,
    );

    let matchedEnvelope: Record<string, unknown> | null = null;
    let matchType: 'original' | 'signed' | null = null;

    // Pass 1: Check sealed document hash on envelope record (fast — no extra KV read)
    for (const env of envelopes) {
      if (env.signed_document_hash === hash) {
        matchedEnvelope = env;
        matchType = 'signed';
        break;
      }
    }

    // Pass 2: Check original document hash (requires reading document record)
    if (!matchedEnvelope) {
      for (const env of envelopes) {
        if (env.document_id) {
          const doc = await kv.get(EsignKeys.PREFIX_DOCUMENT + env.document_id);
          if (doc?.hash === hash) {
            matchedEnvelope = env;
            matchType = 'original';
            break;
          }
        }
      }
    }

    if (!matchedEnvelope) {
      return c.json({
        verified: false,
        message:
          'No matching document found. The file may have been modified after signing, or it was not signed through this platform.',
      });
    }

    // Fetch signers
    const rawSIds = await kv.get(EsignKeys.envelopeSigners(matchedEnvelope.id as string));
    const signerIds = Array.isArray(rawSIds) ? rawSIds : [];
    const signers = await Promise.all(
      signerIds.map((id: string) => kv.get(EsignKeys.PREFIX_SIGNER + id)),
    );
    const validSigners = signers.filter(Boolean);

    return c.json({
      verified: true,
      matchType,
      envelope: {
        id: matchedEnvelope.id,
        title: matchedEnvelope.title,
        status: matchedEnvelope.status,
        completedAt: matchedEnvelope.completed_at || null,
        createdAt: matchedEnvelope.created_at,
      },
      signers: validSigners.map((s: Record<string, unknown>) => ({
        name: s.name,
        role: s.role,
        status: s.status,
        signedAt: s.signed_at || null,
      })),
      message:
        matchedEnvelope.status === 'completed'
          ? matchType === 'signed'
            ? 'Document verified. This is an authentic signed and sealed document from Navigate Wealth.'
            : 'Document verified. This matches the original uploaded document. The signed copy may have additional content (signatures, certificate).'
          : `Document found but envelope status is "${matchedEnvelope.status}". Signing may not be complete.`,
    });
  } catch (error: unknown) {
    log.error('Verify hash error:', error);
    return c.json({ error: 'Verification failed. Please try again.' }, 500);
  }
});

// ==================== ENVELOPE ROUTES ====================

/**
 * GET /envelopes
 * Get all envelopes (admin only)
 */
envelopesRoutes.get('/envelopes', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);

    // Get query params
    const status = c.req.query('status');

    const envelopes = await getAllEnvelopes(status);

    // P6.9 — enforce firm scope on every read of the aggregate
    // envelope list. `belongsToFirm` treats records without a
    // `firm_id` (or with `firm_id === 'standalone'`) as accessible
    // to everyone, which keeps the single-firm install working.
    const scoped = (envelopes as Array<Record<string, unknown>>).filter((e) =>
      belongsToFirm(ctx.user, { firm_id: (e.firm_id as string | undefined) ?? null }),
    );

    return c.json({ envelopes: scoped });
  } catch (error: unknown) {
    log.error('❌ Get all envelopes error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch envelopes' },
      status,
    );
  }
});

/**
 * DELETE /envelopes
 * Clear all envelopes and related data (Admin only)
 */
envelopesRoutes.delete('/envelopes', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const user = ctx.user;

    // Safety check - require a confirmation query param
    const confirm = c.req.query('confirm');
    if (confirm !== 'true') {
      return c.json({ error: 'Confirmation required. set confirm=true' }, 400);
    }

    await clearAllEsignData();

    // Log audit event for the wipe
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: user.id,
      action: 'system_reset',
      ip,
      userAgent,
      email: user.email,
      metadata: { note: 'Full system wipe initiated' },
    });

    // Admin audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: user.id,
      actorRole: 'admin',
      category: 'security',
      action: 'esign_system_reset',
      summary: 'All e-signature data cleared (system wipe)',
      severity: 'critical',
      entityType: 'system',
    }).catch(() => {});

    return c.json({ success: true, message: 'All E-Signature data cleared' });
  } catch (error: unknown) {
    log.error('❌ Clear all data error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to clear data' },
      status,
    );
  }
});

/**
 * POST /envelopes/upload
 * Upload a PDF document and create an envelope
 */
envelopesRoutes.post(
  '/envelopes/upload',
  requireIdempotency(),
  rateLimit('SENDER_MUTATE'),
  async (c) => {
    try {
      // Authenticate
      const ctx = await getAuthContext(c);
      const user = ctx.user;

      // Ensure storage buckets exist (lazy init)
      await ensureStorageBuckets();

      // Parse multipart form data — use { all: true } so duplicate keys
      // (e.g. multiple files under 'files') are returned as arrays.
      // Wrap in try/catch because Hono's parseBody calls formData.forEach()
      // internally, which throws if the body cannot be parsed as FormData
      // (e.g. missing/malformed Content-Type boundary, already-consumed stream).
      let body: Record<string, unknown>;
      try {
        body = await c.req.parseBody({ all: true });
      } catch (parseErr: unknown) {
        log.error('Failed to parse multipart form data:', parseErr);
        return c.json(
          {
            error: 'Invalid form data. Ensure the request uses multipart/form-data encoding.',
            details: parseErr?.message || String(parseErr),
          },
          400,
        );
      }

      // With { all: true }, duplicate keys become arrays.
      // Single values remain as-is, so normalise both cases.
      let files: File[] = [];

      const rawFiles = body['files'] ?? body['file'];
      if (rawFiles) {
        if (Array.isArray(rawFiles)) {
          files = rawFiles.filter((f: unknown): f is File => f instanceof File);
        } else if (rawFiles instanceof File) {
          files = [rawFiles];
        }
      }

      // contextStr may also be wrapped in an array by { all: true }
      const contextStr: string | undefined = Array.isArray(body['context'])
        ? (body['context'][0] as string)
        : (body['context'] as string);

      if (files.length === 0 || !contextStr) {
        return c.json({ error: 'Files and context required' }, 400);
      }

      const context = JSON.parse(contextStr);
      const {
        clientId,
        adviceCaseId,
        requestId,
        productId,
        title,
        message,
        expiryDays,
        // P4.1 / P4.2 — when uploading from the express wizard the
        // template id + version are forwarded so the envelope record
        // pins the exact snapshot it was materialised from.
        templateId,
        templateVersion,
        // P4.7 / P4.8 — bulk-send and packet provenance (ignored when
        // not present; populated by the campaign worker / packet runner).
        campaignId,
        packetRunId,
        packetStepIndex,
      } = context;

      if (!title) {
        return c.json({ error: 'title required in context' }, 400);
      }

      // Use 'standalone' as clientId if not provided (for standalone e-sign module)
      const effectiveClientId = clientId || 'standalone';

      // Process files
      let finalFileBuffer: Uint8Array;
      let finalFileName: string;

      if (files.length === 1) {
        const file = files[0];
        finalFileName = file.name;
        const arrayBuffer = await file.arrayBuffer();
        finalFileBuffer = new Uint8Array(arrayBuffer);
      } else {
        // Merge files
        log.info(`Merging ${files.length} files for envelope: ${title}`);
        const buffers: Uint8Array[] = [];
        // Sort files if needed? For now assume client sends them in order.
        for (const file of files) {
          const arrayBuffer = await file.arrayBuffer();
          buffers.push(new Uint8Array(arrayBuffer));
        }
        finalFileBuffer = await PDFService.mergeDocuments(buffers);
        // Create a meaningful name for the merged file
        finalFileName = `${title.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
      }

      // Validate Document
      const validation = validateDocument(finalFileBuffer, finalFileName);
      if (!validation.valid) {
        return c.json({ error: validation.error }, 400);
      }

      // Calculate hash and page count
      const hash = await calculateHash(finalFileBuffer);
      const pageCount = extractPageCount(finalFileBuffer);

      // Generate IDs. New e-sign records must live in the authenticated
      // sender's firm scope or the dashboard history list will immediately
      // filter them back out as "not mine".
      const documentId = crypto.randomUUID();
      const firmId = resolveFirmId(user);

      // Determine MIME type (Always PDF for merged or single PDF, but if single was docx we might have issues)
      // The current validateDocument allows PDF. If we merged, it's definitely PDF.
      // If it was a single file, it could be DOC/DOCX but validateDocument might catch it if it expects PDF headers?
      // Let's assume input is PDF for now as PDFService expects PDF.
      let mimeType = 'application/pdf';

      // Upload to storage
      const { path, error: uploadError } = await uploadDocument(
        firmId,
        documentId,
        finalFileBuffer,
        finalFileName,
        mimeType,
      );

      if (uploadError || !path) {
        return c.json({ error: uploadError || 'Upload failed' }, 500);
      }

      // Create document record
      await createDocument({
        id: documentId,
        firm_id: firmId,
        storage_path: path,
        original_filename: finalFileName,
        page_count: pageCount,
        hash,
        created_at: new Date().toISOString(),
      });

      // Create envelope
      const { envelopeId, error: envError } = await createEnvelope({
        firmId,
        clientId: effectiveClientId,
        title,
        documentId,
        createdByUserId: user.id,
        adviceCaseId,
        requestId,
        productId,
        signers: [],
        message,
        expiryDays,
        signingMode: context.signingMode || 'sequential',
        templateId,
        templateVersion,
        campaignId,
        packetRunId,
        packetStepIndex,
      });

      if (envError || !envelopeId) {
        return c.json({ error: envError || 'Failed to create envelope' }, 500);
      }

      // Get envelope details
      const envelope = await getEnvelopeDetails(envelopeId);
      const documentUrl = await getDocumentUrl(path);

      // Log audit event
      const { ip, userAgent } = getRequestMetadata(c);
      await logAuditEvent({
        envelopeId,
        actorType: 'sender_user',
        actorId: user.id,
        action: 'document_uploaded',
        ip,
        userAgent,
        email: user.email,
        metadata: { filename: finalFileName, pageCount, hash, fileCount: files.length },
      });

      // Admin audit trail (non-blocking — §12.2)
      AdminAuditService.record({
        actorId: user.id,
        actorRole: 'admin',
        category: 'configuration',
        action: 'esign_envelope_created',
        summary: `E-signature envelope created: ${title || finalFileName}`,
        severity: 'info',
        entityType: 'envelope',
        entityId: envelopeId,
        metadata: { fileName: finalFileName, pageCount },
      }).catch(() => {});

      // ── Phase 3.1 + 3.2 — surface field-placement suggestions ──
      // Best-effort: never block upload on analysis failure. The studio shows
      // these as opt-in suggestions ("From PDF form" / "Smart anchor") that
      // the sender can accept individually or via "Accept all".
      let fieldCandidates: Awaited<ReturnType<typeof analyzeUploadedPdf>>['candidates'] = [];
      try {
        const analysis = await analyzeUploadedPdf(finalFileBuffer);
        fieldCandidates = analysis.candidates;
        log.info(
          `Upload analysis: ${fieldCandidates.length} candidate(s) in ${analysis.durationMs}ms (ok=${analysis.ok})`,
        );
      } catch (analysisErr) {
        log.warn('PDF analysis threw (non-fatal):', analysisErr);
      }

      return c.json({
        envelope: {
          ...envelope,
          document: {
            ...envelope.document,
            url: documentUrl,
          },
        },
        // Frontend studio reads `field_candidates` and offers "Accept" /
        // "Accept all" / "Dismiss" actions per candidate. Empty list = no
        // suggestions; the studio still works as before.
        field_candidates: fieldCandidates,
      });
    } catch (error: unknown) {
      log.error('❌ Upload error:', error);
      const status = error instanceof AuthError ? error.statusCode : 500;
      return c.json({ error: error instanceof Error ? error.message : 'Upload failed' }, status);
    }
  },
);

/**
 * GET /envelopes/:envelopeId
 * Get envelope details with signers, fields, and document URL
 */
envelopesRoutes.get('/envelopes/:envelopeId', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // P6.9 — firm scope. Return 404 rather than 403 on mismatch so
    // cross-firm probing can't distinguish "not mine" from "doesn't
    // exist".
    if (!belongsToFirm(ctx.user, { firm_id: (envelope.firm_id as string | undefined) ?? null })) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // P6.8 — soft-deleted envelopes are invisible to normal detail
    // reads. Recovery-bin UI uses the dedicated `/recovery-bin` route.
    if ((envelope as { deleted_at?: string }).deleted_at) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Get document URL
    const documentPath = envelope.document?.storage_path;
    const documentUrl = documentPath ? await getDocumentUrl(documentPath) : null;

    return c.json({
      ...envelope,
      document: {
        ...envelope.document,
        url: documentUrl,
      },
    });
  } catch (error: unknown) {
    log.error('❌ Get envelope error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch envelope' },
      status,
    );
  }
});

/**
 * PUT /envelopes/:envelopeId/draft-signers
 * Persist signer configuration on a draft envelope so it survives page
 * reloads / "Continue Editing" resume flow.  These are NOT the real signer
 * records (those are created at invite-send time); they are the lightweight
 * form data the admin entered during the recipients step.
 */
envelopesRoutes.put('/envelopes/:envelopeId/draft-signers', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');

    const body = await c.req.json();
    const parsed = DraftSignersSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { signers } = parsed.data;

    // Fetch the envelope
    const envelope = await kv.get(EsignKeys.envelope(envelopeId));
    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Only allow updates to draft envelopes
    if (envelope.status !== 'draft') {
      return c.json({ error: 'Can only update signers on draft envelopes' }, 400);
    }

    // Persist the draft signer config on the envelope record
    const updated = {
      ...envelope,
      draft_signers: signers,
      updated_at: new Date().toISOString(),
    };

    await kv.set(EsignKeys.envelope(envelopeId), updated);

    log.info(`Saved ${signers.length} draft signer(s) on envelope ${envelopeId}`);

    return c.json({ success: true, count: signers.length });
  } catch (error: unknown) {
    log.error('Save draft signers error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to save draft signers' },
      status,
    );
  }
});

/**
 * PATCH /envelopes/:envelopeId/draft-settings
 *
 * Allow the sender to edit envelope-level metadata (title, message, expiry,
 * signing mode) on a *draft* envelope from inside the prepare studio. We
 * deliberately do NOT allow editing these fields once the envelope is sent
 * because the audit trail and signer notifications already reference them —
 * mutating after-the-fact would create a confusing trail.
 *
 * All fields are optional in the body; only provided keys are written. This
 * keeps the surface flexible for the studio's settings popover and any
 * future quick-edit UIs.
 */
envelopesRoutes.patch('/envelopes/:envelopeId/draft-settings', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const envelopeId = c.req.param('envelopeId');

    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

    const envelope = await kv.get(EsignKeys.envelope(envelopeId));
    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }
    if (envelope.status !== 'draft') {
      return c.json({ error: 'Can only update settings on draft envelopes' }, 400);
    }

    const updates: Record<string, unknown> = {};
    const changed: Record<string, { from: unknown; to: unknown }> = {};

    if (typeof body.title === 'string') {
      const trimmed = body.title.trim();
      if (trimmed.length < 3 || trimmed.length > 200) {
        return c.json({ error: 'Title must be between 3 and 200 characters' }, 400);
      }
      if (trimmed !== envelope.title) {
        changed.title = { from: envelope.title, to: trimmed };
        updates.title = trimmed;
      }
    }

    if (typeof body.message === 'string' || body.message === null) {
      const next = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : null;
      if (next !== (envelope.message ?? null)) {
        changed.message = { from: envelope.message ?? null, to: next };
        updates.message = next;
      }
    }

    // Accept either an absolute ISO `expires_at` or a relative `expiryDays`
    // (number of days from "now"). The studio uses the relative form.
    let nextExpiresAt: string | null | undefined;
    if (typeof body.expires_at === 'string') {
      const dt = new Date(body.expires_at);
      if (Number.isNaN(dt.getTime())) {
        return c.json({ error: 'Invalid expires_at' }, 400);
      }
      nextExpiresAt = dt.toISOString();
    } else if (body.expires_at === null) {
      nextExpiresAt = null;
    } else if (typeof body.expiryDays === 'number' && Number.isFinite(body.expiryDays)) {
      const days = Math.max(1, Math.min(365, Math.floor(body.expiryDays)));
      nextExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }
    if (nextExpiresAt !== undefined && nextExpiresAt !== (envelope.expires_at ?? null)) {
      changed.expires_at = { from: envelope.expires_at ?? null, to: nextExpiresAt };
      updates.expires_at = nextExpiresAt;
    }

    if (
      typeof body.signing_mode === 'string' &&
      ['sequential', 'parallel'].includes(body.signing_mode)
    ) {
      if (body.signing_mode !== envelope.signing_mode) {
        changed.signing_mode = {
          from: envelope.signing_mode ?? 'sequential',
          to: body.signing_mode,
        };
        updates.signing_mode = body.signing_mode;
      }
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ success: true, changed: {}, envelope });
    }

    const updated = {
      ...envelope,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    await kv.set(EsignKeys.envelope(envelopeId), updated);

    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: user.id,
      action: 'draft_settings_updated',
      ip,
      userAgent,
      email: user.email,
      metadata: { changed },
    });

    return c.json({ success: true, changed, envelope: updated });
  } catch (error: unknown) {
    log.error('Update draft settings error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to update draft settings' },
      status,
    );
  }
});

export default envelopesRoutes;
