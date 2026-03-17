/**
 * Client Management Module - Routes
 * 
 * Comprehensive client management:
 * - View all clients with profiles
 * - Update client information
 * - Client documents
 * - Client communication history
 * - Account suspension/unsuspension
 * 
 * Updated Phase 3 - Increment 3.3: Added comprehensive validation
 */

import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { ClientsService } from './client-management-service.ts';
import { runClientCleanup, getLastClientCleanupRun } from './client-cleanup-service.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import { NetWorthSnapshotService } from './net-worth-snapshot-service.ts';
import {
  ClientIdParamSchema,
  ClientListQuerySchema,
  UpdateClientSchema,
  UpdateClientProfileSchema,
  SuspendClientSchema,
  CloseAccountSchema,
  ReinstateAccountSchema,
} from './client-management-validation.ts';

const app = new Hono();
const log = createModuleLogger('clients');
const service = new ClientsService();
const snapshotService = new NetWorthSnapshotService();

// ============================================================================
// DATA MAINTENANCE & CLEANUP
// (Registered before parameterized /:id routes to prevent path collisions)
// ============================================================================

/**
 * GET /clients/cron/status
 * Returns the last live client cleanup run summary.
 * Used by the cron processor hook for idempotency checks.
 */
app.get('/cron/status', requireAuth, asyncHandler(async (c) => {
  const lastRun = await getLastClientCleanupRun();
  const today = new Date().toISOString().slice(0, 10);
  const alreadyRanToday = lastRun?.timestamp
    ? lastRun.timestamp.slice(0, 10) === today
    : false;
  return c.json({ success: true, alreadyRanToday, lastRun });
}));

/**
 * POST /clients/cron/cleanup
 * Cron-safe endpoint for scheduled client profile cleanup.
 * Authenticated via SUPABASE_SERVICE_ROLE_KEY or SUPER_ADMIN_PASSWORD.
 * Runs in live mode (dryRun=false).
 */
app.post('/cron/cleanup', asyncHandler(async (c) => {
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

  log.info('CRON: Starting scheduled client profile cleanup');

  const result = await runClientCleanup(false);

  log.info('CRON: Client cleanup complete', {
    orphansClosed: result.orphanedProfilesClosed,
    deletedBackfilled: result.deletedStatusBackfilled,
    suspendedBackfilled: result.suspendedStatusBackfilled,
    durationMs: result.durationMs,
  });

  return c.json({
    success: true,
    dryRun: false,
    ...result,
  });
}));

/**
 * POST /clients/maintenance/cleanup
 * Run orphaned profile cleanup.
 * 
 * Scans all KV profile entries and reconciles:
 * - Orphaned profiles (auth account deleted) → marked as closed
 * - security.deleted without matching accountStatus → backfilled
 * - security.suspended without matching accountStatus → backfilled
 * 
 * Accepts optional JSON body: { dryRun: true } to preview without mutations.
 * Admin-only. Returns a full audit summary.
 */
app.post('/maintenance/cleanup', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  
  let dryRun = false;
  try {
    const body = await c.req.json();
    dryRun = body?.dryRun === true;
  } catch {
    // No body or invalid JSON — default to live run
  }
  
  log.info('Admin: Starting client cleanup', { adminUserId, dryRun });
  
  const result = await runClientCleanup(dryRun);
  
  log.success('Client cleanup complete', {
    adminUserId,
    dryRun,
    orphansClosed: result.orphanedProfilesClosed,
    deletedBackfilled: result.deletedStatusBackfilled,
    suspendedBackfilled: result.suspendedStatusBackfilled,
    durationMs: result.durationMs,
  });
  
  return c.json({
    success: true,
    dryRun,
    ...result,
  });
}));

// ============================================================================
// CLIENT LIST & DETAILS
// ============================================================================

/**
 * GET /admin/clients
 * Get all clients with their profiles
 */
app.get('/', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const query = c.req.query();
  
  // Validate query parameters
  const validated = ClientListQuerySchema.parse(query);
  
  const filters = {
    status: validated.status,
    accountType: validated.accountType,
    search: validated.search,
    page: validated.offset ? Math.floor(validated.offset / validated.limit) + 1 : 1,
    perPage: validated.limit,
  };
  
  log.info('Admin: Fetching clients', { adminUserId, filters });
  
  const result = await service.getClientsPaginated(filters);
  
  return c.json(result);
}));

