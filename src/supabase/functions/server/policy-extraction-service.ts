/**
 * Policy Extraction Service
 *
 * Core AI-powered extraction pipeline:
 *   1. Read PDF from Supabase Storage
 *   2. Send PDF content to OpenAI GPT-4o with provider-specific prompt
 *   3. Parse response into canonical ExtractedPolicyData
 *   4. Apply provider terminology mappings (from KV)
 *   5. Map canonical keys to schema field IDs
 *   6. Return extraction result with per-field confidence scores
 *
 * @module policy-extraction-service
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { getExtractionPrompt, getPromptVersion } from './policy-extraction-prompts.ts';
import { downloadPdfAsBase64, callOpenAIExtraction } from './policy-extraction-openai.ts';
import { OPENAI_PRIMARY_MODEL } from './ai-model-config.ts';
import { DEFAULT_SCHEMAS } from './default-schemas.ts';
import type {
  ExtractedPolicyData,
  ExtractedField,
  ExtractionResult,
  FieldMappingEntry,
  ProviderTerminologyMap,
  ValidationWarning,
  FieldDiff,
  ExtractionHistoryEntry,
} from './policy-extraction-types.ts';
import type { KvPolicy, KvSchema, SchemaField } from './integrations-types.ts';

const log = createModuleLogger('policy-extraction');

function hasExtractedValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
}

async function applyProviderTerminology(
  extracted: ExtractedPolicyData,
  providerId: string,
): Promise<ExtractedPolicyData> {
  const termMapKey = `config:provider-terms:${providerId}`;
  const termMap = (await kv.get(termMapKey)) as ProviderTerminologyMap | null;

  if (!termMap || !termMap.benefitMappings) {
    return extracted; // No terminology map — AI's mapping stands
  }

  // Refine benefit canonical types using the provider's mapping
  for (const benefit of extracted.benefits) {
    const providerTerm = benefit.providerTermName?.value;
    if (providerTerm && termMap.benefitMappings[providerTerm]) {
      benefit.canonicalType = {
        value: termMap.benefitMappings[providerTerm],
        confidence: Math.max(benefit.canonicalType?.confidence || 0, 0.95), // High confidence from explicit mapping
        source: 'provider_terminology_map',
      };
    }

    // Also try normalised matching (lowercase, trimmed)
    if (providerTerm) {
      const normalisedTerm = providerTerm.toLowerCase().trim();
      for (const [mappedTerm, canonicalKey] of Object.entries(termMap.benefitMappings)) {
        if (mappedTerm.toLowerCase().trim() === normalisedTerm) {
          benefit.canonicalType = {
            value: canonicalKey,
            confidence: Math.max(benefit.canonicalType?.confidence || 0, 0.95),
            source: 'provider_terminology_map',
          };
          break;
        }
      }
    }
  }

  return extracted;
}

// ---------------------------------------------------------------------------
// Canonical → Schema Field Mapping
// ---------------------------------------------------------------------------

/**
 * Map the canonical extracted data to schema field IDs.
 * Uses the schema's `keyId` field to connect canonical keys to field IDs.
 */
