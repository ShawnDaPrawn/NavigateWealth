/**
 * Vasco Chat — Shared Types
 *
 * Canonical type definitions shared between the public AskVascoPage
 * and the logged-in AIAdvisorPage (Ask Vasco portal).
 *
 * @module shared/vasco-chat/types
 */

export interface VascoChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: VascoCitation[];
  feedback?: 'positive' | 'negative' | null;
}

export interface VascoCitation {
  title: string;
  slug: string;
  url: string;
}

/**
 * SSE stream event types emitted by `/vasco/chat/stream`
 * and `/ai-advisor/chat/stream`.
 */
export type VascoStreamEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done'; sessionId: string; citations: VascoCitation[] }
  | { type: 'error'; message: string };
