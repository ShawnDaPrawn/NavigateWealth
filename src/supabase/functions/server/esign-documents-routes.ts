/**
 * esign envelope documents + manifest routes (Phase 5 decomposition).
 * ===================================================================
 *
 * Extracted verbatim from esign-routes.tsx: prep-time document management for
 * a draft envelope — manifest get/put/delete, materialise-preview, document
 * list/upload/delete/reorder, and the invite-send route (email + SMS signing
 * invitations). Mounted via `esignRoutes.route('/', documentsRoutes)`. Depends
 * on shared esign services + esign-route-helpers; behaviour-preserving, guarded
 * by the documents/manifest contract group landed ahead of this cut.
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import { getAuthContext, AuthError } from './auth-mw.ts';
import type { EsignEnvelope, EsignField, EsignSigner } from './esign-types.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { requireIdempotency } from './idempotency.ts';
import { getRequestMetadata, ensureStorageBuckets } from './esign-route-helpers.ts';
import type { SignerRecord, FieldRecord } from './esign-route-helpers.ts';
import {
  createDocument,
  getEnvelopeDetails,
  updateEnvelopeStatus,
  updateSignerStatus,
  getEnvelopeSigners,
  logAuditEvent,
  addSignersToEnvelope,
  addFieldsToEnvelope,
} from './esign-services.ts';
import {
  uploadDocument,
  downloadDocument,
  getDocumentUrl,
  validateDocument,
  calculateHash,
  extractPageCount,
} from './esign-storage.ts';
import { applyManifest, validateManifest } from './esign-pdf-transform.ts';
import {
  appendEnvelopeDocument,
  getEnvelopeDocuments,
  materialiseEnvelope,
  remapFieldsForConcatenation,
  removeEnvelopeDocument,
  reorderEnvelopeDocuments,
} from './esign-documents.ts';
import { resolvePrefilledFields } from './esign-prefill.ts';
import { createSigningInviteEmail } from './esign-email-templates.ts';
import { getActiveConsent } from './esign-consent-registry.ts';
import { sendEmail } from './email-service.ts';
import { sendInviteSms } from './sms-service.ts';

const log = createModuleLogger('esign-documents-routes');

const documentsRoutes = new Hono();

documentsRoutes.get('/envelopes/:envelopeId/manifest', async (c) => {
  try {
    await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;
    const manifest = await kv.get(EsignKeys.envelopeManifest(envelopeId));
    return c.json({ manifest: manifest ?? null });
  } catch (err) {
    log.error('Get manifest error:', err);
    const status = err instanceof AuthError ? err.statusCode : 500;
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to load manifest' }),
      { status: status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

documentsRoutes.put(
  '/envelopes/:envelopeId/manifest',
  requireIdempotency(),
  rateLimit('SENDER_MUTATE'),
  async (c) => {
    try {
      const ctx = await getAuthContext(c);
      const envelopeId = c.req.param('envelopeId')!;
      const envelope = await kv.get(EsignKeys.envelope(envelopeId));
      if (!envelope) return c.json({ error: 'Envelope not found' }, 404);
      if (envelope.status !== 'draft') {
        return c.json({ error: 'Page edits only allowed while envelope is a draft' }, 409);
      }

      const body = await c.req.json();
      const manifest = body?.manifest;

      // Look up the source page count so we can validate without opening
      // the PDF (cheap pre-flight; full validation runs on materialise).
      const document = await kv.get(EsignKeys.PREFIX_DOCUMENT + envelope.document_id);
      const sourcePageCount: number = document?.page_count ?? 0;
      if (sourcePageCount <= 0) {
        return c.json({ error: 'Source document missing or has no pages' }, 409);
      }

      const validationErr = validateManifest(manifest, sourcePageCount);
      if (validationErr) return c.json({ error: validationErr }, 400);

      await kv.set(EsignKeys.envelopeManifest(envelopeId), manifest);

      const { ip, userAgent } = getRequestMetadata(c);
      await logAuditEvent({
        envelopeId,
        actorType: 'sender_user',
        actorId: ctx.user.id,
        action: 'page_manifest_updated',
        email: ctx.user.email,
        ip,
        userAgent,
        metadata: { pageCount: manifest.pages.length, sourcePageCount },
      });

      return c.json({ success: true, manifest });
    } catch (err) {
      log.error('Save manifest error:', err);
      const status = err instanceof AuthError ? err.statusCode : 500;
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to save manifest' }),
        { status: status, headers: { 'Content-Type': 'application/json' } },
      );
    }
  },
);

documentsRoutes.delete('/envelopes/:envelopeId/manifest', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;
    await kv.del(EsignKeys.envelopeManifest(envelopeId));
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'page_manifest_cleared',
      email: ctx.user.email,
      ip,
      userAgent,
      metadata: {},
    });
    return c.json({ success: true });
  } catch (err) {
    log.error('Clear manifest error:', err);
    const status = err instanceof AuthError ? err.statusCode : 500;
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to clear manifest' }),
      { status: status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * POST /envelopes/:envelopeId/materialize-preview
 *
 * Apply the current manifest (or one supplied in the request body) to the
 * source PDF and return a short-lived signed URL to the materialised
 * output. Used by the studio to preview reordered/rotated pages without
 * persisting the result. The preview file is uploaded to the storage
 * bucket under a `previews/` prefix with a 15-minute TTL.
 *
 * Rate-limited under SENDER_MUTATE because rendering 1k-page PDFs is
 * server-CPU heavy.
 */
