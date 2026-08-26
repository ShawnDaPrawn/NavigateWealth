/**
 * Admin Applications Controller
 * Handles HTTP requests for admin application operations
 */

import { Hono, type Context, type Next } from 'npm:hono';
import { requireAdmin } from './auth-mw.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import { AdminApplicationsService } from './applications-service.ts';
import type { ErrorResponse, SuccessResponse } from './types.ts';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from './constants.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import type { KvApplication } from './applications-types.ts';
import { InviteClientSchema, ResendInviteSchema } from './applications-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';

const adminApp = new Hono();
const log = createModuleLogger('admin-applications');

// ============================================================================
// MIDDLEWARE - Admin Authentication
// ============================================================================

/**
 * Middleware to verify admin access
 */
/**
 * Admin gate — delegates to auth-mw (Stage B: consolidate auth onto auth-mw).
 *
 * This used to hand-roll bearer extraction, its own Supabase client, and its
 * own role check. It was already correct (it used resolveTrustedRole), but
 * every copy is a place the canonical version can drift away from — and one
 * such copy HAD drifted: tasks-digest-routes.ts resolved the role from
 * client-editable `user_metadata`, letting any signed-in user pass an
 * admin-only gate.
 *
 * `requireAdmin` checks the same three role strings and sets a superset of the
 * context variables this file reads (userId). It additionally applies
 * enforceAccountSecurity, so a deleted, suspended or stale-2FA account can no
 * longer administer clients through these routes — a strict improvement, and
 * the reason to route through one implementation rather than five.
 *
 * The error bodies change from this module's ERROR_MESSAGES constants to
 * auth-mw's ({ error, code }); the SPA reads `.error || .message`, so both
 * render.
 */
const verifyAdmin = requireAdmin;

// Apply admin middleware to all routes
adminApp.use('*', verifyAdmin);

/**
 * Second gate for the destructive routes: `admin` is not enough.
 *
 * WHY THIS EXISTS. The routes below can delete every application in the store,
 * delete an arbitrary KV row by key, or rewrite application records in bulk —
 * and they were reachable by any user holding the `admin` role, with no audit
 * entry. `admin` is the role most staff hold; the operations are irreversible
 * and, in the case of the by-key delete, not even scoped to this module's data.
 *
 * The role is read off the context rather than re-resolved, because
 * `requireAdmin` has already run and resolved it from trusted sources only
 * (`resolveTrustedRole`: the super-admin allowlist and `app_metadata`, never
 * the client-editable `user_metadata`). Re-checking would cost another
 * `auth.getUser` round trip for the same answer. The error body matches
 * auth-mw's `requireSuperAdmin` so the SPA renders it identically.
 */
const requireSuperAdminRole = async (c: Context, next: Next) => {
  const role = c.get('userRole') as string | undefined;
  if (role !== 'super_admin' && role !== 'super-admin') {
    return c.json(
      { error: 'Forbidden: Super Admin access required', code: 'FORBIDDEN_SUPER_ADMIN' },
      403,
    );
  }
  await next();
};

/**
 * Records a destructive maintenance action. Awaited at every call site so the
 * isolate cannot suspend before the entry is persisted; `record` never throws.
 */
function auditDestructive(
  c: Context,
  action: string,
  summary: string,
  metadata: Record<string, unknown>,
) {
  return AdminAuditService.record({
    actorId: c.get('userId') as string,
    actorRole: c.get('userRole') as string,
    category: 'bulk_operation',
    action,
    summary,
    severity: 'critical',
    entityType: 'application',
    metadata,
  });
}

/**
 * The only KV namespace this module owns.
 *
 * `deleteApplication` and `deleteKey` are both a bare `kv.del(key)`, so a route
 * that forwards a caller-supplied key deletes ANY row in the shared store —
 * a portal credential, a client profile, an e-signature record. The prefix
 * check keeps a route named "delete application" to applications.
 */
const APPLICATION_KEY_PREFIX = 'application:';

// ============================================================================
// ROUTES
// ============================================================================

