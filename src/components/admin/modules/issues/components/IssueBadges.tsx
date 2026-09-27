/**
 * Row-level presentational pieces for a single quality issue: its location,
 * workflow badge, signal badges, and the expanded detail block. Pure views —
 * every input arrives via props.
 */
import { ArrowUpRight } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { isQualityIssuePastResponseSla } from '../../../../../shared/quality/qualityIssues';
import { describeStoredIssue } from '../../../../../shared/quality/issueLabels';
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
  const labels = describeStoredIssue(issue);

  return (
    <>
      <div className="font-medium text-gray-900">{labels.title}</div>
      <div className="mt-1 line-clamp-3 text-gray-600">{labels.summary || labels.text}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={severityTone[issue.severity]}>
          {issue.severity}
        </Badge>
        {labels.area ? <span className="text-xs text-gray-500">{labels.area}</span> : null}
        {issue.occurrences > 1 ? (
          <span className="text-xs text-gray-500">{issue.occurrences}× seen</span>
        ) : null}
        {issue.affectedUsers ? (
          <span className="text-xs text-gray-500">
            {issue.affectedUsers} user{issue.affectedUsers === 1 ? '' : 's'}
          </span>
        ) : null}
        {issue.anonymous ? (
          <span className="text-xs text-gray-500">signed-out visitors</span>
        ) : null}
        {issue.ruleId && !labels.area ? (
          <span className="text-xs text-gray-500">{issue.ruleId}</span>
        ) : null}
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

/**
 * The diagnosis block in the review sheet: what happened in plain English, the
 * usual cause, what the user was doing, and the raw technical detail folded
 * away underneath.
 */
export function IssueDiagnosis({ issue }: { issue: QualityIssue }) {
  const labels = describeStoredIssue(issue);
  const hasDiagnosis =
    !!labels.summary || !!labels.likelyCause || !!issue.breadcrumbs?.length || !!labels.details;
  if (!hasDiagnosis) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">What Happened</h2>
      {labels.summary ? <p className="text-sm text-gray-700">{labels.summary}</p> : null}
      {labels.text && labels.text !== labels.summary ? (
        <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Error message</p>
          <p className="mt-1 break-words font-mono text-xs text-gray-800">{labels.text}</p>
        </div>
      ) : null}
      {labels.likelyCause ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm">
          <p className="text-xs uppercase tracking-wide text-blue-700">Likely cause</p>
          <p className="mt-1 text-blue-900">{labels.likelyCause}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 text-xs text-gray-600">
        {labels.area ? (
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
            {labels.area}
          </Badge>
        ) : null}
        {issue.route ? (
          <Badge
            variant="outline"
            className="border-slate-200 bg-slate-50 font-mono text-slate-700"
          >
            {issue.route}
          </Badge>
        ) : null}
        {issue.affectedUsers ? (
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
            {issue.affectedUsers} user{issue.affectedUsers === 1 ? '' : 's'} affected
          </Badge>
        ) : null}
        {issue.anonymous ? (
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
            Signed-out visitors
          </Badge>
        ) : null}
      </div>
      {issue.breadcrumbs?.length ? (
        <div className="rounded-lg border border-gray-100 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Leading up to it (most recent last)
          </p>
          <ol className="mt-2 space-y-1 font-mono text-xs text-gray-700">
            {issue.breadcrumbs.map((crumb, index) => (
              <li key={`${index}-${crumb}`} className="break-words">
                {crumb}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {labels.details ? (
        <details className="rounded-lg border border-gray-100 bg-white p-3">
          <summary className="cursor-pointer text-xs uppercase tracking-wide text-gray-500">
            Technical details
          </summary>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-700">
            {labels.details}
          </pre>
        </details>
      ) : null}
    </section>
  );
}
