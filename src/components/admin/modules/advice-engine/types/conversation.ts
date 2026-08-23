/**
 * RoA module conversations (AI authoring mode).
 *
 * One slice of what used to be the single 1,287-line advice-engine `types.ts`;
 * that file remains the barrel every consumer imports from.
 */
import {
  type Client,
  type RoAContractFieldType,
  type RoAContractSourceType,
  type RoAModuleContract,
} from './clients';

// RoA Module Conversation Types (AI authoring mode)
// ============================================================================

/**
 * Authoring mode for a module contract / draft.
 * - `form`: legacy form-based details capture
 * - `conversation`: AI conversation-based capture (default)
 */
export type RoAAuthoringMode = 'form' | 'conversation';

/**
 * Status of a single module conversation.
 */
export type RoAModuleConversationStatus = 'pending' | 'in_progress' | 'complete';

/**
 * Reference to a file uploaded during a module conversation.
 */
export interface RoAConvUploadRef {
  id: string;
  evidenceId?: string;
  fileName: string;
  mimeType?: string;
  size?: number;
  storagePath?: string;
  visionEligible?: boolean;
  uploadedAt: string;
}

/**
 * A single message inside a module conversation transcript.
 */
export interface RoAConvMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: RoAConvUploadRef[];
  createdAt: string;
}

/**
 * Narrative produced from a module conversation, used by the compiler.
 */
export interface RoAModuleNarrative {
  moduleId: string;
  sections: { id: string; title: string; markdown: string }[];
  generatedAt: string;
  editedAt?: string;
  editedBy?: string;
}

/**
 * Full conversation record persisted for a module within a draft.
 */
export interface RoAModuleConversationRecord {
  draftId: string;
  moduleId: string;
  status: RoAModuleConversationStatus;
  messages: RoAConvMessage[];
  uploads: RoAConvUploadRef[];
  narrative?: RoAModuleNarrative;
  updatedAt: string;
}

/**
 * Lightweight conversation progress across the draft's modules.
 */
export interface RoAConversationProgress {
  modules: { moduleId: string; title: string; status: RoAModuleConversationStatus }[];
  allComplete: boolean;
}

/**
 * Contract-defined narrative section produced by a module conversation.
 */
export interface RoAConversationNarrativeSection {
  id: string;
  title: string;
  description: string;
  required: boolean;
  order: number;
}

/**
 * Contract-defined upload requirement for a module conversation.
 */
export interface RoAConversationUpload {
  id: string;
  label: string;
  required: boolean;
  acceptedMimeTypes?: string[];
  guidance?: string;
  visionEligible?: boolean;
}

/**
 * Contract-defined completion behaviour for a module conversation.
 */
export interface RoAConversationCompletion {
  mode: 'ai-signal' | 'manual';
  minTurns?: number;
  requireAllUploads?: boolean;
}

/**
 * Conversation configuration block on a module contract.
 */
export interface RoAModuleConversationConfig {
  instructions: string;
  openingMessage?: string;
  narrativeSections: RoAConversationNarrativeSection[];
  uploads: RoAConversationUpload[];
  completion: RoAConversationCompletion;
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
