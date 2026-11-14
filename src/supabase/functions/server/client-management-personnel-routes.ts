import { Hono } from 'npm:hono';
import { PersonnelService } from './client-management-personnel-service.ts';
import { PermissionsService } from './personnel-permissions-service.ts';
import { PermissionAuditService } from './permission-audit-service.ts';
import { getAuthContext, requireRole, handleError } from './auth-mw.ts';
import { createModuleLogger } from './stderr-logger.ts';
import {
  CreatePersonnelSchema,
  UpdatePersonnelSchema,
} from './client-management-personnel-validation-enhanced.ts';
import type {
  CreatePersonnelPayload,
  PersonnelProfile,
  UserRole,
} from './client-management-personnel-types.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import { MAX_REASSIGN_BATCH, reassignClients } from './personnel-client-reassign-service.ts';
import { personnelDocumentUrl, uploadPersonnelDocument } from './personnel-documents-service.ts';
import { z } from 'npm:zod@4.6.5';

const app = new Hono();
const log = createModuleLogger('personnel');

/**
 * Narrow the trusted role string from getAuthContext for PersonnelService's
 * UserRole-typed parameters. Non-personnel roles (e.g. 'client') pass through
 * unchanged and simply match no privileged branch inside the service — the
 * same runtime behaviour as before the trusted-role hardening.
 */
const asPersonnelRole = (role: string): UserRole => role as UserRole;

// ============================================================================
// CAPABILITY ENFORCEMENT HELPER
// ============================================================================

/**
 * Server-side capability check.
 * Super admin always passes. Other users must have the capability granted
 * in their stored permission set. Backwards compat: if no capabilities
 * are stored, the user has full access within the module.
 */
async function requireCapability(
  ctx: { userId: string; user: { email?: string } },
  module: string,
  capability: string,
): Promise<void> {
  // Super admin bypass
  if (ctx.user.email && PermissionsService.isSuperAdmin(ctx.user.email)) {
    return;
  }

  const hasAccess = await PermissionsService.hasCapability(ctx.userId, module, capability);
  if (!hasAccess) {
    const err = new Error(`Forbidden: Missing '${capability}' capability on '${module}' module`);
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}

// ============================================================================
// ROOT / HEALTH
// ============================================================================

app.get('/', (c) => c.json({ service: 'personnel', status: 'active' }));
app.get('', (c) => c.json({ service: 'personnel', status: 'active' }));

// ============================================================================
// PERSONNEL CRUD
// ============================================================================

app.get('/list', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    log.info('Listing personnel', { userId: ctx.userId, role: ctx.role });
    const list = await PersonnelService.listPersonnel(
      ctx.userId,
      asPersonnelRole(ctx.role),
      ctx.user.email,
    );
    return c.json({ data: list });
  } catch (e) {
    return handleError(c, e);
  }
});

app.post('/invite', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    // Role gate: only admins can invite
    requireRole(ctx, ['super_admin', 'admin']);
    // Capability gate: requires 'create' capability on 'personnel' module
    await requireCapability(ctx, 'personnel', 'create');

    const body = await c.req.json();
    const parsed = CreatePersonnelSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    // Extract the frontend origin so the invite email links back correctly
    const siteUrl =
      c.req.header('origin') || c.req.header('referer')?.replace(/\/+$/, '') || undefined;
    log.info('Inviting personnel', { userId: ctx.userId, inviteRole: parsed.data.role, siteUrl });
    const result = await PersonnelService.inviteUser(
      asPersonnelRole(ctx.role),
      parsed.data as unknown as CreatePersonnelPayload,
      siteUrl,
    );
    return c.json({ data: result });
  } catch (e) {
    return handleError(c, e);
  }
});

// Resend invitation email for a pending personnel member
app.post('/resend-invite/:id', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    requireRole(ctx, ['super_admin', 'admin']);
    await requireCapability(ctx, 'personnel', 'create');

    const personnelId = c.req.param('id')!;
    const siteUrl =
      c.req.header('origin') || c.req.header('referer')?.replace(/\/+$/, '') || undefined;
    log.info('Resending invite', { userId: ctx.userId, personnelId, siteUrl });
    const result = await PersonnelService.resendInvite(
      asPersonnelRole(ctx.role),
      personnelId,
      siteUrl,
    );
    return c.json({ data: result });
  } catch (e) {
    return handleError(c, e);
  }
});

