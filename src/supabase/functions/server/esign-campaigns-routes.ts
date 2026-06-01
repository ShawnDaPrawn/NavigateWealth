/**
 * esign bulk-send routes — campaigns, standalone document upload, packets +
 * packet-runs (Phase 5 decomposition).
 * =====================================================================
 *
 * Extracted verbatim from esign-routes.tsx: CSV-driven campaigns (fan one
 * template out to N recipients), the standalone /documents/upload, and packets
 * + packet-runs (multi-template workflow bundles + their execution). Mounted
 * via `esignRoutes.route('/', campaignsRoutes)`. The campaign + packet domain
 * services move with it; the shared document / template services are imported
 * here too. Behaviour-preserving; the contract suite is the guard.
 */
import { Hono } from 'npm:hono';
import { getAuthContext, AuthError } from './auth-mw.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { requireIdempotency } from './idempotency.ts';
import { resolveFirmId } from './esign-route-helpers.ts';
import { createDocument } from './esign-services.ts';
import { getTemplate } from './esign-template-service.ts';
import {
  uploadDocument,
  validateDocument,
  calculateHash,
  extractPageCount,
} from './esign-storage.ts';
import {
  createCampaign,
  getCampaign,
  listCampaigns,
  cancelCampaign,
  recordCampaignRowResult,
  parseCsv,
  mapCsvToRows,
} from './esign-campaign-service.ts';
import {
  createPacket,
  getPacket,
  listPackets,
  deletePacket,
  startPacketRun,
  getPacketRun,
  listPacketRuns,
  cancelPacketRun,
} from './esign-packet-service.ts';

const campaignsRoutes = new Hono();

campaignsRoutes.post('/campaigns', requireIdempotency(), rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const body = await c.req.json();
    const {
      templateId,
      templateVersion,
      title,
      message,
      expiryDays,
      csvText,
      rows: rawRows,
    } = body as {
      templateId?: string;
      templateVersion?: number;
      title?: string;
      message?: string;
      expiryDays?: number;
      csvText?: string;
      rows?: unknown;
    };

    if (!templateId) return c.json({ error: 'templateId is required' }, 400);
    if (!title?.trim()) return c.json({ error: 'title is required' }, 400);

    const template = await getTemplate(templateId);
    if (!template) return c.json({ error: 'Template not found' }, 404);

    let rows: Awaited<ReturnType<typeof mapCsvToRows>>['rows'] = [];
    let warnings: string[] = [];
    if (typeof csvText === 'string' && csvText.trim().length > 0) {
      const parsed = parseCsv(csvText);
      const mapped = mapCsvToRows(parsed.headers, parsed.rows, template);
      rows = mapped.rows;
      warnings = mapped.warnings;
    } else if (Array.isArray(rawRows)) {
      rows = rawRows as typeof rows;
    } else {
      return c.json({ error: 'Provide csvText or rows[]' }, 400);
    }

    if (rows.length === 0) return c.json({ error: 'No rows parsed from CSV' }, 400);

    const firmId = (ctx as { firmId?: string }).firmId ?? 'standalone';
    const result = await createCampaign({
      firmId,
      templateId,
      templateVersion,
      title: title.trim(),
      message,
      expiryDays,
      createdBy: user.id,
      rows,
    });
    if (result.error || !result.campaign) {
      return c.json({ error: result.error || 'Failed to create campaign' }, 400);
    }
    return c.json({ campaign: result.campaign, warnings });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Create campaign error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to create campaign' },
      500,
    );
  }
});

campaignsRoutes.get('/campaigns', async (c) => {
  try {
    await getAuthContext(c);
    const campaigns = await listCampaigns();
    return c.json({ campaigns });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('List campaigns error:', error);
    return c.json({ error: 'Failed to list campaigns' }, 500);
  }
});

campaignsRoutes.get('/campaigns/:id', async (c) => {
  try {
    await getAuthContext(c);
    const campaign = await getCampaign(c.req.param('id'));
    if (!campaign) return c.json({ error: 'Campaign not found' }, 404);
    return c.json({ campaign });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Get campaign error:', error);
    return c.json({ error: 'Failed to load campaign' }, 500);
  }
});

