/**
 * Security activity log routes (Phase 5 decomposition).
 * ======================================================
 *
 * Extracted verbatim from security.tsx. No logic changes.
 *
 * Routes owned here:
 *   GET  /:userId/activity  — fetch activity logs for a user
 *   POST /:userId/activity  — log a security activity
 *
 * @module server/security-activity-routes
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { requireAuth } from './auth-mw.ts';
import { LogActivitySchema } from './security-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { logSafeError, ensureSelfOrAdmin, type ActivityLogEntry } from './security-shared.ts';

const app = new Hono();
const log = createModuleLogger('security');

/**
 * GET /security/:userId/activity
 * Get activity logs for a user
 */
app.get('/:userId/activity', requireAuth, async (c) => {
  try {
    const userId = c.req.param('userId')!;
    const limit = parseInt(c.req.query('limit') || '50');
    const denied = ensureSelfOrAdmin(c, userId);
    if (denied) return denied;

    log.info(`📊 Fetching activity logs for user: ${userId}`);

    // Get activity logs from KV store
    const logs = await kv.getByPrefix(`activity:${userId}:`);

    // Sort by timestamp descending and limit
    const sortedLogs = logs
      .filter((log) => log && log.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    log.info(`✅ Found ${sortedLogs.length} activity logs for user ${userId}`);

    return c.json({
      success: true,
      count: sortedLogs.length,
      logs: sortedLogs,
    });
  } catch (error) {
    const errorMsg = logSafeError('Error fetching activity logs', error);
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

/**
 * POST /security/:userId/activity
 * Log a security activity
 */
app.post('/:userId/activity', requireAuth, async (c) => {
  try {
    const userId = c.req.param('userId')!;
    const denied = ensureSelfOrAdmin(c, userId);
    if (denied) return denied;
    const body = await c.req.json();

    const parsed = LogActivitySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }
    const { type, success: activitySuccess, errorMessage, metadata } = parsed.data;

    log.info(`📝 Logging activity for user ${userId}: ${type}`);

    const timestamp = new Date().toISOString();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get request info
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';

    const activityLog: ActivityLogEntry = {
      id: logId,
      userId,
      type,
      timestamp,
      ip,
      userAgent,
      success: activitySuccess,
      errorMessage,
      metadata,
    };

    // Store activity log
    await kv.set(`activity:${userId}:${logId}`, activityLog);

    log.info('✅ Activity logged successfully');

    return c.json({
      success: true,
      log: activityLog,
    });
  } catch (error) {
    const errorMsg = logSafeError('Error logging activity', error);
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

export default app;
