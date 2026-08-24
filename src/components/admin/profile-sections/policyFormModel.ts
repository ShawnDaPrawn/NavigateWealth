/**
 * Model for the policy form dialog: the subtab→category mapping, the
 * provider/field shapes, and the pure helpers that normalise stored policy
 * data onto a product schema. No React, no API calls.
 */
import { DEFAULT_SCHEMAS } from './default-schemas';

// Map subtab IDs to Product Category IDs
export const SUBTAB_TO_CATEGORY: Record<string, string> = {
  'risk-planning': 'risk_planning',
  'medical-aid': 'medical_aid',
  retirement: 'retirement_planning',
  investments: 'investments',
  'employee-benefits': 'employee_benefits',
  'tax-planning': 'tax_planning',
  'estate-planning': 'estate_planning',
};

export interface Provider {
  id: string;
  name: string;
  description: string;
  categoryIds: string[];
  logoUrl?: string;
}

export interface ProductField {
  id: string;
  name: string;
  type: string;
  required: boolean;
  options?: string[];
  keyId?: string;
}

export function findFieldByKeyIds(
  structure: ProductField[],
  keyIds: string[],
): ProductField | undefined {
  for (const keyId of keyIds) {
    const found = structure.find((f) => f.keyId === keyId);
    if (found) return found;
  }
  return undefined;
}

export const DEFAULT_FIELD_KEY_IDS = new Map<string, string>();
for (const schema of Object.values(DEFAULT_SCHEMAS)) {
  for (const field of schema.fields) {
    if (field.keyId) {
      DEFAULT_FIELD_KEY_IDS.set(field.id, field.keyId);
    }
  }
}

export function hasPolicyValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
}

export function normalizePolicyDataForStructure(
  data: Record<string, unknown>,
  structure: ProductField[],
  fallbackData: Record<string, unknown> = {},
): Record<string, unknown> {
  const normalized = { ...fallbackData, ...data };

  for (const field of structure) {
    if (!field.keyId || hasPolicyValue(normalized[field.id])) continue;

    for (const [sourceFieldId, sourceValue] of Object.entries(normalized)) {
      if (
        sourceFieldId !== field.id &&
        DEFAULT_FIELD_KEY_IDS.get(sourceFieldId) === field.keyId &&
        hasPolicyValue(sourceValue)
      ) {
        normalized[field.id] = sourceValue;
        break;
      }
    }
  }

  return normalized;
}

export function getApplyableExtractedFields(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => hasPolicyValue(value)));
}
