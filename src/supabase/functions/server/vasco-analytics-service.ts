/**
 * Vasco Analytics Service
 *
 * Tracks conversation metrics, user feedback, and adviser handoff requests
 * for the public "Ask Vasco" chatbot.
 *
 * KV Key Conventions:
 *   vasco:analytics:daily:{YYYY-MM-DD}     — Daily aggregated metrics
 *   vasco:analytics:summary                 — Rolling summary (updated on read)
 *   vasco:feedback:{feedbackId}             — Individual feedback entries
 *   vasco:handoff:{handoffId}               — Adviser handoff / lead capture
 *   vasco:analytics:topics                  — Popular topic counters
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('vasco-analytics');

// ============================================================================
// TYPES
// ============================================================================

export interface DailyMetrics {
  date: string;
  sessions: number;
  messages: number;
  uniqueIps: string[];  // Hashed for privacy — no raw IPs stored
  feedbackPositive: number;
  feedbackNegative: number;
  handoffs: number;
  ragHits: number;        // Messages where RAG context was injected
  rateLimited: number;
}

export interface AnalyticsSummary {
  totalSessions: number;
  totalMessages: number;
  totalFeedbackPositive: number;
  totalFeedbackNegative: number;
  totalHandoffs: number;
  totalRagHits: number;
  last7Days: DailyMetrics[];
  topTopics: Array<{ topic: string; count: number }>;
  lastUpdated: string;
}

export interface FeedbackEntry {
  id: string;
  sessionId: string;
  messageContent: string;
  rating: 'positive' | 'negative';
  comment?: string;
  createdAt: string;
}

export interface HandoffRequest {
  id: string;
  sessionId: string;
  name: string;
  email: string;
  phone?: string;
  topic: string;
  conversationSummary: string;
  status: 'new' | 'contacted' | 'converted' | 'closed';
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DAILY_PREFIX = 'vasco:analytics:daily:';
const FEEDBACK_PREFIX = 'vasco:feedback:';
const HANDOFF_PREFIX = 'vasco:handoff:';
const TOPICS_KEY = 'vasco:analytics:topics';

// ============================================================================
// HELPER — Today's date string
// ============================================================================

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function hashIp(ip: string): string {
  // Simple hash for privacy — not cryptographic, just avoids storing raw IPs
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `h${Math.abs(hash).toString(36)}`;
}

// ============================================================================
// TRACKING — Called from chat route
// ============================================================================

/**
 * Track a chat message event. Called after each successful chat response.
 */
export async function trackChatEvent(params: {
  ip: string;
  sessionId: string;
  hadRagContext: boolean;
}): Promise<void> {
  try {
    const date = todayKey();
    const key = `${DAILY_PREFIX}${date}`;
    const existing = await kv.get(key) as DailyMetrics | null;

    const hashedIp = hashIp(params.ip);

    if (existing) {
      const uniqueIps = existing.uniqueIps.includes(hashedIp)
        ? existing.uniqueIps
        : [...existing.uniqueIps, hashedIp];

      await kv.set(key, {
        ...existing,
        messages: existing.messages + 1,
        sessions: uniqueIps.length,
        uniqueIps,
        ragHits: existing.ragHits + (params.hadRagContext ? 1 : 0),
      });
    } else {
      await kv.set(key, {
        date,
        sessions: 1,
        messages: 1,
        uniqueIps: [hashedIp],
        feedbackPositive: 0,
        feedbackNegative: 0,
        handoffs: 0,
        ragHits: params.hadRagContext ? 1 : 0,
        rateLimited: 0,
      } satisfies DailyMetrics);
    }
  } catch (err) {
    // Analytics tracking is non-fatal
    log.error('Failed to track chat event (non-fatal)', err);
  }
}

/**
 * Track a rate-limit hit.
 */
export async function trackRateLimitEvent(): Promise<void> {
  try {
    const date = todayKey();
    const key = `${DAILY_PREFIX}${date}`;
    const existing = await kv.get(key) as DailyMetrics | null;

    if (existing) {
      await kv.set(key, {
        ...existing,
        rateLimited: existing.rateLimited + 1,
      });
    }
  } catch (err) {
    log.error('Failed to track rate limit event (non-fatal)', err);
  }
}

/**
 * Track a topic from the user's message for popular-topics analytics.
 * Simple keyword extraction — not ML-based.
 */
export async function trackTopic(message: string): Promise<void> {
  try {
    const topicKeywords: Record<string, string[]> = {
      'Retirement Planning': ['retirement', 'retire', 'pension', 'annuity', 'preservation'],
      'Life Cover': ['life cover', 'life insurance', 'death benefit', 'funeral'],
      'Tax Planning': ['tax', 'sars', 'section 11f', 'tax credit', 'deduction'],
      'Medical Aid': ['medical aid', 'medical scheme', 'gap cover', 'health'],
      'Estate Planning': ['estate', 'will', 'trust', 'inheritance', 'estate duty'],
      'Investments': ['invest', 'portfolio', 'unit trust', 'etf', 'tfsa', 'savings'],
      'Disability Cover': ['disability', 'income protection', 'income protect'],
      'Navigate Wealth': ['navigate wealth', 'your services', 'fna', 'financial needs'],
      'Severe Illness': ['severe illness', 'dread disease', 'critical illness'],
      'Employee Benefits': ['employee benefit', 'group scheme', 'employer'],
    };

    const lowerMsg = message.toLowerCase();
    const matchedTopics: string[] = [];

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some((kw) => lowerMsg.includes(kw))) {
        matchedTopics.push(topic);
      }
    }

    if (matchedTopics.length === 0) return;

    const existing = (await kv.get(TOPICS_KEY) as Record<string, number> | null) || {};

    for (const topic of matchedTopics) {
      existing[topic] = (existing[topic] || 0) + 1;
    }

    await kv.set(TOPICS_KEY, existing);
  } catch (err) {
    log.error('Failed to track topic (non-fatal)', err);
  }
}

