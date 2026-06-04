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

export interface RoAModuleContract {
  id: string;
  title: string;
  description: string;
  category: string;
  status: RoAContractStatus;
  version: number;
  schemaVersion: string;
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