async function mapToSchemaFields(
  extracted: ExtractedPolicyData,
  categoryId: string,
): Promise<FieldMappingEntry[]> {
  // Load the schema for this category
  const schemaKey = `config:schema:${categoryId}`;
  let schema = (await kv.get(schemaKey)) as KvSchema | null;

  if (!schema) {
    const defaultSchema = DEFAULT_SCHEMAS[categoryId];
    schema = defaultSchema ? (defaultSchema as KvSchema) : null;
  }

  if (!schema?.fields) {
    log.error('No schema found for field mapping', { categoryId });
    return [];
  }

  const fields = schema.fields;
  const mappings: FieldMappingEntry[] = [];

  // Build a lookup: keyId → field
  const keyIdToField = new Map<string, SchemaField>();
  const fieldNameToField = new Map<string, SchemaField>();
  for (const field of fields) {
    if (field.keyId) {
      keyIdToField.set(field.keyId, field);
    }
    if (field.name) {
      fieldNameToField.set(field.name.toLowerCase(), field);
    }
  }

  // Map top-level fields
  const topLevelMappings: Array<{
    canonicalKey: string;
    extracted: ExtractedField<unknown> | undefined;
    fieldNameFallbacks: string[];
  }> = [
    {
      canonicalKey: 'policy_number',
      extracted: extracted.policyNumber,
      fieldNameFallbacks: ['policy number', 'policy no', 'contract number', 'reference'],
    },
    {
      canonicalKey: 'premium',
      extracted: extracted.premiumAmount,
      fieldNameFallbacks: ['premium', 'monthly premium', 'total premium'],
    },
    {
      canonicalKey: 'inception_date',
      extracted: extracted.policyStartDate,
      fieldNameFallbacks: [
        'date of inception',
        'inception date',
        'commencement date',
        'start date',
      ],
    },
  ];

  for (const { canonicalKey, extracted: extractedField, fieldNameFallbacks } of topLevelMappings) {
    if (
      !extractedField ||
      extractedField.confidence === 0 ||
      !hasExtractedValue(extractedField.value)
    )
      continue;

    // Try keyId match first (for premium/inception which may have keyIds)
    let matched = false;
    for (const [keyId, field] of keyIdToField.entries()) {
      const keyLower = keyId.toLowerCase();
      if (
        (keyLower.includes('premium') && canonicalKey === 'premium') ||
        (keyLower.includes('inception') && canonicalKey === 'inception_date') ||
        (keyLower.includes('date_of_inception') && canonicalKey === 'inception_date')
      ) {
        mappings.push({
          canonicalKey,
          schemaFieldId: field.id,
          schemaFieldName: field.name || field.id,
          value: extractedField.value,
          confidence: extractedField.confidence,
        });
        matched = true;
        break;
      }
    }

    // Fall back to field name matching
    if (!matched) {
      for (const fallbackName of fieldNameFallbacks) {
        const field = fieldNameToField.get(fallbackName);
        if (field) {
          mappings.push({
            canonicalKey,
            schemaFieldId: field.id,
            schemaFieldName: field.name || field.id,
            value: extractedField.value,
            confidence: extractedField.confidence,
          });
          break;
        }
      }
    }
  }

  // Map benefits to schema fields via keyId
  for (const benefit of extracted.benefits) {
    const canonicalKey = benefit.canonicalType?.value;
    if (!canonicalKey) continue;

    const field = keyIdToField.get(canonicalKey);
    if (field && benefit.coverAmount) {
      mappings.push({
        canonicalKey,
        schemaFieldId: field.id,
        schemaFieldName: field.name || field.id,
        value: benefit.coverAmount.value,
        confidence: Math.min(benefit.canonicalType.confidence, benefit.coverAmount.confidence),
      });
    }
  }

  return mappings;
}

// ---------------------------------------------------------------------------
// Cross-Field Validation (Phase 3)
// ---------------------------------------------------------------------------

/**
 * Run cross-field consistency checks on extracted data.
 * Returns warnings that help the admin spot likely errors.
 */