// ============================================================================
// FEEDBACK
// ============================================================================

/**
 * Submit feedback on a Vasco response.
 */
export async function submitFeedback(params: {
  sessionId: string;
  messageContent: string;
  rating: 'positive' | 'negative';
  comment?: string;
}): Promise<FeedbackEntry> {
  const id = crypto.randomUUID();
  const entry: FeedbackEntry = {
    id,
    sessionId: params.sessionId,
    messageContent: params.messageContent.slice(0, 500), // Truncate for storage
    rating: params.rating,
    comment: params.comment?.slice(0, 500),
    createdAt: new Date().toISOString(),
  };

  await kv.set(`${FEEDBACK_PREFIX}${id}`, entry);

  // Update daily metrics
  try {
    const date = todayKey();
    const key = `${DAILY_PREFIX}${date}`;
    const existing = await kv.get(key) as DailyMetrics | null;

    if (existing) {
      await kv.set(key, {
        ...existing,
        feedbackPositive: existing.feedbackPositive + (params.rating === 'positive' ? 1 : 0),
        feedbackNegative: existing.feedbackNegative + (params.rating === 'negative' ? 1 : 0),
      });
    }
  } catch (err) {
    log.error('Failed to update daily feedback metrics (non-fatal)', err);
  }

  return entry;
}

/**
 * Get recent feedback entries.
 */
export async function getRecentFeedback(limit = 20): Promise<FeedbackEntry[]> {
  const entries = await kv.getByPrefix(FEEDBACK_PREFIX) as FeedbackEntry[];
  return entries
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

// ============================================================================
// HANDOFF / LEAD CAPTURE
// ============================================================================

/**
 * Create an adviser handoff request (lead capture).
 */
export async function createHandoff(params: {
  sessionId: string;
  name: string;
  email: string;
  phone?: string;
  topic: string;
  conversationSummary: string;
}): Promise<HandoffRequest> {
  const id = crypto.randomUUID();
  const handoff: HandoffRequest = {
    id,
    sessionId: params.sessionId,
    name: params.name,
    email: params.email,
    phone: params.phone,
    topic: params.topic,
    conversationSummary: params.conversationSummary.slice(0, 1000),
    status: 'new',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await kv.set(`${HANDOFF_PREFIX}${id}`, handoff);

  // Update daily metrics
  try {
    const date = todayKey();
    const key = `${DAILY_PREFIX}${date}`;
    const existing = await kv.get(key) as DailyMetrics | null;

    if (existing) {
      await kv.set(key, {
        ...existing,
        handoffs: existing.handoffs + 1,
      });
    }
  } catch (err) {
    log.error('Failed to update daily handoff metrics (non-fatal)', err);
  }

  log.info('Adviser handoff created', { id, topic: params.topic });
  return handoff;
}

/**
 * Get all handoff requests, optionally filtered by status.
 */
export async function getHandoffs(
  status?: HandoffRequest['status']
): Promise<HandoffRequest[]> {
  const all = await kv.getByPrefix(HANDOFF_PREFIX) as HandoffRequest[];
  const filtered = status ? all.filter((h) => h.status === status) : all;
  return filtered.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Update a handoff request's status.
 */
export async function updateHandoffStatus(
  id: string,
  status: HandoffRequest['status']
): Promise<HandoffRequest | null> {
  const key = `${HANDOFF_PREFIX}${id}`;
  const existing = await kv.get(key) as HandoffRequest | null;

  if (!existing) return null;

  const updated: HandoffRequest = {
    ...existing,
    status,
    updatedAt: new Date().toISOString(),
  };

  await kv.set(key, updated);
  return updated;
}

// ============================================================================
// ANALYTICS SUMMARY — Admin dashboard
// ============================================================================

/**
 * Build an analytics summary for the admin dashboard.
 * Aggregates the last 7 days of daily metrics.
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  // Fetch last 7 days of daily metrics
  const days: DailyMetrics[] = [];
  const now = new Date();

  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    const key = `${DAILY_PREFIX}${dateStr}`;
    const metrics = await kv.get(key) as DailyMetrics | null;

    if (metrics) {
      days.push(metrics);
    } else {
      days.push({
        date: dateStr,
        sessions: 0,
        messages: 0,
        uniqueIps: [],
        feedbackPositive: 0,
        feedbackNegative: 0,
        handoffs: 0,
        ragHits: 0,
        rateLimited: 0,
      });
    }
  }

  // Aggregate totals
  const totals = days.reduce(
    (acc, day) => ({
      totalSessions: acc.totalSessions + day.sessions,
      totalMessages: acc.totalMessages + day.messages,
      totalFeedbackPositive: acc.totalFeedbackPositive + day.feedbackPositive,
      totalFeedbackNegative: acc.totalFeedbackNegative + day.feedbackNegative,
      totalHandoffs: acc.totalHandoffs + day.handoffs,
      totalRagHits: acc.totalRagHits + day.ragHits,
    }),
    {
      totalSessions: 0,
      totalMessages: 0,
      totalFeedbackPositive: 0,
      totalFeedbackNegative: 0,
      totalHandoffs: 0,
      totalRagHits: 0,
    }
  );

  // Get topic counts
  const topicCounts = (await kv.get(TOPICS_KEY) as Record<string, number> | null) || {};
  const topTopics = Object.entries(topicCounts)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    ...totals,
    last7Days: days.reverse(), // Oldest first for chart rendering
    topTopics,
    lastUpdated: new Date().toISOString(),
  };
}
