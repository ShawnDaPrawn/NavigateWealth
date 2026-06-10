import { Hono } from 'npm:hono';
import { requireAuth } from './auth-mw.ts';
import { createModuleLogger } from './stderr-logger.ts';
import * as kv from './kv_store.tsx';

const app = new Hono();
const log = createModuleLogger('client-management-status');

const ADMIN_ROLES = new Set(['admin', 'super_admin', 'super-admin']);

// Statuses a client may set on their own profile. Approval/decline/suspension
// are admin-only transitions — without this whitelist any caller could
// self-approve and unlock the portal (SECURITY-AUDIT H-8).
const SELF_SERVICE_STATUSES = new Set(['application_in_progress', 'submitted_for_review']);
const VALID_ACCOUNT_TYPES = new Set(['personal', 'business', 'adviser']);

/**
 * POST /update-status
 * Lightweight endpoint for the client-side AccountTypeSelectionPage to sync
 * accountStatus into the KV profile when the user selects their account type.
 * This ensures route guards work correctly after page refresh. (SS5.4)
 *
 * Auth (SECURITY-AUDIT H-8): requires a real session. Non-admins may only
 * update their own profile and only to onboarding statuses.
 */
app.post('/update-status', requireAuth, async (c) => {
  try {
    const { userId, accountStatus, accountType } = await c.req.json();

    if (!userId || !accountStatus) {
      return c.json({ error: 'userId and accountStatus are required' }, 400);
    }

    const isAdmin = ADMIN_ROLES.has(c.get('userRole'));
    if (!isAdmin) {
      if (userId !== c.get('userId')) {
        return c.json(
          { error: 'Forbidden: you may only update your own status', code: 'FORBIDDEN' },
          403,
        );
      }
      if (!SELF_SERVICE_STATUSES.has(accountStatus)) {
        return c.json(
          { error: `Forbidden: status '${accountStatus}' requires admin`, code: 'FORBIDDEN' },
          403,
        );
      }
      if (accountType && !VALID_ACCOUNT_TYPES.has(accountType)) {
        return c.json({ error: 'Invalid accountType' }, 400);
      }
    }

    const profileKey = `user_profile:${userId}:personal_info`;
    const profile = (await kv.get(profileKey)) as Record<string, unknown> | null;

    if (!profile) {
      log.warn('No profile found for update-status', { userId });
      return c.json({ error: 'Profile not found' }, 404);
    }

    const now = new Date().toISOString();
    await kv.set(profileKey, {
      ...profile,
      accountStatus,
      ...(accountType ? { accountType } : {}),
      metadata: {
        ...((profile.metadata as Record<string, unknown>) || {}),
        updatedAt: now,
      },
    });

    log.info('Profile status synced', { userId, accountStatus });
    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('update-status error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update status',
      },
      500,
    );
  }
});

/**
 * GET /
 * Health check endpoint
 */
app.get('/', async (c) => {
  return c.json({
    status: 'ok',
    service: 'Profile Routes',
    timestamp: new Date().toISOString(),
  });
});

export default app;
