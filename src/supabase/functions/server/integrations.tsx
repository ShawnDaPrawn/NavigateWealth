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
  CustomKey,
  KvFnaEntry,
  PolicyRenewal,
  PolicyDocument,
} from "./integrations-types.ts";
import {
  extractPolicyDocument,
  getProviderTerminology,
  saveProviderTerminology,
  getAllProviderTerminologies,
  generateExtractionDiff,
  buildHistoryEntry,
} from './policy-extraction-service.ts';
import type {
  ExtractionResult,
  FieldMappingEntry,
  ProviderTerminologyMap,
  ExtractionHistoryEntry,
  FieldDiff,
} from './policy-extraction-types.ts';
import {
  buildIntegrationBindingsForFields,
  buildLegacyFieldMappingFromBindings,
  buildPortalFieldsFromBindings,
  normaliseIntegrationBlankBehavior,
  normaliseIntegrationColumnName,
  normaliseIntegrationLabelList,
  type IntegrationBlankBehavior,
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
  getTemplateRowMetadata,
  isTemplateMetadataColumn,
  jsonRowsToSpreadsheetSheet,
  normalisePolicyNumber,
  parseSpreadsheetDateSerial,
  readSpreadsheetUpload,
  rowsToSpreadsheetSheet,
  serialiseTemplateCellValue,
  writeSpreadsheetWorkbook,
  type IntegrationTemplateRowMetadata,
} from './integrations-spreadsheet.ts';

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

// --- Types ---

interface IntegrationConfig {
  providerId: string;
  categoryId: string;
  updatedAt: string;
  updatedBy: string;
  fieldMapping: Record<string, string>;
  fieldBindings?: IntegrationFieldBinding[];
  settings: {
    autoMap: boolean;
    ignoreUnmatched: boolean;
    strictMode: boolean;
    autoPublish?: boolean;
  };
}

interface IntegrationFieldBinding {
  targetFieldId: string;
  targetFieldName?: string;
  columnName: string;
  required?: boolean;
  fieldType?: string;
  portalLabels?: string[];
  portalSelector?: string;
  blankBehavior?: IntegrationBlankBehavior;
  transform?: 'trim' | 'number' | 'date' | string;
}

interface UploadHistory {
  id: string;
  providerId: string;
  categoryId: string;
  fileName: string;
  status: 'success' | 'failed';
  rowCount: number;
  errorCount: number;
  uploadedAt: string;
  errors?: string[];
  runId?: string;
  publishedRows?: number;
}

interface IntegrationProvider {
  id: string;
  name: string;
  description?: string;
  categoryIds: string[];
  logoUrl?: string;
  lastAttempted?: string;
  lastUpdateStatus?: 'success' | 'failed' | 'never';
  lastSuccessful?: string;
}

type SyncMatchStatus = 'matched' | 'unmatched' | 'duplicate' | 'invalid';
type SyncPublishStatus = 'pending' | 'auto_eligible' | 'held' | 'published' | 'skipped' | 'failed';
type SyncRunStatus = 'staged' | 'published' | 'partially_published' | 'failed';

interface SyncDiff {
  fieldId: string;
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
}

interface IntegrationSyncRow {
  id: string;
  rowNumber: number;
  rawData: Record<string, unknown>;
  mappedData: Record<string, unknown>;
  policyNumber: string;
  normalizedPolicyNumber: string;
  matchMethod: 'template_metadata' | 'policy_number' | 'none';
  matchStatus: SyncMatchStatus;
  publishStatus: SyncPublishStatus;
  autoPublishEligible: boolean;
  validationErrors: string[];
  warnings: string[];
  diffs: SyncDiff[];
  clientId?: string;
  policyId?: string;
  providerName?: string;
}

interface IntegrationSyncRun {
  id: string;
  providerId: string;
  providerName: string;
  categoryId: string;
  fileName: string;
  source: 'spreadsheet' | 'portal';
  status: SyncRunStatus;
  createdAt: string;
  updatedAt: string;
  mappingVersion: string;
  autoPublish: boolean;
  summary: {
    totalRows: number;
    matchedRows: number;
    unmatchedRows: number;
    duplicateRows: number;
    invalidRows: number;
    changedRows: number;
    noChangeRows: number;
    autoEligibleRows: number;
    publishedRows: number;
    heldRows: number;
  };
  rows: IntegrationSyncRow[];
}

type PortalJobStatus = 'queued' | 'running' | 'waiting_for_otp' | 'discovering' | 'discovery_ready' | 'extracting' | 'dry_run_ready' | 'staging' | 'staged' | 'failed' | 'cancelled';
type PortalJobRunMode = 'discover' | 'dry-run' | 'run';
type PortalAutomationHost = 'github_actions' | 'hosted_worker' | 'manual';
type PortalJobItemStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'skipped';

interface PortalCredentialProfile {
  id: string;
  label: string;
  source: 'environment' | 'supabase_kv' | 'supabase_vault';
  usernameEnvVar?: string;
  passwordEnvVar?: string;
  usernameSecretName?: string;
  passwordSecretName?: string;
}

interface PortalCredentialRecord {
  providerId: string;
  profileId: string;
  username: string;
  password: string;
  updatedAt: string;
  updatedBy?: string;
}