// POST /applications/invite — Invite a prospective client
adminApp.post('/applications/invite', async (c) => {
  try {
    const adminUserId = c.get('userId') as string;
    const body = await c.req.json();
    const parsed = InviteClientSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: 'Validation failed', ...formatZodError(parsed.error) },
        HTTP_STATUS.BAD_REQUEST,
      );
    }
    const { email, firstName, lastName } = parsed.data;
    const cellphoneNumber = (body as Record<string, unknown>).cellphoneNumber as string | undefined;
    const origin =
      c.req.header('origin') || c.req.header('referer')?.replace(/\/[^/]*$/, '') || undefined;

    const result = await AdminApplicationsService.inviteApplicant(
      { email, firstName, lastName, cellphoneNumber },
      adminUserId,
      origin,
    );

    if (!result.success) {
      const status = result.errorCode === 'EMAIL_EXISTS' ? 409 : HTTP_STATUS.BAD_REQUEST;
      return new Response(JSON.stringify(result), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return c.json(result, 201);
  } catch (error) {
    log.error('POST /applications/invite error', error);
    return c.json(
      {
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: getErrMsg(error),
      } as ErrorResponse,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

// POST /applications/invite/resend — Resend invite email for an existing invited application
adminApp.post('/applications/invite/resend', async (c) => {
  try {
    const adminUserId = c.get('userId') as string;
    const body = await c.req.json();
    const parsed = ResendInviteSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: 'Validation failed', ...formatZodError(parsed.error) },
        HTTP_STATUS.BAD_REQUEST,
      );
    }
    const { applicationId } = parsed.data;
    const origin =
      c.req.header('origin') || c.req.header('referer')?.replace(/\/[^/]*$/, '') || undefined;

    const result = await AdminApplicationsService.resendInvite(applicationId, adminUserId, origin);

    if (!result.success) {
      return c.json(result, HTTP_STATUS.BAD_REQUEST);
    }

    return c.json({ success: true, message: 'Invitation email re-sent successfully' });
  } catch (error) {
    log.error('POST /applications/invite/resend error', error);
    return c.json(
      {
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: getErrMsg(error),
      } as ErrorResponse,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

// GET /applications
adminApp.get('/applications', async (c) => {
  try {
    const status = c.req.query('status');
    const sortBy = c.req.query('sortBy');
    const sortOrder = c.req.query('sortOrder');

    const result = await AdminApplicationsService.getApplications(status, sortBy, sortOrder);
    return c.json(result);
  } catch (error) {
    log.error('GET /applications error', error);
    return c.json(
      {
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: getErrMsg(error),
      } as ErrorResponse,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

// GET /applications/deprecated
//
// Registered BEFORE /applications/:applicationId (§14.2): Hono matches in
// registration order, so with the parameterised route first the literal word
// "deprecated" was captured as an applicationId and this handler never ran —
// the request looked up an application whose id is "deprecated" and 404'd.
adminApp.get('/applications/deprecated', async (c) => {
  try {
    const applications = await AdminApplicationsService.getDeprecatedApplications();
    return c.json({
      applications,
      total: applications.length,
    });
  } catch (error) {
    log.error('GET /applications/deprecated error', error);
    return c.json(
      {
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: getErrMsg(error),
      } as ErrorResponse,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

// GET /applications/:applicationId
adminApp.get('/applications/:applicationId', async (c) => {
  try {
    const applicationId = c.req.param('applicationId')!;

    const result = await AdminApplicationsService.getApplicationById(applicationId);
    return c.json(result);
  } catch (error: unknown) {
    const errMsg = getErrMsg(error);
    if (errMsg === ERROR_MESSAGES.APPLICATION.NOT_FOUND) {
      return c.json({ error: errMsg } as ErrorResponse, HTTP_STATUS.NOT_FOUND);
    }
    log.error('GET /applications/:applicationId error', error);
    return c.json(
      {
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: errMsg,
      } as ErrorResponse,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

// PATCH /applications/:applicationId — Admin amend application data
adminApp.patch('/applications/:applicationId', async (c) => {
  try {
    const applicationId = c.req.param('applicationId')!;
    const adminUserId = c.get('userId') as string;
    const body = await c.req.json();
    const { application_data, amendment_notes } = body || {};

    if (!application_data || typeof application_data !== 'object') {
      return c.json(
        { error: 'application_data object is required' } as ErrorResponse,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const result = await AdminApplicationsService.updateApplicationData(
      applicationId,
      application_data,
      adminUserId,
      amendment_notes,
    );

    return c.json({
      success: true,
      message: 'Application data updated successfully',
      applicationId,
      amendments_count: result.amendments_count,
    });
  } catch (error: unknown) {
    const errMsg = getErrMsg(error);
    if (errMsg === ERROR_MESSAGES.APPLICATION.NOT_FOUND) {
      return c.json({ error: errMsg } as ErrorResponse, HTTP_STATUS.NOT_FOUND);
    }
    log.error('PATCH /applications/:applicationId error', error);
    return c.json(
      {
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: errMsg,
      } as ErrorResponse,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

// POST /applications/:applicationId/approve
adminApp.post('/applications/:applicationId/approve', async (c) => {
  try {
    const applicationId = c.req.param('applicationId')!;
    const adminUserId = c.get('userId') as string;

    await AdminApplicationsService.approveApplication(applicationId, adminUserId);

    const response: SuccessResponse = {
      success: true,
      message: SUCCESS_MESSAGES.APPLICATION.APPROVED,
      applicationId,
    };
    return c.json(response);
  } catch (error: unknown) {
    const errMsg = getErrMsg(error);
    if (errMsg === ERROR_MESSAGES.APPLICATION.NOT_FOUND) {
      return c.json({ error: errMsg } as ErrorResponse, HTTP_STATUS.NOT_FOUND);
    }
    if (errMsg === ERROR_MESSAGES.APPLICATION.INVALID_STATUS) {
      return c.json({ error: errMsg } as ErrorResponse, HTTP_STATUS.BAD_REQUEST);
    }
    if (errMsg === ERROR_MESSAGES.APPLICATION.USER_NOT_FOUND) {
      return c.json({ error: errMsg } as ErrorResponse, 422);
    }
    log.error('Approve application error', error);
    return c.json(
      {
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: errMsg,
      } as ErrorResponse,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

// POST /applications/:applicationId/decline
adminApp.post('/applications/:applicationId/decline', async (c) => {
  try {
    const applicationId = c.req.param('applicationId')!;
    const adminUserId = c.get('userId') as string;
    const body = await c.req.json();
    const { reason } = body || {};

    await AdminApplicationsService.declineApplication(applicationId, adminUserId, reason);

    const response: SuccessResponse = {
      success: true,
      message: SUCCESS_MESSAGES.APPLICATION.DECLINED,
      applicationId,
    };
    return c.json(response);
  } catch (error: unknown) {
    const errMsg = getErrMsg(error);
    if (errMsg === ERROR_MESSAGES.APPLICATION.NOT_FOUND) {
      return c.json({ error: errMsg } as ErrorResponse, HTTP_STATUS.NOT_FOUND);
    }
    if (errMsg === ERROR_MESSAGES.APPLICATION.INVALID_STATUS) {
      return c.json({ error: errMsg } as ErrorResponse, HTTP_STATUS.BAD_REQUEST);
    }
    if (errMsg === ERROR_MESSAGES.APPLICATION.USER_NOT_FOUND) {
      return c.json({ error: errMsg } as ErrorResponse, 422);
    }
    log.error('Decline application error', error);
    return c.json(
      {
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: errMsg,
      } as ErrorResponse,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

// GET /stats
adminApp.get('/stats', async (c) => {
  try {
    const stats = await AdminApplicationsService.getStats();
    return c.json({ stats });
  } catch (error) {
    log.error('GET /stats error', error);
    return c.json(
      {
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: getErrMsg(error),
      } as ErrorResponse,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

// DELETE /applications/clear
adminApp.delete('/applications/clear', requireSuperAdminRole, async (c) => {
  try {
    const deletedCount = await AdminApplicationsService.clearApplications();
    await auditDestructive(c, 'applications_cleared', 'All client applications deleted', {
      deleted: deletedCount,
    });
    return c.json({
      success: true,
      message:
        deletedCount === 0 ? 'No applications found' : `Deleted ${deletedCount} applications`,
      deleted: deletedCount,
    });
  } catch (error) {
    log.error('Clear applications error', error);
    return c.json(
      {
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: getErrMsg(error),
      } as ErrorResponse,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

// DELETE /applications/delete
adminApp.delete('/applications/delete', requireSuperAdminRole, async (c) => {
  try {
    const { key } = await c.req.json();

    if (!key || typeof key !== 'string') {
      return c.json({ error: 'Key is required' } as ErrorResponse, HTTP_STATUS.BAD_REQUEST);
    }

    // The key goes straight to `kv.del`, so without this check the route
    // deletes any row in the shared store, not just an application.
    if (!key.startsWith(APPLICATION_KEY_PREFIX)) {
      return c.json(
        {
          error: `Key must start with "${APPLICATION_KEY_PREFIX}"`,
        } as ErrorResponse,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    await AdminApplicationsService.deleteApplication(key);
    await auditDestructive(c, 'application_deleted', 'Client application deleted by key', { key });
    return c.json({
      success: true,
      message: `Deleted application with key ${key}`,
    });
  } catch (error) {
    log.error('Delete application error', error);
    return c.json(
      {
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: getErrMsg(error),
      } as ErrorResponse,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

// POST /applications/migrate
adminApp.post('/applications/migrate', requireSuperAdminRole, async (c) => {
  try {
    const result = await AdminApplicationsService.migrateApplications();
    await auditDestructive(c, 'applications_migrated', 'Application records rewritten in bulk', {
      migrated: result.migrated,
      deleted: result.deleted,
    });
    return c.json({
      success: true,
      message:
        result.migrated === 0
          ? 'No applications found to migrate'
          : `Migrated ${result.migrated} applications`,
      ...result,
    });
  } catch (error) {
    log.error('Migrate applications error', error);
    return c.json(
      {
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: getErrMsg(error),
      } as ErrorResponse,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

// POST /applications/deprecate
adminApp.post('/applications/deprecate', async (c) => {
  try {
    const { applicationIds } = await c.req.json();

    if (!applicationIds || !Array.isArray(applicationIds)) {
      return c.json(
        { error: 'applicationIds array is required' } as ErrorResponse,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const count = await AdminApplicationsService.deprecateApplications(applicationIds);
    return c.json({
      success: true,
      message: `Deprecated ${count} applications`,
      deprecated: count,
    });
  } catch (error) {
    log.error('Deprecate applications error', error);
    return c.json(
      {
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: getErrMsg(error),
      } as ErrorResponse,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

// POST /applications/undeprecate
adminApp.post('/applications/undeprecate', async (c) => {
  try {
    const { applicationIds } = await c.req.json();

    if (!applicationIds || !Array.isArray(applicationIds)) {
      return c.json(
        { error: 'applicationIds array is required' } as ErrorResponse,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const count = await AdminApplicationsService.undeprecateApplications(applicationIds);
    return c.json({
      success: true,
      message: `Un-deprecated ${count} applications`,
      undeprecated: count,
    });
  } catch (error) {
    log.error('Undeprecate applications error', error);
    return c.json(
      {
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: getErrMsg(error),
      } as ErrorResponse,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

// ============================================================================
// DEBUG ROUTES
// ============================================================================

adminApp.get('/debug/kv', async (c) => {
  try {
    const applications = await AdminApplicationsService.getAllKeys('application:');
    return c.json({
      total: applications?.length || 0,
      applications:
        applications?.map((app: unknown) => {
          const a = app as KvApplication;
          return {
            id: a.id,
            user_id: a.user_id,
            status: a.status,
            created_at: a.created_at,
            updated_at: a.updated_at,
            key: `application:${a.id}`,
          };
        }) || [],
    });
  } catch (error) {
    log.error('Debug KV error', error);
    return c.json({ error: 'Debug error', details: String(error) }, 500);
  }
});

/**
 * REMOVED: GET /debug/all-keys.
 *
 * It called `getAllKeys('')`, which is `kv.getByPrefix('')` — and
 * `getByPrefix` selects `key, value` with `key >= '' AND key < '\uffff'` and
 * returns `data.map(d => d.value)`. So the route returned EVERY VALUE in the
 * shared `kv_store_91ed8379` table, in one unpaginated response, to any user
 * holding the `admin` role.
 *
 * That table is not application data. It also holds `portal-credential:*`
 * (provider portal usernames and passwords, stored in plaintext by
 * `savePortalCredentialRecord`), `refund-clusters:entity:*` (tax numbers, bank
 * account details, encrypted eFiling passwords), `user_profile:*` and
 * `esign:*`. The refund-cluster routes are deliberately restricted to super
 * admins precisely so that an admin cannot read those records — this route
 * handed the same data to any admin from a different module, which made that
 * gate decorative.
 *
 * It could not do what its name said either: `getByPrefix` returns values, not
 * keys, so the handler string-matched the serialised VALUE to guess a prefix.
 * Nothing in the SPA or the e2e suite called it. Deleted rather than narrowed:
 * an operator who needs to inspect the store has direct database access, and a
 * correct keys-only browser is a feature, not a fix.
 */

/**
 * REMOVED: DELETE /debug/delete-key.
 *
 * A second arbitrary-key delete (`kv.del(key)` with no prefix check), with no
 * caller anywhere in the SPA or the e2e suite. `DELETE /applications/delete`
 * covers the same need, now super-admin gated, scoped to the `application:`
 * namespace and audited. Two doors to the same irreversible operation is one
 * door too many.
 */

adminApp.post('/debug/nuclear-clear', requireSuperAdminRole, async (c) => {
  try {
    const count = await AdminApplicationsService.nuclearClear();
    await auditDestructive(c, 'applications_nuclear_cleared', 'Nuclear clear of application keys', {
      deleted: count,
    });
    return c.json({
      success: true,
      message: `Nuclear clear complete: deleted ${count} keys`,
      deleted: count,
    });
  } catch (error) {
    log.error('Debug nuclear-clear error', error);
    return c.json({ error: 'Debug error', details: String(error) }, 500);
  }
});

export default adminApp;
