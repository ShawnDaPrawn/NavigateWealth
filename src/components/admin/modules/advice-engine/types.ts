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
 * Frozen client context used by RoA drafts.
 *
 * This is intentionally broader than the lightweight Client search result:
 * the RoA compiler needs the same client/adviser snapshot later even if the
 * live profile changes after advice was given.
 */
export interface RoAClientSnapshot {
  clientId: string;
  displayName: string;
  personalInformation: Record<string, unknown>;
  contactInformation: Record<string, unknown>;
  employmentInformation: Record<string, unknown>;
  financialInformation: Record<string, unknown>;
  familyMembers: unknown[];
  assets: unknown[];
  liabilities: unknown[];
  riskProfile: unknown | null;
  clientKeys: Record<string, unknown> | null;
  policies: unknown[];
  profile: Record<string, unknown> | null;
  capturedAt: string;
}

export interface RoAAdviserSnapshot {
  adviserId: string;
  displayName: string;
  email: string;
  role: string;
  jobTitle?: string;
  fspReference?: string;
  fscaStatus?: string;
  capturedAt: string;
}

export interface RoAClientContext {
  clientSnapshot: RoAClientSnapshot;
  adviserSnapshot: RoAAdviserSnapshot;
  fnaSummaries: Record<string, { count: number; latestUpdatedAt?: string }>;
  dataQuality: {
    missing: string[];
    warnings: string[];
    completenessScore: number;
  };
  sourceMap: Record<string, string>;
}

export type RoAContractStatus = 'draft' | 'active' | 'archived';

export type RoAContractFieldType =
  | RoAFieldType
  | 'currency'
  | 'percentage'
  | 'file';

export type RoAContractSourceType =
  | 'clientSnapshot'
  | 'adviserSnapshot'
  | 'policyRegister'
  | 'fna'
  | 'moduleInput'
  | 'documentUpload'
  | 'calculated'
  | 'manual';

export interface RoAModuleContract {
  id: string;
  title: string;
  description: string;
  category: string;
  status: RoAContractStatus;
  version: number;
  schemaVersion: string;
  input: {
    sources: Array<{
      id: string;
      label: string;
      type: RoAContractSourceType;
      required: boolean;
      sourcePath?: string;
      description?: string;
    }>;
    gatheringMethods: Array<'typed' | 'upload' | 'clientProfile' | 'policyRegister' | 'fna' | 'calculated'>;
  };
  formSchema: {
    sections: Array<{
      id: string;
      title: string;
      description?: string;
      fields: Array<{
        key: string;
        label: string;
        type: RoAContractFieldType;
        required?: boolean;
        source: RoAContractSourceType;
        sourcePath?: string;
        options?: string[];
        default?: string | number | boolean;
        placeholder?: string;
        helpText?: string;
        validation?: {
          minLength?: number;
          maxLength?: number;
          min?: number;
          max?: number;
          pattern?: string;
        };
      }>;
    }>;
  };
  output: {
    normalizedKey: string;
    fields: Array<{
      key: string;
      label: string;
      type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';
      required: boolean;
      description?: string;
    }>;
  };
  validation: {
    requiredFields: string[];
    rules: Array<{
      id: string;
      severity: 'blocking' | 'warning';
      message: string;
      fieldKeys?: string[];
    }>;
  };
  evidence: {
    requirements: Array<{
      id: string;
      label: string;
      type: 'quote' | 'policy_schedule' | 'comparison' | 'application' | 'fna' | 'client_instruction' | 'other';
      required: boolean;
      acceptedMimeTypes?: string[];
      guidance?: string;
    }>;
  };
  documentSections: Array<{
    id: string;
    title: string;
    purpose: string;
    order: number;
    required: boolean;
    template: string;
  }>;
  disclosures: string[];
  compileOrder: string[];
  compilerHints?: {
    includeReplacementAnalysis?: boolean;
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  publishedAt?: string;
}

export interface RoAModuleContractSchemaFormat {
  schemaVersion: string;
  allowedFieldTypes: RoAContractFieldType[];
  allowedSourceTypes: RoAContractSourceType[];
  allowedGatheringMethods: RoAModuleContract['input']['gatheringMethods'];
  allowedEvidenceTypes: RoAModuleContract['evidence']['requirements'][number]['type'][];
  allowedValidationSeverities: RoAModuleContract['validation']['rules'][number]['severity'][];
  requiredContractKeys: string[];
  requiredFieldKeys: string[];
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

export interface RoAEvidenceItem {
  id: string;
  requirementId: string;
  moduleId?: string;
  label: string;
  type: string;
  fileName: string;
  mimeType?: string;
  size?: number;
  storagePath?: string;
  sha256?: string;
  source?: string;
  uploadedBy?: string;
  uploadedAt: string;
}

export interface RoAValidationIssue {
  id: string;
  moduleId?: string;
  moduleTitle?: string;
  severity: 'blocking' | 'warning';
  message: string;
  fieldKeys?: string[];
  requirementId?: string;
}

export interface RoAValidationResult {
  valid: boolean;
  blocking: RoAValidationIssue[];
  warnings: RoAValidationIssue[];
  checkedAt: string;
}

export interface RoACompiledSection {
  id: string;
  title: string;
  content: string;
}

export interface RoACompiledModule {
  moduleId: string;
  title: string;
  category: string;
  contractVersion: number;
  contractSchemaVersion?: string;
  normalizedKey?: string;
  summary: string;
  outputValues: Array<{ label: string; value: string }>;
  evidence: Array<{ id?: string; label: string; fileName: string; type: string; source?: string; sha256?: string; uploadedAt?: string }>;
  sections: RoACompiledSection[];
  disclosures: string[];
  compilerHints?: RoAModuleContract['compilerHints'];
}

export interface RoARecommendationSummary {
  moduleId: string;
  title: string;
  category: string;
  summary: string;
  outputValues: Array<{ label: string; value: string }>;
}

export interface RoACompiledOutput {
  id: string;
  draftId: string;
  version: number;
  status: 'draft' | 'final';
  generatedAt: string;
  documentControl: Record<string, unknown>;
  client: RoAClientSnapshot | null;
  adviser: RoAAdviserSnapshot | null;
  scopeAndPurpose: string;
  synopsis: string;
  clientProfileSummary: RoACompiledSection[];
  informationReliedUpon: string[];
  needsAndObjectives: string[];
  recommendationSummary: RoARecommendationSummary[];
  modules: RoACompiledModule[];
  replacementAnalysis: RoACompiledSection[];
  feesCostsConflicts: string[];
  risksAndDisclosures: string[];
  implementationPlan: string[];
  acknowledgements: string[];
  appendices: string[];
  documentSections: RoACompiledSection[];
  html: string;
  hash?: string;
}

export interface RoAGeneratedDocument {
  id: string;
  draftId: string;
  compilationId: string;
  format: 'pdf' | 'docx';
  documentStatus: 'draft' | 'final';
  fileName: string;
  contentType: string;
  storagePath: string;
  sha256: string;
  compilationHash?: string;
  generatedAt: string;
  generatedBy: string;
  moduleContractVersions: Record<string, number>;
  lockedAt?: string;
  finalisedAt?: string;
  downloadBase64?: string;
}

export interface RoAAuditEvent {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
  createdBy: string;
  details?: Record<string, unknown>;
}

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

