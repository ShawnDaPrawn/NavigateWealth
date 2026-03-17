/**
 * Reporting Module - Type Definitions
 * Fresh file moved to root to fix bundling issues
 */

// Report period
export type ReportPeriod = 'day' | 'week' | 'month' | 'year';

// Date range
export interface DateRange {
  startDate?: string;
  endDate?: string;
}

// Dashboard report
export interface DashboardReport {
  clients: {
    total: number;
    recent: number;
    growth: number;
  };
  applications: {
    total: number;
    recent: number;
    growth: number;
    recentGrowth: number;
    pending: number;
    approved: number;
  };
  fnas: {
    total: number;
    published: number;
    draft: number;
  };
  tasks: {
    total: number;
    dueToday: number;
    dueTodayGrowth: number;
    completed: number;
  };
  activity: {
    communications: number;
  };
  lastUpdated: string;
}

// Key statistics
export interface KeyStats {
  totalClients: number;
  totalApplications: number;
  totalFNAs: number;
  clientGrowth: number;
  applicationApprovalRate: number;
}

// Revenue report
export interface RevenueReport {
  total: number;
  currency: string;
  period?: DateRange;
  breakdown: {
    commissions: number;
    fees: number;
    recurring: number;
  };
}

// AUM report
export interface AUMReport {
  total: number;
  currency: string;
  breakdown: {
    equities: number;
    bonds: number;
    cash: number;
    alternatives: number;
  };
}

// Client growth data point
export interface ClientGrowthDataPoint {
  period: string;
  count: number;
}

// Report export format
export type ExportFormat = 'csv' | 'excel' | 'pdf';

// Export config
export interface ExportConfig {
  format: ExportFormat;
  reportType: string;
  dateRange?: DateRange;
}

// Custom report config
export interface CustomReportConfig {
  type: string;
  dateRange?: DateRange;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Lightweight KV record shapes used only for reporting filters
// ---------------------------------------------------------------------------

export interface KvReportTask {
  due_date?: string;
  status?: string;
  [key: string]: unknown;
}

export interface KvReportClient {
  createdAt?: string;
  created_at?: string;
  accountType?: string;
  inactive?: boolean;
  personalInformation?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface KvReportApplication {
  created_at?: string;
  createdAt?: string;
  status?: string;
  [key: string]: unknown;
}

export interface KvReportFna {
  type?: string;
  status?: string;
  clientId?: string;
  clientName?: string;
  adviserId?: string;
  adviserName?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  completedAt?: string;
  publishedAt?: string;
  [key: string]: unknown;
}

// Client growth report result
export interface ClientGrowthReport {
  data: ClientGrowthDataPoint[];
  total: number;
}

// Client retention report result
export interface ClientRetentionReport {
  totalClients: number;
  activeClients: number;
  retentionRate: number;
}

// Demographics report result
export interface ClientDemographicsReport {
  total: number;
  byAccountType: Array<{ type: string; count: number; percentage: number }>;
}

// Applications report result
export interface ApplicationsReport {
  total: number;
  byStatus: Array<{ status: string; count: number; percentage: number }>;
}

// FNA report result
export interface FNAReport {
  total: number;
  byType: Array<{ type: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
}

// Applications pipeline export row
export interface ApplicationsPipelineRow {
  'Application ID': string;
  'Applicant Name': string;
  'Email': string;
  'Phone': string;
  'Status': string;
  'Services Requested': string;
  'Urgency': string;
  'Submitted Date': string;
  'Last Updated': string;
  'Days Since Submission': number;
  [key: string]: unknown;
}

// FNA completion export row
export interface FNACompletionRow {
  'FNA ID': string;
  'Type': string;
  'Status': string;
  'Client ID': string;
  'Client Name': string;
  'Adviser': string;
  'Created Date': string;
  'Last Updated': string;
  'Published Date': string;
  'Days to Complete': number | string;
  [key: string]: unknown;
}

// POPIA/FAIS compliance audit row
export interface ComplianceAuditRow {
  'User ID': string;
  'Client Name': string;
  'Email': string;
  'Account Status': string;
  'POPIA Consent': string;
  'FAIS Acknowledged': string;
  'Electronic Comms Consent': string;
  'Marketing Consent': string;
  'Compliance Score': string;
  'Non-Compliant Items': string;
  'Profile Created': string;
  [key: string]: unknown;
}

// Client lifecycle audit row — surfaces status inconsistencies
export interface ClientLifecycleAuditRow {
  'User ID': string;
  'Client Name': string;
  'Email': string;
  'Profile Account Status': string;
  'Security Deleted': string;
  'Security Suspended': string;
  'Derived Status': string;
  'Issue Type': string;
  'Severity': string;
  'Details': string;
  'Recommended Action': string;
  'Profile Created': string;
  [key: string]: unknown;
}

// Custom report result
export interface CustomReportResult {
  type: string;
  data: unknown[];
  generatedAt: string;
}

// Export report result
export interface ExportReportResult {
  format: string;
  url: string | null;
  message: string;
}