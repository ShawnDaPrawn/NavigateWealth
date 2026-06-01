/**
 * esign diagnostics / ops-sweep routes (Phase 5 decomposition).
 * =============================================================
 *
 * Extracted verbatim from esign-routes.tsx: the stuck-envelope alert sweep
 * (manual + cron), audit-event search, and the synthetic-probe diagnostics
 * (status / manual run / cron). Mounted via
 * `esignRoutes.route('/', diagnosticsRoutes)`. The /cron/* variants
 * authenticate with the Supabase service-role key (Deno.env). The probe /
 * sweep / audit-search services move with it. Behaviour-preserving; the
 * contract suite is the guard.
 */
import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { getAuthContext, AuthError } from './auth-mw.ts';
import { resolveFirmId } from './esign-route-helpers.ts';
import { runStuckAlertSweep } from './esign-stuck-alert-service.ts';
import { searchAuditEvents } from './esign-audit-search-service.ts';
import { runSyntheticProbe, getLatestProbe, getProbeHistory } from './esign-synthetic-probe.ts';

const log = createModuleLogger('esign-diagnostics-routes');

const diagnosticsRoutes = new Hono();

diagnosticsRoutes.post('/maintenance/stuck-alert-sweep', async (c) => {
  try {
    await getAuthContext(c);
    const result = await runStuckAlertSweep();
    return c.json(result);
  } catch (error: unknown) {
    log.error('Manual stuck-alert sweep failed:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Stuck sweep failed' }, status);
  }
});

/**
 * POST /cron/stuck-alert-sweep — external cron trigger (CRON_SECRET
 * gated). Mirrors /maintenance/stuck-alert-sweep but without a user
 * session requirement.
 */
diagnosticsRoutes.post('/cron/stuck-alert-sweep', async (c) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  const provided = c.req.header('x-cron-secret');
  if (!cronSecret || provided !== cronSecret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const result = await runStuckAlertSweep();
  return c.json(result);
});

// ==================== GLOBAL AUDIT SEARCH (P7.3) ====================

/**
 * GET /audit/search — firm-scoped audit log search. Supports filters:
 *   • signer_email  — exact match
 *   • action        — substring match (case-insensitive)
 *   • from, to      — ISO-8601 timestamps
 *   • envelope_id   — narrow to one envelope
 *   • limit         — default 100, max 500
 */
diagnosticsRoutes.get('/audit/search', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const qs = c.req.query();
    const result = await searchAuditEvents({
      firmId,
      signerEmail: qs.signer_email,
      action: qs.action,
      from: qs.from,
      to: qs.to,
      envelopeId: qs.envelope_id,
      limit: qs.limit ? Math.min(500, parseInt(qs.limit, 10) || 100) : 100,
    });
    return c.json(result);
  } catch (error: unknown) {
    log.error('Audit search failed:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Audit search failed' },
      status,
    );
  }
});

// ==================== SYNTHETIC PROBE (P7.4) ====================

/**
 * GET /diagnostics/synthetic — returns the latest probe result +
 * rolling history. Lightweight; hits KV only.
 */
diagnosticsRoutes.get('/diagnostics/synthetic', async (c) => {
  try {
    await getAuthContext(c);
    const [latest, history] = await Promise.all([getLatestProbe(), getProbeHistory()]);
    return c.json({ latest, history });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to read probe state' },
      status,
    );
  }
});

/**
 * POST /diagnostics/synthetic/run — force a probe right now and
 * return the result. Useful when we need to confirm we are healthy
 * before shipping.
 */
diagnosticsRoutes.post('/diagnostics/synthetic/run', async (c) => {
  try {
    await getAuthContext(c);
    const result = await runSyntheticProbe();
    return c.json(result);
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Probe failed' }, status);
  }
});

/** External cron — avoids needing a sender session. */
diagnosticsRoutes.post('/cron/synthetic-probe', async (c) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  const provided = c.req.header('x-cron-secret');
  if (!cronSecret || provided !== cronSecret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const result = await runSyntheticProbe();
  return c.json(result);
});

export default diagnosticsRoutes;
