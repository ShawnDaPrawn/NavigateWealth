/**
 * Net Worth Snapshot Routes — Phase 4
 *
 * Thin route dispatcher for historical net worth snapshot management.
 * Delegates all logic to NetWorthSnapshotService (§4.2).
 *
 * Routes:
 *   GET  /net-worth-snapshots/:clientId   — Retrieve all snapshots
 *   POST /net-worth-snapshots/:clientId   — Create/update today's snapshot
 *   DELETE /net-worth-snapshots/:clientId/:date — Delete a specific snapshot
 */

import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { NetWorthSnapshotService } from './net-worth-snapshot-service.ts';
import type { CreateSnapshotInput } from './net-worth-snapshot-service.ts';

const app = new Hono();
const log = createModuleLogger('net-worth-snapshots');
const service = new NetWorthSnapshotService();

// Root health check
app.get('/', (c) => c.json({ service: 'net-worth-snapshots', status: 'active' }));

// ============================================================================
// MAINTENANCE ENDPOINTS (§14.2 — registered before parameterised /:id routes)
// ============================================================================

/**
 * POST /net-worth-snapshots/maintenance/batch-snapshot
 * Snapshot all active clients. Follows dry-run-first pattern (§14.1).
 * Default: dryRun=true for safety.
 */
app.post('/maintenance/batch-snapshot', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const dryRun = body.dryRun !== false; // Default true

  log.info('Batch snapshot requested', { dryRun });
  const result = await service.batchSnapshotAllClients(dryRun);
  return c.json({ success: true, ...result });
}));

/**
 * POST /net-worth-snapshots/maintenance/auto-snapshot/:clientId
 * Trigger an auto-snapshot for a single client from KV data.
 * Used for manual re-trigger or testing.
 */
app.post('/maintenance/auto-snapshot/:clientId', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const clientId = c.req.param('clientId');
  if (!clientId) {
    return c.json({ success: false, error: 'Missing clientId parameter' }, 400);
  }

  const snapshot = await service.autoSnapshotFromKV(clientId, 'manual-trigger');
  if (!snapshot) {
    return c.json({ success: false, error: 'No profile data found for this client' }, 404);
  }
  return c.json({ success: true, snapshot });
}));

// ============================================================================
// CLIENT SNAPSHOT CRUD
// ============================================================================

/**
 * GET /net-worth-snapshots/:clientId
 * Retrieve all historical snapshots for a client.
 */
app.get('/:clientId', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const clientId = c.req.param('clientId');
  if (!clientId) {
    return c.json({ success: false, error: 'Missing clientId parameter' }, 400);
  }

  const snapshots = await service.getSnapshots(clientId);
  return c.json({ success: true, snapshots, count: snapshots.length });
}));

/**
 * POST /net-worth-snapshots/:clientId
 * Create or update today's snapshot for a client.
 * Accepts pre-computed financial data from the frontend.
 */
app.post('/:clientId', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const clientId = c.req.param('clientId');
  if (!clientId) {
    return c.json({ success: false, error: 'Missing clientId parameter' }, 400);
  }

  const body = await c.req.json();

  if (typeof body.totalAssets !== 'number' || typeof body.totalLiabilities !== 'number') {
    return c.json({
      success: false,
      error: 'Missing required fields: totalAssets and totalLiabilities must be numbers',
    }, 400);
  }

  // Extract creator from auth context header
  const authHeader = c.req.header('Authorization') || '';
  const createdBy = body.createdBy || 'admin';

  const input: CreateSnapshotInput = {
    clientId,
    totalAssets: body.totalAssets,
    totalLiabilities: body.totalLiabilities,
    netWorth: body.netWorth ?? (body.totalAssets - body.totalLiabilities),
    assetBreakdown: body.assetBreakdown,
    liabilityBreakdown: body.liabilityBreakdown,
    policyCount: body.policyCount ?? 0,
    monthlyPremiums: body.monthlyPremiums ?? 0,
    retirementValue: body.retirementValue,
    investmentValue: body.investmentValue,
    createdBy,
  };

  const snapshot = await service.createSnapshot(input);
  return c.json({ success: true, snapshot });
}));

/**
 * DELETE /net-worth-snapshots/:clientId/:date
 * Delete a specific snapshot by date (YYYY-MM-DD).
 */
app.delete('/:clientId/:date', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const clientId = c.req.param('clientId');
  const date = c.req.param('date');

  if (!clientId || !date) {
    return c.json({ success: false, error: 'Missing clientId or date parameter' }, 400);
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ success: false, error: 'Invalid date format. Expected YYYY-MM-DD.' }, 400);
  }

  await service.deleteSnapshot(clientId, date);
  return c.json({ success: true, deleted: date });
}));

export default app;