interface PortalCredentialStatus {
  providerId: string;
  profileId: string;
  hasUsername: boolean;
  hasPassword: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

interface PortalFlowField {
  sourceHeader: string;
  columnName?: string;
  targetFieldId?: string;
  targetFieldName?: string;
  selector: string;
  labels?: string[];
  attribute?: 'text' | 'value' | 'href' | string;
  required?: boolean;
  transform?: 'trim' | 'number' | 'date' | string;
}

interface PortalSearchBrainConfig {
  enabled?: boolean;
  goal?: string;
  maxDecisionsPerItem?: number;
  rememberSelectors?: boolean;
}

interface PortalFlowStep {
  id: string;
  action: 'goto' | 'click' | 'fill' | 'wait_for_selector' | 'wait_for_url' | 'press';
  selector?: string;
  url?: string;
  value?: string;
  key?: string;
  timeoutMs?: number;
  description?: string;
  optional?: boolean;
}

interface PortalPolicyScheduleConfig {
  enabled?: boolean;
  downloadSelector?: string;
  downloadLabels?: string[];
  documentType?: 'policy_schedule' | 'amendment' | 'statement' | 'benefit_summary' | 'other';
  required?: boolean;
  waitForDownloadMs?: number;
}

interface PortalProviderFlow {
  id: string;
  providerId: string;
  name: string;
  loginUrl: string;
  credentialProfiles: PortalCredentialProfile[];
  login: {
    usernameSelector: string;
    passwordSelector: string;
    submitSelector: string;
  };
  otp: {
    mode: 'manual_sms';
    detectionSelectors: string[];
    inputSelector: string;
    submitSelector: string;
    timeoutMs: number;
    instructions: string;
  };
  navigation: {
    postLoginUrl?: string;
    policyListSteps?: PortalFlowStep[];
    clientListSelector?: string;
    clientRowSelector?: string;
    nextPageSelector?: string;
  };
  search?: {
    mode: 'policy_number';
    searchPageUrl?: string;
    searchInputSelector?: string;
    searchInputLabels?: string[];
    submitSelector?: string;
    resultContainerSelector?: string;
    resultLinkSelector?: string;
    resultPolicyNumberSelector?: string;
    noResultsText?: string[];
    instructions?: string;
    brain?: PortalSearchBrainConfig;
  };
  extraction: {
    policyRowSelector?: string;
    fields: PortalFlowField[];
  };
  policySchedule?: PortalPolicyScheduleConfig;
  notes: string[];
  needsDiscovery?: boolean;
  updatedAt: string;
}

interface PortalSyncJob {
  id: string;
  providerId: string;
  providerName: string;
  categoryId: string;
  status: PortalJobStatus;
  runMode?: PortalJobRunMode;
  automationHost?: PortalAutomationHost;
  flowId: string;
  credentialProfileId: string;
  workerId?: string;
  actionsRunId?: number;
  actionsRunUrl?: string;
  actionsDispatchError?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  currentStep?: string;
  message?: string;
  extractedRows?: number;
  stagedRunId?: string;
  discoveryReportId?: string;
  error?: string;
  warning?: string;
  warnings?: string[];
  currentItemId?: string;
  currentClientName?: string;
  currentPolicyNumber?: string;
  queueSummary?: PortalJobQueueSummary;
}

interface PortalJobQueueSummary {
  total: number;
  queued: number;
  inProgress: number;
  completed: number;
  failed: number;
  skipped: number;
}

interface PortalJobPolicyItem {
  id: string;
  jobId: string;
  providerId: string;
  providerName: string;
  categoryId: string;
  clientId: string;
  clientName: string;
  policyId: string;
  policyNumber: string;
  normalizedPolicyNumber: string;
  status: PortalJobItemStatus;
  currentStep?: string;
  message?: string;
  error?: string;
  warning?: string;
  warnings?: string[];
  workerId?: string;
  rawData?: Record<string, unknown>;
  extractedData?: Record<string, unknown>;
  matchConfidence?: 'high' | 'medium' | 'low';
  documentAttached?: boolean;
  documentFileName?: string;
  documentUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface PortalBrainMemoryEntry {
  selector: string;
  label?: string;
  notes?: string;
  successCount: number;
  lastUsedAt: string;
  source: 'brain' | 'deterministic' | 'manual';
}

interface PortalBrainMemory {
  providerId: string;
  categoryId: string;
  updatedAt: string;
  searchInputHints: PortalBrainMemoryEntry[];
  searchResultHints: PortalBrainMemoryEntry[];
  stats: {
    brainCalls: number;
    successfulDecisions: number;
    searchInputSuccesses: number;
    searchResultSuccesses: number;
  };
}

interface PortalBrainMemorySummary {
  providerId: string;
  categoryId: string;
  available: boolean;
  configured: boolean;
  model?: string;
  updatedAt?: string;
  searchInputHints: number;
  searchResultHints: number;
  successfulDecisions: number;
  brainCalls: number;
  lastSearchInputSelector?: string;
  lastResultSelector?: string;
}

interface PortalDiscoveryReport {
  id: string;
  jobId: string;
  providerId: string;
  categoryId: string;
  createdAt: string;
  mode: 'discover' | 'dry-run';
  urlHost: string;
  title?: string;
  summary: {
    inputCount: number;
    buttonCount: number;
    linkCount: number;
    tableCount: number;
    candidatePolicyTables: number;
    extractedRowCount?: number;
  };
  selectorCandidates: Array<{
    purpose: 'input' | 'button' | 'link' | 'table' | 'policy_row' | 'field';
    selector: string;
    tag?: string;
    type?: string;
    role?: string;
    label?: string;
    confidence: 'low' | 'medium' | 'high';
    notes?: string;
  }>;
  tableSummaries: Array<{
    selector: string;
    headerTexts: string[];
    rowCount: number;
  }>;
  warnings: string[];
}

function getDefaultIntegrationSettings(): IntegrationConfig['settings'] {
  return {
    autoMap: true,
    ignoreUnmatched: false,
    strictMode: false,
    autoPublish: false,
  };
}

function normaliseSettings(settings?: Partial<IntegrationConfig['settings']>): IntegrationConfig['settings'] {
  return {
    ...getDefaultIntegrationSettings(),
    ...(settings || {}),
  };
}

function normaliseColumnName(value: unknown): string {
  return normaliseIntegrationColumnName(value);
}

function buildFieldBinding(
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
    portalSelector: String(existing?.portalSelector || '').trim().slice(0, 500) || undefined,
    blankBehavior: normaliseIntegrationBlankBehavior(existing?.blankBehavior),
    transform: String(existing?.transform || 'trim').trim().slice(0, 40) || 'trim',
  };
}

function normaliseFieldBindings(
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
    Array.isArray(bindings) ? bindings as IntegrationFieldBinding[] : [],
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

function fieldBindingsToMapping(
  bindings: IntegrationFieldBinding[] = [],
  fallbackFieldMapping: Record<string, string> = {},
): Record<string, string> {
  const fieldMapping = buildLegacyFieldMappingFromBindings(bindings);
  if (Object.keys(fieldMapping).length > 0) return fieldMapping;

  return Object.fromEntries(
    Object.entries(fallbackFieldMapping || {})
      .map(([columnName, targetFieldId]) => [normaliseColumnName(columnName), String(targetFieldId || '').trim()])
      .filter(([columnName, targetFieldId]) => columnName && targetFieldId),
  );
}

function getPortalFieldColumnName(field: Partial<PortalFlowField>): string {
  return normaliseColumnName(field.columnName || field.sourceHeader);
}

function getPortalFieldDisplayName(field: Partial<PortalFlowField>): string {
  return String(field.targetFieldName || field.columnName || field.sourceHeader || field.targetFieldId || 'Field').trim();
}

function normaliseIntegrationConfig(
  config: Partial<IntegrationConfig> | null | undefined,
  fields: SchemaField[] = [],
): IntegrationConfig {
  const fieldBindings = normaliseFieldBindings(config?.fieldBindings, config?.fieldMapping || {}, fields);
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

function getCategoryLabel(categoryId: string): string {
  return POLICY_CATEGORY_LABELS[categoryId] || categoryId;
}

function getTemplateFieldBindings(config: IntegrationConfig, fields: SchemaField[]): IntegrationFieldBinding[] {
  const configured = Array.isArray(config.fieldBindings) ? config.fieldBindings : [];
  const bindingsByTarget = new Map(configured.map((binding) => [binding.targetFieldId, binding]));
  const orderedBindings: IntegrationFieldBinding[] = [];
  const policyNumberField = findPolicyNumberField(fields);

  if (configured.length > 0) {
    for (const field of fields) {
      const binding = bindingsByTarget.get(field.id);
      if (!binding) continue;
      orderedBindings.push(buildFieldBinding(field, field.id, binding.columnName, binding));
    }

    for (const binding of configured) {
      if (orderedBindings.some((entry) => entry.targetFieldId === binding.targetFieldId)) continue;
      const targetFieldId = String(binding.targetFieldId || '').trim();
      const columnName = normaliseColumnName(binding.columnName);
      if (!targetFieldId || !columnName) continue;
      orderedBindings.push({
        ...binding,
        targetFieldId,
        columnName,
        targetFieldName: binding.targetFieldName || targetFieldId,
      });
    }

    if (policyNumberField && !orderedBindings.some((binding) => binding.targetFieldId === policyNumberField.id)) {
      orderedBindings.unshift(buildFieldBinding(policyNumberField, policyNumberField.id, policyNumberField.name || policyNumberField.id));
    }

    return orderedBindings.filter((binding) => normaliseColumnName(binding.columnName));
  }

  return fields
    .map((field) => buildFieldBinding(field, field.id, field.name || field.id))
    .filter((binding) => normaliseColumnName(binding.columnName));
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

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

function valuesDiffer(oldValue: unknown, newValue: unknown): boolean {
  return String(oldValue ?? '').trim() !== String(newValue ?? '').trim();
}

function portalCredentialKey(providerId: string, profileId: string): string {
  return `portal-credential:${providerId}:${profileId}`;
}

function portalCredentialStatus(record: PortalCredentialRecord | null, providerId: string, profileId: string): PortalCredentialStatus {
  return {
    providerId,
    profileId,
    hasUsername: !!record?.username,
    hasPassword: !!record?.password,
    updatedAt: record?.updatedAt,
    updatedBy: record?.updatedBy,
  };
}

function getWorkerSecret(): string {
  return String(Deno.env.get('NW_PORTAL_WORKER_SECRET') || Deno.env.get('PORTAL_WORKER_SECRET') || '').trim();
}

function isPortalWorkerRequest(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const expected = getWorkerSecret();
  if (!expected) return false;
  const headerSecret = String(c.req.header('X-Portal-Worker-Secret') || '').trim();
  const authHeader = String(c.req.header('Authorization') || '');
  const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
  return headerSecret === expected || bearerSecret === expected;
}

function requirePortalWorker(c: { json: (body: unknown, status?: number) => Response; req: { header: (name: string) => string | undefined } }): Response | null {
  if (!getWorkerSecret()) {
    return c.json({ error: 'Portal worker secret is not configured on Supabase' }, 503);
  }
  if (!isPortalWorkerRequest(c)) {
    return c.json({ error: 'Unauthorized portal worker' }, 401);
  }
  return null;
}

function categoryMatches(requestedCategoryId: string, policyCategoryId: string): boolean {
  if (requestedCategoryId === policyCategoryId) return true;

  const groupedCategories: Record<string, string[]> = {
    retirement_planning: ['retirement_planning', 'retirement_pre', 'retirement_post'],
    investments: ['investments', 'investments_voluntary', 'investments_guaranteed'],
    employee_benefits: ['employee_benefits', 'employee_benefits_risk', 'employee_benefits_retirement'],
  };

  return (groupedCategories[requestedCategoryId] || [requestedCategoryId]).includes(policyCategoryId);
}

function summarisePortalJobItems(items: PortalJobPolicyItem[]): PortalJobQueueSummary {
  return {
    total: items.length,
    queued: items.filter((item) => item.status === 'queued').length,
    inProgress: items.filter((item) => item.status === 'in_progress').length,
    completed: items.filter((item) => item.status === 'completed').length,
    failed: items.filter((item) => item.status === 'failed').length,
    skipped: items.filter((item) => item.status === 'skipped').length,
  };
}

async function getClientDisplayName(clientId: string): Promise<string> {
  const profile = (await kv.get(`user_profile:${clientId}:personal_info`)) as Record<string, unknown> | null;
  const personal = (profile?.personalInformation || profile?.personal_info || {}) as Record<string, unknown>;
  const firstName = String(profile?.firstName || personal.firstName || personal.first_name || '').trim();
  const lastName = String(profile?.lastName || profile?.surname || personal.lastName || personal.surname || personal.last_name || '').trim();
  const fullName = String(profile?.fullName || personal.fullName || personal.full_name || '').trim();
  const combined = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName || combined || `Client ${clientId.slice(0, 8)}`;
}

async function buildPortalPolicyQueue(job: PortalSyncJob, fields: SchemaField[]): Promise<PortalJobPolicyItem[]> {
  const policyNumberField = findPolicyNumberField(fields);
  if (!policyNumberField) {
    throw new Error('No policy number field exists in this product structure. Add or map a Policy Number field before running portal automation.');
  }

  const allClientPolicies = await kv.getByPrefix('policies:client:');
  const now = new Date().toISOString();
  const items: PortalJobPolicyItem[] = [];
  const schemaCache = new Map<string, KvSchema>();

  for (const clientPolicies of allClientPolicies || []) {
    if (!Array.isArray(clientPolicies)) continue;

    for (const policy of clientPolicies as KvPolicy[]) {
      if (policy.archived || policy.providerId !== job.providerId || !categoryMatches(job.categoryId, policy.categoryId)) continue;

      const policyNumber = await getPolicyNumberForPolicy(policy, fields, schemaCache);
      const normalizedPolicyNumber = normalisePolicyNumber(policyNumber);
      if (!normalizedPolicyNumber) continue;

      items.push({
        id: crypto.randomUUID(),
        jobId: job.id,
        providerId: job.providerId,
        providerName: job.providerName,
        categoryId: policy.categoryId,
        clientId: policy.clientId,
        clientName: await getClientDisplayName(policy.clientId),
        policyId: policy.id,
        policyNumber,
        normalizedPolicyNumber,
        status: 'queued',
        currentStep: 'queued',
        message: 'Waiting for the worker to search this policy.',
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return items.sort((a, b) =>
    a.clientName.localeCompare(b.clientName) || a.policyNumber.localeCompare(b.policyNumber)
  );
}

async function loadPortalJobItems(jobId: string): Promise<PortalJobPolicyItem[]> {
  const items = (await kv.get(`portal-job-items:${jobId}`)) as PortalJobPolicyItem[] | null;
  return Array.isArray(items) ? items : [];
}

function sanitisePortalWarnings(value: unknown, fallback: string[] = []): string[] {
  const base = Array.isArray(fallback) ? fallback : [];
  const incoming = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? [value]
      : [];
  const combined = [...base, ...incoming]
    .map((warning) => String(warning || '').trim().slice(0, 500))
    .filter(Boolean);
  return Array.from(new Set(combined)).slice(-20);
}

function latestPortalWarning(warnings?: string[]): string | undefined {
  return Array.isArray(warnings) && warnings.length > 0 ? warnings[warnings.length - 1] : undefined;
}

async function persistPortalJobItems(job: PortalSyncJob, items: PortalJobPolicyItem[], patch: Partial<PortalSyncJob> = {}): Promise<PortalSyncJob> {
  const now = new Date().toISOString();
  const summary = summarisePortalJobItems(items);
  await kv.set(`portal-job-items:${job.id}`, items);

  const warnings = patch.warnings === undefined && patch.warning === undefined
    ? sanitisePortalWarnings(job.warnings)
    : sanitisePortalWarnings(patch.warnings ?? patch.warning, job.warnings);

  const updatedJob: PortalSyncJob = {
    ...job,
    ...patch,
    warnings,
    warning: latestPortalWarning(warnings),
    queueSummary: summary,
    extractedRows: summary.completed,
    updatedAt: now,
  };

  await kv.set(`portal-job:${job.id}`, updatedJob);
  await kv.set(`portal-job:latest:${job.providerId}:${job.categoryId}`, { jobId: job.id, updatedAt: now });
  return updatedJob;
}

function normaliseRunMode(value: unknown): PortalJobRunMode {
  return value === 'dry-run' || value === 'run' ? value : 'discover';
}

function getPortalGitHubActionsConfig() {
  const token = String(Deno.env.get('NW_GITHUB_ACTIONS_TOKEN') || Deno.env.get('GITHUB_ACTIONS_DISPATCH_TOKEN') || '').trim();
  const repo = String(Deno.env.get('NW_GITHUB_ACTIONS_REPO') || 'ShawnDaPrawn/NavigateWealth').trim();
  const workflowId = String(Deno.env.get('NW_GITHUB_ACTIONS_WORKFLOW_ID') || 'provider-portal-worker.yml').trim();
  const ref = String(Deno.env.get('NW_GITHUB_ACTIONS_REF') || 'main').trim();
  const apiBase = String(Deno.env.get('NW_GITHUB_ACTIONS_API_BASE') || 'https://api.github.com').replace(/\/$/, '');
  return { token, repo, workflowId, ref, apiBase };
}

async function dispatchPortalGitHubAction(job: PortalSyncJob): Promise<Partial<PortalSyncJob>> {
  const { token, repo, workflowId, ref, apiBase } = getPortalGitHubActionsConfig();
  if (!token || !repo || !workflowId || !ref) {
    return {
      automationHost: 'manual',
      actionsDispatchError: 'GitHub Actions dispatch is not configured. Set NW_GITHUB_ACTIONS_TOKEN on the Supabase Edge Function.',
      message: 'Portal job queued, but GitHub Actions dispatch is not configured yet.',
    };
  }

  const response = await fetch(`${apiBase}/repos/${repo}/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2026-03-10',
    },
    body: JSON.stringify({
      ref,
      return_run_details: true,
      inputs: {
        job_id: job.id,
        run_mode: normaliseRunMode(job.runMode),
        api_base: 'https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/integrations',
      },
    }),
  });

  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const rawMessage = typeof data.message === 'string' ? data.message : `GitHub dispatch failed with HTTP ${response.status}`;
    const message = rawMessage === 'Bad credentials'
      ? 'GitHub rejected NW_GITHUB_ACTIONS_TOKEN. Replace the Supabase Edge Function secret with a valid fine-grained GitHub token for ShawnDaPrawn/NavigateWealth with Actions: Read and write.'
      : rawMessage;
    return {
      automationHost: 'manual',
      actionsDispatchError: message.slice(0, 500),
      message: `Portal job queued, but GitHub Actions did not start: ${message}`.slice(0, 500),
    };
  }

  return {
    automationHost: 'github_actions',
    workerId: 'github-actions',
    actionsRunId: typeof data.workflow_run_id === 'number' ? data.workflow_run_id : undefined,
    actionsRunUrl: typeof data.html_url === 'string'
      ? data.html_url
      : `https://github.com/${repo}/actions/workflows/${workflowId}`,
    actionsDispatchError: undefined,
    message: 'Portal job queued. GitHub Actions is starting the Playwright worker.',
  };
}

function normaliseFlowSteps(value: unknown): PortalFlowStep[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).map((step, index) => {
    const entry = step as Record<string, unknown>;
    const action = ['goto', 'click', 'fill', 'wait_for_selector', 'wait_for_url', 'press'].includes(String(entry.action))
      ? entry.action as PortalFlowStep['action']
      : 'wait_for_selector';
    return {
      id: String(entry.id || `step-${index + 1}`).slice(0, 80),
      action,
      selector: typeof entry.selector === 'string' ? entry.selector.slice(0, 500) : undefined,
      url: typeof entry.url === 'string' ? entry.url.slice(0, 1000) : undefined,
      value: typeof entry.value === 'string' ? entry.value.slice(0, 500) : undefined,
      key: typeof entry.key === 'string' ? entry.key.slice(0, 80) : undefined,
      timeoutMs: typeof entry.timeoutMs === 'number' ? Math.max(1000, Math.min(entry.timeoutMs, 120000)) : undefined,
      description: typeof entry.description === 'string' ? entry.description.slice(0, 300) : undefined,
      optional: entry.optional === true,
    };
  });
}

function normaliseStringList(value: unknown, fallback: string[] = [], limit = 20): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, limit);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, limit);
  }
  return fallback;
}

function normaliseBrainConfig(value: unknown, fallback?: PortalSearchBrainConfig): PortalSearchBrainConfig {
  const entry = (value || {}) as Record<string, unknown>;
  const maxDecisionsPerItem = Number(entry.maxDecisionsPerItem ?? fallback?.maxDecisionsPerItem ?? 2);
  return {
    enabled: typeof entry.enabled === 'boolean' ? entry.enabled : fallback?.enabled ?? false,
    goal: typeof entry.goal === 'string'
      ? entry.goal.trim().slice(0, 500)
      : fallback?.goal,
    maxDecisionsPerItem: Number.isFinite(maxDecisionsPerItem)
      ? Math.max(1, Math.min(maxDecisionsPerItem, 5))
      : 2,
    rememberSelectors: typeof entry.rememberSelectors === 'boolean'
      ? entry.rememberSelectors
      : fallback?.rememberSelectors ?? true,
  };
}

function defaultPortalBrainGoal(providerName: string) {
  return `Use the main provider search journey to find an exact policy-number match for ${providerName}, and stop instead of guessing if confidence is low.`;
}

function emptyPortalBrainMemory(providerId: string, categoryId: string): PortalBrainMemory {
  return {
    providerId,
    categoryId,
    updatedAt: new Date().toISOString(),
    searchInputHints: [],
    searchResultHints: [],
    stats: {
      brainCalls: 0,
      successfulDecisions: 0,
      searchInputSuccesses: 0,
      searchResultSuccesses: 0,
    },
  };
}

function portalBrainMemoryKey(providerId: string, categoryId: string) {
  return `portal-brain-memory:${providerId}:${categoryId}`;
}

async function loadPortalBrainMemory(providerId: string, categoryId: string): Promise<PortalBrainMemory> {
  const stored = (await kv.get(portalBrainMemoryKey(providerId, categoryId))) as PortalBrainMemory | null;
  if (!stored) return emptyPortalBrainMemory(providerId, categoryId);
  return {
    ...emptyPortalBrainMemory(providerId, categoryId),
    ...stored,
    providerId,
    categoryId,
    searchInputHints: Array.isArray(stored.searchInputHints) ? stored.searchInputHints : [],
    searchResultHints: Array.isArray(stored.searchResultHints) ? stored.searchResultHints : [],
    stats: {
      ...emptyPortalBrainMemory(providerId, categoryId).stats,
      ...(stored.stats || {}),
    },
  };
}

async function savePortalBrainMemory(memory: PortalBrainMemory) {
  await kv.set(portalBrainMemoryKey(memory.providerId, memory.categoryId), {
    ...memory,
    updatedAt: new Date().toISOString(),
  });
}

function summarisePortalBrainMemory(
  memory: PortalBrainMemory,
  options: { available: boolean; configured: boolean; model?: string },
): PortalBrainMemorySummary {
  return {
    providerId: memory.providerId,
    categoryId: memory.categoryId,
    available: options.available,
    configured: options.configured,
    model: options.model,
    updatedAt: memory.updatedAt,
    searchInputHints: memory.searchInputHints.length,
    searchResultHints: memory.searchResultHints.length,
    successfulDecisions: memory.stats.successfulDecisions,
    brainCalls: memory.stats.brainCalls,
    lastSearchInputSelector: memory.searchInputHints[0]?.selector,
    lastResultSelector: memory.searchResultHints[0]?.selector,
  };
}

function rememberPortalBrainHint(
  list: PortalBrainMemoryEntry[],
  entry: { selector: string; label?: string; notes?: string; source?: PortalBrainMemoryEntry['source'] },
): PortalBrainMemoryEntry[] {
  const selector = String(entry.selector || '').trim().slice(0, 500);
  if (!selector) return list;
  const now = new Date().toISOString();
  const existingIndex = list.findIndex((item) => item.selector === selector);
  const nextEntry: PortalBrainMemoryEntry = existingIndex >= 0
    ? {
        ...list[existingIndex],
        label: entry.label ? String(entry.label).slice(0, 160) : list[existingIndex].label,
        notes: entry.notes ? String(entry.notes).slice(0, 300) : list[existingIndex].notes,
        successCount: (list[existingIndex].successCount || 0) + 1,
        lastUsedAt: now,
        source: entry.source || list[existingIndex].source || 'brain',
      }
    : {
        selector,
        label: entry.label ? String(entry.label).slice(0, 160) : undefined,
        notes: entry.notes ? String(entry.notes).slice(0, 300) : undefined,
        successCount: 1,
        lastUsedAt: now,
        source: entry.source || 'brain',
      };

  const withoutExisting = existingIndex >= 0 ? list.filter((_, index) => index !== existingIndex) : list.slice();
  return [nextEntry, ...withoutExisting]
    .sort((a, b) => (b.successCount - a.successCount) || (new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime()))
    .slice(0, 12);
}

function getPortalBrainConfig() {
  const apiKey = String(
    Deno.env.get('NW_GOOGLE_AI_API_KEY')
    || Deno.env.get('GEMINI_API_KEY')
    || Deno.env.get('GOOGLE_API_KEY')
    || '',
  ).trim();
  const model = String(Deno.env.get('NW_PORTAL_BRAIN_MODEL') || 'gemini-2.5-flash').trim();
  const apiBase = String(Deno.env.get('NW_PORTAL_BRAIN_API_BASE') || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
  const enabled = String(Deno.env.get('NW_PORTAL_BRAIN_ENABLED') || '1').trim() !== '0';
  return {
    enabled,
    available: enabled && !!apiKey,
    apiKey,
    model,
    apiBase,
  };
}

function redactBrainText(value: string, preserve: string[] = []): string {
  let text = String(value || '');
  const placeholders = new Map<string, string>();
  preserve.filter(Boolean).forEach((item, index) => {
    const token = `__NW_PRESERVE_${index}__`;
    placeholders.set(token, item);
    text = text.split(item).join(token);
  });

  text = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[REDACTED_NUMBER]')
    .replace(/\bR\s?\d[\d\s,]*(?:\.\d{2})?\b/gi, '[REDACTED_AMOUNT]')
    .replace(/\b\d{6,16}\b/g, '[REDACTED_ID]');

  for (const [token, original] of placeholders.entries()) {
    text = text.split(token).join(original);
  }
  return text;
}

function sanitiseBrainSnapshot(value: unknown, preserve: string[] = []): unknown {
  if (typeof value === 'string') return redactBrainText(value, preserve);
  if (Array.isArray(value)) return value.map((item) => sanitiseBrainSnapshot(item, preserve));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sanitiseBrainSnapshot(item, preserve),
      ]),
    );
  }
  return value;
}

