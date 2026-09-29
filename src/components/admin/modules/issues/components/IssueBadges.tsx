/**
 * Small presentational pieces for a single quality issue: its priority and
 * workflow badges, the signal badges that flag what needs attention, and the
 * "What happened" block in the review sheet. Pure views — every input
 * arrives via props.
 */
import type { ReactNode } from 'react';
import { Badge } from '../../../../ui/badge';
import { isQualityIssuePastResponseSla } from '../../../../../shared/quality/qualityIssues';
import { describeStoredIssue } from '../../../../../shared/quality/issueLabels';
import { priorityLabels, priorityTone, statusLabels, statusTone } from '../issuePresentation';
import type { QualityIssue, QualityIssuePriority, QualityIssueStatus } from '../types';

/**
 * A small section heading for the review sheet. An ARIA heading rather than an
 * <h3>: globals.css forces every h3 to 1.25rem with !important, which would
 * make each section label larger than the sheet's own title.
 */
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <p role="heading" aria-level={3} className="text-sm font-semibold text-gray-900">
      {children}
    </p>
  );
}

export function PriorityBadge({ priority }: { priority: QualityIssuePriority }) {
  return (
    <Badge variant="outline" className={priorityTone[priority]}>
      {priorityLabels[priority]}
    </Badge>
  );
}

export function WorkflowBadge({ status }: { status: QualityIssueStatus }) {
  return (
    <Badge variant="outline" className={statusTone[status]}>
      {statusLabels[status]}
    </Badge>
  );
}

/**
 * Only the exceptions: overdue, reopened after a fix, or a security fix
 * waiting to be applied. An issue with nothing unusual shows nothing.
 */
export function IssueSignalBadges({ issue }: { issue: QualityIssue }) {
  const isOverdue = isQualityIssuePastResponseSla(issue);
  const hasPendingFix =
    issue.status !== 'resolved' && issue.category === 'security' && issue.fixAvailable;

  if (!isOverdue && !issue.reopenedAt && !hasPendingFix) return null;

  return (
    <>
      {isOverdue ? (
        <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
          Overdue
        </Badge>
      ) : null}
      {issue.reopenedAt ? (
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
          Reopened
          {issue.regressionCount && issue.regressionCount > 1 ? ` ×${issue.regressionCount}` : ''}
        </Badge>
      ) : null}
      {hasPendingFix ? (
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          Fix available
        </Badge>
      ) : null}
    </>
  );
}

/**
 * The diagnosis in the review sheet: what happened in plain English, the raw
 * message, the usual cause, what the user was doing, and the technical detail
 * folded away underneath.
 */
export function IssueDiagnosis({ issue }: { issue: QualityIssue }) {
  const labels = describeStoredIssue(issue);
  const message = labels.text && labels.text !== labels.summary ? labels.text : null;

  if (
    !labels.summary &&
    !message &&
    !labels.likelyCause &&
    !issue.breadcrumbs?.length &&
    !labels.details
  ) {
    return null;
  }

  return (
    <section className="space-y-3">
      <SectionHeading>What happened</SectionHeading>
      {labels.summary ? <p className="text-sm text-gray-700">{labels.summary}</p> : null}
      {message ? (
        <p className="rounded-lg border border-gray-100 bg-gray-50 p-3 font-mono text-xs break-words whitespace-pre-wrap text-gray-800">
          {message}
        </p>
      ) : null}
      {labels.likelyCause ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm">
          <p className="text-sm font-medium text-blue-900">Likely cause</p>
          <p className="mt-1 text-sm text-blue-900/90">{labels.likelyCause}</p>
        </div>
      ) : null}
      {issue.breadcrumbs?.length ? (
        <details className="rounded-lg border border-gray-100 p-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">
            What the user did before it ({issue.breadcrumbs.length})
          </summary>
          <ol className="mt-2 space-y-1 font-mono text-xs text-gray-700">
            {issue.breadcrumbs.map((crumb, index) => (
              <li key={`${index}-${crumb}`} className="break-words">
                {crumb}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      {labels.details ? (
        <details className="rounded-lg border border-gray-100 p-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">
            Technical details
          </summary>
          <pre className="mt-2 max-h-96 overflow-auto text-xs break-words whitespace-pre-wrap text-gray-700">
            {labels.details}
          </pre>
        </details>
      ) : null}
    </section>
  );
}
