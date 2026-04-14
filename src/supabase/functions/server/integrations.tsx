import { Hono } from 'npm:hono';
import * as XLSX from 'npm:xlsx';
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
  settings: {
    autoMap: boolean;
    ignoreUnmatched: boolean;
    strictMode: boolean;
    autoPublish?: boolean;
  };
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
  selector: string;
  attribute?: 'text' | 'value' | 'href' | string;
  required?: boolean;
  transform?: 'trim' | 'number' | 'date' | string;
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
  extraction: {
    policyRowSelector?: string;
    fields: PortalFlowField[];
  };
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

function normalisePolicyNumber(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
    .replace(/[-_/]/g, '');
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
    const message = typeof data.message === 'string' ? data.message : `GitHub dispatch failed with HTTP ${response.status}`;
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
    };
  });
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
        policyListSteps: [],
        clientListSelector: '[data-testid*="client" i], a:has-text("Clients"), a:has-text("Investors")',
        clientRowSelector: '[data-testid*="client-row" i], table tbody tr',
        nextPageSelector: 'a[rel="next"], button:has-text("Next")',
      },
      extraction: {
        policyRowSelector: '[data-testid*="policy" i], table tbody tr',
        fields: [
          { sourceHeader: 'Policy Number', selector: '[data-field="policyNumber"], [data-testid*="policy-number" i], td:nth-child(1)', attribute: 'text', required: true, transform: 'trim' },
          { sourceHeader: 'Product Type', selector: '[data-field="productType"], [data-testid*="product" i], td:nth-child(2)', attribute: 'text', transform: 'trim' },
          { sourceHeader: 'Date of Inception', selector: '[data-field="inceptionDate"], [data-testid*="inception" i], td:nth-child(3)', attribute: 'text', transform: 'trim' },
          { sourceHeader: 'Fund Value', selector: '[data-field="fundValue"], [data-testid*="value" i], td:nth-child(4)', attribute: 'text', transform: 'trim' },
        ],
      },
      notes: [
        'Starter selectors are intentionally conservative because provider portals change and require authenticated discovery.',
        'Credentials are stored server-side in Supabase and are never returned to the browser.',
        'Use policy list steps to describe how the worker reaches the policy table after login.',
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
    extraction: { fields: [] },
    notes: ['Configure login, navigation, and extraction selectors before running this provider in production.'],
    needsDiscovery: true,
    updatedAt: now,
  };
}

