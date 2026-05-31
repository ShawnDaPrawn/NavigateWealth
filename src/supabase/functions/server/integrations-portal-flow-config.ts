/**
 * Portal automation — flow config normalisation (Phase 5 decomposition).
 * ======================================================================
 *
 * Extracted verbatim from integrations.tsx. Pure normalisers that sanitise a
 * provider's portal-flow configuration (steps, search, extraction fields,
 * policy-schedule + document-artifact configs/statuses, credential profiles)
 * into the canonical shapes. Deps: already-extracted helpers (brain config,
 * column-name, credential-id) + portal types. No kv/IO, no staying-helper calls.
 */
import { normaliseBrainConfig } from './integrations-portal-brain.ts';
import { normaliseColumnName } from './integrations-config-utils.ts';
import { normalisePortalCredentialProfileId } from './integrations-portal-credentials.ts';
import type {
  PortalFlowStep,
  PortalProviderFlow,
  PortalFlowField,
  PortalPolicyScheduleConfig,
  PortalDocumentArtifactStep,
  PortalDocumentArtifactConfig,
  PortalDocumentArtifactStatus,
  PortalCredentialProfile,
} from './integrations-portal-types.ts';

export function normaliseFlowSteps(value: unknown): PortalFlowStep[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).map((step, index) => {
    const entry = step as Record<string, unknown>;
    const action = ['goto', 'click', 'fill', 'wait_for_selector', 'wait_for_url', 'press'].includes(
      String(entry.action),
    )
      ? (entry.action as PortalFlowStep['action'])
      : 'wait_for_selector';
    return {
      id: String(entry.id || `step-${index + 1}`).slice(0, 80),
      action,
      selector: typeof entry.selector === 'string' ? entry.selector.slice(0, 500) : undefined,
      url: typeof entry.url === 'string' ? entry.url.slice(0, 1000) : undefined,
      value: typeof entry.value === 'string' ? entry.value.slice(0, 500) : undefined,
      key: typeof entry.key === 'string' ? entry.key.slice(0, 80) : undefined,
      timeoutMs:
        typeof entry.timeoutMs === 'number'
          ? Math.max(1000, Math.min(entry.timeoutMs, 120000))
          : undefined,
      description:
        typeof entry.description === 'string' ? entry.description.slice(0, 300) : undefined,
      optional: entry.optional === true,
    };
  });
}