campaignsRoutes.post('/campaigns/:id/results/:rowId', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    await getAuthContext(c);
    const id = c.req.param('id');
    const rowId = c.req.param('rowId');
    const body = await c.req.json();
    const status = body.status as 'sent' | 'failed' | 'cancelled' | 'queued';
    if (!['sent', 'failed', 'cancelled', 'queued'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }
    const result = await recordCampaignRowResult(id, rowId, {
      envelopeId: typeof body.envelopeId === 'string' ? body.envelopeId : undefined,
      status,
      errorMessage: typeof body.errorMessage === 'string' ? body.errorMessage : undefined,
    });
    if (result.error) return c.json({ error: result.error }, 404);
    return c.json({ campaign: result.campaign });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Record campaign row result error:', error);
    return c.json({ error: 'Failed to update row result' }, 500);
  }
});

campaignsRoutes.post('/campaigns/:id/cancel', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    await getAuthContext(c);
    const result = await cancelCampaign(c.req.param('id'));
    if (result.error) return c.json({ error: result.error }, 404);
    return c.json({ campaign: result.campaign });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Cancel campaign error:', error);
    return c.json({ error: 'Failed to cancel campaign' }, 500);
  }
});

// ===========================================================================
// P4.8 — Packets (sequenced templates) + packet runs
// ===========================================================================

/**
 * POST /documents/upload
 * Lightweight "just store this PDF" endpoint that returns a documentId
 * without spawning a draft envelope. Used by packet runs which need to
 * upload one document per step ahead of time so the server-side
 * advancement loop can spawn step-N envelopes without further user
 * interaction.
 */
campaignsRoutes.post(
  '/documents/upload',
  requireIdempotency(),
  rateLimit('SENDER_MUTATE'),
  async (c) => {
    try {
      const ctx = await getAuthContext(c);
      const formData = await c.req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return c.json({ error: 'file required' }, 400);

      const buffer = new Uint8Array(await file.arrayBuffer());
      const validation = validateDocument(buffer, file.name);
      if (!validation.valid) return c.json({ error: validation.error }, 400);

      const hash = await calculateHash(buffer);
      const pageCount = extractPageCount(buffer);
      const documentId = crypto.randomUUID();
      const firmId = resolveFirmId(ctx.user);

      const { path, error: uploadError } = await uploadDocument(
        firmId,
        documentId,
        buffer,
        file.name,
        'application/pdf',
      );
      if (uploadError || !path) return c.json({ error: uploadError || 'Upload failed' }, 500);

      await createDocument({
        id: documentId,
        firm_id: firmId,
        storage_path: path,
        original_filename: file.name,
        page_count: pageCount,
        hash,
        created_at: new Date().toISOString(),
      });

      log.info(`Document ${documentId} uploaded by ${ctx.user.email} (${pageCount} pages)`);
      return c.json({ documentId, pageCount, hash });
    } catch (error: unknown) {
      if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
      log.error('Standalone document upload error:', error);
      return c.json({ error: 'Failed to upload document' }, 500);
    }
  },
);

/**
 * POST /packets
 * Author a new packet (ordered list of templates).
 */
campaignsRoutes.post('/packets', requireIdempotency(), rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const body = await c.req.json();
    const { name, description, steps } = body || {};
    if (!name || !Array.isArray(steps) || steps.length === 0) {
      return c.json({ error: 'name and at least one step are required' }, 400);
    }
    const result = await createPacket({
      firmId: resolveFirmId(ctx.user),
      name,
      description,
      steps: steps.map((s: { templateId: string; templateVersion?: number; label?: string }) => ({
        templateId: s.templateId,
        templateVersion: s.templateVersion,
        label: s.label,
      })),
      createdByUserId: ctx.user.id,
    });
    if (result.error) return c.json({ error: result.error }, 400);
    return c.json({ packet: result.packet });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Create packet error:', error);
    return c.json({ error: 'Failed to create packet' }, 500);
  }
});