async function getPortalFlow(provider: KvProvider, providerId: string): Promise<PortalProviderFlow> {
  const configured = (await kv.get(`portal-flow:${providerId}`)) as PortalProviderFlow | null;
  return configured || getDefaultPortalFlow(provider, providerId);
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
      const parsed = XLSX.SSF.parse_date_code(raw);
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

async function buildPolicyMatchIndex(
  providerId: string,
  categoryId: string,
  fields: SchemaField[],
): Promise<Map<string, KvPolicy[]>> {
  const policyNumberField = findPolicyNumberField(fields);
  const index = new Map<string, KvPolicy[]>();

  if (!policyNumberField) return index;

  const allClientPolicies = await kv.getByPrefix('policies:client:');
  for (const clientPolicies of allClientPolicies || []) {
    if (!Array.isArray(clientPolicies)) continue;

    for (const policy of clientPolicies as KvPolicy[]) {
      if (policy.archived || policy.providerId !== providerId || policy.categoryId !== categoryId) continue;

      const normalised = normalisePolicyNumber(policy.data?.[policyNumberField.id]);
      if (!normalised) continue;

      const current = index.get(normalised) || [];
      current.push(policy);
      index.set(normalised, current);
    }
  }

  return index;
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
  settings: IntegrationConfig['settings'];
}): Promise<IntegrationSyncRun> {
  const schema = await getSchemaForCategory(params.categoryId);
  const fields = schema.fields || [];
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const policyNumberField = findPolicyNumberField(fields);
  const policyIndex = await buildPolicyMatchIndex(params.providerId, params.categoryId, fields);

  const rows: IntegrationSyncRow[] = params.rawRows.map((rawData, index) => {
    const mappedData: Record<string, unknown> = {};
    const validationErrors: string[] = [];
    const warnings: string[] = [];

    for (const [sourceHeader, targetFieldId] of Object.entries(params.fieldMapping)) {
      const field = fieldById.get(targetFieldId);
      if (!field) {
        warnings.push(`Mapping target ${targetFieldId} is no longer in the product structure`);
        continue;
      }

      const { value, error } = coerceFieldValue(field, rawData[sourceHeader]);
      mappedData[targetFieldId] = value;
      if (error) validationErrors.push(error);
    }

    for (const field of fields) {
      if (field.required && isBlank(mappedData[field.id])) {
        validationErrors.push(`${field.name} is required`);
      }
    }

    const policyNumber = policyNumberField ? String(mappedData[policyNumberField.id] ?? '').trim() : '';
    const normalisedPolicyNumber = normalisePolicyNumber(policyNumber);
    if (!policyNumberField) {
      validationErrors.push('No policy number field exists in this product structure');
    } else if (!normalisedPolicyNumber) {
      validationErrors.push('Policy number is required for matching');
    }

    const matches = normalisedPolicyNumber ? (policyIndex.get(normalisedPolicyNumber) || []) : [];
    let matchStatus: SyncMatchStatus = 'unmatched';
    if (validationErrors.length > 0) matchStatus = 'invalid';
    else if (matches.length === 1) matchStatus = 'matched';
    else if (matches.length > 1) matchStatus = 'duplicate';

    const matchedPolicy = matches.length === 1 ? matches[0] : undefined;
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

    return {
      id: crypto.randomUUID(),
      rowNumber: index + 2,
      rawData,
      mappedData,
      policyNumber,
      normalizedPolicyNumber: normalisedPolicyNumber,
      matchStatus,
      publishStatus,
      autoPublishEligible: publishStatus === 'auto_eligible',
      validationErrors,
      warnings,
      diffs,
      clientId: matchedPolicy?.clientId,
      policyId: matchedPolicy?.id,
      providerName: matchedPolicy?.providerName,
    };
  });

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

  const config = (await kv.get(`config:mapping:${job.providerId}:${job.categoryId}`)) as IntegrationConfig | null;
  if (!config) {
    throw new Error("No mapping configuration found. Please configure mappings first.");
  }

  const settings = normaliseSettings(config.settings);
  const syncRun = await buildSyncRun({
    provider,
    providerId: job.providerId,
    categoryId: job.categoryId,
    fileName: `${job.providerName} portal extraction ${new Date().toISOString()}`,
    source: 'portal',
    rawRows,
    fieldMapping: config.fieldMapping || {},
    settings,
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

  if (!config) {
    return c.json({
      providerId,
      categoryId,
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
      fieldMapping: {},
      settings: {
        autoMap: true,
        ignoreUnmatched: false,
        strictMode: false,
        autoPublish: false,
      },
    });
  }

  return c.json({
    ...(config as IntegrationConfig),
    settings: normaliseSettings((config as IntegrationConfig).settings),
  });
});

// POST /config
app.post("/config", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = SaveConfigSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", ...formatZodError(parsed.error) }, 400);
    }
    const { providerId, categoryId, fieldMapping, settings } = parsed.data;

    const key = `config:mapping:${providerId}:${categoryId}`;
    
    const config: IntegrationConfig = {
      providerId,
      categoryId,
      updatedAt: new Date().toISOString(),
      updatedBy: "user",
      fieldMapping,
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
    const config = (await kv.get(`config:mapping:${providerId}:${categoryId}`)) as IntegrationConfig | null;
    const fieldMapping = config?.fieldMapping || {};
    const settings = normaliseSettings(config?.settings);
    const sourceByTarget = new Map(Object.entries(fieldMapping).map(([source, target]) => [target, source]));

    const workbook = XLSX.utils.book_new();
    const instructions = [
      ['Navigate Wealth Integration Mapping Template'],
      ['Provider', provider.name || providerId],
      ['Category', categoryId],
      ['Purpose', 'Use this workbook to define source headers and provide provider data for staging. Do not add credentials or OTP codes here.'],
      [],
      ['Workflow'],
      ['1. Maintain the Field Mapping sheet so each required Navigate Wealth field has a provider/source column.'],
      ['2. Put provider-extracted policy rows in the Provider Data sheet using those source column names.'],
      ['3. Upload the workbook in Product Configuration > Integrations to stage a policy sync run.'],
      ['4. Review matches and diffs before publishing, unless auto-publish is enabled and the row passes all safety gates.'],
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(instructions), 'Instructions');

    const mappingRows = [
      ['System Field ID', 'System Field Name', 'Type', 'Required', 'Dropdown Options', 'Spreadsheet Header Source', 'Overwrite Rule', 'Notes'],
      ...(schema.fields || []).map((field) => [
        field.id,
        field.name || field.id,
        field.type || 'text',
        field.required ? 'yes' : 'no',
        Array.isArray(field.options) ? field.options.join('|') : '',
        sourceByTarget.get(field.id) || '',
        'stage_before_publish',
        field.id === findPolicyNumberField(schema.fields || [])?.id ? 'Primary match key' : '',
      ]),
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(mappingRows), 'Field Mapping');

    const providerHeaders = (schema.fields || []).map((field) => sourceByTarget.get(field.id) || field.name || field.id);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([providerHeaders]), 'Provider Data');

    const rules = [
      ['Rule', 'Value'],
      ['auto_map_future_uploads', settings.autoMap ? 'yes' : 'no'],
      ['ignore_unmatched_columns', settings.ignoreUnmatched ? 'yes' : 'no'],
      ['strict_mode', settings.strictMode ? 'yes' : 'no'],
      ['auto_publish_safe_rows', settings.autoPublish ? 'yes' : 'no'],
      ['match_key', 'normalized_policy_number + provider_id + category_id'],
      ['missing_policy_default', 'hold_for_admin_review'],
      ['duplicate_policy_default', 'hold_for_admin_review'],
      ['locked_fields_default', 'do_not_overwrite'],
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rules), 'Approval Rules');

    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const safeProviderName = String(provider.name || providerId).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeProviderName}-${categoryId}-mapping-template.xlsx"`,
      },
    });
  } catch (e) {
    log.error("Template generation error:", e);
    return c.json({ error: "Failed to generate mapping template" }, 500);
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
    const flow: PortalProviderFlow = {
      ...getDefaultPortalFlow(provider, providerId),
      ...body,
      providerId,
      id: body?.id || `${providerId}:default`,
      credentialProfiles: Array.isArray(body?.credentialProfiles) ? body.credentialProfiles : getDefaultPortalFlow(provider, providerId).credentialProfiles,
      navigation: {
        ...(getDefaultPortalFlow(provider, providerId).navigation || {}),
        ...(body?.navigation || {}),
        policyListSteps: normaliseFlowSteps(body?.navigation?.policyListSteps),
      },
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`portal-flow:${providerId}`, flow);
    return c.json({ success: true, flow: sanitisePortalFlow(flow) });
  } catch (e) {
    log.error("Portal flow save error:", e);
    return c.json({ error: `Failed to save portal flow: ${getErrMsg(e)}` }, 500);
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

    await kv.set(`portal-job:${job.id}`, job);
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
    const credentialRecord = (await kv.get(portalCredentialKey(job.providerId, job.credentialProfileId))) as PortalCredentialRecord | null;
    if (!credentialRecord?.username || !credentialRecord?.password) {
      return c.json({ error: "Provider credentials are not saved for this job" }, 400);
    }
    return c.json({
      success: true,
      job,
      flow,
      credentials: {
        username: credentialRecord.username,
        password: credentialRecord.password,
      },
    });
  } catch (e) {
    log.error("Portal worker runtime error:", e);
    return c.json({ error: `Failed to load worker runtime: ${getErrMsg(e)}` }, 500);
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
    const config = (await kv.get(configKey)) as IntegrationConfig | null;

    if (!config && mode === 'commit') {
      return c.json({ error: "No mapping configuration found. Please configure mappings first." }, 400);
    }
    
    const fieldMapping = config?.fieldMapping || {};
    const settings = normaliseSettings(config?.settings);

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
    const dataSheetName = workbook.SheetNames.includes('Provider Data') ? 'Provider Data' : workbook.SheetNames[0];
    const sheet = workbook.Sheets[dataSheetName];
    
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
    
    if (jsonData.length === 0) {
       return c.json({ error: "File is empty" }, 400);
    }

    const headers = (jsonData[0] || []) as string[];
    const rawRows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
    const rows = jsonData.slice(1);

    if (!headers || headers.length === 0) {
      return c.json({ error: "File has no headers in the first row" }, 400);
    }

    const mappedColumns: string[] = [];
    const unmappedColumns: string[] = [];
    const validationErrors: string[] = [];
    const validRows: Record<string, unknown>[] = [];

    headers.forEach(header => {
      if (fieldMapping[header]) {
        mappedColumns.push(header);
      } else {
        unmappedColumns.push(header);
      }
    });

    if (!settings.ignoreUnmatched && unmappedColumns.length > 0) {
        validationErrors.push(`Unmapped columns detected: ${unmappedColumns.join(', ')}`);
    }

    let processedRowCount = 0;
    let errorRowCount = 0;

    rows.forEach((row, rowIndex) => {
        const rowData: Record<string, unknown> = {};
        let rowHasError = false;

        headers.forEach((header, colIndex) => {
            const targetField = fieldMapping[header];
            const cellValue = row[colIndex];

            if (targetField) {
                rowData[targetField] = cellValue;
            }
        });

        if (rowHasError) {
            errorRowCount++;
        } else {
            validRows.push(rowData);
            processedRowCount++;
        }
    });

    if (settings.strictMode && (unmappedColumns.length > 0 && !settings.ignoreUnmatched)) {
         return c.json({ 
            success: false, 
            error: "Strict Mode Violation: Unmapped columns found.",
            preview: {
                totalRows: rows.length,
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
                totalRows: rows.length,
                mappedColumns,
                unmappedColumns,
                validationErrors,
                sampleData: rawRows.slice(0, 5)
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
            settings,
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

    // Validate file type
    if (file.type !== 'application/pdf') {
      return c.json({ error: 'Only PDF files are accepted' }, 400);
    }

    // Validate file size (20MB)
    if (file.size > 20971520) {
      return c.json({ error: 'File exceeds maximum size of 20MB' }, 400);
    }

    // Load the policy to confirm it exists
    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policyIndex = (policies as KvPolicy[]).findIndex((p: KvPolicy) => p.id === policyId);

    if (policyIndex === -1) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    const policy = (policies as KvPolicy[])[policyIndex];

    // If there's an existing document, delete it from storage first (one-active-doc rule)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (policy.document?.storageKey) {
      log.info('Replacing existing policy document', {
        policyId,
        oldStorageKey: policy.document.storageKey,
      });

      const { error: deleteError } = await supabase.storage
        .from(POLICY_DOC_BUCKET)
        .remove([policy.document.storageKey]);

      if (deleteError) {
        // Non-fatal — log and continue (the old file becomes orphaned but the new one still uploads)
        log.error('Failed to delete previous policy document (non-fatal):', deleteError);
      }
    }

    // Upload the new document
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `${clientId}/${policyId}/${Date.now()}_${sanitizedFileName}`;

    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(POLICY_DOC_BUCKET)
      .upload(storageKey, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      log.error('Policy document upload error:', uploadError);
      return c.json({ error: `Upload failed: ${uploadError.message}` }, 500);
    }

    // Build document metadata
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

    const docMeta: PolicyDocument = {
      storageKey,
      fileName: file.name,
      fileSize: file.size,
      mimeType: 'application/pdf',
      provider: policy.providerName || '',
      productType: categoryLabels[policy.categoryId] || policy.categoryId,
      documentType,
      uploadDate: new Date().toISOString(),
      uploadedBy,
    };

    // Update the policy record with document metadata
    (policies as KvPolicy[])[policyIndex] = {
      ...policy,
      document: docMeta,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(policiesKey, policies);

    log.info('Policy document uploaded successfully', { policyId, storageKey });

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
