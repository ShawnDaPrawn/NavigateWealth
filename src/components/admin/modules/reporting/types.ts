export interface Report {
  id: string;
  name: string;
  description: string;
  category: ReportCategory;
  parameters: Record<string, unknown>;
  lastRunAt?: string;
  outputs: string[];
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
export type ReportCategory =
  | 'clients'
  | 'financial'
  | 'activity'
  | 'compliance'
  | 'custom';

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