/**
 * esign firm-admin routes — retention / branding / metrics / recovery-bin
 * (Phase 5 decomposition).
 * =======================================================================
 *
 * Extracted verbatim from esign-routes.tsx: firm-scoped retention policy +
 * its sweep, signer-page branding, the metrics snapshot, and the recovery-bin
 * (soft-deleted envelope restore / hard-delete / purge sweep). Mounted via
 * `esignRoutes.route('/', firmAdminRoutes)`. Depends on shared esign services
 * + esign-route-helpers; the retention / branding / recovery domain services
 * used only here move with it. Behaviour-preserving; the contract suite guards.
 */
import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { getAuthContext, AuthError } from './auth-mw.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { getRequestMetadata, resolveFirmId } from './esign-route-helpers.ts';
import { getEnvelopeDetails, logAuditEvent } from './esign-services.ts';
import { getEsignMetrics } from './esign-metrics-service.ts';
import {
  getRetentionPolicy,
  setRetentionPolicy,
  deleteRetentionPolicy,
  runRetentionSweep,
} from './esign-retention-service.ts';
import { getFirmBranding, setFirmBranding, deleteFirmBranding } from './esign-branding-service.ts';
import {
  listRecoveryBin,
  restoreEnvelope,
  hardDeleteEnvelope,
  purgeExpiredDeletedEnvelopes,
  RECOVERY_RETENTION_DAYS,
} from './esign-recovery-bin.ts';
import { AdminAuditService } from './admin-audit-service.ts';

const log = createModuleLogger('esign-firm-admin-routes');

const firmAdminRoutes = new Hono();

