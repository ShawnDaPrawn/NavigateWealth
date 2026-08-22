import { Hono } from 'npm:hono';
import { getAuthContext, AuthError } from './auth-mw.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getAuditTrail } from './esign-services.ts';
import { requireOwnedEnvelope, firmScopeResponse } from './esign-route-helpers.ts';
import { getDocumentUrl, getCertificateUrl } from './esign-storage.ts';
import { getCertificate } from './esign-certificates.ts';

const log = createModuleLogger('esign-sender-audit-routes');

const app = new Hono();

/**
 * GET /envelopes/:envelopeId/audit
 * Get audit trail
 */
app.get('/envelopes/:envelopeId/audit', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;

    // Ownership, not just authentication (S6). This route did not even load the
    // envelope before returning its audit trail.
    const envelope = await requireOwnedEnvelope(ctx.user, envelopeId);
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);

    const events = await getAuditTrail(envelopeId);

    return c.json({ events });
  } catch (error: unknown) {
    log.error('❌ Get audit trail error:', error);
    const forbidden = firmScopeResponse(c, error);
    if (forbidden) return forbidden;
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to fetch audit trail',
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * GET /envelopes/:envelopeId/document
 * Get document URL
 */
app.get('/envelopes/:envelopeId/document', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;

    const envelope = await requireOwnedEnvelope(ctx.user, envelopeId);

    if (!envelope || !envelope.document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    const url = await getDocumentUrl(envelope.document.storage_path);

    return c.json({ url });
  } catch (error: unknown) {
    log.error('❌ Get document URL error:', error);
    const forbidden = firmScopeResponse(c, error);
    if (forbidden) return forbidden;
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to get document URL',
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * GET /envelopes/:envelopeId/certificate
 * Get certificate URL
 */
app.get('/envelopes/:envelopeId/certificate', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;

    // A completion certificate names the signers and the document — ownership
    // must be established before it is handed out (S6).
    const envelope = await requireOwnedEnvelope(ctx.user, envelopeId);
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);

    const certificate = await getCertificate(envelopeId);

    if (!certificate.exists) {
      return c.json({ error: 'Certificate not found' }, 404);
    }

    const url = await getCertificateUrl(certificate.storagePath!);

    return c.json({ url, certificate });
  } catch (error: unknown) {
    log.error('❌ Get certificate URL error:', error);
    const forbidden = firmScopeResponse(c, error);
    if (forbidden) return forbidden;
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to get certificate URL',
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

export default app;
