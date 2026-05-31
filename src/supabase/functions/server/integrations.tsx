import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { DEFAULT_SCHEMAS } from './default-schemas.ts';
import { createModuleLogger } from "./stderr-logger.ts";
import { getErrMsg } from "./shared-logger-utils.ts";
import { requireAuth } from "./auth-mw.ts";
import { formatZodError } from './shared-validation-utils.ts';
import {
  SaveConfigSchema,
  SaveSchemaInputSchema,
  CreatePolicySchema,
  UpdatePolicySchema,
  ArchivePolicySchema,
  ReinstatePolicySchema,
  RecalculateTotalsSchema,
  PolicyDocumentMetadataSchema,
  DeletePolicyDocumentSchema,
} from './integrations-validation.ts';
import type {
  KvPolicy,
  KvSchema,
  SchemaField,
  KvProvider,
  KvFnaEntry,
  PolicyRenewal,
  PolicyDocument,
} from "./integrations-types.ts";
import {
  extractPolicyDocument,
  getProviderTerminology,
  saveProviderTerminology,
  getAllProviderTerminologies,
  buildHistoryEntry,
} from './policy-extraction-service.ts';
import type {
  ProviderTerminologyMap,
  FieldDiff,
} from './policy-extraction-types.ts';
import {
  buildPortalFieldsFromBindings,
  normaliseIntegrationBlankBehavior,
  normaliseIntegrationLabelList,
} from '../../../shared/integrations/binding-utils.ts';
import {
  CANONICAL_TEMPLATE_SHEET_NAME,
  MAX_INTEGRATION_UPLOAD_BYTES,
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
  readSpreadsheetUpload,
  rowsToSpreadsheetSheet,
  serialiseTemplateCellValue,
  writeSpreadsheetWorkbook,
} from './integrations-spreadsheet.ts';
import type {
  PortalJobStatus,
  PortalAutomationHost,
  PortalJobItemStatus,
  PortalCredentialRecord,
  PortalFlowField,
  PortalProviderFlow,
  PortalSyncJob,
  PortalDiscoveryReport,
} from './integrations-portal-types.ts';
import type {
  IntegrationConfig,
  IntegrationFieldBinding,
  UploadHistory,
  IntegrationSyncRun,
} from './integrations-core-types.ts';
import {
  getDefaultIntegrationSettings,
  normaliseSettings,
  normaliseFieldBindings,
  fieldBindingsToMapping,
  normaliseIntegrationConfig,
} from './integrations-config-utils.ts';
import {
  defaultPortalBrainGoal,
  loadPortalBrainMemory,
  savePortalBrainMemory,
  summarisePortalBrainMemory,
  rememberPortalBrainHint,
  getPortalBrainConfig,
  sanitiseBrainSnapshot,
  callPortalBrainModel,
  parsePortalBrainDecision,
  buildPortalBrainPrompt,
} from './integrations-portal-brain.ts';
import {
  findPolicyNumberField,
  getSchemaForCategory,
  getPolicyNumberForPolicy,
  isValidDate,
} from './integrations-field-utils.ts';
import {
  normalisePortalCredentialProfileId,
  loadPortalCredentialRecord,
  savePortalCredentialRecord,
  portalCredentialStatus,
} from './integrations-portal-credentials.ts';
import {
  requirePortalWorker,
  getPortalAutomationCategoryError,
  portalArtifactsMatchCategory,
} from './integrations-portal-guards.ts';
import {
  uploadPortalLiveView,
  normaliseRunMode,
  dispatchPortalGitHubAction,
} from './integrations-portal-runtime.ts';
import {
  normaliseFlowSteps,
  normaliseSearchConfig,
  normaliseExtractionFields,
  normalisePolicyScheduleConfig,
  normaliseDocumentArtifactConfigs,
  normaliseDocumentArtifactStatuses,
  normalisePortalCredentialProfiles,
  PORTAL_ESTATE_DOCUMENT_TYPES,
} from './integrations-portal-flow-config.ts';
import {
  getDefaultPortalFlow,
  portalFlowKey,
  getPortalJobScopeError,
  getSyncRunScopeError,
  getPortalFlow,
  sanitisePortalFlow,
} from './integrations-portal-flow.ts';
import {
  recalculateClientTotals,
  autoGenerateCustomKeysForSchema,
} from './integrations-derive.ts';
import {
  getTemplateFieldBindings,
  summarisePortalJobItems,
  buildPortalPolicyQueue,
  loadPortalJobItems,
  sanitisePortalWarnings,
  latestPortalWarning,
  persistPortalJobItems,
  listPoliciesForProviderCategory,
  buildSyncRun,
  publishSyncRun,
  stagePortalRows,
  portalRowHasBusinessValue,
  portalItemHasStageableBusinessValue,
} from './integrations-sync-engine.ts';

const app = new Hono();
const log = createModuleLogger('integrations');

// Root handlers
app.get('/', (c) => c.json({ service: 'integrations', status: 'active' }));
app.get('', (c) => c.json({ service: 'integrations', status: 'active' }));

const getByPrefix = async (prefix: string) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data, error } = await supabase
    .from("kv_store_91ed8379")
    .select("value")
    .like("key", prefix + "%");
    
  if (error) throw new Error(error.message);
  return data?.map(d => d.value) || [];
};

function getCategoryLabel(categoryId: string): string {
  return POLICY_CATEGORY_LABELS[categoryId] || categoryId;
}


function buildPortalExtractionFieldsForBindings(
  bindings: IntegrationFieldBinding[],
  existingFields: PortalFlowField[] = [],
): PortalFlowField[] {
  return buildPortalFieldsFromBindings(bindings, existingFields).map((field) => ({
    sourceHeader: field.sourceHeader || field.columnName || '',
    columnName: field.columnName || field.sourceHeader || '',
    targetFieldId: field.targetFieldId,
    targetFieldName: field.targetFieldName,
    selector: field.selector || '',
    labels: normaliseIntegrationLabelList(field.labels),
    attribute: typeof field.attribute === 'string' ? field.attribute : 'text',
    required: field.required === true,
    transform: typeof field.transform === 'string' ? field.transform : 'trim',
  }));
}


// --- Endpoints ---

// GET /providers - Legacy/Fallback support
// Normalises camelCase ↔ snake_case fields for backward compatibility
app.get("/providers", requireAuth, async (c) => {
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
      category_ids: (p.category_ids as string[] | undefined) || (p.categoryIds as string[] | undefined) || [],
      logo_url: (p.logo_url as string | undefined) || (p.logoUrl as string | undefined) || undefined,
      // Legacy camelCase (for any consumer still expecting it)
      categoryIds: (p.category_ids as string[] | undefined) || (p.categoryIds as string[] | undefined) || [],
      logoUrl: (p.logo_url as string | undefined) || (p.logoUrl as string | undefined) || undefined,
    }));
    
    normalised.sort((a: KvProvider, b: KvProvider) => (a.name || '').localeCompare(b.name || ''));
    
    return c.json({ providers: normalised });
  } catch (e) {
    log.error("Error fetching providers:", e);
    return c.json({ error: "Failed to fetch providers" }, 500);
  }
});

// GET /config
app.get("/config", requireAuth, async (c) => {
  const providerId = c.req.query("providerId");
  const categoryId = c.req.query("categoryId");

  if (!providerId || !categoryId) {
    return c.json({ error: "Missing providerId or categoryId" }, 400);
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
      updatedBy: "system",
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

  return c.json(normaliseIntegrationConfig({
    ...(config as IntegrationConfig),
    providerId,
    categoryId,
  }, fields));
});

// POST /config
app.post("/config", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = SaveConfigSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", ...formatZodError(parsed.error) }, 400);
    }
    const { providerId, categoryId, fieldMapping, fieldBindings, settings } = parsed.data;
    const schema = await getSchemaForCategory(categoryId);
    const fields = schema.fields || [];
    const normalisedBindings = normaliseFieldBindings(fieldBindings, fieldMapping as Record<string, string>, fields);

    const key = `config:mapping:${providerId}:${categoryId}`;
    
    const config: IntegrationConfig = {
      providerId,
      categoryId,
      updatedAt: new Date().toISOString(),
      updatedBy: "user",
      fieldBindings: normalisedBindings,
      fieldMapping: fieldBindingsToMapping(normalisedBindings, fieldMapping as Record<string, string>),
      settings: normaliseSettings(settings as Partial<IntegrationConfig['settings']>),
    };

    await kv.set(key, config);
    return c.json({ success: true, config });

  } catch (e) {
    log.error("Error saving config:", e);
    return c.json({ error: "Failed to save configuration" }, 500);
  }
});

// GET /template
app.get("/template", requireAuth, async (c) => {
  try {
    const providerId = c.req.query("providerId");
    const categoryId = c.req.query("categoryId");

    if (!providerId || !categoryId) {
      return c.json({ error: "Missing providerId or categoryId" }, 400);
    }

    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: "Invalid provider ID" }, 400);
    }

    const schema = await getSchemaForCategory(categoryId);
    const fields = schema.fields || [];
    const storedConfig = (await kv.get(`config:mapping:${providerId}:${categoryId}`)) as IntegrationConfig | null;
    const config = normaliseIntegrationConfig(storedConfig ? {
      ...storedConfig,
      providerId,
      categoryId,
    } : null, fields);
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
      ['Purpose', 'This workbook mirrors the Mapping Configuration and contains the current database snapshot for this provider/product combination.'],
      [],
      ['Workflow'],
      ['1. Work only in the Integration Update Template sheet.'],
      ['2. Each row is prefilled from the current Navigate Wealth policy database for this provider/product type.'],
      ['3. Hidden _NW columns keep the stable policy metadata used for safe matching during upload. Do not delete those columns.'],
      ['4. Leaving a mapped cell blank normally does not clear the database value unless that field is explicitly configured to clear on blank.'],
      ['5. Upload the workbook in Product Configuration > Integrations to stage a sync run, then review and publish the proposed diffs.'],
      [],
      ['Upload Rules'],
      ['Auto-map future uploads', settings.autoMap ? 'Yes' : 'No'],
      ['Ignore unmatched columns', settings.ignoreUnmatched ? 'Yes' : 'No'],
      ['Strict mode', settings.strictMode ? 'Yes' : 'No'],
      ['Auto-publish safe rows', settings.autoPublish ? 'Yes' : 'No'],
    ];
    appendSpreadsheetRowsSheet(workbook, instructions, TEMPLATE_INSTRUCTIONS_SHEET_NAME);

    const templateRows: Record<string, unknown>[] = [];
    const sortablePolicies = await Promise.all(providerPolicies.map(async (policy) => {
      const policyNumber = await getPolicyNumberForPolicy(policy, fields, schemaCache);
      return { policy, policyNumber };
    }));

    sortablePolicies.sort((a, b) =>
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
      templateRows.push(applyTemplateRowMetadata(visibleRow, {
        templateVersion,
        policyId: policy.id,
        clientId: policy.clientId,
        providerId: policy.providerId,
        categoryId: policy.categoryId,
        normalizedPolicyNumber: normalisePolicyNumber(policyNumber),
      }));
    }

    const templateSheet = templateRows.length > 0
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
      ['Spreadsheet Column', 'Navigate Wealth Field ID', 'Navigate Wealth Field', 'Type', 'Required', 'Portal Labels', 'Selector Override', 'Blank Behavior', 'Dropdown Options', 'Notes'],
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
    log.error("Template generation error:", e);
    return c.json({ error: "Failed to generate integration template" }, 500);
  }
});

// GET /portal-flows/:providerId
app.get("/portal-flows/:providerId", requireAuth, async (c) => {
  try {
    const providerId = c.req.param("providerId");
    const categoryId = String(c.req.query("categoryId") || '').trim();
    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: "Invalid provider ID" }, 400);
    }

    const flow = await getPortalFlow(provider, providerId, categoryId || undefined);
    return c.json({ success: true, flow: sanitisePortalFlow(flow) });
  } catch (e) {
    log.error("Portal flow fetch error:", e);
    return c.json({ error: "Failed to fetch portal flow" }, 500);
  }
});

// PUT /portal-flows/:providerId
app.put("/portal-flows/:providerId", requireAuth, async (c) => {
  try {
    const providerId = c.req.param("providerId");
    const categoryId = String(c.req.query("categoryId") || '').trim();
    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: "Invalid provider ID" }, 400);
    }

    const body = await c.req.json();
    const defaultFlow = getDefaultPortalFlow(provider, providerId, categoryId || undefined);
    const flow: PortalProviderFlow = {
      ...defaultFlow,
      ...body,
      providerId,
      id: categoryId ? `${providerId}:${categoryId}:default` : body?.id || `${providerId}:default`,
      loginUrl: String(body?.loginUrl || '').trim() || defaultFlow.loginUrl,
      credentialProfiles: normalisePortalCredentialProfiles(body?.credentialProfiles, defaultFlow.credentialProfiles),
      navigation: {
        ...(defaultFlow.navigation || {}),
        ...(body?.navigation || {}),
        policyListSteps: Array.isArray(body?.navigation?.policyListSteps)
          ? normaliseFlowSteps(body.navigation.policyListSteps)
          : defaultFlow.navigation?.policyListSteps || [],
      },
      search: normaliseSearchConfig(body?.search, defaultFlow.search),
      extraction: {
        ...(defaultFlow.extraction || {}),
        ...(body?.extraction || {}),
        fields: normaliseExtractionFields(body?.extraction?.fields, defaultFlow.extraction?.fields || []),
      },
      policySchedule: normalisePolicyScheduleConfig(body?.policySchedule, defaultFlow.policySchedule),
      documentArtifacts: normaliseDocumentArtifactConfigs(body?.documentArtifacts, defaultFlow.documentArtifacts || []),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(portalFlowKey(providerId, categoryId || undefined), flow);
    return c.json({ success: true, flow: sanitisePortalFlow(flow) });
  } catch (e) {
    log.error("Portal flow save error:", e);
    return c.json({ error: `Failed to save portal flow: ${getErrMsg(e)}` }, 500);
  }
});

// DELETE /portal-flows/:providerId
app.delete("/portal-flows/:providerId", requireAuth, async (c) => {
  try {
    const providerId = c.req.param("providerId");
    const categoryId = String(c.req.query("categoryId") || '').trim();
    if (!categoryId) {
      return c.json({ error: "Missing categoryId" }, 400);
    }

    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: "Invalid provider ID" }, 400);
    }

    const currentFlow = await getPortalFlow(provider, providerId, categoryId);
    const defaultFlow = getDefaultPortalFlow(provider, providerId, categoryId);
    const resetFlow: PortalProviderFlow = {
      ...defaultFlow,
      credentialProfiles: Array.isArray(currentFlow.credentialProfiles) && currentFlow.credentialProfiles.length > 0
        ? currentFlow.credentialProfiles
        : defaultFlow.credentialProfiles,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(portalFlowKey(providerId, categoryId), resetFlow);
    return c.json({ success: true, flow: sanitisePortalFlow(resetFlow) });
  } catch (e) {
    log.error("Portal flow reset error:", e);
    return c.json({ error: `Failed to reset portal flow: ${getErrMsg(e)}` }, 500);
  }
});

// GET /portal-flows/:providerId/brain-memory
app.get("/portal-flows/:providerId/brain-memory", requireAuth, async (c) => {
  try {
    const providerId = c.req.param("providerId");
    const categoryId = String(c.req.query("categoryId") || '').trim();
    if (!categoryId) {
      return c.json({ error: "Missing categoryId" }, 400);
    }

    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: "Invalid provider ID" }, 400);
    }

    const flow = await getPortalFlow(provider, providerId, categoryId);
    const memory = await loadPortalBrainMemory(providerId, categoryId);
    const brainConfig = getPortalBrainConfig();
    const summary = summarisePortalBrainMemory(memory, {
      available: brainConfig.available,
      configured: brainConfig.available && flow.search?.brain?.enabled === true,
      model: brainConfig.model,
    });

    return c.json({ success: true, summary });
  } catch (e) {
    log.error("Portal brain memory fetch error:", e);
    return c.json({ error: `Failed to fetch portal brain memory: ${getErrMsg(e)}` }, 500);
  }
});

