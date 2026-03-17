/**
 * Advice Engine Module - Type Definitions
 * 
 * Comprehensive type system for the AI-powered advice engine.
 * Covers:
 * - Message and conversation types
 * - Client search and selection
 * - AI chat interactions
 * - Record of Advice (RoA) drafting
 * - API requests and responses
 * 
 * @module advice-engine/types
 */

import type { LucideIcon } from 'lucide-react';

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
// Client Types
// ============================================================================

/**
 * Client information
 *
 * WORKAROUND: The advice-engine backend returns snake_case fields
 * (user_id, first_name, last_name). This interface mirrors that shape
 * directly. It intentionally does NOT extend BaseClient because the
 * field names differ. The api.ts layer should normalise to BaseClient
 * if cross-module consumption is needed. See BaseClient in
 * /shared/types/client.ts for the canonical shape.
 */
export interface Client {
  /** Unique client ID */
  user_id: string;
  
  /** First name */
  first_name: string;
  
  /** Last name */
  last_name: string;
  
  /** Email address */
  email: string;
  
  /** Phone number (optional) */
  phone?: string;
  
  /** ID number or date of birth (optional) */
  id_number?: string;
  
  /** Date of birth (optional) */
  date_of_birth?: string;
}

/**
 * Personnel/Advisor information
 */
export interface Personnel {
  id: string;
  name: string;
  role: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

/**
 * Client search result with additional metadata
 */
export interface ClientSearchResult extends Client {
  /** Match score (0-1) */
  matchScore?: number;
  
  /** Highlighted fields */
  highlights?: {
    field: keyof Client;
    snippet: string;
  }[];
}

// ============================================================================
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
// Record of Advice (RoA) Types
// ============================================================================

/**
 * Super Switch Module Data
 */
export interface RoASuperSwitchData {
  currentProduct?: {
    name: string;
    fee: number;
    performance?: number;
    features?: string[];
  };
  proposedProduct?: {
    name: string;
    fee: number;
    performance?: number;
    features?: string[];
  };
  comparison?: {
    feeSaving?: number;
    netBenefit?: number;
  };
  rationale?: string;
}

/**
 * Insurance Review Module Data
 */
export interface RoAInsuranceReviewData {
  currentPolicies?: Array<{
    type: string;
    insurer: string;
    premium: number;
    cover: number;
  }>;
  proposedPolicies?: Array<{
    type: string;
    insurer: string;
    premium: number;
    cover: number;
  }>;
  analysis?: string;
}

/**
 * Union type for all possible module data
 */
export type RoAModuleData = 
  | RoASuperSwitchData 
  | RoAInsuranceReviewData 
  | Record<string, unknown>;

/**
 * RoA draft status
 */
export type RoAStatus = 'draft' | 'complete' | 'submitted' | 'archived';

/**
 * RoA draft data
 */
export interface RoADraft {
  /** Unique draft ID */
  id: string;
  
  /** Client ID (if selected) */
  clientId?: string;
  
  /** Client data (if entered manually) */
  clientData?: {
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    idOrDob: string;
    advisorId: string;
  };
  
  /** Selected module IDs */
  selectedModules: string[];
  
  /** Module-specific data */
  moduleData: Record<string, RoAModuleData>;
  
  /** Draft status */
  status: RoAStatus;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last update timestamp */
  updatedAt: Date;
  
  /** Version number */
  version: number;
}

/**
 * RoA module definition
 */
export interface RoAModule {
  /** Unique module ID */
  id: string;
  
  /** Module title */
  title: string;
  
  /** Module description */
  description: string;
  
  /** Icon component (optional) */
  icon?: LucideIcon;
  
  /** Form fields for this module */
  fields: RoAField[];
  
  /** Disclosure text for this module */
  disclosures: string[];
  
  /** Order of fields in compiled output */
  compileOrder: string[];
  
