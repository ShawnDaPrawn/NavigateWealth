import { Hono } from "npm:hono";
import { createModuleLogger } from "./stderr-logger.ts";
import { requireAdmin } from "./auth-mw.ts";
import { getErrMsg } from "./shared-logger-utils.ts";
import * as kv from "./kv_store.tsx";
import { SaveGoalsSchema } from "./goal-validation.ts";
import { formatZodError } from "./shared-validation-utils.ts";

const app = new Hono();
const log = createModuleLogger('goal-planner');

// All goal-planner routes require admin authentication (§12.2)
app.use('*', requireAdmin);

/**
 * GOAL PLANNER ROUTES
 * Base Path: /make-server-91ed8379/goals
 */

// GET /:clientId - Fetch all goals for a client
app.get('/:clientId', async (c) => {
  try {
    const clientId = c.req.param('clientId');
    if (!clientId) return c.json({ error: 'Client ID required' }, 400);

    const key = `client_goals:${clientId}`;
    const goals = await kv.get(key);

    return c.json({ goals: goals || [] });
  } catch (e: unknown) {
    log.error(`Error fetching goals for client:`, e);
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

// POST /:clientId - Save all goals for a client (Atomic Replace)
app.post('/:clientId', async (c) => {
  try {
    const clientId = c.req.param('clientId');
    if (!clientId) return c.json({ error: 'Client ID required' }, 400);

    const body = await c.req.json();
    const parsed = SaveGoalsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    const { goals } = parsed.data;
    const key = `client_goals:${clientId}`;
    await kv.set(key, goals);

    log.info(`Updated goals for client ${clientId}. Count: ${goals.length}`);
    return c.json({ success: true });
  } catch (e: unknown) {
    log.error(`Error saving goals for client:`, e);
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

export default app;