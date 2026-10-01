/**
 * Policy document intake — the worker's door.
 *
 *   POST /policy-document-intake/process — store whatever hand-overs are due
 *
 * Nobody hands a PDF over here: the agent does that in SQL, with
 * `public.policy_document_intake_submit`, and this route is what SQL wakes up
 * to store it (policy-document-intake-service.ts). It is called by
 * `public.policy_document_intake_kick()` — from submit, and from the
 * every-2-minute pg_cron sweep — with the shared cron token, and an admin can
 * call it to run the queue by hand. Running it with nothing due does nothing.
 *
 * Kept in its own router so the cron gate never leaks onto the policy routes,
 * where the app's own upload (`/integrations/policy-documents/upload`) keeps
 * requiring a signed-in user.
 */
import { Hono } from 'npm:hono';
import { requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { isAuthorizedCronRequest } from './cron-auth.ts';
import { processPolicyDocumentIntake } from './policy-document-intake-service.ts';

const app = new Hono();

app.use('*', async (c, next) => {
  if (await isAuthorizedCronRequest(c)) return next();
  return requireAdmin(c, next);
});

app.post(
  '/process',
  asyncHandler(async (c) => {
    const result = await processPolicyDocumentIntake();
    return c.json({ success: true, ...result });
  }),
);

export default app;
