/**
 * Row-level presentational pieces for a single quality issue: its location,
 * workflow badge, signal badges, and the expanded detail block. Pure views —
 * every input arrives via props.
 */
import { ArrowUpRight } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { isQualityIssuePastResponseSla } from '../../../../../shared/quality/qualityIssues';
import { formatCvssScore, severityTone, statusLabels, statusTone } from '../issuePresentation';
import type { QualityIssue, QualityIssueStatus } from '../types';

export function IssueLocation({ issue }: { issue: QualityIssue }) {
  if (!issue.filePath) return <span className="text-muted-foreground">Repository</span>;

  const suffix = [
    typeof issue.line === 'number' ? issue.line : null,
    typeof issue.column === 'number' ? issue.column : null,
  ]
    .filter(Boolean)
    .join(':');

  return (
    <code className="text-xs text-gray-700 break-all">
      {issue.filePath}
      {suffix ? `:${suffix}` : ''}
    </code>
  );
}

export function WorkflowBadge({ status }: { status: QualityIssueStatus }) {
  return (
    <Badge variant="outline" className={statusTone[status]}>
      {statusLabels[status]}
    </Badge>
  );
}

export function IssueSignalBadges({ issue }: { issue: QualityIssue }) {
  const isPastTarget = isQualityIssuePastResponseSla(issue);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isPastTarget ? (
        <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
          Past target
        </Badge>
      ) : null}
      {issue.reopenedAt ? (
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
          Reopened{issue.regressionCount ? ` x${issue.regressionCount}` : ''}
        </Badge>
      ) : null}
      {issue.resolutionEvidence ? (
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          Evidence captured
        </Badge>
      ) : null}
    </div>
  );
}

export function IssueDetails({ issue }: { issue: QualityIssue }) {
  const cvssScore = formatCvssScore(issue.cvssScore);

  return (
    <>
      <div className="font-medium text-gray-900">{issue.title}</div>
      <div className="mt-1 text-gray-600">{issue.message}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={severityTone[issue.severity]}>
          {issue.severity}
        </Badge>
        {issue.ruleId ? <span className="text-xs text-gray-500">{issue.ruleId}</span> : null}
        {issue.component ? <span className="text-xs text-gray-500">{issue.component}</span> : null}
        {issue.packageName ? (
          <span className="text-xs text-gray-500">
            {issue.packageName}
            {issue.packageVersion ? `@${issue.packageVersion}` : ''}
          </span>
        ) : null}
        {issue.detectedBy ? (
          <span className="text-xs text-gray-500">{issue.detectedBy}</span>
        ) : null}
        {cvssScore ? <span className="text-xs text-gray-500">CVSS {cvssScore}</span> : null}
        {issue.fixAvailable ? (
          <span className="text-xs text-emerald-700">
            Fix available{issue.fixVersion ? `: ${issue.fixVersion}` : ''}
          </span>
        ) : null}
        {issue.category === 'security' && issue.fixAvailable === false ? (
          <span className="text-xs text-amber-700">No fix published yet</span>
        ) : null}
      </div>
      {issue.advisoryId || issue.cve || issue.referenceUrl || issue.vulnerableRange ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
          {issue.advisoryId ? <span>Advisory: {issue.advisoryId}</span> : null}
          {issue.cve ? <span>{issue.cve}</span> : null}
          {issue.vulnerableRange ? <span>Range: {issue.vulnerableRange}</span> : null}
          {issue.referenceUrl ? (
            <a
              className="inline-flex items-center gap-1 text-purple-700 hover:text-purple-800"
              href={issue.referenceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Reference
              <ArrowUpRight className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
