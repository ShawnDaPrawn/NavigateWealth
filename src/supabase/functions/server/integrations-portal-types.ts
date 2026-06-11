/**
 * Portal automation types (Phase 5 decomposition).
 * =================================================
 *
 * Extracted verbatim from integrations.tsx so the portal-automation routes,
 * helpers, and (future) sub-routers can share a single canonical type surface
 * as that 6,600-line god-file is split apart. These are pure type declarations
 * (erased at runtime) — moving them changes no behaviour.
 *
 * Self-contained: every type below references only other types in this file or
 * primitives, so this module needs no imports.
 */

export type PortalJobStatus =
  | 'queued'
  | 'running'
  | 'waiting_for_otp'
  | 'discovering'
  | 'discovery_ready'
  | 'extracting'
  | 'dry_run_ready'
  | 'staging'
  | 'staged'
  | 'failed'
  | 'cancelled';
export type PortalJobRunMode = 'discover' | 'dry-run' | 'run';
export type PortalAutomationHost = 'github_actions' | 'hosted_worker' | 'manual';
export type PortalJobItemStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface PortalCredentialProfile {
  id: string;
  label: string;
  source: 'environment' | 'supabase_kv' | 'supabase_vault';
  usernameEnvVar?: string;
  passwordEnvVar?: string;
  usernameSecretName?: string;
  passwordSecretName?: string;
}

export interface PortalCredentialRecord {
  providerId: string;
  profileId: string;
  username: string;
  password: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface PortalCredentialStatus {
  providerId: string;
  profileId: string;
  hasUsername: boolean;
  hasPassword: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PortalFlowField {
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

export interface PortalSearchBrainConfig {
  enabled?: boolean;
  goal?: string;
  maxDecisionsPerItem?: number;
  rememberSelectors?: boolean;
}

export interface PortalFlowStep {
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

export interface PortalPolicyScheduleConfig {
  enabled?: boolean;
  downloadSelector?: string;
  downloadLabels?: string[];
  downloadMenuLabels?: string[];
  documentType?: 'policy_schedule' | 'amendment' | 'statement' | 'benefit_summary' | 'other';
  required?: boolean;
  waitForDownloadMs?: number;
}

export interface PortalDocumentArtifactStep {
  action: 'click' | 'click_menu_item' | 'wait_for_download';
  target?: 'download_button' | 'menu_item' | string;
  selector?: string;
  labels?: string[];
  text?: string;
  timeoutMs?: number;
  optional?: boolean;
}

export interface PortalDocumentArtifactConfig {
  id: string;
  label: string;
  enabled?: boolean;
  required?: boolean;
  attachTo?: 'matched_policy' | 'estate_documents';
  documentType?:
    | 'policy_schedule'
    | 'amendment'
    | 'statement'
    | 'benefit_summary'
    | 'last_will_scanned'
    | 'living_will_scanned'
    | 'trust_deed'
    | 'power_of_attorney'
    | 'codicil'
    | 'letter_of_executorship'
    | 'other';
  fileType?: 'pdf';
  steps: PortalDocumentArtifactStep[];
}

export interface PortalDocumentArtifactStatus {
  id: string;
  label: string;
  status:
    | 'not_requested'
    | 'started'
    | 'downloaded'
    | 'validated'
    | 'attached'
    | 'failed'
    | 'skipped';
  fileName?: string;
  documentId?: string;
  error?: string;
  updatedAt: string;
}

export interface PortalJobLiveView {
  storageKey?: string;
  signedUrl?: string;
  contentType?: string;
  capturedAt: string;
  pageUrl?: string;
  pageTitle?: string;
  note?: string;
}

export interface PortalProviderFlow {
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
    /**
     * Opt this provider into the observe-only LLM page-extraction shadow
     * comparison (also enabled worker-wide via NW_PORTAL_SHADOW_EXTRACT=1).
     */
    shadowLlm?: boolean;
  };
  policySchedule?: PortalPolicyScheduleConfig;
  documentArtifacts?: PortalDocumentArtifactConfig[];
  notes: string[];
  needsDiscovery?: boolean;
  updatedAt: string;
}

export interface PortalSyncJob {
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
  liveView?: PortalJobLiveView;
  policySchedule?: PortalPolicyScheduleConfig;
  documentArtifacts?: PortalDocumentArtifactConfig[];
  queueSummary?: PortalJobQueueSummary;
}

export interface PortalJobQueueSummary {
  total: number;
  queued: number;
  inProgress: number;
  completed: number;
  failed: number;
  skipped: number;
}

/**
 * Trimmed portal job record returned by GET /portal-jobs/history. Keeps the
 * list payload small — the full PortalSyncJob (live view, artifact configs,
 * policy schedule) is only needed for the latest job.
 */
export interface PortalJobHistoryEntry {
  id: string;
  status: PortalJobStatus;
  runMode?: PortalJobRunMode;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  currentStep?: string;
  message?: string;
  error?: string;
  warning?: string;
  queueSummary?: PortalJobQueueSummary;
  stagedRunId?: string;
  discoveryReportId?: string;
  actionsRunUrl?: string;
  actionsDispatchError?: string;
}

export interface PortalShadowExtractionFieldComparison {
  columnName: string;
  fieldName?: string;
  semantic?: string;
  workerValue?: string;
  shadowValue?: string;
  shadowConfidence?: 'high' | 'medium' | 'low';
  shadowPlausible?: boolean;
  status: 'match' | 'mismatch' | 'shadow_only' | 'worker_only' | 'both_empty';
}

/**
 * Observe-only comparison between the selector/adapter extraction and the LLM
 * page extraction for one policy item. Recorded for review; never staged.
 */
export interface PortalShadowExtractionComparison {
  model?: string;
  comparedAt: string;
  pageUrl?: string;
  summary: {
    total: number;
    match: number;
    mismatch: number;
    shadowOnly: number;
    workerOnly: number;
    bothEmpty: number;
  };
  fields: PortalShadowExtractionFieldComparison[];
}

export interface PortalJobPolicyItem {
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
  shadowExtraction?: PortalShadowExtractionComparison;
  documentAttached?: boolean;
  documentFileName?: string;
  documentUpdatedAt?: string;
  artifactStatuses?: PortalDocumentArtifactStatus[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface PortalBrainMemoryEntry {
  selector: string;
  label?: string;
  notes?: string;
  successCount: number;
  lastUsedAt: string;
  source: 'brain' | 'deterministic' | 'manual';
}

export interface PortalBrainMemory {
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

export interface PortalBrainMemorySummary {
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

export interface PortalDiscoveryReport {
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
