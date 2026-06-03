import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import * as kv from './kv_store.tsx';

const app = new Hono();
const log = createModuleLogger('client-management-status');

/**
 * POST /update-status
 * Lightweight endpoint for the client-side AccountTypeSelectionPage to sync
 * accountStatus into the KV profile when the user selects their account type.
 * This ensures route guards work correctly after page refresh. (SS5.4)
 */
app.post('/update-status', async (c) => {
  try {
    const { userId, accountStatus, accountType } = await c.req.json();

    if (!userId || !accountStatus) {
      return c.json({ error: 'userId and accountStatus are required' }, 400);
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
