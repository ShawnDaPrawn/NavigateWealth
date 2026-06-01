/**
 * advice-engine-roa-contract-validation.ts — runtime validation + legacy
 * conversion for RoA module contracts (Phase 7 max-lines split). Extracted
 * verbatim from advice-engine-roa-contract-types.ts, which re-exports it.
 */
import type {
  RoAContractFieldType,
  RoAContractSourceType,
  RoAContractField,
  RoAContractFormSection,
  RoAModuleContract,
  LegacyRoAModule,
} from './advice-engine-roa-contract-types.ts';
import {
  ROA_MODULE_CONTRACT_SCHEMA_FORMAT,
  SYSTEM_USER,
} from './advice-engine-roa-default-contracts.ts';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function ensureString(value: unknown, label: string, errors: string[]): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  errors.push(`${label} is required`);
  return '';
}

function validateId(value: string, label: string, errors: string[]): void {
  if (!/^[a-z0-9][a-z0-9_-]{2,80}$/.test(value)) {
    errors.push(`${label} must use lowercase letters, numbers, hyphens or underscores`);
  }
}

function isAllowed<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

const ALLOWED_TEMPLATE_ROOTS = ['client', 'adviser', 'module', 'evidence', 'draft'] as const;
const ALLOWED_TEMPLATE_FILTERS = ['currency', 'percentage', 'date'] as const;
const EVIDENCE_TOKEN_PROPERTIES = [
  'fileName',
  'label',
  'type',
  'source',
  'sha256',
  'uploadedAt',
] as const;

function extractTemplateTokens(
  template: string,
): Array<{ expression: string; path: string; filter?: string }> {
  const tokens: Array<{ expression: string; path: string; filter?: string }> = [];
  const tokenPattern = /{{\s*([a-zA-Z0-9_.-]+)(?:\s*\|\s*([a-zA-Z]+))?\s*}}/g;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(template)) !== null) {
    tokens.push({
      expression: match[0],
      path: match[1],
      filter: match[2],
    });
  }
  return tokens;
}

