/**
 * Shared model for the will-chat interview: server endpoint paths, message
 * length budget, the chat/session shapes, and the two timestamp formatters.
 * Used by WillChatInterface and its ChatCard.
 */
// ── Constants ──────────────────────────────────────────────────────

export const ENDPOINTS = {
  STATUS: '/will-chat/status',
  CREATE_SESSION: '/will-chat/create-session',
  SESSIONS: '/will-chat/sessions',
  SESSION: (id: string) => `/will-chat/sessions/${id}`,
  SEND: (id: string) => `/will-chat/sessions/${id}/send`,
  SAVE: (id: string) => `/will-chat/sessions/${id}/save`,
  CLIENT_SESSIONS: (clientId: string) => `/will-chat/sessions/client/${clientId}`,
} as const;

export const MAX_MESSAGE_LENGTH = 4000;

// ── Types ──────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface OutputPack {
  willDraft: string;
  issueRegister: string;
  executionChecklist: string;
  confirmationSummary: string;
}

export interface SessionSummary {
  id: string;
  clientId: string;
  clientName: string;
  status: string;
  messageCount: number;
  willReady: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────

export function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
