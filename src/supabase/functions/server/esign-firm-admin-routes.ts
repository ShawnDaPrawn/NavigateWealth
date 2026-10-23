/**
 * esign firm-admin routes — retention / branding / metrics / recovery-bin
 * (Phase 5 decomposition).
 * =======================================================================
 *
 * Extracted verbatim from esign-routes.ts: firm-scoped retention policy +
 * its sweep, signer-page branding, the metrics snapshot, and the recovery-bin
 * (soft-deleted envelope restore / hard-delete / purge sweep). Mounted via
 * `esignRoutes.route('/', firmAdminRoutes)`. Depends on shared esign services
 * + esign-route-helpers; the retention / branding / recovery domain services
 * used only here move with it. Behaviour-preserving; the contract suite guards.
 */
import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { getAuthContext, AuthError, requireAdmin } from './auth-mw.ts';
import { rateLimit } from './esign-rate-limit.ts';
import {
  getRequestMetadata,
  resolveFirmId,
  requireOwnedEnvelope,
  firmScopeResponse,
} from './esign-route-helpers.ts';
import { logAuditEvent } from './esign-services.ts';
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
import { authErrorResponse } from './esign-auth-error-response.ts';

const log = createModuleLogger('esign-firm-admin-routes');

const firmAdminRoutes = new Hono();

firmAdminRoutes.get('/retention', requireAdmin, async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const policy = await getRetentionPolicy(firmId);
    return c.json({ policy });
  } catch (error: unknown) {
    return authErrorResponse(error, 'Retention read failed');
  }
});

/** PUT /retention — set or update the policy. */
firmAdminRoutes.put('/retention', requireAdmin, async (c) => {
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
    return authErrorResponse(error, 'Retention write failed');
  }
});

/** DELETE /retention — revert to default (no purging). */
firmAdminRoutes.delete('/retention', requireAdmin, async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    await deleteRetentionPolicy(firmId);
    return c.json({ ok: true });
  } catch (error: unknown) {
    return authErrorResponse(error, 'Retention delete failed');
  }
});

/** POST /maintenance/retention-sweep — force a sweep. */
firmAdminRoutes.post('/maintenance/retention-sweep', requireAdmin, async (c) => {
  try {
    await getAuthContext(c);
    const result = await runRetentionSweep();
    return c.json(result);
  } catch (error: unknown) {
    return authErrorResponse(error, 'Retention sweep failed');
  }
});

// ==================== FIRM BRANDING (P8.6) ====================

/**
 * GET /branding — read the caller firm's signer-page branding bundle.
 * Returns `{ branding: null }` when nothing has been configured so the
 * signer UI keeps its built-in defaults. Firm-scoped via `resolveFirmId`.
 */
firmAdminRoutes.get('/branding', requireAdmin, async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const record = await getFirmBranding(firmId);
    return c.json({ branding: record });
  } catch (error: unknown) {
    return authErrorResponse(error, 'Branding read failed');
  }
});

/**
 * PUT /branding — set or update the firm branding bundle. Inputs are
 * validated server-side: hex colours must match `#RRGGBB`, logo URLs
 * must be HTTPS, support email must be a valid address. Anything that
 * fails validation surfaces as a 400 with the exact reason.
 */
firmAdminRoutes.put('/branding', requireAdmin, async (c) => {
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
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
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
firmAdminRoutes.delete('/branding', requireAdmin, async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    await deleteFirmBranding(firmId);
    return c.json({ ok: true });
  } catch (error: unknown) {
    return authErrorResponse(error, 'Branding delete failed');
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
firmAdminRoutes.get('/metrics', requireAdmin, async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const metrics = await getEsignMetrics(firmId);
    return c.json(metrics);
  } catch (error: unknown) {
    log.error('Metrics aggregation error:', error);
    return authErrorResponse(error, 'Failed to compute metrics');
  }
});

// ==================== RECOVERY BIN ROUTES (P6.8) ====================

/** GET /recovery-bin — list soft-deleted envelopes (firm-scoped). */
firmAdminRoutes.get('/recovery-bin', requireAdmin, async (c) => {
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
    return authErrorResponse(error, 'Failed to list recovery bin');
  }
});

/** POST /recovery-bin/:envelopeId/restore — clear the soft-delete stamp. */
firmAdminRoutes.post(
  '/recovery-bin/:envelopeId/restore',
  requireAdmin,
  rateLimit('SENDER_MUTATE'),
  async (c) => {
    try {
      const ctx = await getAuthContext(c);
      const envelopeId = c.req.param('envelopeId')!;
      // Ownership (S6). The hand-rolled check this replaces waved through any
      // envelope with no firm_id — the 'standalone' shortcut.
      const envelope = await requireOwnedEnvelope(ctx.user, envelopeId);
      if (!envelope) return c.json({ error: 'Envelope not found' }, 404);

      const restored = await restoreEnvelope(envelopeId, ctx.user.id);
      if (!restored) return c.json({ error: 'Envelope is not in the recovery bin' }, 400);

      const { ip, userAgent } = getRequestMetadata(c);
      await logAuditEvent({
        envelopeId,
        actorType: 'sender_user',
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
      const scoped = firmScopeResponse(c, error);
      if (scoped) return scoped;
      log.error('Restore envelope error:', error);
      return authErrorResponse(error, 'Failed to restore envelope');
    }
  },
);

/** DELETE /recovery-bin/:envelopeId — permanently purge a single envelope. */
firmAdminRoutes.delete(
  '/recovery-bin/:envelopeId',
  requireAdmin,
  rateLimit('SENDER_MUTATE'),
  async (c) => {
    try {
      const ctx = await getAuthContext(c);
      const envelopeId = c.req.param('envelopeId')!;
      // Ownership FIRST (S6), before anything about the envelope is answered.
      // The check this replaces came after the recovery-bin test and waved
      // through any envelope with no firm_id — the 'standalone' shortcut — on
      // a route that PERMANENTLY deletes.
      const envelope = await requireOwnedEnvelope(ctx.user, envelopeId);
      if (!envelope) return c.json({ success: true, purged: true, already: true });

      if (!envelope.deleted_at) {
        return c.json({ error: 'Envelope is not in the recovery bin' }, 400);
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
      const scoped = firmScopeResponse(c, error);
      if (scoped) return scoped;
      log.error('Purge envelope error:', error);
      return authErrorResponse(error, 'Failed to purge envelope');
    }
  },
);

/** POST /maintenance/recovery-sweep — run the retention sweeper on demand. */
firmAdminRoutes.post('/maintenance/recovery-sweep', requireAdmin, async (c) => {
  try {
    await getAuthContext(c);
    const result = await purgeExpiredDeletedEnvelopes();
    return c.json({ success: true, ...result });
  } catch (error: unknown) {
    log.error('Recovery sweep error:', error);
    return authErrorResponse(error, 'Failed to run recovery sweep');
  }
});

export default firmAdminRoutes;
