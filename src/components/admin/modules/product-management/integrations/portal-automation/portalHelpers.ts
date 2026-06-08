import { PortalSyncJob, PortalJobPolicyItem } from '../../types';

export const statusClassNames: Record<PortalSyncJob['status'], string> = {
  queued: 'bg-gray-50 text-gray-700 border-gray-200',
  running: 'bg-blue-50 text-blue-700 border-blue-200',
  waiting_for_otp: 'bg-amber-50 text-amber-700 border-amber-200',
  discovering: 'bg-purple-50 text-purple-700 border-purple-200',
  discovery_ready: 'bg-green-50 text-green-700 border-green-200',
  extracting: 'bg-blue-50 text-blue-700 border-blue-200',
  dry_run_ready: 'bg-green-50 text-green-700 border-green-200',
  staging: 'bg-purple-50 text-purple-700 border-purple-200',
  staged: 'bg-green-50 text-green-700 border-green-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-50 text-gray-600 border-gray-200',
};

export const itemStatusClassNames: Record<PortalJobPolicyItem['status'], string> = {
  queued: 'bg-gray-50 text-gray-700 border-gray-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  skipped: 'bg-gray-50 text-gray-600 border-gray-200',
};

export const itemStatusLabels: Record<PortalJobPolicyItem['status'], string> = {
  queued: 'Queued',
  in_progress: 'Working',
  completed: 'Extracted',
  failed: 'Failed',
  skipped: 'Skipped',
};

export const artifactStatusClassNames: Record<string, string> = {
  attached: 'bg-green-50 text-green-700 border-green-200',
  downloaded: 'bg-blue-50 text-blue-700 border-blue-200',
  validated: 'bg-blue-50 text-blue-700 border-blue-200',
  started: 'bg-blue-50 text-blue-700 border-blue-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  skipped: 'bg-gray-50 text-gray-600 border-gray-200',
  not_requested: 'bg-gray-50 text-gray-600 border-gray-200',
};

export const splitPortalLines = (value: string) =>
  value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

export const latestPortalWarning = (value?: string, warnings?: string[]) => {
  if (Array.isArray(warnings) && warnings.length > 0) return warnings[warnings.length - 1];
  return value || '';
};

export const isCloudflareVerificationStep = (job?: PortalSyncJob | null) =>
  job?.currentStep === 'manual_cloudflare_verification' ||
  /cloudflare human verification/i.test(String(job?.message || '')) ||
  /cloudflare human verification/i.test(String(job?.error || ''));

export const isPortalMetadataColumn = (key: string) => key.trim().startsWith('_NW ');

export const formatExtractedValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

export const getExtractedValues = (rawData?: Record<string, unknown>) =>
  Object.entries(rawData || {})
    .filter(([key, value]) => !isPortalMetadataColumn(key) && String(value ?? '').trim().length > 0)
    .slice(0, 8);

export const getPrimaryArtifactStatus = (item: PortalJobPolicyItem) =>
  item.artifactStatuses?.find((status) => status.status === 'attached') ||
  item.artifactStatuses?.find((status) => status.status === 'failed') ||
  item.artifactStatuses?.[0];

export const getPortalFieldColumnName = (field: { columnName?: string; sourceHeader?: string }) =>
  String(field.columnName || field.sourceHeader || '').trim();

export const getPortalFieldTitle = (field: {
  targetFieldName?: string;
  columnName?: string;
  sourceHeader?: string;
  targetFieldId?: string;
}) =>
  String(
    field.targetFieldName ||
      field.columnName ||
      field.sourceHeader ||
      field.targetFieldId ||
      'Field',
  ).trim();

export const getPortalFieldKey = (field: {
  targetFieldId?: string;
  columnName?: string;
  sourceHeader?: string;
  targetFieldName?: string;
}) =>
  String(
    field.targetFieldId || getPortalFieldColumnName(field) || field.targetFieldName || '',
  ).trim();

export const getBindingKey = (binding: { targetFieldId?: string; columnName?: string }) =>
  String(binding.targetFieldId || binding.columnName || '').trim();
