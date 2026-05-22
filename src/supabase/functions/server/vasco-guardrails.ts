/**
 * Public Vasco guardrails.
 *
 * This layer runs before OpenAI calls for the logged-out Ask Vasco experience.
 * It keeps public use bounded without changing authenticated Vasco flows.
 */

import * as kv from './kv_store.tsx';

export const VASCO_PUBLIC_LIMITS = {
  visitorDaily: 10,
  ipDaily: 25,
  burst: 3,
  burstWindowMs: 5 * 60 * 1000,
  dailyEstimatedTokens: 100_000,
  maxUserMessageChars: 1_200,
  maxSubmittedMessages: 12,
  maxResponseTokens: 600,
} as const;

const USAGE_PREFIX = 'vasco:guardrails:usage';
const BUDGET_PREFIX = 'vasco:guardrails:budget';
const FALLBACK_VISITOR_ID = 'anonymous';

export type VascoGuardrailBlockCode =
  | 'invalid_request'
  | 'message_too_long'
  | 'too_many_messages'
  | 'topic_blocked'
  | 'rate_limited'
  | 'circuit_breaker'
  | 'guardrail_unavailable';

export type VascoGuardrailAnalyticsEvent =
  | 'topic_blocked'
  | 'rate_limited'
  | 'circuit_breaker'
  | 'guardrail_error';

export interface VascoPublicGuardrailMessage {
  role: string;
  content: string;
}

export interface VascoGuardrailStore {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
}

export interface VascoPublicGuardrailInput {
  ip: string;
  visitorId?: string;
  messages: VascoPublicGuardrailMessage[];
  now?: number;
  store?: VascoGuardrailStore;
}

export interface VascoPublicGuardrailResult {
  allowed: boolean;
  status: number;
  code?: VascoGuardrailBlockCode;
  analyticsEvent?: VascoGuardrailAnalyticsEvent;
  reason?: string;
  remaining: number;
  estimatedTokens: number;
  safetyIdentifier: string;
}

interface CounterEntry {
  count?: number;
  estimatedTokens?: number;
  updatedAt?: string;
}

const FINANCE_ALLOW_PATTERNS = [
  /\b(finance|financial|money|wealth|advisor|adviser|advice|planning|plan)\b/i,
  /\b(retire|retirement|annuity|pension|preservation|living annuity|life annuity)\b/i,
  /\b(tax|sars|section 11f|deduction|capital gains|cgt|estate duty)\b/i,
  /\b(invest|investment|portfolio|unit trust|etf|tfsa|saving|savings)\b/i,
  /\b(life cover|risk cover|income protection|disability|severe illness|medical aid|gap cover)\b/i,
  /\b(estate|will|trust|inheritance|beneficiary|executor)\b/i,
  /\b(fna|financial needs analysis|navigate wealth|fsp|fais|fsca)\b/i,
  /\b(south africa|south african|sa )\b/i,
];

const OFF_TOPIC_BLOCK_PATTERNS = [
  /\b(ignore|disregard)\s+(all\s+)?(previous|above|system|developer)\s+(instructions?|messages?|prompts?)\b/i,
  /\b(jailbreak|dan mode|developer mode|system prompt|hidden prompt|prompt injection)\b/i,
  /\b(act as|pretend to be|roleplay as|simulate being)\b/i,
  /\b(write|debug|fix|review|generate)\s+(code|javascript|typescript|python|sql|html|css|react|program)\b/i,
  /\b(recipe|meal plan|poem|lyrics|song|short story|novel|screenplay|essay|homework)\b/i,
  /\b(general research|summari[sz]e this article|translate this|write an email|cover letter|cv|resume)\b/i,
  /\b(chatgpt|gpt wrapper|unlimited ai|unlimited chat)\b/i,
];

function dayStamp(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function burstStamp(now: number): string {
  return String(Math.floor(now / VASCO_PUBLIC_LIMITS.burstWindowMs));
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36);
}

function normalizeIdentifier(value: string | undefined, fallback: string): string {
  const cleaned = typeof value === 'string' ? value.trim().slice(0, 128) : '';
  return cleaned || fallback;
}

function getCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object') return 0;
  const entry = value as CounterEntry;
  return typeof entry.count === 'number' && Number.isFinite(entry.count) ? entry.count : 0;
}

