/**
 * Record of Advice module contract definitions.
 *
 * These contracts are system configuration: super admins can edit them later,
 * while advisers consume only the active version through the RoA wizard.
 */

type JsonRecord = Record<string, unknown>;

export type RoAContractStatus = 'draft' | 'active' | 'archived';

export type RoAContractFieldType =
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

export type RoAContractSourceType =
  | 'clientSnapshot'
  | 'adviserSnapshot'
  | 'policyRegister'
  | 'fna'
  | 'moduleInput'
  | 'documentUpload'
  | 'calculated'
  | 'manual';

export interface RoAContractInputSource {
  id: string;
  label: string;
  type: RoAContractSourceType;
  required: boolean;
  sourcePath?: string;
  description?: string;
}

export interface RoAContractField {
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
}

export interface RoAContractFormSection {
  id: string;
  title: string;
  description?: string;
  fields: RoAContractField[];
}

export interface RoAContractOutputField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';
  required: boolean;
  description?: string;
}

export interface RoAContractValidationRule {
  id: string;
  severity: 'blocking' | 'warning';
  message: string;
  fieldKeys?: string[];
}

export interface RoAContractEvidenceRequirement {
  id: string;
  label: string;
  type:
    | 'quote'
    | 'policy_schedule'
    | 'comparison'
    | 'application'
    | 'fna'
    | 'client_instruction'
    | 'other';
  required: boolean;
  acceptedMimeTypes?: string[];
  guidance?: string;
}

export interface RoAContractDocumentSection {
  id: string;
  title: string;
  purpose: string;
  order: number;
  required: boolean;
  template?: string;
}

/**
 * How a module gathers its data. `form` is the legacy programmatic flow
 * (typed forms driven by `formSchema`); `conversation` is the AI-driven flow
 * where the adviser converses with the model per the contract's instructions
 * and the AI writes the narrative directly.
 */
export type RoAAuthoringMode = 'form' | 'conversation';

/** A canonical narrative section the AI must author as prose for the RoA. */
export interface RoANarrativeSection {
  id: string;
  title: string;
  /** Instruction to the AI describing what this section must contain. */
  description: string;
  required: boolean;
  order: number;
}

/** An upload the adviser may (or must) provide during a module conversation. */
export interface RoAConversationUpload {
  id: string;
  label: string;
  required: boolean;
  acceptedMimeTypes?: string[];
  guidance?: string;
  /** When true, image/PDF content is passed to the model for analysis. */
  visionEligible?: boolean;
}

/** How the system decides a module conversation is complete. */
export interface RoAConversationCompletion {
  mode: 'ai-signal' | 'manual';
  /** Guardrail: minimum adviser turns before the AI may signal completion. */
  minTurns?: number;
  /** Block completion until all required uploads are attached. */
  requireAllUploads?: boolean;
}

/**
 * The conversational authoring configuration for a module. Authored by a
 * super-admin in place of the form schema. Optional so legacy form contracts
 * remain valid.
 */
export interface RoAModuleConversation {
  /** Per-module system prompt / project instructions for the AI. */
  instructions: string;
  /** First assistant turn presented to the adviser. */
  openingMessage?: string;
  /** Canonical narrative sections the AI must produce as prose. */
  narrativeSections: RoANarrativeSection[];
  /** Documents/images the adviser may upload mid-conversation. */
  uploads: RoAConversationUpload[];
  completion: RoAConversationCompletion;
}

export interface RoAModuleContract {
  id: string;
  title: string;
  description: string;
  category: string;
  status: RoAContractStatus;
  version: number;
  schemaVersion: string;
  /**
   * How this module is completed. Absent ⇒ 'form' (legacy programmatic flow).
   * 'conversation' uses the `conversation` block and the AI-authored narrative.
   */
  authoringMode?: RoAAuthoringMode;
  /** Conversational authoring config (required when authoringMode === 'conversation'). */
  conversation?: RoAModuleConversation;
  input: {
    sources: RoAContractInputSource[];
    gatheringMethods: Array<
      'typed' | 'upload' | 'clientProfile' | 'policyRegister' | 'fna' | 'calculated'
    >;
  };
  formSchema: {
    sections: RoAContractFormSection[];
  };
  output: {
    normalizedKey: string;
    fields: RoAContractOutputField[];
  };
  validation: {
    requiredFields: string[];
    rules: RoAContractValidationRule[];
  };
  evidence: {
    requirements: RoAContractEvidenceRequirement[];
  };
  documentSections: RoAContractDocumentSection[];
  disclosures: string[];
  compileOrder: string[];
  /**
   * Optional compiler behaviour flags. Keeps canonical document assembly generic:
   * no title/keyword heuristics for module-specific sections.
   */
  compilerHints?: {
    /** Emit standard replacement-analysis wrapper sections in the canonical RoA shell. */
    includeReplacementAnalysis?: boolean;
  };
  metadata?: JsonRecord;
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
  allowedEvidenceTypes: RoAContractEvidenceRequirement['type'][];
  allowedValidationSeverities: RoAContractValidationRule['severity'][];
  allowedAuthoringModes: RoAAuthoringMode[];
  allowedCompletionModes: RoAConversationCompletion['mode'][];
  requiredContractKeys: string[];
  requiredFieldKeys: string[];
}

export interface LegacyRoAModule {
  id: string;
  title: string;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'select' | 'chips' | 'checkbox' | 'radio' | 'date';
    required?: boolean;
    options?: string[];
    default?: string | number | boolean;
    placeholder?: string;
    helpText?: string;
    validation?: {
      minLength?: number;
      maxLength?: number;
      min?: number;
      max?: number;
    };
  }>;
  disclosures: string[];
  compileOrder: string[];
  category?: string;
  evidence?: RoAModuleContract['evidence'];
  validation?: RoAModuleContract['validation'];
  documentSections?: RoAModuleContract['documentSections'];
  output?: RoAModuleContract['output'];
}

// ---- Phase 7 max-lines split: data + validation live in sibling modules ----
export {
  ROA_MODULE_CONTRACT_SCHEMA_FORMAT,
  DEFAULT_ROA_MODULE_CONTRACTS,
} from './advice-engine-roa-default-contracts.ts';
export {
  validateRoAModuleContract,
  contractToLegacyModule,
} from './advice-engine-roa-contract-validation.ts';
