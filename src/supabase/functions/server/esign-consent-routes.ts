/**
 * esign /consent/* routes — consent document registry (Phase 5).
 * ==============================================================
 *
 * Extracted verbatim from esign-routes.tsx: the active-consent lookup and
 * consent-version publish / activate surface. Mounted via
 * `esignRoutes.route('/', consentRoutes)`. Self-contained — auth + the
 * consent-registry service only. Behaviour-preserving; the contract suite
 * is the guard.
 */
import { Hono } from 'npm:hono';
import { getAuthContext, AuthError } from './auth-mw.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { rateLimit } from './esign-rate-limit.ts';
import {
  getActiveConsent,
  listConsentVersions,
  publishConsentVersion,
  setActiveConsent,
} from './esign-consent-registry.ts';

const consentRoutes = new Hono();

consentRoutes.get('/consent/active', async (c) => {
  try {
    const rec = await getActiveConsent();
    return c.json({ id: rec.id, text: rec.text });
  } catch (error: unknown) {
    return c.json({ error: getErrMsg(error) }, 500);
  }
});

/** GET /consent/versions — admin: list every published version. */
consentRoutes.get('/consent/versions', async (c) => {
  try {
    await getAuthContext(c);
    const versions = await listConsentVersions();
    const activeId = (await getActiveConsent()).id;
    return c.json({ active_id: activeId, versions });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(JSON.stringify({ error: getErrMsg(error) }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/** POST /consent/versions — publish & activate a new consent version. */
consentRoutes.post('/consent/versions', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    const id = String(body.id ?? '').trim();
    const text = String(body.text ?? '').trim();
    const summary = typeof body.summary === 'string' ? body.summary : undefined;
    if (!id || !text) return c.json({ error: 'id and text are required' }, 400);
    const record = await publishConsentVersion({ id, text, summary, publishedBy: ctx.user.id });
    return c.json({ success: true, version: record }, 201);
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 400;
    return new Response(JSON.stringify({ error: getErrMsg(error) }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/** POST /consent/versions/:id/activate — flip the active pointer. */
consentRoutes.post('/consent/versions/:id/activate', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    await getAuthContext(c);
    const id = c.req.param('id')!;
    const record = await setActiveConsent(id);
    return c.json({ success: true, version: record });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 400;
    return new Response(JSON.stringify({ error: getErrMsg(error) }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

export default consentRoutes;