campaignsRoutes.get('/packets', async (c) => {
  try {
    await getAuthContext(c);
    const packets = await listPackets();
    return c.json({ packets });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('List packets error:', error);
    return c.json({ error: 'Failed to list packets' }, 500);
  }
});

campaignsRoutes.get('/packets/:id', async (c) => {
  try {
    await getAuthContext(c);
    const packet = await getPacket(c.req.param('id'));
    if (!packet) return c.json({ error: 'Packet not found' }, 404);
    return c.json({ packet });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Get packet error:', error);
    return c.json({ error: 'Failed to get packet' }, 500);
  }
});

campaignsRoutes.delete('/packets/:id', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    await getAuthContext(c);
    const result = await deletePacket(c.req.param('id'));
    if (!result.ok) return c.json({ error: result.error }, 400);
    return c.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Delete packet error:', error);
    return c.json({ error: 'Failed to delete packet' }, 500);
  }
});

/**
 * POST /packet-runs
 * Start a new packet run. Body: { packetId, recipients[], documentIdsByStep[],
 * clientId?, expiryDays?, message? }
 *
 * Caller is expected to upload one document per step beforehand via the
 * standard `/envelopes/upload` endpoint (which returns a documentId), so
 * server-side advancement can re-use those document ids for steps 2..N
 * without any further user interaction.
 */
campaignsRoutes.post(
  '/packet-runs',
  requireIdempotency(),
  rateLimit('SENDER_MUTATE'),
  async (c) => {
    try {
      const ctx = await getAuthContext(c);
      const body = await c.req.json();
      const { packetId, recipients, documentIdsByStep, clientId, expiryDays, message } = body || {};
      if (!packetId) return c.json({ error: 'packetId required' }, 400);
      if (!Array.isArray(recipients) || recipients.length === 0) {
        return c.json({ error: 'At least one recipient required' }, 400);
      }
      if (!Array.isArray(documentIdsByStep) || documentIdsByStep.length === 0) {
        return c.json({ error: 'documentIdsByStep required (one per step)' }, 400);
      }

      const result = await startPacketRun({
        packetId,
        firmId: resolveFirmId(ctx.user),
        clientId: clientId || 'standalone',
        recipients,
        documentIdsByStep,
        createdByUserId: ctx.user.id,
        senderEmail: ctx.user.email,
        expiryDays,
        message,
      });

      if (result.error && !result.run) return c.json({ error: result.error }, 400);
      return c.json({
        run: result.run,
        firstEnvelopeId: result.firstEnvelopeId,
        warning: result.error,
      });
    } catch (error: unknown) {
      if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
      log.error('Start packet run error:', error);
      return c.json({ error: 'Failed to start packet run' }, 500);
    }
  },
);

campaignsRoutes.get('/packet-runs', async (c) => {
  try {
    await getAuthContext(c);
    const runs = await listPacketRuns();
    return c.json({ runs });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('List packet runs error:', error);
    return c.json({ error: 'Failed to list packet runs' }, 500);
  }
});

campaignsRoutes.get('/packet-runs/:id', async (c) => {
  try {
    await getAuthContext(c);
    const run = await getPacketRun(c.req.param('id'));
    if (!run) return c.json({ error: 'Packet run not found' }, 404);
    return c.json({ run });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Get packet run error:', error);
    return c.json({ error: 'Failed to get packet run' }, 500);
  }
});

campaignsRoutes.post('/packet-runs/:id/cancel', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    await getAuthContext(c);
    const result = await cancelPacketRun(c.req.param('id'));
    if (result.error) return c.json({ error: result.error }, 404);
    return c.json({ run: result.run });
  } catch (error: unknown) {
    if (error instanceof AuthError) return c.json({ error: 'Unauthorized' }, 401);
    log.error('Cancel packet run error:', error);
    return c.json({ error: 'Failed to cancel packet run' }, 500);
  }
});

export default campaignsRoutes;
