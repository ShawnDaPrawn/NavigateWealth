/**
 * esign /v1/* routes — the stable public REST API (Phase 5).
 * ==========================================================
 *
 * Extracted verbatim from esign-routes.tsx: the API-key-authenticated public
 * surface (list/get envelopes, audit, signed-pdf, list/get templates, and
 * create-envelope-from-template). Mounted via
 * `esignRoutes.route('/', v1Routes)`. Authenticates with requireApiKey (from
 * esign-route-helpers) rather than the session getAuthContext. Depends only on
 * shared esign services. Behaviour-preserving; the contract suite is the guard.
 */
import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { requireApiKey } from './esign-route-helpers.ts';
import {
  createEnvelope,
  createDocument,
  getEnvelopeDetails,
  getAllEnvelopes,
  getAuditTrail,
  addSignersToEnvelope,
  addFieldsToEnvelope,
  logAuditEvent,
} from './esign-services.ts';
import {
  uploadDocument,
  downloadDocument,
  validateDocument,
  calculateHash,
  extractPageCount,
} from './esign-storage.ts';
import { getTemplate, listTemplates, incrementUsageCount } from './esign-template-service.ts';

const log = createModuleLogger('esign-v1-routes');

const v1Routes = new Hono();

v1Routes.get('/v1/envelopes', async (c) => {
  const auth = await requireApiKey(c);
  if (!auth.ok) return auth.response;
  try {
    const all = await getAllEnvelopes();
    const scoped = (all as Array<Record<string, unknown>>).filter((e) => e.firm_id === auth.firmId);
    const status = c.req.query('status');
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
    const filtered = status ? scoped.filter((e) => e.status === status) : scoped;
    return c.json({
      envelopes: filtered.slice(0, limit).map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        created_at: e.created_at,
        updated_at: e.updated_at,
        sent_at: e.sent_at,
        completed_at: e.completed_at,
        expires_at: e.expires_at,
      })),
      count: Math.min(filtered.length, limit),
    });
  } catch (error: unknown) {
    log.error('v1 list envelopes error:', error);
    return c.json({ error: 'Failed to list envelopes' }, 500);
  }
});

/** GET /v1/envelopes/:id — single envelope with signers & fields. */
v1Routes.get('/v1/envelopes/:id', async (c) => {
  const auth = await requireApiKey(c);
  if (!auth.ok) return auth.response;
  try {
    const id = c.req.param('id')!;
    const envelope = await getEnvelopeDetails(id);
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);
    if (envelope.firm_id !== auth.firmId) return c.json({ error: 'Forbidden' }, 403);
    return c.json({ envelope });
  } catch (error: unknown) {
    log.error('v1 get envelope error:', error);
    return c.json({ error: 'Failed to load envelope' }, 500);
  }
});

/** GET /v1/envelopes/:id/audit — audit trail. */
v1Routes.get('/v1/envelopes/:id/audit', async (c) => {
  const auth = await requireApiKey(c);
  if (!auth.ok) return auth.response;
  try {
    const id = c.req.param('id')!;
    const envelope = await getEnvelopeDetails(id);
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);
    if (envelope.firm_id !== auth.firmId) return c.json({ error: 'Forbidden' }, 403);
    const events = await getAuditTrail(id);
    return c.json({ events });
  } catch (error: unknown) {
    log.error('v1 audit trail error:', error);
    return c.json({ error: 'Failed to load audit trail' }, 500);
  }
});

