/**
 * Investment Needs Analysis (INA) Backend Routes
 * Handles Goal-Based Investment Planning calculation, storage, and versioning
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { authenticateUser } from './fna-auth.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { SaveInvestmentSessionSchema } from './fna-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import {
  getNextVersionNumber,
  autoPopulateFromProfile,
  calculateInvestmentINA,
  type VersionedSession,
} from './investment-ina-calculations.ts';

const investmentInaRoutes = new Hono();
const log = createModuleLogger('investment-ina-routes');

// Root handlers
investmentInaRoutes.get('/', (c) => c.json({ service: 'investment-ina', status: 'active' }));
investmentInaRoutes.get('', (c) => c.json({ service: 'investment-ina', status: 'active' }));

// ==================== ROUTES ====================

/**
 * GET /investment-ina/client/:clientId/auto-populate
 * Auto-populate INA inputs from client profile
 */
investmentInaRoutes.get('/client/:clientId/auto-populate', async (c) => {
  try {
    await authenticateUser(c.req.header('Authorization'));
    const clientId = c.req.param('clientId')!;

    const inputs = await autoPopulateFromProfile(clientId);

    return c.json({ success: true, data: inputs });
  } catch (error: unknown) {
    log.error('❌ Error auto-populating Investment INA:', error);
    const message = getErrMsg(error);
    return c.json(
      {
        success: false,
        error: message,
      },
      message === 'Unauthorized' ? 401 : 500,
    );
  }
});

/**
 * POST /investment-ina/client/:clientId/calculate
 * Calculate INA results
 */
investmentInaRoutes.post('/client/:clientId/calculate', async (c) => {
  try {
    await authenticateUser(c.req.header('Authorization'));
    const clientId = c.req.param('clientId')!;
    const inputs = await c.req.json();

    log.info('📊 Calculating Investment INA for client:', { clientId });

    const results = calculateInvestmentINA(inputs);

    return c.json({ success: true, data: results });
  } catch (error: unknown) {
    log.error('❌ Error calculating Investment INA:', error);
    const message = getErrMsg(error);
    return c.json(
      {
        success: false,
        error: message,
      },
      message === 'Unauthorized' ? 401 : 500,
    );
  }
});

/**
 * POST /investment-ina/client/:clientId/save
 * Save INA session (draft or published)
 */
investmentInaRoutes.post('/client/:clientId/save', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const clientId = c.req.param('clientId')!;
    const body = await c.req.json();

    // Validate input per §4.2 / fna-validation.ts
    const validationResult = SaveInvestmentSessionSchema.safeParse(body);
    if (!validationResult.success) {
      const errMsg = formatZodError(validationResult.error);
      log.warn(`Validation failed for Investment INA save: ${errMsg}`);
      return c.json({ success: false, error: errMsg }, 400);
    }

    const { inputs, results, status } = validationResult.data;

    const version = await getNextVersionNumber(clientId);
    const sessionId = `${clientId}-v${version}`;

    const session = {
      id: sessionId,
      clientId,
      version,
      status: status || 'draft',
      inputs,
      results,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: status === 'published' ? new Date().toISOString() : undefined,
      publishedBy: status === 'published' ? user.id : undefined,
    };

    const key = `investment-ina:client:${clientId}:${sessionId}`;
    await kv.set(key, session);

    log.info(`✅ Investment INA saved: ${key} (${status})`);

    return c.json({ success: true, data: session });
  } catch (error: unknown) {
    log.error('❌ Error saving Investment INA:', error);
    const message = getErrMsg(error);
    return c.json(
      {
        success: false,
        error: message,
      },
      message === 'Unauthorized' ? 401 : 500,
    );
  }
});

/**
 * GET /investment-ina/client/:clientId/sessions
 * Get all INA sessions for a client
 */
investmentInaRoutes.get('/client/:clientId/sessions', async (c) => {
  try {
    await authenticateUser(c.req.header('Authorization'));
    const clientId = c.req.param('clientId')!;

    const sessions = await kv.getByPrefix(`investment-ina:client:${clientId}:`);

    // Sort by version descending
    const sorted = (sessions || []).sort(
      (a: VersionedSession, b: VersionedSession) => b.version - a.version,
    );

    return c.json({ success: true, data: sorted });
  } catch (error: unknown) {
    log.error('❌ Error fetching Investment INA sessions:', error);
    const message = getErrMsg(error);
    return c.json(
      {
        success: false,
        error: message,
      },
      message === 'Unauthorized' ? 401 : 500,
    );
  }
});

