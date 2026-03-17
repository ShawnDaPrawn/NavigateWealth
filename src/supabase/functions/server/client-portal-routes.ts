/**
 * Client Portal Routes
 * API endpoints for the client-facing portfolio dashboard.
 *
 * Route handlers are thin dispatchers per Guidelines §4.2:
 *   - Parse input
 *   - Call service
 *   - Return response
 *
 * All routes require authentication.
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getPortfolioSummary } from './client-portal-service.ts';
import { requireAuth } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';

const app = new Hono();
const log = createModuleLogger('client-portal-routes');

// Root handler
app.get('/', (c) => c.json({ service: 'client-portal', status: 'active' }));

/**
 * GET /portfolio/:clientId
 * Fetch aggregated portfolio summary for a client.
 *
 * Requires authentication (Guidelines §12.2).
 * Authorisation: the authenticated user must either be the client themselves
 * (userId === clientId) or hold an admin / super_admin role.
 *
 * Returns assembled financial overview, recommendations, documents, and events.
 */
app.get('/portfolio/:clientId', requireAuth, async (c) => {
  try {
    const clientId = c.req.param('clientId');

    if (!clientId) {
      return c.json({ success: false, error: 'Client ID is required' }, 400);
    }

    // Authorisation gate: clients may only access their own portfolio;
    // admin / super_admin roles may access any client's portfolio.
    const userId = c.get('userId') as string | undefined;
    const userRole = c.get('userRole') as string | undefined;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin' || userRole === 'super-admin';

    if (!isAdmin && userId !== clientId) {
      log.warn('Authorisation denied for portfolio access', { userId, clientId, userRole });
      return c.json(
        { success: false, error: 'Forbidden: You may only view your own portfolio' },
        403,
      );
    }

    log.info('Portfolio summary requested', { clientId, requestedBy: userId });

    const summary = await getPortfolioSummary(clientId);

    return c.json({ success: true, data: summary });
  } catch (error: unknown) {
    log.error('Error fetching portfolio summary:', error instanceof Error ? error.message : error);
    return c.json(
      { success: false, error: `Failed to load portfolio summary: ${error instanceof Error ? error.message : 'Unknown error'}` },
      500,
    );
  }
});

// ============================================================================
// COMMUNICATION PREFERENCES
// ============================================================================

/**
 * GET /comm-prefs — Load the current user's communication preferences
 */
app.get('/comm-prefs', requireAuth, asyncHandler(async (c) => {
  const userId = c.get('userId') as string | undefined;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const prefs = await kv.get(`comm_prefs:${userId}`);
  return c.json({
    success: true,
    data: prefs || null,
  });
}));

/**
 * PUT /comm-prefs — Save the current user's communication preferences
 */
app.put('/comm-prefs', requireAuth, asyncHandler(async (c) => {
  const userId = c.get('userId') as string | undefined;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const { transactional, marketing, frequency } = body;

  // Validate shape
  if (!transactional || typeof transactional !== 'object') {
    return c.json({ error: 'transactional preferences object is required' }, 400);
  }
  if (!marketing || typeof marketing !== 'object') {
    return c.json({ error: 'marketing preferences object is required' }, 400);
  }
  if (!['realtime', 'daily', 'weekly'].includes(frequency)) {
    return c.json({ error: 'frequency must be realtime, daily, or weekly' }, 400);
  }

  const prefs = {
    userId,
    transactional: {
      email: !!transactional.email,
      sms: !!transactional.sms,
    },
    marketing: {
      email: !!marketing.email,
      sms: !!marketing.sms,
    },
    frequency,
    updatedAt: new Date().toISOString(),
  };

  await kv.set(`comm_prefs:${userId}`, prefs);
  log.info('Communication preferences saved', { userId });

  return c.json({ success: true, data: prefs });
}));

export default app;