/** GET /v1/envelopes/:id/signed-pdf — binary download of the signed PDF. */
v1Routes.get('/v1/envelopes/:id/signed-pdf', async (c) => {
  const auth = await requireApiKey(c);
  if (!auth.ok) return auth.response;
  try {
    const id = c.req.param('id')!;
    const envelope = await getEnvelopeDetails(id);
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);
    if (envelope.firm_id !== auth.firmId) return c.json({ error: 'Forbidden' }, 403);
    if (envelope.status !== 'completed') {
      return c.json({ error: 'Signed PDF available only for completed envelopes' }, 409);
    }
    const path = envelope.signed_document_path;
    if (!path) return c.json({ error: 'Signed document not yet materialised' }, 404);
    const buf = await downloadDocument(path);
    if (!buf) return c.json({ error: 'Signed document missing in storage' }, 404);
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="envelope_${id}_signed.pdf"`,
      },
    });
  } catch (error: unknown) {
    log.error('v1 download signed pdf error:', error);
    return c.json({ error: 'Failed to download signed PDF' }, 500);
  }
});

/** GET /v1/templates — list templates for this firm. */
v1Routes.get('/v1/templates', async (c) => {
  const auth = await requireApiKey(c);
  if (!auth.ok) return auth.response;
  try {
    const templates = await listTemplates();
    const scoped = (templates as Array<Record<string, unknown>>).filter(
      (t) => !t.firm_id || t.firm_id === auth.firmId,
    );
    return c.json({ templates: scoped });
  } catch (error: unknown) {
    log.error('v1 list templates error:', error);
    return c.json({ error: 'Failed to list templates' }, 500);
  }
});

/** GET /v1/templates/:id — template detail. */
v1Routes.get('/v1/templates/:id', async (c) => {
  const auth = await requireApiKey(c);
  if (!auth.ok) return auth.response;
  try {
    const id = c.req.param('id')!;
    const template = await getTemplate(id);
    if (!template) return c.json({ error: 'Template not found' }, 404);
    const tFirm = (template as unknown as Record<string, unknown>).firm_id as string | undefined;
    if (tFirm && tFirm !== auth.firmId) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.json({ template });
  } catch (error: unknown) {
    log.error('v1 get template error:', error);
    return c.json({ error: 'Failed to load template' }, 500);
  }
});

/**
 * POST /v1/envelopes/from-template — materialise a draft envelope from a
 * saved template. Callers provide a base64-encoded PDF and the recipient
 * slots that fill the template's recipient list (by index). The response
 * returns the new envelope id ready for a follow-up `send` invocation from
 * the admin UI, or may be auto-sent if `send: true` is supplied.
 *
 * Body:
 *   {
 *     templateId: string,
 *     documentBase64: string,       // raw PDF bytes, base64
 *     filename?: string,
 *     title?: string,
 *     clientId?: string,
 *     message?: string,
 *     expiryDays?: number,
 *     recipients: Array<{ name: string; email: string; phone?: string; smsOptIn?: boolean }>
 *   }
 */
v1Routes.post('/v1/envelopes/from-template', rateLimit('SENDER_MUTATE'), async (c) => {
  const auth = await requireApiKey(c);
  if (!auth.ok) return auth.response;
  try {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

    const templateId = String(body.templateId ?? '').trim();
    const documentBase64 = String(body.documentBase64 ?? '').trim();
    const recipients = Array.isArray(body.recipients)
      ? (body.recipients as Array<Record<string, unknown>>)
      : [];

    if (!templateId) return c.json({ error: 'templateId required' }, 400);
    if (!documentBase64) return c.json({ error: 'documentBase64 required' }, 400);
    if (recipients.length === 0)
      return c.json({ error: 'At least one recipient is required' }, 400);

    const template = await getTemplate(templateId);
    if (!template) return c.json({ error: 'Template not found' }, 404);
    const tFirm = (template as unknown as Record<string, unknown>).firm_id as string | undefined;
    if (tFirm && tFirm !== auth.firmId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    if (template.recipients.length > 0 && recipients.length < template.recipients.length) {
      return c.json(
        {
          error: `Template requires ${template.recipients.length} recipient(s); received ${recipients.length}.`,
        },
        400,
      );
    }

    let buffer: Uint8Array;
    try {
      const bin = atob(documentBase64.replace(/^data:.*;base64,/, ''));
      buffer = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buffer[i] = bin.charCodeAt(i);
    } catch {
      return c.json({ error: 'documentBase64 is not valid base64' }, 400);
    }

    const filename = String(body.filename ?? `${template.name || 'template'}.pdf`);
    const validation = validateDocument(buffer, filename);
    if (!validation.valid) return c.json({ error: validation.error }, 400);

    const hash = await calculateHash(buffer);
    const pageCount = extractPageCount(buffer);
    const documentId = crypto.randomUUID();

    const { path, error: uploadError } = await uploadDocument(
      auth.firmId,
      documentId,
      buffer,
      filename,
      'application/pdf',
    );
    if (uploadError || !path) {
      return c.json({ error: uploadError || 'Upload failed' }, 500);
    }

    await createDocument({
      id: documentId,
      firm_id: auth.firmId,
      storage_path: path,
      original_filename: filename,
      page_count: pageCount,
      hash,
      created_at: new Date().toISOString(),
    });

    const title = String(body.title ?? template.name ?? 'Envelope from template');
    const clientId = String(body.clientId ?? 'standalone');
    const message = typeof body.message === 'string' ? body.message : template.defaultMessage;
    const expiryDays =
      typeof body.expiryDays === 'number' ? body.expiryDays : template.defaultExpiryDays;

    const { envelopeId, error: envError } = await createEnvelope({
      firmId: auth.firmId,
      clientId,
      title,
      documentId,
      createdByUserId: `api:${auth.keyId}`,
      signers: [],
      message,
      expiryDays,
      signingMode: template.signingMode,
      templateId: template.id,
      templateVersion: template.version,
    });

    if (envError || !envelopeId) {
      return c.json({ error: envError || 'Failed to create envelope' }, 500);
    }

    const signerInputs = recipients.map((r, i) => {
      const slot = template.recipients[i];
      const name = String(r.name ?? slot?.name ?? '').trim();
      const email = String(r.email ?? slot?.email ?? '').trim();
      return {
        name,
        email,
        phone: typeof r.phone === 'string' ? r.phone : undefined,
        role: slot?.role,
        requiresOtp: slot?.otpRequired === true,
        smsOptIn: r.smsOptIn === true,
      };
    });

    const missing = signerInputs.find((s) => !s.name || !s.email);
    if (missing) {
      return c.json({ error: 'Every recipient must include name + email' }, 400);
    }

    const { signerIds, error: signerError } = await addSignersToEnvelope(envelopeId, signerInputs);
    if (signerError) {
      return c.json({ error: signerError }, 500);
    }

    if (template.fields.length > 0) {
      const fields = template.fields
        .map((f) => {
          const signerId = signerIds[f.recipientIndex];
          if (!signerId) return null;
          return {
            signerId,
            type: f.type,
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            required: f.required,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      if (fields.length > 0) {
        await addFieldsToEnvelope(envelopeId, fields);
      }
    }

    await incrementUsageCount(template.id);

    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: `api:${auth.keyId}`,
      action: 'envelope_created_from_template_api',
      metadata: {
        template_id: template.id,
        template_version: template.version,
        recipient_count: signerInputs.length,
      },
    });

    return c.json(
      {
        envelope_id: envelopeId,
        status: 'draft',
        document_id: documentId,
        signer_ids: signerIds,
        template_id: template.id,
        template_version: template.version,
      },
      201,
    );
  } catch (error: unknown) {
    log.error('v1 create from template error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to create envelope' },
      500,
    );
  }
});

export default v1Routes;