function extractFirstJsonObject(value: string): string {
  const text = String(value || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('The brain response did not contain a JSON object.');
  }
  return text.slice(firstBrace, lastBrace + 1);
}

async function callPortalBrainModel(options: {
  prompt: string;
  model: string;
  apiBase: string;
  apiKey: string;
}): Promise<{ text: string }> {
  const response = await fetch(`${options.apiBase}/models/${encodeURIComponent(options.model)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': options.apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: options.prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 0.1,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            action: { type: 'STRING', enum: ['use_candidate', 'stop_uncertain'] },
            candidateId: { type: 'STRING' },
            confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
            reason: { type: 'STRING' },
          },
          required: ['action', 'candidateId', 'confidence', 'reason'],
        },
      },
    }),
  });

  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof data.error === 'object' && data.error && 'message' in data.error
      ? String((data.error as { message?: string }).message || 'Portal brain request failed')
      : `Portal brain request failed with HTTP ${response.status}`);
  }

  const candidates = Array.isArray(data.candidates) ? data.candidates as Array<Record<string, unknown>> : [];
  const text = candidates
    .flatMap((candidate) => {
      const content = candidate.content as { parts?: Array<{ text?: string }> } | undefined;
      return Array.isArray(content?.parts) ? content.parts : [];
    })
    .map((part) => String(part.text || ''))
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('The brain response did not contain usable text.');
  }

  return { text };
}

function parsePortalBrainDecision(text: string): Record<string, unknown> {
  try {
    return JSON.parse(extractFirstJsonObject(text)) as Record<string, unknown>;
  } catch {
    return {
      action: 'stop_uncertain',
      candidateId: null,
      confidence: 'low',
      reason: `Brain returned non-JSON output: ${String(text || '').trim().slice(0, 180) || 'empty response'}`,
    };
  }
}

function buildPortalBrainPrompt(options: {
  providerName: string;
  goal: string;
  stage: 'search_input' | 'search_result';
  policyNumber: string;
  instructions?: string;
  labels?: string[];
  memory: PortalBrainMemory;
  snapshot: Record<string, unknown>;
}) {
  const rememberedInputs = options.memory.searchInputHints.slice(0, 5).map((hint) => ({
    selector: hint.selector,
    label: hint.label,
    successCount: hint.successCount,
  }));
  const rememberedResults = options.memory.searchResultHints.slice(0, 5).map((hint) => ({
    selector: hint.selector,
    label: hint.label,
    successCount: hint.successCount,
  }));

  return [
    'You are a cautious browser-assistance model for a financial policy administration system.',
    `Provider: ${options.providerName}`,
    `Stage: ${options.stage}`,
    `Goal: ${options.goal}`,
    `Target policy number: ${options.policyNumber}`,
    options.instructions ? `Provider instructions: ${options.instructions}` : '',
    Array.isArray(options.labels) && options.labels.length > 0 ? `Preferred search labels: ${options.labels.join(', ')}` : '',
    'Rules:',
    '- Never invent a candidate id.',
    '- Only choose a candidate when it is the best available option for finding or opening the exact policy number.',
    '- Prefer remembered selectors when they still fit the current page.',
    '- For search_input, candidates may be direct fields, safe search triggers, or navigation items that reveal a policy/client search area.',
    '- If the landing page only shows navigation like Clients, Investors, Funds, or Practice, choose the safest item that is most likely to lead to policy search.',
    '- Do not choose Home or generic legal/help/footer links.',
    '- Avoid OTP, password, username, and unrelated filter fields.',
    '- If confidence is low, return stop_uncertain.',
    'Return JSON only, with this exact shape:',
    '{"action":"use_candidate|stop_uncertain","candidateId":"candidate-id-or-null","confidence":"high|medium|low","reason":"short reason"}',
    `Remembered input hints: ${JSON.stringify(rememberedInputs)}`,
    `Remembered result hints: ${JSON.stringify(rememberedResults)}`,
    `Page snapshot: ${JSON.stringify(options.snapshot)}`,
  ].filter(Boolean).join('\n');
}

function normaliseSearchConfig(value: unknown, fallback?: PortalProviderFlow['search']): PortalProviderFlow['search'] {
  const entry = (value || {}) as Record<string, unknown>;
  return {
    mode: 'policy_number',
    searchPageUrl: typeof entry.searchPageUrl === 'string' ? entry.searchPageUrl.trim().slice(0, 1000) : fallback?.searchPageUrl,
    searchInputSelector: typeof entry.searchInputSelector === 'string' ? entry.searchInputSelector.trim().slice(0, 500) : fallback?.searchInputSelector,
    searchInputLabels: normaliseStringList(entry.searchInputLabels, fallback?.searchInputLabels || ['Policy number', 'Search']),
    submitSelector: typeof entry.submitSelector === 'string' ? entry.submitSelector.trim().slice(0, 500) : fallback?.submitSelector,
    resultContainerSelector: typeof entry.resultContainerSelector === 'string' ? entry.resultContainerSelector.trim().slice(0, 500) : fallback?.resultContainerSelector,
    resultLinkSelector: typeof entry.resultLinkSelector === 'string' ? entry.resultLinkSelector.trim().slice(0, 500) : fallback?.resultLinkSelector,
    resultPolicyNumberSelector: typeof entry.resultPolicyNumberSelector === 'string' ? entry.resultPolicyNumberSelector.trim().slice(0, 500) : fallback?.resultPolicyNumberSelector,
    noResultsText: normaliseStringList(entry.noResultsText, fallback?.noResultsText || ['No results']),
    instructions: typeof entry.instructions === 'string' ? entry.instructions.trim().slice(0, 500) : fallback?.instructions,
    brain: normaliseBrainConfig(entry.brain, fallback?.brain),
  };
}

function normaliseExtractionFields(value: unknown, fallback: PortalFlowField[] = []): PortalFlowField[] {
  if (!Array.isArray(value)) return fallback;
  return value.slice(0, 80).map((field, index) => {
    const entry = field as Record<string, unknown>;
    const columnName = normaliseColumnName(entry.columnName || entry.sourceHeader || `Field ${index + 1}`);
    const targetFieldId = String(entry.targetFieldId || '').trim();
    const targetFieldName = String(entry.targetFieldName || '').trim();
    return {
      sourceHeader: columnName,
      columnName,
      targetFieldId: targetFieldId || undefined,
      targetFieldName: targetFieldName || undefined,
      selector: typeof entry.selector === 'string' ? entry.selector.trim().slice(0, 500) : '',
      labels: normaliseStringList(entry.labels, [], 12),
      attribute: typeof entry.attribute === 'string' ? entry.attribute.slice(0, 40) : 'text',
      required: entry.required === true,
      transform: typeof entry.transform === 'string' ? entry.transform.slice(0, 40) : 'trim',
    };
  });
}

function normalisePolicyScheduleConfig(value: unknown, fallback?: PortalPolicyScheduleConfig): PortalPolicyScheduleConfig {
  const entry = (value || {}) as Record<string, unknown>;
  const documentType = ['policy_schedule', 'amendment', 'statement', 'benefit_summary', 'other'].includes(String(entry.documentType))
    ? entry.documentType as PortalPolicyScheduleConfig['documentType']
    : fallback?.documentType || 'policy_schedule';
  const waitForDownloadMs = Number(entry.waitForDownloadMs || fallback?.waitForDownloadMs || 30000);

  return {
    enabled: entry.enabled === true || fallback?.enabled === true,
    downloadSelector: typeof entry.downloadSelector === 'string' ? entry.downloadSelector.trim().slice(0, 500) : fallback?.downloadSelector,
    downloadLabels: normaliseStringList(entry.downloadLabels, fallback?.downloadLabels || ['Policy schedule', 'Download', 'PDF', 'Statement'], 20),
    documentType,
    required: typeof entry.required === 'boolean' ? entry.required : fallback?.required ?? true,
    waitForDownloadMs: Number.isFinite(waitForDownloadMs) ? Math.min(Math.max(waitForDownloadMs, 5000), 120000) : 30000,
  };
}

function getDefaultPortalFlow(provider: KvProvider, providerId: string): PortalProviderFlow {
  const providerName = String(provider.name || providerId);
  const providerKey = providerName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const isAllanGray = providerName.toLowerCase().includes('allan gray') || providerId.toLowerCase().includes('allan');
  const now = new Date().toISOString();

  if (isAllanGray) {
    return {
      id: `${providerId}:default`,
      providerId,
      name: 'Allan Gray portal policy extraction',
      loginUrl: 'https://login.secure.allangray.co.za/?audience=New%20clients',
      credentialProfiles: [
        {
          id: 'allan-gray-env',
          label: 'Allan Gray Supabase credentials',
          source: 'supabase_kv',
          usernameEnvVar: 'NW_PROVIDER_ALLAN_GRAY_USERNAME',
          passwordEnvVar: 'NW_PROVIDER_ALLAN_GRAY_PASSWORD',
        },
      ],
      login: {
        usernameSelector: 'input[name="username"], input[type="email"], input[autocomplete="username"], input[id*="user" i]',
        passwordSelector: 'input[name="password"], input[type="password"], input[autocomplete="current-password"]',
        submitSelector: 'button[type="submit"], button:has-text("Log in"), button:has-text("Login"), input[type="submit"]',
      },
      otp: {
        mode: 'manual_sms',
        detectionSelectors: [
          'input[name*="otp" i]',
          'input[name*="code" i]',
          'input[autocomplete="one-time-code"]',
          'text=/verification code/i',
          'text=/one-time password/i',
        ],
        inputSelector: 'input[name*="otp" i], input[name*="code" i], input[autocomplete="one-time-code"]',
        submitSelector: 'button[type="submit"], button:has-text("Verify"), button:has-text("Continue")',
        timeoutMs: 600000,
        instructions: 'The Allan Gray SMS OTP must be entered by an admin in Navigate Wealth. The worker will pause and poll for it; never store the OTP in a spreadsheet or flow config.',
      },
      navigation: {
        policyListSteps: [
          {
            id: 'click-clients-link',
            action: 'click',
            selector: 'a:has-text("Clients"), button:has-text("Clients"), [role="link"]:has-text("Clients"), [role="button"]:has-text("Clients"), [role="menuitem"]:has-text("Clients")',
            timeoutMs: 45000,
            optional: true,
            description: 'Click the main Clients navigation item after login to reach the Allan Gray client search area.',
          },
        ],
        clientListSelector: '[data-testid*="client" i], a:has-text("Clients"), a:has-text("Investors")',
        clientRowSelector: '[data-testid*="client-row" i], table tbody tr',
        nextPageSelector: 'a[rel="next"], button:has-text("Next")',
      },
      search: {
        mode: 'policy_number',
        searchInputLabels: ['Policy number', 'Account number', 'Search', 'Client search', 'Investor search'],
        searchInputSelector: 'input[type="search"], input[placeholder*="Search" i], input[name*="search" i], input[id*="search" i]',
        submitSelector: 'button:has-text("Search"), button[type="submit"], input[type="submit"]',
        resultContainerSelector: 'table tbody tr, [data-testid*="result" i], [data-testid*="policy" i], a',
        resultLinkSelector: 'a, button, [role="link"], [role="button"]',
        noResultsText: ['No results', 'No clients found', 'No investments found', 'No policies found'],
        instructions: 'Search Allan Gray by the Navigate Wealth policy number. The worker only opens a result when the policy number is found on the page.',
        brain: {
          enabled: true,
          goal: defaultPortalBrainGoal(providerName),
          maxDecisionsPerItem: 2,
          rememberSelectors: true,
        },
      },
      extraction: {
        policyRowSelector: '[data-testid*="policy" i], table tbody tr',
        fields: [
          { sourceHeader: 'Policy Number', columnName: 'Policy Number', targetFieldName: 'Policy Number', selector: '[data-field="policyNumber"], [data-testid*="policy-number" i], [data-testid*="account-number" i], [data-testid*="investment-number" i]', labels: ['Policy number', 'Account number', 'Investment number'], attribute: 'text', required: true, transform: 'trim' },
          { sourceHeader: 'Product Type', columnName: 'Product Type', targetFieldName: 'Product Type', selector: '[data-field="productType"], [data-testid*="retirement-annuity" i], [data-testid*="product-type" i]', labels: ['Retirement annuity fund'], attribute: 'text', transform: 'trim' },
          { sourceHeader: 'Date of Inception', columnName: 'Date of Inception', targetFieldName: 'Date of Inception', selector: '[data-field="inceptionDate"], [data-testid*="inception" i], [data-testid*="start-date" i]', labels: ['Inception date', 'Date of inception'], attribute: 'text', transform: 'trim' },
          { sourceHeader: 'Current Value', columnName: 'Current Value', targetFieldName: 'Current Value', selector: '[data-field="fundValue"], [data-testid*="closing-balance" i], [data-testid*="fund-value" i], [data-testid*="market-value" i], [data-testid*="current-value" i]', labels: ['Closing balance'], attribute: 'text', transform: 'trim' },
        ],
      },
      policySchedule: {
        enabled: false,
        downloadLabels: ['Policy schedule', 'Download policy schedule', 'Download PDF', 'Statement'],
        documentType: 'policy_schedule',
        required: true,
        waitForDownloadMs: 45000,
      },
      notes: [
        'The worker starts from Navigate Wealth policy numbers and searches Allan Gray one policy at a time.',
        'Credentials are stored server-side in Supabase and are never returned to the browser.',
        'Use label phrases first. Advanced selectors are only needed when the provider page is ambiguous.',
        'SMS OTP is a manual pause-and-resume checkpoint and is cleared after the worker consumes it.',
      ],
      needsDiscovery: true,
      updatedAt: now,
    };
  }

  return {
    id: `${providerId}:default`,
    providerId,
    name: `${providerName} portal policy extraction`,
    loginUrl: '',
    credentialProfiles: [
      {
        id: `${providerKey}-env`,
        label: `${providerName} Supabase credentials`,
        source: 'supabase_kv',
        usernameEnvVar: `NW_PROVIDER_${providerKey.toUpperCase()}_USERNAME`,
        passwordEnvVar: `NW_PROVIDER_${providerKey.toUpperCase()}_PASSWORD`,
      },
    ],
    login: {
      usernameSelector: 'input[autocomplete="username"], input[name*="user" i], input[type="email"]',
      passwordSelector: 'input[type="password"], input[autocomplete="current-password"]',
      submitSelector: 'button[type="submit"], input[type="submit"]',
    },
    otp: {
      mode: 'manual_sms',
      detectionSelectors: ['input[autocomplete="one-time-code"]', 'input[name*="otp" i]', 'input[name*="code" i]'],
      inputSelector: 'input[autocomplete="one-time-code"], input[name*="otp" i], input[name*="code" i]',
      submitSelector: 'button[type="submit"], button:has-text("Verify"), button:has-text("Continue")',
      timeoutMs: 600000,
      instructions: 'Enter the SMS OTP in Navigate Wealth when the worker pauses.',
    },
    navigation: { policyListSteps: [] },
    search: {
      mode: 'policy_number',
      searchInputLabels: ['Policy number', 'Account number', 'Search'],
      searchInputSelector: 'input[type="search"], input[placeholder*="Search" i], input[name*="search" i], input[id*="search" i]',
      submitSelector: 'button:has-text("Search"), button[type="submit"], input[type="submit"]',
      resultContainerSelector: 'table tbody tr, [data-testid*="result" i], a',
      resultLinkSelector: 'a, button, [role="link"], [role="button"]',
      noResultsText: ['No results', 'No policies found'],
      instructions: 'Search by policy number and only open results that contain the exact policy number.',
      brain: {
        enabled: false,
        goal: defaultPortalBrainGoal(providerName),
        maxDecisionsPerItem: 2,
        rememberSelectors: true,
      },
    },
    extraction: { fields: [] },
    policySchedule: {
      enabled: false,
      downloadLabels: ['Policy schedule', 'Download', 'PDF', 'Statement'],
      documentType: 'policy_schedule',
      required: true,
      waitForDownloadMs: 30000,
    },
    notes: ['Configure login, policy search, and field labels before running this provider in production.'],
    needsDiscovery: true,
    updatedAt: now,
  };
}

async function getPortalFlow(provider: KvProvider, providerId: string): Promise<PortalProviderFlow> {
  const configured = (await kv.get(`portal-flow:${providerId}`)) as PortalProviderFlow | null;
  const defaultFlow = getDefaultPortalFlow(provider, providerId);
  if (!configured) return defaultFlow;

  const defaultExtractionFields = normaliseExtractionFields(defaultFlow.extraction?.fields, []);
  const configuredExtractionFields = normaliseExtractionFields(configured.extraction?.fields, []);

  return {
    ...defaultFlow,
    ...configured,
    navigation: {
      ...(defaultFlow.navigation || {}),
      ...(configured.navigation || {}),
      policyListSteps: Array.isArray(configured.navigation?.policyListSteps) && configured.navigation.policyListSteps.length > 0
        ? configured.navigation.policyListSteps
        : defaultFlow.navigation?.policyListSteps || [],
    },
    search: normaliseSearchConfig(configured.search, defaultFlow.search),
    extraction: {
      ...(defaultFlow.extraction || {}),
      ...(configured.extraction || {}),
      fields: normaliseExtractionFields(
        buildPortalFieldsFromBindings(configuredExtractionFields, defaultExtractionFields),
        defaultExtractionFields,
      ),
    },
    policySchedule: normalisePolicyScheduleConfig(configured.policySchedule, defaultFlow.policySchedule),
  };
}

function sanitisePortalFlow(flow: PortalProviderFlow): PortalProviderFlow {
  return {
    ...flow,
    credentialProfiles: flow.credentialProfiles.map((profile) => ({
      ...profile,
      usernameSecretName: profile.usernameSecretName,
      passwordSecretName: profile.passwordSecretName,
      usernameEnvVar: profile.usernameEnvVar,
      passwordEnvVar: profile.passwordEnvVar,
    })),
  };
}

function findPolicyNumberField(fields: SchemaField[]): SchemaField | undefined {
  return fields.find((field) => {
    const name = (field.name || '').toLowerCase();
    return name.includes('policy number') || name.includes('policy no') || name.includes('reference');
  });
}

async function getSchemaForCategory(categoryId: string): Promise<KvSchema> {
  const configured = (await kv.get(`config:schema:${categoryId}`)) as KvSchema | null;
  const fallback = DEFAULT_SCHEMAS[categoryId] as KvSchema | undefined;
  return configured || fallback || { categoryId, fields: [] };
}

async function getPolicyNumberForPolicy(
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

  ['policyNumber', 'policy_number', 'policyNo', 'policy_no', 'reference'].forEach((fieldId) => candidateFieldIds.add(fieldId));

  for (const fieldId of candidateFieldIds) {
    const value = String(policy.data?.[fieldId] ?? '').trim();
    if (value) return value;
  }

  return '';
}

function coerceFieldValue(field: SchemaField, value: unknown): { value: unknown; error?: string } {
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
        return { value: `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}` };
      }
    }
    const dateText = String(raw);
    if (!isValidDate(dateText)) {
      return { value, error: `${field.name} must be a valid date` };
    }
    return { value: dateText };
  }

  if (fieldType === 'dropdown' && Array.isArray(field.options) && field.options.length > 0) {
    const option = field.options.find((candidate) => String(candidate).toLowerCase() === String(raw).toLowerCase());
    if (!option) {
      return { value, error: `${field.name} must be one of: ${field.options.join(', ')}` };
    }
    return { value: option };
  }

  return { value: raw };
}

async function listPoliciesForProviderCategory(providerId: string, categoryId: string): Promise<KvPolicy[]> {
  const allClientPolicies = await kv.getByPrefix('policies:client:');
  const policies: KvPolicy[] = [];

  for (const clientPolicies of allClientPolicies || []) {
    if (!Array.isArray(clientPolicies)) continue;

    for (const policy of clientPolicies as KvPolicy[]) {
      if (policy.archived || policy.providerId !== providerId || !categoryMatches(categoryId, policy.categoryId)) continue;
      policies.push(policy);
    }
  }

  return policies;
}

async function buildPolicyIndexes(
  providerId: string,
  categoryId: string,
  fields: SchemaField[],
): Promise<{ policyNumberIndex: Map<string, KvPolicy[]>; policyIdIndex: Map<string, KvPolicy> }> {
  const policyNumberField = findPolicyNumberField(fields);
  const policyNumberIndex = new Map<string, KvPolicy[]>();
  const policyIdIndex = new Map<string, KvPolicy>();
  const schemaCache = new Map<string, KvSchema>();
  const policies = await listPoliciesForProviderCategory(providerId, categoryId);

  for (const policy of policies) {
    policyIdIndex.set(policy.id, policy);
    if (!policyNumberField) continue;

    const normalised = normalisePolicyNumber(await getPolicyNumberForPolicy(policy, fields, schemaCache));
    if (!normalised) continue;

    const current = policyNumberIndex.get(normalised) || [];
    current.push(policy);
    policyNumberIndex.set(normalised, current);
  }

  return { policyNumberIndex, policyIdIndex };
}

function summariseSyncRows(rows: IntegrationSyncRow[]): IntegrationSyncRun['summary'] {
  return {
    totalRows: rows.length,
    matchedRows: rows.filter((row) => row.matchStatus === 'matched').length,
    unmatchedRows: rows.filter((row) => row.matchStatus === 'unmatched').length,
    duplicateRows: rows.filter((row) => row.matchStatus === 'duplicate').length,
    invalidRows: rows.filter((row) => row.matchStatus === 'invalid').length,
    changedRows: rows.filter((row) => row.diffs.length > 0).length,
    noChangeRows: rows.filter((row) => row.diffs.length === 0 && row.matchStatus === 'matched').length,
    autoEligibleRows: rows.filter((row) => row.autoPublishEligible).length,
    publishedRows: rows.filter((row) => row.publishStatus === 'published').length,
    heldRows: rows.filter((row) => ['pending', 'held', 'auto_eligible'].includes(row.publishStatus)).length,
  };
}

async function buildSyncRun(params: {
  provider: KvProvider;
  providerId: string;
  categoryId: string;
  fileName: string;
  source?: 'spreadsheet' | 'portal';
  rawRows: Record<string, unknown>[];
  fieldMapping: Record<string, string>;
  fieldBindings?: IntegrationFieldBinding[];
  settings: IntegrationConfig['settings'];
  ignoreBlankValues?: boolean;
}): Promise<IntegrationSyncRun> {
  const schema = await getSchemaForCategory(params.categoryId);
  const fields = schema.fields || [];
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const bindingByColumnName = new Map(
    (params.fieldBindings || [])
      .map((binding) => [normaliseColumnName(binding.columnName), binding] as const)
      .filter(([columnName]) => columnName),
  );
  const policyNumberField = findPolicyNumberField(fields);
  const { policyNumberIndex, policyIdIndex } = await buildPolicyIndexes(params.providerId, params.categoryId, fields);
  const schemaCache = new Map<string, KvSchema>();
  const rows: IntegrationSyncRow[] = [];

  for (const [index, rawData] of params.rawRows.entries()) {
    const mappedData: Record<string, unknown> = {};
    const validationErrors: string[] = [];
    const warnings: string[] = [];
    const rowMetadata = getTemplateRowMetadata(rawData);
    const hasStableMetadata = Boolean(
      rowMetadata.policyId ||
      rowMetadata.clientId ||
      rowMetadata.providerId ||
      rowMetadata.categoryId,
    );

    if (rowMetadata.providerId && rowMetadata.providerId !== params.providerId) {
      validationErrors.push('This row belongs to a different provider template');
    }
    if (rowMetadata.categoryId && !categoryMatches(params.categoryId, rowMetadata.categoryId)) {
      validationErrors.push('This row belongs to a different product template');
    }

    let matchedPolicy: KvPolicy | undefined;
    if (validationErrors.length === 0 && hasStableMetadata) {
      if (!rowMetadata.policyId || !rowMetadata.clientId) {
        validationErrors.push('Template row metadata is incomplete');
      } else {
        const metadataPolicy = policyIdIndex.get(rowMetadata.policyId);
        if (!metadataPolicy) {
          validationErrors.push('Template row no longer matches an existing policy');
        } else if (metadataPolicy.clientId !== rowMetadata.clientId) {
          validationErrors.push('Template row metadata does not match the current policy owner');
        } else {
          matchedPolicy = metadataPolicy;
        }
      }
    }

    for (const [sourceHeader, targetFieldId] of Object.entries(params.fieldMapping)) {
      const field = fieldById.get(targetFieldId);
      if (!field) {
        warnings.push(`Mapping target ${targetFieldId} is no longer in the product structure`);
        continue;
      }

      const rawValue = rawData[sourceHeader];
      const binding = bindingByColumnName.get(normaliseColumnName(sourceHeader));
      const blankBehavior = normaliseIntegrationBlankBehavior(binding?.blankBehavior);
      if (isBlank(rawValue) && blankBehavior === 'error') {
        validationErrors.push(`${field.name} cannot be blank for this integration`);
        continue;
      }
      if (params.ignoreBlankValues && isBlank(rawValue) && blankBehavior !== 'clear') {
        continue;
      }

      const { value, error } = coerceFieldValue(field, rawValue);
      mappedData[targetFieldId] = value;
      if (error) validationErrors.push(error);
    }

    let policyNumber = policyNumberField ? String(mappedData[policyNumberField.id] ?? '').trim() : '';
    let normalisedPolicyNumber = rowMetadata.normalizedPolicyNumber || normalisePolicyNumber(policyNumber);

    if (!matchedPolicy && validationErrors.length === 0) {
      if (!policyNumberField) {
        validationErrors.push('No policy number field exists in this product structure');
      } else if (!normalisedPolicyNumber) {
        validationErrors.push('Policy number is required for matching');
      }
    }

    const candidateMatches = !matchedPolicy && validationErrors.length === 0 && normalisedPolicyNumber
      ? (policyNumberIndex.get(normalisedPolicyNumber) || [])
      : [];

    if (!matchedPolicy && candidateMatches.length === 1 && validationErrors.length === 0) {
      matchedPolicy = candidateMatches[0];
    }

    if (matchedPolicy && !policyNumber) {
      policyNumber = await getPolicyNumberForPolicy(matchedPolicy, fields, schemaCache);
      normalisedPolicyNumber = normalisePolicyNumber(policyNumber) || normalisedPolicyNumber;
    }

    const matchMethod: IntegrationSyncRow['matchMethod'] = hasStableMetadata
      ? 'template_metadata'
      : normalisedPolicyNumber
        ? 'policy_number'
        : 'none';

    let matchStatus: SyncMatchStatus = 'unmatched';
    if (validationErrors.length > 0) matchStatus = 'invalid';
    else if (matchedPolicy) matchStatus = 'matched';
    else if (candidateMatches.length > 1) matchStatus = 'duplicate';

    const diffs: SyncDiff[] = [];
    const lockedFields = new Set(matchedPolicy?.lockedFields || []);

    if (matchedPolicy) {
      for (const [fieldId, newValue] of Object.entries(mappedData)) {
        if (lockedFields.has(fieldId) && valuesDiffer(matchedPolicy.data?.[fieldId], newValue)) {
          warnings.push(`${fieldById.get(fieldId)?.name || fieldId} is locked and will not be overwritten`);
          continue;
        }
        if (valuesDiffer(matchedPolicy.data?.[fieldId], newValue)) {
          diffs.push({
            fieldId,
            fieldName: fieldById.get(fieldId)?.name || fieldId,
            oldValue: matchedPolicy.data?.[fieldId],
            newValue,
          });
        }
      }
    }

    let publishStatus: SyncPublishStatus = 'held';
    if (matchStatus === 'matched' && diffs.length === 0) publishStatus = 'skipped';
    else if (matchStatus === 'matched' && validationErrors.length === 0 && warnings.length === 0 && params.settings.autoPublish) publishStatus = 'auto_eligible';
    else if (matchStatus === 'matched' && validationErrors.length === 0) publishStatus = 'pending';

    rows.push({
      id: crypto.randomUUID(),
      rowNumber: index + 2,
      rawData,
      mappedData,
      policyNumber,
      normalizedPolicyNumber: normalisedPolicyNumber,
      matchMethod,
      matchStatus,
      publishStatus,
      autoPublishEligible: publishStatus === 'auto_eligible',
      validationErrors,
      warnings,
      diffs,
      clientId: matchedPolicy?.clientId,
      policyId: matchedPolicy?.id,
      providerName: matchedPolicy?.providerName,
    });
  }

  const now = new Date().toISOString();
  const run: IntegrationSyncRun = {
    id: crypto.randomUUID(),
    providerId: params.providerId,
    providerName: params.provider.name || 'Unknown Provider',
    categoryId: params.categoryId,
    fileName: params.fileName,
    source: params.source || 'spreadsheet',
    status: 'staged',
    createdAt: now,
    updatedAt: now,
    mappingVersion: `${params.providerId}:${params.categoryId}:${now}`,
    autoPublish: !!params.settings.autoPublish,
    summary: summariseSyncRows(rows),
    rows,
  };

  return run;
}

async function publishSyncRun(run: IntegrationSyncRun, options?: { autoOnly?: boolean; rowIds?: string[] }) {
  const rowIds = options?.rowIds ? new Set(options.rowIds) : null;
  const rowsToPublish = run.rows.filter((row) => {
    if (rowIds && !rowIds.has(row.id)) return false;
    if (options?.autoOnly && !row.autoPublishEligible) return false;
    return row.matchStatus === 'matched' && row.policyId && row.clientId && row.diffs.length > 0;
  });

  const clientIds = Array.from(new Set(rowsToPublish.map((row) => row.clientId!).filter(Boolean)));
  const policiesByClient = new Map<string, KvPolicy[]>();

  for (const clientId of clientIds) {
    policiesByClient.set(clientId, ((await kv.get(`policies:client:${clientId}`)) || []) as KvPolicy[]);
  }

  const touchedClients = new Set<string>();

  for (const row of rowsToPublish) {
    try {
      const policies = policiesByClient.get(row.clientId!);
      const policyIndex = policies?.findIndex((policy) => policy.id === row.policyId) ?? -1;
      if (!policies || policyIndex === -1) {
        row.publishStatus = 'failed';
        row.warnings = [...row.warnings, 'Matched policy could not be found at publish time'];
        continue;
      }

      const policy = policies[policyIndex];
      const lockedSet = new Set(policy.lockedFields || []);
      const updatedData = { ...policy.data };
      const appliedFields: string[] = [];

      for (const diff of row.diffs) {
        if (lockedSet.has(diff.fieldId)) continue;
        updatedData[diff.fieldId] = diff.newValue;
        appliedFields.push(diff.fieldId);
      }

      if (appliedFields.length === 0) {
        row.publishStatus = 'skipped';
        continue;
      }

      policies[policyIndex] = {
        ...policy,
        data: updatedData,
        updatedAt: new Date().toISOString(),
        integrationSyncHistory: [
          ...(policy.integrationSyncHistory || []),
          {
            runId: run.id,
            providerId: run.providerId,
            categoryId: run.categoryId,
            publishedAt: new Date().toISOString(),
            source: run.source,
            fieldsApplied: appliedFields,
          },
        ].slice(-20),
      };

      row.publishStatus = 'published';
      row.autoPublishEligible = false;
      touchedClients.add(row.clientId!);
    } catch (e) {
      row.publishStatus = 'failed';
      row.warnings = [...row.warnings, `Publish failed: ${getErrMsg(e)}`];
    }
  }

  for (const clientId of touchedClients) {
    await kv.set(`policies:client:${clientId}`, policiesByClient.get(clientId) || []);
    await recalculateClientTotals(clientId);
  }

  run.updatedAt = new Date().toISOString();
  run.summary = summariseSyncRows(run.rows);
  run.status = run.summary.publishedRows > 0 && run.summary.heldRows > 0
    ? 'partially_published'
    : run.summary.publishedRows > 0
      ? 'published'
      : 'staged';

  return run;
}

async function stagePortalRows(jobId: string, rawRows: Record<string, unknown>[]): Promise<{ job: PortalSyncJob; stagedRun: IntegrationSyncRun }> {
  const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
  if (!job) {
    throw new Error("Portal job not found");
  }
  if (rawRows.length === 0) {
    throw new Error("No extracted rows supplied");
  }

  const provider = (await kv.get(`provider:${job.providerId}`)) as KvProvider | null;
  if (!provider) {
    throw new Error("Invalid provider ID");
  }

  const storedConfig = (await kv.get(`config:mapping:${job.providerId}:${job.categoryId}`)) as IntegrationConfig | null;
  if (!storedConfig) {
    throw new Error("No mapping configuration found. Please configure mappings first.");
  }
  const schema = await getSchemaForCategory(job.categoryId);
  const config = normaliseIntegrationConfig({
    ...storedConfig,
    providerId: job.providerId,
    categoryId: job.categoryId,
  }, schema.fields || []);

  const templateBindings = getTemplateFieldBindings(config, schema.fields || []);
  const settings = normaliseSettings(config.settings);
  const syncRun = await buildSyncRun({
    provider,
    providerId: job.providerId,
    categoryId: job.categoryId,
    fileName: `${job.providerName} portal extraction ${new Date().toISOString()}`,
    source: 'portal',
    rawRows,
    fieldMapping: fieldBindingsToMapping(templateBindings, config.fieldMapping || {}),
    fieldBindings: templateBindings,
    settings,
    ignoreBlankValues: true,
  });

  const finalRun = settings.autoPublish
    ? await publishSyncRun(syncRun, { autoOnly: true })
    : syncRun;

  await kv.set(`sync-run:${finalRun.id}`, finalRun);

  const now = new Date().toISOString();
  const updatedJob: PortalSyncJob = {
    ...job,
    status: 'staged',
    updatedAt: now,
    completedAt: now,
    currentStep: 'staged_for_review',
    message: `Staged ${finalRun.summary.totalRows} portal-extracted rows for review.`,
    extractedRows: rawRows.length,
    stagedRunId: finalRun.id,
  };
  await kv.set(`portal-job:${job.id}`, updatedJob);
  await kv.set(`portal-job:latest:${job.providerId}:${job.categoryId}`, { jobId: job.id, updatedAt: now });

  const historyEntry: UploadHistory = {
    id: crypto.randomUUID(),
    providerId: job.providerId,
    categoryId: job.categoryId,
    fileName: 'Provider portal extraction',
    status: 'success',
    rowCount: finalRun.summary.totalRows,
    errorCount: finalRun.summary.invalidRows + finalRun.summary.duplicateRows + finalRun.summary.unmatchedRows,
    uploadedAt: now,
    errors: [],
    runId: finalRun.id,
    publishedRows: finalRun.summary.publishedRows,
  };
  await kv.set(`history:${job.providerId}:${job.categoryId}:${Date.now()}`, historyEntry);

  return { job: updatedJob, stagedRun: finalRun };
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
    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: "Invalid provider ID" }, 400);
    }

    const flow = await getPortalFlow(provider, providerId);
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
    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: "Invalid provider ID" }, 400);
    }

    const body = await c.req.json();
    const defaultFlow = getDefaultPortalFlow(provider, providerId);
    const flow: PortalProviderFlow = {
      ...defaultFlow,
      ...body,
      providerId,
      id: body?.id || `${providerId}:default`,
      credentialProfiles: Array.isArray(body?.credentialProfiles) ? body.credentialProfiles : defaultFlow.credentialProfiles,
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
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`portal-flow:${providerId}`, flow);
    return c.json({ success: true, flow: sanitisePortalFlow(flow) });
  } catch (e) {
    log.error("Portal flow save error:", e);
    return c.json({ error: `Failed to save portal flow: ${getErrMsg(e)}` }, 500);
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

    const flow = await getPortalFlow(provider, providerId);
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
    const profileId = c.req.param("profileId");
    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: "Invalid provider ID" }, 400);
    }

    const flow = await getPortalFlow(provider, providerId);
    if (!flow.credentialProfiles.some((profile) => profile.id === profileId)) {
      return c.json({ error: "Invalid credential profile" }, 400);
    }

    const record = (await kv.get(portalCredentialKey(providerId, profileId))) as PortalCredentialRecord | null;
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
    const profileId = c.req.param("profileId");
    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: "Invalid provider ID" }, 400);
    }

    const flow = await getPortalFlow(provider, providerId);
    if (!flow.credentialProfiles.some((profile) => profile.id === profileId)) {
      return c.json({ error: "Invalid credential profile" }, 400);
    }

    const body = await c.req.json();
    const current = (await kv.get(portalCredentialKey(providerId, profileId))) as PortalCredentialRecord | null;
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
    await kv.set(portalCredentialKey(providerId, profileId), record);

    const profile = flow.credentialProfiles.find((item) => item.id === profileId);
    if (profile && profile.source !== 'supabase_kv') {
      const updatedFlow: PortalProviderFlow = {
        ...flow,
        credentialProfiles: flow.credentialProfiles.map((item) =>
          item.id === profileId ? { ...item, source: 'supabase_kv' } : item
        ),
        updatedAt: new Date().toISOString(),
      };
      await kv.set(`portal-flow:${providerId}`, updatedFlow);
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

    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: "Invalid provider ID" }, 400);
    }

    const flow = await getPortalFlow(provider, providerId);
    const credentialProfileId = String(body?.credentialProfileId || flow.credentialProfiles[0]?.id || '');
    if (!credentialProfileId || !flow.credentialProfiles.some((profile) => profile.id === credentialProfileId)) {
      return c.json({ error: "Invalid credential profile" }, 400);
    }
    const credentialProfile = flow.credentialProfiles.find((profile) => profile.id === credentialProfileId);
    if (credentialProfile?.source === 'supabase_kv') {
      const credentialRecord = (await kv.get(portalCredentialKey(providerId, credentialProfileId))) as PortalCredentialRecord | null;
      if (!credentialRecord?.username || !credentialRecord?.password) {
        return c.json({ error: "Save the provider portal username and password before creating a portal job" }, 400);
      }
    }

    const runMode = normaliseRunMode(body?.runMode);

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

    const items = await loadPortalJobItems(jobId);
    return c.json({ success: true, items, summary: summarisePortalJobItems(items) });
  } catch (e) {
    log.error("Portal job items fetch error:", e);
    return c.json({ error: "Failed to fetch portal job policy queue" }, 500);
  }
});

// POST /portal-jobs/:jobId/items/:itemId/retry
app.post("/portal-jobs/:jobId/items/:itemId/retry", requireAuth, async (c) => {
  try {
    const jobId = c.req.param("jobId");
    const itemId = c.req.param("itemId");
    const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
    if (!job) {
      return c.json({ error: "Portal job not found" }, 404);
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
    const flow = await getPortalFlow(provider, job.providerId);
    const schema = await getSchemaForCategory(job.categoryId);
    const storedConfig = (await kv.get(`config:mapping:${job.providerId}:${job.categoryId}`)) as IntegrationConfig | null;
    const config = storedConfig
      ? normaliseIntegrationConfig({
          ...storedConfig,
          providerId: job.providerId,
          categoryId: job.categoryId,
        }, schema.fields || [])
      : null;
    const flowForJobCategory = config
      ? {
          ...flow,
          extraction: {
            ...flow.extraction,
            fields: buildPortalExtractionFieldsForBindings(
              getTemplateFieldBindings(config, schema.fields || []),
              Array.isArray(flow.extraction?.fields) ? flow.extraction.fields : [],
            ),
          },
        }
      : flow;
    const items = await loadPortalJobItems(jobId);
    const brainConfig = getPortalBrainConfig();
    const brainMemory = await loadPortalBrainMemory(job.providerId, job.categoryId);
    const credentialRecord = (await kv.get(portalCredentialKey(job.providerId, job.credentialProfileId))) as PortalCredentialRecord | null;
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

    const flow = await getPortalFlow(provider, job.providerId);
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
      .map((item) => applyTemplateRowMetadata(item.rawData as Record<string, unknown>, {
        policyId: item.policyId,
        clientId: item.clientId,
        providerId: item.providerId,
        categoryId: item.categoryId,
        normalizedPolicyNumber: item.normalizedPolicyNumber,
      }));

    if (rawRows.length === 0) {
      return c.json({ error: "No completed policy items have extracted data to stage" }, 400);
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
    const rawRows = Array.isArray(body?.rows) ? body.rows as Record<string, unknown>[] : [];
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

const POLICY_DOC_BUCKET = 'make-91ed8379-policy-documents';

// Lazy bucket initialization — called on first document request, not at module load time.
let policyDocBucketInitialized = false;

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
    const lockedSet = new Set(policy.lockedFields || []);

    for (const [fieldId, value] of Object.entries(fieldsToApply)) {
      if (lockedSet.has(fieldId)) {
        skippedLockedIds.push(fieldId);
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

// Helper function to recalculate client totals
async function recalculateClientTotals(clientId: string) {
  try {
    log.info('Recalculating client totals', { clientId });
    
    const policiesKey = `policies:client:${clientId}`; 
    const allPolicies = (await kv.get(policiesKey)) || [];
    
    log.info(`Found ${allPolicies.length} total policies for client`, { clientId });
    
    const totals: Record<string, number> = {};
    
    const totalKeyMappings: Record<string, string[]> = {
      risk_life_cover_total: ['risk_life_cover'],
      risk_severe_illness_total: ['risk_severe_illness'],
      risk_disability_total: ['risk_disability'],
      risk_temporary_icb_total: ['risk_temporary_icb'],
      risk_permanent_icb_total: ['risk_permanent_icb'],
      risk_total_premium: ['risk_monthly_premium'],
      medical_aid_total_premium: ['medical_aid_monthly_premium'],
      retirement_total_contribution: ['retirement_monthly_contribution'],
      retirement_fund_value_total: ['retirement_fund_value'],
      post_retirement_capital_total: ['post_retirement_capital_value'],
      post_retirement_income_total: ['post_retirement_drawdown_amount'],
      invest_total_contribution: ['invest_monthly_contribution'],
      eb_total_premium: ['eb_monthly_premium', 'eb_risk_monthly_premium', 'eb_retirement_contribution_employee', 'eb_retirement_contribution_employer'],
      estate_total_annual_fee: ['estate_annual_fee'],
      tax_total_annual_fee: ['tax_annual_fee'],
    };
    
    const totalKeyToCategoryIds: Record<string, string[]> = {
      risk_life_cover_total:         ['risk_planning'],
      risk_severe_illness_total:     ['risk_planning'],
      risk_disability_total:         ['risk_planning'],
      risk_temporary_icb_total:      ['risk_planning'],
      risk_permanent_icb_total:      ['risk_planning'],
      risk_total_premium:            ['risk_planning'],
      medical_aid_total_premium:     ['medical_aid'],
      retirement_total_contribution: ['retirement_planning', 'retirement_pre'],
      retirement_fund_value_total:   ['retirement_planning', 'retirement_pre'],
      post_retirement_capital_total: ['retirement_post'],
      post_retirement_income_total:  ['retirement_post'],
      invest_total_contribution:     ['investments', 'investments_voluntary', 'investments_guaranteed'],
      eb_total_premium:              ['employee_benefits', 'employee_benefits_risk', 'employee_benefits_retirement'],
      estate_total_annual_fee:       ['estate_planning'],
      tax_total_annual_fee:          ['tax_planning'],
    };
    
    for (const [totalKey, individualKeys] of Object.entries(totalKeyMappings)) {
      let total = 0;
      
      const categoryIds = totalKeyToCategoryIds[totalKey] || [];
      
      const categoryPolicies = allPolicies.filter((p: KvPolicy) => categoryIds.includes(p.categoryId) && !p.archived);
      
      for (const policy of categoryPolicies) {
        if (!policy.data) continue;
        
        const schemaKey = `config:schema:${policy.categoryId}`;
        let schema = await kv.get(schemaKey);
        
        if (!schema) {
          schema = DEFAULT_SCHEMAS[policy.categoryId];
        }
        
        const schemaRecord = schema as KvSchema | null;
        if (!schemaRecord?.fields) continue;
        
        const fields = schemaRecord.fields;
        
        for (const [fieldId, value] of Object.entries(policy.data)) {
          const fieldDef = fields.find((f: SchemaField) => f.id === fieldId);
          
          if (!fieldDef || !fieldDef.keyId) continue;
          
          if (individualKeys.includes(fieldDef.keyId)) {
            const numValue = Number(value) || 0;
            if (numValue > 0) {
              total += numValue;
            }
          }
        }
      }
      
      totals[totalKey] = total;
    }
    
    const clientKeysKey = `user_profile:${clientId}:client_keys`;
    await kv.set(clientKeysKey, totals);
    
    log.info('Client key totals saved to ' + clientKeysKey, { totals });
  } catch (e) {
    log.error('Error recalculating client totals:', e);
  }
}

// Helper function to auto-generate custom keys for unmapped fields in a schema
async function autoGenerateCustomKeysForSchema(categoryId: string, fields: SchemaField[]) {
  try {
    log.info('Auto-generating custom keys for unmapped fields', { categoryId, fieldCount: fields.length });
    
    const customKeysKey = `config:custom_keys:${categoryId}`;
    const existingCustomKeys = (await kv.get(customKeysKey)) || [];
    
    const categoryMap: Record<string, string> = {
      'risk_planning': 'risk',
      'medical_aid': 'medical_aid',
      'retirement_planning': 'retirement',
      'investments': 'invest',
      'employee_benefits': 'employee_benefits',
      'estate_planning': 'estate_planning',
      'tax_planning': 'tax',
    };
    
    const keyCategory = categoryMap[categoryId];
    if (!keyCategory) return;
    
    const newCustomKeys: CustomKey[] = [];
    let keysAdded = 0;
    
    for (const field of fields) {
      if (!field.name || field.name.trim() === '') continue;
      
      if (!field.keyId || field.keyId === '') {
        const sanitizedName = field.name
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 50);
        
        const customKeyId = `custom_${keyCategory}_${sanitizedName}`;
        
        const keyExists = (existingCustomKeys as CustomKey[]).some((k) => k.id === customKeyId);
        
        if (!keyExists) {
          const newKey = {
            id: customKeyId,
            category: keyCategory,
            name: field.name,
            description: `Custom key for ${field.name} (auto-generated from product structure)`,
            dataType: field.type === 'currency' ? 'currency' : 
                      field.type === 'number' ? 'number' :
                      field.type === 'date' ? 'date' : 'text',
            isCalculated: false,
            isCustom: true,
            createdAt: new Date().toISOString(),
            sourceField: field.id
          };
          
          newCustomKeys.push(newKey);
          keysAdded++;
        }
      }
    }
    
    if (newCustomKeys.length > 0) {
      const updatedCustomKeys = [...existingCustomKeys, ...newCustomKeys];
      await kv.set(customKeysKey, updatedCustomKeys);
      log.info(`Added ${keysAdded} new custom keys to ${customKeysKey}`);
    }
    
  } catch (e) {
    log.error('Error auto-generating custom keys:', e);
  }
}

// Helper function to check if a string is a valid date
function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}
