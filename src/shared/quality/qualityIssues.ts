export type QualityIssueSeverity = 'error' | 'warning' | 'info';

export type QualityIssueSource =
  | 'build'
  | 'test'
  | 'audit'
  | 'accessibility'
  | 'runtime-client'
  | 'runtime-server';

export type QualityIssueStatus = 'open' | 'acknowledged' | 'resolved';

export interface QualityIssue {
  id: string;
  source: QualityIssueSource;
  severity: QualityIssueSeverity;
  status: QualityIssueStatus;
  title: string;
  message: string;
  filePath?: string;
  line?: number;
  column?: number;
  ruleId?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrences: number;
  runUrl?: string;
}

export interface QualityIssueSummary {
  total: number;
  open: number;
  errors: number;
  warnings: number;
  bySource: Record<QualityIssueSource, number>;
}

export interface QualityIssueSnapshot {
  generatedAt: string;
  runId?: string;
  runUrl?: string;
  branch?: string;
  commitSha?: string;
  issues: QualityIssue[];
  summary: QualityIssueSummary;
}

export const QUALITY_ISSUE_SOURCES: QualityIssueSource[] = [
  'build',
  'test',
  'audit',
  'accessibility',
  'runtime-client',
  'runtime-server',
];

export function createEmptyQualityIssueSummary(): QualityIssueSummary {
  return {
    total: 0,
    open: 0,
    errors: 0,
    warnings: 0,
    bySource: {
      build: 0,
      test: 0,
      audit: 0,
      accessibility: 0,
      'runtime-client': 0,
      'runtime-server': 0,
    },
  };
}

export function summarizeQualityIssues(issues: QualityIssue[]): QualityIssueSummary {
  return issues.reduce<QualityIssueSummary>((summary, issue) => {
    summary.total += 1;
    if (issue.status === 'open') summary.open += 1;
    if (issue.severity === 'error') summary.errors += 1;
    if (issue.severity === 'warning') summary.warnings += 1;
    summary.bySource[issue.source] += 1;
    return summary;
  }, createEmptyQualityIssueSummary());
}

export function createEmptyQualityIssueSnapshot(): QualityIssueSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    issues: [],
    summary: createEmptyQualityIssueSummary(),
  };
}
