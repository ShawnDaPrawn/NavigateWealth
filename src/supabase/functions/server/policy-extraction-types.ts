/**
 * Policy Extraction Types
 *
 * Canonical data model for AI-extracted policy data.
 * Acts as an intermediate translation layer between provider-specific
 * terminology and the internal Navigate Wealth taxonomy.
 *
 * @module policy-extraction-types
 */

// ---------------------------------------------------------------------------
// Per-Field Extraction Wrapper
// ---------------------------------------------------------------------------

/** Wraps every extracted field with confidence metadata */
export interface ExtractedField<T> {
  /** The extracted value */
  value: T;
  /** Confidence score 0.0–1.0 */
  confidence: number;
  /** Where in the document the value was found (page/section hint) */
  source?: string;
}

// ---------------------------------------------------------------------------
// Canonical Benefit Structure
// ---------------------------------------------------------------------------

export interface ExtractedBenefit {
  /** Canonical benefit type mapped to internal keys (e.g. 'risk_life_cover') */
  canonicalType: ExtractedField<string>;
  /** The benefit name as it appears on the provider's document */
  providerTermName: ExtractedField<string>;
  /** Cover amount in ZAR */
  coverAmount?: ExtractedField<number>;
  /** Waiting period (e.g. '7 days', '90 days', '2 years') */
  waitingPeriod?: ExtractedField<string>;
  /** Expiry age if applicable */
  expiryAge?: ExtractedField<number>;
}

// ---------------------------------------------------------------------------
// Canonical Extracted Policy Data
// ---------------------------------------------------------------------------

export interface ExtractedPolicyData {
  /** Policy number / reference */
  policyNumber?: ExtractedField<string>;
  /** Provider / insurer name as printed on the document */
  providerName?: ExtractedField<string>;
  /** Product name as printed on the document */
  productName?: ExtractedField<string>;
  /** Policy owner / policyholder name */
  policyOwner?: ExtractedField<string>;
  /** Insured life / lives covered */
  insuredLife?: ExtractedField<string>;
  /** Policy commencement / inception date (ISO string) */
  policyStartDate?: ExtractedField<string>;
  /** Current policy status */
  policyStatus?: ExtractedField<string>;
  /** Premium amount in ZAR */
  premiumAmount?: ExtractedField<number>;
  /** Premium frequency */
  premiumFrequency?: ExtractedField<string>;
  /** Individual benefits extracted from the document */
  benefits: ExtractedBenefit[];
  /** Overall document confidence (average across all fields) */
  overallConfidence: number;
  /** Raw text summary from the AI for human review */
  aiSummary?: string;
}

// ---------------------------------------------------------------------------
// Extraction Result (stored on KvPolicy)
// ---------------------------------------------------------------------------

export type ExtractionStatus = 'pending' | 'completed' | 'failed';

/** A cross-field validation warning generated after extraction */
export interface ValidationWarning {
  /** Severity: 'error' = likely wrong, 'warning' = worth checking, 'info' = FYI */
  severity: 'error' | 'warning' | 'info';
  /** Machine-readable code for grouping */
  code: string;
  /** Human-readable message */
  message: string;
  /** Related field IDs (canonical keys) */
  relatedFields?: string[];
}

/** A diff entry comparing old vs new extraction values */
export interface FieldDiff {
  /** Schema field ID */
  schemaFieldId: string;
  /** Display name */
  fieldName: string;
  /** Previous extracted value */
  oldValue: unknown;
  /** New extracted value */
  newValue: unknown;
  /** Previous confidence */
  oldConfidence: number;
  /** New confidence */
  newConfidence: number;
  /** Whether the value actually changed */
  changed: boolean;
}

export interface ExtractionResult {
  /** The canonical extracted data */
  extractedData: ExtractedPolicyData | null;
  /** ISO timestamp of extraction */
  extractedAt: string;
  /** Overall confidence 0.0–1.0 */
  confidence: number;
  /** Extraction status */
  status: ExtractionStatus;
  /** Error message if status === 'failed' */
  errorMessage?: string;
  /** ISO timestamp of when extracted data was applied to the policy */
  appliedAt?: string;
  /** Which fields were applied (field IDs) */
  appliedFields?: string[];
  /** Model used for extraction */
  model?: string;
  /** Cross-field validation warnings */
  validationWarnings?: ValidationWarning[];
  /** Prompt template version used for this extraction */
  promptVersion?: string;
}

// ---------------------------------------------------------------------------
// Extraction History (stored on KvPolicy as extractionHistory[])
// ---------------------------------------------------------------------------

export interface ExtractionHistoryEntry {
  /** Unique ID for this history entry */
  id: string;
  /** ISO timestamp of extraction */
  extractedAt: string;
  /** Overall confidence */
  confidence: number;
  /** Status at the time */
  status: ExtractionStatus;
  /** Number of fields mapped */
  fieldsMapped: number;
  /** Number of validation warnings */
  warningCount: number;
  /** Whether extracted data was applied */
  wasApplied: boolean;
  /** ISO timestamp of when data was applied (if applicable) */
  appliedAt?: string;
  /** Which fields were applied */
  appliedFields?: string[];
  /** Model used */
  model?: string;
  /** Document file name at the time */
  documentFileName?: string;
  /** Error message if failed */
  errorMessage?: string;
  /** Prompt template version used */
  promptVersion?: string;
  /**
   * Slim snapshot of field mappings for comparison.
   * Stored as an array of { k: canonicalKey, f: schemaFieldId, n: schemaFieldName, v: value, c: confidence }
   * to minimise KV storage size.
   */
  fieldMappingsSnapshot?: FieldMappingSnapshot[];
}

/**
 * Compact field mapping stored in history entries for comparison.
 * Uses short keys to minimise KV storage overhead.
 */
export interface FieldMappingSnapshot {
  /** canonicalKey */
  k: string;
  /** schemaFieldId */
  f: string;
  /** schemaFieldName */
  n: string;
  /** extracted value */
  v: unknown;
  /** confidence */
  c: number;
}

// ---------------------------------------------------------------------------
// Field Mapping Result — maps canonical fields to schema field IDs
// ---------------------------------------------------------------------------

export interface FieldMappingEntry {
  /** Canonical key (e.g. 'risk_life_cover') */
  canonicalKey: string;
  /** Schema field ID (e.g. 'rp_2') */
  schemaFieldId: string;
  /** Schema field name for display */
  schemaFieldName: string;
  /** Extracted value */
  value: unknown;
  /** Confidence score */
  confidence: number;
  /** Current value in the policy (for comparison) */
  currentValue?: unknown;
}

// ---------------------------------------------------------------------------
// Provider Terminology Mapping (stored in KV as config:provider-terms:{providerId})
// ---------------------------------------------------------------------------

export interface ProviderTerminologyMap {
  providerId: string;
  providerName: string;
  /** Maps provider benefit term → canonical key ID */
  benefitMappings: Record<string, string>;
  /** Maps provider product name → internal category ID */
  productMappings: Record<string, string>;
  updatedAt: string;
  updatedBy: string;
}