/**
 * esign /webhooks/* routes — firm-scoped event subscriptions (Phase 5).
 * =====================================================================
 *
 * Extracted verbatim from esign-routes.tsx: webhook subscription CRUD, secret
 * rotation, and the delivery / dead-letter / replay management surface.
 * Mounted back via `esignRoutes.route('/', webhooksRoutes)` so the exact
 * paths are preserved. Producers elsewhere still call `emitWebhookEvent`
 * (which stays in esign-routes); this module owns only the management HTTP
 * surface. Self-contained — depends on shared esign services + the webhook
 * service, no local esign-routes helpers (the route helpers it needs now live
 * in esign-route-helpers.ts). Behaviour-preserving; the contract suite guards.
 */
import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { getAuthContext, AuthError } from './auth-mw.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { resolveFirmId } from './esign-route-helpers.ts';
import { logAuditEvent } from './esign-services.ts';
import type { SenderEvent } from './esign-notification-prefs.ts';
import {
  createSubscription as createWebhookSub,
  listSubscriptionsByFirm as listWebhookSubs,
  getSubscription as getWebhookSub,
  updateSubscription as updateWebhookSub,
  rotateSubscriptionSecret as rotateWebhookSubSecret,
  deleteSubscription as deleteWebhookSub,
  listRecentDeliveries as listWebhookDeliveries,
  listDeadLetters as listWebhookDeadLetters,
  replayDelivery as replayWebhookDelivery,
  type WebhookDeliveryStatus,
} from './webhook-service.ts';

const log = createModuleLogger('esign-webhooks-routes');

const webhooksRoutes = new Hono();

const KNOWN_WEBHOOK_EVENTS: SenderEvent[] = [
  'signer.signed',
  'signer.declined',
  'envelope.completed',
  'envelope.expired',
  'signer.viewed',
  'envelope.recalled',
];

/** POST /webhooks — create a subscription. */
webhooksRoutes.post('/webhooks', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const body = await c.req.json().catch(() => ({}));
    const { url, events, description } = body as {
      url?: string;
      events?: string[];
      description?: string;
    };

    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return c.json({ error: 'A valid https URL is required' }, 400);
    }
    if (!Array.isArray(events) || events.length === 0) {
      return c.json({ error: 'At least one event subscription is required' }, 400);
    }
    const filtered = events.filter(
      (e): e is SenderEvent =>
        typeof e === 'string' && (KNOWN_WEBHOOK_EVENTS as string[]).includes(e),
    );
    if (filtered.length === 0) {
      return c.json({ error: 'No recognised events' }, 400);
    }

    const firmId = resolveFirmId(ctx.user);
    const sub = await createWebhookSub({
      firmId,
      userId: ctx.user.id,
      url,
      events: filtered,
      description: typeof description === 'string' ? description.slice(0, 300) : undefined,
    });

    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'webhook_subscription_created',
      metadata: { id: sub.id, url: sub.url, events: sub.events },
    });

    return c.json({ subscription: sub });
  } catch (error: unknown) {
    log.error('Create webhook error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to create subscription',
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/** GET /webhooks — list subscriptions for the current firm. */
webhooksRoutes.get('/webhooks', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const subs = await listWebhookSubs(firmId);
    return c.json({ subscriptions: subs });
  } catch (error: unknown) {
    log.error('List webhooks error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to list subscriptions',
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/** PATCH /webhooks/:id — update url / events / active / description. */
webhooksRoutes.patch('/webhooks/:id', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const id = c.req.param('id')!;
    const existing = await getWebhookSub(id);
    if (!existing) return c.json({ error: 'Subscription not found' }, 404);
    if (existing.firm_id !== resolveFirmId(ctx.user)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const patch: Partial<{
      url: string;
      events: SenderEvent[];
      active: boolean;
      description: string;
    }> = {};
    if (typeof body.url === 'string' && /^https?:\/\//i.test(body.url)) patch.url = body.url;
    if (Array.isArray(body.events)) {
      patch.events = body.events.filter(
        (e: unknown): e is SenderEvent =>
          typeof e === 'string' && (KNOWN_WEBHOOK_EVENTS as string[]).includes(e),
      );
    }
    if (typeof body.active === 'boolean') patch.active = body.active;
    if (typeof body.description === 'string') patch.description = body.description.slice(0, 300);

    const updated = await updateWebhookSub(id, patch);
    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'webhook_subscription_updated',
      metadata: { id, patch },
    });
    return c.json({ subscription: updated });
  } catch (error: unknown) {
    log.error('Update webhook error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to update subscription',
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/** POST /webhooks/:id/rotate-secret — issue a new signing secret. */
webhooksRoutes.post('/webhooks/:id/rotate-secret', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const id = c.req.param('id')!;
    const existing = await getWebhookSub(id);
    if (!existing) return c.json({ error: 'Subscription not found' }, 404);
    if (existing.firm_id !== resolveFirmId(ctx.user)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    const rotated = await rotateWebhookSubSecret(id);
    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'webhook_subscription_secret_rotated',
      metadata: { id },
    });
    return c.json({ subscription: rotated });
  } catch (error: unknown) {
    log.error('Rotate webhook secret error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to rotate secret' }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/** DELETE /webhooks/:id — remove a subscription. */
webhooksRoutes.delete('/webhooks/:id', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const id = c.req.param('id')!;
    const existing = await getWebhookSub(id);
    if (!existing) return c.json({ error: 'Subscription not found' }, 404);
    if (existing.firm_id !== resolveFirmId(ctx.user)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await deleteWebhookSub(id);
    await logAuditEvent({
      envelopeId: 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'webhook_subscription_deleted',
      metadata: { id, url: existing.url },
    });
    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('Delete webhook error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to delete subscription',
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * GET /webhooks/deliveries?status=&limit=
 * Recent deliveries for the current firm, newest first.
 */
webhooksRoutes.get('/webhooks/deliveries', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const status = c.req.query('status') as WebhookDeliveryStatus | undefined;
    const limit = Number(c.req.query('limit') ?? 100) || 100;
    const deliveries = await listWebhookDeliveries({ status, limit, firmId });
    return c.json({ deliveries });
  } catch (error: unknown) {
    log.error('List webhook deliveries error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to list deliveries',
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/** GET /webhooks/dead-letters — everything that gave up. */
webhooksRoutes.get('/webhooks/dead-letters', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const firmId = resolveFirmId(ctx.user);
    const deliveries = await listWebhookDeadLetters(firmId);
    return c.json({ deliveries });
  } catch (error: unknown) {
    log.error('List webhook dead-letters error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to list dead-letters',
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/** POST /webhooks/deliveries/:id/replay — re-enqueue a failed/dead delivery. */
webhooksRoutes.post('/webhooks/deliveries/:id/replay', rateLimit('SENDER_MUTATE'), async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const id = c.req.param('id')!;
    const delivery = await replayWebhookDelivery(id);
    if (!delivery) return c.json({ error: 'Delivery not found' }, 404);
    if (delivery.firm_id !== resolveFirmId(ctx.user)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await logAuditEvent({
      envelopeId: delivery.envelope_id ?? 'system',
      actorType: 'sender_user',
      actorId: ctx.user.id,
      action: 'webhook_delivery_replayed',
      metadata: { id, subscription_id: delivery.subscription_id, event_type: delivery.event_type },
    });
    return c.json({ delivery });
  } catch (error: unknown) {
    log.error('Replay webhook delivery error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to replay delivery',
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

export default webhooksRoutes;
