/**
 * The top of the Issue Manager page: when the CI checks last reported, the
 * four view tabs (with counts) that switch the list, and the notice that
 * appears only when something needs escalating. Pure views — IssuesModule
 * owns the state and handlers.
 */
import { AlertTriangle, ArrowUpRight, Loader2 } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { cn } from '../../../../ui/utils';
import { Tabs } from '../../../../ui/tabs';
import { NavTabsList, NavTabsTrigger, Notice } from '../../../layout/page';
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

/**
 * The four views as underline tabs with counts; the active view's caption
 * sits under the tabs. The tab content is the list below (one TabsContent is
 * not needed: the list re-renders for the active view).
 */
export function IssueViewTabs({
  counts,
  activeView,
  onSelect,
}: {
  counts: Record<IssueView, number>;
  activeView: IssueView;
  onSelect: (view: IssueView) => void;
}) {
  return (
    <div className="space-y-2">
      <Tabs value={activeView} onValueChange={(value) => onSelect(value as IssueView)}>
        <NavTabsList aria-label="Issue views">
          {ISSUE_VIEWS.map((view) => (
            <NavTabsTrigger key={view} value={view} count={counts[view]}>
              {issueViewConfig[view].label}
            </NavTabsTrigger>
          ))}
        </NavTabsList>
      </Tabs>
      <p className="text-sm text-nw-text-3">{issueViewConfig[activeView].description}</p>
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
    <Notice
      kind={summary.hasCritical ? 'error' : 'attention'}
      title={`${pluralize(summary.issues, 'issue')} ${summary.issues === 1 ? 'needs' : 'need'} attention —`}
      action={
        summary.withoutTask > 0 ? (
          <Button type="button" size="sm" onClick={onCreateTasks} disabled={isRunning}>
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Create {pluralize(summary.withoutTask, 'task')}
          </Button>
        ) : null
      }
    >
      {reasons.join(', ')}.{' '}
      {summary.withoutTask > 0
        ? `${summary.withoutTask} ${summary.withoutTask === 1 ? 'has' : 'have'} no remediation task yet.`
        : 'Each one already has a remediation task.'}
    </Notice>
  );
}