firmAdminRoutes.get('/retention', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const policy = await getRetentionPolicy(firmId);
    return c.json({ policy });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Retention read failed' }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/** PUT /retention — set or update the policy. */
firmAdminRoutes.put('/retention', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const body = await c.req.json<{
      completed_retention_days?: number | null;
      terminated_retention_days?: number | null;
      draft_retention_days?: number | null;
      delete_artifacts?: boolean;
    }>();
    const saved = await setRetentionPolicy(firmId, body);
    return c.json({ policy: saved });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Retention write failed' }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/** DELETE /retention — revert to default (no purging). */
firmAdminRoutes.delete('/retention', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    await deleteRetentionPolicy(firmId);
    return c.json({ ok: true });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Retention delete failed',
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/** POST /maintenance/retention-sweep — force a sweep. */
firmAdminRoutes.post('/maintenance/retention-sweep', async (c) => {
  try {
    await getAuthContext(c);
    const result = await runRetentionSweep();
    return c.json(result);
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Retention sweep failed' }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

// ==================== FIRM BRANDING (P8.6) ====================

/**
 * GET /branding — read the caller firm's signer-page branding bundle.
 * Returns `{ branding: null }` when nothing has been configured so the
 * signer UI keeps its built-in defaults. Firm-scoped via `resolveFirmId`.
 */
firmAdminRoutes.get('/branding', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const record = await getFirmBranding(firmId);
    return c.json({ branding: record });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Branding read failed' }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * PUT /branding — set or update the firm branding bundle. Inputs are
 * validated server-side: hex colours must match `#RRGGBB`, logo URLs
 * must be HTTPS, support email must be a valid address. Anything that
 * fails validation surfaces as a 400 with the exact reason.
 */
firmAdminRoutes.put('/branding', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const body = await c.req.json<{
      display_name?: string | null;
      logo_url?: string | null;
      accent_hex?: string | null;
      support_email?: string | null;
    }>();
    const saved = await setFirmBranding(firmId, body);
    return c.json({ branding: saved });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message }, error.statusCode);
    }
    const message = error instanceof Error ? error.message : 'Branding write failed';
    // Validation errors surface as 400; everything else is treated as 500.
    const status = /must be|required/i.test(message) ? 400 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/** DELETE /branding — clear the firm branding so signer pages revert to defaults. */
firmAdminRoutes.delete('/branding', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    await deleteFirmBranding(firmId);
    return c.json({ ok: true });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Branding delete failed' }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

// ==================== METRICS DASHBOARD (P7.1) ====================

/**
 * GET /metrics — aggregate metrics for the caller's firm.
 *
 * Returns envelope status counts, signing funnel, time-to-sign, the
 * top stuck envelopes, and a 30-day throughput series. Firm-scoped via
 * `resolveFirmId`. The aggregation is intentionally computed on the
 * fly — small-to-medium firms (thousands of envelopes) complete in
 * well under 300ms and avoid a stale cache surface.
 */
firmAdminRoutes.get('/metrics', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const metrics = await getEsignMetrics(firmId);
    return c.json(metrics);
  } catch (error: unknown) {
    log.error('Metrics aggregation error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to compute metrics',
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

// ==================== RECOVERY BIN ROUTES (P6.8) ====================

/** GET /recovery-bin — list soft-deleted envelopes (firm-scoped). */
firmAdminRoutes.get('/recovery-bin', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const bin = await listRecoveryBin(firmId);
    return c.json({
      envelopes: bin,
      retention_days: RECOVERY_RETENTION_DAYS,
    });
  } catch (error: unknown) {
    log.error('Recovery bin list error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to list recovery bin',
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/** POST /recovery-bin/:envelopeId/restore — clear the soft-delete stamp. */
firmAdminRoutes.post('/recovery-bin/:envelopeId/restore', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;
    const envelope = await getEnvelopeDetails(envelopeId);
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);

    const callerFirm = resolveFirmId(ctx.user);
    const envelopeFirm = (envelope.firm_id as string | undefined) || 'standalone';
    if (envelopeFirm !== 'standalone' && envelopeFirm !== callerFirm) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const restored = await restoreEnvelope(envelopeId, ctx.user.id);
    if (!restored) return c.json({ error: 'Envelope is not in the recovery bin' }, 400);

    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'admin',
      actorId: ctx.user.id,
      action: 'restored',
      email: ctx.user.email || 'admin@system',
      ip,
      userAgent,
      metadata: { restoredAt: new Date().toISOString() },
    });

    AdminAuditService.record({
      actorId: ctx.user.id,
      actorRole: 'admin',
      category: 'security',
      action: 'esign_envelope_restored',
      summary: `Envelope restored: ${restored.title}`,
      severity: 'info',
      entityType: 'envelope',
      entityId: envelopeId,
    }).catch(() => {});

    return c.json({ success: true, envelope: restored });
  } catch (error: unknown) {
    log.error('Restore envelope error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to restore envelope',
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/** DELETE /recovery-bin/:envelopeId — permanently purge a single envelope. */
firmAdminRoutes.delete('/recovery-bin/:envelopeId', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;
    const envelope = await getEnvelopeDetails(envelopeId);
    if (!envelope) return c.json({ success: true, purged: true, already: true });

    if (!envelope.deleted_at) {
      return c.json({ error: 'Envelope is not in the recovery bin' }, 400);
    }

    const callerFirm = resolveFirmId(ctx.user);
    const envelopeFirm = (envelope.firm_id as string | undefined) || 'standalone';
    if (envelopeFirm !== 'standalone' && envelopeFirm !== callerFirm) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await hardDeleteEnvelope(envelopeId);

    AdminAuditService.record({
      actorId: ctx.user.id,
      actorRole: 'admin',
      category: 'security',
      action: 'esign_envelope_purged',
      summary: `Envelope permanently deleted: ${envelope.title}`,
      severity: 'critical',
      entityType: 'envelope',
      entityId: envelopeId,
    }).catch(() => {});

    return c.json({ success: true, purged: true });
  } catch (error: unknown) {
    log.error('Purge envelope error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to purge envelope',
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/** POST /maintenance/recovery-sweep — run the retention sweeper on demand. */
firmAdminRoutes.post('/maintenance/recovery-sweep', async (c) => {
  try {
    await getAuthContext(c);
    const result = await purgeExpiredDeletedEnvelopes();
    return c.json({ success: true, ...result });
  } catch (error: unknown) {
    log.error('Recovery sweep error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to run recovery sweep',
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

export default firmAdminRoutes;