// Cancel (revoke) a pending invitation
app.delete('/invite/:id', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    requireRole(ctx, ['super_admin', 'admin']);
    await requireCapability(ctx, 'personnel', 'delete');

    const personnelId = c.req.param('id')!;
    log.info('Cancelling invite', { userId: ctx.userId, personnelId });
    const result = await PersonnelService.cancelInvite(asPersonnelRole(ctx.role), personnelId);
    return c.json({ data: result });
  } catch (e) {
    return handleError(c, e);
  }
});

// Create a personnel account directly and send credentials
app.post('/create-account', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    requireRole(ctx, ['super_admin', 'admin']);
    await requireCapability(ctx, 'personnel', 'create');

    const body = await c.req.json();
    const parsed = CreatePersonnelSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const siteUrl =
      c.req.header('origin') || c.req.header('referer')?.replace(/\/+$/, '') || undefined;
    log.info('Creating personnel account directly', {
      userId: ctx.userId,
      accountRole: parsed.data.role,
      siteUrl,
    });
    const result = await PersonnelService.createAccount(
      asPersonnelRole(ctx.role),
      parsed.data as unknown as CreatePersonnelPayload,
      siteUrl,
    );
    return c.json({ data: result });
  } catch (e) {
    return handleError(c, e);
  }
});

// ============================================================================
// MAINTENANCE ENDPOINTS (§14.1 — dry-run-first, before /:id)
// ============================================================================

/**
 * POST /maintenance/backfill-roles
 *
 * Backfill user_metadata.role on Supabase Auth records for all personnel.
 * Ensures the belt-and-suspenders guard in the client management module
 * can correctly exclude staff by checking user_metadata.role.
 *
 * Follows dry-run-first pattern: dryRun defaults to true for safety.
 * Requires super_admin role.
 */
app.post('/maintenance/backfill-roles', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    requireRole(ctx, ['super_admin']);

    const body = await c.req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Default true for safety

    log.info('Maintenance: backfill-roles requested', {
      userId: ctx.userId,
      dryRun,
    });

    const result = await PersonnelService.backfillAuthRoles(dryRun);
    return c.json({ success: true, ...result });
  } catch (e) {
    return handleError(c, e);
  }
});

app.put('/:id', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const targetId = c.req.param('id')!;
    const body = await c.req.json();
    const parsed = UpdatePersonnelSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    // Self-update is always allowed; admin editing others requires 'edit' capability
    const isSelfUpdate = ctx.userId === targetId;
    if (!isSelfUpdate) {
      requireRole(ctx, ['super_admin', 'admin']);
      await requireCapability(ctx, 'personnel', 'edit');
    }

    log.info('Updating personnel profile', { userId: ctx.userId, targetId, isSelfUpdate });
    const result = await PersonnelService.updateProfile(
      asPersonnelRole(ctx.role),
      targetId,
      parsed.data as unknown as Partial<PersonnelProfile>,
    );
    return c.json({ data: result });
  } catch (e) {
    return handleError(c, e);
  }
});

app.get('/:id/clients', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const targetId = c.req.param('id')!;

    // POSITIVE allow-list: platform admins and compliance may view any
    // adviser's book; an adviser may view only their own. The guard used to
    // refuse only a MISMATCHED ADVISER, so every other caller — a plain client
    // included — could list any adviser's clients (names, emails, statuses),
    // and a refused adviser got a 500 rather than a 403.
    if (!(ctx.role === 'adviser' && ctx.userId === targetId)) {
      requireRole(ctx, ['super_admin', 'super-admin', 'admin', 'compliance']);
    }

    log.info('Fetching assigned clients', { userId: ctx.userId, targetId });
    const clients = await PersonnelService.getAssignedClients(asPersonnelRole(ctx.role), targetId);
    return c.json({ data: clients });
  } catch (e) {
    return handleError(c, e);
  }
});

