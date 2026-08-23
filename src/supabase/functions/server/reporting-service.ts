/**
 * Reporting Service
 *
 * Facade: the method bodies live in the reporting-service-* slices
 * (dashboard, clients, pipeline, audits, helpers); this class binds them so
 * reporting-routes.ts keeps its `new ReportingService()` call shape.
 */
import {
  getDashboardReport,
  getKeyStats,
  getRevenueReport,
  getAUMReport,
  getCommissionsReport,
} from './reporting-service-dashboard.ts';
import {
  getPersonalClientsReport,
  getPersonalClientsExport,
  getClientGrowthReport,
  getClientRetentionReport,
  getClientDemographicsReport,
} from './reporting-service-clients.ts';
import {
  getApplicationsReport,
  getFNAReport,
  getApplicationsPipelineExport,
  getFNACompletionExport,
} from './reporting-service-pipeline.ts';
import {
  getComplianceAuditExport,
  getClientLifecycleAuditExport,
  generateCustomReport,
  exportReport,
} from './reporting-service-audits.ts';

export class ReportingService {
  getDashboardReport = getDashboardReport;
  getKeyStats = getKeyStats;
  getRevenueReport = getRevenueReport;
  getAUMReport = getAUMReport;
  getCommissionsReport = getCommissionsReport;
  getPersonalClientsReport = getPersonalClientsReport;
  getPersonalClientsExport = getPersonalClientsExport;
  getClientGrowthReport = getClientGrowthReport;
  getClientRetentionReport = getClientRetentionReport;
  getClientDemographicsReport = getClientDemographicsReport;
  getApplicationsReport = getApplicationsReport;
  getFNAReport = getFNAReport;
  getApplicationsPipelineExport = getApplicationsPipelineExport;
  getFNACompletionExport = getFNACompletionExport;
  getComplianceAuditExport = getComplianceAuditExport;
  getClientLifecycleAuditExport = getClientLifecycleAuditExport;
  generateCustomReport = generateCustomReport;
  exportReport = exportReport;
}
