/**
 * Core integration types (Phase 5 decomposition).
 * ================================================
 *
 * Extracted verbatim from integrations.tsx — config, field bindings, upload
 * history, provider, and sync-run shapes shared across the integrations
 * routes/helpers and (future) sub-routers. Pure type declarations (erased at
 * runtime) — moving them changes no behaviour.
 */
import type { IntegrationBlankBehavior } from '../../../shared/integrations/binding-utils.ts';

export interface IntegrationFieldBinding {
  targetFieldId: string;
  targetFieldName?: string;
  columnName: string;
  required?: boolean;
  fieldType?: string;
  portalLabels?: string[];
  portalSelector?: string;
  blankBehavior?: IntegrationBlankBehavior;
  transform?: 'trim' | 'number' | 'date' | string;
}

export interface IntegrationConfig {
  providerId: string;
  categoryId: string;
  updatedAt: string;
  updatedBy: string;
  fieldMapping: Record<string, string>;
  fieldBindings?: IntegrationFieldBinding[];
  settings: {
    autoMap: boolean;
    ignoreUnmatched: boolean;
    strictMode: boolean;
    autoPublish?: boolean;
  };
}

export interface UploadHistory {
  id: string;
  providerId: string;
  categoryId: string;
  fileName: string;
  status: 'success' | 'failed';
  rowCount: number;
  errorCount: number;
  uploadedAt: string;
  errors?: string[];
  runId?: string;
  publishedRows?: number;
}

export interface IntegrationProvider {
  id: string;
  name: string;
  description?: string;
  categoryIds: string[];
  logoUrl?: string;
  lastAttempted?: string;
  lastUpdateStatus?: 'success' | 'failed' | 'never';
  lastSuccessful?: string;
}

export type SyncMatchStatus = 'matched' | 'unmatched' | 'duplicate' | 'invalid';
export type SyncPublishStatus =
  | 'pending'
  | 'auto_eligible'
  | 'held'
  | 'published'
  | 'skipped'
  | 'failed';
export type SyncRunStatus = 'staged' | 'published' | 'partially_published' | 'failed';

export interface SyncDiff {
  fieldId: string;
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface IntegrationSyncRow {
  id: string;
  rowNumber: number;
  rawData: Record<string, unknown>;
  mappedData: Record<string, unknown>;
  policyNumber: string;
  normalizedPolicyNumber: string;
  matchMethod: 'template_metadata' | 'policy_number' | 'none';
  matchStatus: SyncMatchStatus;
  publishStatus: SyncPublishStatus;
  autoPublishEligible: boolean;
  validationErrors: string[];
  validationErrorFieldIds?: string[];
  warnings: string[];
  warningFieldIds?: string[];
  diffs: SyncDiff[];
  clientId?: string;
  policyId?: string;
  providerName?: string;
}

export interface IntegrationSyncRun {
  id: string;
  providerId: string;
  providerName: string;
  categoryId: string;
  fileName: string;
  source: 'spreadsheet' | 'portal';
  status: SyncRunStatus;
  createdAt: string;
  updatedAt: string;
  mappingVersion: string;
  autoPublish: boolean;
  summary: {
    totalRows: number;
    matchedRows: number;
    unmatchedRows: number;
    duplicateRows: number;
    invalidRows: number;
    changedRows: number;
    noChangeRows: number;
    autoEligibleRows: number;
    publishedRows: number;
    heldRows: number;
  };
  rows: IntegrationSyncRow[];
}