/**
 * GET /admin/clients/:id
 * Get specific client by ID
 */
app.get('/:id', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const { id: clientId } = ClientIdParamSchema.parse(c.req.param());
  
  log.info('Admin: Fetching client', { clientId });
  
  const client = await service.getClientById(clientId);
  
  return c.json({ client });
}));

/**
 * PUT /admin/clients/:id
 * Update client information
 */
app.put('/:id', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const { id: clientId } = ClientIdParamSchema.parse(c.req.param());
  const body = await c.req.json();
  
  // Validate update data
  const updates = UpdateClientSchema.parse(body);
  
  log.info('Admin: Updating client', { adminUserId, clientId });
  
  const client = await service.updateClient(clientId, updates);
  
  log.success('Client updated', { adminUserId, clientId });
  
  return c.json({ client });
}));

/**
 * DELETE /admin/clients/:id
 * Delete/archive client
 */
app.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const { id: clientId } = ClientIdParamSchema.parse(c.req.param());
  
  log.warn('Admin: Deleting client', { adminUserId, clientId });
  
  await service.deleteClient(clientId);
  
  // Record audit trail (non-blocking — §12.2)
  const adminRole = c.get('userRole') || 'admin';
  AdminAuditService.record({
    actorId: adminUserId,
    actorRole: adminRole,
    category: 'client_lifecycle',
    action: 'client_deleted',
    summary: `Client soft-deleted`,
    severity: 'critical',
    entityType: 'client',
    entityId: clientId,
  }).catch(() => {});

  return c.json({ success: true, message: 'Client deleted' });
}));

// ============================================================================
// CLIENT PROFILE
// ============================================================================

/**
 * GET /admin/clients/:id/profile
 * Get detailed client profile
 */
app.get('/:id/profile', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const { id: clientId } = ClientIdParamSchema.parse(c.req.param());
  
  const profile = await service.getClientProfile(clientId);
  
  return c.json({ profile });
}));

/**
 * PUT /admin/clients/:id/profile
 * Update client profile
 */
app.put('/:id/profile', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const { id: clientId } = ClientIdParamSchema.parse(c.req.param());
  const body = await c.req.json();
  
  // Validate profile data
  const profileData = UpdateClientProfileSchema.parse(body);
  
  log.info('Admin: Updating client profile', { adminUserId, clientId });
  
  const profile = await service.updateClientProfile(clientId, profileData);
  
  // Phase 4: Auto-snapshot net worth after profile save (fire-and-forget, §13)
  snapshotService.autoSnapshotFromKV(clientId, 'profile-save').catch(() => {});

  return c.json({ profile });
}));

// ============================================================================
// CLIENT DOCUMENTS
// ============================================================================

/**
 * GET /admin/clients/:id/documents
 * Get all documents for client
 */
app.get('/:id/documents', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const { id: clientId } = ClientIdParamSchema.parse(c.req.param());
  
  const documents = await service.getClientDocuments(clientId);
  
  return c.json({ documents });
}));

// ============================================================================
// CLIENT COMMUNICATION
// ============================================================================

/**
 * GET /admin/clients/:id/communication
 * Get communication history for client
 */
app.get('/:id/communication', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const { id: clientId } = ClientIdParamSchema.parse(c.req.param());
  
  const communications = await service.getClientCommunication(clientId);
  
  return c.json({ communications });
}));

// ============================================================================
// ACCOUNT SECURITY & STATUS
// ============================================================================

/**
 * GET /admin/clients/:id/security
 * Get client security status
 */
app.get('/:id/security', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const { id: clientId } = ClientIdParamSchema.parse(c.req.param());
  
  const security = await service.getClientSecurity(clientId);
  
  return c.json({ security });
}));

/**
 * POST /admin/clients/:id/suspend
 * Suspend client account
 */