function getEstimatedTokens(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const entry = value as CounterEntry;
  return typeof entry.estimatedTokens === 'number' && Number.isFinite(entry.estimatedTokens)
    ? entry.estimatedTokens
    : 0;
}

async function setCount(store: VascoGuardrailStore, key: string, count: number, now: number): Promise<void> {
  await store.set(key, {
    count,
    updatedAt: new Date(now).toISOString(),
  });
}

function latestUserMessage(messages: VascoPublicGuardrailMessage[]): string {
  return [...messages].reverse().find((msg) => msg.role === 'user')?.content?.trim() || '';
}

export function estimateVascoPublicTokens(
  messages: VascoPublicGuardrailMessage[],
  maxResponseTokens = VASCO_PUBLIC_LIMITS.maxResponseTokens,
): number {
  const inputChars = messages.reduce(
    (total, message) => total + (typeof message.content === 'string' ? message.content.length : 0),
    0,
  );
  return Math.ceil(inputChars / 4) + maxResponseTokens;
}

export function isVascoPublicTopicAllowed(message: string): boolean {
  const normalized = message.trim();
  if (!normalized) return false;

  const hasFinanceSignal = FINANCE_ALLOW_PATTERNS.some((pattern) => pattern.test(normalized));
  if (hasFinanceSignal) return true;

  const hasExplicitOffTopicSignal = OFF_TOPIC_BLOCK_PATTERNS.some((pattern) => pattern.test(normalized));
  if (hasExplicitOffTopicSignal) return false;

  const looksLikeGeneralKnowledge =
    /^(who|what|when|where|why|how|can you|please)\b/i.test(normalized) &&
    !/\b(cover|tax|estate|retire|invest|medical|risk|wealth|fna|adviser|advisor)\b/i.test(normalized);

  return !looksLikeGeneralKnowledge;
}

function denied(params: {
  status: number;
  code: VascoGuardrailBlockCode;
  analyticsEvent?: VascoGuardrailAnalyticsEvent;
  reason: string;
  remaining?: number;
  estimatedTokens: number;
  safetyIdentifier: string;
}): VascoPublicGuardrailResult {
  return {
    allowed: false,
    status: params.status,
    code: params.code,
    analyticsEvent: params.analyticsEvent,
    reason: params.reason,
    remaining: params.remaining ?? 0,
    estimatedTokens: params.estimatedTokens,
    safetyIdentifier: params.safetyIdentifier,
  };
}

