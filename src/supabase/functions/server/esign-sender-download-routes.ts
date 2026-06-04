import { Hono } from 'npm:hono';
import { getAuthContext, AuthError } from './auth-mw.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getRequestMetadata, resolveFirmId } from './esign-route-helpers.ts';
import { PDFService } from './esign-pdf.service.ts';
import {
  getEnvelopeDetails,
  getEnvelopeSigners,
  updateEnvelopeStatus,
  getAuditTrail,
  logAuditEvent,
} from './esign-services.ts';
import { downloadDocument } from './esign-storage.ts';
import { generateCompletionCertificate } from './esign-certificates.ts';
import { buildEvidencePack } from './esign-evidence-export.ts';
import { getReminderConfig, setReminderConfig } from './esign-automation.ts';

const log = createModuleLogger('esign-sender-download-routes');

const app = new Hono();

/**
 * GET /envelopes/:envelopeId/download
 * Download completed envelope with signatures applied
 */
app.get('/envelopes/:envelopeId/download', async (c) => {
  try {
    // Authenticate
    const _ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Only allow download of completed envelopes
    if (envelope.status !== 'completed') {
      return c.json(
        {
          error: 'Only completed envelopes can be downloaded',
        },
        400,
      );
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
      // If buffer is null (file missing), fall back to on-the-fly generation below
    }

    // FALLBACK: On-the-fly generation (for legacy envelopes or if artifact missing)

    // Get original document path
    const documentPath = envelope.document?.storage_path;
    if (!documentPath) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // 1. Download original PDF
    const pdfBuffer = await downloadDocument(documentPath);
    if (!pdfBuffer) {
      return c.json({ error: 'Failed to retrieve source document' }, 500);
    }

    // 2. Get signers to cross-reference
    const signers = await getEnvelopeSigners(envelopeId);

    // 3. Perform Burn-in
    try {
      const { pdfBuffer: burnedPdfBuffer } = await PDFService.burnIn(
        pdfBuffer,
        envelope.fields || [],
        signers,
      );

      // Try to merge certificate if available, otherwise just return burned PDF
      let finalPdfBuffer = burnedPdfBuffer;

      // Try to generate/fetch cert
      // We don't want to fail the download if cert generation fails here, just return the signed doc
      try {
        const { pdfBuffer: certBuffer } = await generateCompletionCertificate(envelopeId);
        if (certBuffer) {
          finalPdfBuffer = await PDFService.mergeCertificate(burnedPdfBuffer, certBuffer);
        }
      } catch (certError) {
        log.warn('Certificate merge failed during fallback download, returning signed doc only', {
          error: certError,
        });
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
    log.error('❌ Download envelope error:', error);
    const status = error instanceof AuthError ? error.status : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to download envelope' },
      status,
    );
  }
});

/**
 * GET /envelopes/:envelopeId/evidence-pack
 * P6.7 — download a ZIP bundling the signed PDF, certificate, audit
 * trail, manifest, consent copy, and every attachment. Admin-only.
 */
app.get('/envelopes/:envelopeId/evidence-pack', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');

    // P6.9 — firm scoping. The current admin user must belong to the
    // same firm as the envelope (or the envelope must be 'standalone').
    const envelope = await getEnvelopeDetails(envelopeId);
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);

    const callerFirm = resolveFirmId(ctx.user);
    const envelopeFirm = (envelope.firm_id as string | undefined) || 'standalone';
    if (envelopeFirm !== 'standalone' && envelopeFirm !== callerFirm) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const pack = await buildEvidencePack(envelopeId);
    if (!pack) return c.json({ error: 'Envelope not found' }, 404);

    await logAuditEvent({
      envelopeId,
      actorType: 'admin',
      actorId: ctx.user.id,
      action: 'evidence_pack_exported',
      email: ctx.user.email || 'admin@system',
      metadata: { bytes: pack.zip.length, filename: pack.filename },
    });

    return new Response(pack.zip, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${pack.filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    log.error('Evidence pack export error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to build evidence pack' },
      status,
    );
  }
});

// ==================== REMINDER CONFIG ROUTES ====================

/**
 * GET /envelopes/:envelopeId/reminder-config
 * Get reminder configuration for an envelope
 */
