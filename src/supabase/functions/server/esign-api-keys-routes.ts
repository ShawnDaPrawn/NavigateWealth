/**
 * esign /api-keys/* routes — programmatic-access key management (Phase 5).
 * ========================================================================
 *
 * Extracted verbatim from esign-routes.tsx: per-firm API key mint / list /
 * update / rotate / revoke, with plaintext tokens returned only once on
 * create and rotate. Mounted via `esignRoutes.route('/', apiKeysRoutes)`.
 * Self-contained — shared esign services + esign-route-helpers (resolveFirmId)
 * only. Behaviour-preserving; the contract suite is the guard.
 */
import { Hono } from 'npm:hono';
import { getAuthContext, AuthError } from './auth-mw.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { resolveFirmId } from './esign-route-helpers.ts';
import { logAuditEvent } from './esign-services.ts';
import {
  createApiKey,
  listApiKeysByFirm,
  getApiKey,
  updateApiKey,
  deleteApiKey,
  rotateApiKey,
  redactApiKey,
} from './api-key-service.ts';

const apiKeysRoutes = new Hono();

apiKeysRoutes.post('/api-keys', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const body = await c.req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return c.json({ error: 'A name is required' }, 400);
    const scopes = Array.isArray(body.scopes)
      ? body.scopes.filter((s: unknown) => typeof s === 'string')
      : undefined;
    const expiresAt = typeof body.expiresAt === 'string' ? body.expiresAt : undefined;
    const firmId = resolveFirmId(ctx.user);

    const { key, token } = await createApiKey({
      firmId,
      userId: ctx.user.id,
      name,
      scopes,
      expiresAt,
    });
    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'api_key_created',
      metadata: { id: key.id, name: key.name, prefix: key.prefix },
    });

    return c.json({ key: redactApiKey(key), token });
  } catch (error: unknown) {
    log.error('Create API key error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to create API key' },
      status,
    );
  }
});

/** GET /api-keys — list keys for the current firm (redacted). */
apiKeysRoutes.get('/api-keys', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const keys = await listApiKeysByFirm(firmId);
    return c.json({ keys: keys.map(redactApiKey) });
  } catch (error: unknown) {
    log.error('List API keys error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to list API keys' },
      status,
    );
  }
});

/** PATCH /api-keys/:id — update name / active / scopes / expires_at. */
apiKeysRoutes.patch('/api-keys/:id', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const id = c.req.param('id');
    const existing = await getApiKey(id);
    if (!existing) return c.json({ error: 'API key not found' }, 404);
    if (existing.firm_id !== resolveFirmId(ctx.user)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const patch: Partial<{ name: string; active: boolean; scopes: string[]; expires_at?: string }> =
      {};
    if (typeof body.name === 'string') patch.name = body.name.trim();
    if (typeof body.active === 'boolean') patch.active = body.active;
    if (Array.isArray(body.scopes))
      patch.scopes = body.scopes.filter((s: unknown) => typeof s === 'string') as string[];
    if (typeof body.expiresAt === 'string' || body.expiresAt === null)
      patch.expires_at = body.expiresAt ?? undefined;

    const updated = await updateApiKey(id, patch);
    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'api_key_updated',
      metadata: { id, patch },
    });
    return c.json({ key: updated ? redactApiKey(updated) : null });
  } catch (error: unknown) {
    log.error('Update API key error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to update API key' },
      status,
    );
  }
});

/** POST /api-keys/:id/rotate — issue a sibling key (dual-active). */
apiKeysRoutes.post('/api-keys/:id/rotate', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const id = c.req.param('id');
    const existing = await getApiKey(id);
    if (!existing) return c.json({ error: 'API key not found' }, 404);
    if (existing.firm_id !== resolveFirmId(ctx.user)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    const rotated = await rotateApiKey(id);
    if (!rotated) return c.json({ error: 'Failed to rotate' }, 500);
    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'api_key_rotated',
      metadata: { source_id: id, new_id: rotated.key.id },
    });
    return c.json({ key: redactApiKey(rotated.key), token: rotated.token });
  } catch (error: unknown) {
    log.error('Rotate API key error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to rotate API key' },
      status,
    );
  }
});

/** DELETE /api-keys/:id — permanent revoke. */
apiKeysRoutes.delete('/api-keys/:id', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const id = c.req.param('id');
    const existing = await getApiKey(id);
    if (!existing) return c.json({ error: 'API key not found' }, 404);
    if (existing.firm_id !== resolveFirmId(ctx.user)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await deleteApiKey(id);
    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'api_key_deleted',
      metadata: { id, name: existing.name },
    });
    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('Delete API key error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to delete API key' },
      status,
    );
  }
});

export default apiKeysRoutes;
