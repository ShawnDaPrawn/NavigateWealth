/**
 * The AI advisor's shared ground: its KV key layout, message and session
 * shapes, and the environment-backed client factories.
 *
 * Split out of `ai-advisor.ts` (1,443 lines). Every other advisor module —
 * store, chat, routes — builds on exactly this.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { getPortfolioSummary } from './client-portal-service.ts';

export const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

export const getOpenAIKey = () => Deno.env.get('OPENAI_API_KEY');

/**
 * Authentication middleware
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
export interface KvRow {
  key: string;
  value: unknown;
}
export type AdvisorMessageArtifact = Record<string, unknown>;
export interface AdvisorStoredMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: Array<{ title: string; slug: string; url: string }>;
  artifacts?: AdvisorMessageArtifact[];
}
export interface AdvisorSessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string;
  messageCount: number;
  legacyImported?: boolean;
}

export interface AdvisorUserContext {
  clientName: string;
  profile: Record<string, unknown>;
  profileInformation: {
    clientKeys: unknown;
    compliance: unknown[];
    riskProfile: unknown;
    beneficiaries: unknown[];
  };
  policyInformation: unknown[];
  portfolioOverview: Awaited<ReturnType<typeof getPortfolioSummary>> | null;
  fnaInformation: Record<string, unknown[]>;
  communicationHistory: unknown[];
  documentHistory: unknown[];
  /**
   * Chunks retrieved from Vasco's knowledge index (published articles + live
   * Knowledge Base entries) for the latest user question. Empty when there was
   * no question to retrieve against or the index is empty.
   */
  knowledgeContext: Array<{ title: string; sourceType: 'article' | 'kb'; text: string }>;
  schemaSources: {
    profile: string[];
    policies: string[];
    portfolioOverview: string[];
    fnas: string[];
    communications: string[];
    documents: string[];
  };
}

export const POLICY_COLLECTION_KEY = (userId: string) => `policies:client:${userId}`;
export const LEGACY_POLICY_PREFIX = (userId: string) => `client:${userId}:policy:`;
export const PROFILE_KEY = (userId: string) => `user_profile:${userId}:personal_info`;
export const CLIENT_KEYS_KEY = (userId: string) => `user_profile:${userId}:client_keys`;
export const COMPLIANCE_PREFIX = (userId: string) => `client:${userId}:compliance:`;
export const RISK_PROFILE_KEY = (userId: string) => `client:${userId}:risk_profile`;
export const BENEFICIARY_PREFIX = (userId: string) => `client:${userId}:beneficiary:`;
export const COMMUNICATION_PREFIX = (userId: string) => `communication_log:${userId}:`;
export const DOCUMENT_PREFIXES = ['document:', 'doc:', 'tax_doc:', 'estate_doc:'] as const;
export const ESIGN_PREFIX = (userId: string) => `esign:client:${userId}:`;
export const LEGACY_CHAT_PREFIX = (userId: string) => `ai_advisor:${userId}:chat:`;
export const SESSION_META_PREFIX = (userId: string) => `ai_advisor:${userId}:session_meta:`;
export const SESSION_META_KEY = (userId: string, sessionId: string) =>
  `${SESSION_META_PREFIX(userId)}${sessionId}`;
export const SESSION_MESSAGE_PREFIX = (userId: string, sessionId: string) =>
  `ai_advisor:${userId}:session:${sessionId}:message:`;
export const FNA_PREFIXES = {
  riskPlanning: 'risk-planning-fna:client:',
  medical: 'medical-fna:client:',
  retirement: 'retirement-fna:client:',
  investment: 'investment-ina:client:',
  taxPlanning: 'tax-planning-fna:client:',
  estatePlanning: 'estate-planning-fna:client:',
} as const;