  /** Contract-normalized module outputs generated by the generic runtime */
  moduleOutputs?: Record<string, Record<string, unknown>>;

  /** Evidence metadata grouped by module and evidence requirement */
  moduleEvidence?: Record<string, Record<string, RoAEvidenceItem>>;

  /** Latest validation result produced by the generic RoA validator */
  validationResults?: RoAValidationResult;

  /** Latest compiled canonical output */
  compiledOutput?: RoACompiledOutput;

  /** Generated document metadata */
  generatedDocuments?: RoAGeneratedDocument[];

  /** Auditable actions performed during the RoA lifecycle */
  auditEvents?: RoAAuditEvent[];
  
  /** Draft status */
  status: RoAStatus;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last update timestamp */
  updatedAt: Date;
  
  /** Version number */
  version: number;

  /** Backend owner / audit fields */
  createdBy?: string;
  updatedBy?: string;
  adviserId?: string;

  /** Frozen profile/adviser context captured for the RoA */
  clientSnapshot?: RoAClientSnapshot;
  adviserSnapshot?: RoAAdviserSnapshot;
  contextCapturedAt?: string;
  finalisedAt?: string;
  finalisedBy?: string;
  lockedAt?: string;
}

/**
 * RoA module definition
 */
export interface RoAModule {
  /** Unique module ID */
  id: string;

  /** Source contract version used to derive this runtime module */
  contractVersion?: number;

  /** Contract schema version at fetch time */
  schemaVersion?: string;

  /** Optional publisher metadata from the module contract */
  metadata?: Record<string, unknown>;

  /** Module title */
  title: string;
  
  /** Module description */
  description: string;
  
  /** Icon component (optional) */
  icon?: LucideIcon;
  
  /** Form fields for this module */
  fields: RoAField[];

  /** Contract-defined input sources and gathering methods */
  input?: RoAModuleContract['input'];

  /** Contract-defined form sections used by the generic runtime */
  formSchema?: RoAModuleContract['formSchema'];
  
  /** Disclosure text for this module */
  disclosures: string[];
  
  /** Order of fields in compiled output */
  compileOrder: string[];

  /** Contract-driven evidence requirements */
  evidence?: RoAModuleContract['evidence'];

  /** Contract-driven validation rules */
  validation?: RoAModuleContract['validation'];

  /** Contract-driven document sections and templates */
  documentSections?: RoAModuleContract['documentSections'];

  /** Contract-driven normalized output description */
  output?: RoAModuleContract['output'];
  
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
  | 'date'
  | 'currency'
  | 'percentage'
  | 'file';

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

  /** Contract-defined source used to prefill or evidence the field */
  source?: RoAContractSourceType;

  /** Optional source path, for example clientSnapshot.policies */
  sourcePath?: string;
  
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
 * Lightweight form validation result used by legacy local utilities.
 */
export interface RoAFormValidationResult {
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

export type {
  // Re-export all types for convenience
};