// GET /portal-flows/:providerId/credentials/:profileId
app.get("/portal-flows/:providerId/credentials/:profileId", requireAuth, async (c) => {
  try {
    const providerId = c.req.param("providerId");
    const profileId = normalisePortalCredentialProfileId(c.req.param("profileId"));
    const categoryId = String(c.req.query("categoryId") || '').trim();
    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: "Invalid provider ID" }, 400);
    }

    const flow = await getPortalFlow(provider, providerId, categoryId || undefined);
    if (!flow.credentialProfiles.some((profile) => profile.id === profileId)) {
      return c.json({ error: "Invalid credential profile" }, 400);
    }

    const record = await loadPortalCredentialRecord(providerId, profileId);
    return c.json({ success: true, status: portalCredentialStatus(record, providerId, profileId) });
  } catch (e) {
    log.error("Portal credential status error:", e);
    return c.json({ error: "Failed to fetch portal credential status" }, 500);
  }
});

// PUT /portal-flows/:providerId/credentials/:profileId
app.put("/portal-flows/:providerId/credentials/:profileId", requireAuth, async (c) => {
  try {
    const providerId = c.req.param("providerId");
    const profileId = normalisePortalCredentialProfileId(c.req.param("profileId"));
    const categoryId = String(c.req.query("categoryId") || '').trim();
    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: "Invalid provider ID" }, 400);
    }

    const flow = await getPortalFlow(provider, providerId, categoryId || undefined);
    if (!flow.credentialProfiles.some((profile) => profile.id === profileId)) {
      return c.json({ error: "Invalid credential profile" }, 400);
    }

    const body = await c.req.json();
    const current = await loadPortalCredentialRecord(providerId, profileId);
    const username = typeof body?.username === 'string' && body.username.trim()
      ? body.username.trim()
      : current?.username || '';
    const password = typeof body?.password === 'string' && body.password
      ? body.password
      : current?.password || '';

    if (!username || !password) {
      return c.json({ error: "Username and password are required the first time credentials are saved" }, 400);
    }

    const record: PortalCredentialRecord = {
      providerId,
      profileId,
      username,
      password,
      updatedAt: new Date().toISOString(),
      updatedBy: String(c.get('userId') || 'admin'),
    };
    await savePortalCredentialRecord(record);

    const profile = flow.credentialProfiles.find((item) => item.id === profileId);
    if (profile && profile.source !== 'supabase_kv') {
      const updatedFlow: PortalProviderFlow = {
        ...flow,
        credentialProfiles: flow.credentialProfiles.map((item) =>
          item.id === profileId ? { ...item, source: 'supabase_kv' } : item
        ),
        updatedAt: new Date().toISOString(),
      };
      await kv.set(portalFlowKey(providerId, categoryId || undefined), updatedFlow);
    }

    return c.json({ success: true, status: portalCredentialStatus(record, providerId, profileId) });
  } catch (e) {
    log.error("Portal credential save error:", e);
    return c.json({ error: `Failed to save portal credentials: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-jobs
app.post("/portal-jobs", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const providerId = String(body?.providerId || '');
    const categoryId = String(body?.categoryId || '');

    if (!providerId || !categoryId) {
      return c.json({ error: "Missing providerId or categoryId" }, 400);
    }

    const automationCategoryError = getPortalAutomationCategoryError(categoryId);
    if (automationCategoryError) {
      return c.json({ error: automationCategoryError }, 400);
    }

    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: "Invalid provider ID" }, 400);
    }

    const flow = await getPortalFlow(provider, providerId, categoryId);
    const credentialProfileId = normalisePortalCredentialProfileId(String(body?.credentialProfileId || flow.credentialProfiles[0]?.id || ''));
    if (!credentialProfileId || !flow.credentialProfiles.some((profile) => profile.id === credentialProfileId)) {
      return c.json({ error: "Invalid credential profile" }, 400);
    }
    const credentialRecord = await loadPortalCredentialRecord(providerId, credentialProfileId);
    if (!credentialRecord?.username || !credentialRecord?.password) {
      return c.json({ error: "Save the provider portal username and password before creating a portal job" }, 400);
    }

    const runMode = normaliseRunMode(body?.runMode);
    const requestedPolicySchedule = normalisePolicyScheduleConfig(body?.policySchedule, flow.policySchedule);
    const requestedDocumentArtifacts = normaliseDocumentArtifactConfigs(body?.documentArtifacts, flow.documentArtifacts || []);

    const now = new Date().toISOString();
    const job: PortalSyncJob = {
      id: crypto.randomUUID(),
      providerId,
      providerName: provider.name || 'Unknown Provider',
      categoryId,
      status: 'queued',
      runMode,
      automationHost: 'github_actions',
      flowId: flow.id,
      credentialProfileId,
      policySchedule: requestedPolicySchedule,
      documentArtifacts: requestedDocumentArtifacts,
      createdAt: now,
      updatedAt: now,
      currentStep: 'queued',
      message: 'Portal sync job queued. Starting GitHub Actions worker.',
    };

    const schema = await getSchemaForCategory(categoryId);
    const items = await buildPortalPolicyQueue(job, schema.fields || []);
    if (items.length === 0) {
      return c.json({
        error: `No active ${provider.name || 'provider'} policies with policy numbers were found for this category. Add the policies in client profiles before starting portal automation.`,
      }, 400);
    }

    job.queueSummary = summarisePortalJobItems(items);
    job.message = `Found ${items.length} active policy${items.length === 1 ? '' : 'ies'} to update. Starting GitHub Actions worker.`;

    await kv.set(`portal-job:${job.id}`, job);
    await kv.set(`portal-job-items:${job.id}`, items);
    await kv.set(`portal-job:latest:${providerId}:${categoryId}`, { jobId: job.id, updatedAt: now });

    const dispatchPatch = await dispatchPortalGitHubAction(job).catch((error) => ({
      automationHost: 'manual' as PortalAutomationHost,
      actionsDispatchError: getErrMsg(error).slice(0, 500),
      message: `Portal job queued, but GitHub Actions did not start: ${getErrMsg(error)}`.slice(0, 500),
    }));
    const finalJob: PortalSyncJob = {
      ...job,
      ...dispatchPatch,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`portal-job:${job.id}`, finalJob);

    return c.json({ success: true, job: finalJob, flow: sanitisePortalFlow(flow) });
  } catch (e) {
    log.error("Portal job create error:", e);
    return c.json({ error: `Failed to create portal job: ${getErrMsg(e)}` }, 500);
  }
});

// GET /portal-jobs/latest
app.get("/portal-jobs/latest", requireAuth, async (c) => {
  try {
    const providerId = c.req.query("providerId");
    const categoryId = c.req.query("categoryId");

    if (!providerId || !categoryId) {
      return c.json({ error: "Missing providerId or categoryId" }, 400);
    }

    const latest = (await kv.get(`portal-job:latest:${providerId}:${categoryId}`)) as { jobId: string } | null;
    if (!latest?.jobId) {
      return c.json({ success: true, job: null });
    }

    const job = (await kv.get(`portal-job:${latest.jobId}`)) as PortalSyncJob | null;
    if (!job || getPortalJobScopeError(job, providerId, categoryId)) {
      await kv.del(`portal-job:latest:${providerId}:${categoryId}`);
      return c.json({ success: true, job: null });
    }
    const stagedRun = job.stagedRunId
      ? (await kv.get(`sync-run:${job.stagedRunId}`)) as IntegrationSyncRun | null
      : null;
    const items = stagedRun ? [] : await loadPortalJobItems(job.id);
    if (!portalArtifactsMatchCategory(categoryId, { stagedRun, items })) {
      await kv.del(`portal-job:latest:${providerId}:${categoryId}`);
      return c.json({ success: true, job: null });
    }
    return c.json({ success: true, job });
  } catch (e) {
    log.error("Latest portal job fetch error:", e);
    return c.json({ error: "Failed to fetch latest portal job" }, 500);
  }
});

// GET /portal-jobs/:jobId
app.get("/portal-jobs/:jobId", requireAuth, async (c) => {
  try {
    const jobId = c.req.param("jobId");
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
    }
    const scopeError = getPortalJobScopeError(job, c.req.query("providerId"), c.req.query("categoryId"));
    if (scopeError) {
      return c.json({ error: scopeError }, 409);
    }
    return c.json({ success: true, job });
  } catch (e) {
    log.error("Portal job fetch error:", e);
    return c.json({ error: "Failed to fetch portal job" }, 500);
  }
});

// GET /portal-jobs/:jobId/items
app.get("/portal-jobs/:jobId/items", requireAuth, async (c) => {
  try {
    const jobId = c.req.param("jobId");
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
    }
    const scopeError = getPortalJobScopeError(job, c.req.query("providerId"), c.req.query("categoryId"));
    if (scopeError) {
      return c.json({ error: scopeError }, 409);
    }

    const items = await loadPortalJobItems(jobId);
    return c.json({ success: true, items, summary: summarisePortalJobItems(items) });
  } catch (e) {
    log.error("Portal job items fetch error:", e);
    return c.json({ error: "Failed to fetch portal job policy queue" }, 500);
  }
});

async function persistPortalLiveViewUpdate(jobId: string, formData: Record<string, string | File>) {
  const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
  if (!job) {
    return { error: 'Portal job not found', status: 404 as const };
  }

  const file = formData.file;
  if (!file || !(file instanceof File)) {
    return { error: 'No screenshot file provided', status: 400 as const };
  }

  const liveView = await uploadPortalLiveView(job, file, {
    pageUrl: formData.pageUrl,
    pageTitle: formData.pageTitle,
    note: formData.note,
  });

  const updatedJob: PortalSyncJob = {
    ...job,
    liveView,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(`portal-job:${jobId}`, updatedJob);
  await kv.set(`portal-job:latest:${job.providerId}:${job.categoryId}`, { jobId: job.id, updatedAt: updatedJob.updatedAt });
  return { job: updatedJob };
}

// POST /portal-jobs/:jobId/items/:itemId/retry
app.post("/portal-jobs/:jobId/items/:itemId/retry", requireAuth, async (c) => {
  try {
    const jobId = c.req.param("jobId");
    const itemId = c.req.param("itemId");
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
    }
    const body = await c.req.json().catch(() => ({}));
    const scopeError = getPortalJobScopeError(job, body?.providerId, body?.categoryId);
    if (scopeError) {
      return c.json({ error: scopeError }, 409);
    }

    const items = await loadPortalJobItems(jobId);
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      return c.json({ error: "Portal job policy item not found" }, 404);
    }

    const now = new Date().toISOString();
    items[itemIndex] = {
      ...items[itemIndex],
      status: 'queued',
      currentStep: 'queued',
      message: 'Queued for retry.',
      error: undefined,
      warning: undefined,
      warnings: [],
      workerId: undefined,
      startedAt: undefined,
      completedAt: undefined,
      updatedAt: now,
    };

    const updatedJob = await persistPortalJobItems(job, items, {
      status: ['staged', 'failed', 'cancelled'].includes(job.status) ? 'queued' : job.status,
      currentStep: 'retry_queued',
      message: `Queued ${items[itemIndex].clientName} / ${items[itemIndex].policyNumber} for retry.`,
    });

    return c.json({ success: true, item: items[itemIndex], job: updatedJob, items, summary: updatedJob.queueSummary });
  } catch (e) {
    log.error("Portal job item retry error:", e);
    return c.json({ error: `Failed to retry policy item: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-jobs/:jobId/status
app.post("/portal-jobs/:jobId/status", requireAuth, async (c) => {
  try {
    const jobId = c.req.param("jobId");
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const allowedStatuses: PortalJobStatus[] = ['queued', 'running', 'waiting_for_otp', 'discovering', 'discovery_ready', 'extracting', 'dry_run_ready', 'staging', 'staged', 'failed', 'cancelled'];
    const status = allowedStatuses.includes(body?.status) ? body.status as PortalJobStatus : job.status;
    const warnings = sanitisePortalWarnings(body?.warnings ?? body?.warning, job.warnings);
    const updated: PortalSyncJob = {
      ...job,
      status,
      updatedAt: new Date().toISOString(),
      startedAt: job.startedAt || (status !== 'queued' ? new Date().toISOString() : undefined),
      completedAt: ['discovery_ready', 'dry_run_ready', 'staged', 'failed', 'cancelled'].includes(status) ? new Date().toISOString() : undefined,
      currentStep: typeof body?.currentStep === 'string' ? body.currentStep : job.currentStep,
      message: typeof body?.message === 'string' ? body.message.slice(0, 500) : job.message,
      extractedRows: typeof body?.extractedRows === 'number' ? body.extractedRows : job.extractedRows,
      error: typeof body?.error === 'string' ? body.error.slice(0, 1000) : job.error,
      warnings,
      warning: latestPortalWarning(warnings),
    };

    await kv.set(`portal-job:${jobId}`, updated);
    return c.json({ success: true, job: updated });
  } catch (e) {
    log.error("Portal job status update error:", e);
    return c.json({ error: `Failed to update portal job: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-jobs/:jobId/live-view
app.post("/portal-jobs/:jobId/live-view", requireAuth, async (c) => {
  try {
    let formData: Record<string, string | File>;
    try {
      formData = await c.req.parseBody();
    } catch (parseErr) {
      log.error("Portal live view parse error:", parseErr);
      return c.json({ error: "Invalid form data. Expected multipart/form-data with a screenshot file." }, 400);
    }

    const result = await persistPortalLiveViewUpdate(c.req.param("jobId"), formData);
    if ('error' in result) {
      return c.json({ error: result.error }, result.status);
    }
    return c.json({ success: true, job: result.job });
  } catch (e) {
    log.error("Portal live view upload error:", e);
    return c.json({ error: `Failed to upload portal live view: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-jobs/:jobId/discovery-report
app.post("/portal-jobs/:jobId/discovery-report", requireAuth, async (c) => {
  try {
    const jobId = c.req.param("jobId");
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
    }

    const body = await c.req.json();
    const mode = body?.mode === 'dry-run' ? 'dry-run' : 'discover';
    const now = new Date().toISOString();
    const report: PortalDiscoveryReport = {
      id: crypto.randomUUID(),
      jobId,
      providerId: job.providerId,
      categoryId: job.categoryId,
      createdAt: now,
      mode,
      urlHost: String(body?.urlHost || '').slice(0, 200),
      title: typeof body?.title === 'string' ? body.title.slice(0, 200) : undefined,
      summary: {
        inputCount: Number(body?.summary?.inputCount || 0),
        buttonCount: Number(body?.summary?.buttonCount || 0),
        linkCount: Number(body?.summary?.linkCount || 0),
        tableCount: Number(body?.summary?.tableCount || 0),
        candidatePolicyTables: Number(body?.summary?.candidatePolicyTables || 0),
        extractedRowCount: typeof body?.summary?.extractedRowCount === 'number' ? body.summary.extractedRowCount : undefined,
      },
      selectorCandidates: Array.isArray(body?.selectorCandidates)
        ? body.selectorCandidates.slice(0, 200).map((candidate: Record<string, unknown>) => ({
            purpose: ['input', 'button', 'link', 'table', 'policy_row', 'field'].includes(String(candidate.purpose))
              ? candidate.purpose as PortalDiscoveryReport['selectorCandidates'][number]['purpose']
              : 'field',
            selector: String(candidate.selector || '').slice(0, 500),
            tag: typeof candidate.tag === 'string' ? candidate.tag.slice(0, 40) : undefined,
            type: typeof candidate.type === 'string' ? candidate.type.slice(0, 80) : undefined,
            role: typeof candidate.role === 'string' ? candidate.role.slice(0, 80) : undefined,
            label: typeof candidate.label === 'string' ? candidate.label.slice(0, 120) : undefined,
            confidence: ['low', 'medium', 'high'].includes(String(candidate.confidence))
              ? candidate.confidence as 'low' | 'medium' | 'high'
              : 'low',
            notes: typeof candidate.notes === 'string' ? candidate.notes.slice(0, 300) : undefined,
          }))
        : [],
      tableSummaries: Array.isArray(body?.tableSummaries)
        ? body.tableSummaries.slice(0, 50).map((table: Record<string, unknown>) => ({
            selector: String(table.selector || '').slice(0, 500),
            headerTexts: Array.isArray(table.headerTexts)
              ? table.headerTexts.slice(0, 30).map((header) => String(header).slice(0, 120))
              : [],
            rowCount: Number(table.rowCount || 0),
          }))
        : [],
      warnings: Array.isArray(body?.warnings) ? body.warnings.slice(0, 50).map((warning) => String(warning).slice(0, 300)) : [],
    };

    await kv.set(`portal-discovery-report:${report.id}`, report);
    await kv.set(`portal-discovery-report:latest:${jobId}`, { reportId: report.id, updatedAt: now });

    const updatedJob: PortalSyncJob = {
      ...job,
      status: mode === 'dry-run' ? 'dry_run_ready' : 'discovery_ready',
      updatedAt: now,
      completedAt: now,
      currentStep: mode === 'dry-run' ? 'dry_run_ready' : 'discovery_ready',
      message: mode === 'dry-run'
        ? `Dry run completed. ${report.summary.extractedRowCount || 0} rows would be extracted; no policies were updated.`
        : 'Discovery report captured. Review selector candidates before staging provider data.',
      extractedRows: report.summary.extractedRowCount ?? job.extractedRows,
      discoveryReportId: report.id,
    };
    await kv.set(`portal-job:${jobId}`, updatedJob);

    return c.json({ success: true, job: updatedJob, report });
  } catch (e) {
    log.error("Portal discovery report save error:", e);
    return c.json({ error: `Failed to save discovery report: ${getErrMsg(e)}` }, 500);
  }
});

// GET /portal-jobs/:jobId/discovery-report
app.get("/portal-jobs/:jobId/discovery-report", requireAuth, async (c) => {
  try {
    const jobId = c.req.param("jobId");
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
    }
    const scopeError = getPortalJobScopeError(job, c.req.query("providerId"), c.req.query("categoryId"));
    if (scopeError) {
      return c.json({ error: scopeError }, 409);
    }

    const latest = (await kv.get(`portal-discovery-report:latest:${jobId}`)) as { reportId: string } | null;
    if (!latest?.reportId) {
      return c.json({ success: true, report: null });
    }

    const report = (await kv.get(`portal-discovery-report:${latest.reportId}`)) as PortalDiscoveryReport | null;
    return c.json({ success: true, report });
  } catch (e) {
    log.error("Portal discovery report fetch error:", e);
    return c.json({ error: "Failed to fetch discovery report" }, 500);
  }
});

// POST /portal-jobs/:jobId/otp
app.post("/portal-jobs/:jobId/otp", requireAuth, async (c) => {
  try {
    const jobId = c.req.param("jobId");
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
    }

    const body = await c.req.json();
    const scopeError = getPortalJobScopeError(job, body?.providerId, body?.categoryId);
    if (scopeError) {
      return c.json({ error: scopeError }, 409);
    }
    const otp = String(body?.otp || '').trim();
    if (!/^[0-9A-Za-z]{4,12}$/.test(otp)) {
      return c.json({ error: "OTP must be 4 to 12 letters or numbers" }, 400);
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await kv.set(`portal-job-otp:${jobId}`, { otp, expiresAt, createdAt: new Date().toISOString() });
    const updated: PortalSyncJob = {
      ...job,
      updatedAt: new Date().toISOString(),
      message: 'OTP supplied. Worker can continue.',
    };
    await kv.set(`portal-job:${jobId}`, updated);

    return c.json({ success: true, job: updated });
  } catch (e) {
    log.error("Portal job OTP submit error:", e);
    return c.json({ error: `Failed to submit OTP: ${getErrMsg(e)}` }, 500);
  }
});

// GET /portal-jobs/:jobId/otp
app.get("/portal-jobs/:jobId/otp", requireAuth, async (c) => {
  try {
    const jobId = c.req.param("jobId");
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
    }

    const otpEntry = (await kv.get(`portal-job-otp:${jobId}`)) as { otp: string; expiresAt: string } | null;
    if (!otpEntry) {
      return c.json({ success: true, otp: null });
    }

    if (new Date(otpEntry.expiresAt).getTime() < Date.now()) {
      await kv.del(`portal-job-otp:${jobId}`);
      return c.json({ success: true, otp: null, expired: true });
    }

    await kv.del(`portal-job-otp:${jobId}`);
    return c.json({ success: true, otp: otpEntry.otp });
  } catch (e) {
    log.error("Portal job OTP fetch error:", e);
    return c.json({ error: `Failed to fetch OTP: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-jobs/:jobId/stage
app.post("/portal-jobs/:jobId/stage", requireAuth, async (c) => {
  try {
    const jobId = c.req.param("jobId");
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
    }

    const body = await c.req.json();
    const rawRows = Array.isArray(body?.rows) ? body.rows as Record<string, unknown>[] : [];
    if (rawRows.length === 0) {
      return c.json({ error: "No extracted rows supplied" }, 400);
    }

    const { job: updatedJob, stagedRun } = await stagePortalRows(jobId, rawRows);
    return c.json({ success: true, job: updatedJob, stagedRun });
  } catch (e) {
    log.error("Portal job staging error:", e);
    return c.json({ error: `Failed to stage portal rows: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/claim
app.post("/portal-worker/jobs/claim", async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const body = await c.req.json().catch(() => ({}));
    const requestedMode = typeof body?.runMode === 'string' ? body.runMode : undefined;
    const workerId = String(body?.workerId || 'portal-worker').slice(0, 120);
    const jobs = (await kv.listByPrefix('portal-job:', { limit: 500 }))
      .map((entry) => entry.value as Partial<PortalSyncJob>)
      .filter((job): job is PortalSyncJob => !!job?.id && job.status === 'queued')
      .filter((job) => !requestedMode || normaliseRunMode(job.runMode) === normaliseRunMode(requestedMode))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const job = jobs[0];
    if (!job) {
      return c.json({ success: true, job: null });
    }

    const now = new Date().toISOString();
    const claimed: PortalSyncJob = {
      ...job,
      status: 'running',
      workerId,
      startedAt: job.startedAt || now,
      updatedAt: now,
      currentStep: 'worker_claimed',
      message: `Hosted Playwright worker claimed ${normaliseRunMode(job.runMode)} job.`,
    };
    await kv.set(`portal-job:${job.id}`, claimed);
    return c.json({ success: true, job: claimed });
  } catch (e) {
    log.error("Portal worker claim error:", e);
    return c.json({ error: `Failed to claim portal job: ${getErrMsg(e)}` }, 500);
  }
});

// GET /portal-worker/jobs/:jobId/runtime
app.get("/portal-worker/jobs/:jobId/runtime", async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param("jobId");
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
    }
    const provider = (await kv.get(`provider:${job.providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: "Invalid provider ID" }, 400);
    }
    const flow = await getPortalFlow(provider, job.providerId, job.categoryId);
    const schema = await getSchemaForCategory(job.categoryId);
    const storedConfig = (await kv.get(`config:mapping:${job.providerId}:${job.categoryId}`)) as IntegrationConfig | null;
    const config = storedConfig
      ? normaliseIntegrationConfig({
          ...storedConfig,
          providerId: job.providerId,
          categoryId: job.categoryId,
        }, schema.fields || [])
      : null;
    const flowForJobRequest: PortalProviderFlow = {
      ...flow,
      policySchedule: normalisePolicyScheduleConfig(job.policySchedule, flow.policySchedule),
      documentArtifacts: normaliseDocumentArtifactConfigs(job.documentArtifacts, flow.documentArtifacts || []),
    };
    const flowForJobCategory = config
      ? {
          ...flowForJobRequest,
          extraction: {
            ...flowForJobRequest.extraction,
            fields: buildPortalExtractionFieldsForBindings(
              getTemplateFieldBindings(config, schema.fields || []),
              Array.isArray(flowForJobRequest.extraction?.fields) ? flowForJobRequest.extraction.fields : [],
            ),
          },
        }
      : flowForJobRequest;
    const items = await loadPortalJobItems(jobId);
    const brainConfig = getPortalBrainConfig();
    const brainMemory = await loadPortalBrainMemory(job.providerId, job.categoryId);
    const credentialRecord = await loadPortalCredentialRecord(job.providerId, job.credentialProfileId);
    if (!credentialRecord?.username || !credentialRecord?.password) {
      return c.json({ error: "Provider credentials are not saved for this job" }, 400);
    }
    return c.json({
      success: true,
      job,
      flow: flowForJobCategory,
      config: config ? { ...config, settings: normaliseSettings(config.settings) } : null,
      items,
      credentials: {
        username: credentialRecord.username,
        password: credentialRecord.password,
      },
      brain: {
        available: brainConfig.available,
        configured: brainConfig.available && flowForJobCategory.search?.brain?.enabled === true,
        model: brainConfig.model,
        memory: brainMemory,
        summary: summarisePortalBrainMemory(brainMemory, {
          available: brainConfig.available,
          configured: brainConfig.available && flowForJobCategory.search?.brain?.enabled === true,
          model: brainConfig.model,
        }),
      },
    });
  } catch (e) {
    log.error("Portal worker runtime error:", e);
    return c.json({ error: `Failed to load worker runtime: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/brain/decide
app.post("/portal-worker/jobs/:jobId/brain/decide", async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param("jobId");
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
    }

    const provider = (await kv.get(`provider:${job.providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: "Invalid provider ID" }, 400);
    }

    const flow = await getPortalFlow(provider, job.providerId, job.categoryId);
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const stage = String(body.stage || '');
    const policyNumber = String(body.policyNumber || '').trim();
    const snapshot = (body.snapshot && typeof body.snapshot === 'object') ? body.snapshot as Record<string, unknown> : null;
    if (!['search_input', 'search_result'].includes(stage) || !policyNumber || !snapshot) {
      return c.json({ error: "stage, policyNumber, and snapshot are required" }, 400);
    }

    const candidates = Array.isArray(snapshot.candidates) ? snapshot.candidates as Array<Record<string, unknown>> : [];
    if (candidates.length === 0) {
      return c.json({ error: "No visible candidates were supplied for the brain" }, 400);
    }

    const brain = getPortalBrainConfig();
    if (!brain.available || flow.search?.brain?.enabled !== true) {
      return c.json({
        success: true,
        available: false,
        decision: {
          action: 'stop_uncertain',
          candidateId: null,
          confidence: 'low',
          reason: flow.search?.brain?.enabled !== true
            ? 'Smart search assist is disabled for this provider.'
            : 'Google-hosted brain API is not configured on the backend.',
        },
      });
    }

    const memory = await loadPortalBrainMemory(job.providerId, job.categoryId);
    memory.stats.brainCalls += 1;
    await savePortalBrainMemory(memory);

    const prompt = buildPortalBrainPrompt({
      providerName: job.providerName,
      goal: flow.search?.brain?.goal || defaultPortalBrainGoal(job.providerName),
      stage: stage as 'search_input' | 'search_result',
      policyNumber,
      instructions: flow.search?.instructions,
      labels: flow.search?.searchInputLabels,
      memory,
      snapshot: sanitiseBrainSnapshot({
        ...snapshot,
        candidates: candidates.slice(0, 20).map((candidate) => ({
          candidateId: String(candidate.candidateId || '').slice(0, 80),
          selector: String(candidate.selector || '').slice(0, 500),
          tag: String(candidate.tag || '').slice(0, 40),
          type: String(candidate.type || '').slice(0, 60),
          role: String(candidate.role || '').slice(0, 60),
          placeholder: String(candidate.placeholder || '').slice(0, 120),
          name: String(candidate.name || '').slice(0, 120),
          id: String(candidate.id || '').slice(0, 120),
          ariaLabel: String(candidate.ariaLabel || '').slice(0, 120),
          title: String(candidate.title || '').slice(0, 120),
          text: String(candidate.text || '').slice(0, 240),
          nearbyText: String(candidate.nearbyText || '').slice(0, 240),
        })),
      }, [policyNumber]) as Record<string, unknown>,
    });

    const result = await callPortalBrainModel({
      prompt,
      model: brain.model,
      apiBase: brain.apiBase,
      apiKey: brain.apiKey,
    });
    const parsed = parsePortalBrainDecision(result.text);
    const candidateIds = new Set(candidates.map((candidate) => String(candidate.candidateId || '')).filter(Boolean));
    const action = parsed.action === 'use_candidate' ? 'use_candidate' : 'stop_uncertain';
    const candidateId = action === 'use_candidate' && candidateIds.has(String(parsed.candidateId || ''))
      ? String(parsed.candidateId)
      : null;
    const confidence = ['high', 'medium', 'low'].includes(String(parsed.confidence))
      ? String(parsed.confidence)
      : 'low';
    const reason = String(parsed.reason || 'No reason supplied.').trim().slice(0, 300);

    return c.json({
      success: true,
      available: true,
      model: brain.model,
      decision: {
        action: candidateId ? action : 'stop_uncertain',
        candidateId,
        confidence,
        reason,
      },
      summary: summarisePortalBrainMemory(memory, {
        available: true,
        configured: true,
        model: brain.model,
      }),
    });
  } catch (e) {
    log.error("Portal brain decision error:", e);
    return c.json({ error: `Failed to get a brain decision: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/brain/memory
app.post("/portal-worker/jobs/:jobId/brain/memory", async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param("jobId");
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
    }

    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const stage = String(body.stage || '').trim();
    const selector = String(body.selector || '').trim();
    if (!['search_input', 'search_result'].includes(stage) || !selector) {
      return c.json({ error: "stage and selector are required" }, 400);
    }

    const memory = await loadPortalBrainMemory(job.providerId, job.categoryId);
    if (stage === 'search_input') {
      memory.searchInputHints = rememberPortalBrainHint(memory.searchInputHints, {
        selector,
        label: typeof body.label === 'string' ? body.label : undefined,
        notes: typeof body.notes === 'string' ? body.notes : undefined,
        source: body.source === 'deterministic' || body.source === 'manual' ? body.source : 'brain',
      });
      memory.stats.searchInputSuccesses += 1;
    } else {
      memory.searchResultHints = rememberPortalBrainHint(memory.searchResultHints, {
        selector,
        label: typeof body.label === 'string' ? body.label : undefined,
        notes: typeof body.notes === 'string' ? body.notes : undefined,
        source: body.source === 'deterministic' || body.source === 'manual' ? body.source : 'brain',
      });
      memory.stats.searchResultSuccesses += 1;
    }

    if (body.source !== 'deterministic' && body.source !== 'manual') {
      memory.stats.successfulDecisions += 1;
    }

    await savePortalBrainMemory(memory);
    const brain = getPortalBrainConfig();
    return c.json({
      success: true,
      memory,
      summary: summarisePortalBrainMemory(memory, {
        available: brain.available,
        configured: brain.available,
        model: brain.model,
      }),
    });
  } catch (e) {
    log.error("Portal brain memory update error:", e);
    return c.json({ error: `Failed to update portal brain memory: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/items/claim
app.post("/portal-worker/jobs/:jobId/items/claim", async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param("jobId");
    const body = await c.req.json().catch(() => ({}));
    const workerId = String(body?.workerId || 'portal-worker').slice(0, 120);
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
    }

    const items = await loadPortalJobItems(jobId);
    const staleBefore = Date.now() - 10 * 60 * 1000;
    const itemIndex = items.findIndex((item) =>
      item.status === 'queued' ||
      (item.status === 'in_progress' && new Date(item.updatedAt).getTime() < staleBefore)
    );

    if (itemIndex === -1) {
      return c.json({ success: true, item: null, summary: summarisePortalJobItems(items) });
    }

    const now = new Date().toISOString();
    items[itemIndex] = {
      ...items[itemIndex],
      status: 'in_progress',
      workerId,
      currentStep: 'searching_policy',
      message: `Searching provider portal for policy ${items[itemIndex].policyNumber}.`,
      startedAt: items[itemIndex].startedAt || now,
      updatedAt: now,
    };

    const updatedJob = await persistPortalJobItems(job, items, {
      status: 'extracting',
      workerId,
      startedAt: job.startedAt || now,
      currentStep: 'searching_policy',
      currentItemId: items[itemIndex].id,
      currentClientName: items[itemIndex].clientName,
      currentPolicyNumber: items[itemIndex].policyNumber,
      message: `Working on ${items[itemIndex].clientName} / ${items[itemIndex].policyNumber}.`,
    });

    return c.json({ success: true, item: items[itemIndex], job: updatedJob, summary: updatedJob.queueSummary });
  } catch (e) {
    log.error("Portal worker item claim error:", e);
    return c.json({ error: `Failed to claim policy item: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/items/:itemId/status
app.post("/portal-worker/jobs/:jobId/items/:itemId/status", async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param("jobId");
    const itemId = c.req.param("itemId");
    const body = await c.req.json().catch(() => ({}));
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
    }

    const items = await loadPortalJobItems(jobId);
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      return c.json({ error: "Portal job policy item not found" }, 404);
    }

    const allowedStatuses: PortalJobItemStatus[] = ['queued', 'in_progress', 'completed', 'failed', 'skipped'];
    const status = allowedStatuses.includes(body?.status) ? body.status as PortalJobItemStatus : items[itemIndex].status;
    const now = new Date().toISOString();
    const warnings = sanitisePortalWarnings(body?.warnings ?? body?.warning, items[itemIndex].warnings);
    items[itemIndex] = {
      ...items[itemIndex],
      status,
      currentStep: typeof body?.currentStep === 'string' ? body.currentStep.slice(0, 120) : items[itemIndex].currentStep,
      message: typeof body?.message === 'string' ? body.message.slice(0, 500) : items[itemIndex].message,
      error: typeof body?.error === 'string' ? body.error.slice(0, 1000) : (status === 'failed' ? items[itemIndex].error : undefined),
      warnings,
      warning: latestPortalWarning(warnings),
      rawData: body?.rawData && typeof body.rawData === 'object' ? body.rawData as Record<string, unknown> : items[itemIndex].rawData,
      extractedData: body?.extractedData && typeof body.extractedData === 'object' ? body.extractedData as Record<string, unknown> : items[itemIndex].extractedData,
      matchConfidence: ['high', 'medium', 'low'].includes(String(body?.matchConfidence)) ? body.matchConfidence : items[itemIndex].matchConfidence,
      documentAttached: typeof body?.documentAttached === 'boolean' ? body.documentAttached : items[itemIndex].documentAttached,
      documentFileName: typeof body?.documentFileName === 'string' ? body.documentFileName.slice(0, 240) : items[itemIndex].documentFileName,
      documentUpdatedAt: typeof body?.documentUpdatedAt === 'string' ? body.documentUpdatedAt : items[itemIndex].documentUpdatedAt,
      artifactStatuses: normaliseDocumentArtifactStatuses(body?.artifactStatuses, items[itemIndex].artifactStatuses),
      completedAt: ['completed', 'failed', 'skipped'].includes(status) ? now : items[itemIndex].completedAt,
      updatedAt: now,
    };

    const summary = summarisePortalJobItems(items);
    const allFinished = summary.total > 0 && summary.queued === 0 && summary.inProgress === 0;
    const updatedJob = await persistPortalJobItems(job, items, {
      status: allFinished ? 'staging' : 'extracting',
      currentStep: allFinished ? 'ready_to_stage' : items[itemIndex].currentStep,
      currentItemId: allFinished ? undefined : items[itemIndex].id,
      currentClientName: allFinished ? undefined : items[itemIndex].clientName,
      currentPolicyNumber: allFinished ? undefined : items[itemIndex].policyNumber,
      message: allFinished
        ? `Policy queue finished. ${summary.completed} completed, ${summary.failed} failed.`
        : items[itemIndex].message,
    });

    return c.json({ success: true, item: items[itemIndex], job: updatedJob, summary: updatedJob.queueSummary });
  } catch (e) {
    log.error("Portal worker item status error:", e);
    return c.json({ error: `Failed to update policy item: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/items/:itemId/policy-document
app.post("/portal-worker/jobs/:jobId/items/:itemId/policy-document", async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param("jobId");
    const itemId = c.req.param("itemId");
    const workerId = c.req.header("X-Portal-Worker-Id") || "portal-worker";
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
    }

    const items = await loadPortalJobItems(jobId);
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      return c.json({ error: "Portal job policy item not found" }, 404);
    }

    const item = items[itemIndex];
    if (item.jobId !== jobId || item.providerId !== job.providerId) {
      return c.json({ error: "Policy item does not belong to this job" }, 400);
    }

    let formData: Record<string, string | File>;
    try {
      formData = await c.req.parseBody();
    } catch (parseErr) {
      log.error("Failed to parse portal policy document form data:", parseErr);
      return c.json({ error: "Invalid form data. Expected multipart/form-data with a PDF file." }, 400);
    }

    const file = formData.file;
    if (!file || !(file instanceof File)) {
      return c.json({ error: "No PDF file provided" }, 400);
    }

    const requestedType = String(formData.documentType || "policy_schedule");
    const documentType = ['policy_schedule', 'amendment', 'statement', 'benefit_summary', 'other'].includes(requestedType)
      ? requestedType as PolicyDocument['documentType']
      : 'policy_schedule';

    const document = await replacePolicyDocumentForPolicy({
      clientId: item.clientId,
      policyId: item.policyId,
      file,
      documentType,
      uploadedBy: `portal-worker:${workerId.slice(0, 80)}`,
      stableStorageKey: true,
      fileName: typeof formData.fileName === 'string' ? formData.fileName.slice(0, 240) : file.name,
    });

    const now = new Date().toISOString();
    items[itemIndex] = {
      ...item,
      documentAttached: true,
      documentFileName: document.fileName,
      documentUpdatedAt: document.uploadDate,
      artifactStatuses: normaliseDocumentArtifactStatuses([
        ...(item.artifactStatuses || []).filter((status) => status.id !== 'policy_schedule'),
        {
          id: 'policy_schedule',
          label: 'Policy schedule',
          status: 'attached',
          fileName: document.fileName,
          documentId: document.id,
          updatedAt: document.uploadDate,
        },
      ]),
      message: "Policy schedule PDF replaced.",
      updatedAt: now,
    };
    const updatedJob = await persistPortalJobItems(job, items, {
      status: 'extracting',
      currentStep: 'policy_document_attached',
      currentItemId: item.id,
      currentClientName: item.clientName,
      currentPolicyNumber: item.policyNumber,
      message: `Policy schedule PDF attached for ${item.clientName} / ${item.policyNumber}.`,
    });

    return c.json({ success: true, document, item: items[itemIndex], job: updatedJob });
  } catch (e) {
    log.error("Portal worker policy document upload error:", e);
    return c.json({ error: `Failed to attach policy document: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/items/:itemId/estate-document
app.post("/portal-worker/jobs/:jobId/items/:itemId/estate-document", async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param("jobId");
    const itemId = c.req.param("itemId");
    const workerId = c.req.header("X-Portal-Worker-Id") || "portal-worker";
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
    }

    const items = await loadPortalJobItems(jobId);
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      return c.json({ error: "Portal job policy item not found" }, 404);
    }

    const item = items[itemIndex];
    if (item.jobId !== jobId || item.providerId !== job.providerId) {
      return c.json({ error: "Policy item does not belong to this job" }, 400);
    }

    let formData: Record<string, string | File>;
    try {
      formData = await c.req.parseBody();
    } catch (parseErr) {
      log.error("Failed to parse portal estate document form data:", parseErr);
      return c.json({ error: "Invalid form data. Expected multipart/form-data with a PDF file." }, 400);
    }

    const file = formData.file;
    if (!file || !(file instanceof File)) {
      return c.json({ error: "No file provided" }, 400);
    }

    const requestedType = String(formData.documentType || "other");
    const documentType = PORTAL_ESTATE_DOCUMENT_TYPES.includes(requestedType as typeof PORTAL_ESTATE_DOCUMENT_TYPES[number])
      ? requestedType as 'last_will_scanned' | 'living_will_scanned' | 'trust_deed' | 'power_of_attorney' | 'codicil' | 'letter_of_executorship' | 'other'
      : 'other';
    const artifactId = String(formData.artifactId || 'estate_document').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'estate_document';
    const artifactLabel = String(formData.artifactLabel || 'Estate document').trim().slice(0, 120) || 'Estate document';
    const title = String(formData.title || artifactLabel || file.name).trim().slice(0, 200) || artifactLabel;
    const notes = typeof formData.notes === 'string' ? formData.notes.slice(0, 1000) : '';
    const signingDate = typeof formData.signingDate === 'string' ? formData.signingDate.slice(0, 40) : '';

    const document = await uploadEstateDocumentForClient({
      clientId: item.clientId,
      file,
      documentType,
      uploadedBy: `portal-worker:${workerId.slice(0, 80)}`,
      fileName: typeof formData.fileName === 'string' ? formData.fileName.slice(0, 240) : file.name,
      title,
      notes,
      signingDate,
    });

    const now = new Date().toISOString();
    items[itemIndex] = {
      ...item,
      documentAttached: true,
      documentFileName: document.fileName,
      documentUpdatedAt: document.uploadedAt,
      artifactStatuses: normaliseDocumentArtifactStatuses([
        ...(item.artifactStatuses || []).filter((status) => status.id !== artifactId),
        {
          id: artifactId,
          label: artifactLabel,
          status: 'attached',
          fileName: document.fileName,
          documentId: document.id,
          updatedAt: document.uploadedAt,
        },
      ]),
      message: `${artifactLabel} uploaded to estate documents.`,
      updatedAt: now,
    };
    const updatedJob = await persistPortalJobItems(job, items, {
      status: 'extracting',
      currentStep: 'estate_document_attached',
      currentItemId: item.id,
      currentClientName: item.clientName,
      currentPolicyNumber: item.policyNumber,
      message: `${artifactLabel} attached for ${item.clientName} / ${item.policyNumber}.`,
    });

    return c.json({ success: true, document, item: items[itemIndex], job: updatedJob });
  } catch (e) {
    log.error("Portal worker estate document upload error:", e);
    return c.json({ error: `Failed to attach estate document: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/status
app.post("/portal-worker/jobs/:jobId/status", async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param("jobId");
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const allowedStatuses: PortalJobStatus[] = ['queued', 'running', 'waiting_for_otp', 'discovering', 'discovery_ready', 'extracting', 'dry_run_ready', 'staging', 'staged', 'failed', 'cancelled'];
    const status = allowedStatuses.includes(body?.status) ? body.status as PortalJobStatus : job.status;
    const warnings = sanitisePortalWarnings(body?.warnings ?? body?.warning, job.warnings);
    const updated: PortalSyncJob = {
      ...job,
      status,
      updatedAt: new Date().toISOString(),
      startedAt: job.startedAt || (status !== 'queued' ? new Date().toISOString() : undefined),
      completedAt: ['discovery_ready', 'dry_run_ready', 'staged', 'failed', 'cancelled'].includes(status) ? new Date().toISOString() : undefined,
      currentStep: typeof body?.currentStep === 'string' ? body.currentStep : job.currentStep,
      message: typeof body?.message === 'string' ? body.message.slice(0, 500) : job.message,
      extractedRows: typeof body?.extractedRows === 'number' ? body.extractedRows : job.extractedRows,
      error: typeof body?.error === 'string' ? body.error.slice(0, 1000) : job.error,
      warnings,
      warning: latestPortalWarning(warnings),
    };

    await kv.set(`portal-job:${jobId}`, updated);
    return c.json({ success: true, job: updated });
  } catch (e) {
    log.error("Portal worker status error:", e);
    return c.json({ error: `Failed to update portal job: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/live-view
app.post("/portal-worker/jobs/:jobId/live-view", async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    let formData: Record<string, string | File>;
    try {
      formData = await c.req.parseBody();
    } catch (parseErr) {
      log.error("Portal worker live view parse error:", parseErr);
      return c.json({ error: "Invalid form data. Expected multipart/form-data with a screenshot file." }, 400);
    }

    const result = await persistPortalLiveViewUpdate(c.req.param("jobId"), formData);
    if ('error' in result) {
      return c.json({ error: result.error }, result.status);
    }
    return c.json({ success: true, job: result.job });
  } catch (e) {
    log.error("Portal worker live view upload error:", e);
    return c.json({ error: `Failed to upload portal live view: ${getErrMsg(e)}` }, 500);
  }
});

// GET /portal-worker/jobs/:jobId/otp
app.get("/portal-worker/jobs/:jobId/otp", async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param("jobId");
    const otpEntry = (await kv.get(`portal-job-otp:${jobId}`)) as { otp: string; expiresAt: string } | null;
    if (!otpEntry) {
      return c.json({ success: true, otp: null });
    }
    if (new Date(otpEntry.expiresAt).getTime() < Date.now()) {
      await kv.del(`portal-job-otp:${jobId}`);
      return c.json({ success: true, otp: null, expired: true });
    }
    await kv.del(`portal-job-otp:${jobId}`);
    return c.json({ success: true, otp: otpEntry.otp });
  } catch (e) {
    log.error("Portal worker OTP fetch error:", e);
    return c.json({ error: `Failed to fetch OTP: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/discovery-report
app.post("/portal-worker/jobs/:jobId/discovery-report", async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param("jobId");
    const body = await c.req.json();
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
    }
    const mode = body?.mode === 'dry-run' ? 'dry-run' : 'discover';
    const now = new Date().toISOString();
    const report: PortalDiscoveryReport = {
      id: crypto.randomUUID(),
      jobId,
      providerId: job.providerId,
      categoryId: job.categoryId,
      createdAt: now,
      mode,
      urlHost: String(body?.urlHost || '').slice(0, 200),
      title: typeof body?.title === 'string' ? body.title.slice(0, 200) : undefined,
      summary: {
        inputCount: Number(body?.summary?.inputCount || 0),
        buttonCount: Number(body?.summary?.buttonCount || 0),
        linkCount: Number(body?.summary?.linkCount || 0),
        tableCount: Number(body?.summary?.tableCount || 0),
        candidatePolicyTables: Number(body?.summary?.candidatePolicyTables || 0),
        extractedRowCount: typeof body?.summary?.extractedRowCount === 'number' ? body.summary.extractedRowCount : undefined,
      },
      selectorCandidates: Array.isArray(body?.selectorCandidates)
        ? body.selectorCandidates.slice(0, 200).map((candidate: Record<string, unknown>) => ({
            purpose: ['input', 'button', 'link', 'table', 'policy_row', 'field'].includes(String(candidate.purpose))
              ? candidate.purpose as PortalDiscoveryReport['selectorCandidates'][number]['purpose']
              : 'field',
            selector: String(candidate.selector || '').slice(0, 500),
            tag: typeof candidate.tag === 'string' ? candidate.tag.slice(0, 40) : undefined,
            type: typeof candidate.type === 'string' ? candidate.type.slice(0, 80) : undefined,
            role: typeof candidate.role === 'string' ? candidate.role.slice(0, 80) : undefined,
            label: typeof candidate.label === 'string' ? candidate.label.slice(0, 120) : undefined,
            confidence: ['low', 'medium', 'high'].includes(String(candidate.confidence))
              ? candidate.confidence as 'low' | 'medium' | 'high'
              : 'low',
            notes: typeof candidate.notes === 'string' ? candidate.notes.slice(0, 300) : undefined,
          }))
        : [],
      tableSummaries: Array.isArray(body?.tableSummaries)
        ? body.tableSummaries.slice(0, 50).map((table: Record<string, unknown>) => ({
            selector: String(table.selector || '').slice(0, 500),
            headerTexts: Array.isArray(table.headerTexts)
              ? table.headerTexts.slice(0, 30).map((header) => String(header).slice(0, 120))
              : [],
            rowCount: Number(table.rowCount || 0),
          }))
        : [],
      warnings: Array.isArray(body?.warnings) ? body.warnings.slice(0, 50).map((warning) => String(warning).slice(0, 300)) : [],
    };

    await kv.set(`portal-discovery-report:${report.id}`, report);
    await kv.set(`portal-discovery-report:latest:${jobId}`, { reportId: report.id, updatedAt: now });

    const updatedJob: PortalSyncJob = {
      ...job,
      status: mode === 'dry-run' ? 'dry_run_ready' : 'discovery_ready',
      updatedAt: now,
      completedAt: now,
      currentStep: mode === 'dry-run' ? 'dry_run_ready' : 'discovery_ready',
      message: mode === 'dry-run'
        ? `Dry run completed. ${report.summary.extractedRowCount || 0} rows would be extracted; no policies were updated.`
        : 'Discovery report captured. Review selector candidates before staging provider data.',
      extractedRows: report.summary.extractedRowCount ?? job.extractedRows,
      discoveryReportId: report.id,
    };
    await kv.set(`portal-job:${jobId}`, updatedJob);

    return c.json({ success: true, job: updatedJob, report });
  } catch (e) {
    log.error("Portal worker discovery report error:", e);
    return c.json({ error: `Failed to save discovery report: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/stage-items
app.post("/portal-worker/jobs/:jobId/stage-items", async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param("jobId");
    const items = await loadPortalJobItems(jobId);
    const rawRows = items
      .filter((item) => item.status === 'completed' && item.rawData && Object.keys(item.rawData).length > 0)
      .map((item) => ({
        item,
        row: applyTemplateRowMetadata(item.rawData as Record<string, unknown>, {
          policyId: item.policyId,
          clientId: item.clientId,
          providerId: item.providerId,
          categoryId: item.categoryId,
          normalizedPolicyNumber: item.normalizedPolicyNumber,
        }),
      }))
      .filter(({ item, row }) => portalItemHasStageableBusinessValue(item, row))
      .map(({ row }) => row);

    if (rawRows.length === 0) {
      return c.json({ error: "No completed policy items have extracted stageable values. Allan Gray rows must include a mapped current value." }, 400);
    }

    const { job, stagedRun } = await stagePortalRows(jobId, rawRows);
    const summary = summarisePortalJobItems(items);
    const message = summary.failed > 0
      ? `Staged ${rawRows.length} completed policy updates. ${summary.failed} policy${summary.failed === 1 ? '' : 'ies'} need review or retry.`
      : `Staged ${rawRows.length} completed policy updates for review.`;
    const updatedJob: PortalSyncJob = {
      ...job,
      queueSummary: summary,
      message,
    };
    await kv.set(`portal-job:${jobId}`, updatedJob);

    return c.json({ success: true, job: updatedJob, stagedRun, summary });
  } catch (e) {
    log.error("Portal worker item staging error:", e);
    return c.json({ error: `Failed to stage completed policy items: ${getErrMsg(e)}` }, 500);
  }
});

// POST /portal-worker/jobs/:jobId/stage
app.post("/portal-worker/jobs/:jobId/stage", async (c) => {
  const authError = requirePortalWorker(c);
  if (authError) return authError;

  try {
    const jobId = c.req.param("jobId");
    const body = await c.req.json();
    const rawRows = Array.isArray(body?.rows)
      ? (body.rows as Record<string, unknown>[]).filter((row) => portalRowHasBusinessValue(row))
      : [];
    if (rawRows.length === 0) {
      return c.json({ error: "No portal rows contained extracted business values to stage" }, 400);
    }
    const { job, stagedRun } = await stagePortalRows(jobId, rawRows);
    return c.json({ success: true, job, stagedRun });
  } catch (e) {
    log.error("Portal worker staging error:", e);
    return c.json({ error: `Failed to stage portal rows: ${getErrMsg(e)}` }, 500);
  }
});

// POST /upload
app.post("/upload", requireAuth, async (c) => {
  try {
    // Wrap parseBody in try/catch — Hono's parseBody calls formData.forEach()
    // internally, which throws if the body cannot be parsed as FormData
    // (e.g. missing/malformed Content-Type boundary, already-consumed stream).
    let body: Record<string, string | File>;
    try {
      body = await c.req.parseBody();
    } catch (parseErr: unknown) {
      log.error('Failed to parse multipart form data:', parseErr);
      return c.json({
        error: 'Invalid form data. Ensure the request uses multipart/form-data encoding.',
        details: parseErr instanceof Error ? parseErr.message : String(parseErr),
      }, 400);
    }

    const file = body['file'];
    const providerId = body['providerId'] as string;
    const categoryId = body['categoryId'] as string;
    const mode = (body['mode'] as string) || 'preview';

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No file uploaded" }, 400);
    }
    if (!providerId || !categoryId) {
      return c.json({ error: "Missing context (provider/category)" }, 400);
    }

    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
        return c.json({ error: "Invalid provider ID" }, 400);
    }

    const configKey = `config:mapping:${providerId}:${categoryId}`;
    const storedConfig = (await kv.get(configKey)) as IntegrationConfig | null;

    if (!storedConfig && mode === 'commit') {
      return c.json({ error: "No mapping configuration found. Please configure mappings first." }, 400);
    }

    const schema = await getSchemaForCategory(categoryId);
    const config = normaliseIntegrationConfig(storedConfig ? {
      ...storedConfig,
      providerId,
      categoryId,
    } : {
      providerId,
      categoryId,
      fieldMapping: {},
      fieldBindings: [],
      settings: getDefaultIntegrationSettings(),
    }, schema.fields || []);

    const templateBindings = getTemplateFieldBindings(config, schema.fields || []);
    const fieldMapping = fieldBindingsToMapping(templateBindings, config.fieldMapping || {});
    const settings = normaliseSettings(config.settings);

    if (file.size > MAX_INTEGRATION_UPLOAD_BYTES) {
      return c.json({ error: "Spreadsheet is too large. Please upload a file smaller than 5 MB." }, 400);
    }

    const buffer = await file.arrayBuffer();
    let spreadsheetRows: ReturnType<typeof readSpreadsheetUpload>;
    try {
      spreadsheetRows = readSpreadsheetUpload(buffer);
    } catch (spreadsheetErr) {
      return c.json({ error: getErrMsg(spreadsheetErr) }, 400);
    }
    const { headers, rawRows, previewRows } = spreadsheetRows;

    if (!headers || headers.length === 0) {
      return c.json({ error: "File has no headers in the first row" }, 400);
    }

    const visibleHeaders = headers.filter((header) => !isTemplateMetadataColumn(header));
    if (visibleHeaders.length === 0) {
      return c.json({ error: "File does not contain any mapped spreadsheet columns" }, 400);
    }

    if (rawRows.length === 0) {
      return c.json({ error: "File does not contain any policy rows to stage" }, 400);
    }

    const mappedColumns: string[] = [];
    const unmappedColumns: string[] = [];
    const validationErrors: string[] = [];

    visibleHeaders.forEach((header) => {
      if (fieldMapping[header]) {
        mappedColumns.push(header);
      } else {
        unmappedColumns.push(header);
      }
    });

    if (!settings.ignoreUnmatched && unmappedColumns.length > 0) {
        validationErrors.push(`Unmapped columns detected: ${unmappedColumns.join(', ')}`);
    }

    if (settings.strictMode && (unmappedColumns.length > 0 && !settings.ignoreUnmatched)) {
         return c.json({ 
            success: false, 
            error: "Strict Mode Violation: Unmapped columns found.",
            preview: {
                totalRows: rawRows.length,
                mappedColumns,
                unmappedColumns,
                validationErrors
            }
        }, 400);
    }

    if (mode === 'preview') {
        return c.json({
            success: true,
            preview: {
                totalRows: rawRows.length,
                mappedColumns,
                unmappedColumns,
                validationErrors,
                sampleData: previewRows.slice(0, 5)
            }
        });
    }

    if (mode === 'commit') {
        const syncRun = await buildSyncRun({
            provider,
            providerId,
            categoryId,
            fileName: file.name,
            rawRows,
            fieldMapping,
            fieldBindings: templateBindings,
            settings,
            ignoreBlankValues: true,
        });

        const finalRun = settings.autoPublish
          ? await publishSyncRun(syncRun, { autoOnly: true })
          : syncRun;

        const runKey = `sync-run:${finalRun.id}`;
        await kv.set(runKey, finalRun);

        const historyEntry: UploadHistory = {
            id: crypto.randomUUID(),
            providerId,
            categoryId,
            fileName: file.name,
            status: finalRun.status === 'failed' ? 'failed' : 'success',
            rowCount: finalRun.summary.totalRows,
            errorCount: finalRun.summary.invalidRows + finalRun.summary.duplicateRows + finalRun.summary.unmatchedRows,
            uploadedAt: new Date().toISOString(),
            errors: validationErrors,
            runId: finalRun.id,
            publishedRows: finalRun.summary.publishedRows,
        };

        const historyKey = `history:${providerId}:${categoryId}:${Date.now()}`;
        await kv.set(historyKey, historyEntry);

        return c.json({
            success: true,
            result: {
                insertedRows: finalRun.summary.publishedRows,
                stagedRows: finalRun.summary.totalRows,
                historyId: historyEntry.id,
                runId: finalRun.id,
                autoPublished: settings.autoPublish,
                stagedRun: finalRun,
            },
        });
    }

    return c.json({ error: "Invalid mode" }, 400);

  } catch (e) {
    log.error("Upload error:", e);
    return c.json({ error: "Internal server error during upload", details: getErrMsg(e) }, 500);
  }
});

// GET /history
app.get("/history", async (c) => {
    const providerId = c.req.query("providerId");
    const categoryId = c.req.query("categoryId");

    if (!providerId || !categoryId) {
        return c.json({ error: "Missing providerId or categoryId" }, 400);
    }

    try {
        const prefix = `history:${providerId}:${categoryId}`;
        const historyItems = await kv.getByPrefix(prefix);
        
        const sorted = ((historyItems || []) as UploadHistory[]).sort((a, b) => 
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );

        return c.json(sorted);
    } catch (e) {
        log.error("History fetch error:", e);
         return c.json([]);
    }
});

// GET /sync-runs/:runId
app.get("/sync-runs/:runId", requireAuth, async (c) => {
  try {
    const runId = c.req.param("runId");
    const run = (await kv.get(`sync-run:${runId}`)) as IntegrationSyncRun | null;
    if (!run) {
      return c.json({ error: "Sync run not found" }, 404);
    }
    return c.json({ success: true, run });
  } catch (e) {
    log.error("Sync run fetch error:", e);
    return c.json({ error: "Failed to fetch sync run" }, 500);
  }
});

// POST /sync-runs/:runId/publish
app.post("/sync-runs/:runId/publish", requireAuth, async (c) => {
  try {
    const runId = c.req.param("runId");
    const body = await c.req.json().catch(() => ({}));
    const rowIds = Array.isArray(body?.rowIds) ? body.rowIds.filter((id: unknown) => typeof id === 'string') : undefined;

    const run = (await kv.get(`sync-run:${runId}`)) as IntegrationSyncRun | null;
    if (!run) {
      return c.json({ error: "Sync run not found" }, 404);
    }
    const scopeError = getSyncRunScopeError(run, body?.providerId, body?.categoryId);
    if (scopeError) {
      return c.json({ error: scopeError }, 409);
    }
    if (body?.categoryId && !portalArtifactsMatchCategory(String(body.categoryId), { stagedRun: run })) {
      return c.json({ error: "This staged portal extraction contains retirement annuity data and cannot be published from an investments category." }, 409);
    }

    const publishedRun = await publishSyncRun(run, { rowIds });
    await kv.set(`sync-run:${publishedRun.id}`, publishedRun);

    return c.json({
      success: true,
      run: publishedRun,
      summary: publishedRun.summary,
    });
  } catch (e) {
    log.error("Sync run publish error:", e);
    return c.json({ error: `Failed to publish sync run: ${getErrMsg(e)}` }, 500);
  }
});

// GET /schemas
app.get("/schemas", async (c) => {
  const categoryId = c.req.query("categoryId");
  if (!categoryId) return c.json({ error: "Missing categoryId" }, 400);

  try {
    const key = `config:schema:${categoryId}`;
    let schema = await kv.get(key);
    
    if (!schema) {
      schema = DEFAULT_SCHEMAS[categoryId] || { fields: [] };
      log.info('Using default schema for category', { categoryId });
    }

    return c.json(schema || { fields: [] });
  } catch (e) {
    log.error("Error fetching schema, returning default:", e as Error, { categoryId });
    const defaultSchema = DEFAULT_SCHEMAS[categoryId] || { fields: [] };
    return c.json(defaultSchema);
  }
});

// GET /schemas/batch — returns all schemas in one call (defaults merged with custom overrides)
// Used by the client overview dashboard to avoid 13+ individual schema calls
app.get("/schemas/batch", async (c) => {
  try {
    // Fetch all custom schema overrides in one batch KV read
    const customSchemas = await kv.getByPrefix("config:schema:");
    const customMap: Record<string, unknown> = {};
    if (Array.isArray(customSchemas)) {
      for (const schema of customSchemas) {
        const s = schema as KvSchema;
        if (s?.categoryId && s?.fields) {
          customMap[s.categoryId] = s;
        }
      }
    }

    // Merge: custom overrides take precedence over defaults
    const allSchemas: Record<string, unknown> = {};
    for (const [catId, defaultSchema] of Object.entries(DEFAULT_SCHEMAS)) {
      allSchemas[catId] = customMap[catId] || defaultSchema;
    }
    // Include any custom schemas for categories not in defaults
    for (const [catId, schema] of Object.entries(customMap)) {
      if (!allSchemas[catId]) {
        allSchemas[catId] = schema;
      }
    }

    return c.json({ schemas: allSchemas });
  } catch (e) {
    log.error("Error fetching batch schemas, returning defaults:", e as Error);
    return c.json({ schemas: DEFAULT_SCHEMAS });
  }
});

// GET /custom-keys
app.get("/custom-keys", async (c) => {
  const categoryId = c.req.query("categoryId");
  
  if (!categoryId) {
    return c.json({ error: "Missing categoryId" }, 400);
  }
  
  try {
    const customKeysKey = `config:custom_keys:${categoryId}`;
    const customKeys = (await kv.get(customKeysKey)) || [];
    
    return c.json({ customKeys });
  } catch (e) {
    log.error("Error fetching custom keys:", e);
    return c.json({ customKeys: [] });
  }
});

// POST /schemas
app.post("/schemas", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = SaveSchemaInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", ...formatZodError(parsed.error) }, 400);
    }
    const { categoryId, fields } = parsed.data;

    const key = `config:schema:${categoryId}`;
    const schema = {
      categoryId,
      fields,
      updatedAt: new Date().toISOString()
    };

    await kv.set(key, schema);
    
    autoGenerateCustomKeysForSchema(categoryId, fields).catch((e) => {
      log.error("Background error generating custom keys:", e);
    });
    
    return c.json({ success: true, schema });

  } catch (e) {
    log.error("Error saving schema:", e);
    return c.json({ error: "Failed to save schema" }, 500);
  }
});

// --- POLICY MANAGEMENT ENDPOINTS ---

// GET /policies
app.get("/policies", async (c) => {
  try {
    const clientId = c.req.query("clientId");
    const categoryId = c.req.query("categoryId");
    const includeArchived = c.req.query("includeArchived") === 'true';

    if (!clientId) {
      return c.json({ error: "Missing clientId" }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    let policies = (await kv.get(policiesKey)) || [];

    if (categoryId) {
      if (categoryId === 'retirement_planning') {
        policies = policies.filter((p: KvPolicy) => 
          p.categoryId === 'retirement_planning' || 
          p.categoryId === 'retirement_pre' || 
          p.categoryId === 'retirement_post'
        );
      } else if (categoryId === 'investments') {
        policies = policies.filter((p: KvPolicy) => 
          p.categoryId === 'investments' || 
          p.categoryId === 'investments_voluntary' || 
          p.categoryId === 'investments_guaranteed'
        );
      } else {
        policies = policies.filter((p: KvPolicy) => p.categoryId === categoryId);
      }
    }

    if (!includeArchived) {
      policies = policies.filter((p: KvPolicy) => !p.archived);
    } else {
      policies = policies.filter((p: KvPolicy) => p.archived);
    }

    return c.json({ policies });
  } catch (e) {
    log.error("Error fetching policies, returning empty array:", e as Error, { clientId: c.req.query("clientId"), categoryId: c.req.query("categoryId") });
    return c.json({ policies: [] });
  }
});

// POST /policies/archive
app.post("/policies/archive", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = ArchivePolicySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", ...formatZodError(parsed.error) }, 400);
    }
    const { id, clientId, reason } = parsed.data;

    const policiesKey = `policies:client:${clientId}`;
    let policies = (await kv.get(policiesKey)) || [];

    const policyIndex = policies.findIndex((p: KvPolicy) => p.id === id);
    
    if (policyIndex === -1) {
      return c.json({ error: "Policy not found" }, 404);
    }

    policies[policyIndex] = {
      ...policies[policyIndex],
      archived: true,
      archivedReason: reason,
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(policiesKey, policies);
    await recalculateClientTotals(clientId);

    return c.json({ success: true, policy: policies[policyIndex] });
  } catch (e) {
    log.error("Error archiving policy:", e);
    return c.json({ error: "Failed to archive policy" }, 500);
  }
});

// POST /policies/reinstate
app.post("/policies/reinstate", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = ReinstatePolicySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", ...formatZodError(parsed.error) }, 400);
    }
    const { id, clientId } = parsed.data;

    const policiesKey = `policies:client:${clientId}`;
    let policies = (await kv.get(policiesKey)) || [];

    const policyIndex = policies.findIndex((p: KvPolicy) => p.id === id);
    
    if (policyIndex === -1) {
      return c.json({ error: "Policy not found" }, 404);
    }

    policies[policyIndex] = {
      ...policies[policyIndex],
      archived: false,
      archivedReason: undefined,
      archivedAt: undefined,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(policiesKey, policies);
    await recalculateClientTotals(clientId);

    return c.json({ success: true, policy: policies[policyIndex] });
  } catch (e) {
    log.error("Error reinstating policy:", e);
    return c.json({ error: "Failed to reinstate policy" }, 500);
  }
});

// POST /policies
app.post("/policies", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = CreatePolicySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", ...formatZodError(parsed.error) }, 400);
    }
    const { clientId, categoryId, providerId, providerName, data } = parsed.data;

    const provider = await kv.get(`provider:${providerId}`);
    if (!provider) {
        return c.json({ error: "Invalid provider ID" }, 400);
    }
    const safeProviderName = (provider as KvProvider).name || providerName;

    const policyId = `policy_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const policy = {
      id: policyId,
      clientId,
      categoryId,
      providerId,
      providerName: safeProviderName,
      data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const policiesKey = `policies:client:${clientId}`;
    let policies = (await kv.get(policiesKey)) || [];
    
    policies.push(policy);
    
    await kv.set(policiesKey, policies);
    await recalculateClientTotals(clientId);

    return c.json({ success: true, policy });
  } catch (e) {
    log.error("Error creating policy:", e);
    return c.json({ error: "Failed to create policy" }, 500);
  }
});

// PUT /policies
app.put("/policies", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = UpdatePolicySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", ...formatZodError(parsed.error) }, 400);
    }
    const { id, clientId, categoryId, providerId, providerName, data } = parsed.data;

    if (!id || !clientId) {
      return c.json({ error: "Missing policy id or clientId" }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    let policies = (await kv.get(policiesKey)) || [];

    const policyIndex = policies.findIndex((p: KvPolicy) => p.id === id);
    
    if (policyIndex === -1) {
      return c.json({ error: "Policy not found" }, 404);
    }

    let newProviderName = providerName || policies[policyIndex].providerName;
    if (providerId && providerId !== policies[policyIndex].providerId) {
         const provider = await kv.get(`provider:${providerId}`);
         if (!provider) {
             return c.json({ error: "Invalid provider ID" }, 400);
         }
         newProviderName = (provider as KvProvider).name;
    }

    policies[policyIndex] = {
      ...policies[policyIndex],
      categoryId: categoryId || policies[policyIndex].categoryId,
      providerId: providerId || policies[policyIndex].providerId,
      providerName: newProviderName,
      data: data || policies[policyIndex].data,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(policiesKey, policies);
    await recalculateClientTotals(clientId);

    return c.json({ success: true, policy: policies[policyIndex] });
  } catch (e) {
    log.error("Error updating policy:", e);
    return c.json({ error: "Failed to update policy" }, 500);
  }
});

// DELETE /policies
app.delete("/policies", async (c) => {
  try {
    const id = c.req.query("id");
    const clientId = c.req.query("clientId");

    if (!id || !clientId) {
      return c.json({ error: "Missing policy id or clientId" }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    let policies = (await kv.get(policiesKey)) || [];

    // Find the policy to check for attached document before removing
    const policyToDelete = (policies as KvPolicy[]).find((p: KvPolicy) => p.id === id);

    const initialLength = policies.length;
    policies = policies.filter((p: KvPolicy) => p.id !== id);

    if (policies.length === initialLength) {
      return c.json({ error: "Policy not found" }, 404);
    }

    // Clean up attached document from storage if present
    if (policyToDelete?.document?.storageKey) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );
        await supabase.storage
          .from(POLICY_DOC_BUCKET)
          .remove([policyToDelete.document.storageKey]);
        log.info('Deleted attached document during policy deletion', {
          policyId: id,
          storageKey: policyToDelete.document.storageKey,
        });
      } catch (docErr) {
        // Non-fatal: log and continue
        log.error('Failed to delete attached document during policy deletion (non-fatal):', docErr);
      }
    }

    await kv.set(policiesKey, policies);

    return c.json({ success: true });
  } catch (e) {
    log.error("Error deleting policy:", e);
    return c.json({ error: "Failed to delete policy" }, 500);
  }
});

// --- DASHBOARD STATS ENDPOINTS ---

// POST /recalculate-totals
app.post("/recalculate-totals", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = RecalculateTotalsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", ...formatZodError(parsed.error) }, 400);
    }
    const { clientId } = parsed.data;

    await recalculateClientTotals(clientId);

    return c.json({ success: true, message: "Totals recalculated successfully" });
  } catch (e) {
    log.error("Error triggering recalculation:", e);
    return c.json({ error: "Failed to recalculate totals" }, 500);
  }
});

// GET /dashboard-stats
app.get("/dashboard-stats", async (c) => {
  try {
    const allPoliciesKeys = await getByPrefix("policies:client:");
    let totalActivePolicies = 0;
    let newPoliciesCount = 0;
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const policies of allPoliciesKeys) {
      if (Array.isArray(policies)) {
        totalActivePolicies += policies.length;
        
        newPoliciesCount += policies.filter((p: KvPolicy) => {
           return p.createdAt && new Date(p.createdAt) >= startOfMonth;
        }).length;
      }
    }

    const riskFnaKeys = await getByPrefix("risk_planning_fna:client:");
    const medicalFnaKeys = await getByPrefix("medical_fna:client:");
    const retirementFnaKeys = await getByPrefix("retirement_fna:client:");
    const investmentInaKeys = await getByPrefix("investment_ina:client:");
    const taxPlanningKeys = await getByPrefix("tax_planning_fna:client:");
    const estatePlanningKeys = await getByPrefix("estate_planning_fna:client:");

    let publishedFnasCount = 0;

    const countPublished = (items: KvFnaEntry[]) => {
      if (!items || !Array.isArray(items)) return 0;
      return items.filter((item) => item?.status === 'published').length;
    };

    publishedFnasCount += countPublished(riskFnaKeys);
    publishedFnasCount += countPublished(medicalFnaKeys);
    publishedFnasCount += countPublished(retirementFnaKeys);
    publishedFnasCount += countPublished(investmentInaKeys);
    publishedFnasCount += countPublished(taxPlanningKeys);
    publishedFnasCount += countPublished(estatePlanningKeys);

    log.info('Dashboard stats calculated', {
      activePolicies: totalActivePolicies,
      newPoliciesCount,
      publishedFnas: publishedFnasCount
    });

    return c.json({
      activePolicies: totalActivePolicies,
      newPoliciesCount,
      publishedFnas: publishedFnasCount,
    });
  } catch (e) {
    log.error("Error fetching dashboard stats:", e);
    return c.json({
      activePolicies: 0,
      newPoliciesCount: 0,
      publishedFnas: 0,
    });
  }
});

// GET /policy-renewals
app.get("/policy-renewals", requireAuth, async (c) => {
  try {
    log.info('Fetching policy renewal data for calendar');
    
    const allPoliciesEntries = await getByPrefix("policies:client:");
    
    const customSchemas = await getByPrefix("config:schema:");
    const schemaMap: Record<string, SchemaField[]> = {};
    
    for (const schema of customSchemas) {
      const s = schema as KvSchema;
      if (s && s.categoryId && s.fields) {
        schemaMap[s.categoryId] = s.fields;
      }
    }
    
    for (const [catId, schema] of Object.entries(DEFAULT_SCHEMAS)) {
      if (!schemaMap[catId] && (schema as { fields?: SchemaField[] }).fields) {
        schemaMap[catId] = (schema as { fields: SchemaField[] }).fields;
      }
    }
    
    const inceptionFieldMap: Record<string, { fieldId: string; fieldName: string }[]> = {};
    for (const [catId, fields] of Object.entries(schemaMap)) {
      const inceptionFields: { fieldId: string; fieldName: string }[] = [];
      for (const field of fields) {
        const fieldType = (field.type || '').toLowerCase();
        const fieldName = (field.name || '').toLowerCase();
        
        if (
          fieldType === 'date_inception' ||
          fieldName.includes('inception') ||
          fieldName.includes('commencement') ||
          fieldName.includes('start date') ||
          (fieldName === 'anniversary date' && catId.includes('retirement'))
        ) {
          inceptionFields.push({ fieldId: field.id, fieldName: field.name });
        }
      }
      if (inceptionFields.length > 0) {
        inceptionFieldMap[catId] = inceptionFields;
      }
    }
    
    const renewals: PolicyRenewal[] = [];
    
    const categoryLabels: Record<string, string> = {
      risk_planning: 'Risk Planning',
      medical_aid: 'Medical Aid',
      retirement_planning: 'Retirement Planning',
      retirement_pre: 'Pre-Retirement',
      retirement_post: 'Post-Retirement',
      investments: 'Investments',
      investments_voluntary: 'Voluntary Investments',
      investments_guaranteed: 'Guaranteed Investments',
      employee_benefits: 'Employee Benefits',
      employee_benefits_risk: 'Employee Benefits (Risk)',
      employee_benefits_retirement: 'Employee Benefits (Retirement)',
      tax_planning: 'Tax Planning',
      estate_planning: 'Estate Planning',
    };
    
    for (const policies of allPoliciesEntries) {
      if (!Array.isArray(policies)) continue;
      
      for (const policy of policies) {
        if (!policy || !policy.data || policy.archived) continue;
        
        const catId = policy.categoryId;
        
        const fieldsToCheck = inceptionFieldMap[catId] || [];
        
        const schemaFields = schemaMap[catId] || [];
        
        let inceptionDate: string | null = null;
        let inceptionFieldName: string = 'Date of Inception';
        
        for (const { fieldId, fieldName } of fieldsToCheck) {
          const val = policy.data[fieldId];
          if (val && isValidDate(val)) {
            inceptionDate = val;
            inceptionFieldName = fieldName;
            break;
          }
        }
        
        if (!inceptionDate) {
          for (const field of schemaFields) {
            const fieldType = (field.type || '').toLowerCase();
            if (fieldType === 'date_inception') {
              const val = policy.data[field.id];
              if (val && isValidDate(val)) {
                inceptionDate = val;
                inceptionFieldName = field.name || 'Date of Inception';
                break;
              }
            }
          }
        }
        
        if (!inceptionDate) continue;
        
        let policyNumber = '';
        for (const field of schemaFields) {
          const fn = (field.name || '').toLowerCase();
          if (fn.includes('policy number') || fn.includes('policy no') || fn.includes('reference')) {
            policyNumber = policy.data[field.id] || '';
            if (policyNumber) break;
          }
        }
        
        renewals.push({
          clientId: policy.clientId,
          policyId: policy.id,
          providerName: policy.providerName || 'Unknown Provider',
          categoryId: catId,
          categoryLabel: categoryLabels[catId] || catId,
          policyNumber,
          inceptionDate,
          inceptionFieldName,
        });
      }
    }
    
    log.info(`Found ${renewals.length} policies with renewal dates`);
    return c.json({ renewals });
    
  } catch (e) {
    log.error("Error fetching policy renewals:", e);
    return c.json({ renewals: [] });
  }
});

// ============================================================================
// POLICY DOCUMENT ENDPOINTS
// ============================================================================

const LEGAL_DOCS_BUCKET = 'make-91ed8379-legal-docs';
const POLICY_DOC_BUCKET = 'make-91ed8379-policy-documents';

// Lazy bucket initialization — called on first document request, not at module load time.
let legalDocBucketInitialized = false;
let policyDocBucketInitialized = false;

async function ensureLegalDocsBucket(): Promise<void> {
  if (legalDocBucketInitialized) return;
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === LEGAL_DOCS_BUCKET);

    if (!bucketExists) {
      log.info(`Creating legal document storage bucket: ${LEGAL_DOCS_BUCKET}`);
      const { error } = await supabase.storage.createBucket(LEGAL_DOCS_BUCKET, {
        public: false,
        fileSizeLimit: 52428800,
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
      });

      if (error) {
        if (error.message?.includes('already exists')) {
          log.info('Legal document bucket already exists');
        } else {
          log.error('Error creating legal document bucket:', error);
          return;
        }
      } else {
        log.info('Legal document bucket created successfully');
      }
    } else {
      log.info('Legal document bucket already exists');
    }
    legalDocBucketInitialized = true;
  } catch (error) {
    const errorMessage = getErrMsg(error);
    if (errorMessage.includes('already exists')) {
      legalDocBucketInitialized = true;
    } else {
      log.error('Error initializing legal document bucket (non-critical):', { error });
    }
  }
}

async function ensurePolicyDocBucket(): Promise<void> {
  if (policyDocBucketInitialized) return;
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === POLICY_DOC_BUCKET);

    if (!bucketExists) {
      log.info(`Creating policy document storage bucket: ${POLICY_DOC_BUCKET}`);
      const { error } = await supabase.storage.createBucket(POLICY_DOC_BUCKET, {
        public: false,
        fileSizeLimit: 20971520, // 20MB
        allowedMimeTypes: ['application/pdf'],
      });

      if (error) {
        if (error.message?.includes('already exists')) {
          log.info('Policy document bucket already exists');
        } else {
          log.error('Error creating policy document bucket:', error);
          return;
        }
      } else {
        log.info('Policy document bucket created successfully');
      }
    } else {
      log.info('Policy document bucket already exists');
    }
    policyDocBucketInitialized = true;
  } catch (error) {
    const errorMessage = getErrMsg(error);
    if (errorMessage.includes('already exists')) {
      policyDocBucketInitialized = true;
    } else {
      log.error('Error initializing policy document bucket (non-critical):', { error });
    }
  }
}

const POLICY_CATEGORY_LABELS: Record<string, string> = {
  risk_planning: 'Risk Planning',
  medical_aid: 'Medical Aid',
  retirement_planning: 'Retirement Planning',
  retirement_pre: 'Pre-Retirement',
  retirement_post: 'Post-Retirement',
  investments: 'Investments',
  investments_voluntary: 'Voluntary Investments',
  investments_guaranteed: 'Guaranteed Investments',
  employee_benefits: 'Employee Benefits',
  employee_benefits_risk: 'Employee Benefits (Risk)',
  employee_benefits_retirement: 'Employee Benefits (Retirement)',
  tax_planning: 'Tax Planning',
  estate_planning: 'Estate Planning',
};

function safeStorageFileName(fileName: string, fallback = 'policy_schedule.pdf'): string {
  const cleaned = fileName.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

async function uploadEstateDocumentForClient(params: {
  clientId: string;
  file: File;
  documentType: 'last_will_scanned' | 'living_will_scanned' | 'trust_deed' | 'power_of_attorney' | 'codicil' | 'letter_of_executorship' | 'other';
  uploadedBy: string;
  fileName?: string;
  title?: string;
  notes?: string;
  signingDate?: string;
}) {
  await ensureLegalDocsBucket();

  const { clientId, file, documentType, uploadedBy } = params;
  const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
  if (file.type && !allowedTypes.has(file.type)) {
    throw new Error('Only PDF, JPEG, and PNG files are accepted');
  }
  if (file.size > 52428800) {
    throw new Error('File exceeds maximum size of 50MB');
  }

  const fileExtension = (params.fileName || file.name || 'document.pdf').split('.').pop() || 'pdf';
  const docId = `edoc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `estate-docs/${clientId}/${docId}.${fileExtension}`;
  const fileBuffer = await file.arrayBuffer();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error: uploadError } = await supabase.storage
    .from(LEGAL_DOCS_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: file.type || 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const timestamp = new Date().toISOString();
  const document = {
    id: docId,
    clientId,
    title: String(params.title || params.fileName || file.name || 'Estate document').trim().slice(0, 200) || 'Estate document',
    documentType,
    notes: String(params.notes || '').slice(0, 1000),
    signingDate: typeof params.signingDate === 'string' && params.signingDate.trim() ? params.signingDate.trim().slice(0, 40) : null,
    fileName: params.fileName || file.name,
    fileSize: file.size,
    filePath: storagePath,
    mimeType: file.type || 'application/pdf',
    uploadedBy,
    uploadedAt: timestamp,
    updatedAt: timestamp,
  };

  await kv.set(`estate_doc:${clientId}:${docId}`, document);
  return document;
}

async function replacePolicyDocumentForPolicy(params: {
  clientId: string;
  policyId: string;
  file: File;
  documentType: PolicyDocument['documentType'];
  uploadedBy: string;
  stableStorageKey?: boolean;
  fileName?: string;
}): Promise<PolicyDocument> {
  await ensurePolicyDocBucket();

  const { clientId, policyId, file, documentType, uploadedBy } = params;
  if (file.type && file.type !== 'application/pdf') {
    throw new Error('Only PDF files are accepted');
  }
  if (file.size > 20971520) {
    throw new Error('File exceeds maximum size of 20MB');
  }

  const fileBuffer = await file.arrayBuffer();
  const signature = new TextDecoder().decode(fileBuffer.slice(0, 5));
  if (!signature.startsWith('%PDF-')) {
    throw new Error('Downloaded file is not a valid PDF');
  }

  const policiesKey = `policies:client:${clientId}`;
  const policies = ((await kv.get(policiesKey)) || []) as KvPolicy[];
  const policyIndex = policies.findIndex((p: KvPolicy) => p.id === policyId);

  if (policyIndex === -1) {
    throw new Error('Policy not found');
  }

  const policy = policies[policyIndex];
  const previousStorageKey = policy.document?.storageKey;
  const fileName = params.fileName || file.name || 'policy_schedule.pdf';
  const storageFileName = params.stableStorageKey
    ? `${documentType}.pdf`
    : `${Date.now()}_${safeStorageFileName(fileName)}`;
  const storageKey = `${clientId}/${policyId}/${storageFileName}`;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error: uploadError } = await supabase.storage
    .from(POLICY_DOC_BUCKET)
    .upload(storageKey, fileBuffer, {
      contentType: 'application/pdf',
      upsert: params.stableStorageKey === true || previousStorageKey === storageKey,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  if (previousStorageKey && previousStorageKey !== storageKey) {
    const { error: deleteError } = await supabase.storage
      .from(POLICY_DOC_BUCKET)
      .remove([previousStorageKey]);

    if (deleteError) {
      await supabase.storage.from(POLICY_DOC_BUCKET).remove([storageKey]).catch(() => undefined);
      throw new Error(`New PDF uploaded but previous policy document could not be deleted: ${deleteError.message}`);
    }
  }

  const docMeta: PolicyDocument = {
    storageKey,
    fileName,
    fileSize: file.size,
    mimeType: 'application/pdf',
    provider: policy.providerName || '',
    productType: POLICY_CATEGORY_LABELS[policy.categoryId] || policy.categoryId,
    documentType,
    uploadDate: new Date().toISOString(),
    uploadedBy,
  };

  policies[policyIndex] = {
    ...policy,
    document: docMeta,
    updatedAt: new Date().toISOString(),
  };

  await kv.set(policiesKey, policies);
  return docMeta;
}

/**
 * POST /policy-documents/upload
 * Upload (or replace) a policy document for a specific policy line item.
 * Accepts multipart/form-data with fields: file, policyId, clientId, documentType, uploadedBy.
 */
app.post('/policy-documents/upload', requireAuth, async (c) => {
  try {
    await ensurePolicyDocBucket();

    let formData: Record<string, string | File>;
    try {
      formData = await c.req.parseBody();
    } catch (parseErr) {
      log.error('Failed to parse policy document upload form data:', parseErr);
      return c.json({
        error: 'Invalid form data. Ensure the request uses multipart/form-data encoding.',
      }, 400);
    }

    const file = formData['file'];
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Validate metadata
    const metadata = PolicyDocumentMetadataSchema.safeParse({
      policyId: formData['policyId'],
      clientId: formData['clientId'],
      documentType: formData['documentType'] || 'policy_schedule',
      uploadedBy: formData['uploadedBy'],
    });

    if (!metadata.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(metadata.error) }, 400);
    }

    const { policyId, clientId, documentType, uploadedBy } = metadata.data;

    const docMeta = await replacePolicyDocumentForPolicy({
      clientId,
      policyId,
      file,
      documentType,
      uploadedBy,
      fileName: file.name,
    });

    log.info('Policy document uploaded successfully', { policyId, storageKey: docMeta.storageKey });

    return c.json({ success: true, document: docMeta });
  } catch (e) {
    log.error('Error uploading policy document:', e);
    return c.json({ error: `Failed to upload policy document: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * GET /policy-documents/download
 * Returns a signed URL for downloading a policy document.
 * Query params: policyId, clientId
 */
app.get('/policy-documents/download', requireAuth, async (c) => {
  try {
    const policyId = c.req.query('policyId');
    const clientId = c.req.query('clientId');

    if (!policyId || !clientId) {
      return c.json({ error: 'Missing policyId or clientId' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policy = (policies as KvPolicy[]).find((p: KvPolicy) => p.id === policyId);

    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    if (!policy.document?.storageKey) {
      return c.json({ error: 'No document attached to this policy' }, 404);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase.storage
      .from(POLICY_DOC_BUCKET)
      .createSignedUrl(policy.document.storageKey, 3600); // 1 hour expiry

    if (error || !data?.signedUrl) {
      log.error('Failed to create signed URL for policy document:', error);
      return c.json({ error: 'Failed to generate download URL' }, 500);
    }

    return c.json({
      success: true,
      url: data.signedUrl,
      document: policy.document,
    });
  } catch (e) {
    log.error('Error generating policy document download URL:', e);
    return c.json({ error: `Failed to get document: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * DELETE /policy-documents
 * Remove a policy document from storage and clear metadata from the policy record.
 * Body: { policyId, clientId }
 */
app.delete('/policy-documents', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = DeletePolicyDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    const { policyId, clientId } = parsed.data;

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policyIndex = (policies as KvPolicy[]).findIndex((p: KvPolicy) => p.id === policyId);

    if (policyIndex === -1) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    const policy = (policies as KvPolicy[])[policyIndex];

    if (!policy.document?.storageKey) {
      return c.json({ error: 'No document attached to this policy' }, 404);
    }

    // Delete from storage
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error: deleteError } = await supabase.storage
      .from(POLICY_DOC_BUCKET)
      .remove([policy.document.storageKey]);

    if (deleteError) {
      log.error('Failed to delete policy document from storage:', deleteError);
      // Continue anyway — clear metadata even if storage delete fails
    }

    // Clear document metadata from the policy
    const { document: _removed, ...policyWithoutDoc } = policy;
    (policies as KvPolicy[])[policyIndex] = {
      ...policyWithoutDoc,
      updatedAt: new Date().toISOString(),
    } as KvPolicy;

    await kv.set(policiesKey, policies);

    log.info('Policy document removed', { policyId, clientId });

    return c.json({ success: true });
  } catch (e) {
    log.error('Error removing policy document:', e);
    return c.json({ error: `Failed to remove document: ${getErrMsg(e)}` }, 500);
  }
});

// ============================================================================
// POLICY EXTRACTION ENDPOINTS (Phase 2)
// ============================================================================

/**
 * POST /policy-extraction/extract
 * Trigger AI extraction on a policy's attached document.
 * Body: { policyId, clientId }
 */
app.post('/policy-extraction/extract', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { policyId, clientId } = body;

    if (!policyId || !clientId) {
      return c.json({ error: 'Missing policyId or clientId' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policyIndex = (policies as KvPolicy[]).findIndex((p: KvPolicy) => p.id === policyId);

    if (policyIndex === -1) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    const policy = (policies as KvPolicy[])[policyIndex];

    if (!policy.document?.storageKey) {
      return c.json({ error: 'No document attached to this policy. Upload a document first.' }, 400);
    }

    // Phase 3: Preserve previous extraction in history before overwriting
    const previousExtraction = policy.extraction;

    if (previousExtraction && (previousExtraction.status === 'completed' || previousExtraction.status === 'failed')) {
      // Pass the stored field mappings snapshot for comparison in history
      const previousFieldMappings = policy.lastFieldMappingsSnapshot
        ? policy.lastFieldMappingsSnapshot.map(s => ({
            canonicalKey: s.k, schemaFieldId: s.f, schemaFieldName: s.n, value: s.v, confidence: s.c,
          }))
        : undefined;

      const historyEntry = buildHistoryEntry(
        previousExtraction,
        previousExtraction.appliedFields?.length || 0,
        policy.document?.fileName,
        previousFieldMappings,
      );

      const existingHistory = policy.extractionHistory || [];
      // Keep last 10 history entries to prevent unbounded growth
      const trimmedHistory = [...existingHistory, historyEntry].slice(-10);

      (policies as KvPolicy[])[policyIndex] = {
        ...policy,
        extractionHistory: trimmedHistory,
      };
    }

    // Mark extraction as pending
    (policies as KvPolicy[])[policyIndex] = {
      ...(policies as KvPolicy[])[policyIndex],
      extraction: {
        extractedData: null,
        extractedAt: new Date().toISOString(),
        confidence: 0,
        status: 'pending',
        model: 'gpt-4o',
      },
      updatedAt: new Date().toISOString(),
    };
    await kv.set(policiesKey, policies);

    // Run the extraction (this can take 10-30 seconds)
    const { extraction, fieldMappings } = await extractPolicyDocument(policy);

    // Phase 3: Generate diff comparing new extraction against current policy data
    let diff: FieldDiff[] | undefined;
    if (extraction.status === 'completed') {
      const changedFields = fieldMappings.filter(m => {
        const current = policy.data?.[m.schemaFieldId];
        return current !== undefined && current !== null && current !== '' &&
          String(current) !== String(m.value);
      });

      if (changedFields.length > 0) {
        diff = changedFields.map(m => ({
          schemaFieldId: m.schemaFieldId,
          fieldName: m.schemaFieldName,
          oldValue: policy.data?.[m.schemaFieldId] ?? null,
          newValue: m.value,
          oldConfidence: 0,
          newConfidence: m.confidence,
          changed: true,
        }));
      }
    }

    // Save the extraction result and field mappings snapshot for future history comparison
    (policies as KvPolicy[])[policyIndex] = {
      ...(policies as KvPolicy[])[policyIndex],
      extraction,
      lastFieldMappingsSnapshot: fieldMappings.slice(0, 50).map(fm => ({
        k: fm.canonicalKey, f: fm.schemaFieldId, n: fm.schemaFieldName, v: fm.value, c: fm.confidence,
      })),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(policiesKey, policies);

    return c.json({
      success: true,
      extraction,
      fieldMappings,
      diff: diff || [],
      historyCount: (policies as KvPolicy[])[policyIndex].extractionHistory?.length || 0,
    });
  } catch (e) {
    log.error('Error extracting policy data:', e);
    return c.json({ error: `Extraction failed: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * GET /policy-extraction/result
 * Get the latest extraction result and field mappings for a policy.
 * Query params: policyId, clientId
 */
app.get('/policy-extraction/result', requireAuth, async (c) => {
  try {
    const policyId = c.req.query('policyId');
    const clientId = c.req.query('clientId');

    if (!policyId || !clientId) {
      return c.json({ error: 'Missing policyId or clientId' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policy = (policies as KvPolicy[]).find((p: KvPolicy) => p.id === policyId);

    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    if (!policy.extraction) {
      return c.json({ error: 'No extraction result available' }, 404);
    }

    return c.json({
      success: true,
      extraction: policy.extraction,
    });
  } catch (e) {
    log.error('Error fetching extraction result:', e);
    return c.json({ error: `Failed to get extraction result: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * GET /policy-extraction/history
 * Get the extraction history for a policy.
 * Query params: policyId, clientId
 */
app.get('/policy-extraction/history', requireAuth, async (c) => {
  try {
    const policyId = c.req.query('policyId');
    const clientId = c.req.query('clientId');

    if (!policyId || !clientId) {
      return c.json({ error: 'Missing policyId or clientId' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policy = (policies as KvPolicy[]).find((p: KvPolicy) => p.id === policyId);

    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    return c.json({
      success: true,
      history: policy.extractionHistory || [],
      currentExtraction: policy.extraction || null,
    });
  } catch (e) {
    log.error('Error fetching extraction history:', e);
    return c.json({ error: `Failed to get extraction history: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * GET /policy-extraction/compare
 * Compare two extraction history entries side-by-side.
 * Query params: policyId, clientId, leftId, rightId
 * Returns: { fields: ComparisonField[] }
 *
 * If rightId is 'current', compares against the live extraction.
 */
app.get('/policy-extraction/compare', requireAuth, async (c) => {
  try {
    const policyId = c.req.query('policyId');
    const clientId = c.req.query('clientId');
    const leftId = c.req.query('leftId');
    const rightId = c.req.query('rightId');

    if (!policyId || !clientId || !leftId || !rightId) {
      return c.json({ error: 'Missing policyId, clientId, leftId, or rightId' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policy = (policies as KvPolicy[]).find((p: KvPolicy) => p.id === policyId);

    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    const history = policy.extractionHistory || [];

    // Resolve left entry
    const leftEntry = history.find(h => h.id === leftId);
    if (!leftEntry) {
      return c.json({ error: `Left entry '${leftId}' not found in history` }, 404);
    }

    // Resolve right entry — 'current' means the live extraction's stored snapshot
    let rightSnapshot: Array<{ k: string; f: string; n: string; v: unknown; c: number }> | undefined;
    let rightMeta: { confidence: number; extractedAt: string } | undefined;

    if (rightId === 'current') {
      rightSnapshot = policy.lastFieldMappingsSnapshot;
      rightMeta = policy.extraction
        ? { confidence: policy.extraction.confidence, extractedAt: policy.extraction.extractedAt }
        : undefined;
    } else {
      const rightEntry = history.find(h => h.id === rightId);
      if (!rightEntry) {
        return c.json({ error: `Right entry '${rightId}' not found in history` }, 404);
      }
      rightSnapshot = rightEntry.fieldMappingsSnapshot;
      rightMeta = { confidence: rightEntry.confidence, extractedAt: rightEntry.extractedAt };
    }

    const leftSnapshot = leftEntry.fieldMappingsSnapshot;

    // Build comparison fields
    if (!leftSnapshot && !rightSnapshot) {
      return c.json({
        success: true,
        fields: [],
        message: 'Neither entry has field mapping snapshots. Comparison data is unavailable for extractions before snapshot storage was enabled.',
      });
    }

    const leftMap = new Map((leftSnapshot || []).map(s => [s.f, s]));
    const rightMap = new Map((rightSnapshot || []).map(s => [s.f, s]));
    const allFieldIds = new Set([...leftMap.keys(), ...rightMap.keys()]);

    const fields: Array<{
      fieldName: string;
      schemaFieldId: string;
      leftValue: unknown;
      rightValue: unknown;
      leftConfidence: number;
      rightConfidence: number;
      changed: boolean;
      confidenceDelta: number;
    }> = [];

    for (const fieldId of allFieldIds) {
      const left = leftMap.get(fieldId);
      const right = rightMap.get(fieldId);

      const leftVal = left?.v ?? null;
      const rightVal = right?.v ?? null;
      const leftConf = left?.c ?? 0;
      const rightConf = right?.c ?? 0;

      fields.push({
        fieldName: right?.n || left?.n || fieldId,
        schemaFieldId: fieldId,
        leftValue: leftVal,
        rightValue: rightVal,
        leftConfidence: leftConf,
        rightConfidence: rightConf,
        changed: String(leftVal) !== String(rightVal),
        confidenceDelta: rightConf - leftConf,
      });
    }

    // Sort: changed first, then by name
    fields.sort((a, b) => {
      if (a.changed !== b.changed) return a.changed ? -1 : 1;
      return a.fieldName.localeCompare(b.fieldName);
    });

    return c.json({
      success: true,
      fields,
      leftMeta: { confidence: leftEntry.confidence, extractedAt: leftEntry.extractedAt },
      rightMeta,
    });
  } catch (e) {
    log.error('Error comparing extractions:', e);
    return c.json({ error: `Comparison failed: ${getErrMsg(e)}` }, 500);
  }
});

function hasExtractedPolicyValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
}

/**
 * POST /policy-extraction/apply
 * Apply selected extracted fields to the policy's data.
 * Body: { policyId, clientId, fieldsToApply: { schemaFieldId: value }[] }
 */
app.post('/policy-extraction/apply', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { policyId, clientId, fieldsToApply } = body;

    if (!policyId || !clientId || !fieldsToApply || typeof fieldsToApply !== 'object') {
      return c.json({ error: 'Missing policyId, clientId, or fieldsToApply' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policyIndex = (policies as KvPolicy[]).findIndex((p: KvPolicy) => p.id === policyId);

    if (policyIndex === -1) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    const policy = (policies as KvPolicy[])[policyIndex];

    // Merge extracted fields into the policy data (skip locked fields)
    const updatedData = { ...policy.data };
    const appliedFieldIds: string[] = [];
    const skippedLockedIds: string[] = [];
    const skippedEmptyIds: string[] = [];
    const lockedSet = new Set(policy.lockedFields || []);

    for (const [fieldId, value] of Object.entries(fieldsToApply)) {
      if (lockedSet.has(fieldId)) {
        skippedLockedIds.push(fieldId);
        continue;
      }
      if (!hasExtractedPolicyValue(value)) {
        skippedEmptyIds.push(fieldId);
        continue;
      }
      updatedData[fieldId] = value;
      appliedFieldIds.push(fieldId);
    }

    // Update the policy with the new data and mark extraction as applied
    (policies as KvPolicy[])[policyIndex] = {
      ...policy,
      data: updatedData,
      extraction: policy.extraction ? {
        ...policy.extraction,
        appliedAt: new Date().toISOString(),
        appliedFields: appliedFieldIds,
      } : undefined,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(policiesKey, policies);
    await recalculateClientTotals(clientId);

    log.info('Extracted data applied to policy', {
      policyId,
      fieldsApplied: appliedFieldIds.length,
    });

    return c.json({
      success: true,
      appliedFields: appliedFieldIds,
      skippedLockedFields: skippedLockedIds,
      skippedEmptyFields: skippedEmptyIds,
      policy: (policies as KvPolicy[])[policyIndex],
    });
  } catch (e) {
    log.error('Error applying extracted data:', e);
    return c.json({ error: `Failed to apply extracted data: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * POST /policy-extraction/lock-fields
 * Lock or unlock schema fields to protect them from AI extraction overwrite.
 * Body: { policyId, clientId, fieldIds: string[], action: 'lock' | 'unlock' }
 */
app.post('/policy-extraction/lock-fields', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { policyId, clientId, fieldIds, action } = body;

    if (!policyId || !clientId || !Array.isArray(fieldIds) || !['lock', 'unlock'].includes(action)) {
      return c.json({ error: 'Missing or invalid policyId, clientId, fieldIds (array), or action (lock|unlock)' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policyIndex = (policies as KvPolicy[]).findIndex((p: KvPolicy) => p.id === policyId);

    if (policyIndex === -1) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    const policy = (policies as KvPolicy[])[policyIndex];
    const currentLocked = new Set(policy.lockedFields || []);

    if (action === 'lock') {
      for (const fid of fieldIds) currentLocked.add(fid);
    } else {
      for (const fid of fieldIds) currentLocked.delete(fid);
    }

    const updatedLockedFields = Array.from(currentLocked);

    (policies as KvPolicy[])[policyIndex] = {
      ...policy,
      lockedFields: updatedLockedFields,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(policiesKey, policies);

    log.info('Policy field locks updated', {
      policyId,
      action,
      fieldIds,
      totalLocked: updatedLockedFields.length,
    });

    return c.json({
      success: true,
      lockedFields: updatedLockedFields,
    });
  } catch (e) {
    log.error('Error updating field locks:', e);
    return c.json({ error: `Failed to update field locks: ${getErrMsg(e)}` }, 500);
  }
});

// ============================================================================
// PROVIDER TERMINOLOGY ENDPOINTS (Phase 2)
// ============================================================================

/**
 * GET /provider-terminology
 * Get terminology mapping for a specific provider, or all provider mappings.
 * Query params: providerId (optional — if omitted, returns all)
 */
app.get('/provider-terminology', requireAuth, async (c) => {
  try {
    const providerId = c.req.query('providerId');

    if (providerId) {
      const map = await getProviderTerminology(providerId);
      return c.json({ success: true, terminology: map });
    }

    const all = await getAllProviderTerminologies();
    return c.json({ success: true, terminologies: all });
  } catch (e) {
    log.error('Error fetching provider terminology:', e);
    return c.json({ error: `Failed to get terminology: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * POST /provider-terminology
 * Save or update a provider's terminology mapping.
 * Body: ProviderTerminologyMap
 */
app.post('/provider-terminology', requireAuth, async (c) => {
  try {
    const body = await c.req.json();

    if (!body.providerId || !body.providerName) {
      return c.json({ error: 'Missing providerId or providerName' }, 400);
    }

    const map: ProviderTerminologyMap = {
      providerId: body.providerId,
      providerName: body.providerName,
      benefitMappings: body.benefitMappings || {},
      productMappings: body.productMappings || {},
      updatedAt: new Date().toISOString(),
      updatedBy: body.updatedBy || 'admin',
    };

    await saveProviderTerminology(map);

    return c.json({ success: true, terminology: map });
  } catch (e) {
    log.error('Error saving provider terminology:', e);
    return c.json({ error: `Failed to save terminology: ${getErrMsg(e)}` }, 500);
  }
});

// ============================================================================
// EXTRACTION QUALITY STATS ENDPOINT
// ============================================================================

/**
 * GET /policy-extraction/quality-stats
 * Aggregated extraction quality metrics across all policies.
 * Returns: per-provider stats, overall stats, low-confidence field frequency,
 *          and extraction timeline data.
 */
app.get('/policy-extraction/quality-stats', requireAuth, async (c) => {
  try {
    // Fetch all client policy keys
    const allPolicyEntries = await kv.getByPrefix('policies:client:');

    interface ProviderStats {
      providerId: string;
      providerName: string;
      totalPolicies: number;
      withDocuments: number;
      withExtractions: number;
      completedExtractions: number;
      failedExtractions: number;
      avgConfidence: number;
      confidenceSum: number;
      totalFieldsMapped: number;
      totalWarnings: number;
      lockedFieldCount: number;
    }

    const providerMap = new Map<string, ProviderStats>();
    const fieldConfidenceMap = new Map<string, { fieldName: string; totalConfidence: number; count: number; lowCount: number }>();
    const timelineEntries: Array<{ date: string; confidence: number; provider: string; status: string }> = [];
    let totalPolicies = 0;
    let totalWithDocs = 0;
    let totalWithExtractions = 0;
    let totalCompleted = 0;
    let totalFailed = 0;
    let totalLockedFields = 0;
    let overallConfidenceSum = 0;

    for (const entry of allPolicyEntries) {
      const policies = (Array.isArray(entry) ? entry : []) as KvPolicy[];
      for (const policy of policies) {
        if (policy.archived) continue;
        totalPolicies++;

        // Get or create provider stats
        let pStats = providerMap.get(policy.providerId);
        if (!pStats) {
          pStats = {
            providerId: policy.providerId,
            providerName: policy.providerName,
            totalPolicies: 0,
            withDocuments: 0,
            withExtractions: 0,
            completedExtractions: 0,
            failedExtractions: 0,
            avgConfidence: 0,
            confidenceSum: 0,
            totalFieldsMapped: 0,
            totalWarnings: 0,
            lockedFieldCount: 0,
          };
          providerMap.set(policy.providerId, pStats);
        }
        pStats.totalPolicies++;

        if (policy.document) {
          totalWithDocs++;
          pStats.withDocuments++;
        }

        if (policy.lockedFields?.length) {
          totalLockedFields += policy.lockedFields.length;
          pStats.lockedFieldCount += policy.lockedFields.length;
        }

        if (policy.extraction) {
          totalWithExtractions++;
          pStats.withExtractions++;

          if (policy.extraction.status === 'completed') {
            totalCompleted++;
            pStats.completedExtractions++;
            pStats.confidenceSum += policy.extraction.confidence;
            overallConfidenceSum += policy.extraction.confidence;
            pStats.totalWarnings += policy.extraction.validationWarnings?.length || 0;

            // Timeline entry
            timelineEntries.push({
              date: policy.extraction.extractedAt,
              confidence: policy.extraction.confidence,
              provider: policy.providerName,
              status: 'completed',
            });

            // Field-level confidence tracking from snapshot
            if (policy.lastFieldMappingsSnapshot) {
              pStats.totalFieldsMapped += policy.lastFieldMappingsSnapshot.length;
              for (const fm of policy.lastFieldMappingsSnapshot) {
                let fStats = fieldConfidenceMap.get(fm.f);
                if (!fStats) {
                  fStats = { fieldName: fm.n, totalConfidence: 0, count: 0, lowCount: 0 };
                  fieldConfidenceMap.set(fm.f, fStats);
                }
                fStats.totalConfidence += fm.c;
                fStats.count++;
                if (fm.c < 0.5) fStats.lowCount++;
              }
            }
          } else if (policy.extraction.status === 'failed') {
            totalFailed++;
            pStats.failedExtractions++;

            timelineEntries.push({
              date: policy.extraction.extractedAt,
              confidence: 0,
              provider: policy.providerName,
              status: 'failed',
            });
          }
        }
      }
    }

    // Compute averages
    const providerStats = Array.from(providerMap.values()).map(ps => ({
      ...ps,
      avgConfidence: ps.completedExtractions > 0
        ? Math.round((ps.confidenceSum / ps.completedExtractions) * 100) / 100
        : 0,
      successRate: ps.withExtractions > 0
        ? Math.round(((ps.completedExtractions / ps.withExtractions) * 100) * 10) / 10
        : 0,
    }));

    // Sort providers by extraction count descending
    providerStats.sort((a, b) => b.withExtractions - a.withExtractions);

    // Low-confidence fields (fields that frequently have confidence < 0.5)
    const lowConfidenceFields = Array.from(fieldConfidenceMap.entries())
      .map(([fieldId, s]) => ({
        fieldId,
        fieldName: s.fieldName,
        avgConfidence: Math.round((s.totalConfidence / s.count) * 100) / 100,
        occurrences: s.count,
        lowConfidenceCount: s.lowCount,
        lowConfidenceRate: Math.round((s.lowCount / s.count) * 100),
      }))
      .filter(f => f.lowConfidenceCount > 0)
      .sort((a, b) => b.lowConfidenceRate - a.lowConfidenceRate)
      .slice(0, 15);

    // Sort timeline chronologically and limit
    timelineEntries.sort((a, b) => a.date.localeCompare(b.date));

    return c.json({
      success: true,
      overview: {
        totalPolicies,
        totalWithDocuments: totalWithDocs,
        totalExtractions: totalWithExtractions,
        completedExtractions: totalCompleted,
        failedExtractions: totalFailed,
        avgConfidence: totalCompleted > 0
          ? Math.round((overallConfidenceSum / totalCompleted) * 100) / 100
          : 0,
        successRate: totalWithExtractions > 0
          ? Math.round(((totalCompleted / totalWithExtractions) * 100) * 10) / 10
          : 0,
        totalLockedFields,
      },
      providerStats,
      lowConfidenceFields,
      timeline: timelineEntries.slice(-50),
    });
  } catch (e) {
    log.error('Error computing extraction quality stats:', e);
    return c.json({ error: `Failed to compute quality stats: ${getErrMsg(e)}` }, 500);
  }
});

// ============================================================================
// BULK RE-EXTRACTION ENDPOINT (Phase 3)
// ============================================================================

/**
 * POST /policy-extraction/bulk-reextract
 * Find all policies for a given provider that have documents attached
 * and queue them for re-extraction. Supports dry-run mode (default: true).
 * Body: { providerId, dryRun?: boolean }
 */
app.post('/policy-extraction/bulk-reextract', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { providerId, dryRun = true } = body;

    if (!providerId) {
      return c.json({ error: 'Missing providerId' }, 400);
    }

    // Scan all client policy keys to find policies with this provider
    const allClientEntries = await kv.getByPrefix('policies:client:');
    const candidates: Array<{
      clientId: string;
      policyId: string;
      providerName: string;
      fileName: string;
      hasExistingExtraction: boolean;
    }> = [];

    for (const entry of allClientEntries || []) {
      // getByPrefix returns raw values — each is the array of KvPolicy[]
      const policies = (Array.isArray(entry) ? entry : []) as KvPolicy[];

      for (const policy of policies) {
        if (
          policy.providerId === providerId &&
          policy.document?.storageKey &&
          !policy.archived
        ) {
          candidates.push({
            clientId: policy.clientId,
            policyId: policy.id,
            providerName: policy.providerName,
            fileName: policy.document.fileName,
            hasExistingExtraction: !!policy.extraction?.extractedData,
          });
        }
      }
    }

    if (dryRun) {
      return c.json({
        success: true,
        dryRun: true,
        candidateCount: candidates.length,
        candidates: candidates.map(cand => ({
          policyId: cand.policyId,
          fileName: cand.fileName,
          hasExistingExtraction: cand.hasExistingExtraction,
        })),
        message: `Found ${candidates.length} policies with documents for this provider. Set dryRun: false to execute.`,
      });
    }

    // Live run — stream NDJSON progress events as each policy is processed
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
        };

        let successCount = 0;
        let failCount = 0;
        const total = candidates.length;

        send({ type: 'start', total, providerId });

        for (let i = 0; i < candidates.length; i++) {
          const cand = candidates[i];
          send({
            type: 'progress',
            current: i + 1,
            total,
            policyId: cand.policyId,
            fileName: cand.fileName,
            status: 'processing',
          });

          try {
            const policiesKey = `policies:client:${cand.clientId}`;
            const policies = ((await kv.get(policiesKey)) || []) as KvPolicy[];
            const policyIndex = policies.findIndex(p => p.id === cand.policyId);

            if (policyIndex === -1) {
              send({
                type: 'result',
                current: i + 1,
                total,
                policyId: cand.policyId,
                fileName: cand.fileName,
                status: 'skipped',
                error: 'Policy not found',
              });
              continue;
            }

            const policy = policies[policyIndex];

            // Preserve previous extraction in history with field mappings snapshot
            if (policy.extraction && (policy.extraction.status === 'completed' || policy.extraction.status === 'failed')) {
              const prevFM = policy.lastFieldMappingsSnapshot
                ? policy.lastFieldMappingsSnapshot.map(s => ({
                    canonicalKey: s.k, schemaFieldId: s.f, schemaFieldName: s.n, value: s.v, confidence: s.c,
                  }))
                : undefined;

              const historyEntry = buildHistoryEntry(
                policy.extraction,
                policy.extraction.appliedFields?.length || 0,
                policy.document?.fileName,
                prevFM,
              );
              const existingHistory = policy.extractionHistory || [];
              policies[policyIndex] = {
                ...policy,
                extractionHistory: [...existingHistory, historyEntry].slice(-10),
              };
            }

            const { extraction, fieldMappings: newFM } = await extractPolicyDocument(policy);

            policies[policyIndex] = {
              ...policies[policyIndex],
              extraction,
              lastFieldMappingsSnapshot: newFM.slice(0, 50).map(fm => ({
                k: fm.canonicalKey, f: fm.schemaFieldId, n: fm.schemaFieldName, v: fm.value, c: fm.confidence,
              })),
              updatedAt: new Date().toISOString(),
            };
            await kv.set(policiesKey, policies);

            successCount++;
            send({
              type: 'result',
              current: i + 1,
              total,
              policyId: cand.policyId,
              fileName: cand.fileName,
              status: extraction.status,
              confidence: extraction.confidence,
            });
          } catch (err) {
            failCount++;
            send({
              type: 'result',
              current: i + 1,
              total,
              policyId: cand.policyId,
              fileName: cand.fileName,
              status: 'failed',
              error: getErrMsg(err),
            });
          }
        }

        log.info('Bulk re-extraction complete', {
          providerId,
          total,
          success: successCount,
          failed: failCount,
        });

        send({
          type: 'complete',
          totalProcessed: total,
          successCount,
          failCount,
        });

        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e) {
    log.error('Bulk re-extraction error:', e);
    return c.json({ error: `Bulk re-extraction failed: ${getErrMsg(e)}` }, 500);
  }
});

export default app;