export async function evaluateVascoPublicGuardrails({
  ip,
  visitorId,
  messages,
  now = Date.now(),
  store = kv,
}: VascoPublicGuardrailInput): Promise<VascoPublicGuardrailResult> {
  const normalizedIp = normalizeIdentifier(ip, 'unknown');
  const normalizedVisitorId = normalizeIdentifier(visitorId, FALLBACK_VISITOR_ID);
  const ipHash = stableHash(`ip:${normalizedIp}`);
  const visitorHash = stableHash(`visitor:${normalizedVisitorId}`);
  const safetyIdentifier = `vasco_public_${visitorHash}`;
  const estimatedTokens = Array.isArray(messages) ? estimateVascoPublicTokens(messages) : 0;

  try {
    if (!Array.isArray(messages) || messages.length === 0) {
      return denied({
        status: 400,
        code: 'invalid_request',
        reason: 'Please send a message for Vasco to respond to.',
        estimatedTokens,
        safetyIdentifier,
      });
    }

    if (messages.length > VASCO_PUBLIC_LIMITS.maxSubmittedMessages) {
      return denied({
        status: 400,
        code: 'too_many_messages',
        reason: 'This public chat has reached its conversation limit. Please start a new question or sign up for personalised guidance.',
        estimatedTokens,
        safetyIdentifier,
      });
    }

    for (const message of messages) {
      if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') {
        return denied({
          status: 400,
          code: 'invalid_request',
          reason: 'Please send a valid Vasco chat message.',
          estimatedTokens,
          safetyIdentifier,
        });
      }

      if (message.role === 'user' && message.content.length > VASCO_PUBLIC_LIMITS.maxUserMessageChars) {
        return denied({
          status: 400,
          code: 'message_too_long',
          reason: 'Please shorten your question so Vasco can help clearly.',
          estimatedTokens,
          safetyIdentifier,
        });
      }
    }

    const currentUserMessage = latestUserMessage(messages);
    if (!isVascoPublicTopicAllowed(currentUserMessage)) {
      return denied({
        status: 400,
        code: 'topic_blocked',
        analyticsEvent: 'topic_blocked',
        reason: 'Vasco can help with South African financial planning, tax, retirement, risk cover, estate planning, medical aid, investments, and Navigate Wealth services.',
        estimatedTokens,
        safetyIdentifier,
      });
    }

    const date = dayStamp(now);
    const visitorKey = `${USAGE_PREFIX}:${date}:visitor:${visitorHash}`;
    const ipKey = `${USAGE_PREFIX}:${date}:ip:${ipHash}`;
    const burstKey = `${USAGE_PREFIX}:${date}:burst:${burstStamp(now)}:${visitorHash}:${ipHash}`;
    const budgetKey = `${BUDGET_PREFIX}:${date}`;

    const [visitorEntry, ipEntry, burstEntry, budgetEntry] = await Promise.all([
      store.get(visitorKey),
      store.get(ipKey),
      store.get(burstKey),
      store.get(budgetKey),
    ]);

    const visitorCount = getCount(visitorEntry);
    const ipCount = getCount(ipEntry);
    const burstCount = getCount(burstEntry);
    const dailyEstimatedTokens = getEstimatedTokens(budgetEntry);

    if (dailyEstimatedTokens + estimatedTokens > VASCO_PUBLIC_LIMITS.dailyEstimatedTokens) {
      return denied({
        status: 429,
        code: 'circuit_breaker',
        analyticsEvent: 'circuit_breaker',
        reason: 'Vasco is busy today. Please try again later or contact Navigate Wealth for help.',
        estimatedTokens,
        safetyIdentifier,
      });
    }

    if (burstCount >= VASCO_PUBLIC_LIMITS.burst) {
      return denied({
        status: 429,
        code: 'rate_limited',
        analyticsEvent: 'rate_limited',
        reason: 'Please wait a few minutes before asking Vasco another question.',
        remaining: Math.max(
          0,
          Math.min(
            VASCO_PUBLIC_LIMITS.visitorDaily - visitorCount,
            VASCO_PUBLIC_LIMITS.ipDaily - ipCount,
          ),
        ),
        estimatedTokens,
        safetyIdentifier,
      });
    }

    if (
      visitorCount >= VASCO_PUBLIC_LIMITS.visitorDaily ||
      ipCount >= VASCO_PUBLIC_LIMITS.ipDaily
    ) {
      return denied({
        status: 429,
        code: 'rate_limited',
        analyticsEvent: 'rate_limited',
        reason: 'You have reached the free Ask Vasco limit for now. You can sign up for personalised guidance or ask an adviser to contact you.',
        estimatedTokens,
        safetyIdentifier,
      });
    }

    const nextVisitorCount = visitorCount + 1;
    const nextIpCount = ipCount + 1;
    const nextBurstCount = burstCount + 1;

    await Promise.all([
      setCount(store, visitorKey, nextVisitorCount, now),
      setCount(store, ipKey, nextIpCount, now),
      setCount(store, burstKey, nextBurstCount, now),
      store.set(budgetKey, {
        estimatedTokens: dailyEstimatedTokens + estimatedTokens,
        updatedAt: new Date(now).toISOString(),
      }),
    ]);

    return {
      allowed: true,
      status: 200,
      remaining: Math.max(
        0,
        Math.min(
          VASCO_PUBLIC_LIMITS.visitorDaily - nextVisitorCount,
          VASCO_PUBLIC_LIMITS.ipDaily - nextIpCount,
        ),
      ),
      estimatedTokens,
      safetyIdentifier,
    };
  } catch {
    return denied({
      status: 503,
      code: 'guardrail_unavailable',
      analyticsEvent: 'guardrail_error',
      reason: 'Vasco is temporarily unavailable. Please try again shortly or contact Navigate Wealth for help.',
      estimatedTokens,
      safetyIdentifier,
    });
  }
}
