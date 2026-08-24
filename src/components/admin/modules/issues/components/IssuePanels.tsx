/**
 * Section panels of the Issues dashboard: the response queue, the automation
 * watchtower, feed health, the small summary cards, and the loading skeleton.
 * Pure views over the snapshot — IssuesModule owns all state and handlers.
 */
import { Activity, AlertCircle, ArrowUpRight, Clock, Loader2, ShieldAlert } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Skeleton } from '../../../../ui/skeleton';
import {
  getQualityIssueAutomationAlerts,
  isQualityIssuePastResponseSla,
} from '../../../../../shared/quality/qualityIssues';
import { alertSeverityTone, formatDate, getAgeLabel, isStale } from '../issuePresentation';
import type { QualityIssue, QualityIssueSnapshot } from '../types';

export function ActionQueuePanel({ issues }: { issues: QualityIssue[] }) {
  const openIssues = issues.filter((issue) => issue.status === 'open');
  const counts = {
    needsOwner: openIssues.filter((issue) => !issue.ownerName).length,
    readyToPatch: openIssues.filter((issue) => issue.category === 'security' && issue.fixAvailable)
      .length,
    pastTarget: openIssues.filter((issue) => isQualityIssuePastResponseSla(issue)).length,
    reopened: openIssues.filter((issue) => issue.reopenedAt).length,
    verifiedResolved: issues.filter(
      (issue) => issue.status === 'resolved' && issue.resolutionEvidence,
    ).length,
  };

  const cards = [
    {
      title: 'Needs Ownership',
      value: counts.needsOwner,
      description: 'Open issues without an assigned owner',
      tone: counts.needsOwner > 0 ? 'warning' : 'healthy',
    },
    {
      title: 'Ready To Patch',
      value: counts.readyToPatch,
      description: 'Security findings with a published fix',
      tone: counts.readyToPatch > 0 ? 'warning' : 'healthy',
    },
    {
      title: 'Past Target',
      value: counts.pastTarget,
      description: 'Open issues beyond their priority response SLA',
      tone: counts.pastTarget > 0 ? 'warning' : 'healthy',
    },
    {
      title: 'Reopened',
      value: counts.reopened,
      description: 'Resolved fingerprints that appeared again',
      tone: counts.reopened > 0 ? 'warning' : 'healthy',
    },
    {
      title: 'Verified Closures',
      value: counts.verifiedResolved,
      description: 'Resolved issues with evidence attached',
      tone: 'healthy',
    },
  ] as const;

  return (
    <Card className="rounded-xl border border-gray-100 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900">Response Queue</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {cards.map((card) => (
            <div key={card.title} className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-gray-900">{card.title}</p>
                <Badge
                  variant="outline"
                  className={
                    card.tone === 'healthy'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  }
                >
                  {card.tone === 'healthy' ? 'On Track' : 'Action'}
                </Badge>
              </div>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{card.value}</p>
              <p className="mt-2 text-xs text-muted-foreground">{card.description}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AutomationPanel({
  snapshot,
  isRunning,
  onRun,
}: {
  snapshot: QualityIssueSnapshot;
  isRunning: boolean;
  onRun: () => void;
}) {
  const liveAlerts = getQualityIssueAutomationAlerts(snapshot.issues);
  const automation = snapshot.automation;
  const alerts = automation?.alerts?.length ? automation.alerts : liveAlerts;
  const criticalAlerts = alerts.filter((alert) => alert.severity === 'critical').length;
  const previewAlerts = alerts.slice(0, 4);

  return (
    <Card className="rounded-xl border border-gray-100 shadow-sm">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            Automation Watchtower
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Escalates critical, stale, reopened, and fixable security issues into the task workflow.
          </p>
        </div>
        <Button type="button" onClick={onRun} disabled={isRunning} className="h-10">
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldAlert className="h-4 w-4" />
          )}
          Run automation
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Active alerts</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{alerts.length}</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Critical alerts</p>
            <p className="mt-2 text-3xl font-semibold text-red-800">{criticalAlerts}</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Tasks created</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {automation?.tasksCreated ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Last run</p>
            <p className="mt-2 text-sm font-medium text-gray-900">
              {automation?.runAt ? formatDate(automation.runAt) : 'Not run yet'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {automation?.runBy || 'Waiting for automation'}
            </p>
          </div>
        </div>

        {previewAlerts.length > 0 ? (
          <div className="space-y-3">
            {previewAlerts.map((alert, index) => (
              <div
                key={`${alert.id}:${alert.createdAt}:${index}`}
                className="rounded-lg border border-gray-100 bg-white p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{alert.title}</p>
                    <p className="mt-1 text-sm text-gray-600">{alert.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{alert.actionLabel}</p>
                  </div>
                  <Badge variant="outline" className={alertSeverityTone(alert)}>
                    {alert.severity}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-800">
            No automation alerts are active for the current issue snapshot.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FeedHealthPanel({ snapshot }: { snapshot: QualityIssueSnapshot }) {
  const bySource = snapshot.summary.bySource;
  const byCategory = snapshot.summary.byCategory;
  const byPriority = snapshot.summary.byPriority;
  const ciFindings = bySource.build + bySource.test + bySource.audit + bySource.accessibility;
  const securityFindings = byCategory?.security ?? bySource.audit;
  const criticalFindings = byPriority?.critical ?? 0;
  const fixableSecurityFindings = snapshot.issues.filter(
    (issue) => issue.category === 'security' && issue.fixAvailable,
  ).length;
  const securityFeedCount = new Set(
    snapshot.issues
      .filter((issue) => issue.category === 'security')
      .map((issue) => issue.detectedBy || 'unknown'),
  ).size;
  const runtimeIssues = snapshot.issues.filter(
    (issue) => issue.source === 'runtime-client' || issue.source === 'runtime-server',
  );
  const latestRuntimeSeenAt = runtimeIssues
    .map((issue) => issue.lastSeenAt)
    .sort((a, b) => b.localeCompare(a))[0];

  const feeds = [
    {
      title: 'CI Quality Snapshot',
      description: `${ciFindings} build, test, audit, and accessibility finding${ciFindings === 1 ? '' : 's'}`,
      detail: getAgeLabel(snapshot.generatedAt),
      icon: Activity,
      tone: isStale(snapshot.generatedAt) ? 'warning' : 'healthy',
    },
    {
      title: 'Runtime Reporting',
      description:
        runtimeIssues.length > 0
          ? `${runtimeIssues.length} client/server runtime issue${runtimeIssues.length === 1 ? '' : 's'} captured`
          : 'Listening for authenticated client and server runtime errors',
      detail: latestRuntimeSeenAt ? getAgeLabel(latestRuntimeSeenAt) : 'No runtime issues captured',
      icon: Clock,
      tone: 'healthy',
    },
    {
      title: 'Security Baseline',
      description: `${securityFindings} security finding${securityFindings === 1 ? '' : 's'} across ${securityFeedCount} feed${securityFeedCount === 1 ? '' : 's'}`,
      detail:
        securityFindings > 0
          ? `${fixableSecurityFindings} fixable now, ${criticalFindings} critical priority`
          : 'No critical security findings in latest snapshot',
      icon: ShieldAlert,
      tone: securityFindings > 0 ? 'warning' : 'healthy',
    },
  ] as const;

  return (
    <Card className="rounded-xl border border-gray-100 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900">Feed Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {feeds.map((feed) => (
            <div key={feed.title} className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-gray-100 shadow-sm">
                    <feed.icon className="h-4 w-4 text-gray-700" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{feed.title}</p>
                    <p className="mt-1 text-sm text-gray-600">{feed.description}</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    feed.tone === 'healthy'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  }
                >
                  {feed.tone === 'healthy' ? 'Active' : 'Review'}
                </Badge>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{feed.detail}</p>
            </div>
          ))}
        </div>
        {snapshot.runUrl ? (
          <a
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-purple-700 hover:text-purple-800"
            href={snapshot.runUrl}
            target="_blank"
            rel="noreferrer"
          >
            View latest quality run
            <ArrowUpRight className="h-4 w-4" />
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <Card className="rounded-xl border border-gray-100 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">{label}</p>
          <AlertCircle className="h-4 w-4 text-gray-400" />
        </div>
        <p className={`mt-3 text-3xl font-semibold ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export function IssuesModuleLoading() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-32" />
      <Skeleton className="h-96" />
    </div>
  );
}
