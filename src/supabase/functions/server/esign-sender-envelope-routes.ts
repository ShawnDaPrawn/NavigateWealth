/**
 * E-sign sender routes — a client's envelopes.
 *
 * WHY THIS FILE HOLDS ONE ROUTE
 * -----------------------------
 * It used to carry four more: `POST /envelopes/:id/sign`, `/reject`,
 * `/signers/:signerId/verify` and `/signers/:signerId/otp/send`. None of them
 * authenticated the caller in any way — no session, no signer token — and
 * `/sign` skipped every check the real signing flow makes (envelope state and
 * expiry, OTP / access-code / KBA factors, signing order, field ownership). A
 * caller holding an envelope id and a signer id, both of which appear in signer
 * pages and webhook payloads, could mark a signer as signed with a signature of
 * their choosing, overwrite field values, and trigger the platform-sealed
 * completion.
 *
 * Nothing in the app called them: signers sign through the token-authenticated
 * `/signer/*` routes (`esign-signer-*-routes.ts`), which enforce all of the
 * above. So they were removed rather than guarded. Do not reintroduce a
 * signing route that takes a signer id instead of the signer's access token.
 */
import { Hono } from 'npm:hono';
import { getAuthContext } from './auth-mw.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { belongsToFirm } from './esign-firm-scope.ts';
import { getClientEnvelopes } from './esign-services.ts';
import { canAccessClientAs } from './client-access.ts';
import { authErrorResponse } from './esign-auth-error-response.ts';

const log = createModuleLogger('esign-sender-envelope-routes');

const app = new Hono();

app.get('/clients/:clientId/envelopes', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const clientId = c.req.param('clientId')!;
    const clientEmail = c.req.query('email') || undefined;

    // The shared client-access policy: the client themself, a platform admin,
    // or the client's ASSIGNED adviser. This used to restrict only the
    // 'client' role, so every other role could list any client's envelopes.
    if (!(await canAccessClientAs({ id: ctx.userId, role: ctx.role }, clientId))) {
      return c.json({ error: 'Forbidden: You may only view your own envelopes' }, 403);
    }

    const envelopes = await getClientEnvelopes(clientId, clientEmail);

    // P6.9 — a client can legitimately span firms on a multi-tenant
    // install, but the caller should only ever see envelopes that
    // belong to their firm (or standalone envelopes).
    const scoped = (envelopes as unknown as Array<Record<string, unknown>>).filter((e) =>
      belongsToFirm(ctx.user, { firm_id: (e.firm_id as string | undefined) ?? null }),
    );

    return c.json({ envelopes: scoped });
  } catch (error: unknown) {
    log.error('❌ Get client envelopes error:', error);
    return authErrorResponse(error, 'Failed to fetch envelopes');
  }
});

export default app;
