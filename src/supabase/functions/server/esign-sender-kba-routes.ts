import { Hono } from 'npm:hono';
import { getAuthContext, AuthError } from './auth-mw.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { rateLimit } from './esign-rate-limit.ts';
import {
  getSignerByToken,
  getEnvelopeDetails,
  updateSignerStatus,
  logAuditEvent,
} from './esign-services.ts';
import { runKbaCheck, getKbaStatus } from './kba-service.ts';

const log = createModuleLogger('esign-sender-kba-routes');

const app = new Hono();

/** GET /diagnostics/kba — admin: show which provider is wired. */
app.get('/diagnostics/kba', async (c) => {
  try {
    await getAuthContext(c);
    return c.json({ success: true, ...getKbaStatus() });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: getErrMsg(error) }, status);
  }
});

/**
 * POST /signer/kba — public; run (or re-run) a KBA check for the signer
 * associated with the supplied access token. Returns the result and
 * stamps it onto the signer record.
 */
app.post('/signer/kba', rateLimit('SIGNER_ACCESS'), async (c) => {
  try {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    const token = String(body.access_token ?? '').trim();
    if (!token) return c.json({ error: 'access_token required' }, 400);
    const signer = await getSignerByToken(token);
    if (!signer) return c.json({ error: 'Invalid access token' }, 404);
    const envelope = await getEnvelopeDetails(signer.envelope_id);
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);

    const idNumber = typeof body.id_number === 'string' ? body.id_number : undefined;

    const result = await runKbaCheck({
      signerId: signer.id,
      envelopeId: signer.envelope_id,
      fullName: signer.name,
      email: signer.email,
      phone: signer.phone,
      idNumber,
    });

    await updateSignerStatus(signer.id, signer.status, {
      kba: {
        provider: result.provider,
        status: result.status,
        reference: result.reference,
        verified_at: result.verifiedAt ?? new Date().toISOString(),
      },
    });

    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: 'signer',
      actorId: signer.id,
      action: 'kba_check',
      email: signer.email,
      metadata: {
        provider: result.provider,
        status: result.status,
        reference: result.reference,
      },
    });

    return c.json({
      success: result.status === 'passed' || result.status === 'skipped',
      provider: result.provider,
      status: result.status,
      action_url: result.actionUrl ?? null,
      details: result.details ?? null,
    });
  } catch (error: unknown) {
    log.error('Signer KBA error:', error);
    return c.json({ error: getErrMsg(error) }, 500);
  }
});

export default app;
