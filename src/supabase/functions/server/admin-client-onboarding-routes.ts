/**
 * Admin Client Onboarding Routes
 * HTTP routes for admin-initiated single and bulk client creation.
 */

import type { Context, Next } from 'npm:hono';
import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import {
  AdminClientOnboardingService,
  validateClientInput,
} from './admin-client-onboarding-service.ts';
import { SUPER_ADMIN_EMAIL, HTTP_STATUS, ERROR_MESSAGES } from './constants.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';

const onboardingApp = new Hono();
const log = createModuleLogger('admin-onboarding-routes');

// ---------------------------------------------------------------------------
// Middleware — admin-only
// ---------------------------------------------------------------------------

const verifyAdmin = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: ERROR_MESSAGES.AUTH.NO_TOKEN }, HTTP_STATUS.UNAUTHORIZED);
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return c.json({ error: ERROR_MESSAGES.AUTH.INVALID_TOKEN }, HTTP_STATUS.UNAUTHORIZED);
    }

    const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    if (!isSuperAdmin) {
      const role = user.user_metadata?.role;
      if (role !== 'admin' && role !== 'super_admin' && role !== 'super-admin') {
        return c.json({ error: ERROR_MESSAGES.AUTH.NOT_ADMIN }, HTTP_STATUS.FORBIDDEN);
      }
    }

    c.set('userId', user.id);
    c.set('userEmail', user.email);
    await next();
  } catch (error) {
    log.error('Admin auth middleware error', error as Error);
    return c.json({ error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

onboardingApp.use('*', verifyAdmin);

// ---------------------------------------------------------------------------
// POST /add — Single client
// ---------------------------------------------------------------------------

onboardingApp.post('/add', async (c) => {
  try {
    const body = await c.req.json();
    const adminUserId = c.get('userId');

    // Validate
    const errors = validateClientInput(body);
    if (errors.length > 0) {
      return c.json(
        { success: false, error: 'Validation failed', details: errors },
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const result = await AdminClientOnboardingService.addClient(body, adminUserId);

    if (!result.success) {
      const status = result.errorCode === 'EMAIL_EXISTS' ? 409 : HTTP_STATUS.BAD_REQUEST;
      return c.json(result, status);
    }

    return c.json(result, HTTP_STATUS.CREATED);
  } catch (error) {
    log.error('POST /add error', error as Error);
    return c.json(
      {
        success: false,
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: getErrMsg(error),
      },
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

// ---------------------------------------------------------------------------
// POST /bulk-add — Bulk import (JSON array parsed from Excel on frontend)
// ---------------------------------------------------------------------------

onboardingApp.post('/bulk-add', async (c) => {
  try {
    const body = await c.req.json();
    const adminUserId = c.get('userId');

    if (!body.clients || !Array.isArray(body.clients)) {
      return c.json(
        { success: false, error: 'Request body must contain a "clients" array' },
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const result = await AdminClientOnboardingService.bulkAddClients(body.clients, adminUserId);

    return c.json({ success: true, ...result });
  } catch (error) {
    log.error('POST /bulk-add error', error as Error);
    return c.json(
      {
        success: false,
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: getErrMsg(error),
      },
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

// ---------------------------------------------------------------------------
// POST /validate — Dry-run validation for a batch (no records created)
// ---------------------------------------------------------------------------

onboardingApp.post('/validate', async (c) => {
  try {
    const body = await c.req.json();

    if (!body.clients || !Array.isArray(body.clients)) {
      return c.json(
        { success: false, error: 'Request body must contain a "clients" array' },
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const results = body.clients.map((client: Record<string, unknown>, idx: number) => {
      const errors = validateClientInput(client);
      return {
        row: idx + 1,
        email: (client.emailAddress as string) || '',
        name: `${(client.firstName as string) || ''} ${(client.lastName as string) || ''}`.trim(),
        valid: errors.length === 0,
        errors,
      };
    });

    const valid = results.filter((r: { valid: boolean }) => r.valid).length;
    const invalid = results.filter((r: { valid: boolean }) => !r.valid).length;

    return c.json({ success: true, total: results.length, valid, invalid, results });
  } catch (error) {
    log.error('POST /validate error', error as Error);
    return c.json(
      {
        success: false,
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        details: getErrMsg(error),
      },
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

export default onboardingApp;