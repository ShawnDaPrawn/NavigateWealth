/**
 * Honeycomb Integration — Route Orchestrator (Phase 5 decomposition)
 *
 * Thin mount-point. All route handlers live in focused sub-routers.
 * Every route requires an ADMIN session (§12.2) — see the guard below.
 *
 * Mounted at /integrations/honeycomb via mount-core.ts.
 */
import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { requireAdmin } from './auth-mw.ts';
import proxy from './honeycomb-proxy-routes.ts';
import registration from './honeycomb-registration-routes.ts';
import phase1 from './honeycomb-phase1-routes.ts';
import assessments from './honeycomb-assessments-routes.ts';
import phase2 from './honeycomb-phase2-routes.ts';
import dashboard from './honeycomb-dashboard-routes.ts';

const app = new Hono();
const log = createModuleLogger('honeycomb-routes');

// Admin-only KYC/AML integration (§12.2). This was `requireAuth`, which any
// self-registered client passes: every route here either spends the firm's
// Honeycomb credit on a paid identity, credit or sanctions check (the /proxy
// route forwards an arbitrary request under the firm's API key) or returns a
// named client's KYC/AML results by id. Every caller in the SPA lives in the
// admin panel, which only admin and super_admin can open.
app.use('*', requireAdmin);

// Global error handler — safety net for any errors that escape per-route try/catch
app.onError((err, c) => {
  log.error('Unhandled honeycomb route error:', err);
  const isZod = err.name === 'ZodError';
  return c.json(
    { error: isZod ? (err as unknown as { errors: unknown[] }).errors : getErrMsg(err) },
    isZod ? 400 : 500,
  );
});

app.route('/', proxy);
app.route('/', registration);
app.route('/', phase1);
app.route('/', assessments);
app.route('/', phase2);
app.route('/', dashboard);

export default app;
