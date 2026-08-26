/**
 * Integration sync-run engine + portal job-items (Phase 5 decomposition).
 * =====================================================================
 *
 * Extracted verbatim from integrations.tsx. The spreadsheet/portal sync-run
 * builder + publisher (buildSyncRun / publishSyncRun / summariseSyncRows +
 * buildPolicyIndexes / listPoliciesForProviderCategory) and the portal
 * job-items lifecycle (queue build / load / persist, warning sanitisation,
 * row staging, category-run combine, business-value predicates).
 *
 * getTemplateFieldBindings moves here too: its only non-route caller is the
 * portal category sync builder, and it cannot live in integrations-config-utils
 * without creating a config-utils <-> field-utils import cycle (field-utils
 * already imports config-utils). integrations.tsx imports it back for the
 * config/template/portal routes that still reference it.
 *
 * Behaviour-preserving move. These handlers write policy data, so the route
 * contract suite (not tsc, which skips edge code) is the real guard.
 */
import * as kv from './kv_store.tsx';
import { getErrMsg } from './shared-logger-utils.ts';
import { normaliseIntegrationBlankBehavior } from '../../../shared/integrations/binding-utils.ts';
import {
  normalisePolicyNumber,
  getTemplateRowMetadata,
  TEMPLATE_METADATA_COLUMNS,
} from './integrations-spreadsheet.ts';
import {
  getDefaultIntegrationSettings,
  normaliseSettings,
  normaliseColumnName,
  buildFieldBinding,
  fieldBindingsToMapping,
  normaliseIntegrationConfig,
} from './integrations-config-utils.ts';
import {
  isBlank,
  valuesDiffer,
  findPolicyNumberField,
  getSchemaForCategory,
  getPolicyNumberForPolicy,
  coerceFieldValue,
  resolveRawPortalValue,
} from './integrations-field-utils.ts';
import { categoryMatches, inferPortalRowCategoryId } from './integrations-portal-guards.ts';
import { recalculateClientTotals } from './integrations-derive.ts';
import type { KvPolicy, KvSchema, SchemaField, KvProvider } from './integrations-types.ts';
import type {
  PortalSyncJob,
  PortalJobPolicyItem,
  PortalJobQueueSummary,
} from './integrations-portal-types.ts';
import type {
  IntegrationConfig,
  IntegrationFieldBinding,
  UploadHistory,
  SyncMatchStatus,
  SyncPublishStatus,
  SyncRunStatus,
  SyncDiff,
  IntegrationSyncRow,
  IntegrationSyncRun,
} from './integrations-core-types.ts';

export function getTemplateFieldBindings(
  config: IntegrationConfig,
  fields: SchemaField[],
): IntegrationFieldBinding[] {
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

    if (
      policyNumberField &&
      !orderedBindings.some((binding) => binding.targetFieldId === policyNumberField.id)
    ) {
      orderedBindings.unshift(
        buildFieldBinding(
          policyNumberField,
          policyNumberField.id,
          policyNumberField.name || policyNumberField.id,
        ),
      );
    }

    return orderedBindings.filter((binding) => normaliseColumnName(binding.columnName));
  }

  return fields
    .map((field) => buildFieldBinding(field, field.id, field.name || field.id))
    .filter((binding) => normaliseColumnName(binding.columnName));
}

export function summarisePortalJobItems(items: PortalJobPolicyItem[]): PortalJobQueueSummary {
  return {
    total: items.length,
    queued: items.filter((item) => item.status === 'queued').length,
    inProgress: items.filter((item) => item.status === 'in_progress').length,
    completed: items.filter((item) => item.status === 'completed').length,
    failed: items.filter((item) => item.status === 'failed').length,
    skipped: items.filter((item) => item.status === 'skipped').length,
  };
}

