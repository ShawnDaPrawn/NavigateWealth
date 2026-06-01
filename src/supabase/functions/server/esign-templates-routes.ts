/**
 * esign /templates/* routes — reusable envelope templates (Phase 5).
 * ==================================================================
 *
 * Extracted verbatim from esign-routes.tsx: template CRUD, versioning,
 * create-from-envelope / sync-from-envelope, and materialise-draft (spin a
 * template into a new draft envelope). Mounted via
 * `esignRoutes.route('/', templatesRoutes)`. Depends on shared esign services
 * + esign-route-helpers (resolveFirmId, ensureStorageBuckets); the template
 * service functions used only here move with it. Behaviour-preserving; the
 * contract suite is the guard.
 */
import { Hono } from 'npm:hono';
import { getAuthContext, AuthError } from './auth-mw.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { requireIdempotency } from './idempotency.ts';
import { resolveFirmId, ensureStorageBuckets } from './esign-route-helpers.ts';
import { createEnvelope, getEnvelopeDetails, setEnvelopeDocuments } from './esign-services.ts';
import { getDocumentUrl } from './esign-storage.ts';
import {
  createTemplate,
  cloneTemplateDocumentsToEnvelope,
  getTemplate,
  listTemplates,
  syncTemplateFromEnvelope,
  updateTemplate,
  deleteTemplate,
  createTemplateFromEnvelope,
  incrementUsageCount,
  getTemplateVersion,
  listTemplateVersions,
} from './esign-template-service.ts';

const templatesRoutes = new Hono();

templatesRoutes.post('/templates', requireIdempotency(), rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const auth = await getAuthContext(c);
    const body = await c.req.json();

    if (!body.name || !body.name.trim()) {
      return c.json({ error: 'Template name is required' }, 400);
    }

    let template;

    if (body.fromEnvelopeId) {
      // Create from existing envelope
      template = await createTemplateFromEnvelope({
        envelopeId: body.fromEnvelopeId,
        name: body.name,
        description: body.description,
        category: body.category,
        createdBy: auth.userId || auth.user?.email || 'unknown',
      });
    } else {
      // Create blank / from provided data
      template = await createTemplate({
        name: body.name,
        description: body.description,
        category: body.category,
        signingMode: body.signingMode,
        defaultMessage: body.defaultMessage,
        defaultExpiryDays: body.defaultExpiryDays,
        recipients: body.recipients,
        fields: body.fields,
        createdBy: auth.userId || auth.user?.email || 'unknown',
      });
    }

    if (!template) {
      return c.json({ error: 'Failed to create template' }, 500);
    }

    return c.json({ template });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('Create template error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to create template' },
      500,
    );
  }
});

/**
 * GET /templates
 * List all templates
 */
templatesRoutes.get('/templates', async (c) => {
  try {
    await getAuthContext(c);
    const templates = await listTemplates();
    return c.json({ templates });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('List templates error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to list templates' },
      500,
    );
  }
});

/**
 * GET /templates/:templateId
 * Get single template
 */
templatesRoutes.get('/templates/:templateId', async (c) => {
  try {
    await getAuthContext(c);
    const templateId = c.req.param('templateId');
    const template = await getTemplate(templateId);

    if (!template) {
      return c.json({ error: 'Template not found' }, 404);
    }

    return c.json({ template });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('Get template error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to get template' },
      500,
    );
  }
});

/**
 * PUT /templates/:templateId
 * Update template
 */
templatesRoutes.put('/templates/:templateId', async (c) => {
  try {
    await getAuthContext(c);
    const templateId = c.req.param('templateId');
    const body = await c.req.json();

    const updated = await updateTemplate(templateId, body);
    if (!updated) {
      return c.json({ error: 'Template not found' }, 404);
    }

    return c.json({ template: updated });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('Update template error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to update template' },
      500,
    );
  }
});

/**
 * POST /templates/:templateId/from-envelope
 * Rebuild a template from a configured draft envelope so documents, fields,
 * signing mode, and recipient slots can be updated in one save.
 */
templatesRoutes.post('/templates/:templateId/from-envelope', async (c) => {
  try {
    await getAuthContext(c);
    const templateId = c.req.param('templateId');
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const envelopeId = String(body.envelopeId ?? '').trim();
    if (!envelopeId) {
      return c.json({ error: 'envelopeId is required' }, 400);
    }

    const updated = await syncTemplateFromEnvelope({
      templateId,
      envelopeId,
      name: typeof body.name === 'string' ? body.name : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      category: typeof body.category === 'string' ? body.category : undefined,
    });

    if (!updated) {
      return c.json({ error: 'Template not found' }, 404);
    }

    return c.json({ template: updated });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('Sync template from envelope error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to sync template' },
      500,
    );
  }
});

/**
 * POST /templates/:templateId/materialise-draft
 * Clone the template's saved source documents into a fresh draft envelope
 * so the admin can edit recipients, fields, or send without re-uploading.
 */
