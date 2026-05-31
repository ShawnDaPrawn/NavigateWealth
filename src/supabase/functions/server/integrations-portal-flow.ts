/**
 * Portal automation — flow resolution (Phase 5 decomposition).
 * ============================================================
 *
 * Extracted verbatim from integrations.tsx. Builds/loads/sanitises a provider's
 * PortalProviderFlow (default flow, KV-stored flow + merge, sanitisation) and
 * the job/run scope-error checks. Deps: buildDefaultPortalFlow + the flow-config
 * normalisers + isRetirementPortalCategory (guards) + binding-utils + kv + types
 * — all already-extracted, so no circular import back into integrations.tsx.
 *
 * NOTE: prettier-ignored — providerPortalGolden asserts on the exact (>100-char)
 * portalFlowKey/getPortalJobScopeError/getSyncRunScopeError signatures; reflow
 * would break those anchors.
 */
import * as kv from './kv_store.tsx';
import { getDefaultPortalFlow as buildDefaultPortalFlow } from './portal-default-flows.ts';
import { buildPortalFieldsFromBindings } from '../../../shared/integrations/binding-utils.ts';
import { isRetirementPortalCategory } from './integrations-portal-guards.ts';
import { defaultPortalBrainGoal } from './integrations-portal-brain.ts';
import {
  normaliseSearchConfig,
  normaliseExtractionFields,
  normalisePolicyScheduleConfig,
  normaliseDocumentArtifactConfigs,
  normalisePortalCredentialProfiles,
} from './integrations-portal-flow-config.ts';
import type { KvProvider } from './integrations-types.ts';
import type { IntegrationSyncRun } from './integrations-core-types.ts';
import type { PortalProviderFlow, PortalSyncJob } from './integrations-portal-types.ts';

export function getDefaultPortalFlow(provider: KvProvider, providerId: string, categoryId?: string): PortalProviderFlow {
  return buildDefaultPortalFlow(provider, providerId, {
    defaultPortalBrainGoal,
    categoryId,
  }) as PortalProviderFlow;
}

export function portalFlowKey(providerId: string, categoryId?: string): string {
  const cleanCategoryId = String(categoryId || '').trim();
  return cleanCategoryId ? `portal-flow:${providerId}:${cleanCategoryId}` : `portal-flow:${providerId}`;
}

export function getPortalJobScopeError(job: PortalSyncJob, providerId?: string, categoryId?: string): string | null {
  const cleanProviderId = String(providerId || '').trim();
  const cleanCategoryId = String(categoryId || '').trim();
  if (cleanProviderId && cleanProviderId !== job.providerId) {
    return `Portal job belongs to provider ${job.providerId}, not ${cleanProviderId}`;
  }
  if (cleanCategoryId && cleanCategoryId !== job.categoryId) {
    return `Portal job belongs to category ${job.categoryId}, not ${cleanCategoryId}`;
  }
  return null;
}

export function getSyncRunScopeError(run: IntegrationSyncRun, providerId?: string, categoryId?: string): string | null {
  const cleanProviderId = String(providerId || '').trim();
  const cleanCategoryId = String(categoryId || '').trim();
  if (cleanProviderId && cleanProviderId !== run.providerId) {
    return `Sync run belongs to provider ${run.providerId}, not ${cleanProviderId}`;
  }
  if (cleanCategoryId && cleanCategoryId !== run.categoryId) {
    return `Sync run belongs to category ${run.categoryId}, not ${cleanCategoryId}`;
  }
  return null;
}

export async function getPortalFlow(provider: KvProvider, providerId: string, categoryId?: string): Promise<PortalProviderFlow> {
  const scopedFlow = categoryId
    ? (await kv.get(portalFlowKey(providerId, categoryId))) as PortalProviderFlow | null
    : null;
  const legacyProviderFlow = !categoryId || isRetirementPortalCategory(categoryId)
    ? (await kv.get(portalFlowKey(providerId))) as PortalProviderFlow | null
    : null;
  let configured = scopedFlow || legacyProviderFlow;
  const defaultFlow = getDefaultPortalFlow(provider, providerId, categoryId);
  if (!configured) return defaultFlow;
  if (!scopedFlow && legacyProviderFlow && categoryId && isRetirementPortalCategory(categoryId)) {
    configured = {
      ...legacyProviderFlow,
      id: `${providerId}:${categoryId}:default`,
      providerId,
      updatedAt: legacyProviderFlow.updatedAt || new Date().toISOString(),
    };
    await kv.set(portalFlowKey(providerId, categoryId), configured);
  }

  const defaultExtractionFields = normaliseExtractionFields(defaultFlow.extraction?.fields, []);
  const configuredExtractionFields = normaliseExtractionFields(configured.extraction?.fields, []);

  return {
    ...defaultFlow,
    ...configured,
    loginUrl: String(configured.loginUrl || '').trim() || defaultFlow.loginUrl,
    credentialProfiles: normalisePortalCredentialProfiles(configured.credentialProfiles, defaultFlow.credentialProfiles),
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
    documentArtifacts: normaliseDocumentArtifactConfigs(configured.documentArtifacts, defaultFlow.documentArtifacts || []),
  };
}

export function sanitisePortalFlow(flow: PortalProviderFlow): PortalProviderFlow {
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
