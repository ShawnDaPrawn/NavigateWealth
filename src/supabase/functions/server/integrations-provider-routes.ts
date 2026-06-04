/**
 * Provider / Config / Template routes (Phase 5 Slice A decomposition).
 * ====================================================================
 *
 * Extracted verbatim from integrations.tsx. No logic changes.
 *
 * Routes owned here:
 *   GET  /providers   — list + normalise providers
 *   GET  /config      — read field-mapping config for a provider+category
 *   POST /config      — save field-mapping config
 *   GET  /template    — download a pre-populated integration spreadsheet
 *
 * @module server/integrations-provider-routes
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { requireAuth } from './auth-mw.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { SaveConfigSchema } from './integrations-validation.ts';
import type { KvProvider, KvSchema } from './integrations-types.ts';
import {
  normaliseIntegrationBlankBehavior,
  normaliseIntegrationLabelList,
} from '../../../shared/integrations/binding-utils.ts';
import {
  CANONICAL_TEMPLATE_SHEET_NAME,
  TEMPLATE_DICTIONARY_SHEET_NAME,
  TEMPLATE_INSTRUCTIONS_SHEET_NAME,
  TEMPLATE_METADATA_COLUMNS,
  appendSpreadsheetRowsSheet,
  appendSpreadsheetSheet,
  applyTemplateRowMetadata,
  buildTemplateFileName,
  createSpreadsheetWorkbook,
  encodeSpreadsheetRange,
  isTemplateMetadataColumn,
  jsonRowsToSpreadsheetSheet,
  normalisePolicyNumber,
  rowsToSpreadsheetSheet,
  serialiseTemplateCellValue,
  writeSpreadsheetWorkbook,
} from './integrations-spreadsheet.ts';
import type { IntegrationConfig } from './integrations-core-types.ts';
import {
  normaliseSettings,
  normaliseFieldBindings,
  fieldBindingsToMapping,
  normaliseIntegrationConfig,
} from './integrations-config-utils.ts';
import {
  findPolicyNumberField,
  getSchemaForCategory,
  getPolicyNumberForPolicy,
} from './integrations-field-utils.ts';
import {
  getTemplateFieldBindings,
  listPoliciesForProviderCategory,
} from './integrations-sync-engine.ts';
import { POLICY_CATEGORY_LABELS } from './integrations-document-storage.ts';

const app = new Hono();
const log = createModuleLogger('integrations-provider');

function getCategoryLabel(categoryId: string): string {
  return POLICY_CATEGORY_LABELS[categoryId] || categoryId;
}

// GET /providers - Legacy/Fallback support
// Normalises camelCase ↔ snake_case fields for backward compatibility
app.get('/providers', requireAuth, async (c) => {
  try {
    const providers = await kv.getByPrefix('provider:');

    if (!providers) {
      return c.json({ providers: [] });
    }

    // Normalise: ensure both camelCase and snake_case fields are present
    // so that all consumers (PolicyFormDialog, IntegrationsTab, etc.) work
    const normalised = providers.map((p: Record<string, unknown>) => ({
      ...p,
      // Canonical snake_case
      category_ids:
        (p.category_ids as string[] | undefined) || (p.categoryIds as string[] | undefined) || [],
      logo_url:
        (p.logo_url as string | undefined) || (p.logoUrl as string | undefined) || undefined,
      // Legacy camelCase (for any consumer still expecting it)
      categoryIds:
        (p.category_ids as string[] | undefined) || (p.categoryIds as string[] | undefined) || [],
      logoUrl: (p.logo_url as string | undefined) || (p.logoUrl as string | undefined) || undefined,
    })) as unknown as KvProvider[];

    normalised.sort((a: KvProvider, b: KvProvider) => (a.name || '').localeCompare(b.name || ''));

    return c.json({ providers: normalised });
  } catch (e) {
    log.error('Error fetching providers:', e);
    return c.json({ error: 'Failed to fetch providers' }, 500);
  }
});

// GET /config
app.get('/config', requireAuth, async (c) => {
  const providerId = c.req.query('providerId');
  const categoryId = c.req.query('categoryId');

  if (!providerId || !categoryId) {
    return c.json({ error: 'Missing providerId or categoryId' }, 400);
  }

  const key = `config:mapping:${providerId}:${categoryId}`;
  const config = await kv.get(key);
  const schema = await getSchemaForCategory(categoryId);
  const fields = schema.fields || [];

  if (!config) {
    return c.json({
      providerId,
      categoryId,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
      fieldMapping: {},
      fieldBindings: [],
      settings: {
        autoMap: true,
        ignoreUnmatched: false,
        strictMode: false,
        autoPublish: false,
      },
    });
  }

  return c.json(
    normaliseIntegrationConfig(
      {
        ...(config as IntegrationConfig),
        providerId,
        categoryId,
      },
      fields,
    ),
  );
});

// POST /config
app.post('/config', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = SaveConfigSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { providerId, categoryId, fieldMapping, fieldBindings, settings } = parsed.data;
    const schema = await getSchemaForCategory(categoryId);
    const fields = schema.fields || [];
    const normalisedBindings = normaliseFieldBindings(
      fieldBindings,
      fieldMapping as Record<string, string>,
      fields,
    );

    const key = `config:mapping:${providerId}:${categoryId}`;

    const config: IntegrationConfig = {
      providerId,
      categoryId,
      updatedAt: new Date().toISOString(),
      updatedBy: 'user',
      fieldBindings: normalisedBindings,
      fieldMapping: fieldBindingsToMapping(
        normalisedBindings,
        fieldMapping as Record<string, string>,
      ),
      settings: normaliseSettings(settings as Partial<IntegrationConfig['settings']>),
    };

    await kv.set(key, config);
    return c.json({ success: true, config });
  } catch (e) {
    log.error('Error saving config:', e);
    return c.json({ error: 'Failed to save configuration' }, 500);
  }
});

// GET /template
app.get('/template', requireAuth, async (c) => {
  try {
    const providerId = c.req.query('providerId');
    const categoryId = c.req.query('categoryId');

    if (!providerId || !categoryId) {
      return c.json({ error: 'Missing providerId or categoryId' }, 400);
    }

    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: 'Invalid provider ID' }, 400);
    }

    const schema = await getSchemaForCategory(categoryId);
    const fields = schema.fields || [];
    const storedConfig = (await kv.get(
      `config:mapping:${providerId}:${categoryId}`,
    )) as IntegrationConfig | null;
    const config = normaliseIntegrationConfig(
      storedConfig
        ? {
            ...storedConfig,
            providerId,
            categoryId,
          }
        : null,
      fields,
    );
    const settings = normaliseSettings(config?.settings);
    const templateBindings = getTemplateFieldBindings(config, fields);
    const templateVersion = `${providerId}:${categoryId}:${config.updatedAt || new Date().toISOString()}`;
    const schemaCache = new Map<string, KvSchema>();
    const fieldById = new Map(fields.map((field) => [field.id, field]));
    const providerPolicies = await listPoliciesForProviderCategory(providerId, categoryId);

    const workbook = createSpreadsheetWorkbook();
    const categoryLabel = getCategoryLabel(categoryId);
    const visibleHeaders = templateBindings.map((binding) => binding.columnName);
    const allHeaders = [...visibleHeaders, ...Object.values(TEMPLATE_METADATA_COLUMNS)];

    const instructions = [
      ['Navigate Wealth Integration Template'],
      ['Provider', provider.name || providerId],
      ['Product Type', categoryLabel],
      [
        'Purpose',
        'This workbook mirrors the Mapping Configuration and contains the current database snapshot for this provider/product combination.',
      ],
      [],
      ['Workflow'],
      ['1. Work only in the Integration Update Template sheet.'],
      [
        '2. Each row is prefilled from the current Navigate Wealth policy database for this provider/product type.',
      ],
      [
        '3. Hidden _NW columns keep the stable policy metadata used for safe matching during upload. Do not delete those columns.',
      ],
      [
        '4. Leaving a mapped cell blank normally does not clear the database value unless that field is explicitly configured to clear on blank.',
      ],
      [
        '5. Upload the workbook in Product Configuration > Integrations to stage a sync run, then review and publish the proposed diffs.',
      ],
      [],
      ['Upload Rules'],
      ['Auto-map future uploads', settings.autoMap ? 'Yes' : 'No'],
      ['Ignore unmatched columns', settings.ignoreUnmatched ? 'Yes' : 'No'],
      ['Strict mode', settings.strictMode ? 'Yes' : 'No'],
      ['Auto-publish safe rows', settings.autoPublish ? 'Yes' : 'No'],
    ];
    appendSpreadsheetRowsSheet(workbook, instructions, TEMPLATE_INSTRUCTIONS_SHEET_NAME);

    const templateRows: Record<string, unknown>[] = [];
    const sortablePolicies = await Promise.all(
      providerPolicies.map(async (policy) => {
        const policyNumber = await getPolicyNumberForPolicy(policy, fields, schemaCache);
        return { policy, policyNumber };
      }),
    );

    sortablePolicies.sort(
      (a, b) =>
        a.policyNumber.localeCompare(b.policyNumber) ||
        a.policy.clientId.localeCompare(b.policy.clientId) ||
        a.policy.id.localeCompare(b.policy.id),
    );

    for (const { policy, policyNumber } of sortablePolicies) {
      const visibleRow = Object.fromEntries(
        templateBindings.map((binding) => [
          binding.columnName,
          serialiseTemplateCellValue(policy.data?.[binding.targetFieldId]),
        ]),
      );
      templateRows.push(
        applyTemplateRowMetadata(visibleRow, {
          templateVersion,
          policyId: policy.id,
          clientId: policy.clientId,
          providerId: policy.providerId,
          categoryId: policy.categoryId,
          normalizedPolicyNumber: normalisePolicyNumber(policyNumber),
        }),
      );
    }

    const templateSheet =
      templateRows.length > 0
        ? jsonRowsToSpreadsheetSheet(templateRows, { header: allHeaders })
        : rowsToSpreadsheetSheet([allHeaders]);
    templateSheet['!cols'] = allHeaders.map((header) => ({
      wch: isTemplateMetadataColumn(header) ? 22 : Math.max(16, Math.min(32, header.length + 4)),
      hidden: isTemplateMetadataColumn(header),
    }));
    templateSheet['!autofilter'] = {
      ref: encodeSpreadsheetRange({
        s: { r: 0, c: 0 },
        e: { r: Math.max(templateRows.length, 0), c: allHeaders.length - 1 },
      }),
    };
    appendSpreadsheetSheet(workbook, templateSheet, CANONICAL_TEMPLATE_SHEET_NAME);

    const mappingRows = [
      [
        'Spreadsheet Column',
        'Navigate Wealth Field ID',
        'Navigate Wealth Field',
        'Type',
        'Required',
        'Portal Labels',
        'Selector Override',
        'Blank Behavior',
        'Dropdown Options',
        'Notes',
      ],
      ...templateBindings.map((binding) => [
        binding.columnName,
        binding.targetFieldId,
        binding.targetFieldName || binding.targetFieldId,
        binding.fieldType || 'text',
        binding.required ? 'yes' : 'no',
        normaliseIntegrationLabelList(binding.portalLabels).join(' | '),
        binding.portalSelector || '',
        normaliseIntegrationBlankBehavior(binding.blankBehavior),
        Array.isArray(fieldById.get(binding.targetFieldId)?.options)
          ? (fieldById.get(binding.targetFieldId)?.options as string[]).join('|')
          : '',
        binding.targetFieldId === findPolicyNumberField(fields)?.id
          ? 'Primary match field. Hidden _NW metadata is preferred when present.'
          : normaliseIntegrationBlankBehavior(binding.blankBehavior) === 'clear'
            ? 'Blank uploads for this field are treated as approved clears.'
            : normaliseIntegrationBlankBehavior(binding.blankBehavior) === 'error'
              ? 'Blank uploads for this field are held as validation errors.'
              : 'Only populated changed cells are staged for approval.',
      ]),
    ];
    appendSpreadsheetRowsSheet(workbook, mappingRows, TEMPLATE_DICTIONARY_SHEET_NAME);

    const bytes = writeSpreadsheetWorkbook(workbook);
    const fileName = buildTemplateFileName(provider.name || providerId, categoryLabel);

    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    log.error('Template generation error:', e);
    return c.json({ error: 'Failed to generate integration template' }, 500);
  }
});

export default app;