/**
 * POST /:id/clients/reassign — move clients from this staff member to another.
 * Super admin only. Only clients currently assigned to `:id` move; the rest
 * come back as skipped.
 */
const ReassignClientsSchema = z.object({
  toPersonnelId: z.string().trim().min(1).max(128),
  clientIds: z.array(z.string().trim().min(1).max(128)).min(1).max(MAX_REASSIGN_BATCH),
});

app.post('/:id/clients/reassign', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    requireRole(ctx, ['super_admin']);

    const fromId = c.req.param('id')!;
    const parsed = ReassignClientsSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { toPersonnelId, clientIds } = parsed.data;

    const result = await reassignClients(fromId, toPersonnelId, clientIds);

    await AdminAuditService.record({
      actorId: ctx.userId,
      actorRole: ctx.role,
      category: 'bulk_operation',
      action: 'clients_reassigned',
      summary: `Reassigned ${result.reassigned.length} client(s) to another adviser`,
      severity: 'warning',
      entityType: 'personnel',
      entityId: fromId,
      metadata: {
        toPersonnelId,
        reassigned: result.reassigned.length,
        skipped: result.skipped.length,
      },
    });

    return c.json({ data: result });
  } catch (e) {
    return handleError(c, e);
  }
});

app.post('/:id/documents', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    requireRole(ctx, ['super_admin', 'admin', 'compliance']);
    // Capability: editing personnel records
    await requireCapability(ctx, 'personnel', 'edit');

    const targetId = c.req.param('id')!;
    const body = await c.req.json();
    log.info('Adding personnel document', { userId: ctx.userId, targetId });

    const result = await PersonnelService.addDocument(asPersonnelRole(ctx.role), targetId, body);
    return c.json({ data: result });
  } catch (e) {
    return handleError(c, e);
  }
});

/**
 * POST /:id/documents/upload — store a compliance document (multipart: file,
 * name, type) in the private personnel-documents bucket and record it.
 */
const DocumentUploadFieldsSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.enum(['qualification', 'cpd', 'identification', 'other']),
});

app.post('/:id/documents/upload', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    requireRole(ctx, ['super_admin', 'admin', 'compliance']);
    await requireCapability(ctx, 'personnel', 'edit');

    const body = await c.req.parseBody();
    const file = body['file'];
    // Duck-typed: a multipart file is a Blob with a name, whichever realm built it.
    if (
      typeof file !== 'object' ||
      file === null ||
      !('arrayBuffer' in file) ||
      !('name' in file)
    ) {
      return c.json({ error: 'No file uploaded' }, 400);
    }
    const parsed = DocumentUploadFieldsSchema.safeParse({ name: body['name'], type: body['type'] });
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    const targetId = c.req.param('id')!;
    const doc = await uploadPersonnelDocument(
      asPersonnelRole(ctx.role),
      targetId,
      file as File,
      parsed.data,
    );
    return c.json({ data: doc });
  } catch (e) {
    return handleError(c, e);
  }
});

/** GET /:id/documents/:docId/url — a short-lived link to open a stored document. */
app.get('/:id/documents/:docId/url', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    requireRole(ctx, ['super_admin', 'admin', 'compliance']);
    const url = await personnelDocumentUrl(
      asPersonnelRole(ctx.role),
      c.req.param('id')!,
      c.req.param('docId')!,
    );
    return c.json({ data: { url } });
  } catch (e) {
    return handleError(c, e);
  }
});

// ============================================================================
// PERMISSIONS ROUTES
// ============================================================================

/**
 * GET /permissions/me — Fetch permissions for the current authenticated user
 * Used by the sidebar to determine which modules to show.
 * MUST be defined before /permissions/:personnelId to avoid param capture.
 * No capability check — every user can read their own permissions.
 */
