/**
 * Integration config / field-binding utilities (Phase 5 decomposition).
 * =====================================================================
 *
 * Pure helpers extracted verbatim from integrations.tsx — settings/config
 * normalisation and field-binding construction shared by the config, template,
 * and portal routes. No I/O (no kv/Deno/network), so they move cleanly and are
 * fully verified by typecheck. This is shared-utils groundwork so the portal
 * routes can later move to their own sub-router without a circular import back
 * into integrations.tsx.
 */
import type { IntegrationConfig, IntegrationFieldBinding } from './integrations-core-types.ts';
import type { SchemaField } from './integrations-types.ts';
import type { PortalFlowField } from './integrations-portal-types.ts';
import {
  buildIntegrationBindingsForFields,
  buildLegacyFieldMappingFromBindings,
  normaliseIntegrationBlankBehavior,
  normaliseIntegrationColumnName,
  normaliseIntegrationLabelList,
} from '../../../shared/integrations/binding-utils.ts';

export function getDefaultIntegrationSettings(): IntegrationConfig['settings'] {
  return {
    autoMap: true,
    ignoreUnmatched: false,
    strictMode: false,
    autoPublish: false,
  };
}

export function normaliseSettings(
  settings?: Partial<IntegrationConfig['settings']>,
): IntegrationConfig['settings'] {
  return {
    ...getDefaultIntegrationSettings(),
    ...(settings || {}),
  };
}

export function normaliseColumnName(value: unknown): string {
  return normaliseIntegrationColumnName(value);
}

export function buildFieldBinding(
  field: SchemaField | undefined,
  targetFieldId: string,
  columnName: string,
  existing?: Partial<IntegrationFieldBinding>,
): IntegrationFieldBinding {
  return {
    targetFieldId,
    targetFieldName: String(existing?.targetFieldName || field?.name || targetFieldId).trim(),
    columnName: normaliseColumnName(columnName),
    required: field?.required === true,
    fieldType: String(existing?.fieldType || field?.type || 'text').trim() || 'text',
    portalLabels: normaliseIntegrationLabelList(existing?.portalLabels),
    portalSelector:
      String(existing?.portalSelector || '')
        .trim()
        .slice(0, 500) || undefined,
    blankBehavior: normaliseIntegrationBlankBehavior(existing?.blankBehavior),
    transform:
      String(existing?.transform || 'trim')
        .trim()
        .slice(0, 40) || 'trim',
  };
}

export function normaliseFieldBindings(
  bindings: unknown,
  legacyFieldMapping: Record<string, string> = {},
  fields: SchemaField[] = [],
): IntegrationFieldBinding[] {
  const hydratedBindings = buildIntegrationBindingsForFields(
    fields.map((field) => ({
      id: field.id,
      name: field.name,
      required: field.required === true,
      type: field.type,
    })),
    Array.isArray(bindings) ? (bindings as IntegrationFieldBinding[]) : [],
    legacyFieldMapping,
  );

  return hydratedBindings.map((binding) =>
    buildFieldBinding(
      fields.find((field) => field.id === binding.targetFieldId),
      binding.targetFieldId,
      binding.columnName,
      binding,
    ),
  );
}

export function fieldBindingsToMapping(
  bindings: IntegrationFieldBinding[] = [],
  fallbackFieldMapping: Record<string, string> = {},
): Record<string, string> {
  const fieldMapping = buildLegacyFieldMappingFromBindings(bindings);
  if (Object.keys(fieldMapping).length > 0) return fieldMapping;

  return Object.fromEntries(
    Object.entries(fallbackFieldMapping || {})
      .map(([columnName, targetFieldId]) => [
        normaliseColumnName(columnName),
        String(targetFieldId || '').trim(),
      ])
      .filter(([columnName, targetFieldId]) => columnName && targetFieldId),
  );
}

export function getPortalFieldColumnName(field: Partial<PortalFlowField>): string {
  return normaliseColumnName(field.columnName || field.sourceHeader);
}

export function getPortalFieldDisplayName(field: Partial<PortalFlowField>): string {
  return String(
    field.targetFieldName ||
      field.columnName ||
      field.sourceHeader ||
      field.targetFieldId ||
      'Field',
  ).trim();
}

export function normaliseIntegrationConfig(
  config: Partial<IntegrationConfig> | null | undefined,
  fields: SchemaField[] = [],
): IntegrationConfig {
  const fieldBindings = normaliseFieldBindings(
    config?.fieldBindings,
    config?.fieldMapping || {},
    fields,
  );
  return {
    providerId: String(config?.providerId || ''),
    categoryId: String(config?.categoryId || ''),
    updatedAt: String(config?.updatedAt || new Date().toISOString()),
    updatedBy: String(config?.updatedBy || 'system'),
    fieldBindings,
    fieldMapping: fieldBindingsToMapping(fieldBindings, config?.fieldMapping || {}),
    settings: normaliseSettings(config?.settings),
  };
}
