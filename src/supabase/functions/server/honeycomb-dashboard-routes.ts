import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import * as service from './honeycomb-service.ts';

const app = new Hono();
const log = createModuleLogger('honeycomb-dashboard');

// ============================================================================
// PHASE 4 — COMPLIANCE DASHBOARD
// ============================================================================

app.get('/dashboard/:clientId', async (c) => {
  try {
    const clientId = c.req.param('clientId');
    const dashboard = await service.getComplianceDashboard(clientId);
    return c.json({ success: true, dashboard });
  } catch (e: unknown) {
    log.error('Dashboard route error:', e);
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

export default app;
