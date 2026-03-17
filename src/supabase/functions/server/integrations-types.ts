/**
 * Integration Domain Types (Server-Side)
 *
 * KV-persisted entity shapes for policies, schemas, providers,
 * and related structures used by integrations.tsx.
 *
 * @module integrations-types
 */

import type { ExtractionResult, ExtractionHistoryEntry, FieldMappingSnapshot } from './policy-extraction-types.ts';

// ---------------------------------------------------------------------------
// Policy Entity (stored in KV as `policies:client:{clientId}` — array)
// ---------------------------------------------------------------------------

/** Metadata for a policy document attached to a policy line item */
export interface PolicyDocument {
  /** Supabase Storage path (relative to bucket) */
  storageKey: string;
  /** Original file name */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** MIME type */
  mimeType: string;
  /** Provider name (denormalised for display) */
  provider: string;
  /** Product category label */
  productType: string;
  /** Document classification */
  documentType: 'policy_schedule' | 'amendment' | 'statement' | 'benefit_summary' | 'other';
  /** ISO timestamp of upload */
  uploadDate: string;
  /** Admin user ID who uploaded */
  uploadedBy: string;
}

export interface KvPolicy {
  id: string;
  clientId: string;
  categoryId: string;
  providerId: string;
  providerName: string;
  /** Field-level data keyed by schema field ID */
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  archivedReason?: string;
  archivedAt?: string;
  /** Attached policy document (one active document per policy) */
  document?: PolicyDocument;
  /** AI extraction result from the attached document */
  extraction?: ExtractionResult;
  /** Chronological history of all extraction attempts */
  extractionHistory?: ExtractionHistoryEntry[];
  /** Compact snapshot of the most recent field mappings (for history comparison) */
  lastFieldMappingsSnapshot?: FieldMappingSnapshot[];
  /** Schema field IDs that are locked from AI extraction overwrite */
  lockedFields?: string[];
}

// ---------------------------------------------------------------------------
// Schema / Field Definitions (stored in KV as `config:schema:{categoryId}`)
// ---------------------------------------------------------------------------

export interface SchemaField {
  id: string;
  name: string;
  type?: string;
  keyId?: string;
  required?: boolean;
  [key: string]: unknown;
}

export interface KvSchema {
  categoryId: string;
  fields: SchemaField[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Provider (stored in KV as `provider:{id}`)
// ---------------------------------------------------------------------------

export interface KvProvider {
  id: string;
  name: string;
  description?: string;
  categoryIds?: string[];
  logoUrl?: string;
  lastAttempted?: string;
  lastUpdateStatus?: 'success' | 'failed' | 'never';
  lastSuccessful?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Custom Key (stored in KV as `config:custom_keys:{categoryId}` — array)
// ---------------------------------------------------------------------------

export interface CustomKey {
  id: string;
  category: string;
  name: string;
  description: string;
  dataType: string;
  isCustom: boolean;
  sourceField?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// FNA-like entries used in dashboard stats
// ---------------------------------------------------------------------------

export interface KvFnaEntry {
  status?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Renewal info derived from policies
// ---------------------------------------------------------------------------

export interface PolicyRenewal {
  clientId: string;
  policyId: string;
  providerName: string;
  categoryId: string;
  categoryLabel: string;
  policyNumber: string;
  inceptionDate: string;
  inceptionFieldName: string;
}