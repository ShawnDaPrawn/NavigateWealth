import type {
  RoADraft,
  RoAEvidenceItem,
  RoAField,
  RoAModule,
  RoAModuleContract,
  RoAModuleData,
  RoAValidationIssue,
} from './types';
import { FALLBACK_ROA_MODULE_CONTRACTS } from './roaModuleContractFallbacks';

type RuntimeValue = string | number | boolean | string[] | null | undefined;

export interface RoAModuleRuntimeStatus {
  completedRequiredFields: number;
  totalRequiredFields: number;
  completedRequiredEvidence: number;
  totalRequiredEvidence: number;
  percentage: number;
  missingFields: RoAField[];
  missingEvidence: NonNullable<RoAModule['evidence']>['requirements'];
  warnings: RoAValidationIssue[];
  blocking: RoAValidationIssue[];
  complete: boolean;
}

export interface RoANormalizedModuleOutput {
  moduleId: string;
  title: string;
  category?: string;
  normalizedKey: string;
  contractVersion?: number;
  values: Record<string, unknown>;
  sourceData: RoAModuleData;
  evidence: Record<string, RoAEvidenceItem>;
  documentSections: NonNullable<RoAModule['documentSections']>;
  disclosures: string[];
  generatedAt: string;
}

function validateRuntimeEvidence(
  module: RoAModule,
  requirement: NonNullable<RoAModule['evidence']>['requirements'][number],
  evidence: RoAEvidenceItem,
): { blocking: RoAValidationIssue[]; warnings: RoAValidationIssue[] } {
  const blocking: RoAValidationIssue[] = [];
  const warnings: RoAValidationIssue[] = [];
  const issueBase = {
    moduleId: module.id,
    moduleTitle: module.title,
    requirementId: requirement.id,
  };

  if (!hasValue(evidence.fileName)) {
    blocking.push({
      ...issueBase,
      id: `${module.id}:runtime:evidence:${requirement.id}:file_name`,
      severity: 'blocking',
      message: `${requirement.label} evidence must include a file name.`,
    });
  }

  if (evidence.requirementId && evidence.requirementId !== requirement.id) {
    blocking.push({
      ...issueBase,
      id: `${module.id}:runtime:evidence:${requirement.id}:requirement_mismatch`,
      severity: 'blocking',
      message: `${requirement.label} evidence is attached to the wrong requirement slot.`,
    });
  }

  const acceptedMimeTypes = (requirement.acceptedMimeTypes || []).map((type) => type.toLowerCase());
  const mimeType = evidence.mimeType?.toLowerCase() || '';
  if (acceptedMimeTypes.length > 0) {
    if (!mimeType) {
      blocking.push({
        ...issueBase,
        id: `${module.id}:runtime:evidence:${requirement.id}:mime_missing`,
        severity: 'blocking',
        message: `${requirement.label} evidence must include a file type.`,
      });
    } else if (!acceptedMimeTypes.includes(mimeType)) {
      blocking.push({
        ...issueBase,
        id: `${module.id}:runtime:evidence:${requirement.id}:mime_type`,
        severity: 'blocking',
        message: `${requirement.label} evidence must use an accepted file type.`,
      });
    }
  }

  if (typeof evidence.size === 'number' && evidence.size <= 0) {
    blocking.push({
      ...issueBase,
      id: `${module.id}:runtime:evidence:${requirement.id}:empty_file`,
      severity: 'blocking',
      message: `${requirement.label} evidence file is empty.`,
    });
  }

  if (!hasValue(evidence.source)) {
    warnings.push({
      ...issueBase,
      id: `${module.id}:runtime:evidence:${requirement.id}:source_missing`,
      severity: 'warning',
      message: `${requirement.label} evidence source is not recorded.`,
    });
  }

  if (!hasValue(evidence.uploadedAt)) {
    warnings.push({
      ...issueBase,
      id: `${module.id}:runtime:evidence:${requirement.id}:uploaded_at_missing`,
      severity: 'warning',
      message: `${requirement.label} evidence upload timestamp is not recorded.`,
    });
  }

  if (!hasValue(evidence.sha256)) {
    warnings.push({
      ...issueBase,
      id: `${module.id}:runtime:evidence:${requirement.id}:hash_missing`,
      severity: 'warning',
      message: `${requirement.label} evidence hash is not recorded.`,
    });
  }

  return { blocking, warnings };
}

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function snakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

function camelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function getModuleSections(module: RoAModule): NonNullable<RoAModule['formSchema']>['sections'] {
  if (module.formSchema?.sections?.length) return module.formSchema.sections;
  return [{ id: 'details', title: 'Details', fields: module.fields }];
}

export function moduleContractToRuntimeModule(contract: RoAModuleContract): RoAModule {
  const fields = contract.formSchema.sections.flatMap((section) => section.fields).map((field) => {
    const runtimeType = field.type === 'file' ? 'text' : field.type;
    return {
      key: field.key,
      label: field.label,
      type: runtimeType,
      required: field.required,
      options: field.options,
      default: field.default,
      placeholder: field.placeholder,
      helpText: field.helpText,
      source: field.source,
      sourcePath: field.sourcePath,
      validation: field.validation
        ? {
            minLength: field.validation.minLength,
            maxLength: field.validation.maxLength,
            min: field.validation.min,
            max: field.validation.max,
            pattern: field.validation.pattern ? new RegExp(field.validation.pattern) : undefined,
          }
        : undefined,
    } satisfies RoAField;
  });

  return {
    id: contract.id,
    contractVersion: contract.version,
    schemaVersion: contract.schemaVersion,
    metadata: contract.metadata,
    title: contract.title,
    description: contract.description,
    fields,
    input: contract.input,
    formSchema: {
      sections: contract.formSchema.sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) => fields.find((item) => item.key === field.key) || {
          ...field,
          type: field.type === 'file' ? 'text' : field.type,
        }),
      })),
    },
    disclosures: contract.disclosures,
    compileOrder: contract.compileOrder,
    evidence: contract.evidence,
    validation: contract.validation,
    documentSections: contract.documentSections,
    output: contract.output,
    category: contract.category,
  };
}

export function getFallbackRuntimeModules(): RoAModule[] {
  return FALLBACK_ROA_MODULE_CONTRACTS.map(moduleContractToRuntimeModule);
}

export function getFallbackRuntimeModule(moduleId: string): RoAModule | undefined {
  return getFallbackRuntimeModules().find((module) => module.id === moduleId);
}

export function getRequiredFields(module: RoAModule): RoAField[] {
  const requiredKeys = module.validation?.requiredFields || [];
  if (requiredKeys.length > 0) {
    const byKey = new Map(module.fields.map((field) => [field.key, field]));
    return requiredKeys.map((key) => byKey.get(key)).filter((field): field is RoAField => Boolean(field));
  }
  return module.fields.filter((field) => field.required);
}

export function getModuleRuntimeStatus(
  module: RoAModule,
  moduleData: RoAModuleData = {},
  moduleEvidence: Record<string, RoAEvidenceItem> = {},
): RoAModuleRuntimeStatus {
  const requiredFields = getRequiredFields(module);
  const missingFields = requiredFields.filter((field) => !hasValue((moduleData as Record<string, unknown>)[field.key]));
  const requiredEvidence = module.evidence?.requirements.filter((requirement) => requirement.required) || [];
  const missingEvidence = requiredEvidence.filter((requirement) => !hasValue(moduleEvidence[requirement.id]));
  const warnings: RoAValidationIssue[] = [];
  const blocking: RoAValidationIssue[] = [];

  for (const rule of module.validation?.rules || []) {
    const fieldKeys = rule.fieldKeys || [];
    const ruleMissing = fieldKeys.length > 0 && fieldKeys.some((fieldKey) => !hasValue((moduleData as Record<string, unknown>)[fieldKey]));
    if (fieldKeys.length === 0 || ruleMissing) {
      const issue: RoAValidationIssue = {
        id: `${module.id}:runtime:${rule.id}`,
        moduleId: module.id,
        moduleTitle: module.title,
        severity: rule.severity,
        message: rule.message,
        fieldKeys,
      };
      if (rule.severity === 'blocking') blocking.push(issue);
      else warnings.push(issue);
    }
  }

  for (const field of missingFields) {
    blocking.push({
      id: `${module.id}:field:${field.key}`,
      moduleId: module.id,
      moduleTitle: module.title,
      severity: 'blocking',
      message: `${field.label} is required.`,
      fieldKeys: [field.key],
    });
  }

  for (const requirement of missingEvidence) {
    blocking.push({
      id: `${module.id}:evidence:${requirement.id}`,
      moduleId: module.id,
      moduleTitle: module.title,
      severity: 'blocking',
      message: `${requirement.label} evidence is required.`,
      requirementId: requirement.id,
    });
  }

  for (const requirement of module.evidence?.requirements || []) {
    const evidence = moduleEvidence[requirement.id];
    if (!evidence) continue;
    const evidenceIssues = validateRuntimeEvidence(module, requirement, evidence);
    blocking.push(...evidenceIssues.blocking);
    warnings.push(...evidenceIssues.warnings);
  }

  const totalRequired = requiredFields.length + requiredEvidence.length;
  const completedRequired = (requiredFields.length - missingFields.length) + (requiredEvidence.length - missingEvidence.length);
  const percentage = totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 100;

  return {
    completedRequiredFields: requiredFields.length - missingFields.length,
    totalRequiredFields: requiredFields.length,
    completedRequiredEvidence: requiredEvidence.length - missingEvidence.length,
    totalRequiredEvidence: requiredEvidence.length,
    percentage,
    missingFields,
    missingEvidence,
    warnings,
    blocking,
    complete: blocking.length === 0,
  };
}