documentsRoutes.post(
  '/envelopes/:envelopeId/materialize-preview',
  rateLimit('SENDER_MUTATE'),
  async (c) => {
    try {
      const ctx = await getAuthContext(c);
      const envelopeId = c.req.param('envelopeId')!;
      const envelope = await kv.get(EsignKeys.envelope(envelopeId));
      if (!envelope) return c.json({ error: 'Envelope not found' }, 404);

      const document = await kv.get(EsignKeys.PREFIX_DOCUMENT + envelope.document_id);
      if (!document) return c.json({ error: 'Source document missing' }, 404);

      // Allow callers to override the saved manifest with one in the body —
      // this lets the studio preview unsaved edits.
      const body = await c.req.json().catch(() => ({}));
      const manifest = body?.manifest ?? (await kv.get(EsignKeys.envelopeManifest(envelopeId)));
      if (!manifest) return c.json({ error: 'No manifest to materialise' }, 400);

      const validationErr = validateManifest(manifest, document.page_count);
      if (validationErr) return c.json({ error: validationErr }, 400);

      // Pull the source PDF from storage.
      const sourceBuffer = await downloadDocument(document.storage_path);
      if (!sourceBuffer) return c.json({ error: 'Failed to download source PDF' }, 500);

      const result = await applyManifest(sourceBuffer, manifest);
      const previewPath = `previews/${envelopeId}/${Date.now()}.pdf`;
      const { error: uploadErr } = await uploadDocument(
        envelope.firm_id,
        envelopeId,
        result.pdfBuffer,
        previewPath,
        'application/pdf',
      );
      if (uploadErr) return c.json({ error: uploadErr }, 500);

      const url = await getDocumentUrl(previewPath);
      await logAuditEvent({
        envelopeId,
        actorType: 'sender_user',
        actorId: ctx.user.id,
        action: 'page_manifest_previewed',
        email: ctx.user.email,
        metadata: { pageCount: result.pageCount },
      });
      return c.json({ url, pageCount: result.pageCount, pageMap: result.pageMap });
    } catch (err) {
      log.error('Materialize preview error:', err);
      const status = err instanceof AuthError ? err.statusCode : 500;
      return new Response(
        JSON.stringify({
          error: err instanceof Error ? err.message : 'Failed to materialise preview',
        }),
        { status: status, headers: { 'Content-Type': 'application/json' } },
      );
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// P3.4 — Multi-document envelope routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /envelopes/:envelopeId/documents
 *
 * Returns the ordered list of documents in an envelope. The studio's
 * tab-bar uses this to render the document switcher; the response
 * synthesises a single-doc list for legacy envelopes so consumers
 * never have to special-case "old data".
 */
documentsRoutes.get('/envelopes/:envelopeId/documents', async (c) => {
  try {
    await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;
    const envelope = (await kv.get(EsignKeys.envelope(envelopeId))) as EsignEnvelope | null;
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);
    const documents = await getEnvelopeDocuments(envelope);
    // Hydrate each ref with a presigned URL so the studio can render
    // any of the documents without an extra round-trip.
    const hydrated = await Promise.all(
      documents.map(async (d) => ({
        ...d,
        url: await getDocumentUrl(d.storage_path),
      })),
    );
    return c.json({ documents: hydrated });
  } catch (err) {
    log.error('List envelope documents error:', err);
    const status = err instanceof AuthError ? err.statusCode : 500;
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to list documents' }),
      { status: status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * POST /envelopes/:envelopeId/documents
 *
 * Append a new document to an existing envelope. Mirrors the upload
 * route's validation and storage pipeline but skips envelope creation.
 */
documentsRoutes.post(
  '/envelopes/:envelopeId/documents',
  requireIdempotency(),
  rateLimit('SENDER_MUTATE'),
  async (c) => {
    try {
      const ctx = await getAuthContext(c);
      const envelopeId = c.req.param('envelopeId')!;
      const envelope = (await kv.get(EsignKeys.envelope(envelopeId))) as EsignEnvelope | null;
      if (!envelope) return c.json({ error: 'Envelope not found' }, 404);
      if (envelope.status !== 'draft') {
        return c.json({ error: 'Documents can only be added to envelopes in draft status' }, 409);
      }
      await ensureStorageBuckets();
      const body = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
      const file = body['file'];
      if (!(file instanceof File)) return c.json({ error: 'file required' }, 400);

      const buffer = new Uint8Array(await file.arrayBuffer());
      const validation = validateDocument(buffer, file.name);
      if (!validation.valid) return c.json({ error: validation.error }, 400);

      const documentId = crypto.randomUUID();
      const hash = await calculateHash(buffer);
      const pageCount = extractPageCount(buffer);
      const { path, error: uploadErr } = await uploadDocument(
        envelope.firm_id,
        documentId,
        buffer,
        file.name,
        'application/pdf',
      );
      if (uploadErr || !path) return c.json({ error: uploadErr ?? 'Upload failed' }, 500);

      await createDocument({
        id: documentId,
        firm_id: envelope.firm_id,
        storage_path: path,
        original_filename: file.name,
        page_count: pageCount,
        hash,
        created_at: new Date().toISOString(),
      });

      const displayName =
        typeof body['display_name'] === 'string' && (body['display_name'] as string).trim()
          ? (body['display_name'] as string).trim()
          : file.name.replace(/\.pdf$/i, '');

      const documents = await appendEnvelopeDocument(
        envelopeId,
        {
          document_id: documentId,
          display_name: displayName,
          original_filename: file.name,
          page_count: pageCount,
          storage_path: path,
        },
        ctx.user.id,
      );

      const { ip, userAgent } = getRequestMetadata(c);
      await logAuditEvent({
        envelopeId,
        actorType: 'sender_user',
        actorId: ctx.user.id,
        action: 'document_added',
        ip,
        userAgent,
        email: ctx.user.email,
        metadata: { documentId, filename: file.name, pageCount, hash },
      });

      const hydrated = await Promise.all(
        documents.map(async (d) => ({ ...d, url: await getDocumentUrl(d.storage_path) })),
      );
      return c.json({
        documents: hydrated,
        added: { document_id: documentId, page_count: pageCount },
      });
    } catch (err) {
      log.error('Add envelope document error:', err);
      const status = err instanceof AuthError ? err.statusCode : 500;
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to add document' }),
        { status: status, headers: { 'Content-Type': 'application/json' } },
      );
    }
  },
);

/**
 * DELETE /envelopes/:envelopeId/documents/:documentId
 *
 * Remove a document from a draft envelope. Refuses to remove the last
 * document (every envelope must have at least one).
 */
documentsRoutes.delete('/envelopes/:envelopeId/documents/:documentId', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;
    const documentId = c.req.param('documentId')!;
    const envelope = (await kv.get(EsignKeys.envelope(envelopeId))) as EsignEnvelope | null;
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);
    if (envelope.status !== 'draft') {
      return c.json({ error: 'Documents can only be removed from envelopes in draft status' }, 409);
    }
    const documents = await removeEnvelopeDocument(envelopeId, documentId);
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'document_removed',
      ip,
      userAgent,
      email: ctx.user.email,
      metadata: { documentId },
    });
    return c.json({ documents });
  } catch (err) {
    log.error('Remove envelope document error:', err);
    const status =
      err instanceof AuthError
        ? err.statusCode
        : err instanceof Error && /last document/i.test(err.message)
          ? 409
          : 500;
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to remove document' }),
      { status: status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * PUT /envelopes/:envelopeId/documents/order
 *
 * Reorder an envelope's documents. Body: `{ order: string[] }` where
 * each entry is a document_id. Unknown ids are ignored; missing ids
 * are appended to the end so a stale client cannot accidentally drop
 * documents.
 */
documentsRoutes.put('/envelopes/:envelopeId/documents/order', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;
    const envelope = (await kv.get(EsignKeys.envelope(envelopeId))) as EsignEnvelope | null;
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);
    if (envelope.status !== 'draft') {
      return c.json({ error: 'Document order can only be changed on draft envelopes' }, 409);
    }
    const body = await c.req.json().catch(() => ({}));
    const orderedIds: unknown = body?.order;
    if (!Array.isArray(orderedIds) || orderedIds.some((x) => typeof x !== 'string')) {
      return c.json({ error: 'order must be an array of document_id strings' }, 400);
    }
    const documents = await reorderEnvelopeDocuments(envelopeId, orderedIds as string[]);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'documents_reordered',
      email: ctx.user.email,
      metadata: { order: documents.map((d) => d.document_id) },
    });
    return c.json({ documents });
  } catch (err) {
    log.error('Reorder envelope documents error:', err);
    const status = err instanceof AuthError ? err.statusCode : 500;
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to reorder documents' }),
      { status: status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * POST /envelopes/:envelopeId/invites
 * Send signing invitations to signers
 */
documentsRoutes.post(
  '/envelopes/:envelopeId/invites',
  requireIdempotency(),
  rateLimit('SENDER_MUTATE'),
  async (c) => {
    try {
      // Authenticate
      const ctx = await getAuthContext(c);
      const user = ctx.user;
      const envelopeId = c.req.param('envelopeId')!;

      const body = await c.req.json();
      const { signers, fields, expiryDays: _expiryDays, message, signingMode } = body;

      if (!signers || signers.length === 0) {
        return c.json({ error: 'At least one signer required' }, 400);
      }

      // Get envelope details
      const envelope = await getEnvelopeDetails(envelopeId);

      if (!envelope) {
        return c.json({ error: 'Envelope not found' }, 404);
      }

      // Determine signing mode: sequential (default) or parallel
      const effectiveMode = signingMode || envelope.signing_mode || 'sequential';

      // Add signers
      const { signerIds, error: signerError } = await addSignersToEnvelope(
        envelopeId,
        signers.map((s: SignerRecord, _index: number) => ({
          name: s.name,
          email: s.email,
          phone: s.phone,
          role: s.role || 'Signer',
          // P2.5 2.8 — pass through kind ('signer' | 'witness' | 'cc') so the
          // audit trail tags witness attestations distinctly. Defaults to
          // 'signer' inside addSignersToEnvelope when undefined.
          kind: (s as { kind?: 'signer' | 'witness' | 'cc' }).kind,
          requiresOtp: s.requiresOtp !== false,
          accessCode: s.accessCode,
          clientId: s.clientId,
          // P5.1 — propagate SMS opt-in; only honoured on the server when a
          // phone number is also present (see addSignersToEnvelope).
          smsOptIn: (s as { smsOptIn?: boolean }).smsOptIn === true,
        })),
      );

      if (signerError) {
        return c.json({ error: signerError }, 500);
      }

      // ── P3.3 + P3.4 — Materialise envelope at send-time ──
      // Two paths converge here:
      //   • Multi-document envelopes (P3.4): concatenate every document
      //     in order, applying any per-document page manifest along the
      //     way. Field (document_id, page) tuples are remapped onto the
      //     concatenated page index.
      //   • Single-document envelopes: honour the legacy envelope-level
      //     manifest exactly as before so existing drafts keep working.
      //
      // Both branches replace the document the signer sees with a
      // materialised PDF; the originals stay on disk for the audit trail.
      let materialisedFields: FieldRecord[] = Array.isArray(fields) ? fields : [];
      const fullEnvelopeRecord = (await kv.get(
        EsignKeys.envelope(envelopeId),
      )) as EsignEnvelope | null;
      const envelopeDocs = fullEnvelopeRecord ? await getEnvelopeDocuments(fullEnvelopeRecord) : [];
      if (envelopeDocs.length > 1) {
        try {
          const result = await materialiseEnvelope(envelopeId);
          const { remapped, dropped } = remapFieldsForConcatenation(
            materialisedFields as EsignField[],
            result.pageMap,
            envelope.document_id,
          );
          materialisedFields = remapped as FieldRecord[];
          await logAuditEvent({
            envelopeId,
            actorType: 'system',
            action: 'envelope_materialised',
            metadata: {
              documentCount: envelopeDocs.length,
              totalPageCount: result.totalPageCount,
              droppedFields: dropped.length,
              perDocumentPageCounts: result.perDocumentPageCounts,
            },
          });
        } catch (matErr) {
          log.warn(
            `Multi-doc materialisation failed (sending primary only): ${matErr instanceof Error ? matErr.message : String(matErr)}`,
          );
        }
      } else {
        try {
          const manifest = await kv.get(EsignKeys.envelopeManifest(envelopeId));
          if (manifest && envelope?.document?.storage_path) {
            const sourceBuffer = await downloadDocument(envelope.document.storage_path);
            if (sourceBuffer) {
              const result = await applyManifest(sourceBuffer, manifest);
              // Upload the materialised PDF under a deterministic path so we
              // can look it up at certificate-generation time.
              const materialisedPath = `materialised/${envelope.document_id}/signing.pdf`;
              await uploadDocument(
                envelope.firm_id ?? 'standalone',
                envelope.document_id,
                result.pdfBuffer,
                materialisedPath,
                'application/pdf',
              );
              // Update document record: storage_path now points at the
              // materialised file; original_storage_path keeps the original
              // pointer for audit. page_count reflects the new doc.
              const document = await kv.get(EsignKeys.PREFIX_DOCUMENT + envelope.document_id);
              if (document) {
                await kv.set(EsignKeys.PREFIX_DOCUMENT + envelope.document_id, {
                  ...document,
                  original_storage_path: document.original_storage_path ?? document.storage_path,
                  storage_path: materialisedPath,
                  page_count: result.pageCount,
                  hash: await calculateHash(result.pdfBuffer),
                  materialised_at: new Date().toISOString(),
                });
              }
              // Remap supplied fields to the new page numbering. Drop fields
              // whose source page was deleted — they have no destination.
              if (materialisedFields.length > 0) {
                materialisedFields = materialisedFields
                  .map((f) => {
                    const oldPage = (f as { page?: number }).page;
                    if (!oldPage) return f;
                    const newPage = result.pageMap[oldPage];
                    if (newPage == null) return null;
                    return { ...f, page: newPage };
                  })
                  .filter((f): f is FieldRecord => f !== null);
              }
              await logAuditEvent({
                envelopeId,
                actorType: 'system',
                action: 'page_manifest_materialised',
                metadata: {
                  originalPageCount: envelope.document.page_count,
                  materialisedPageCount: result.pageCount,
                  droppedFields:
                    (Array.isArray(fields) ? fields.length : 0) - materialisedFields.length,
                },
              });
            }
          }
        } catch (matErr) {
          // Manifest application failure must not block sending — fall back
          // to the original document. The sender's intent (re-ordered pages)
          // is lost but the envelope is still sendable.
          log.warn(
            `Manifest materialisation failed (sending original): ${matErr instanceof Error ? matErr.message : String(matErr)}`,
          );
        }
      }

      // Add fields if provided
      if (materialisedFields.length > 0) {
        // First, clear any existing fields (e.g. from draft saves) to avoid duplicates
        // and ensure we have clean fields with correct signer IDs
        await kv.del(EsignKeys.envelopeFields(envelopeId));

        // Map signer indices to actual signer IDs
        const fieldsWithSignerIds = materialisedFields.map((field: FieldRecord) => ({
          ...field,
          signerId: signerIds[field.signerIndex as number] || signerIds[0],
        }));

        await addFieldsToEnvelope(envelopeId, fieldsWithSignerIds);

        // ── P3.6 — Resolve CRM prefill bindings ──
        // For each signer, find their fields and stamp resolved values from
        // the CRM (`client.*` tokens) and envelope context (`envelope.*`).
        // Best-effort: missing bindings yield empty values which the signer
        // can fill in by hand. We deliberately do this AFTER persistence so
        // the resolved values are visible on the existing reads path.
        try {
          const allSigners = await getEnvelopeSigners(envelopeId);
          const allFields: EsignField[] =
            (await kv.get(EsignKeys.envelopeFields(envelopeId))) ?? [];
          let totalResolved = 0;
          for (const s of allSigners) {
            const ownFields = allFields.filter((f) => f.signer_id === s.id);
            if (ownFields.length === 0) continue;
            const resolved = await resolvePrefilledFields(ownFields, {
              signer: s as EsignSigner,
              envelope: {
                advice_case_id: envelope.advice_case_id,
                product_id: envelope.product_id,
                request_id: envelope.request_id,
              },
            });
            totalResolved += resolved;
          }
          if (totalResolved > 0) {
            // Persist back the mutated fields list (resolvePrefilledFields
            // mutates in place, but we need the storage to reflect the new
            // values).
            await kv.set(EsignKeys.envelopeFields(envelopeId), allFields);
            await logAuditEvent({
              envelopeId,
              actorType: 'system',
              action: 'prefill_resolved',
              metadata: { resolvedFieldCount: totalResolved },
            });
          }
        } catch (prefillErr) {
          // Non-blocking — see esign-prefill.ts contract notes.
          log.warn(
            `Prefill resolution failed: ${prefillErr instanceof Error ? prefillErr.message : String(prefillErr)}`,
          );
        }
      }

      // P6.4 — pin the ECTA consent version in effect at send-time, if one
      // wasn't already stamped at create-time. This keeps the evidence
      // trail stable even if a legal revision to the consent text is
      // published while the envelope is in flight.
      const pinnedConsent =
        (envelope.consent_version as string | undefined) ?? (await getActiveConsent()).id;

      // Update envelope status and persist signing mode + consent pin
      await updateEnvelopeStatus(envelopeId, 'sent', {
        sent_at: new Date().toISOString(),
        signing_mode: effectiveMode,
        consent_version: pinnedConsent,
      });

      // Determine which signers to invite based on signing mode:
      // - sequential: only first signer (subsequent signers notified when previous completes)
      // - parallel: all signers at once
      const createdSigners = await getEnvelopeSigners(envelopeId);
      const sortedSigners = [...createdSigners].sort(
        (a: SignerRecord, b: SignerRecord) => (a.order || 0) - (b.order || 0),
      );
      const invitesSent: Array<{ signerId: string; email: string; success: boolean }> = [];
      const { ip, userAgent } = getRequestMetadata(c);

      const signersToInvite =
        effectiveMode === 'parallel' ? sortedSigners : sortedSigners.slice(0, 1); // Sequential: first signer only

      for (const targetSigner of signersToInvite) {
        const signingUrl = `https://www.navigatewealth.co/sign?token=${targetSigner.access_token}`;

        const emailContent = createSigningInviteEmail({
          signerName: targetSigner.name,
          envelopeTitle: envelope.title,
          senderName: user.email || 'Navigate Wealth',
          signingLink: signingUrl,
          message,
        });

        const emailSent = await sendEmail({
          to: targetSigner.email,
          subject: `Signature Request: ${envelope.title}`,
          html: emailContent.html,
          text: emailContent.text,
        });

        if (emailSent) {
          await updateSignerStatus(targetSigner.id, 'sent', {
            invite_sent_at: new Date().toISOString(),
          });
          invitesSent.push({ signerId: targetSigner.id, email: targetSigner.email });
        }

        await logAuditEvent({
          envelopeId,
          actorType: 'system',
          action: 'invite_sent',
          email: targetSigner.email,
          ip,
          userAgent,
          metadata: {
            signerId: targetSigner.id,
            signerName: targetSigner.name,
            signingMode: effectiveMode,
            totalSigners: sortedSigners.length,
          },
        });

        // P5.1 — parallel SMS delivery (opt-in only; best-effort, never
        // blocks email). We don't fail the invite if SMS bounces — email
        // is still the legally defensible channel.
        if (targetSigner.sms_opt_in && targetSigner.phone) {
          try {
            const smsResult = await sendInviteSms({
              to: targetSigner.phone,
              signerName: targetSigner.name,
              envelopeTitle: envelope.title,
              signingUrl: signingUrl,
            });
            if (smsResult.delivered) {
              await logAuditEvent({
                envelopeId,
                actorType: 'system',
                action: 'invite_sms_sent',
                email: targetSigner.email,
                phone: targetSigner.phone,
                ip,
                userAgent,
                metadata: {
                  signerId: targetSigner.id,
                  provider: smsResult.provider,
                  messageId: smsResult.messageId,
                },
              });
            }
          } catch (smsErr) {
            log.warn(`SMS invite failed for signer ${targetSigner.id}: ${getErrMsg(smsErr)}`);
          }
        }
      }

      log.info(
        `Invites sent for envelope ${envelopeId} in ${effectiveMode} mode: ${invitesSent.length} of ${sortedSigners.length} signers`,
      );

      // Admin audit trail (non-blocking — §12.2)
      AdminAuditService.record({
        actorId: user.id,
        actorRole: 'admin',
        category: 'communication',
        action: 'esign_invites_sent',
        summary: `Signing invitations sent (${invitesSent.length} of ${sortedSigners.length} signers)`,
        severity: 'warning',
        entityType: 'envelope',
        entityId: envelopeId,
        metadata: {
          signingMode: effectiveMode,
          inviteCount: invitesSent.length,
          totalSigners: sortedSigners.length,
        },
      }).catch(() => {});

      return c.json({
        success: true,
        invitesSent,
        envelopeId,
        totalSigners: sortedSigners.length,
        signingMode: effectiveMode,
      });
    } catch (error: unknown) {
      log.error('❌ Send invites error:', error);
      const status = error instanceof AuthError ? error.statusCode : 500;
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to send invites',
        }),
        { status: status, headers: { 'Content-Type': 'application/json' } },
      );
    }
  },
);

export default documentsRoutes;
