/**
 * Reporting Module - API Layer
 *
 * Data boundary for the Reporting module.
 * Maps report IDs to backend endpoints and fetches export data.
 */

import { api } from '../../../../utils/api/client';
import { logger } from '../../../../utils/logger';
import type { Report, SavedReportDefinition } from './types';
import { pickColumns } from './reportSources';

/** Shape returned by every /reporting/* export endpoint on the server. */
interface ReportExportResponse {
  rows: Record<string, unknown>[];
  count: number;
  generatedAt: string;
}

/**
 * Maps report IDs to their server endpoint paths.
 * All endpoints are relative to the Hono /reporting mount.
 */
const REPORT_ENDPOINTS: Record<string, string> = {
  'personal-clients': '/reporting/clients/personal-list',
  'applications-pipeline': '/reporting/clients/applications-pipeline',
  'fna-completion': '/reporting/clients/fna-completion',
  'compliance-audit': '/reporting/clients/compliance-audit',
  'lifecycle-audit': '/reporting/clients/lifecycle-audit',
};

/**
 * Build a query string from report parameters.
 * Extracts startDate and endDate if present.
 */
function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  if (params.startDate && typeof params.startDate === 'string') {
    searchParams.set('startDate', params.startDate);
  }
  if (params.endDate && typeof params.endDate === 'string') {
    searchParams.set('endDate', params.endDate);
  }

  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export const reportingApi = {
  /**
   * Fetch report data from the server.
   * Returns a flat array of row objects suitable for CSV/XLSX conversion.
   */
  getReportData: async (report: Report): Promise<Record<string, unknown>[]> => {
    try {
      // A custom report runs its data source's export.
      const baseEndpoint = REPORT_ENDPOINTS[report.dataSource ?? report.id];

      if (!baseEndpoint) {
        throw new Error(`Report type '${report.id}' is not yet implemented`);
      }

      const queryString = buildQueryString(report.parameters || {});
      const endpoint = `${baseEndpoint}${queryString}`;

      const response = await api.get<ReportExportResponse>(endpoint);

      // The server wraps rows in { rows, count, generatedAt }
      if (response && Array.isArray(response.rows)) {
        logger.info(`Report data fetched: ${response.count} rows`, { reportId: report.id });
        return report.columns?.length ? pickColumns(response.rows, report.columns) : response.rows;
      }

      // Fallback: if the server returned a raw array (shouldn't happen, but be safe)
      if (Array.isArray(response)) {
        return response as Record<string, unknown>[];
      }

      logger.warn('Unexpected report response shape', { reportId: report.id });
      return [];
    } catch (error) {
      logger.error('Failed to fetch report data from server', error, { reportId: report.id });
      throw error;
    }
  },
};

/** Saved custom reports (Reporting › New report). */
export const reportDefinitionsApi = {
  list: async (): Promise<SavedReportDefinition[]> => {
    const response = await api.get<{ data: SavedReportDefinition[] }>('/reporting/definitions');
    return response.data ?? [];
  },
  create: async (
    input: Pick<SavedReportDefinition, 'name' | 'category' | 'dataSource' | 'columns' | 'format'>,
  ): Promise<SavedReportDefinition> => {
    const response = await api.post<{ data: SavedReportDefinition }>(
      '/reporting/definitions',
      input,
    );
    return response.data;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/reporting/definitions/${id}`);
  },
};
