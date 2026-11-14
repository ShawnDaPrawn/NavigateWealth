/**
 * The issue list: one row per issue with what it is, how urgent, where it
 * stands, who owns it and when it last happened. Clicking anywhere on a row
 * opens it; the title is the keyboard-reachable control for the same thing.
 */
import { ListChecks } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import { cn } from '../../../../ui/utils';
import { describeStoredIssue } from '../../../../../shared/quality/issueLabels';
import {
  formatDate,
  formatIssueLocation,
  formatRelativeTime,
  pluralize,
  sourceLabels,
} from '../issuePresentation';
import type { QualityIssue } from '../types';
import { IssueSignalBadges, PriorityBadge, WorkflowBadge } from './IssueBadges';

function describeIssueContext(issue: QualityIssue, area?: string) {
  const parts = [sourceLabels[issue.source]];
  const where = area || formatIssueLocation(issue) || issue.route;
  if (where) parts.push(where);
  if (issue.packageName) {
    parts.push(`${issue.packageName}${issue.packageVersion ? `@${issue.packageVersion}` : ''}`);
  }
  if (issue.occurrences > 1) parts.push(pluralize(issue.occurrences, 'time'));
  if (issue.affectedUsers) parts.push(pluralize(issue.affectedUsers, 'user'));
  else if (issue.anonymous) parts.push('signed-out visitors');
  return parts;
}

function IssueRow({ issue, onSelect }: { issue: QualityIssue; onSelect: () => void }) {
  const labels = describeStoredIssue(issue);
  const summary = labels.summary || labels.text;

  return (
    <TableRow onClick={onSelect} className="cursor-pointer align-top hover:bg-gray-50/80">
      <TableCell className="py-4 pl-4 whitespace-normal sm:pl-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
            className="rounded-sm text-left text-sm font-medium wrap-anywhere text-gray-900 hover:text-purple-700 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
          >
            {labels.title}
          </button>
          <IssueSignalBadges issue={issue} />
        </div>
        {summary && summary !== labels.title ? (
          <p className="mt-1 line-clamp-1 max-w-3xl text-sm text-gray-600">{summary}</p>
        ) : null}
        <p className="mt-1 text-xs wrap-anywhere text-gray-500">
          {describeIssueContext(issue, labels.area).join(' · ')}
        </p>
        {/* On a phone the other columns are hidden; their essentials sit here. */}
        <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
          <PriorityBadge priority={issue.priority} />
          <WorkflowBadge status={issue.status} />
          <span className="text-xs text-gray-500">
            {issue.ownerName || 'Unassigned'} · {formatRelativeTime(issue.lastSeenAt)}
          </span>
        </div>
      </TableCell>
      <TableCell className="hidden py-4 sm:table-cell">
        <PriorityBadge priority={issue.priority} />
      </TableCell>
      <TableCell className="hidden py-4 sm:table-cell">
        <WorkflowBadge status={issue.status} />
        {issue.status === 'resolved' && !issue.resolutionEvidence ? (
          <p className="mt-1.5 text-xs text-amber-700">No evidence</p>
        ) : null}
      </TableCell>
      <TableCell className="hidden py-4 whitespace-normal sm:table-cell">
        <p className={cn('text-sm', issue.ownerName ? 'text-gray-900' : 'text-gray-400')}>
          {issue.ownerName || 'Unassigned'}
        </p>
        {issue.linkedTaskId ? (
          <a
            href="/admin?module=tasks"
            onClick={(event) => event.stopPropagation()}
            title={issue.linkedTaskTitle}
            className="mt-1 inline-flex items-center gap-1 text-xs text-purple-700 hover:text-purple-800"
          >
            <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
            Task linked
          </a>
        ) : null}
      </TableCell>
      <TableCell className="hidden py-4 pr-6 text-right text-gray-600 sm:table-cell">
        <span title={formatDate(issue.lastSeenAt)}>{formatRelativeTime(issue.lastSeenAt)}</span>
      </TableCell>
    </TableRow>
  );
}

export function IssueTable({
  issues,
  onSelect,
}: {
  issues: QualityIssue[];
  onSelect: (fingerprint: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-gray-50/60 text-xs tracking-wide text-gray-500 uppercase hover:bg-gray-50/60">
          <TableHead className="pl-4 text-gray-500 sm:pl-6">Issue</TableHead>
          <TableHead className="hidden w-28 text-gray-500 sm:table-cell">Priority</TableHead>
          <TableHead className="hidden w-36 text-gray-500 sm:table-cell">Status</TableHead>
          <TableHead className="hidden w-44 text-gray-500 sm:table-cell">Owner</TableHead>
          <TableHead className="hidden w-32 pr-6 text-right text-gray-500 sm:table-cell">
            Last seen
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => (
          <IssueRow key={issue.id} issue={issue} onSelect={() => onSelect(issue.fingerprint)} />
        ))}
      </TableBody>
    </Table>
  );
}
