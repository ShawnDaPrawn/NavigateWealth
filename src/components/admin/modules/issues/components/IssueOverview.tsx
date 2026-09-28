/**
 * The top of the Issue Manager page: when the CI checks last reported, the
 * four summary cards that switch the list between views, and the banner that
 * appears only when something needs escalating. Pure views — IssuesModule
 * owns the state and handlers.
 */
import { AlertTriangle, ArrowUpRight, Loader2 } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { cn } from '../../../../ui/utils';
import {
  describeReportSource,
  formatDate,
  formatRelativeTime,
  isStale,
  issueViewConfig,
  pluralize,
} from '../issuePresentation';
import { ISSUE_VIEWS, type IssueEscalationSummary, type IssueView } from '../issueViews';
import type { QualityIssueSnapshot } from '../types';

export function ReportFreshness({ snapshot }: { snapshot: QualityIssueSnapshot }) {
  const stale = isStale(snapshot.generatedAt);
  const source = describeReportSource(snapshot.branch);

  return (
    <p
      className={cn(
        'mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm',
        stale ? 'text-amber-700' : 'text-gray-500',
      )}
    >
      <span className="inline-flex items-start gap-1.5" title={formatDate(snapshot.generatedAt)}>
        {stale ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : null}
        {stale
          ? `No CI report since ${formatDate(snapshot.generatedAt)} — the quality feed may have stopped`
          : `Latest CI report ${formatRelativeTime(snapshot.generatedAt)}`}
      </span>
      {source ? <span aria-hidden="true">·</span> : null}
      {source ? <span>{source}</span> : null}
      {snapshot.runUrl ? (
        <>
          <span aria-hidden="true">·</span>
          <a
            href={snapshot.runUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 font-medium text-purple-700 hover:text-purple-800"
          >
            View run
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </>
      ) : null}
    </p>
  );
}

export function IssueViewCards({
  counts,
  activeView,
  onSelect,
}: {
  counts: Record<IssueView, number>;
  activeView: IssueView;
  onSelect: (view: IssueView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter issues by view"
      className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
    >
      {ISSUE_VIEWS.map((view) => {
        const config = issueViewConfig[view];
        const Icon = config.icon;
        const isActive = view === activeView;

        return (
          <button
            key={view}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(view)}
            className={cn(
              'flex flex-col rounded-xl border bg-white p-5 text-left shadow-sm transition focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:outline-none',
              isActive
                ? 'border-purple-300 ring-2 ring-purple-100'
                : 'border-gray-100 hover:border-gray-200 hover:shadow-md',
            )}
          >
            <span className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">{config.label}</span>
              <span className={cn('rounded-lg p-2', config.iconTone)}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            </span>
            <span className="block text-3xl font-bold text-gray-900">{counts[view]}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{config.description}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Replaces the old always-on "Automation Watchtower": says nothing when
 * nothing needs escalating, and otherwise names what does and offers the one
 * action that helps — creating the missing remediation tasks.
 */
export function AttentionBanner({
  summary,
  isRunning,
  onCreateTasks,
}: {
  summary: IssueEscalationSummary;
  isRunning: boolean;
  onCreateTasks: () => void;
}) {
  if (summary.issues === 0) return null;

  const reasons = [
    summary.critical > 0 ? `${summary.critical} critical` : null,
    summary.overdue > 0 ? `${summary.overdue} overdue` : null,
    summary.reopened > 0 ? `${summary.reopened} reopened after a fix` : null,
    summary.fixAvailable > 0 ? `${summary.fixAvailable} with a security fix ready to apply` : null,
  ].filter(Boolean);

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between',
        summary.hasCritical ? 'border-red-200 bg-red-50/70' : 'border-amber-200 bg-amber-50/70',
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className={cn(
            'mt-0.5 h-5 w-5 shrink-0',
            summary.hasCritical ? 'text-red-600' : 'text-amber-600',
          )}
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {pluralize(summary.issues, 'issue')} {summary.issues === 1 ? 'needs' : 'need'} attention
          </p>
          <p className="mt-0.5 text-sm text-gray-700">
            {reasons.join(' · ')}.{' '}
            {summary.withoutTask > 0
              ? `${summary.withoutTask} ${summary.withoutTask === 1 ? 'has' : 'have'} no remediation task yet.`
              : 'Each one already has a remediation task.'}
          </p>
        </div>
      </div>
      {summary.withoutTask > 0 ? (
        <Button type="button" onClick={onCreateTasks} disabled={isRunning} className="shrink-0">
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Create {pluralize(summary.withoutTask, 'task')}
        </Button>
      ) : null}
    </div>
  );
}
