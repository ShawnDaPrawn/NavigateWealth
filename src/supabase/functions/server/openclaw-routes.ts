import { Hono } from 'npm:hono';
import { requireAdmin } from './auth-mw.ts';
import * as kv from './kv_store.tsx';
import { logger as log } from './stderr-logger.ts';
import {
  buildOpenClawEvent,
  normaliseOpenClawCapabilityList,
  OPENCLAW_CAPABILITY_REGISTRY,
  OPENCLAW_EVENT_HISTORY_KEY,
  OPENCLAW_EVENT_KEY_PREFIX,
  type OpenClawEventSummary,
} from './openclaw-gateway.ts';

const app = new Hono();

function getOpenClawSecret(): string {
  return String(Deno.env.get('NW_OPENCLAW_GATEWAY_SECRET') || Deno.env.get('OPENCLAW_GATEWAY_SECRET') || '').trim();
}

function getAllowedCapabilities() {
  return normaliseOpenClawCapabilityList(Deno.env.get('NW_OPENCLAW_ALLOWED_CAPABILITIES'));
}

function hasValidOpenClawSecret(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const expected = getOpenClawSecret();
  if (!expected) return false;

  const explicit = String(c.req.header('X-OpenClaw-Secret') || '').trim();
  const authHeader = String(c.req.header('Authorization') || '');
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

  return explicit === expected || bearer === expected;
}

async function appendEventSummary(summary: OpenClawEventSummary) {
  const current = await kv.get(OPENCLAW_EVENT_HISTORY_KEY).catch(() => []) as OpenClawEventSummary[] | null;
  const history = Array.isArray(current) ? current : [];
  await kv.set(OPENCLAW_EVENT_HISTORY_KEY, [summary, ...history].slice(0, 100));
}

app.get('/health', (c) => {
  const configured = Boolean(getOpenClawSecret());
  const allowedCapabilities = getAllowedCapabilities();

  return c.json({
    service: 'openclaw-gateway',
    status: configured ? 'ready' : 'not_configured',
    configured,
    allowedCapabilities,
  });
});

app.get('/capabilities', requireAdmin, (c) => {
  const allowed = new Set(getAllowedCapabilities());
  return c.json({
    success: true,
    capabilities: OPENCLAW_CAPABILITY_REGISTRY.map((capability) => ({
      ...capability,
      enabled: allowed.has(capability.id),
    })),
  });
});

app.get('/events/latest', requireAdmin, async (c) => {
  const events = await kv.get(OPENCLAW_EVENT_HISTORY_KEY).catch(() => []) as OpenClawEventSummary[] | null;
  return c.json({ success: true, events: Array.isArray(events) ? events : [] });
});

app.post('/events', async (c) => {
  if (!getOpenClawSecret()) {
    return c.json({ success: false, error: 'OpenClaw gateway secret is not configured' }, 503);
  }

  if (!hasValidOpenClawSecret(c)) {
    return c.json({ success: false, error: 'Unauthorized OpenClaw request' }, 401);
  }

  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ success: false, error: 'Request body must be a JSON object' }, 400);
  }

  const result = buildOpenClawEvent(body, getAllowedCapabilities());
  if (result.error) {
    return c.json({ success: false, error: result.error }, 400);
  }

  const summary = {
    id: result.event.id,
    capability: result.event.capability,
    source: result.event.source,
    eventType: result.event.eventType,
    correlationId: result.event.correlationId,
    receivedAt: result.event.receivedAt,
    status: result.event.status,
    requiresReview: result.event.requiresReview,
  };

  await kv.set(`${OPENCLAW_EVENT_KEY_PREFIX}${result.event.id}`, result.event);
  await appendEventSummary(summary);

  log.info('OpenClaw event accepted', {
    eventId: result.event.id,
    capability: result.event.capability,
    source: result.event.source,
    requiresReview: result.event.requiresReview,
  });

  return c.json({
    success: true,
    event: summary,
    action: result.event.requiresReview ? 'recorded_for_review' : 'acknowledged',
  });
});

export default app;
