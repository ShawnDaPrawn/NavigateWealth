import type { ReportDataSource } from './reportSources';

export interface Report {
  id: string;
  name: string;
  description: string;
  category: ReportCategory;
  parameters: Record<string, unknown>;
  lastRunAt?: string;
  outputs: string[];
  createdAt: string;
  /** Saved custom reports: the built-in export they draw on, and the columns kept. */
  dataSource?: ReportDataSource;
  columns?: string[];
  custom?: boolean;
}

/** A saved custom report as the server stores it. */
export interface SavedReportDefinition {
  id: string;
  name: string;
  category: ReportCategory;
  dataSource: ReportDataSource;
  columns: string[];
  format: 'xlsx';
  createdBy: string;
  createdAt: string;
}

/**
 * Represents a single execution of a report
 */
export interface ReportRun {
  id: string;
  reportId: string;
  parameters: Record<string, unknown>;
  status: 'Running' | 'Completed' | 'Failed';
  progress: number;
  startedAt: string;
  completedAt?: string;
  outputFile?: string;
  error?: string;
}

/**
 * Report category for organizing reports
 */
export type ReportCategory = 'clients' | 'financial' | 'activity' | 'compliance' | 'custom';

/**
 * Report format options
 */
export type ReportFormat = 'xlsx' | 'csv' | 'pdf' | 'json';

/**
 * Extended report definition with format
 */
export interface ReportDefinition extends Report {
  format: ReportFormat;
}