app.post('/:id/suspend', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const { id: clientId } = ClientIdParamSchema.parse(c.req.param());
  const body = await c.req.json();
  
  // Validate suspension reason
  const { reason } = SuspendClientSchema.parse(body);
  
  log.warn('Admin: Suspending client', { adminUserId, clientId, reason });
  
  const result = await service.suspendClient(clientId, adminUserId, reason);
  
  log.success('Client suspended', { adminUserId, clientId });

  // Record audit trail (non-blocking — §12.2)
  const adminRole = c.get('userRole') || 'admin';
  AdminAuditService.record({
    actorId: adminUserId,
    actorRole: adminRole,
    category: 'client_lifecycle',
    action: 'client_suspended',
    summary: `Client account suspended`,
    severity: 'warning',
    entityType: 'client',
    entityId: clientId,
    metadata: { reason },
  }).catch(() => {});

  return c.json(result);
}));

/**
 * POST /admin/clients/:id/unsuspend
 * Unsuspend client account
 */
app.post('/:id/unsuspend', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const { id: clientId } = ClientIdParamSchema.parse(c.req.param());
  
  log.info('Admin: Unsuspending client', { adminUserId, clientId });
  
  const result = await service.unsuspendClient(clientId, adminUserId);
  
  log.success('Client unsuspended', { adminUserId, clientId });

  // Record audit trail (non-blocking — §12.2)
  const adminRole2 = c.get('userRole') || 'admin';
  AdminAuditService.record({
    actorId: adminUserId,
    actorRole: adminRole2,
    category: 'client_lifecycle',
    action: 'client_unsuspended',
    summary: `Client account unsuspended`,
    severity: 'info',
    entityType: 'client',
    entityId: clientId,
  }).catch(() => {});

  return c.json(result);
}));

// ============================================================================
// ACCOUNT LIFECYCLE (CLOSE / REINSTATE)
// ============================================================================

/**
 * POST /admin/clients/:id/close
 * Close client account (soft-delete with full audit trail).
 *
 * Per Guidelines §12.3: Sets deleted + suspended on security entry,
 * sets accountStatus = 'closed' on profile. Auth account retained
 * for compliance.
 */
app.post('/:id/close', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const { id: clientId } = ClientIdParamSchema.parse(c.req.param());
  const body = await c.req.json();
  
  const { reason } = CloseAccountSchema.parse(body);
  
  log.warn('Admin: Closing client account', { adminUserId, clientId, reason });
  
  const result = await service.closeAccount(clientId, adminUserId, reason);
  
  if (result.success) {
    log.success('Client account closed', { adminUserId, clientId });

    // Record audit trail (non-blocking — §12.2)
    const adminRole = c.get('userRole') || 'admin';
    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: adminRole,
      category: 'client_lifecycle',
      action: 'client_account_closed',
      summary: `Client account closed`,
      severity: 'critical',
      entityType: 'client',
      entityId: clientId,
      metadata: { reason },
    }).catch(() => {});
  }
  
  return c.json(result, result.success ? 200 : 400);
}));

/**
 * POST /admin/clients/:id/reinstate
 * Reinstate a previously closed client account.
 *
 * Reverses the soft-delete, restoring the previous accountStatus.
 * If the account was suspended before closure, it remains suspended.
 */
app.post('/:id/reinstate', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const { id: clientId } = ClientIdParamSchema.parse(c.req.param());
  
  let note: string | undefined;
  try {
    const body = await c.req.json();
    const validated = ReinstateAccountSchema.parse(body);
    note = validated.note;
  } catch {
    // No body or invalid JSON — proceed without note
  }
  
  log.info('Admin: Reinstating client account', { adminUserId, clientId });
  
  const result = await service.reinstateAccount(clientId, adminUserId, note);
  
  if (result.success) {
    log.success('Client account reinstated', { adminUserId, clientId });

    // Record audit trail (non-blocking — §12.2)
    const adminRole = c.get('userRole') || 'admin';
    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: adminRole,
      category: 'client_lifecycle',
      action: 'client_account_reinstated',
      summary: `Client account reinstated`,
      severity: 'warning',
      entityType: 'client',
      entityId: clientId,
      metadata: { note },
    }).catch(() => {});
  }
  
  return c.json(result, result.success ? 200 : 400);
}));

export default app;