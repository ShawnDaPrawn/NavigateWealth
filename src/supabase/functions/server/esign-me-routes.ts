/**
 * esign /me/* routes — sender self-service (Phase 5 decomposition).
 * =================================================================
 *
 * Extracted verbatim from esign-routes.tsx: the current user's notification
 * preferences (P5.2) and in-app notification bell (P5.7). Mounted back into
 * the esign app via `esignRoutes.route('/', meRoutes)` so the exact paths
 * (/me/notification-prefs, /me/notifications, ...) are preserved.
 *
 * Self-contained: depends only on the auth context + the notification-prefs
 * and in-app-notification services (no local esign-routes helpers), so it
 * moves without a circular import. Behaviour-preserving; the route contract
 * suite is the guard since tsc does not type-check edge code.
 */
import { Hono } from 'npm:hono';
import { getAuthContext, AuthError } from './auth-mw.ts';
import {
  getPreferences as getNotifPrefs,
  setPreferences as setNotifPrefs,
} from './esign-notification-prefs.ts';
import {
  list as listInAppNotifications,
  markRead as markInAppRead,
  markAllRead as markAllInAppRead,
} from './esign-inapp-notifications.ts';

const meRoutes = new Hono();

/**
 * P5.2 — Sender notification preferences.
 * GET  /me/notification-prefs   → current user's prefs
 * PUT  /me/notification-prefs   → { mode, perEvent? }
 */
meRoutes.get('/me/notification-prefs', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const prefs = await getNotifPrefs(ctx.user.id);
    return c.json({ success: true, preferences: prefs });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed' }),
      { status: status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

meRoutes.put('/me/notification-prefs', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const body = await c.req.json().catch(() => ({}));
    const allowedModes = new Set(['every_event', 'completion_only', 'digest', 'off']);
    const mode =
      typeof body.mode === 'string' && allowedModes.has(body.mode) ? body.mode : undefined;
    const updated = await setNotifPrefs(ctx.user.id, {
      mode,
      perEvent: typeof body.perEvent === 'object' ? body.perEvent : undefined,
    });
    return c.json({ success: true, preferences: updated });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed' }),
      { status: status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * P5.7 — In-app notifications (bell UI).
 * GET  /me/notifications              → recent items + unread counter
 * POST /me/notifications/:id/read     → mark one as read
 * POST /me/notifications/read-all     → mark everything read
 */
meRoutes.get('/me/notifications', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const limit = Number(c.req.query('limit') ?? 25);
    const unreadOnly = c.req.query('unreadOnly') === 'true';
    const result = await listInAppNotifications(ctx.user.id, { limit, unreadOnly });
    return c.json({ success: true, ...result });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed' }),
      { status: status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

meRoutes.post('/me/notifications/:id/read', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const id = c.req.param('id')!;
    const ok = await markInAppRead(ctx.user.id, id);
    return c.json({ success: ok });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed' }),
      { status: status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

meRoutes.post('/me/notifications/read-all', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const updated = await markAllInAppRead(ctx.user.id);
    return c.json({ success: true, updated });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed' }),
      { status: status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

export default meRoutes;
