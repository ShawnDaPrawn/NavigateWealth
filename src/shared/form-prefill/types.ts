/**
 * Shared types for the Form Prefill Tool (Phase 1 + Phase 2).
 */

export type FormPrefillId =
  | 'retirement-fna-step1'
  | 'risk-fna-step1'
  | 'medical-fna-step1'
  | 'tax-fna-step1'
  | 'estate-fna-step1'
  | 'investment-ina-step1';

export type PrefillDataSource =
  | 'profile'
  | 'client_keys'
  | 'policies'
  | 'intake'
  | 'fna_draft'
  | 'derived'
  | 'template';

export type PrefillConfidence = 'exact' | 'derived' | 'alias';

export interface FormFieldMapping {
  formField: string;
  label: string;
  /** Canonical Key Manager id or transform id */
  canonicalKey: string;
  group?: string;
}

export interface PrefillMatch {
  formField: string;
  label: string;
  proposedValue: unknown;
  canonicalKey: string;
  source: PrefillDataSource;
  confidence: PrefillConfidence;
  currentFormValue?: unknown;
  conflict: boolean;
  sourceDetail?: string;
}

export interface PrefillResolveRequest {
  clientId: string;
  formId: FormPrefillId;
  currentFormValues?: Record<string, unknown>;
  options?: {
    includePolicies?: boolean;
    includeClientKeys?: boolean;
    intakeInputs?: Record<string, unknown>;
  };
}

export interface PrefillResolveResponse {
  formId: FormPrefillId;
  clientId: string;
  matches: PrefillMatch[];
  unmatchedFormFields: string[];
  proposedValues: Record<string, unknown>;
  resolverVersion: string;
}

export interface TemplatePrefillResolveResponse {
  templateId: string;
  clientId: string;
  matches: PrefillMatch[];
  unmatchedFormFields: string[];
  resolverVersion: string;
}

export interface PrefillApplyAuditRequest {
  clientId: string;
  formId: FormPrefillId;
  appliedFields: string[];
  resolverVersion: string;
}

export interface FormTemplateRecord {
  id: string;
  name: string;
  description?: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  status: 'draft' | 'ready';
  fields: FormTemplateField[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface FormTemplateField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'checkbox' | 'unknown';
  canonicalKey?: string;
  page?: number;
}

export const PREFILL_RESOLVER_VERSION = '1.0.0';
