/**
 * KV Cleanup Routes
 *
 * Admin-only endpoints for the stale KV purge mechanism.
 * Follows the dry-run-first pattern (Guidelines §14.1).
 *
 * Maintenance endpoints are registered before any parameterised routes
 * to prevent path collisions (Guidelines §14.2).
 */

import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { runKvCleanup, getLastCleanupRun } from './kv-cleanup-service.ts';
import { AdminAuditService } from './admin-audit-service.ts';

const app = new Hono();
const log = createModuleLogger('kv-cleanup');

// Health check
app.get('/', (c) => c.json({ service: 'kv-cleanup', status: 'active' }));

/**
 * GET /kv-cleanup/status
 *
 * Returns the last live cleanup run summary.
 * Used by the dashboard System Health card.
 * Registered before parameterised routes (§14.2).
 */
app.get('/status', requireAuth, asyncHandler(async (c) => {
  const lastRun = await getLastCleanupRun();
  const today = new Date().toISOString().slice(0, 10);
  const alreadyRanToday = lastRun?.timestamp
    ? lastRun.timestamp.slice(0, 10) === today
    : false;
  return c.json({ success: true, alreadyRanToday, lastRun });
}));

/**
 * POST /kv-cleanup/run
 *
 * Run the stale KV cleanup.
 * Accepts optional JSON body:
 *   { dryRun?: boolean, retentionDays?: number, auditRetentionDays?: number }
 *
 * dryRun defaults to true for safety — the caller must explicitly
 * set dryRun: false to perform live deletions.
 *
 * Admin-only. Returns a full audit summary regardless of mode.
 */
app.post('/run', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const adminRole = c.get('userRole') || 'admin';

  let dryRun = true;
  let retentionDays = 90;
  let auditRetentionDays = 365;

  try {
    const body = await c.req.json();
    if (body?.dryRun === false) dryRun = false;
    if (typeof body?.retentionDays === 'number' && body.retentionDays > 0) {
      retentionDays = body.retentionDays;
    }
    if (typeof body?.auditRetentionDays === 'number' && body.auditRetentionDays > 0) {
      auditRetentionDays = body.auditRetentionDays;
    }
  } catch {
    // No body or invalid JSON — use safe defaults
  }

  log.info('Admin: Starting KV cleanup', { adminUserId, dryRun, retentionDays, auditRetentionDays });

  const result = await runKvCleanup({ dryRun, retentionDays, auditRetentionDays });

  log.info('KV cleanup complete', {
    adminUserId,
    dryRun,
    totalKeysFound: result.totalKeysFound,
    totalKeysDeleted: result.totalKeysDeleted,
    durationMs: result.durationMs,
  });

  // Record in admin audit trail (§12.2)
  await AdminAuditService.record({
    actorId: adminUserId,
    actorRole: adminRole,
    category: 'kv_cleanup',
    action: dryRun ? 'kv_cleanup_preview' : 'kv_cleanup_live',
    summary: dryRun
      ? `KV cleanup dry-run: ${result.totalKeysFound} stale keys found`
      : `KV cleanup live: ${result.totalKeysDeleted} keys deleted`,
    severity: dryRun ? 'info' : 'warning',
    entityType: 'system',
    metadata: {
      dryRun,
      retentionDays,
      auditRetentionDays,
      totalKeysFound: result.totalKeysFound,
      totalKeysDeleted: result.totalKeysDeleted,
      durationMs: result.durationMs,
    },
  });

  return c.json({ success: true, ...result });
}));

/**
 * POST /kv-cleanup/cron
 *
 * Cron-safe endpoint for scheduled KV cleanup.
 * Authenticated via SUPABASE_SERVICE_ROLE_KEY or SUPER_ADMIN_PASSWORD.
 * Runs in live mode (dryRun=false) with default retention (90 days).
 */
app.post('/cron', asyncHandler(async (c) => {
  const authHeader = c.req.header('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const superAdminPw = Deno.env.get('SUPER_ADMIN_PASSWORD') || '';

  if (
    (!serviceRoleKey || token !== serviceRoleKey) &&
    (!superAdminPw || token !== superAdminPw)
  ) {
    return c.json({ error: 'Unauthorized — cron auth required' }, 401);
  }

  log.info('CRON: Starting scheduled KV cleanup');

  const result = await runKvCleanup({ dryRun: false, retentionDays: 90, auditRetentionDays: 365 });

  log.info('CRON: KV cleanup complete', {
    totalKeysFound: result.totalKeysFound,
    totalKeysDeleted: result.totalKeysDeleted,
    durationMs: result.durationMs,
  });

  return c.json({ success: true, ...result });
}));

export default app;