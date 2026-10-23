/**
 * Security Management Routes — thin orchestrator (Phase 5 decomposition).
 * =========================================================================
 *
 * Mounts the 4 focused sub-routers that replaced this 1,561-line file:
 *   security-activity-routes.ts     — GET/POST /:userId/activity
 *   security-password-routes.ts     — POST /:userId/password, GET /:userId/status
 *   security-email-change-routes.ts — POST /:userId/email-change/{request,resend,verify}
 *   security-2fa-routes.ts          — POST /:userId/suspend, POST /:userId/2fa*
 *
 * Shared helpers live in security-shared.ts.
 */
import { Hono } from 'npm:hono';
import activityRoutes from './security-activity-routes.ts';
import passwordRoutes from './security-password-routes.ts';
import emailChangeRoutes from './security-email-change-routes.ts';
import twoFaRoutes from './security-2fa-routes.ts';

const app = new Hono();

// Root handlers
app.get('/', (c) => c.json({ service: 'security', status: 'active' }));
app.get('', (c) => c.json({ service: 'security', status: 'active' }));

app.route('/', activityRoutes);
app.route('/', passwordRoutes);
app.route('/', emailChangeRoutes);
app.route('/', twoFaRoutes);

export default app;
