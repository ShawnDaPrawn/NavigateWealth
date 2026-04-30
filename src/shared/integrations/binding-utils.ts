export type IntegrationBlankBehavior = 'ignore' | 'clear' | 'error';

export interface BindingFieldLike {
  id: string;
  name?: string;
  required?: boolean;
  type?: string;
}

export interface IntegrationFieldBindingLike {
  targetFieldId?: string;
  targetFieldName?: string;
  columnName?: string;
  required?: boolean;
  fieldType?: string;
  portalLabels?: unknown;
  portalSelector?: string;
  labels?: unknown;
  selector?: string;
  blankBehavior?: unknown;
  transform?: string;
}

export interface PortalFlowFieldLike {
  sourceHeader?: string;
  columnName?: string;
  targetFieldId?: string;
  targetFieldName?: string;
  selector?: string;
  labels?: unknown;
  attribute?: string;
  required?: boolean;
  transform?: string;
}

export function normaliseIntegrationColumnName(value: unknown): string {
  return String(value || '').trim().slice(0, 120);
}

export function normaliseIntegrationLabelList(value: unknown, max = 12): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n|,/)
      : [];

  return Array.from(new Set(
    values
      .map((item) => String(item || '').trim())
      .filter(Boolean),
  )).slice(0, max);
}

export function normaliseIntegrationBlankBehavior(value: unknown): IntegrationBlankBehavior {
  return value === 'clear' || value === 'error' ? value : 'ignore';
}

function normalisePortalFieldMeaning(value: unknown): string {
  const normalised = normaliseIntegrationColumnName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (!normalised) return '';
  if (/(policy\s*(number|no)|account\s*number|investment\s*number|reference)/.test(normalised)) return 'policy number';
  if (/(date\s*of\s*inception|inception\s*date|start\s*date|investment\s*start\s*date)/.test(normalised)) return 'date of inception';
  if (/(product\s*type|product\s*name|investment\s*type|retirement\s*annuity\s*fund)/.test(normalised)) return 'product type';
  if (
    !/(maturity|estimated|projected|guaranteed|premium|contribution)/.test(normalised)
    && /(current\s*value|fund\s*value|market\s*value|closing\s*balance|policy\s*value|account\s*value|retirement.*value|\bvalue\b)/.test(normalised)
  ) return 'current value';
  if (/(est\s*maturity\s*value|estimated\s*maturity\s*value)/.test(normalised)) return 'est maturity value';

  return normalised;
}

export function buildIntegrationBindingsForFields<TField extends BindingFieldLike, TBinding extends IntegrationFieldBindingLike>(
  fields: TField[],
  bindings: TBinding[] = [],
  legacyFieldMapping: Record<string, string> = {},
): Array<IntegrationFieldBindingLike & {
  targetFieldId: string;
  targetFieldName: string;
  columnName: string;
  required: boolean;
  fieldType: string;
  portalLabels: string[];
  portalSelector?: string;
  blankBehavior: IntegrationBlankBehavior;
  transform: string;
}> {
  const bindingsByTarget = new Map(
    bindings
      .map((binding) => [String(binding.targetFieldId || '').trim(), binding] as const)
      .filter(([targetFieldId]) => targetFieldId),
  );

  const normalised: Array<IntegrationFieldBindingLike & {
    targetFieldId: string;
    targetFieldName: string;
    columnName: string;
    required: boolean;
    fieldType: string;
    portalLabels: string[];
    portalSelector?: string;
    blankBehavior: IntegrationBlankBehavior;
    transform: string;
  }> = [];

  for (const field of fields) {
    const existing = bindingsByTarget.get(field.id);
    const legacyColumnName = Object.entries(legacyFieldMapping || {}).find(([, targetFieldId]) => targetFieldId === field.id)?.[0];
    const columnName = normaliseIntegrationColumnName(existing?.columnName || legacyColumnName || field.name || field.id);
    if (!columnName) continue;

    normalised.push({
      targetFieldId: field.id,
      targetFieldName: String(existing?.targetFieldName || field.name || field.id).trim(),
      columnName,
      required: field.required === true,
      fieldType: String(existing?.fieldType || field.type || 'text').trim() || 'text',
      portalLabels: normaliseIntegrationLabelList(existing?.portalLabels),
      portalSelector: String(existing?.portalSelector || '').trim().slice(0, 500) || undefined,
      blankBehavior: normaliseIntegrationBlankBehavior(existing?.blankBehavior),
      transform: String(existing?.transform || 'trim').trim().slice(0, 40) || 'trim',
    });

    bindingsByTarget.delete(field.id);
  }

  for (const existing of bindingsByTarget.values()) {
    const targetFieldId = String(existing.targetFieldId || '').trim();
    const columnName = normaliseIntegrationColumnName(existing.columnName);
    if (!targetFieldId || !columnName) continue;
    normalised.push({
      targetFieldId,
      targetFieldName: String(existing.targetFieldName || targetFieldId).trim(),
      columnName,
      required: existing.required === true,
      fieldType: String(existing.fieldType || 'text').trim() || 'text',
      portalLabels: normaliseIntegrationLabelList(existing.portalLabels),
      portalSelector: String(existing.portalSelector || '').trim().slice(0, 500) || undefined,
      blankBehavior: normaliseIntegrationBlankBehavior(existing.blankBehavior),
      transform: String(existing.transform || 'trim').trim().slice(0, 40) || 'trim',
    });
  }

  return normalised;
}