/**
 * GET /investment-ina/client/:clientId/latest-published
 * Get latest published INA for a client
 */
investmentInaRoutes.get('/client/:clientId/latest-published', async (c) => {
  try {
    const clientId = c.req.param('clientId')!;

    // Optional authentication - allow both authenticated clients and anon key access
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      try {
        const user = await authenticateUser(authHeader);
        // Check authorization: admins can access all data, regular users only their own
        const isAdmin =
          user.role === 'admin' ||
          user.role === 'super_admin' ||
          user.role === 'super-admin' ||
          user.id === 'admin';
        const isOwnData = user.id === clientId;

        if (!isAdmin && !isOwnData) {
          log.warn(
            `⚠️ User ${user.id} (role: ${user.role}) attempting to access Investment INA for client ${clientId}`,
          );
          return c.json({ error: 'Unauthorized access to client data' }, 403);
        }
      } catch (_authError) {
        // WORKAROUND: Auth bypass for backward compatibility with client portal
        // Problem: Client portal accesses published INA data using the anon key without a user session.
        // Why chosen: Removing this would break client-facing INA display until portal auth is refactored.
        // Proper fix: Require authentication on all INA reads; update client portal to pass user session token.
        // Revisit: When client portal auth is unified (tracked in Tier B backlog).
        log.info(
          'Authentication failed, allowing unauthenticated access to published Investment INA',
        );
      }
    }

    const sessions = await kv.getByPrefix(`investment-ina:client:${clientId}:`);

    const published = (sessions || [])
      .filter((s: VersionedSession) => s.status === 'published')
      .sort((a: VersionedSession, b: VersionedSession) => b.version - a.version);

    const latest = published[0] || null;

    log.info(
      latest
        ? `✅ Latest published Investment INA found: ${latest.id}`
        : '⚠️ No published Investment INA',
    );
    return c.json({ success: true, data: latest });
  } catch (error: unknown) {
    log.error('❌ Error fetching latest published Investment INA:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, 500);
  }
});

/**
 * GET /investment-ina/session/:sessionId
 * Get specific INA session by ID
 */
investmentInaRoutes.get('/session/:sessionId', async (c) => {
  try {
    await authenticateUser(c.req.header('Authorization'));
    const sessionId = c.req.param('sessionId')!;

    // Extract clientId from sessionId (format: clientId-vN)
    const clientId = sessionId.split('-v')[0];

    const key = `investment-ina:client:${clientId}:${sessionId}`;
    const session = await kv.get(key);

    if (!session) {
      return c.json(
        {
          success: false,
          error: 'Investment INA session not found',
        },
        404,
      );
    }

    return c.json({ success: true, data: session });
  } catch (error: unknown) {
    log.error('❌ Error fetching Investment INA session:', error);
    const message = getErrMsg(error);
    return c.json(
      {
        success: false,
        error: message,
      },
      message === 'Unauthorized' ? 401 : 500,
    );
  }
});

/**
 * DELETE /investment-ina/session/:sessionId
 * Delete an Investment INA session
 */
investmentInaRoutes.delete('/session/:sessionId', async (c) => {
  try {
    log.info('📥 DELETE /investment-ina/session/:sessionId');
    await authenticateUser(c.req.header('Authorization'));

    const sessionId = c.req.param('sessionId')!;

    // Extract clientId from sessionId (format: clientId-vN)
    const clientId = sessionId.split('-v')[0];

    const key = `investment-ina:client:${clientId}:${sessionId}`;
    await kv.del(key);

    log.info('✅ Investment INA session deleted:', { sessionId });
    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('❌ Error deleting Investment INA session:', error);
    const message = getErrMsg(error);
    return c.json(
      {
        success: false,
        error: message,
      },
      message === 'Unauthorized' ? 401 : 500,
    );
  }
});

export default investmentInaRoutes;
