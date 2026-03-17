/**
 * Will Chat Types — Server-side type definitions
 *
 * Types for the AI-driven Last Will & Testament interview and drafting flow.
 * The WILL_STATE mirrors the agent spec data model exactly.
 *
 * @module will-chat/types
 */

// ── Chat Message Types ─────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp: string;
}

// ── Will Chat Session ──────────────────────────────────────────────

export type WillChatSessionStatus = 'active' | 'drafting' | 'completed' | 'abandoned';

export interface WillChatSession {
  id: string;
  clientId: string;
  adviserId: string;
  clientName: string;
  messages: ChatMessage[];
  status: WillChatSessionStatus;
  /** The final will text returned by the agent (populated at end of interview) */
  willText: string | null;
  /** Parsed output sections from the agent */
  outputPack: WillOutputPack | null;
  createdAt: string;
  updatedAt: string;
}

// ── Output Pack (agent's final deliverables) ───────────────────────

export interface WillOutputPack {
  /** The full Last Will & Testament text */
  willDraft: string;
  /** Issue & Risk Register (markdown) */
  issueRegister: string;
  /** Execution Checklist (markdown) */
  executionChecklist: string;
  /** Client Confirmation Summary (markdown) */
  confirmationSummary: string;
}

// ── API Request / Response shapes ──────────────────────────────────

export interface CreateSessionRequest {
  clientId: string;
  clientName: string;
}

export interface SendMessageRequest {
  message: string;
  conversationHistory?: Array<{ role: MessageRole; content: string }>;
}

export interface ChatResponsePayload {
  reply: string;
  sessionId: string;
  status: WillChatSessionStatus;
  /** Set to true when the agent has delivered the final will text */
  willReady: boolean;
}