function validateExtraction(
  extracted: ExtractedPolicyData,
  policy: KvPolicy,
  fieldMappings: FieldMappingEntry[],
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // 1. Provider name mismatch
  if (extracted.providerName?.value) {
    const extractedProvider = extracted.providerName.value.toLowerCase().trim();
    const policyProvider = (policy.providerName || '').toLowerCase().trim();
    if (
      policyProvider &&
      !extractedProvider.includes(policyProvider) &&
      !policyProvider.includes(extractedProvider)
    ) {
      warnings.push({
        severity: 'warning',
        code: 'PROVIDER_MISMATCH',
        message: `Document mentions "${extracted.providerName.value}" but this policy is linked to "${policy.providerName}". Verify this is the correct document.`,
        relatedFields: ['providerName'],
      });
    }
  }

  // 2. Inception date in the future
  if (extracted.policyStartDate?.value) {
    const inception = new Date(extracted.policyStartDate.value);
    if (!isNaN(inception.getTime()) && inception > new Date()) {
      warnings.push({
        severity: 'warning',
        code: 'FUTURE_INCEPTION',
        message: `Inception date ${extracted.policyStartDate.value} is in the future. This may indicate a misread date.`,
        relatedFields: ['policyStartDate'],
      });
    }
  }

  // 3. Suspiciously high or zero premium
  if (extracted.premiumAmount?.value !== undefined) {
    const premium = Number(extracted.premiumAmount.value);
    if (premium === 0 && extracted.benefits.length > 0) {
      warnings.push({
        severity: 'warning',
        code: 'ZERO_PREMIUM',
        message:
          'Premium is R0 but benefits were found. The premium may not have been extracted correctly.',
        relatedFields: ['premiumAmount'],
      });
    }
    if (premium > 500000) {
      warnings.push({
        severity: 'info',
        code: 'HIGH_PREMIUM',
        message: `Extracted premium of R${premium.toLocaleString('en-ZA')} seems unusually high. Please verify — it may be an annual amount or a cover amount misclassified as premium.`,
        relatedFields: ['premiumAmount'],
      });
    }
  }

  // 4. Premium frequency: if annual, warn to check if monthly was intended
  if (extracted.premiumFrequency?.value) {
    const freq = extracted.premiumFrequency.value.toLowerCase();
    if (freq === 'annual' || freq === 'yearly') {
      warnings.push({
        severity: 'info',
        code: 'ANNUAL_PREMIUM',
        message:
          'Premium appears to be annual. Navigate Wealth typically stores monthly premiums — you may need to divide by 12 before applying.',
        relatedFields: ['premiumAmount', 'premiumFrequency'],
      });
    }
  }

  // 5. Benefits with very low confidence
  const lowConfBenefits = extracted.benefits.filter(
    (b) => b.canonicalType?.confidence < 0.5 && b.coverAmount?.value,
  );
  if (lowConfBenefits.length > 0) {
    warnings.push({
      severity: 'warning',
      code: 'LOW_CONFIDENCE_BENEFITS',
      message: `${lowConfBenefits.length} benefit(s) have low classification confidence. Review their canonical type mappings before applying.`,
      relatedFields: lowConfBenefits.map((b) => b.canonicalType?.value).filter(Boolean) as string[],
    });
  }

  // 6. Duplicate canonical keys — same canonical key mapped to multiple benefits
  const canonicalCounts = new Map<string, number>();
  for (const benefit of extracted.benefits) {
    const key = benefit.canonicalType?.value;
    if (key) {
      canonicalCounts.set(key, (canonicalCounts.get(key) || 0) + 1);
    }
  }
  for (const [key, count] of canonicalCounts) {
    if (count > 1) {
      warnings.push({
        severity: 'warning',
        code: 'DUPLICATE_CANONICAL_KEY',
        message: `Canonical key "${key}" appears ${count} times. Only the last value will be mapped. Check for duplicates or ambiguous benefit names.`,
        relatedFields: [key],
      });
    }
  }

  // 7. No fields were mappable to the schema
  if (fieldMappings.length === 0 && extracted.benefits.length > 0) {
    warnings.push({
      severity: 'error',
      code: 'NO_FIELD_MAPPINGS',
      message:
        'Benefits were extracted but none could be mapped to the product schema. The provider terminology may need configuration.',
    });
  }

  // 8. Overall confidence check
  if (extracted.overallConfidence < 0.5) {
    warnings.push({
      severity: 'error',
      code: 'LOW_OVERALL_CONFIDENCE',
      message: `Overall extraction confidence is ${Math.round(extracted.overallConfidence * 100)}%. The document may be low quality, scanned, or in an unexpected format.`,
    });
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Change Detection — Diff (Phase 3)
// ---------------------------------------------------------------------------

/**
 * Compare previous extraction field mappings with new ones.
 * Returns a diff array showing changed, added, and removed fields.
 */
export function generateExtractionDiff(
  previousMappings: FieldMappingEntry[],
  newMappings: FieldMappingEntry[],
): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  // Build lookup of previous mappings by schemaFieldId
  const prevByFieldId = new Map<string, FieldMappingEntry>();
  for (const m of previousMappings) {
    prevByFieldId.set(m.schemaFieldId, m);
  }

  // Compare new mappings against previous
  for (const newM of newMappings) {
    const prev = prevByFieldId.get(newM.schemaFieldId);
    if (prev) {
      diffs.push({
        schemaFieldId: newM.schemaFieldId,
        fieldName: newM.schemaFieldName,
        oldValue: prev.value,
        newValue: newM.value,
        oldConfidence: prev.confidence,
        newConfidence: newM.confidence,
        changed: String(prev.value) !== String(newM.value),
      });
      prevByFieldId.delete(newM.schemaFieldId);
    } else {
      // New field not in previous extraction
      diffs.push({
        schemaFieldId: newM.schemaFieldId,
        fieldName: newM.schemaFieldName,
        oldValue: null,
        newValue: newM.value,
        oldConfidence: 0,
        newConfidence: newM.confidence,
        changed: true,
      });
    }
  }

  // Remaining in prevByFieldId = fields that were in previous but not in new
  for (const [, prev] of prevByFieldId) {
    diffs.push({
      schemaFieldId: prev.schemaFieldId,
      fieldName: prev.schemaFieldName,
      oldValue: prev.value,
      newValue: null,
      oldConfidence: prev.confidence,
      newConfidence: 0,
      changed: true,
    });
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Extraction History Helpers (Phase 3)
// ---------------------------------------------------------------------------

/**
 * Build a history entry from an extraction result.
 * Optionally includes a slim field mappings snapshot for comparison.
 */
export function buildHistoryEntry(
  extraction: ExtractionResult,
  fieldsMapped: number,
  documentFileName?: string,
  fieldMappings?: FieldMappingEntry[],
): ExtractionHistoryEntry {
  const entry: ExtractionHistoryEntry = {
    id: `exh_${Date.now()}`,
    extractedAt: extraction.extractedAt,
    confidence: extraction.confidence,
    status: extraction.status,
    fieldsMapped,
    warningCount: extraction.validationWarnings?.length || 0,
    wasApplied: !!extraction.appliedAt,
    appliedAt: extraction.appliedAt,
    appliedFields: extraction.appliedFields,
    model: extraction.model,
    documentFileName,
    errorMessage: extraction.errorMessage,
    promptVersion: extraction.promptVersion,
  };

  // Store a compact field mappings snapshot for comparison (limit to 50 fields to cap KV size)
  if (fieldMappings && fieldMappings.length > 0) {
    entry.fieldMappingsSnapshot = fieldMappings.slice(0, 50).map((fm) => ({
      k: fm.canonicalKey,
      f: fm.schemaFieldId,
      n: fm.schemaFieldName,
      v: fm.value,
      c: fm.confidence,
    }));
  }

  return entry;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract policy data from an uploaded document.
 *
 * This is the main entry point called by the route handler.
 *
 * @param policy    The full KvPolicy object (must have a document attached)
 * @returns         ExtractionResult with canonical data and field mappings
 */
export async function extractPolicyDocument(
  policy: KvPolicy,
): Promise<{ extraction: ExtractionResult; fieldMappings: FieldMappingEntry[] }> {
  if (!policy.document?.storageKey) {
    throw new Error('Policy has no attached document');
  }

  const startTime = Date.now();

  try {
    log.info('Starting policy document extraction', {
      policyId: policy.id,
      provider: policy.providerName,
      category: policy.categoryId,
    });

    // 1. Download PDF as base64
    const pdfBase64 = await downloadPdfAsBase64(policy.document.storageKey);
    log.info('PDF downloaded', { sizeBytes: pdfBase64.length * 0.75 }); // Approximate original size

    // 2. Select prompt template
    const prompt = getExtractionPrompt(policy.providerName || '');
    const promptVersion = getPromptVersion(policy.providerName || '');

    // 3. Call OpenAI for extraction
    let extractedData = await callOpenAIExtraction(pdfBase64, prompt);

    // 4. Apply provider terminology mappings
    extractedData = await applyProviderTerminology(extractedData, policy.providerId);

    // 5. Map to schema fields
    const fieldMappings = await mapToSchemaFields(extractedData, policy.categoryId);

    // Add current policy values to mappings for comparison
    for (const mapping of fieldMappings) {
      mapping.currentValue = policy.data?.[mapping.schemaFieldId];
    }

    // 6. Validate extraction
    const validationWarnings = validateExtraction(extractedData, policy, fieldMappings);

    const elapsed = Date.now() - startTime;
    log.info('Policy extraction completed', {
      policyId: policy.id,
      overallConfidence: extractedData.overallConfidence,
      benefitsFound: extractedData.benefits.length,
      fieldsMapped: fieldMappings.length,
      warningCount: validationWarnings.length,
      elapsedMs: elapsed,
    });

    const extraction: ExtractionResult = {
      extractedData,
      extractedAt: new Date().toISOString(),
      confidence: extractedData.overallConfidence,
      status: 'completed',
      model: OPENAI_PRIMARY_MODEL,
      validationWarnings,
      promptVersion,
    };

    return { extraction, fieldMappings };
  } catch (err) {
    const elapsed = Date.now() - startTime;
    log.error('Policy extraction failed', {
      policyId: policy.id,
      error: getErrMsg(err),
      elapsedMs: elapsed,
    });

    const extraction: ExtractionResult = {
      extractedData: null,
      extractedAt: new Date().toISOString(),
      confidence: 0,
      status: 'failed',
      errorMessage: getErrMsg(err),
      model: OPENAI_PRIMARY_MODEL,
      promptVersion: getPromptVersion(policy.providerName || ''),
    };

    return { extraction, fieldMappings: [] };
  }
}

// ---------------------------------------------------------------------------
// Provider Terminology CRUD
// ---------------------------------------------------------------------------

export async function getProviderTerminology(
  providerId: string,
): Promise<ProviderTerminologyMap | null> {
  return (await kv.get(`config:provider-terms:${providerId}`)) as ProviderTerminologyMap | null;
}

export async function saveProviderTerminology(map: ProviderTerminologyMap): Promise<void> {
  await kv.set(`config:provider-terms:${map.providerId}`, map);
  log.info('Provider terminology map saved', { providerId: map.providerId });
}

export async function getAllProviderTerminologies(): Promise<ProviderTerminologyMap[]> {
  const results = await kv.getByPrefix('config:provider-terms:');
  return (results || []) as ProviderTerminologyMap[];
}