templatesRoutes.post('/templates/:templateId/materialise-draft', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const templateId = c.req.param('templateId');
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

    const template = await getTemplate(templateId);
    if (!template) {
      return c.json({ error: 'Template not found' }, 404);
    }
    if (!Array.isArray(template.documents) || template.documents.length === 0) {
      return c.json({ error: 'This template does not have a saved source document yet.' }, 400);
    }

    await ensureStorageBuckets();

    const firmId = resolveFirmId(user);
    const title =
      typeof body.title === 'string' && body.title.trim() ? body.title.trim() : template.name;
    const message = typeof body.message === 'string' ? body.message : template.defaultMessage;
    const expiryDays =
      typeof body.expiryDays === 'number' && Number.isFinite(body.expiryDays)
        ? Math.max(1, Math.round(body.expiryDays))
        : template.defaultExpiryDays || 30;
    const clientId =
      typeof body.clientId === 'string' && body.clientId.trim()
        ? body.clientId.trim()
        : 'standalone';

    const cloned = await cloneTemplateDocumentsToEnvelope({
      template,
      firmId,
      addedByUserId: user.id,
    });

    const { envelopeId, error: envError } = await createEnvelope({
      firmId,
      clientId,
      title,
      documentId: cloned.primaryDocumentId,
      createdByUserId: user.id,
      signers: [],
      message,
      expiryDays,
      signingMode: template.signingMode,
      templateId: template.id,
      templateVersion: template.version,
      campaignId: typeof body.campaignId === 'string' ? body.campaignId : undefined,
      packetRunId: typeof body.packetRunId === 'string' ? body.packetRunId : undefined,
      packetStepIndex: typeof body.packetStepIndex === 'number' ? body.packetStepIndex : undefined,
    });
    if (envError || !envelopeId) {
      return c.json({ error: envError || 'Failed to create envelope from template' }, 500);
    }

    if (cloned.documents.length > 1) {
      await setEnvelopeDocuments(envelopeId, cloned.documents);
    }

    const envelope = await getEnvelopeDetails(envelopeId);
    if (!envelope) {
      return c.json({ error: 'Draft envelope could not be loaded' }, 500);
    }

    const documentUrl = cloned.documents[0]?.storage_path
      ? await getDocumentUrl(cloned.documents[0].storage_path)
      : null;

    return c.json({
      envelope: {
        ...envelope,
        document: envelope.document
          ? {
              ...envelope.document,
              url: documentUrl,
            }
          : envelope.document,
      },
      documentMap: cloned.documentMap,
      documents: cloned.documents,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('Materialise template draft error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to start from template' },
      500,
    );
  }
});

/**
 * DELETE /templates/:templateId
 * Delete template
 */
templatesRoutes.delete('/templates/:templateId', async (c) => {
  try {
    await getAuthContext(c);
    const templateId = c.req.param('templateId');
    const deleted = await deleteTemplate(templateId);

    if (!deleted) {
      return c.json({ error: 'Template not found' }, 404);
    }

    return c.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('Delete template error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to delete template' },
      500,
    );
  }
});

/**
 * POST /templates/:templateId/use
 * Increment usage counter (called when user starts an envelope from a template).
 * P4.2 — Returns the pinned `version` so the caller can stamp it on the
 * envelope at create-time. The express wizard threads this through the
 * upload context so the envelope record records exactly which template
 * snapshot it was materialised from.
 */
templatesRoutes.post('/templates/:templateId/use', async (c) => {
  try {
    await getAuthContext(c);
    const templateId = c.req.param('templateId');

    const template = await getTemplate(templateId);
    if (!template) {
      return c.json({ error: 'Template not found' }, 404);
    }

    await incrementUsageCount(templateId);
    return c.json({
      success: true,
      usageCount: (template.usageCount || 0) + 1,
      version: template.version ?? 1,
      template,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('Use template error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to use template' },
      500,
    );
  }
});

/**
 * GET /templates/:templateId/versions
 * P4.2 — list available historical versions of a template.
 */
templatesRoutes.get('/templates/:templateId/versions', async (c) => {
  try {
    await getAuthContext(c);
    const templateId = c.req.param('templateId');
    const versions = await listTemplateVersions(templateId);
    return c.json({ versions });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('List template versions error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to list versions' },
      500,
    );
  }
});

/**
 * GET /templates/:templateId/versions/:version
 * P4.2 — fetch a specific historical version of a template (returns
 * the live record when version matches the live one).
 */
templatesRoutes.get('/templates/:templateId/versions/:version', async (c) => {
  try {
    await getAuthContext(c);
    const templateId = c.req.param('templateId');
    const versionParam = c.req.param('version');
    const version = Number.parseInt(versionParam, 10);
    if (!Number.isFinite(version) || version < 1) {
      return c.json({ error: 'Invalid version' }, 400);
    }
    const template = await getTemplateVersion(templateId, version);
    if (!template) {
      return c.json({ error: 'Template version not found' }, 404);
    }
    return c.json({ template });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    log.error('Get template version error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to load version' },
      500,
    );
  }
});

export default templatesRoutes;
