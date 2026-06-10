/**
 * Portal worker — shadow LLM page extraction (Phase 2 of the portal
 * automation reimagining).
 * =====================================================================
 *
 * Runs the policy page's visible text through the server-side LLM
 * page-extraction endpoint and compares the result field-by-field against
 * what the selector/adapter pipeline extracted. Strictly observational:
 * the comparison is logged, written to debug artifacts, and attached to the
 * job item, but it never changes staged values and never fails the item.
 *
 * Enable with NW_PORTAL_SHADOW_EXTRACT=1 on the worker, or with
 * `extraction.shadowLlm: true` on the provider flow. NW_PORTAL_SHADOW_EXTRACT=0
 * force-disables it regardless of flow configuration.
 */
import { shadowExtractDisabledByEnv, shadowExtractEnabledByEnv } from './config.mjs';
import { apiFetch, workerJobPath } from './api.mjs';
import { capturePolicyConfirmationSnapshot } from './page-utils.mjs';
import { getFieldColumnName, getFieldDisplayName } from './extraction.mjs';
import {
  getFieldSemanticKind,
  isPlausibleValueForField,
} from '../provider-adapters/field-semantics.mjs';

const MAX_SHADOW_PAGE_TEXT_LENGTH = 16000;
const MAX_SHADOW_FIELDS = 30;

const CURRENCY_SEMANTICS = new Set([
  'premium',
  'life_cover',
  'severe_illness',
  'disability',
  'temporary_icb',
  'current_value',
]);

export function isShadowExtractionEnabled(flow) {
  if (shadowExtractDisabledByEnv) return false;
  return shadowExtractEnabledByEnv || flow?.extraction?.shadowLlm === true;
}

function normaliseForComparison(value, semantic) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text) return '';
  if (CURRENCY_SEMANTICS.has(semantic)) {
    // "R 12 345.67" and "R12,345.67" are the same amount; compare digits only.
    const digits = text.replace(/[^\d]/g, '');
    return digits || text.toLowerCase();
  }
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function compareShadowFieldValues(workerValue, shadowValue, semantic) {
  const worker = String(workerValue || '').trim();
  const shadow = String(shadowValue || '').trim();
  if (!worker && !shadow) return 'both_empty';
  if (worker && !shadow) return 'worker_only';
  if (!worker && shadow) return 'shadow_only';
  return normaliseForComparison(worker, semantic) === normaliseForComparison(shadow, semantic)
    ? 'match'
    : 'mismatch';
}

export function buildShadowComparison(fields, rawData, shadowFields, options = {}) {
  const shadowByColumn = new Map(
    (Array.isArray(shadowFields) ? shadowFields : [])
      .map((entry) => [String(entry?.columnName || '').trim(), entry])
      .filter(([columnName]) => columnName),
  );

  const comparedFields = fields.map((field) => {
    const columnName = getFieldColumnName(field);
    const semantic = getFieldSemanticKind(field);
    const workerValue = String(rawData?.[columnName] || '').trim().slice(0, 240);
    const shadowEntry = shadowByColumn.get(columnName);
    const shadowValue = String(shadowEntry?.value || '').trim().slice(0, 240);
    return {
      columnName,
      fieldName: getFieldDisplayName(field),
      semantic,
      workerValue,
      shadowValue,
      shadowConfidence: ['high', 'medium', 'low'].includes(String(shadowEntry?.confidence))
        ? shadowEntry.confidence
        : undefined,
      shadowPlausible: shadowValue
        ? isPlausibleValueForField(field, shadowValue, options.item)
        : false,
      status: compareShadowFieldValues(workerValue, shadowValue, semantic),
    };
  });

  const summary = {
    total: comparedFields.length,
    match: comparedFields.filter((entry) => entry.status === 'match').length,
    mismatch: comparedFields.filter((entry) => entry.status === 'mismatch').length,
    shadowOnly: comparedFields.filter((entry) => entry.status === 'shadow_only').length,
    workerOnly: comparedFields.filter((entry) => entry.status === 'worker_only').length,
    bothEmpty: comparedFields.filter((entry) => entry.status === 'both_empty').length,
  };

  return {
    model: options.model || undefined,
    comparedAt: new Date().toISOString(),
    pageUrl: options.pageUrl ? String(options.pageUrl).slice(0, 1000) : undefined,
    summary,
    fields: comparedFields,
  };
}

export function describeShadowComparison(comparison) {
  if (!comparison) return 'shadow extraction skipped';
  const { summary } = comparison;
  return `shadow extraction compared ${summary.total} field(s): `
    + `${summary.match} match, ${summary.mismatch} mismatch, `
    + `${summary.shadowOnly} shadow-only, ${summary.workerOnly} worker-only, ${summary.bothEmpty} both-empty`;
}

/**
 * Returns the comparison object, or null when shadow extraction is disabled,
 * unavailable on the server, or there is nothing to compare. Never throws for
 * server/LLM failures — callers treat null as "no shadow data".
 */
export async function runShadowExtractionComparison(page, flow, item, { fields, rawData }) {
  if (!isShadowExtractionEnabled(flow)) return null;
  if (!Array.isArray(fields) || fields.length === 0) return null;

  const snapshot = await capturePolicyConfirmationSnapshot(page);
  const pageText = String(snapshot.text || '')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, MAX_SHADOW_PAGE_TEXT_LENGTH);
  if (!pageText.trim()) return null;

  const requestFields = fields.slice(0, MAX_SHADOW_FIELDS).map((field) => ({
    columnName: getFieldColumnName(field),
    fieldName: getFieldDisplayName(field),
    labels: Array.isArray(field.labels) ? field.labels.filter(Boolean).slice(0, 8) : [],
    semantic: getFieldSemanticKind(field),
    required: field.required === true,
  }));

  const response = await apiFetch(workerJobPath('/page-extract'), {
    method: 'POST',
    body: JSON.stringify({
      itemId: item.id,
      policyNumber: item.policyNumber,
      pageUrl: String(snapshot.currentUrl || '').slice(0, 1000),
      pageTitle: String(snapshot.title || '').slice(0, 240),
      pageText,
      fields: requestFields,
    }),
  });

  if (!response || response.available === false) return null;

  return buildShadowComparison(fields, rawData, response.fields, {
    item,
    model: response.model,
    pageUrl: snapshot.currentUrl,
  });
}
