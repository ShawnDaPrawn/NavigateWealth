/**
 * Applications and FNA pipeline reports and exports.
 * One slice of the reporting service — the ReportingService facade in
 * reporting-service.ts binds these as its methods.
 */
/**
 * Reporting Service
 * Fresh file moved to root to fix bundling issues
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import type {
  DateRange,
  KvReportApplication,
  KvReportFna,
  ApplicationsReport,
  FNAReport,
  ApplicationsPipelineRow,
  FNACompletionRow,
} from './reporting-types.ts';

import { getReportingSupabaseClient } from './reporting-service-helpers.ts';

const log = createModuleLogger('reporting-service');

/**
 * Get applications report
 */
export async function getApplicationsReport(dateRange?: DateRange): Promise<ApplicationsReport> {
  log.info('Generating applications report', { dateRange });

  const applications = await kv.getByPrefix('application:');

  if (!applications || applications.length === 0) {
    return { total: 0, byStatus: [] };
  }

  // Filter by date range if provided
  let filtered = applications;

  if (dateRange?.startDate) {
    filtered = filtered.filter(
      (a: KvReportApplication) =>
        new Date(a.created_at || a.createdAt || '') >= new Date(dateRange.startDate!),
    );
  }

  if (dateRange?.endDate) {
    filtered = filtered.filter(
      (a: KvReportApplication) =>
        new Date(a.created_at || a.createdAt || '') <= new Date(dateRange.endDate!),
    );
  }

  // Group by status
  const byStatus: Record<string, number> = {};

  filtered.forEach((app: KvReportApplication) => {
    const status = app.status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  return {
    total: filtered.length,
    byStatus: Object.entries(byStatus).map(([status, count]) => ({
      status,
      count,
      percentage: (count / filtered.length) * 100,
    })),
  };
}

/**
 * Get FNA report
 */
export async function getFNAReport(dateRange?: DateRange): Promise<FNAReport> {
  log.info('Generating FNA report', { dateRange });

  const fnas = await kv.getByPrefix('fna:');

  if (!fnas || fnas.length === 0) {
    return { total: 0, byType: [], byStatus: [] };
  }

  // Group by type and status
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  fnas.forEach((fna: KvReportFna) => {
    const type = fna.type || 'unknown';
    const status = fna.status || 'unknown';

    byType[type] = (byType[type] || 0) + 1;
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  return {
    total: fnas.length,
    byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
    byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
  };
}

// ========================================================================
// CUSTOM REPORTS
// ========================================================================

// ========================================================================
// EXPORT REPORTS (Spreadsheet Downloads)
// ========================================================================

/**
 * Export applications pipeline data as flat rows for spreadsheet download.
 * Queries all application: KV entries with their keys and flattens to tabular format.
 */
export async function getApplicationsPipelineExport(
  dateRange?: DateRange,
): Promise<ApplicationsPipelineRow[]> {
  log.info('Generating Applications Pipeline spreadsheet export', { dateRange });

  const supabase = getReportingSupabaseClient();

  const { data, error } = await supabase
    .from('kv_store_91ed8379')
    .select('key, value')
    .like('key', 'application:%');

  if (error) {
    log.error('Failed to query applications for pipeline export', { error: error.message });
    throw new Error(`Failed to fetch applications: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  const now = new Date();
  const startFilter = dateRange?.startDate ? new Date(dateRange.startDate) : null;
  const endFilter = dateRange?.endDate ? new Date(dateRange.endDate + 'T23:59:59') : null;

  const rows: ApplicationsPipelineRow[] = [];

  for (const row of data) {
    const keyParts = row.key.split(':');
    const applicationId = keyParts.length >= 2 ? keyParts.slice(1).join(':') : 'Unknown';
    const a = row.value || {};

    // Extract personal info if embedded
    const personal = (a.personalInformation || a.personal || {}) as Record<string, unknown>;
    const meta = (a._applicationMeta || a.meta || {}) as Record<string, unknown>;

    const firstName = (personal.firstName || a.firstName || '') as string;
    const lastName = (personal.lastName || a.lastName || '') as string;
    const applicantName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';

    const submittedDate = (a.created_at || a.createdAt || a.submittedAt || '') as string;

    // Apply date range filter if provided
    if (submittedDate && (startFilter || endFilter)) {
      const submitted = new Date(submittedDate);
      if (startFilter && submitted < startFilter) continue;
      if (endFilter && submitted > endFilter) continue;
    }

    const updatedDate = (a.updated_at || a.updatedAt || '') as string;

    // Calculate days since submission
    let daysSinceSubmission = 0;
    if (submittedDate) {
      const submitted = new Date(submittedDate);
      daysSinceSubmission = Math.floor(
        (now.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    const status = (a.status || 'unknown') as string;
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

    const servicesRequested = Array.isArray(meta.servicesRequested)
      ? (meta.servicesRequested as string[]).join('; ')
      : (meta.servicesRequested as string) || '';

    rows.push({
      'Application ID': applicationId,
      'Applicant Name': applicantName,
      Email: (personal.email || a.email || '') as string,
      Phone: (personal.phoneNumber || personal.phone || a.phone || '') as string,
      Status: statusLabel,
      'Services Requested': servicesRequested,
      Urgency: (meta.urgency || a.urgency || '') as string,
      'Submitted Date': submittedDate ? new Date(submittedDate).toLocaleDateString('en-ZA') : '',
      'Last Updated': updatedDate ? new Date(updatedDate).toLocaleDateString('en-ZA') : '',
      'Days Since Submission': daysSinceSubmission,
    });
  }

  return rows;
}

/**
 * Export FNA completion data as flat rows for spreadsheet download.
 * Queries all fna: KV entries and flattens to tabular format.
 */
export async function getFNACompletionExport(dateRange?: DateRange): Promise<FNACompletionRow[]> {
  log.info('Generating FNA Completion spreadsheet export', { dateRange });

  const supabase = getReportingSupabaseClient();

  const { data, error } = await supabase
    .from('kv_store_91ed8379')
    .select('key, value')
    .like('key', 'fna:%');

  if (error) {
    log.error('Failed to query FNAs for completion export', { error: error.message });
    throw new Error(`Failed to fetch FNAs: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  const startFilter = dateRange?.startDate ? new Date(dateRange.startDate) : null;
  const endFilter = dateRange?.endDate ? new Date(dateRange.endDate + 'T23:59:59') : null;

  // FNA type label mapping
  const FNA_TYPE_LABELS: Record<string, string> = {
    risk: 'Risk Planning',
    'risk-planning': 'Risk Planning',
    medical: 'Medical Aid',
    'medical-aid': 'Medical Aid',
    retirement: 'Retirement Planning',
    'retirement-planning': 'Retirement Planning',
    estate: 'Estate Planning',
    'estate-planning': 'Estate Planning',
    tax: 'Tax Planning',
    'tax-planning': 'Tax Planning',
    investment: 'Investment Analysis',
    'investment-ina': 'Investment Analysis',
  };

  const rows: FNACompletionRow[] = [];

  for (const row of data) {
    const keyParts = row.key.split(':');
    const fnaId = keyParts.length >= 2 ? keyParts.slice(1).join(':') : 'Unknown';
    const f = row.value || {};

    const fnaType = (f.type || f.fnaType || 'unknown') as string;
    const typeLabel =
      FNA_TYPE_LABELS[fnaType] || fnaType.charAt(0).toUpperCase() + fnaType.slice(1);

    const status = (f.status || 'unknown') as string;
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

    const createdDate = (f.createdAt || f.created_at || '') as string;

    // Apply date range filter if provided
    if (createdDate && (startFilter || endFilter)) {
      const created = new Date(createdDate);
      if (startFilter && created < startFilter) continue;
      if (endFilter && created > endFilter) continue;
    }

    const updatedDate = (f.updatedAt || f.updated_at || '') as string;
    const publishedDate = (f.publishedAt || f.published_at || '') as string;

    // Calculate days to complete (created → published, or created → now if still in progress)
    let daysToComplete: number | string = '';
    if (createdDate) {
      const created = new Date(createdDate);
      if (publishedDate) {
        const published = new Date(publishedDate);
        daysToComplete = Math.floor(
          (published.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
        );
      } else if (status !== 'published') {
        const now = new Date();
        daysToComplete = `${Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))} (in progress)`;
      }
    }

    rows.push({
      'FNA ID': fnaId,
      Type: typeLabel,
      Status: statusLabel,
      'Client ID': (f.clientId || f.client_id || '') as string,
      'Client Name': (f.clientName || f.client_name || '') as string,
      Adviser: (f.adviserName || f.adviser_name || f.adviserId || '') as string,
      'Created Date': createdDate ? new Date(createdDate).toLocaleDateString('en-ZA') : '',
      'Last Updated': updatedDate ? new Date(updatedDate).toLocaleDateString('en-ZA') : '',
      'Published Date': publishedDate ? new Date(publishedDate).toLocaleDateString('en-ZA') : '',
      'Days to Complete': daysToComplete,
    });
  }

  return rows;
}
