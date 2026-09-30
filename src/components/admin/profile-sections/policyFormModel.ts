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

// Field ids of the retired parent "Retirement Planning" and "Investments"
// schemas. Both are now only headings, but policies captured under them still
// carry these ids, so keep mapping them onto their keys to carry the values
// across.
const RETIRED_PARENT_FIELD_KEY_IDS: Array<[string, string]> = [
  ['ret_2', 'retirement_fund_type'],
  ['ret_3', 'retirement_fund_value'],
  ['ret_6', 'retirement_monthly_contribution'],
  ['inv_2', 'invest_product_type'],
  ['inv_3', 'invest_current_value'],
  ['inv_4', 'invest_maturity_value'],
  ['inv_5', 'invest_maturity_date'],
  ['inv_6', 'invest_monthly_contribution'],
  ['inv_8', 'invest_assumptions_growth'],
  ['inv_9', 'invest_assumptions_escalation'],
];

// Policy-number fields have no product key, so the keyId map above cannot
// carry them. Pair each retired parent id with the child field that replaced it.
const RETIRED_PARENT_FIELD_ID_ALIASES: Array<[string, string]> = [
  ['ret_1', 'ret_pre_1'],
  ['inv_1', 'inv_vol_1'],
];

export const DEFAULT_FIELD_KEY_IDS = new Map<string, string>(RETIRED_PARENT_FIELD_KEY_IDS);
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
  structure: ReadonlyArray<{ id: string; keyId?: string }>,
  fallbackData: Record<string, unknown> = {},
): Record<string, unknown> {
  const normalized = { ...fallbackData, ...data };
  const structureIds = new Set(structure.map((field) => field.id));

  for (const [sourceFieldId, targetFieldId] of RETIRED_PARENT_FIELD_ID_ALIASES) {
    if (!structureIds.has(targetFieldId) || hasPolicyValue(normalized[targetFieldId])) continue;
    if (hasPolicyValue(normalized[sourceFieldId])) {
      normalized[targetFieldId] = normalized[sourceFieldId];
    }
  }

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
