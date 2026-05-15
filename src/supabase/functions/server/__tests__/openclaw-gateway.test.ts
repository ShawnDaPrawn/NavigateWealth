import { describe, expect, it } from 'vitest';
import {
  buildOpenClawEvent,
  normaliseOpenClawCapabilityList,
  sanitizeOpenClawPayload,
} from '../openclaw-gateway';

describe('OpenClaw gateway guardrails', () => {
  it('defaults to non-mutating general capabilities', () => {
    expect(normaliseOpenClawCapabilityList(undefined)).toEqual([
      'system.heartbeat',
      'integration.proposal',
      'message.intake',
    ]);
  });

  it('ignores unknown capability names from env configuration', () => {
    expect(normaliseOpenClawCapabilityList('system.heartbeat,unknown,provider.otp.submit')).toEqual([
      'system.heartbeat',
      'provider.otp.submit',
    ]);
  });

  it('rejects capabilities that are known but not currently enabled', () => {
    const result = buildOpenClawEvent(
      { capability: 'provider.otp.submit', payload: { otp: '123456' } },
      ['system.heartbeat'],
      new Date('2026-05-09T10:00:00.000Z'),
      'evt_1',
    );

    expect(result.error).toContain('not enabled');
  });

  it('records general events without granting app control', () => {
    const result = buildOpenClawEvent(
      {
        capability: 'integration.proposal',
        source: 'hostinger-openclaw',
        eventType: 'future.integration.request',
        correlationId: 'abc-123',
        payload: { requestedScope: 'calendar-read', notes: 'Please review' },
      },
      ['integration.proposal'],
      new Date('2026-05-09T10:00:00.000Z'),
      'evt_2',
    );

    expect(result.event).toMatchObject({
      id: 'evt_2',
      capability: 'integration.proposal',
      source: 'hostinger-openclaw',
      eventType: 'future.integration.request',
      correlationId: 'abc-123',
      receivedAt: '2026-05-09T10:00:00.000Z',
      status: 'accepted',
      requiresReview: true,
    });
  });

  it('trims oversized payload fields before storing them', () => {
    const payload = sanitizeOpenClawPayload({
      longValue: 'x'.repeat(2000),
      nested: { items: Array.from({ length: 60 }, (_, index) => ({ index })) },
    }) as { longValue: string; nested: { items: unknown[] } };

    expect(payload.longValue).toHaveLength(1500);
    expect(payload.nested.items).toHaveLength(50);
  });
});