app.get('/permissions/me', async (c) => {
  try {
    const ctx = await getAuthContext(c);

    // Super admin always gets full access (hardcoded bypass)
    if (ctx.user.email && PermissionsService.isSuperAdmin(ctx.user.email)) {
      return c.json({
        data: {
          personnelId: ctx.userId,
          isSuperAdmin: true,
          modules: {},
          updatedAt: null,
          updatedBy: null,
        },
      });
    }

    const permissions = await PermissionsService.getPermissions(ctx.userId);
    return c.json({
      data: {
        ...(permissions || {
          personnelId: ctx.userId,
          modules: {},
          updatedAt: null,
          updatedBy: null,
        }),
        isSuperAdmin: false,
      },
    });
  } catch (e) {
    return handleError(c, e);
  }
});

/**
 * GET /permissions/all — Fetch permissions for all personnel (admin summary view)
 * Requires: personnel.manage_permissions capability
 */
app.get('/permissions/all', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    requireRole(ctx, ['super_admin', 'admin']);
    await requireCapability(ctx, 'personnel', 'manage_permissions');

    log.info('Fetching all permissions', { userId: ctx.userId });

    const allPermissions = await PermissionsService.getAllPermissions();
    return c.json({ data: allPermissions });
  } catch (e) {
    return handleError(c, e);
  }
});

/**
 * GET /permissions/:personnelId — Fetch permissions for a personnel member
 * Requires: personnel.manage_permissions capability
 */
app.get('/permissions/:personnelId', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    requireRole(ctx, ['super_admin', 'admin']);
    await requireCapability(ctx, 'personnel', 'manage_permissions');

    const personnelId = c.req.param('personnelId')!;
    log.info('Fetching permissions', { userId: ctx.userId, personnelId });

    const permissions = await PermissionsService.getPermissions(personnelId);
    return c.json({
      data: permissions || { personnelId, modules: {}, updatedAt: null, updatedBy: null },
    });
  } catch (e) {
    return handleError(c, e);
  }
});

const PermissionUpdateSchema = z.object({
  modules: z.record(z.string(), z.record(z.string(), z.boolean())),
});

/**
 * PUT /permissions/:personnelId — Update permissions for a personnel member
 * Requires: personnel.manage_permissions capability
 */
app.put('/permissions/:personnelId', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    requireRole(ctx, ['super_admin', 'admin']);
    await requireCapability(ctx, 'personnel', 'manage_permissions');

    const personnelId = c.req.param('personnelId')!;
    const body = await c.req.json();
    const parsed = PermissionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: 'Invalid request: modules object is required', ...formatZodError(parsed.error) },
        400,
      );
    }

    log.info('Updating permissions', { userId: ctx.userId, personnelId });

    // Fetch current permissions for audit diff
    const currentPerms = await PermissionsService.getPermissions(personnelId);
    const oldModules = (currentPerms?.modules || {}) as Record<string, unknown>;

    const modulesArg = parsed.data.modules as unknown as Record<
      string,
      { access: boolean; capabilities?: string[] }
    >;
    const result = await PermissionsService.setPermissions(personnelId, modulesArg, ctx.userId);

    // Record audit trail (fire-and-forget — don't block the response)
    PermissionAuditService.recordDiff(personnelId, ctx.userId, oldModules, modulesArg).catch(
      (err) => log.error('Failed to record permission audit', err),
    );

    return c.json({ data: result });
  } catch (e) {
    return handleError(c, e);
  }
});

// ============================================================================
// AUDIT LOG ROUTES
// ============================================================================

/**
 * GET /audit/permissions/:personnelId — Fetch permission audit trail for a specific user
 * Requires: personnel.manage_permissions capability
 */
app.get('/audit/permissions/:personnelId', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    requireRole(ctx, ['super_admin', 'admin']);
    await requireCapability(ctx, 'personnel', 'manage_permissions');

    const personnelId = c.req.param('personnelId')!;
    const limitParam = c.req.query('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    log.info('Fetching permission audit trail', { userId: ctx.userId, personnelId });

    const entries = await PermissionAuditService.getForPersonnel(personnelId, limit);
    return c.json({ data: entries });
  } catch (e) {
    return handleError(c, e);
  }
});

export default app;
