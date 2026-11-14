/**
 * Custom report definitions (Reporting › New report).
 * `reporting:definitions:{id}` — one record per saved report.
 */

import { createKvRepository } from './kv-repository.ts';

export const REPORT_DATA_SOURCES = [
  'personal-clients',
  'applications-pipeline',
  'fna-completion',
  'compliance-audit',
  'lifecycle-audit',
] as const;
export type ReportDataSource = (typeof REPORT_DATA_SOURCES)[number];

export const REPORT_CATEGORIES = [
  'clients',
  'financial',
  'activity',
  'compliance',
  'custom',
] as const;

export interface ReportDefinition {
  id: string;
  name: string;
  category: (typeof REPORT_CATEGORIES)[number];
  /** One of the built-in exports; its rows are what the report draws on. */
  dataSource: ReportDataSource;
  /** Column headings of the source's rows to keep, in this order. */
  columns: string[];
  format: 'xlsx';
  createdBy: string;
  createdAt: string;
}

export const reportDefinitions = createKvRepository<ReportDefinition>('reporting:definitions:');
