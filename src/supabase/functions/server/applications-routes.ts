/**
 * Admin Applications Controller
 * Handles HTTP requests for admin application operations
 */

import { Hono } from 'npm:hono';
import type { Context, Next } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { AdminApplicationsService } from './applications-service.ts';
import type {
  ErrorResponse,
  SuccessResponse,
} from './types.ts';
import {
  SUPER_ADMIN_EMAIL,
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from './constants.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import type { KvApplication } from './applications-types.ts';
import {
  InviteClientSchema,
  ResendInviteSchema,
} from './applications-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';

const adminApp = new Hono();
const log = createModuleLogger('admin-applications');

// ============================================================================
// MIDDLEWARE - Admin Authentication
// ============================================================================

/**
 * Middleware to verify admin access
 */
const verifyAdmin = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: ERROR_MESSAGES.AUTH.NO_TOKEN }, HTTP_STATUS.UNAUTHORIZED);
    }

    const token = authHeader.split(' ')[1];
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return c.json({ error: ERROR_MESSAGES.AUTH.INVALID_TOKEN }, HTTP_STATUS.UNAUTHORIZED);
    }

    // Check if user is super admin by email
    const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    
    if (!isSuperAdmin) {
      // Also check role from user metadata
      const userRole = user.user_metadata?.role;
      
      if (userRole !== 'admin' && userRole !== 'super_admin' && userRole !== 'super-admin') {
        return c.json({ error: ERROR_MESSAGES.AUTH.NOT_ADMIN }, HTTP_STATUS.FORBIDDEN);
      }
    }

    // Store user info in context
    c.set('userId', user.id);
    c.set('userEmail', user.email);
    
    await next();
  } catch (error) {
    return c.json(
      { error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR },
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

// Apply admin middleware to all routes
adminApp.use('*', verifyAdmin);

// ============================================================================
// ROUTES
// ============================================================================

// POST /applications/invite — Invite a prospective client
adminApp.post('/applications/invite', async (c) => {
  try {
    const adminUserId = c.get('userId');
    const body = await c.req.json();
    const parsed = InviteClientSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, HTTP_STATUS.BAD_REQUEST);
    }
    const { email, firstName, lastName } = parsed.data;
    const cellphoneNumber = (body as Record<string, unknown>).cellphoneNumber as string | undefined;
    const origin = c.req.header('origin') || c.req.header('referer')?.replace(/\/[^/]*$/, '') || undefined;

    const result = await AdminApplicationsService.inviteApplicant(
      { email, firstName, lastName, cellphoneNumber },
      adminUserId,
      origin,
    );

    if (!result.success) {
      const status = result.errorCode === 'EMAIL_EXISTS' ? 409 : HTTP_STATUS.BAD_REQUEST;
      return c.json(result, status);
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
    const adminUserId = c.get('userId');
    const body = await c.req.json();
    const parsed = ResendInviteSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, HTTP_STATUS.BAD_REQUEST);
    }
    const { applicationId } = parsed.data;
    const origin = c.req.header('origin') || c.req.header('referer')?.replace(/\/[^/]*$/, '') || undefined;

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
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

// GET /applications/:applicationId
adminApp.get('/applications/:applicationId', async (c) => {
  try {
    const applicationId = c.req.param('applicationId');

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
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

// PATCH /applications/:applicationId — Admin amend application data
adminApp.patch('/applications/:applicationId', async (c) => {
  try {
    const applicationId = c.req.param('applicationId');
    const adminUserId = c.get('userId');
    const body = await c.req.json();
    const { application_data, amendment_notes } = body || {};

    if (!application_data || typeof application_data !== 'object') {
      return c.json(
        { error: 'application_data object is required' } as ErrorResponse,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const result = await AdminApplicationsService.updateApplicationData(
      applicationId,
      application_data,
      adminUserId,
      amendment_notes
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
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

// POST /applications/:applicationId/approve
adminApp.post('/applications/:applicationId/approve', async (c) => {
  try {
    const applicationId = c.req.param('applicationId');
    const adminUserId = c.get('userId');

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
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

// POST /applications/:applicationId/decline
adminApp.post('/applications/:applicationId/decline', async (c) => {
  try {
    const applicationId = c.req.param('applicationId');
    const adminUserId = c.get('userId');
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
      HTTP_STATUS.INTERNAL_SERVER_ERROR
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
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

// DELETE /applications/clear
adminApp.delete('/applications/clear', async (c) => {
  try {
    const deletedCount = await AdminApplicationsService.clearApplications();
    return c.json({
      success: true,
      message: deletedCount === 0 ? 'No applications found' : `Deleted ${deletedCount} applications`,
      deleted: deletedCount,
    });
  } catch (error) {
    log.error('Clear applications error', error);
    return c.json(
      {
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: getErrMsg(error),
      } as ErrorResponse,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

// DELETE /applications/delete
adminApp.delete('/applications/delete', async (c) => {
  try {
    const { key } = await c.req.json();

    if (!key) {
      return c.json({ error: 'Key is required' } as ErrorResponse, HTTP_STATUS.BAD_REQUEST);
    }

    await AdminApplicationsService.deleteApplication(key);
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
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

// POST /applications/migrate
adminApp.post('/applications/migrate', async (c) => {
  try {
    const result = await AdminApplicationsService.migrateApplications();
    return c.json({
      success: true,
      message: result.migrated === 0 ? 'No applications found to migrate' : `Migrated ${result.migrated} applications`,
      ...result,
    });
  } catch (error) {
    log.error('Migrate applications error', error);
    return c.json(
      {
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: getErrMsg(error),
      } as ErrorResponse,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

// POST /applications/deprecate
adminApp.post('/applications/deprecate', async (c) => {
  try {
    const { applicationIds } = await c.req.json();

    if (!applicationIds || !Array.isArray(applicationIds)) {
      return c.json({ error: 'applicationIds array is required' } as ErrorResponse, HTTP_STATUS.BAD_REQUEST);
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
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

// GET /applications/deprecated
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
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

// POST /applications/undeprecate
adminApp.post('/applications/undeprecate', async (c) => {
  try {
    const { applicationIds } = await c.req.json();

    if (!applicationIds || !Array.isArray(applicationIds)) {
      return c.json({ error: 'applicationIds array is required' } as ErrorResponse, HTTP_STATUS.BAD_REQUEST);
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
      HTTP_STATUS.INTERNAL_SERVER_ERROR
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
      applications: applications?.map((app: unknown) => {
        const a = app as KvApplication;
        return {
          id: a.id,
          user_id: a.user_id,
          status: a.status,
          created_at: a.created_at,
          updated_at: a.updated_at,
          key: `application:${a.id}`,
        };
      }) || []
    });
  } catch (error) {
    log.error('Debug KV error', error);
    return c.json({ error: 'Debug error', details: String(error) }, 500);
  }
});

adminApp.get('/debug/all-keys', async (c) => {
  try {
    const allKeys = await AdminApplicationsService.getAllKeys('');
    
    const groupedKeys: Record<string, unknown[]> = {};
    if (allKeys && allKeys.length > 0) {
      for (const item of allKeys) {
        const keyStr = JSON.stringify(item);
        let prefix = 'unknown';
        if (keyStr.includes('application')) prefix = 'application*';
        else if (keyStr.includes('user')) prefix = 'user*';
        else if (keyStr.includes('profile')) prefix = 'profile*';
        else if (keyStr.includes('policy')) prefix = 'policy*';
        
        if (!groupedKeys[prefix]) groupedKeys[prefix] = [];
        groupedKeys[prefix].push(item);
      }
    }

    return c.json({
      total: allKeys?.length || 0,
      allKeys: allKeys || [],
      groupedByPrefix: groupedKeys,
    });
  } catch (error) {
    log.error('Debug all-keys error', error);
    return c.json({ error: 'Debug error', details: String(error) }, 500);
  }
});

adminApp.delete('/debug/delete-key', async (c) => {
  try {
    const { key } = await c.req.json();
    if (!key) return c.json({ error: 'Key is required' }, HTTP_STATUS.BAD_REQUEST);
    
    await AdminApplicationsService.deleteKey(key);
    return c.json({ success: true, message: `Deleted key: ${key}` });
  } catch (error) {
    log.error('Debug delete-key error', error);
    return c.json({ error: 'Debug error', details: String(error) }, 500);
  }
});

adminApp.post('/debug/nuclear-clear', async (c) => {
  try {
    const count = await AdminApplicationsService.nuclearClear();
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