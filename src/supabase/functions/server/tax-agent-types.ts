/**
 * Tax Agent Types — Server-side type definitions
 *
 * Types for the AI-driven Tax submission interview and information
 * gathering flow, powered by the Navigate Wealth Tax Agent.
 *
 * @module tax-agent/types
 */

// ── Chat Message Types ─────────────────────────────────────────────

export type TaxAgentMessageRole = 'user' | 'assistant' | 'system';

export interface TaxAgentChatMessage {
  role: TaxAgentMessageRole;
  content: string;
  timestamp: string;
}

// ── Tax Agent Session ──────────────────────────────────────────────

export type TaxAgentSessionStatus = 'active' | 'gathering' | 'completed' | 'abandoned';

export interface TaxAgentSession {
  id: string;
  clientId: string;
  adviserId: string;
  clientName: string;
  messages: TaxAgentChatMessage[];
  status: TaxAgentSessionStatus;
  /** Summary output delivered by the agent when the interview is complete */
  outputPack: TaxAgentOutputPack | null;
  createdAt: string;
  updatedAt: string;
}

// ── Output Pack (agent's final deliverables) ─────────────────────

export interface TaxAgentOutputPack {
  /** Type of tax submission being handled (e.g. "ITR12 — Individual Income Tax") */
  submissionType: string;
  /** Structured summary of information gathered */
  informationSummary: string;
  /** List of supporting documents requested */
  documentChecklist: string;
  /** Next steps / action items for the adviser */
  nextSteps: string;
  /** Full interview transcript summary */
  confirmationSummary: string;
}
