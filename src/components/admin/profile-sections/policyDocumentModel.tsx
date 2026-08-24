/**
 * Model of the policy document upload: document types, the extraction
 * result/diff/mapping shapes, and the small formatting helpers (the
 * confidence badge returns JSX, hence .tsx). Split out of
 * PolicyDocumentUpload.tsx.
 */
/**
 * POLICY DOCUMENT UPLOAD COMPONENT
 *
 * Allows attaching a single policy document (PDF) to a policy line item.
 * One-active-doc-per-policy: uploading a new file replaces the previous one.
 * Phase 2: AI-powered extraction with review panel and field application.
 * Field locking: fields can be locked to prevent AI extraction overwrite.
 *
 * Only available when editing an existing policy (needs a saved policy ID).
 */

import { Badge } from '../../ui/badge';

/** Document type options matching the server validation */

export const DOCUMENT_TYPES = [
  { value: 'policy_schedule', label: 'Policy Schedule' },
  { value: 'amendment', label: 'Amendment' },
  { value: 'statement', label: 'Statement' },
  { value: 'benefit_summary', label: 'Benefit Summary' },
  { value: 'other', label: 'Other' },
] as const;

/** Metadata shape matching the server's PolicyDocument interface */
export interface PolicyDocumentMeta {
  storageKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  provider: string;
  productType: string;
  documentType: string;
  uploadDate: string;
  uploadedBy: string;
}

/** Extraction result shape from the server */
export interface ExtractionResult {
  extractedData: ExtractedPolicyData | null;
  extractedAt: string;
  confidence: number;
  status: 'pending' | 'completed' | 'failed';
  errorMessage?: string;
  appliedAt?: string;
  appliedFields?: string[];
  model?: string;
  validationWarnings?: ValidationWarning[];
}

/** Validation warning from cross-field checks */
export interface ValidationWarning {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  relatedFields?: string[];
}

/** Field diff for change detection */
export interface FieldDiff {
  schemaFieldId: string;
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
  oldConfidence: number;
  newConfidence: number;
  changed: boolean;
}

export interface ExtractedField<T> {
  value: T;
  confidence: number;
  source?: string;
}

export interface ExtractedBenefit {
  canonicalType: ExtractedField<string>;
  providerTermName: ExtractedField<string>;
  coverAmount?: ExtractedField<number>;
  waitingPeriod?: ExtractedField<string>;
  expiryAge?: ExtractedField<number>;
}

export interface ExtractedPolicyData {
  policyNumber?: ExtractedField<string>;
  providerName?: ExtractedField<string>;
  productName?: ExtractedField<string>;
  policyOwner?: ExtractedField<string>;
  insuredLife?: ExtractedField<string>;
  policyStartDate?: ExtractedField<string>;
  policyStatus?: ExtractedField<string>;
  premiumAmount?: ExtractedField<number>;
  premiumFrequency?: ExtractedField<string>;
  benefits: ExtractedBenefit[];
  overallConfidence: number;
  aiSummary?: string;
}

/** Field mapping from server */
export interface FieldMappingEntry {
  canonicalKey: string;
  schemaFieldId: string;
  schemaFieldName: string;
  value: unknown;
  confidence: number;
  currentValue?: unknown;
  locked?: boolean;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDocType(type: string): string {
  const found = DOCUMENT_TYPES.find((d) => d.value === type);
  return found?.label || type;
}

export function getConfidenceBadge(confidence: number) {
  if (confidence >= 0.85) {
    return (
      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px] px-1.5 py-0">
        High
      </Badge>
    );
  }
  if (confidence >= 0.5) {
    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] px-1.5 py-0">
        Medium
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px] px-1.5 py-0">Low</Badge>
  );
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    return `R${value.toLocaleString('en-ZA')}`;
  }
  return String(value);
}

export function hasExtractedValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
}
