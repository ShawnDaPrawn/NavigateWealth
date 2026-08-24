/**
 * Hook options and returns, plus utility types.
 *
 * One slice of what used to be the single 1,287-line advice-engine `types.ts`;
 * that file remains the barrel every consumer imports from.
 */
import { type ApiKeyStatus } from './chat';
import { type Client } from './clients';
import { type ClientSearchResult } from './conversation';
import { type Message } from './messaging';
import { type RoADraft, type RoAModule } from './roa';

// Hook Options and Return Types
// ============================================================================

/**
 * Options for useAIChat hook
 */
export interface UseAIChatOptions {
  /** Initial messages */
  initialMessages?: Message[];

  /** Auto-load history */
  autoLoadHistory?: boolean;

  /** Default client ID */
  defaultClientId?: string;

  /** Maximum conversation history length */
  maxHistoryLength?: number;
}

/**
 * Return type for useAIChat hook
 */
export interface UseAIChatReturn {
  /** Current messages */
  messages: Message[];

  /** Loading/sending state */
  isLoading: boolean;

  /** Error message */
  error: string | null;

  /** Send a message */
  sendMessage: (content: string, clientId?: string) => Promise<void>;

  /** Clear chat history */
  clearChat: () => Promise<void>;

  /** API key status */
  apiKeyStatus: ApiKeyStatus | null;

  /** Whether API key is configured */
  isConfigured: boolean;
}

/**
 * Return type for useClientSearch hook
 */
export interface UseClientSearchReturn {
  /** Current search term */
  searchTerm: string;

  /** Set search term */
  setSearchTerm: (term: string) => void;

  /** Search results */
  results: ClientSearchResult[];

  /** Searching state */
  isSearching: boolean;

  /** Selected client */
  selectedClient: Client | null;

  /** Select a client */
  selectClient: (client: Client | null) => void;

  /** Clear selection */
  clearSelection: () => void;
}

/**
 * Return type for useChatHistory hook
 */
export interface UseChatHistoryReturn {
  /** Historical messages */
  history: Message[];

  /** Loading state */
  isLoading: boolean;

  /** Error message */
  error: string | null;

  /** Load history from server */
  loadHistory: () => Promise<void>;

  /** Clear history */
  clearHistory: () => Promise<void>;

  /** Whether history has been loaded */
  hasLoaded: boolean;
}

/**
 * Options for useRoADraft hook
 */
export interface UseRoADraftOptions {
  /** Draft ID to load */
  draftId?: string;

  /** Auto-save enabled */
  autoSave?: boolean;

  /** Auto-save delay in ms */
  autoSaveDelay?: number;
}

/**
 * Return type for useRoADraft hook
 */
export interface UseRoADraftReturn {
  /** Current draft */
  draft: RoADraft | null;

  /** Loading state */
  isLoading: boolean;

  /** Saving state */
  isSaving: boolean;

  /** Error message */
  error: string | null;

  /** Save draft */
  saveDraft: (data: Partial<RoADraft>) => Promise<void>;

  /** Submit draft */
  submitDraft: () => Promise<void>;

  /** Available modules */
  modules: RoAModule[];

  /** Update draft data */
  updateDraft: (updates: Partial<RoADraft>) => void;

  /** Create new draft */
  createNewDraft: () => void;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Generic error type
 */
export interface AdviceEngineError {
  /** Error message */
  message: string;

  /** Error code */
  code?: string;

  /** HTTP status code */
  statusCode?: number;

  /** Additional details */
  details?: unknown;
}

/**
 * Generic success response
 */
export interface SuccessResponse<T = void> {
  /** Success flag */
  success: true;

  /** Response data */
  data: T;

  /** Optional message */
  message?: string;
}

/**
 * Generic error response
 */
export interface ErrorResponse {
  /** Success flag */
  success: false;

  /** Error message */
  error: string;

  /** Error details */
  details?: unknown;
}

// ============================================================================
// Exports
// ============================================================================

export // Re-export all types for convenience
 type {};
