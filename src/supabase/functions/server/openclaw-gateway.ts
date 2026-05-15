export const OPENCLAW_EVENT_HISTORY_KEY = 'openclaw:events:latest';
export const OPENCLAW_EVENT_KEY_PREFIX = 'openclaw:event:';

export const OPENCLAW_CAPABILITY_REGISTRY = [
  {
    id: 'system.heartbeat',
    label: 'Heartbeat',
    description: 'Allows OpenClaw to prove connectivity without changing app data.',
    mutatesData: false,
  },
  {
    id: 'integration.proposal',
    label: 'Integration proposal',
    description: 'Allows OpenClaw to submit a future integration proposal for admin review.',
    mutatesData: false,
  },
  {
    id: 'message.intake',
    label: 'Message intake',
    description: 'Allows OpenClaw to submit a general inbound message for review.',
    mutatesData: false,
  },
  {
    id: 'provider.otp.submit',
    label: 'Provider OTP submit',
    description: 'Reserved for a later provider OTP capability. Disabled unless explicitly allow-listed.',
    mutatesData: true,
  },
] as const;

export type OpenClawCapabilityId = typeof OPENCLAW_CAPABILITY_REGISTRY[number]['id'];

export interface OpenClawEvent {
  id: string;
  capability: OpenClawCapabilityId;
  source: string;
  eventType: string;
  correlationId?: string;
  receivedAt: string;
  payload: unknown;
  status: 'accepted' | 'rejected';
  requiresReview: boolean;
}

export interface OpenClawEventSummary {
  id: string;
  capability: OpenClawCapabilityId;
  source: string;
  eventType: string;
  correlationId?: string;
  receivedAt: string;
  status: OpenClawEvent['status'];
  requiresReview: boolean;
}

export const DEFAULT_OPENCLAW_ALLOWED_CAPABILITIES: OpenClawCapabilityId[] = [
  'system.heartbeat',
  'integration.proposal',
  'message.intake',
];

const CAPABILITY_IDS = new Set<string>(OPENCLAW_CAPABILITY_REGISTRY.map((capability) => capability.id));

export function normaliseOpenClawCapabilityList(value: string | undefined | null): OpenClawCapabilityId[] {
  const raw = String(value || '').trim();
  if (!raw) return [...DEFAULT_OPENCLAW_ALLOWED_CAPABILITIES];

  const values = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const allowed = values.filter((item): item is OpenClawCapabilityId => CAPABILITY_IDS.has(item));
  return Array.from(new Set(allowed));
}

export function isOpenClawCapability(value: unknown): value is OpenClawCapabilityId {
  return typeof value === 'string' && CAPABILITY_IDS.has(value);
}

export function sanitizeOpenClawPayload(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.trim().slice(0, 1500);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (depth >= 4) return '[truncated]';

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeOpenClawPayload(item, depth + 1));
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 50);
    return Object.fromEntries(
      entries.map(([key, item]) => [key.slice(0, 80), sanitizeOpenClawPayload(item, depth + 1)]),
    );
  }

  return String(value).slice(0, 1500);
}

export function buildOpenClawEvent(
  body: Record<string, unknown>,
  allowedCapabilities: OpenClawCapabilityId[],
  now = new Date(),
  id = crypto.randomUUID(),
): { event: OpenClawEvent; error?: never } | { event?: never; error: string } {
  const capability = body.capability;
  if (!isOpenClawCapability(capability)) {
    return { error: 'Unknown OpenClaw capability' };
  }

  if (!allowedCapabilities.includes(capability)) {
    return { error: `OpenClaw capability is not enabled: ${capability}` };
  }

  const source = String(body.source || 'openclaw-vps').trim().slice(0, 80) || 'openclaw-vps';
  const eventType = String(body.eventType || capability).trim().slice(0, 120) || capability;
  const rawCorrelationId = String(body.correlationId || '').trim();
  const correlationId = rawCorrelationId ? rawCorrelationId.slice(0, 120) : undefined;

  return {
    event: {
      id,
      capability,
      source,
      eventType,
      correlationId,
      receivedAt: now.toISOString(),
      payload: sanitizeOpenClawPayload(body.payload ?? {}),
      status: 'accepted',
      requiresReview: capability !== 'system.heartbeat',
    },
  };
}

export function summariseOpenClawEvent(event: OpenClawEvent): OpenClawEventSummary {
  return {
    id: event.id,
    capability: event.capability,
    source: event.source,
    eventType: event.eventType,
    correlationId: event.correlationId,
    receivedAt: event.receivedAt,
    status: event.status,
    requiresReview: event.requiresReview,
  };
}