export function normaliseStringList(value: unknown, fallback: string[] = [], limit = 20): string[] {
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

export function normaliseSearchConfig(
  value: unknown,
  fallback?: PortalProviderFlow['search'],
): PortalProviderFlow['search'] {
  const entry = (value || {}) as Record<string, unknown>;
  return {
    mode: 'policy_number',
    searchPageUrl:
      typeof entry.searchPageUrl === 'string'
        ? entry.searchPageUrl.trim().slice(0, 1000)
        : fallback?.searchPageUrl,
    searchInputSelector:
      typeof entry.searchInputSelector === 'string'
        ? entry.searchInputSelector.trim().slice(0, 500)
        : fallback?.searchInputSelector,
    searchInputLabels: normaliseStringList(
      entry.searchInputLabels,
      fallback?.searchInputLabels || ['Policy number', 'Search'],
    ),
    submitSelector:
      typeof entry.submitSelector === 'string'
        ? entry.submitSelector.trim().slice(0, 500)
        : fallback?.submitSelector,
    resultContainerSelector:
      typeof entry.resultContainerSelector === 'string'
        ? entry.resultContainerSelector.trim().slice(0, 500)
        : fallback?.resultContainerSelector,
    resultLinkSelector:
      typeof entry.resultLinkSelector === 'string'
        ? entry.resultLinkSelector.trim().slice(0, 500)
        : fallback?.resultLinkSelector,
    resultPolicyNumberSelector:
      typeof entry.resultPolicyNumberSelector === 'string'
        ? entry.resultPolicyNumberSelector.trim().slice(0, 500)
        : fallback?.resultPolicyNumberSelector,
    noResultsText: normaliseStringList(
      entry.noResultsText,
      fallback?.noResultsText || ['No results'],
    ),
    instructions:
      typeof entry.instructions === 'string'
        ? entry.instructions.trim().slice(0, 500)
        : fallback?.instructions,
    brain: normaliseBrainConfig(entry.brain, fallback?.brain),
  };
}

export function normaliseExtractionFields(
  value: unknown,
  fallback: PortalFlowField[] = [],
): PortalFlowField[] {
  if (!Array.isArray(value)) return fallback;
  return value.slice(0, 80).map((field, index) => {
    const entry = field as Record<string, unknown>;
    const columnName = normaliseColumnName(
      entry.columnName || entry.sourceHeader || `Field ${index + 1}`,
    );
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

export function normalisePolicyScheduleConfig(
  value: unknown,
  fallback?: PortalPolicyScheduleConfig,
): PortalPolicyScheduleConfig {
  const entry = (value || {}) as Record<string, unknown>;
  const documentType = [
    'policy_schedule',
    'amendment',
    'statement',
    'benefit_summary',
    'other',
  ].includes(String(entry.documentType))
    ? (entry.documentType as PortalPolicyScheduleConfig['documentType'])
    : fallback?.documentType || 'policy_schedule';
  const waitForDownloadMs = Number(entry.waitForDownloadMs || fallback?.waitForDownloadMs || 30000);

  return {
    enabled: entry.enabled === true || fallback?.enabled === true,
    downloadSelector:
      typeof entry.downloadSelector === 'string'
        ? entry.downloadSelector.trim().slice(0, 500)
        : fallback?.downloadSelector,
    downloadLabels: normaliseStringList(
      entry.downloadLabels,
      fallback?.downloadLabels || ['Policy schedule', 'Download', 'PDF', 'Statement'],
      20,
    ),
    downloadMenuLabels: normaliseStringList(
      entry.downloadMenuLabels,
      fallback?.downloadMenuLabels || [
        'Download PDF with company logo',
        'Download PDF without company logo',
      ],
      20,
    ),
    documentType,
    required: typeof entry.required === 'boolean' ? entry.required : (fallback?.required ?? true),
    waitForDownloadMs: Number.isFinite(waitForDownloadMs)
      ? Math.min(Math.max(waitForDownloadMs, 5000), 120000)
      : 30000,
  };
}

export function normaliseDocumentArtifactSteps(
  value: unknown,
  fallback: PortalDocumentArtifactStep[] = [],
): PortalDocumentArtifactStep[] {
  if (!Array.isArray(value)) return fallback;
  return value.slice(0, 20).map((step) => {
    const entry = (step || {}) as Record<string, unknown>;
    const action = ['click', 'click_menu_item', 'wait_for_download'].includes(String(entry.action))
      ? (entry.action as PortalDocumentArtifactStep['action'])
      : 'click';
    const timeoutMs = Number(entry.timeoutMs || 0);
    return {
      action,
      target: typeof entry.target === 'string' ? entry.target.slice(0, 80) : undefined,
      selector:
        typeof entry.selector === 'string' ? entry.selector.trim().slice(0, 500) : undefined,
      labels: normaliseStringList(entry.labels ?? entry.text, [], 20),
      text: typeof entry.text === 'string' ? entry.text.trim().slice(0, 160) : undefined,
      timeoutMs:
        Number.isFinite(timeoutMs) && timeoutMs > 0
          ? Math.min(Math.max(timeoutMs, 1000), 120000)
          : undefined,
      optional: entry.optional === true,
    };
  });
}

export const PORTAL_POLICY_DOCUMENT_TYPES = [
  'policy_schedule',
  'amendment',
  'statement',
  'benefit_summary',
  'other',
] as const;
export const PORTAL_ESTATE_DOCUMENT_TYPES = [
  'last_will_scanned',
  'living_will_scanned',
  'trust_deed',
  'power_of_attorney',
  'codicil',
  'letter_of_executorship',
  'other',
] as const;

export function normaliseDocumentArtifactConfigs(
  value: unknown,
  fallback: PortalDocumentArtifactConfig[] = [],
): PortalDocumentArtifactConfig[] {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value
    .slice(0, 20)
    .map((artifact, index) => {
      const entry = (artifact || {}) as Record<string, unknown>;
      const attachTo =
        String(entry.attachTo || '') === 'estate_documents' ? 'estate_documents' : 'matched_policy';
      const allowedDocumentTypes =
        attachTo === 'estate_documents'
          ? PORTAL_ESTATE_DOCUMENT_TYPES
          : PORTAL_POLICY_DOCUMENT_TYPES;
      const documentType = allowedDocumentTypes.includes(
        String(entry.documentType) as (typeof allowedDocumentTypes)[number],
      )
        ? (entry.documentType as PortalDocumentArtifactConfig['documentType'])
        : attachTo === 'estate_documents'
          ? 'other'
          : 'policy_schedule';
      return {
        id:
          String(entry.id || `document_${index + 1}`)
            .trim()
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 80) || `document_${index + 1}`,
        label:
          String(entry.label || entry.id || `Document ${index + 1}`)
            .trim()
            .slice(0, 120) || `Document ${index + 1}`,
        enabled: entry.enabled !== false,
        required: entry.required === true,
        attachTo,
        documentType,
        fileType: 'pdf',
        steps: normaliseDocumentArtifactSteps(entry.steps, []),
      };
    })
    .filter((artifact) => artifact.steps.length > 0);
}

export function policyScheduleToDocumentArtifacts(
  policySchedule?: PortalPolicyScheduleConfig,
): PortalDocumentArtifactConfig[] {
  if (!policySchedule?.enabled) return [];
  return [
    {
      id: 'policy_schedule',
      label: 'Policy schedule',
      enabled: true,
      required: policySchedule.required === true,
      attachTo: 'matched_policy',
      documentType: policySchedule.documentType || 'policy_schedule',
      fileType: 'pdf',
      steps: [
        {
          action: 'click',
          target: 'download_button',
          selector: policySchedule.downloadSelector,
          labels: policySchedule.downloadLabels || [
            'Policy schedule',
            'Download',
            'PDF',
            'Statement',
          ],
          timeoutMs: Math.min(Number(policySchedule.waitForDownloadMs || 30000), 10000),
        },
        {
          action: 'click_menu_item',
          target: 'menu_item',
          labels: policySchedule.downloadMenuLabels || [
            'Download PDF with company logo',
            'Download PDF without company logo',
          ],
          timeoutMs: policySchedule.waitForDownloadMs || 30000,
        },
        {
          action: 'wait_for_download',
          timeoutMs: policySchedule.waitForDownloadMs || 30000,
        },
      ],
    },
  ];
}

export function normaliseDocumentArtifactStatuses(
  value: unknown,
  fallback: PortalDocumentArtifactStatus[] = [],
): PortalDocumentArtifactStatus[] {
  if (!Array.isArray(value)) return fallback;
  const allowed = new Set([
    'not_requested',
    'started',
    'downloaded',
    'validated',
    'attached',
    'failed',
    'skipped',
  ]);
  return value.slice(0, 20).map((status, index) => {
    const entry = (status || {}) as Record<string, unknown>;
    const state = allowed.has(String(entry.status))
      ? (String(entry.status) as PortalDocumentArtifactStatus['status'])
      : 'started';
    return {
      id:
        String(entry.id || `document_${index + 1}`)
          .trim()
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .slice(0, 80) || `document_${index + 1}`,
      label:
        String(entry.label || entry.id || `Document ${index + 1}`)
          .trim()
          .slice(0, 120) || `Document ${index + 1}`,
      status: state,
      fileName: typeof entry.fileName === 'string' ? entry.fileName.slice(0, 240) : undefined,
      documentId: typeof entry.documentId === 'string' ? entry.documentId.slice(0, 120) : undefined,
      error: typeof entry.error === 'string' ? entry.error.slice(0, 500) : undefined,
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : new Date().toISOString(),
    };
  });
}

export function normalisePortalCredentialProfiles(
  value: unknown,
  fallback: PortalCredentialProfile[] = [],
): PortalCredentialProfile[] {
  const source = Array.isArray(value) && value.length > 0 ? value : fallback;
  const seen = new Set<string>();
  return source
    .map((profile, index) => {
      const entry = (profile || {}) as Record<string, unknown>;
      const id = normalisePortalCredentialProfileId(
        String(entry.id || `credential_${index + 1}`).trim(),
      );
      if (!id || seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        label:
          String(entry.label || id)
            .trim()
            .slice(0, 120) || id,
        source: ['environment', 'supabase_kv', 'supabase_vault'].includes(String(entry.source))
          ? (entry.source as PortalCredentialProfile['source'])
          : 'supabase_kv',
        usernameEnvVar:
          typeof entry.usernameEnvVar === 'string'
            ? entry.usernameEnvVar.trim().slice(0, 160)
            : undefined,
        passwordEnvVar:
          typeof entry.passwordEnvVar === 'string'
            ? entry.passwordEnvVar.trim().slice(0, 160)
            : undefined,
        usernameSecretName:
          typeof entry.usernameSecretName === 'string'
            ? entry.usernameSecretName.trim().slice(0, 160)
            : undefined,
        passwordSecretName:
          typeof entry.passwordSecretName === 'string'
            ? entry.passwordSecretName.trim().slice(0, 160)
            : undefined,
      };
    })
    .filter((profile): profile is PortalCredentialProfile => Boolean(profile));
}