export async function getClientDisplayName(clientId: string): Promise<string> {
  const profile = (await kv.get(`user_profile:${clientId}:personal_info`)) as Record<
    string,
    unknown
  > | null;
  const personal = (profile?.personalInformation || profile?.personal_info || {}) as Record<
    string,
    unknown
  >;
  const firstName = String(
    profile?.firstName || personal.firstName || personal.first_name || '',
  ).trim();
  const lastName = String(
    profile?.lastName ||
      profile?.surname ||
      personal.lastName ||
      personal.surname ||
      personal.last_name ||
      '',
  ).trim();
  const fullName = String(
    profile?.fullName || personal.fullName || personal.full_name || '',
  ).trim();
  const combined = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName || combined || `Client ${clientId.slice(0, 8)}`;
}

export async function buildPortalPolicyQueue(
  job: PortalSyncJob,
  fields: SchemaField[],
): Promise<PortalJobPolicyItem[]> {
  const policyNumberField = findPolicyNumberField(fields);
  if (!policyNumberField) {
    throw new Error(
      'No policy number field exists in this product structure. Add or map a Policy Number field before running portal automation.',
    );
  }

  const allClientPolicies = await kv.getByPrefix('policies:client:');
  const now = new Date().toISOString();
  const items: PortalJobPolicyItem[] = [];
  const schemaCache = new Map<string, KvSchema>();

  for (const clientPolicies of allClientPolicies || []) {
    if (!Array.isArray(clientPolicies)) continue;

    for (const policy of clientPolicies as KvPolicy[]) {
      if (
        policy.archived ||
        policy.providerId !== job.providerId ||
        policy.categoryId !== job.categoryId
      )
        continue;

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

  return items.sort(
    (a, b) =>
      a.clientName.localeCompare(b.clientName) || a.policyNumber.localeCompare(b.policyNumber),
  );
}

export async function loadPortalJobItems(jobId: string): Promise<PortalJobPolicyItem[]> {
  const items = (await kv.get(`portal-job-items:${jobId}`)) as PortalJobPolicyItem[] | null;
  return Array.isArray(items) ? items : [];
}

export function sanitisePortalWarnings(value: unknown, fallback: string[] = []): string[] {
  const base = Array.isArray(fallback) ? fallback : [];
  const incoming = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? [value]
      : [];
  const combined = [...base, ...incoming]
    .map((warning) =>
      String(warning || '')
        .trim()
        .slice(0, 500),
    )
    .filter(Boolean);
  return Array.from(new Set(combined)).slice(-20);
}

export function latestPortalWarning(warnings?: string[]): string | undefined {
  return Array.isArray(warnings) && warnings.length > 0 ? warnings[warnings.length - 1] : undefined;
}

export async function persistPortalJobItems(
  job: PortalSyncJob,
  items: PortalJobPolicyItem[],
  patch: Partial<PortalSyncJob> = {},
): Promise<PortalSyncJob> {
  const now = new Date().toISOString();
  const summary = summarisePortalJobItems(items);
  await kv.set(`portal-job-items:${job.id}`, items);

  const warnings =
    patch.warnings === undefined && patch.warning === undefined
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
  await kv.set(`portal-job:latest:${job.providerId}:${job.categoryId}`, {
    jobId: job.id,
    updatedAt: now,
  });
  return updatedJob;
}

export async function listPoliciesForProviderCategory(
  providerId: string,
  categoryId: string,
): Promise<KvPolicy[]> {
  const allClientPolicies = await kv.getByPrefix('policies:client:');
  const policies: KvPolicy[] = [];

  for (const clientPolicies of allClientPolicies || []) {
    if (!Array.isArray(clientPolicies)) continue;

    for (const policy of clientPolicies as KvPolicy[]) {
      if (
        policy.archived ||
        policy.providerId !== providerId ||
        !categoryMatches(categoryId, policy.categoryId)
      )
        continue;
      policies.push(policy);
    }
  }

  return policies;
}

export async function buildPolicyIndexes(
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

    const normalised = normalisePolicyNumber(
      await getPolicyNumberForPolicy(policy, fields, schemaCache),
    );
    if (!normalised) continue;

    const current = policyNumberIndex.get(normalised) || [];
    current.push(policy);
    policyNumberIndex.set(normalised, current);
  }

  return { policyNumberIndex, policyIdIndex };
}

export function summariseSyncRows(rows: IntegrationSyncRow[]): IntegrationSyncRun['summary'] {
  return {
    totalRows: rows.length,
    matchedRows: rows.filter((row) => row.matchStatus === 'matched').length,
    unmatchedRows: rows.filter((row) => row.matchStatus === 'unmatched').length,
    duplicateRows: rows.filter((row) => row.matchStatus === 'duplicate').length,
    invalidRows: rows.filter((row) => row.matchStatus === 'invalid').length,
    changedRows: rows.filter((row) => row.diffs.length > 0).length,
    noChangeRows: rows.filter((row) => row.diffs.length === 0 && row.matchStatus === 'matched')
      .length,
    autoEligibleRows: rows.filter((row) => row.autoPublishEligible).length,
    publishedRows: rows.filter((row) => row.publishStatus === 'published').length,
    heldRows: rows.filter((row) => ['pending', 'held', 'auto_eligible'].includes(row.publishStatus))
      .length,
  };
}

export async function buildSyncRun(params: {
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
  const { policyNumberIndex, policyIdIndex } = await buildPolicyIndexes(
    params.providerId,
    params.categoryId,
    fields,
  );
  const schemaCache = new Map<string, KvSchema>();
  const rows: IntegrationSyncRow[] = [];

  for (const [index, rawData] of params.rawRows.entries()) {
    const mappedData: Record<string, unknown> = {};
    const rowBlockingErrors: string[] = [];
    const fieldValidationErrors: string[] = [];
    const validationErrorFieldIds = new Set<string>();
    const warnings: string[] = [];
    const warningFieldIds = new Set<string>();
    const rowMetadata = getTemplateRowMetadata(rawData);
    const hasStableMetadata = Boolean(
      rowMetadata.policyId ||
      rowMetadata.clientId ||
      rowMetadata.providerId ||
      rowMetadata.categoryId,
    );

    if (rowMetadata.providerId && rowMetadata.providerId !== params.providerId) {
      rowBlockingErrors.push('This row belongs to a different provider template');
    }
    if (rowMetadata.categoryId && !categoryMatches(params.categoryId, rowMetadata.categoryId)) {
      rowBlockingErrors.push('This row belongs to a different product template');
    }

    let matchedPolicy: KvPolicy | undefined;
    if (rowBlockingErrors.length === 0 && hasStableMetadata) {
      if (!rowMetadata.policyId || !rowMetadata.clientId) {
        rowBlockingErrors.push('Template row metadata is incomplete');
      } else {
        const metadataPolicy = policyIdIndex.get(rowMetadata.policyId);
        if (!metadataPolicy) {
          rowBlockingErrors.push('Template row no longer matches an existing policy');
        } else if (metadataPolicy.clientId !== rowMetadata.clientId) {
          rowBlockingErrors.push('Template row metadata does not match the current policy owner');
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

      const binding = bindingByColumnName.get(normaliseColumnName(sourceHeader));
      const { value: rawValue, key: resolvedSourceHeader } = resolveRawPortalValue({
        rawData,
        sourceHeader,
        field,
        binding,
        source: params.source,
      });
      const blankBehavior = normaliseIntegrationBlankBehavior(binding?.blankBehavior);
      if (isBlank(rawValue) && blankBehavior === 'error') {
        const message = `${field.name} cannot be blank for this integration`;
        if (policyNumberField?.id === field.id) {
          rowBlockingErrors.push(message);
        } else {
          fieldValidationErrors.push(message);
          validationErrorFieldIds.add(field.id);
        }
        continue;
      }
      if (params.ignoreBlankValues && isBlank(rawValue) && blankBehavior !== 'clear') {
        continue;
      }

      const { value, error } = coerceFieldValue(field, rawValue);
      if (error) {
        if (policyNumberField?.id === field.id) {
          rowBlockingErrors.push(error);
        } else {
          fieldValidationErrors.push(error);
          validationErrorFieldIds.add(field.id);
        }
        continue;
      }
      mappedData[targetFieldId] = value;

      if (params.source === 'portal' && resolvedSourceHeader !== sourceHeader) {
        warnings.push(`${field.name} mapped from portal label "${resolvedSourceHeader}"`);
      }
    }

    let policyNumber = policyNumberField
      ? String(mappedData[policyNumberField.id] ?? '').trim()
      : '';
    let normalisedPolicyNumber =
      rowMetadata.normalizedPolicyNumber || normalisePolicyNumber(policyNumber);

    if (!matchedPolicy && rowBlockingErrors.length === 0) {
      if (!policyNumberField) {
        rowBlockingErrors.push('No policy number field exists in this product structure');
      } else if (!normalisedPolicyNumber) {
        rowBlockingErrors.push('Policy number is required for matching');
      }
    }

    const candidateMatches =
      !matchedPolicy && rowBlockingErrors.length === 0 && normalisedPolicyNumber
        ? policyNumberIndex.get(normalisedPolicyNumber) || []
        : [];

    if (!matchedPolicy && candidateMatches.length === 1 && rowBlockingErrors.length === 0) {
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
    if (rowBlockingErrors.length > 0) matchStatus = 'invalid';
    else if (matchedPolicy) matchStatus = 'matched';
    else if (candidateMatches.length > 1) matchStatus = 'duplicate';

    const diffs: SyncDiff[] = [];
    const lockedFields = new Set(matchedPolicy?.lockedFields || []);
    const shouldRespectLockedFields = (params.source || 'spreadsheet') !== 'portal';

    if (matchedPolicy) {
      for (const [fieldId, newValue] of Object.entries(mappedData)) {
        if (
          shouldRespectLockedFields &&
          lockedFields.has(fieldId) &&
          valuesDiffer(matchedPolicy.data?.[fieldId], newValue)
        ) {
          warnings.push(
            `${fieldById.get(fieldId)?.name || fieldId} is locked and will not be overwritten`,
          );
          warningFieldIds.add(fieldId);
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

    const validationErrors = [...rowBlockingErrors, ...fieldValidationErrors];
    let publishStatus: SyncPublishStatus = 'held';
    if (matchStatus === 'matched' && diffs.length === 0 && validationErrors.length === 0)
      publishStatus = 'skipped';
    else if (matchStatus === 'matched' && diffs.length > 0 && params.settings.autoPublish)
      publishStatus = 'auto_eligible';
    else if (matchStatus === 'matched' && diffs.length > 0) publishStatus = 'pending';

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
      validationErrorFieldIds: Array.from(validationErrorFieldIds),
      warnings,
      warningFieldIds: Array.from(warningFieldIds),
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

export async function publishSyncRun(
  run: IntegrationSyncRun,
  options?: { autoOnly?: boolean; rowIds?: string[] },
) {
  const rowIds = options?.rowIds ? new Set(options.rowIds) : null;
  const rowsToPublish = run.rows.filter((row) => {
    if (rowIds && !rowIds.has(row.id)) return false;
    if (options?.autoOnly && !row.autoPublishEligible) return false;
    return row.matchStatus === 'matched' && row.policyId && row.clientId && row.diffs.length > 0;
  });

  const clientIds = Array.from(new Set(rowsToPublish.map((row) => row.clientId!).filter(Boolean)));
  const policiesByClient = new Map<string, KvPolicy[]>();

  for (const clientId of clientIds) {
    policiesByClient.set(
      clientId,
      ((await kv.get(`policies:client:${clientId}`)) || []) as KvPolicy[],
    );
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
      const shouldRespectLockedFields = run.source !== 'portal';
      const updatedData = { ...policy.data };
      const appliedFields: string[] = [];

      for (const diff of row.diffs) {
        if (shouldRespectLockedFields && lockedSet.has(diff.fieldId)) continue;
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
  run.status =
    run.summary.publishedRows > 0 && run.summary.heldRows > 0
      ? 'partially_published'
      : run.summary.publishedRows > 0
        ? 'published'
        : 'staged';

  return run;
}

export async function buildPortalCategorySyncRun(params: {
  job: PortalSyncJob;
  provider: KvProvider;
  categoryId: string;
  rawRows: Record<string, unknown>[];
  fallbackSettings?: IntegrationConfig['settings'];
  runId: string;
}): Promise<IntegrationSyncRun> {
  const storedConfig = (await kv.get(
    `config:mapping:${params.job.providerId}:${params.categoryId}`,
  )) as IntegrationConfig | null;
  const schema = await getSchemaForCategory(params.categoryId);
  const config = normaliseIntegrationConfig(
    storedConfig
      ? {
          ...storedConfig,
          providerId: params.job.providerId,
          categoryId: params.categoryId,
        }
      : {
          providerId: params.job.providerId,
          categoryId: params.categoryId,
          fieldMapping: {},
          fieldBindings: [],
          settings: params.fallbackSettings || getDefaultIntegrationSettings(),
        },
    schema.fields || [],
  );

  const templateBindings = getTemplateFieldBindings(config, schema.fields || []);
  const settings = normaliseSettings(config.settings);
  const syncRun = await buildSyncRun({
    provider: params.provider,
    providerId: params.job.providerId,
    categoryId: params.categoryId,
    fileName: `${params.job.providerName} portal extraction ${new Date().toISOString()}`,
    source: 'portal',
    rawRows: params.rawRows,
    fieldMapping: fieldBindingsToMapping(templateBindings, config.fieldMapping || {}),
    fieldBindings: templateBindings,
    settings,
    ignoreBlankValues: true,
  });

  syncRun.id = params.runId;
  return settings.autoPublish ? await publishSyncRun(syncRun, { autoOnly: true }) : syncRun;
}

export function combinePortalCategoryRuns(params: {
  job: PortalSyncJob;
  provider: KvProvider;
  runId: string;
  runs: IntegrationSyncRun[];
}): IntegrationSyncRun {
  const now = new Date().toISOString();
  const rows = params.runs.flatMap((run) => run.rows);
  rows.forEach((row, index) => {
    row.rowNumber = index + 2;
  });

  const summary = summariseSyncRows(rows);
  const status: SyncRunStatus =
    summary.publishedRows > 0 && summary.heldRows > 0
      ? 'partially_published'
      : summary.publishedRows > 0
        ? 'published'
        : 'staged';

  return {
    id: params.runId,
    providerId: params.job.providerId,
    providerName: params.provider.name || params.job.providerName || 'Unknown Provider',
    categoryId: params.job.categoryId,
    fileName: `${params.job.providerName} portal extraction ${now}`,
    source: 'portal',
    status,
    createdAt: params.runs[0]?.createdAt || now,
    updatedAt: now,
    mappingVersion: `${params.job.providerId}:${params.job.categoryId}:${now}`,
    autoPublish: params.runs.some((run) => run.autoPublish),
    summary,
    rows,
  };
}

export async function stagePortalRows(
  jobId: string,
  rawRows: Record<string, unknown>[],
): Promise<{ job: PortalSyncJob; stagedRun: IntegrationSyncRun }> {
  const job = (await kv.get(`portal-job:${jobId}`)) as PortalSyncJob | null;
  if (!job) {
    throw new Error('Portal job not found');
  }
  if (rawRows.length === 0) {
    throw new Error('No extracted rows supplied');
  }

  const provider = (await kv.get(`provider:${job.providerId}`)) as KvProvider | null;
  if (!provider) {
    throw new Error('Invalid provider ID');
  }

  const jobConfig = (await kv.get(
    `config:mapping:${job.providerId}:${job.categoryId}`,
  )) as IntegrationConfig | null;
  if (!jobConfig) {
    throw new Error(
      'No mapping configuration found for the selected product group. Please configure mappings first.',
    );
  }

  const fallbackSettings = normaliseSettings(jobConfig.settings);
  const rowsByCategory = new Map<string, Record<string, unknown>[]>();
  for (const row of rawRows) {
    const rowMetadata = getTemplateRowMetadata(row);
    const categoryId = inferPortalRowCategoryId(row, rowMetadata.categoryId || job.categoryId);
    const group = rowsByCategory.get(categoryId) || [];
    group.push(row);
    rowsByCategory.set(categoryId, group);
  }

  const finalRunId = crypto.randomUUID();
  const categoryRuns: IntegrationSyncRun[] = [];
  for (const [categoryId, categoryRows] of rowsByCategory.entries()) {
    categoryRuns.push(
      await buildPortalCategorySyncRun({
        job,
        provider,
        categoryId,
        rawRows: categoryRows,
        fallbackSettings,
        runId: finalRunId,
      }),
    );
  }

  const finalRun = combinePortalCategoryRuns({
    job,
    provider,
    runId: finalRunId,
    runs: categoryRuns,
  });

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
  await kv.set(`portal-job:latest:${job.providerId}:${job.categoryId}`, {
    jobId: job.id,
    updatedAt: now,
  });

  const historyEntry: UploadHistory = {
    id: crypto.randomUUID(),
    providerId: job.providerId,
    categoryId: job.categoryId,
    fileName: 'Provider portal extraction',
    status: 'success',
    rowCount: finalRun.summary.totalRows,
    errorCount:
      finalRun.summary.invalidRows +
      finalRun.summary.duplicateRows +
      finalRun.summary.unmatchedRows,
    uploadedAt: now,
    errors: [],
    runId: finalRun.id,
    publishedRows: finalRun.summary.publishedRows,
  };
  // Same key shape and same reason as integrations-upload-routes: a
  // millisecond timestamp is not unique and `kv.set` upserts. This path runs
  // inside the sync loop, so two jobs completing in the same millisecond is
  // likelier here than on the manual upload route.
  await kv.set(
    `history:${job.providerId}:${job.categoryId}:${Date.now()}:${historyEntry.id}`,
    historyEntry,
  );

  return { job: updatedJob, stagedRun: finalRun };
}

export function portalRowHasBusinessValue(rawData: Record<string, unknown>): boolean {
  const metadataColumns = new Set(Object.values(TEMPLATE_METADATA_COLUMNS));
  return Object.entries(rawData || {}).some(([key, value]) => {
    const normalisedKey = String(key || '')
      .trim()
      .toLowerCase();
    if (!normalisedKey || (metadataColumns as Set<string>).has(key)) return false;
    if (/^policy\s*(number|no)$/i.test(normalisedKey)) return false;
    return String(value ?? '').trim().length > 0;
  });
}

export function portalRowHasMappedCurrentValue(rawData: Record<string, unknown>): boolean {
  const metadataColumns = new Set(Object.values(TEMPLATE_METADATA_COLUMNS));
  return Object.entries(rawData || {}).some(([key, value]) => {
    const normalisedKey = String(key || '')
      .trim()
      .toLowerCase();
    const rawValue = String(value ?? '').trim();
    if (!normalisedKey || !rawValue || (metadataColumns as Set<string>).has(key)) return false;
    if (/(maturity|premium|contribution|inception|date|product\s*type)/i.test(normalisedKey))
      return false;
    if (
      !/(current\s*value|fund\s*value|market\s*value|closing\s*balance|policy\s*value|account\s*value|retirement.*value|\bvalue\b)/i.test(
        normalisedKey,
      )
    )
      return false;
    return /(?:R\s*)?[-+]?\d[\d\s,.]*$/.test(rawValue);
  });
}

export function portalItemHasStageableBusinessValue(
  item: PortalJobPolicyItem,
  rawData: Record<string, unknown>,
): boolean {
  if (/allan\s*gray/i.test(String(item.providerName || item.providerId || ''))) {
    return portalRowHasMappedCurrentValue(rawData);
  }
  return portalRowHasBusinessValue(rawData);
}