app.get('/envelopes/:envelopeId/reminder-config', async (c) => {
  try {
    const _ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');
    const config = await getReminderConfig(envelopeId);
    return c.json({ config });
  } catch (error: unknown) {
    log.error('Get reminder config error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to get reminder config' },
      status,
    );
  }
});

/**
 * PUT /envelopes/:envelopeId/reminder-config
 * Update reminder configuration for an envelope
 */
app.put('/envelopes/:envelopeId/reminder-config', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const envelopeId = c.req.param('envelopeId');

    const body = await c.req.json();
    const {
      auto_remind,
      schedule,
      remind_interval_days,
      max_reminders,
      remind_before_expiry_days,
      escalation_offsets_days,
    } = body;

    await setReminderConfig(envelopeId, {
      ...(auto_remind !== undefined && { auto_remind }),
      ...(schedule !== undefined && schedule !== null && { schedule }),
      ...(remind_interval_days !== undefined && { remind_interval_days }),
      ...(max_reminders !== undefined && { max_reminders }),
      ...(remind_before_expiry_days !== undefined && { remind_before_expiry_days }),
      ...(Array.isArray(escalation_offsets_days) && { escalation_offsets_days }),
    });

    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: user.id,
      action: 'reminder_config_updated',
      ip,
      userAgent,
      email: user.email,
      metadata: body,
    });

    const updated = await getReminderConfig(envelopeId);
    return c.json({ config: updated });
  } catch (error: unknown) {
    log.error('Update reminder config error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to update reminder config' },
      status,
    );
  }
});

/**
 * PATCH /envelopes/:envelopeId/signing-mode
 * Update signing mode (sequential/parallel) for an envelope
 */
app.patch('/envelopes/:envelopeId/signing-mode', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const envelopeId = c.req.param('envelopeId');

    const body = await c.req.json();
    const { signing_mode } = body;

    if (!signing_mode || !['sequential', 'parallel'].includes(signing_mode)) {
      return c.json({ error: 'signing_mode must be "sequential" or "parallel"' }, 400);
    }

    const envelope = await getEnvelopeDetails(envelopeId);
    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Only allow changing mode on draft or sent envelopes
    if (!['draft', 'sent'].includes(envelope.status)) {
      return c.json(
        { error: `Cannot change signing mode for envelope with status: ${envelope.status}` },
        400,
      );
    }

    await updateEnvelopeStatus(envelopeId, envelope.status, { signing_mode });

    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: user.id,
      action: 'signing_mode_changed',
      ip,
      userAgent,
      email: user.email,
      metadata: { from: envelope.signing_mode, to: signing_mode },
    });

    return c.json({ success: true, signing_mode });
  } catch (error: unknown) {
    log.error('Update signing mode error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to update signing mode' },
      status,
    );
  }
});

// ==================== PHASE 3: AUDIT TRAIL EXPORT ====================

/**
 * GET /envelopes/:envelopeId/audit/export
 * Export audit trail as CSV.
 */
app.get('/envelopes/:envelopeId/audit/export', async (c) => {
  try {
    const _ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');

    const events = await getAuditTrail(envelopeId);
    if (!events || events.length === 0) {
      return c.json({ error: 'No audit events found' }, 404);
    }

    // Build CSV
    const headers = ['Timestamp', 'Action', 'Actor Type', 'Actor Email', 'IP Address', 'Details'];
    const rows = events
      .sort(
        (a: Record<string, unknown>, b: Record<string, unknown>) =>
          new Date(String(a.at || a.created_at || 0)).getTime() -
          new Date(String(b.at || b.created_at || 0)).getTime(),
      )
      .map((e: Record<string, unknown>) => {
        const timestamp = String(e.at || e.created_at || '');
        const action = String(e.action || '')
          .replace(/_/g, ' ')
          .toUpperCase();
        const actorType = String(e.actor_type || '');
        const actorEmail = String(e.email || '');
        const ip = String(e.ip || '');
        const details = e.metadata ? JSON.stringify(e.metadata).replace(/"/g, '""') : '';
        return `"${timestamp}","${action}","${actorType}","${actorEmail}","${ip}","${details}"`;
      });

    const csv = [headers.join(','), ...rows].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-trail-${envelopeId.slice(0, 8)}.csv"`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
      },
    });
  } catch (error: unknown) {
    log.error('Audit export error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to export audit trail' },
      status,
    );
  }
});

export default app;
