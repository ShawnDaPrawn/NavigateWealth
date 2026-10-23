/**
 * Client totals refresh — the worker's door.
 *
 *   POST /client-totals-refresh/process — recalculate every stale client's totals
 *
 * Called by `public.client_totals_refresh_kick()`, which the policies trigger
 * and the every-2-minute pg_cron sweep run, with the shared cron token. An
 * admin can call it too. Running it with nothing stale does nothing.
 *
 * Kept in its own router so the cron gate never leaks onto the policy routes,
 * which keep requiring a signed-in user.
 */
import { Hono } from 'npm:hono';
import { requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { isAuthorizedCronRequest } from './cron-auth.ts';
import { refreshStaleClientTotals } from './client-totals-refresh-service.ts';

const app = new Hono();

app.use('*', async (c, next) => {
  if (await isAuthorizedCronRequest(c)) return next();
  return requireAdmin(c, next);
});

app.post(
  '/process',
  asyncHandler(async (c) => {
    const result = await refreshStaleClientTotals();
    return c.json({ success: true, ...result });
  }),
);

export default app;