export function buildLegacyFieldMappingFromBindings(bindings: IntegrationFieldBindingLike[] = []): Record<string, string> {
  return Object.fromEntries(
    bindings
      .map((binding) => [normaliseIntegrationColumnName(binding.columnName), String(binding.targetFieldId || '').trim()] as const)
      .filter(([columnName, targetFieldId]) => columnName && targetFieldId),
  );
}

export function mergeBindingIntoPortalField<TBinding extends IntegrationFieldBindingLike, TField extends PortalFlowFieldLike>(
  binding: TBinding,
  existing?: TField,
): PortalFlowFieldLike {
  const columnName = normaliseIntegrationColumnName(binding.columnName || existing?.columnName || existing?.sourceHeader);
  const targetFieldId = String(binding.targetFieldId || existing?.targetFieldId || '').trim();
  const targetFieldName = String(binding.targetFieldName || existing?.targetFieldName || targetFieldId || columnName || 'Field').trim();
  const bindingLabels = normaliseIntegrationLabelList(binding.portalLabels ?? binding.labels);
  const fallbackLabels = normaliseIntegrationLabelList(existing?.labels);
  const mergedLabels = Array.from(new Set([
    ...bindingLabels,
    ...fallbackLabels,
  ])).slice(0, 12);
  const generatedLabels = normaliseIntegrationLabelList([targetFieldName, columnName]);

  return {
    sourceHeader: columnName,
    columnName,
    targetFieldId: targetFieldId || undefined,
    targetFieldName,
    selector: String(binding.portalSelector || binding.selector || existing?.selector || '').trim().slice(0, 500),
    labels: mergedLabels.length > 0 ? mergedLabels : generatedLabels,
    attribute: String(existing?.attribute || 'text').trim().slice(0, 40) || 'text',
    required: binding.required === true || existing?.required === true,
    transform: String(binding.transform || existing?.transform || 'trim').trim().slice(0, 40) || 'trim',
  };
}

export function buildPortalFieldsFromBindings<TBinding extends IntegrationFieldBindingLike, TField extends PortalFlowFieldLike>(
  bindings: TBinding[] = [],
  existingFields: TField[] = [],
): PortalFlowFieldLike[] {
  if (!Array.isArray(bindings) || bindings.length === 0) {
    return existingFields.map((field) => mergeBindingIntoPortalField({
      targetFieldId: field.targetFieldId,
      targetFieldName: field.targetFieldName,
      columnName: field.columnName || field.sourceHeader,
      portalLabels: field.labels,
      portalSelector: field.selector,
      required: field.required,
      transform: field.transform,
    }, field));
  }

  const currentByTarget = new Map(
    existingFields
      .map((field) => [String(field.targetFieldId || '').trim(), field] as const)
      .filter(([targetFieldId]) => targetFieldId),
  );
  const currentByColumn = new Map(
    existingFields
      .map((field) => [normaliseIntegrationColumnName(field.columnName || field.sourceHeader), field] as const)
      .filter(([columnName]) => columnName),
  );
  const currentByMeaning = new Map(
    existingFields
      .map((field) => [normalisePortalFieldMeaning(field.targetFieldName || field.columnName || field.sourceHeader), field] as const)
      .filter(([meaning]) => meaning),
  );

  return bindings
    .map((binding) => {
      const targetFieldId = String(binding.targetFieldId || '').trim();
      const columnName = normaliseIntegrationColumnName(binding.columnName);
      const meaning = normalisePortalFieldMeaning(binding.targetFieldName || binding.columnName);
      const existing = currentByTarget.get(targetFieldId) || currentByColumn.get(columnName) || currentByMeaning.get(meaning);
      return mergeBindingIntoPortalField(binding, existing);
    })
    .filter((field) => normaliseIntegrationColumnName(field.columnName || field.sourceHeader));
}
