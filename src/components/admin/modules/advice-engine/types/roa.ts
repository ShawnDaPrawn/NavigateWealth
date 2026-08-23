/**
 * The Record of Advice: contract, sections, steps.
 *
 * One slice of what used to be the single 1,287-line advice-engine `types.ts`;
 * that file remains the barrel every consumer imports from.
 */
import type { LucideIcon } from 'lucide-react';
import {
  type RoAAdviserSnapshot,
  type RoAClientSnapshot,
  type RoAContractSourceType,
  type RoAModuleContract,
} from './clients';
import {
  type RoAAuthoringMode,
  type RoAModuleConversationConfig,
  type RoAModuleConversationStatus,
  type RoAModuleNarrative,
} from './conversation';

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
export type RoAModuleData = RoASuperSwitchData | RoAInsuranceReviewData | Record<string, unknown>;

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
  evidence: Array<{
    id?: string;
    label: string;
    fileName: string;
    type: string;
    source?: string;
    sha256?: string;
    uploadedAt?: string;
  }>;
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

  /** How this draft is authored (form vs conversation). */
  authoringMode?: RoAAuthoringMode;

  /** Conversation completion status keyed by module ID. */
  moduleConversationStatus?: Record<string, RoAModuleConversationStatus>;

  /** Generated narratives keyed by module ID. */
  moduleNarratives?: Record<string, RoAModuleNarrative>;

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

  /** How advisers complete this module (form vs conversation). */
  authoringMode?: RoAAuthoringMode;

  /** AI conversation configuration when authoringMode === 'conversation'. */
  conversation?: RoAModuleConversationConfig;

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