export function validateRoAModuleContract(input: unknown): RoAModuleContract {
  const errors: string[] = [];
  if (!isRecord(input)) {
    throw new Error('Module contract must be an object');
  }

  const id = ensureString(input.id, 'id', errors);
  if (id) validateId(id, 'id', errors);

  const title = ensureString(input.title, 'title', errors);
  const description = ensureString(input.description, 'description', errors);
  const category = ensureString(input.category, 'category', errors);
  const status = isAllowed(input.status, ['draft', 'active', 'archived'] as const)
    ? input.status
    : 'draft';
  const version =
    typeof input.version === 'number' && input.version > 0 ? Math.floor(input.version) : 1;
  const schemaVersion =
    typeof input.schemaVersion === 'string' && input.schemaVersion.trim()
      ? input.schemaVersion.trim()
      : '1.0';

  const formSchema = isRecord(input.formSchema) ? input.formSchema : {};
  const sectionsRaw = Array.isArray(formSchema.sections) ? formSchema.sections : [];
  if (sectionsRaw.length === 0)
    errors.push('formSchema.sections must include at least one section');

  const sections: RoAContractFormSection[] = sectionsRaw.map((sectionRaw, sectionIndex) => {
    const section = isRecord(sectionRaw) ? sectionRaw : {};
    const sectionId = ensureString(section.id, `formSchema.sections[${sectionIndex}].id`, errors);
    if (sectionId) validateId(sectionId, `formSchema.sections[${sectionIndex}].id`, errors);
    const fieldsRaw = Array.isArray(section.fields) ? section.fields : [];
    if (fieldsRaw.length === 0)
      errors.push(`formSchema.sections[${sectionIndex}].fields must include at least one field`);

    return {
      id: sectionId,
      title: ensureString(section.title, `formSchema.sections[${sectionIndex}].title`, errors),
      description: typeof section.description === 'string' ? section.description : undefined,
      fields: fieldsRaw.map((fieldRaw, fieldIndex) => {
        const field = isRecord(fieldRaw) ? fieldRaw : {};
        const fieldKey = ensureString(field.key, `field ${fieldIndex} key`, errors);
        if (fieldKey) validateId(fieldKey, `field ${fieldKey}`, errors);
        if (!isAllowed(field.type, ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedFieldTypes)) {
          errors.push(`field ${fieldKey || fieldIndex} has an unsupported type`);
        }
        if (!isAllowed(field.source, ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedSourceTypes)) {
          errors.push(`field ${fieldKey || fieldIndex} has an unsupported source`);
        }

        return {
          key: fieldKey,
          label: ensureString(field.label, `field ${fieldKey || fieldIndex} label`, errors),
          type: (isAllowed(field.type, ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedFieldTypes)
            ? field.type
            : 'text') as RoAContractFieldType,
          required: field.required === true,
          source: (isAllowed(field.source, ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedSourceTypes)
            ? field.source
            : 'moduleInput') as RoAContractSourceType,
          sourcePath: typeof field.sourcePath === 'string' ? field.sourcePath : undefined,
          options: Array.isArray(field.options)
            ? field.options.filter(
                (option): option is string => typeof option === 'string' && !!option.trim(),
              )
            : undefined,
          default: ['string', 'number', 'boolean'].includes(typeof field.default)
            ? (field.default as string | number | boolean)
            : undefined,
          placeholder: typeof field.placeholder === 'string' ? field.placeholder : undefined,
          helpText: typeof field.helpText === 'string' ? field.helpText : undefined,
          validation: isRecord(field.validation)
            ? (field.validation as RoAContractField['validation'])
            : undefined,
        };
      }),
    };
  });

  const inputConfig = isRecord(input.input) ? input.input : {};
  const sourcesRaw = Array.isArray(inputConfig.sources) ? inputConfig.sources : [];
  const gatheringMethodsRaw = Array.isArray(inputConfig.gatheringMethods)
    ? inputConfig.gatheringMethods
    : [];

  const output = isRecord(input.output) ? input.output : {};
  const outputFieldsRaw = Array.isArray(output.fields) ? output.fields : [];
  if (!ensureString(output.normalizedKey, 'output.normalizedKey', errors)) {
    errors.push('output.normalizedKey is required');
  }

  const documentSectionsRaw = Array.isArray(input.documentSections) ? input.documentSections : [];
  if (documentSectionsRaw.length === 0)
    errors.push('documentSections must include at least one section');

  if (status === 'active') {
    const moduleTokenPaths = new Set<string>();
    moduleTokenPaths.add('module.rationale');
    for (const section of sections) {
      for (const field of section.fields) {
        moduleTokenPaths.add(`module.${field.key}`);
      }
    }
    for (const field of outputFieldsRaw.filter(isRecord)) {
      if (typeof field.key === 'string' && field.key.trim()) {
        moduleTokenPaths.add(`module.${field.key.trim()}`);
      }
    }
    const evidenceRequirementIds = new Set(
      Array.isArray((input.evidence as JsonRecord | undefined)?.requirements)
        ? ((input.evidence as JsonRecord).requirements as unknown[])
            .filter(isRecord)
            .map((requirement) => (typeof requirement.id === 'string' ? requirement.id.trim() : ''))
            .filter(Boolean)
        : [],
    );
    const documentSectionIds = new Set<string>();

    documentSectionsRaw.filter(isRecord).forEach((section, index) => {
      const required = section.required !== false;
      const template = typeof section.template === 'string' ? section.template.trim() : '';
      const sectionId = typeof section.id === 'string' ? section.id.trim() : '';
      if (sectionId) {
        validateId(sectionId, `documentSections[${index}].id`, errors);
        documentSectionIds.add(sectionId);
      }
      if (required && !template) {
        errors.push(`documentSections[${index}].template is required before publishing`);
      }
      for (const token of extractTemplateTokens(template)) {
        const root = token.path.split('.')[0];
        if (!isAllowed(root, ALLOWED_TEMPLATE_ROOTS)) {
          errors.push(
            `documentSections[${index}].template uses unsupported token ${token.expression}`,
          );
          continue;
        }
        if (token.filter && !isAllowed(token.filter.toLowerCase(), ALLOWED_TEMPLATE_FILTERS)) {
          errors.push(
            `documentSections[${index}].template uses unsupported filter ${token.filter}`,
          );
        }
        if (root === 'module' && !moduleTokenPaths.has(token.path)) {
          errors.push(
            `documentSections[${index}].template uses unknown module token ${token.expression}`,
          );
        }
        if (root === 'evidence') {
          const [, requirementId, property] = token.path.split('.');
          if (
            !requirementId ||
            !evidenceRequirementIds.has(requirementId) ||
            !isAllowed(property, EVIDENCE_TOKEN_PROPERTIES)
          ) {
            errors.push(
              `documentSections[${index}].template uses unknown evidence token ${token.expression}`,
            );
          }
        }
      }
    });

    const compileOrderRaw = Array.isArray(input.compileOrder) ? input.compileOrder : [];
    compileOrderRaw
      .filter((value): value is string => typeof value === 'string')
      .forEach((sectionId) => {
        if (sectionId !== 'disclosures' && !documentSectionIds.has(sectionId)) {
          errors.push(`compileOrder references unknown document section ${sectionId}`);
        }
      });
  }

  const compilerHintsRaw = input.compilerHints;
  let compilerHints: RoAModuleContract['compilerHints'];
  if (compilerHintsRaw !== undefined && compilerHintsRaw !== null) {
    if (!isRecord(compilerHintsRaw)) {
      errors.push('compilerHints must be an object');
    } else {
      const allowedKeys = new Set(['includeReplacementAnalysis']);
      for (const key of Object.keys(compilerHintsRaw)) {
        if (!allowedKeys.has(key)) {
          errors.push(`compilerHints.${key} is not supported`);
        }
      }
      const flag = compilerHintsRaw.includeReplacementAnalysis;
      if (flag !== undefined && typeof flag !== 'boolean') {
        errors.push('compilerHints.includeReplacementAnalysis must be a boolean');
      }
      if (flag === true) {
        compilerHints = { includeReplacementAnalysis: true };
      }
    }
  }

  const now = new Date().toISOString();

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  return {
    id,
    title,
    description,
    category,
    status,
    version,
    schemaVersion,
    input: {
      sources: sourcesRaw.filter(isRecord).map((source) => ({
        id: String(source.id || ''),
        label: String(source.label || ''),
        type: (isAllowed(source.type, ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedSourceTypes)
          ? source.type
          : 'manual') as RoAContractSourceType,
        required: source.required === true,
        sourcePath: typeof source.sourcePath === 'string' ? source.sourcePath : undefined,
        description: typeof source.description === 'string' ? source.description : undefined,
      })),
      gatheringMethods: gatheringMethodsRaw.filter(
        (method): method is RoAModuleContract['input']['gatheringMethods'][number] =>
          isAllowed(method, ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedGatheringMethods),
      ),
    },
    formSchema: { sections },
    output: {
      normalizedKey: String(output.normalizedKey),
      fields: outputFieldsRaw.filter(isRecord).map((field) => ({
        key: String(field.key || ''),
        label: String(field.label || ''),
        type: isAllowed(field.type, [
          'string',
          'number',
          'boolean',
          'array',
          'object',
          'date',
        ] as const)
          ? field.type
          : 'string',
        required: field.required === true,
        description: typeof field.description === 'string' ? field.description : undefined,
      })),
    },
    validation: {
      requiredFields: Array.isArray((input.validation as JsonRecord | undefined)?.requiredFields)
        ? ((input.validation as JsonRecord).requiredFields as unknown[]).filter(
            (value): value is string => typeof value === 'string',
          )
        : sections.flatMap((section) =>
            section.fields.filter((field) => field.required).map((field) => field.key),
          ),
      rules: Array.isArray((input.validation as JsonRecord | undefined)?.rules)
        ? ((input.validation as JsonRecord).rules as unknown[]).filter(isRecord).map((rule) => ({
            id: String(rule.id || ''),
            severity: isAllowed(
              rule.severity,
              ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedValidationSeverities,
            )
              ? rule.severity
              : 'warning',
            message: String(rule.message || ''),
            fieldKeys: Array.isArray(rule.fieldKeys)
              ? rule.fieldKeys.filter((value): value is string => typeof value === 'string')
              : undefined,
          }))
        : [],
    },
    evidence: {
      requirements: Array.isArray((input.evidence as JsonRecord | undefined)?.requirements)
        ? ((input.evidence as JsonRecord).requirements as unknown[])
            .filter(isRecord)
            .map((requirement) => ({
              id: String(requirement.id || ''),
              label: String(requirement.label || ''),
              type: isAllowed(
                requirement.type,
                ROA_MODULE_CONTRACT_SCHEMA_FORMAT.allowedEvidenceTypes,
              )
                ? requirement.type
                : 'other',
              required: requirement.required === true,
              acceptedMimeTypes: Array.isArray(requirement.acceptedMimeTypes)
                ? requirement.acceptedMimeTypes.filter(
                    (value): value is string => typeof value === 'string',
                  )
                : undefined,
              guidance: typeof requirement.guidance === 'string' ? requirement.guidance : undefined,
            }))
        : [],
    },
    documentSections: documentSectionsRaw.filter(isRecord).map((section, index) => ({
      id: String(section.id || ''),
      title: String(section.title || ''),
      purpose: String(section.purpose || ''),
      order: typeof section.order === 'number' ? section.order : index + 1,
      required: section.required !== false,
      template: typeof section.template === 'string' ? section.template : '',
    })),
    disclosures: Array.isArray(input.disclosures)
      ? input.disclosures.filter((value): value is string => typeof value === 'string')
      : [],
    compileOrder: Array.isArray(input.compileOrder)
      ? input.compileOrder.filter((value): value is string => typeof value === 'string')
      : documentSectionsRaw
          .filter(isRecord)
          .map((section) => String(section.id || ''))
          .filter(Boolean),
    compilerHints,
    metadata: isRecord(input.metadata) ? input.metadata : undefined,
    createdAt: typeof input.createdAt === 'string' ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : now,
    createdBy: typeof input.createdBy === 'string' ? input.createdBy : SYSTEM_USER,
    updatedBy: typeof input.updatedBy === 'string' ? input.updatedBy : SYSTEM_USER,
    publishedAt: typeof input.publishedAt === 'string' ? input.publishedAt : undefined,
  };
}

export function contractToLegacyModule(contract: RoAModuleContract): LegacyRoAModule {
  const fields = contract.formSchema.sections
    .flatMap((section) => section.fields)
    .map((field) => {
      const legacyType =
        field.type === 'currency' || field.type === 'percentage' || field.type === 'file'
          ? field.type === 'file'
            ? 'text'
            : 'number'
          : field.type;

      return {
        key: field.key,
        label: field.label,
        type: legacyType,
        required: field.required,
        options: field.options,
        default: field.default,
        placeholder: field.placeholder,
        helpText: field.helpText,
        validation: field.validation
          ? {
              minLength: field.validation.minLength,
              maxLength: field.validation.maxLength,
              min: field.validation.min,
              max: field.validation.max,
            }
          : undefined,
      };
    });

  return {
    id: contract.id,
    title: contract.title,
    description: contract.description,
    fields,
    disclosures: contract.disclosures,
    compileOrder: contract.compileOrder,
    category: contract.category,
    evidence: contract.evidence,
    validation: contract.validation,
    documentSections: contract.documentSections,
    output: contract.output,
  };
}
