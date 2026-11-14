import type { Report, SavedReportDefinition } from './types';

/**
 * What a custom report can draw on: each built-in export, and the column
 * headings its rows carry (kept in step with the server's export functions in
 * `supabase/functions/server/reporting-service-*.ts`). Running a custom report
 * calls the source's export and keeps only the chosen columns.
 */

export const REPORT_DATA_SOURCES = [
  'personal-clients',
  'applications-pipeline',
  'fna-completion',
  'compliance-audit',
  'lifecycle-audit',
] as const;
export type ReportDataSource = (typeof REPORT_DATA_SOURCES)[number];

export interface ReportSourceInfo {
  label: string;
  /** Whether the export takes a date range (Settings › Date range). */
  dateRange: boolean;
  columns: readonly string[];
}

export const REPORT_SOURCES: Record<ReportDataSource, ReportSourceInfo> = {
  'personal-clients': {
    label: 'Personal clients',
    dateRange: false,
    columns: [
      'User ID',
      'Title',
      'First Name',
      'Middle Name',
      'Last Name',
      'Preferred Name',
      'Date of Birth',
      'Gender',
      'Nationality',
      'Marital Status',
      'Marital Regime',
      'ID Number',
      'Passport Number',
      'Tax Number',
      'ID Doc Type',
      'ID Doc Number',
      'ID Doc Country',
      'ID Verified',
      'Email',
      'Secondary Email',
      'Phone',
      'Alternative Phone',
      'Preferred Contact Method',
      'Address Line 1',
      'Address Line 2',
      'Suburb',
      'City',
      'Province',
      'Postal Code',
      'Country',
      'Employment Status',
      'Job Title',
      'Employer',
      'Industry',
      'Self-Employed Company',
      'Self-Employed Industry',
      'Self-Employed Description',
      'Gross Monthly Income',
      'Net Monthly Income',
      'Gross Annual Income',
      'Net Annual Income',
      'Spouse Name',
      'Spouse DOB',
      'Spouse Notes',
      'Emergency Contact',
      'Emergency Contact Relationship',
      'Emergency Contact Phone',
      'Smoker',
      'Has Chronic Conditions',
      'Blood Type',
      'SA Tax Resident',
      'Number of Dependants',
      'Gross Income Range',
      'Monthly Expenses Range',
      'Services Requested',
      'Urgency',
      'Existing Products',
      'Financial Goals',
      'Best Time to Contact',
      'WhatsApp Number',
      'POPIA Consent',
      'FAIS Acknowledged',
      'Electronic Comms Consent',
      'Marketing Consent',
    ],
  },
  'applications-pipeline': {
    label: 'Applications pipeline',
    dateRange: true,
    columns: [
      'Application ID',
      'Applicant Name',
      'Email',
      'Phone',
      'Status',
      'Services Requested',
      'Urgency',
      'Submitted Date',
      'Last Updated',
      'Days Since Submission',
    ],
  },
  'fna-completion': {
    label: 'FNA completion',
    dateRange: true,
    columns: [
      'FNA ID',
      'Type',
      'Status',
      'Client ID',
      'Client Name',
      'Adviser',
      'Created Date',
      'Last Updated',
      'Published Date',
      'Days to Complete',
    ],
  },
  'compliance-audit': {
    label: 'POPIA / FAIS compliance audit',
    dateRange: false,
    columns: [
      'User ID',
      'Client Name',
      'Email',
      'Account Status',
      'POPIA Consent',
      'FAIS Acknowledged',
      'Electronic Comms Consent',
      'Marketing Consent',
      'Compliance Score',
      'Non-Compliant Items',
      'Profile Created',
    ],
  },
  'lifecycle-audit': {
    label: 'Client lifecycle audit',
    dateRange: false,
    columns: [
      'User ID',
      'Client Name',
      'Email',
      'Profile Account Status',
      'Security Deleted',
      'Security Suspended',
      'Derived Status',
      'Issue Type',
      'Severity',
      'Details',
      'Recommended Action',
      'Profile Created',
    ],
  },
};

/** Keep the chosen columns, in the chosen order (missing values become empty). */
export function pickColumns(
  rows: Record<string, unknown>[],
  columns: readonly string[],
): Record<string, unknown>[] {
  return rows.map((row) => Object.fromEntries(columns.map((c) => [c, row[c] ?? ''])));
}

/** A saved custom report as a row of the reports table. */
export function definitionToReport(def: SavedReportDefinition): Report {
  return {
    id: def.id,
    name: def.name,
    description: `${REPORT_SOURCES[def.dataSource]?.label ?? def.dataSource} · ${def.columns.length} ${
      def.columns.length === 1 ? 'column' : 'columns'
    }`,
    category: def.category,
    parameters: { format: def.format },
    outputs: [`${def.dataSource}.xlsx`],
    createdAt: def.createdAt,
    dataSource: def.dataSource,
    columns: def.columns,
    custom: true,
  };
}
