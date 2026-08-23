/**
 * The message system.
 *
 * One slice of what used to be the single 1,287-line advice-engine `types.ts`;
 * that file remains the barrel every consumer imports from.
 */

// ============================================================================
// Message System Types
// ============================================================================

/**
 * Message role in a conversation
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Single message in a conversation
 */
export interface Message {
  /** Message role (user, assistant, or system) */
  role: MessageRole;

  /** Message content (text) */
  content: string;

  /** When the message was sent */
  timestamp: Date;

  /** Optional client ID if message is client-specific */
  clientId?: string;

  /** Optional metadata */
  metadata?: {
    /** Token count for AI responses */
    tokens?: number;

    /** Model used for AI responses */
    model?: string;

    /** Processing time in ms */
    processingTime?: number;
  };
}

/**
 * Conversation history for context
 */
export interface ConversationHistory {
  /** Array of messages in chronological order */
  messages: Array<{
    role: MessageRole;
    content: string;
  }>;
}

// ============================================================================
