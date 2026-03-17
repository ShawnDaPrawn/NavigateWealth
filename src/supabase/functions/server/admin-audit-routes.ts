/**
 * Admin Audit Routes
 *
 * Endpoints for the admin action audit trail (Guidelines §4.2).
 * All routes require admin authentication.
 *
 * Maintenance/static routes are registered before parameterised routes (§14.2).
 */

import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import type { AuditActionCategory, AuditSeverity } from './admin-audit-service.ts';

const app = new Hono();
const log = createModuleLogger('admin-audit');

// Health check
app.get('/', (c) => c.json({ service: 'admin-audit', status: 'active' }));

/**
 * GET /admin-audit/summary
 *
 * Returns a count summary of recent audit entries by category.
 * Used by the dashboard audit widget.
 */
app.get('/summary', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const daysParam = c.req.query('days');
  const days = daysParam ? Math.min(Math.max(parseInt(daysParam, 10) || 7, 1), 90) : 7;

  const summary = await AdminAuditService.getSummary(days);
  return c.json({ success: true, days, summary });
}));

/**
 * GET /admin-audit/log
 *
 * Returns filtered audit log entries (most recent first).
 *
 * Query params:
 *   category?  - Filter by action category
 *   severity?  - Filter by severity level
 *   entityType? - Filter by entity type
 *   limit?     - Max entries (default 50, max 200)
 *   since?     - ISO timestamp lower bound
 */
app.get('/log', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const category = c.req.query('category') as AuditActionCategory | undefined;
  const severity = c.req.query('severity') as AuditSeverity | undefined;
  const entityType = c.req.query('entityType');
  const since = c.req.query('since');
  const limitParam = c.req.query('limit');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200) : 50;

  const entries = await AdminAuditService.query({
    category,
    severity,
    entityType,
    since,
    limit,
  });

  return c.json({ success: true, count: entries.length, entries });
}));

export default app;
