/**
 * Admin Client Onboarding Routes
 * HTTP routes for admin-initiated single and bulk client creation.
 */

import { Hono } from 'npm:hono';
import { requireAdmin } from './auth-mw.ts';
import {
  AdminClientOnboardingService,
  validateClientInput,
  type AdminAddClientInput,
} from './admin-client-onboarding-service.ts';
import { HTTP_STATUS, ERROR_MESSAGES } from './constants.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';

const onboardingApp = new Hono();
const log = createModuleLogger('admin-onboarding-routes');

// ---------------------------------------------------------------------------
// Middleware — admin-only
// ---------------------------------------------------------------------------

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

onboardingApp.use('*', verifyAdmin);

// ---------------------------------------------------------------------------
// POST /add — Single client
// ---------------------------------------------------------------------------

onboardingApp.post('/add', async (c) => {
  try {
    const body = await c.req.json();
    const adminUserId = c.get('userId') as string;

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
      return new Response(JSON.stringify(result), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
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
    const adminUserId = c.get('userId') as string;

    if (!body.clients || !Array.isArray(body.clients)) {
      return c.json(
        { success: false, error: 'Request body must contain a "clients" array' },
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const result = await AdminClientOnboardingService.bulkAddClients(body.clients, adminUserId, {
      linkDuplicateEmails: body.linkDuplicateEmails === true,
    });

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
// POST /link-shared-mailbox — free an address held by a household member
// ---------------------------------------------------------------------------

/**
 * Move an existing client onto a derived sign-in alias so the mailbox they were
 * enrolled on is released for the person who owns it.
 *
 * The repair path for records predating the sign-in/contact split: a minor
 * enrolled on a parent's address holds that address in Supabase Auth, and until
 * it is released the parent cannot be onboarded at all.
 */
onboardingApp.post('/link-shared-mailbox', async (c) => {
  try {
    const body = await c.req.json();
    const adminUserId = c.get('userId') as string;

    if (!body.userId || typeof body.userId !== 'string') {
      return c.json({ success: false, error: 'userId is required' }, HTTP_STATUS.BAD_REQUEST);
    }

    const result = await AdminClientOnboardingService.linkExistingClientToSharedMailbox(
      body.userId,
      adminUserId,
      {
        relationship: typeof body.relationship === 'string' ? body.relationship : undefined,
        ownerUserId: typeof body.ownerUserId === 'string' ? body.ownerUserId : undefined,
      },
    );

    if (!result.success) {
      const status =
        result.errorCode === 'NOT_FOUND'
          ? HTTP_STATUS.NOT_FOUND
          : result.errorCode === 'NOT_A_CLIENT'
            ? HTTP_STATUS.FORBIDDEN
            : HTTP_STATUS.BAD_REQUEST;
      return c.json(result, status);
    }

    return c.json(result);
  } catch (error) {
    log.error('POST /link-shared-mailbox error', error as Error);
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
      const errors = validateClientInput(client as unknown as AdminAddClientInput);
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