function findOutputValue(key: string, moduleData: Record<string, unknown>): unknown {
  const candidates = [key, snakeCase(key), camelCase(key)];
  for (const candidate of candidates) {
    if (hasValue(moduleData[candidate])) return moduleData[candidate];
  }
  return undefined;
}

export function normalizeModuleOutput(
  module: RoAModule,
  moduleData: RoAModuleData = {},
  moduleEvidence: Record<string, RoAEvidenceItem> = {},
): RoANormalizedModuleOutput {
  const data = moduleData as Record<string, unknown>;
  const values = Object.fromEntries(
    (module.output?.fields || module.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: 'string' as const,
      required: Boolean(field.required),
    }))).map((field) => [field.key, findOutputValue(field.key, data)]),
  );

  return {
    moduleId: module.id,
    title: module.title,
    category: module.category,
    normalizedKey: module.output?.normalizedKey || module.id,
    contractVersion: module.contractVersion,
    values,
    sourceData: moduleData,
    evidence: moduleEvidence,
    documentSections: module.documentSections || [],
    disclosures: module.disclosures,
    generatedAt: new Date().toISOString(),
  };
}

function resolvePath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    if (!part) return current;
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, source);
}

function valueToText(value: unknown): string {
  if (!hasValue(value)) return 'Not recorded';
  if (Array.isArray(value)) return value.map(valueToText).join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function valueToNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatTemplateValue(value: unknown, filter?: string): string {
  const normalizedFilter = filter?.trim().toLowerCase();
  if (!normalizedFilter) return valueToText(value);

  if (normalizedFilter === 'currency') {
    const amount = valueToNumber(value);
    if (amount === null) return valueToText(value);
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      maximumFractionDigits: 2,
    }).format(amount);
  }

  if (normalizedFilter === 'percentage') {
    const amount = valueToNumber(value);
    if (amount === null) return valueToText(value);
    return `${amount}%`;
  }

  if (normalizedFilter === 'date') {
    if (typeof value !== 'string' && !(value instanceof Date)) return valueToText(value);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return valueToText(value);
    return date.toLocaleDateString('en-ZA');
  }

  return valueToText(value);
}

export function renderRuntimeTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_.-]+)(?:\s*\|\s*([a-zA-Z]+))?\s*}}/g, (_match, path: string, filter?: string) => {
    return formatTemplateValue(resolvePath(context, path), filter);
  });
}

export function buildRuntimeTemplateContext(
  draft: RoADraft,
  moduleId: string,
): Record<string, unknown> {
  return {
    client: draft.clientSnapshot || {},
    adviser: draft.adviserSnapshot || {},
    module: draft.moduleData[moduleId] || {},
    evidence: draft.moduleEvidence?.[moduleId] || {},
    draft,
  };
}

export function getModuleSectionsForRuntime(module: RoAModule): NonNullable<RoAModule['formSchema']>['sections'] {
  return getModuleSections(module);
}

export function coerceRuntimeFieldValue(value: RuntimeValue): string | number | boolean | string[] {
  if (value === undefined || value === null) return '';
  return value;
}
