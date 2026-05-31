/**
 * Integration field / schema / value utilities (Phase 5 decomposition).
 * =====================================================================
 *
 * Extracted verbatim from integrations.tsx. Schema lookup + policy-number
 * resolution + field-value coercion + portal-meaning resolution, plus the tiny
 * value/date predicates (isBlank/valuesDiffer/isValidDate). Shared by the
 * spreadsheet-sync routes and the portal extraction path, so it lives in a
 * common module both import from (vs a circular import back into
 * integrations.tsx). Behaviour-preserving move.
 */
import * as kv from './kv_store.tsx';
import { DEFAULT_SCHEMAS } from './default-schemas.ts';
import {
  isTemplateMetadataColumn,
  parseSpreadsheetDateSerial,
} from './integrations-spreadsheet.ts';
import { normaliseColumnName } from './integrations-config-utils.ts';
import type { SchemaField, KvSchema, KvPolicy } from './integrations-types.ts';
import type { IntegrationFieldBinding } from './integrations-core-types.ts';

export function isBlank(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

export function valuesDiffer(oldValue: unknown, newValue: unknown): boolean {
  return String(oldValue ?? '').trim() !== String(newValue ?? '').trim();
}
export function findPolicyNumberField(fields: SchemaField[]): SchemaField | undefined {
  return fields.find((field) => {
    const name = (field.name || '').toLowerCase();
    return (
      name.includes('policy number') || name.includes('policy no') || name.includes('reference')
    );
  });
}

export async function getSchemaForCategory(categoryId: string): Promise<KvSchema> {
  const configured = (await kv.get(`config:schema:${categoryId}`)) as KvSchema | null;
  const fallback = DEFAULT_SCHEMAS[categoryId] as KvSchema | undefined;
  return configured || fallback || { categoryId, fields: [] };
}

export async function getPolicyNumberForPolicy(
  policy: KvPolicy,
  fallbackFields: SchemaField[],
  schemaCache = new Map<string, KvSchema>(),
): Promise<string> {
  const candidateFieldIds = new Set<string>();
  const fallbackPolicyNumberField = findPolicyNumberField(fallbackFields);
  if (fallbackPolicyNumberField?.id) candidateFieldIds.add(fallbackPolicyNumberField.id);

  if (!schemaCache.has(policy.categoryId)) {
    schemaCache.set(policy.categoryId, await getSchemaForCategory(policy.categoryId));
  }
  const policySchema = schemaCache.get(policy.categoryId);
  const policyCategoryNumberField = findPolicyNumberField(policySchema?.fields || []);
  if (policyCategoryNumberField?.id) candidateFieldIds.add(policyCategoryNumberField.id);

  ['policyNumber', 'policy_number', 'policyNo', 'policy_no', 'reference'].forEach((fieldId) =>
    candidateFieldIds.add(fieldId),
  );

  for (const fieldId of candidateFieldIds) {
    const value = String(policy.data?.[fieldId] ?? '').trim();
    if (value) return value;
  }

  return '';
}

export function coerceFieldValue(
  field: SchemaField,
  value: unknown,
): { value: unknown; error?: string } {
  if (isBlank(value)) return { value: '' };

  const fieldType = (field.type || 'text').toLowerCase();
  const raw = typeof value === 'string' ? value.trim() : value;

  if (['number', 'currency', 'percentage'].includes(fieldType)) {
    const cleaned = String(raw).replace(/[R,%\s,]/g, '');
    const parsed = Number(cleaned);
    if (Number.isNaN(parsed)) {
      return { value, error: `${field.name} must be a valid ${fieldType}` };
    }
    return { value: parsed };
  }

  if (fieldType === 'boolean') {
    const normalised = String(raw).toLowerCase();
    if (['true', 'yes', 'y', '1'].includes(normalised)) return { value: true };
    if (['false', 'no', 'n', '0'].includes(normalised)) return { value: false };
    return { value, error: `${field.name} must be yes or no` };
  }

  if (fieldType === 'date') {
    if (typeof raw === 'number') {
      const parsed = parseSpreadsheetDateSerial(raw);
      if (parsed) {
        return {
          value: `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`,
        };
      }
    }
    const dateText = String(raw);
    if (!isValidDate(dateText)) {
      return { value, error: `${field.name} must be a valid date` };
    }
    return { value: dateText };
  }

  if (fieldType === 'dropdown' && Array.isArray(field.options) && field.options.length > 0) {
    const simplifiedRaw = normaliseDropdownValue(raw);
    const option = field.options.find((candidate) => {
      const simplifiedCandidate = normaliseDropdownValue(candidate);
      return (
        simplifiedCandidate === simplifiedRaw ||
        simplifiedRaw.includes(simplifiedCandidate) ||
        simplifiedCandidate.includes(simplifiedRaw)
      );
    });
    if (!option) {
      return { value, error: `${field.name} must be one of: ${field.options.join(', ')}` };
    }
    return { value: option };
  }

  return { value: raw };
}

export function normaliseDropdownValue(value: unknown): string {
  return normaliseColumnName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bfund\b/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalisePortalColumnMeaning(value: unknown): string {
  const normalised = normaliseColumnName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (!normalised) return '';
  if (
    /(policy\s*(number|no)|account\s*(number|no)|investment\s*(number|no)|reference)/.test(
      normalised,
    )
  )
    return 'policy number';
  if (
    /(date\s*of\s*inception|inception\s*date|start\s*date|investment\s*start\s*date)/.test(
      normalised,
    )
  )
    return 'date of inception';
  if (
    /(product\s*type|product\s*name|investment\s*type|retirement\s*annuity\s*fund|pension\s*fund|provident\s*fund|preservation\s*fund|living\s*annuity)/.test(
      normalised,
    )
  )
    return 'product type';
  if (
    !/(maturity|estimated|projected|guaranteed|premium|contribution)/.test(normalised) &&
    /(current\s*value|total\s*value|fund\s*value|market\s*value|closing\s*balance|policy\s*value|account\s*value|retirement.*value|\bvalue\b)/.test(
      normalised,
    )
  )
    return 'current value';
  if (
    /(est\s*maturity\s*value|estimated\s*maturity\s*value|projected\s*maturity\s*value)/.test(
      normalised,
    )
  )
    return 'est maturity value';
  if (/(maturity\s*date|retirement\s*date)/.test(normalised)) return 'maturity date';
  if (/(premium|contribution|monthly\s*contribution)/.test(normalised)) return 'premium';

  return normalised;
}

export function getFieldPortalMeaning(
  field: SchemaField,
  binding?: IntegrationFieldBinding,
  sourceHeader?: string,
): string {
  const keyId = normalisePortalColumnMeaning((field as { keyId?: string }).keyId);
  if (keyId.includes('value') && !keyId.includes('maturity')) return 'current value';
  if (keyId.includes('fund type') || keyId.includes('product type')) return 'product type';
  if (keyId.includes('date of inception')) return 'date of inception';
  if (keyId.includes('maturity date')) return 'maturity date';
  if (keyId.includes('maturity value')) return 'est maturity value';
  if (keyId.includes('premium') || keyId.includes('contribution')) return 'premium';

  return normalisePortalColumnMeaning(binding?.targetFieldName || field.name || sourceHeader);
}

export function resolveRawPortalValue(params: {
  rawData: Record<string, unknown>;
  sourceHeader: string;
  field: SchemaField;
  binding?: IntegrationFieldBinding;
  source?: 'spreadsheet' | 'portal';
}): { key: string; value: unknown } {
  if (Object.prototype.hasOwnProperty.call(params.rawData, params.sourceHeader)) {
    return { key: params.sourceHeader, value: params.rawData[params.sourceHeader] };
  }

  const normalisedSourceHeader = normaliseColumnName(params.sourceHeader);
  const exactNormalisedMatch = Object.entries(params.rawData).find(
    ([key]) => normaliseColumnName(key) === normalisedSourceHeader,
  );
  if (exactNormalisedMatch) {
    return { key: exactNormalisedMatch[0], value: exactNormalisedMatch[1] };
  }

  if (params.source !== 'portal') {
    return { key: params.sourceHeader, value: undefined };
  }

  const targetMeaning = getFieldPortalMeaning(params.field, params.binding, params.sourceHeader);
  if (!targetMeaning) {
    return { key: params.sourceHeader, value: undefined };
  }

  const semanticMatch = Object.entries(params.rawData).find(
    ([key, value]) =>
      !isTemplateMetadataColumn(key) &&
      !isBlank(value) &&
      normalisePortalColumnMeaning(key) === targetMeaning,
  );

  return semanticMatch
    ? { key: semanticMatch[0], value: semanticMatch[1] }
    : { key: params.sourceHeader, value: undefined };
}
export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}