  /** Category (optional) */
  category?: string;
}

/**
 * Field types for RoA forms
 */
export type RoAFieldType = 
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'chips'
  | 'checkbox'
  | 'radio'
  | 'date';

/**
 * RoA form field definition
 */
export interface RoAField {
  /** Field key/name */
  key: string;
  
  /** Field label */
  label: string;
  
  /** Field type */
  type: RoAFieldType;
  
  /** Whether field is required */
  required?: boolean;
  
  /** Options for select/radio/chips */
  options?: string[];
  
  /** Default value */
  default?: string | number | boolean;
  
  /** Placeholder text */
  placeholder?: string;
  
  /** Help text */
  helpText?: string;
  
  /** Validation rules */
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
  };
}

/**
 * RoA form data (submitted values)
 */
export type RoAFormData = Record<string, RoAModuleData>;

/**
 * RoA validation result
 */
export interface RoAValidationResult {
  /** Whether validation passed */
  valid: boolean;
  
  /** Validation errors by field key */
  errors: Record<string, string>;
  
  /** Overall error message */
  message?: string;
}

// ============================================================================
// RoA Step Types
// ============================================================================

/**
 * RoA wizard step ID
 */
export type RoAStepId = 'start' | 'client' | 'modules' | 'details' | 'review';

/**
 * RoA wizard step definition
 */
export interface RoAStep {
  /** Step ID */
  id: RoAStepId;
  
  /** Step title */
  title: string;
  
  /** Step description */
  description: string;
  
  /** Icon component (optional) */
  icon?: LucideIcon;
  
  /** Whether step is completed */
  completed?: boolean;
}

// ============================================================================
// UI Component Props Types
// ============================================================================

/**
 * Chat message component props
 */
export interface ChatMessageProps {
  /** Message to display */
  message: Message;
  
  /** Optional onCopy callback */
  onCopy?: (content: string) => void;
  
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Chat input component props
 */
export interface ChatInputProps {
  /** Input value */
  value: string;
  
  /** On value change */
  onChange: (value: string) => void;
  
  /** On submit/send */
  onSubmit: () => void;
  
  /** Loading/sending state */
  isLoading?: boolean;
  
  /** Disabled state */
  disabled?: boolean;
  
  /** Placeholder text */
  placeholder?: string;
  
  /** Maximum character count */
  maxLength?: number;
}

/**
 * Chat history component props
 */
export interface ChatHistoryProps {
  /** Messages to display */
  messages: Message[];
  
  /** Loading state */
  isLoading?: boolean;
  
  /** Error message */
  error?: string | null;
  
  /** On message copy */
  onCopy?: (content: string) => void;
  
  /** Auto-scroll behavior */
  autoScroll?: boolean;
}

/**
 * Client selector component props
 */
export interface ClientSelectorProps {
  /** Search term */
  searchTerm: string;
  
  /** On search term change */
  onSearchChange: (term: string) => void;
  
  /** Search results */
  results: ClientSearchResult[];
  
  /** Searching state */
  isSearching?: boolean;
  
  /** Selected client */
  selectedClient: Client | null;
  
  /** On client select */
  onSelectClient: (client: Client | null) => void;
  
  /** Placeholder text */
  placeholder?: string;
  
  /** Minimal mode for header embedding */
  minimal?: boolean;
}

/**
 * API key warning component props
 */
export interface ApiKeyWarningProps {
  /** API key status */
  status: ApiKeyStatus | null;
  
  /** On dismiss callback */
  onDismiss?: () => void;
}

/**
 * Welcome message feature item
 */
export type WelcomeFeature = string | {
  icon: string | React.ReactNode;
  title: string;
  items: string[];
};

/**
 * Welcome message component props
 */
export interface WelcomeMessageProps {
  /** Custom content (optional) */
  content?: string;
  
  /** Features list (optional) */
  features?: WelcomeFeature[];
}

// ============================================================================
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
  saveDraft: (data: Partial<RoAFormData>) => Promise<void>;
  
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

export type {
  // Re-export all types for convenience
};