import { describe, expect, it } from 'vitest';
import {
  evaluateVascoPublicGuardrails,
  isVascoPublicTopicAllowed,
  VASCO_PUBLIC_LIMITS,
  type VascoGuardrailStore,
} from '../vasco-guardrails.ts';

function createMemoryStore(seed: Record<string, unknown> = {}): VascoGuardrailStore {
  const values = new Map<string, unknown>(Object.entries(seed));
  return {
    get: async (key: string) => values.get(key),
    set: async (key: string, value: unknown) => {
      values.set(key, value);
    },
  };
}

const now = Date.UTC(2026, 4, 23, 9, 0, 0);
const financeMessages = [
  { role: 'user', content: 'How does estate duty work in South Africa?' },
];

describe('Vasco public guardrails', () => {
  it('allows valid financial questions within quota', async () => {
    const result = await evaluateVascoPublicGuardrails({
      ip: '203.0.113.10',
      visitorId: 'visitor-a',
      messages: financeMessages,
      now,
      store: createMemoryStore(),
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(VASCO_PUBLIC_LIMITS.visitorDaily - 1);
    expect(result.safetyIdentifier).toMatch(/^vasco_public_/);
  });

  it('blocks obvious general ChatGPT-style prompts before OpenAI', async () => {
    expect(isVascoPublicTopicAllowed('Write Python code for a snake game')).toBe(false);

    const result = await evaluateVascoPublicGuardrails({
      ip: '203.0.113.10',
      visitorId: 'visitor-a',
      messages: [{ role: 'user', content: 'Write Python code for a snake game' }],
      now,
      store: createMemoryStore(),
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('topic_blocked');
    expect(result.analyticsEvent).toBe('topic_blocked');
  });

  it('enforces the daily visitor cap', async () => {
    const store = createMemoryStore();

    for (let i = 0; i < VASCO_PUBLIC_LIMITS.visitorDaily; i++) {
      const result = await evaluateVascoPublicGuardrails({
        ip: '203.0.113.10',
        visitorId: 'visitor-a',
        messages: financeMessages,
        now: now + i * 6 * 60 * 1000,
        store,
      });
      expect(result.allowed).toBe(true);
    }

    const blocked = await evaluateVascoPublicGuardrails({
      ip: '203.0.113.10',
      visitorId: 'visitor-a',
      messages: financeMessages,
      now: now + 11 * 6 * 60 * 1000,
      store,
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.code).toBe('rate_limited');
  });

  it('enforces the daily IP cap across visitors', async () => {
    const store = createMemoryStore();

    for (let i = 0; i < VASCO_PUBLIC_LIMITS.ipDaily; i++) {
      const result = await evaluateVascoPublicGuardrails({
        ip: '203.0.113.10',
        visitorId: `visitor-${i}`,
        messages: financeMessages,
        now: now + i * 6 * 60 * 1000,
        store,
      });
      expect(result.allowed).toBe(true);
    }

    const blocked = await evaluateVascoPublicGuardrails({
      ip: '203.0.113.10',
      visitorId: 'visitor-over-ip',
      messages: financeMessages,
      now: now + 26 * 6 * 60 * 1000,
      store,
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.code).toBe('rate_limited');
  });

  it('enforces the five-minute burst cap', async () => {
    const store = createMemoryStore();

    for (let i = 0; i < VASCO_PUBLIC_LIMITS.burst; i++) {
      const result = await evaluateVascoPublicGuardrails({
        ip: '203.0.113.10',
        visitorId: 'visitor-a',
        messages: financeMessages,
        now: now + i * 30 * 1000,
        store,
      });
      expect(result.allowed).toBe(true);
    }

    const blocked = await evaluateVascoPublicGuardrails({
      ip: '203.0.113.10',
      visitorId: 'visitor-a',
      messages: financeMessages,
      now: now + 90 * 1000,
      store,
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.code).toBe('rate_limited');
    expect(blocked.remaining).toBeGreaterThan(0);
  });

  it('fails closed when the guardrail store is unavailable', async () => {
    const result = await evaluateVascoPublicGuardrails({
      ip: '203.0.113.10',
      visitorId: 'visitor-a',
      messages: financeMessages,
      now,
      store: {
        get: async () => {
          throw new Error('KV unavailable');
        },
        set: async () => undefined,
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('guardrail_unavailable');
    expect(result.analyticsEvent).toBe('guardrail_error');
  });

  it('opens the public daily circuit breaker before a paid call', async () => {
    const result = await evaluateVascoPublicGuardrails({
      ip: '203.0.113.10',
      visitorId: 'visitor-a',
      messages: financeMessages,
      now,
      store: createMemoryStore({
        'vasco:guardrails:budget:2026-05-23': {
          estimatedTokens: VASCO_PUBLIC_LIMITS.dailyEstimatedTokens - 100,
        },
      }),
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('circuit_breaker');
    expect(result.analyticsEvent).toBe('circuit_breaker');
  });
});
