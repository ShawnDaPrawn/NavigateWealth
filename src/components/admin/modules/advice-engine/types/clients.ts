/**
 * Clients as the advice engine sees them.
 *
 * One slice of what used to be the single 1,287-line advice-engine `types.ts`;
 * that file remains the barrel every consumer imports from.
 */
import { type RoAAuthoringMode, type RoAModuleConversationConfig } from './conversation';
import { type RoAFieldType } from './roa';

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

export type RoAContractFieldType = RoAFieldType | 'currency' | 'percentage' | 'file';

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
  /** How advisers complete this module. Defaults to 'conversation'. */
  authoringMode?: RoAAuthoringMode;
  /** AI conversation configuration, used when authoringMode === 'conversation'. */
  conversation?: RoAModuleConversationConfig;
  input: {
    sources: Array<{
      id: string;
      label: string;
      type: RoAContractSourceType;
      required: boolean;
      sourcePath?: string;
      description?: string;
    }>;
    gatheringMethods: Array<
      'typed' | 'upload' | 'clientProfile' | 'policyRegister' | 'fna' | 'calculated'
    >;
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

// ============================================================================
