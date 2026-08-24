/**
 * AI chat, and client search.
 *
 * One slice of what used to be the single 1,287-line advice-engine `types.ts`;
 * that file remains the barrel every consumer imports from.
 */
import { type ClientSearchResult } from './conversation';
import { type MessageRole } from './messaging';

// AI Chat Types
// ============================================================================

/**
 * Request to send a chat message
 */
export interface ChatRequest {
  /** User's message */
  message: string;

  /** Optional client ID for context */
  clientId?: string | null;

  /** Optional conversation history for context */
  conversationHistory?: Array<{
    role: MessageRole;
    content: string;
  }>;

  /** Optional max tokens for response */
  maxTokens?: number;
}

/**
 * Response from chat API
 */
export interface ChatResponse {
  /** AI assistant's reply */
  reply: string;

  /** Tokens used in this request */
  tokensUsed?: number;

  /** Model used for response */
  model?: string;

  /** Processing time in ms */
  processingTime?: number;

  /** Any warnings or notes */
  warnings?: string[];
}

/**
 * Chat history data from server
 */
export interface HistoryData {
  /** Array of historical messages */
  messages: Array<{
    /** User's query */
    query: string;

    /** AI's reply */
    reply: string;

    /** Timestamp of exchange */
    timestamp: string;

    /** Client ID if applicable */
    clientId?: string;
  }>;
}

/**
 * API key status
 */
export interface ApiKeyStatus {
  /** Whether API key is configured */
  configured: boolean;

  /** Whether API key is valid */
  valid?: boolean;

  /** Provider (e.g., 'openai') */
  provider?: string;

  /** Model being used */
  model?: string;

  /** Any error message */
  error?: string;
}

// ============================================================================
// Client Search Types
// ============================================================================

/**
 * Request to search for clients
 */
export interface SearchClientRequest {
  /** Search term */
  searchTerm: string;

  /** Maximum results to return */
  limit?: number;
}

/**
 * Response from client search
 */
export interface SearchClientResponse {
  /** Array of matching clients */
  clients: ClientSearchResult[];

  /** Total count of matches */
  totalCount?: number;
}

// ============================================================================
