/**
 * Shared helpers for the portal-worker route slices: extraction field
 * building for the runtime payload, shadow-extraction sanitising for item
 * status updates, and the live-view persistence used by the live-view route.
 */
import * as kv from './kv_store.tsx';
import {
  buildPortalFieldsFromBindings,
  normaliseIntegrationLabelList,
} from '../../../shared/integrations/binding-utils.ts';
import { uploadPortalLiveView } from './integrations-portal-runtime.ts';
import type {
  PortalSyncJob,
  PortalFlowField,
  PortalShadowExtractionComparison,
  PortalShadowExtractionFieldComparison,
} from './integrations-portal-types.ts';
import type { IntegrationFieldBinding } from './integrations-core-types.ts';
export function buildPortalExtractionFieldsForBindings(
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

const SHADOW_COMPARISON_STATUSES: PortalShadowExtractionFieldComparison['status'][] = [
  'match',
  'mismatch',
  'shadow_only',
  'worker_only',
  'both_empty',
];

export function sanitiseShadowExtraction(
  value: unknown,
): PortalShadowExtractionComparison | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const entry = value as Record<string, unknown>;
  const rawFields = Array.isArray(entry.fields) ? entry.fields : [];
  const fields: PortalShadowExtractionFieldComparison[] = rawFields
    .slice(0, 40)
    .map((field) => {
      const item = (field || {}) as Record<string, unknown>;
      const status = SHADOW_COMPARISON_STATUSES.includes(
        item.status as PortalShadowExtractionFieldComparison['status'],
      )
        ? (item.status as PortalShadowExtractionFieldComparison['status'])
        : 'both_empty';
      return {
        columnName: String(item.columnName || '').slice(0, 120),
        fieldName: typeof item.fieldName === 'string' ? item.fieldName.slice(0, 160) : undefined,
        semantic: typeof item.semantic === 'string' ? item.semantic.slice(0, 60) : undefined,
        workerValue:
          typeof item.workerValue === 'string' ? item.workerValue.slice(0, 240) : undefined,
        shadowValue:
          typeof item.shadowValue === 'string' ? item.shadowValue.slice(0, 240) : undefined,
        shadowConfidence: ['high', 'medium', 'low'].includes(String(item.shadowConfidence))
          ? (item.shadowConfidence as 'high' | 'medium' | 'low')
          : undefined,
        shadowPlausible:
          typeof item.shadowPlausible === 'boolean' ? item.shadowPlausible : undefined,
        status,
      };
    })
    .filter((field) => field.columnName);
  if (fields.length === 0) return undefined;

  const countByStatus = (status: PortalShadowExtractionFieldComparison['status']) =>
    fields.filter((field) => field.status === status).length;

  return {
    model: typeof entry.model === 'string' ? entry.model.slice(0, 120) : undefined,
    comparedAt: typeof entry.comparedAt === 'string' ? entry.comparedAt : new Date().toISOString(),
    pageUrl: typeof entry.pageUrl === 'string' ? entry.pageUrl.slice(0, 1000) : undefined,
    summary: {
      total: fields.length,
      match: countByStatus('match'),
      mismatch: countByStatus('mismatch'),
      shadowOnly: countByStatus('shadow_only'),
      workerOnly: countByStatus('worker_only'),
      bothEmpty: countByStatus('both_empty'),
    },
    fields,
  };
}

export async function persistPortalLiveViewUpdate(
  jobId: string,
  formData: Record<string, string | File>,
) {
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
  await kv.set(`portal-job:latest:${job.providerId}:${job.categoryId}`, {
    jobId: job.id,
    updatedAt: updatedJob.updatedAt,
  });
  return { job: updatedJob };
}
