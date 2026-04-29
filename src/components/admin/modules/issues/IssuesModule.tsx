import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { Separator } from '../../../ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../../ui/sheet';
import { Skeleton } from '../../../ui/skeleton';
import { Textarea } from '../../../ui/textarea';
import {
  createQualityIssueRemediationTask,
  fetchQualityIssuesSnapshot,
  runQualityIssueAutomation,
  updateQualityIssueWorkflow,
} from './api';
import {
  applyQualityIssueWorkflow,
  getQualityIssueAutomationAlerts,
  getQualityIssueResponseSlaHours,
  isQualityIssuePastResponseSla,
  QUALITY_ISSUE_CATEGORIES,
  QUALITY_ISSUE_PRIORITIES,
  QUALITY_ISSUE_SOURCES,
  recommendQualityIssueActions,
  summarizeQualityIssues,
} from '../../../../shared/quality/qualityIssues';
import { pendingCountsKeys } from '../../../../utils/queryKeys';
import type {
  QualityIssue,
  QualityIssueAlert,
  QualityIssueCategory,
  QualityIssuePriority,
  QualityIssueSeverity,
  QualityIssueSnapshot,
  QualityIssueSource,
  QualityIssueStatus,
  QualityIssueWorkflowState,
} from './types';

const severityTone: Record<QualityIssueSeverity, string> = {
  error: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
};

const priorityTone: Record<QualityIssuePriority, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-50 text-slate-700 border-slate-200',
};

const statusTone: Record<QualityIssueStatus, string> = {
  open: 'bg-red-50 text-red-700 border-red-200',
  acknowledged: 'bg-blue-50 text-blue-700 border-blue-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const sourceLabels: Record<QualityIssueSource, string> = {
  build: 'Build',
  test: 'Tests',
  audit: 'Security Audit',
  accessibility: 'Accessibility',
  'runtime-client': 'Client Runtime',
  'runtime-server': 'Server Runtime',
};

const categoryLabels: Record<QualityIssueCategory, string> = {
  build: 'Build',
  test: 'Test',
  security: 'Security',
  accessibility: 'Accessibility',
  runtime: 'Runtime',
  configuration: 'Configuration',
  unknown: 'Unknown',
};

const priorityLabels: Record<QualityIssuePriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const statusLabels: Record<QualityIssueStatus, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
};

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const STALE_FEED_MS = 36 * ONE_HOUR_MS;

function formatDate(value?: string) {
  if (!value) return 'Not run yet';
  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getAgeLabel(value?: string) {
  if (!value) return 'No data yet';

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Unknown age';

  const diff = Math.max(0, Date.now() - timestamp);
  if (diff < ONE_HOUR_MS) return 'Updated less than 1 hour ago';
  if (diff < ONE_DAY_MS) {
    const hours = Math.floor(diff / ONE_HOUR_MS);
    return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(diff / ONE_DAY_MS);
  return `Updated ${days} day${days === 1 ? '' : 's'} ago`;
}

function isStale(value?: string) {
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  return !Number.isFinite(timestamp) || Date.now() - timestamp > STALE_FEED_MS;
}

function formatCvssScore(value?: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(1)
    : null;
}

function mergeWorkflowIntoSnapshot(
  snapshot: QualityIssueSnapshot | null,
  workflow: QualityIssueWorkflowState,
): QualityIssueSnapshot | null {
  if (!snapshot) return snapshot;

  const issues = snapshot.issues.map((issue) =>
    issue.fingerprint === workflow.fingerprint
      ? applyQualityIssueWorkflow(issue, workflow)
      : issue,
  );

  return {
    ...snapshot,
    issues,
    summary: summarizeQualityIssues(issues),
  };
}

function IssueLocation({ issue }: { issue: QualityIssue }) {
  if (!issue.filePath) return <span className="text-muted-foreground">Repository</span>;

  const suffix = [
    typeof issue.line === 'number' ? issue.line : null,
    typeof issue.column === 'number' ? issue.column : null,
  ].filter(Boolean).join(':');

  return (
    <code className="text-xs text-gray-700 break-all">
      {issue.filePath}{suffix ? `:${suffix}` : ''}
    </code>
  );
}

function WorkflowBadge({ status }: { status: QualityIssueStatus }) {
  return (
    <Badge variant="outline" className={statusTone[status]}>
      {statusLabels[status]}
    </Badge>
  );
}

function IssueSignalBadges({ issue }: { issue: QualityIssue }) {
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

function IssueDetails({ issue }: { issue: QualityIssue }) {
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
            {issue.packageName}{issue.packageVersion ? `@${issue.packageVersion}` : ''}
          </span>
        ) : null}
        {issue.detectedBy ? <span className="text-xs text-gray-500">{issue.detectedBy}</span> : null}
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
      {(issue.advisoryId || issue.cve || issue.referenceUrl || issue.vulnerableRange) ? (
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

function ActionQueuePanel({ issues }: { issues: QualityIssue[] }) {
  const openIssues = issues.filter((issue) => issue.status === 'open');
  const counts = {
    needsOwner: openIssues.filter((issue) => !issue.ownerName).length,
    readyToPatch: openIssues.filter((issue) => issue.category === 'security' && issue.fixAvailable).length,
    pastTarget: openIssues.filter((issue) => isQualityIssuePastResponseSla(issue)).length,
    reopened: openIssues.filter((issue) => issue.reopenedAt).length,
    verifiedResolved: issues.filter((issue) => issue.status === 'resolved' && issue.resolutionEvidence).length,
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

function alertSeverityTone(alert: QualityIssueAlert) {
  return alert.severity === 'critical'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-amber-200 bg-amber-50 text-amber-700';
}

function AutomationPanel({
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
          <CardTitle className="text-xl font-semibold text-gray-900">Automation Watchtower</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Escalates critical, stale, reopened, and fixable security issues into the task workflow.
          </p>
        </div>
        <Button
          type="button"
          onClick={onRun}
          disabled={isRunning}
          className="h-10"
        >
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
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
            <p className="mt-2 text-3xl font-semibold text-slate-950">{automation?.tasksCreated ?? 0}</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Last run</p>
            <p className="mt-2 text-sm font-medium text-gray-900">
              {automation?.runAt ? formatDate(automation.runAt) : 'Not run yet'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{automation?.runBy || 'Waiting for automation'}</p>
          </div>
        </div>

        {previewAlerts.length > 0 ? (
          <div className="space-y-3">
            {previewAlerts.map((alert) => (
              <div key={alert.id} className="rounded-lg border border-gray-100 bg-white p-4">
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

function FeedHealthPanel({ snapshot }: { snapshot: QualityIssueSnapshot }) {
  const bySource = snapshot.summary.bySource;
  const byCategory = snapshot.summary.byCategory;
  const byPriority = snapshot.summary.byPriority;
  const ciFindings =
    bySource.build + bySource.test + bySource.audit + bySource.accessibility;
  const securityFindings = byCategory?.security ?? bySource.audit;
  const criticalFindings = byPriority?.critical ?? 0;
  const fixableSecurityFindings = snapshot.issues.filter((issue) =>
    issue.category === 'security' && issue.fixAvailable
  ).length;
  const securityFeedCount = new Set(
    snapshot.issues
      .filter((issue) => issue.category === 'security')
      .map((issue) => issue.detectedBy || 'unknown')
  ).size;
  const runtimeIssues = snapshot.issues.filter((issue) =>
    issue.source === 'runtime-client' || issue.source === 'runtime-server'
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
      description: runtimeIssues.length > 0
        ? `${runtimeIssues.length} client/server runtime issue${runtimeIssues.length === 1 ? '' : 's'} captured`
        : 'Listening for authenticated client and server runtime errors',
      detail: latestRuntimeSeenAt ? getAgeLabel(latestRuntimeSeenAt) : 'No runtime issues captured',
      icon: Clock,
      tone: 'healthy',
    },
    {
      title: 'Security Baseline',
      description: `${securityFindings} security finding${securityFindings === 1 ? '' : 's'} across ${securityFeedCount} feed${securityFeedCount === 1 ? '' : 's'}`,
      detail: securityFindings > 0
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

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
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

function IssuesModuleLoading() {
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

export function IssuesModule() {
  const queryClient = useQueryClient();
  const [snapshot, setSnapshot] = useState<QualityIssueSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<'all' | QualityIssueSource>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | QualityIssueCategory>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | QualityIssuePriority>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | QualityIssueSeverity>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | QualityIssueStatus>('all');
  const [selectedFingerprint, setSelectedFingerprint] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<QualityIssueStatus>('open');
  const [draftOwnerName, setDraftOwnerName] = useState('');
  const [draftStatusNote, setDraftStatusNote] = useState('');
  const [draftResolutionEvidence, setDraftResolutionEvidence] = useState('');
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isRunningAutomation, setIsRunningAutomation] = useState(false);

  async function loadIssues() {
    try {
      setIsLoading(true);
      setError(null);
      setSnapshot(await fetchQualityIssuesSnapshot());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load quality issues.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadIssues();
  }, []);

  const filteredIssues = useMemo(() => {
    return (snapshot?.issues || []).filter((issue) => {
      const matchesSource = sourceFilter === 'all' || issue.source === sourceFilter;
      const matchesCategory = categoryFilter === 'all' || issue.category === categoryFilter;
      const matchesPriority = priorityFilter === 'all' || issue.priority === priorityFilter;
      const matchesSeverity = severityFilter === 'all' || issue.severity === severityFilter;
      const matchesStatus = statusFilter === 'all' || issue.status === statusFilter;
      return matchesSource && matchesCategory && matchesPriority && matchesSeverity && matchesStatus;
    });
  }, [categoryFilter, priorityFilter, severityFilter, snapshot?.issues, sourceFilter, statusFilter]);

  const selectedIssue = useMemo(() => (
    snapshot?.issues.find((issue) => issue.fingerprint === selectedFingerprint) || null
  ), [selectedFingerprint, snapshot?.issues]);

  useEffect(() => {
    if (!selectedIssue) return;
    setDraftStatus(selectedIssue.status);
    setDraftOwnerName(selectedIssue.ownerName || '');
    setDraftStatusNote(selectedIssue.statusNote || '');
    setDraftResolutionEvidence(selectedIssue.resolutionEvidence || '');
  }, [
    selectedIssue?.fingerprint,
    selectedIssue?.ownerName,
    selectedIssue?.resolutionEvidence,
    selectedIssue?.status,
    selectedIssue?.statusNote,
  ]);

  const workflowHasChanges = !!selectedIssue && (
    draftStatus !== selectedIssue.status ||
    draftOwnerName.trim() !== (selectedIssue.ownerName || '') ||
    draftStatusNote.trim() !== (selectedIssue.statusNote || '') ||
    draftResolutionEvidence.trim() !== (selectedIssue.resolutionEvidence || '')
  );

  const responseActions = useMemo(() => {
    if (!selectedIssue) return [];
    return recommendQualityIssueActions({
      ...selectedIssue,
      status: draftStatus,
      ownerName: draftOwnerName.trim() || undefined,
      statusNote: draftStatusNote.trim() || undefined,
      resolutionEvidence: draftResolutionEvidence.trim() || undefined,
    });
  }, [draftOwnerName, draftResolutionEvidence, draftStatus, draftStatusNote, selectedIssue]);

  async function handleSaveWorkflow() {
    if (!selectedIssue) return;

    try {
      setIsSavingWorkflow(true);
      const workflow = await updateQualityIssueWorkflow({
        fingerprint: selectedIssue.fingerprint,
        status: draftStatus,
        ownerName: draftOwnerName.trim() || null,
        statusNote: draftStatusNote.trim() || null,
        resolutionEvidence: draftResolutionEvidence.trim() || null,
      });

      setSnapshot((current) => mergeWorkflowIntoSnapshot(current, workflow));
      await queryClient.invalidateQueries({ queryKey: pendingCountsKeys.all });
      toast.success('Issue workflow updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update issue workflow');
    } finally {
      setIsSavingWorkflow(false);
    }
  }

  async function handleCreateTask() {
    if (!selectedIssue) return;

    try {
      setIsCreatingTask(true);
      const result = await createQualityIssueRemediationTask({
        ...selectedIssue,
        status: draftStatus,
        ownerName: draftOwnerName.trim() || undefined,
        statusNote: draftStatusNote.trim() || undefined,
        resolutionEvidence: draftResolutionEvidence.trim() || undefined,
      });

      setSnapshot((current) => mergeWorkflowIntoSnapshot(current, result.workflow));
      await queryClient.invalidateQueries({ queryKey: pendingCountsKeys.all });
      toast.success('Remediation task created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create remediation task');
    } finally {
      setIsCreatingTask(false);
    }
  }

  async function handleRunAutomation() {
    try {
      setIsRunningAutomation(true);
      const result = await runQualityIssueAutomation();
      setSnapshot(result.snapshot);
      await queryClient.invalidateQueries({ queryKey: pendingCountsKeys.all });
      toast.success(
        `Automation linked ${result.automation.tasksLinked} issue${result.automation.tasksLinked === 1 ? '' : 's'} and created ${result.automation.tasksCreated} task${result.automation.tasksCreated === 1 ? '' : 's'}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run issue automation');
    } finally {
      setIsRunningAutomation(false);
    }
  }

  if (isLoading && !snapshot) {
    return <IssuesModuleLoading />;
  }

  const summary = snapshot?.summary;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900">Issue Manager</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground max-w-3xl">
            Internal build, test, audit, accessibility, and runtime issue tracking with a response workflow for ownership, triage, and remediation.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Latest report: {formatDate(snapshot?.generatedAt)}
            {snapshot?.branch ? ` on ${snapshot.branch}` : ''}
          </p>
        </div>
        <Button
          onClick={() => void loadIssues()}
          disabled={isLoading}
          variant="outline"
          className="h-10 border-gray-200 hover:bg-white hover:text-gray-700 hover:border-gray-300 shadow-sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50 rounded-xl shadow-sm">
          <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard label="Open Issues" value={summary?.open ?? 0} tone="text-slate-950" />
        <SummaryCard label="Critical Priority" value={summary?.byPriority?.critical ?? 0} tone="text-red-800" />
        <SummaryCard label="Errors" value={summary?.errors ?? 0} tone="text-red-700" />
        <SummaryCard label="Warnings" value={summary?.warnings ?? 0} tone="text-amber-700" />
      </div>

      {snapshot ? <FeedHealthPanel snapshot={snapshot} /> : null}
      {snapshot ? <ActionQueuePanel issues={snapshot.issues} /> : null}
      {snapshot ? (
        <AutomationPanel
          snapshot={snapshot}
          isRunning={isRunningAutomation}
          onRun={() => void handleRunAutomation()}
        />
      ) : null}

      <Card className="rounded-xl border border-gray-100 shadow-sm">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-xl font-semibold text-gray-900">Latest Findings</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as 'all' | QualityIssueSource)}>
              <SelectTrigger className="w-full sm:w-48 h-10 border-gray-200">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {QUALITY_ISSUE_SOURCES.map((source) => (
                  <SelectItem key={source} value={source}>{sourceLabels[source]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as 'all' | QualityIssueCategory)}>
              <SelectTrigger className="w-full sm:w-48 h-10 border-gray-200">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {QUALITY_ISSUE_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>{categoryLabels[category]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as 'all' | QualityIssuePriority)}>
              <SelectTrigger className="w-full sm:w-44 h-10 border-gray-200">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {QUALITY_ISSUE_PRIORITIES.map((priority) => (
                  <SelectItem key={priority} value={priority}>{priorityLabels[priority]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={(value) => setSeverityFilter(value as 'all' | QualityIssueSeverity)}>
              <SelectTrigger className="w-full sm:w-40 h-10 border-gray-200">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="error">Errors</SelectItem>
                <SelectItem value="warning">Warnings</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | QualityIssueStatus)}>
              <SelectTrigger className="w-full sm:w-44 h-10 border-gray-200">
                <SelectValue placeholder="Workflow" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All workflow states</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <h2 className="mt-4 text-base font-semibold text-gray-900">No issues in this view</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                No findings match the current filters. Adjust the feed or workflow filters and refresh the queue.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-3 pr-4 font-medium">Status</th>
                    <th className="py-3 pr-4 font-medium">Priority</th>
                    <th className="py-3 pr-4 font-medium">Source</th>
                    <th className="py-3 pr-4 font-medium">Category</th>
                    <th className="py-3 pr-4 font-medium">Issue</th>
                    <th className="py-3 pr-4 font-medium">Workflow</th>
                    <th className="py-3 pr-4 font-medium">Location</th>
                    <th className="py-3 pr-4 font-medium">Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIssues.map((issue) => (
                    <tr key={issue.id} className="border-b last:border-0 align-top">
                      <td className="py-4 pr-4">
                        <div className="space-y-2">
                          <WorkflowBadge status={issue.status} />
                          <IssueSignalBadges issue={issue} />
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <Badge variant="outline" className={priorityTone[issue.priority]}>
                          {priorityLabels[issue.priority]}
                        </Badge>
                      </td>
                      <td className="py-4 pr-4 text-gray-700">{sourceLabels[issue.source]}</td>
                      <td className="py-4 pr-4 text-gray-700">{categoryLabels[issue.category]}</td>
                      <td className="py-4 pr-4 min-w-80">
                        <IssueDetails issue={issue} />
                      </td>
                      <td className="py-4 pr-4 min-w-56">
                        <div className="space-y-2">
                          <div className="text-sm text-gray-900">
                            {issue.ownerName || 'Unassigned'}
                          </div>
                          {issue.linkedTaskTitle ? (
                            <a
                              href="/admin?module=tasks"
                              className="inline-flex items-center gap-1 text-xs text-purple-700 hover:text-purple-800"
                            >
                              {issue.linkedTaskTitle}
                              <ArrowUpRight className="h-3 w-3" />
                            </a>
                          ) : (
                            <div className="text-xs text-muted-foreground">No task linked yet</div>
                          )}
                          {issue.resolutionEvidence ? (
                            <div className="text-xs text-emerald-700">Closure evidence attached</div>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => setSelectedFingerprint(issue.fingerprint)}
                          >
                            Review
                          </Button>
                        </div>
                      </td>
                      <td className="py-4 pr-4 min-w-48">
                        <IssueLocation issue={issue} />
                      </td>
                      <td className="py-4 pr-4 whitespace-nowrap text-gray-600">
                        {formatDate(issue.lastSeenAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedIssue} onOpenChange={(open) => !open && setSelectedFingerprint(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
          {selectedIssue ? (
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b border-gray-100 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <WorkflowBadge status={draftStatus} />
                      <Badge variant="outline" className={priorityTone[selectedIssue.priority]}>
                        {priorityLabels[selectedIssue.priority]}
                      </Badge>
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                        {sourceLabels[selectedIssue.source]}
                      </Badge>
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                        {categoryLabels[selectedIssue.category]}
                      </Badge>
                      <IssueSignalBadges issue={selectedIssue} />
                    </div>
                    <SheetTitle>{selectedIssue.title}</SheetTitle>
                    <SheetDescription>
                      {selectedIssue.message}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">Response Workflow</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Assign an owner, track triage state, and keep the issue tied to a concrete remediation path.
                      </p>
                    </div>
                    {selectedIssue.linkedTaskId ? (
                      <a
                        href="/admin?module=tasks"
                        className="inline-flex items-center gap-1 text-sm font-medium text-purple-700 hover:text-purple-800"
                      >
                        View linked task
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(['open', 'acknowledged', 'resolved'] as const).map((status) => (
                      <Button
                        key={status}
                        type="button"
                        variant={draftStatus === status ? 'default' : 'outline'}
                        onClick={() => setDraftStatus(status)}
                        className="justify-start"
                      >
                        {statusLabels[status]}
                      </Button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-900" htmlFor="issue-owner">
                        Owner
                      </label>
                      <Input
                        id="issue-owner"
                        value={draftOwnerName}
                        onChange={(event) => setDraftOwnerName(event.target.value)}
                        placeholder="Assign a person or team"
                        className="border-gray-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-900" htmlFor="issue-status-note">
                        Working note
                      </label>
                      <Textarea
                        id="issue-status-note"
                        value={draftStatusNote}
                        onChange={(event) => setDraftStatusNote(event.target.value)}
                        placeholder="Capture the current decision, mitigation, or what still needs to happen."
                        className="min-h-28 border-gray-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-900" htmlFor="issue-resolution-evidence">
                        Resolution evidence
                      </label>
                      <Textarea
                        id="issue-resolution-evidence"
                        value={draftResolutionEvidence}
                        onChange={(event) => setDraftResolutionEvidence(event.target.value)}
                        placeholder="What proved this is fixed? Include PR, commit, deploy, test run, or audit result."
                        className="min-h-28 border-gray-200"
                      />
                      <p className="text-xs text-muted-foreground">
                        Required for a trustworthy closure and used to spot regressions when the same fingerprint reappears.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      onClick={() => void handleSaveWorkflow()}
                      disabled={isSavingWorkflow || !workflowHasChanges}
                    >
                      {isSavingWorkflow ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Save workflow
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleCreateTask()}
                      disabled={isCreatingTask || !!selectedIssue.linkedTaskId}
                    >
                      {isCreatingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                      {selectedIssue.linkedTaskId ? 'Remediation task linked' : 'Create remediation task'}
                    </Button>
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Suggested Response</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      A lightweight runbook based on the issue source, category, and current workflow state.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {responseActions.map((action) => (
                      <div key={action} className="rounded-lg border border-gray-100 bg-gray-50/70 px-4 py-3 text-sm text-gray-700">
                        {action}
                      </div>
                    ))}
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <h2 className="text-base font-semibold text-gray-900">Issue Context</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="rounded-lg border border-gray-100 bg-white p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">First seen</p>
                      <p className="mt-2 font-medium text-gray-900">{formatDate(selectedIssue.firstSeenAt)}</p>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-white p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Last seen</p>
                      <p className="mt-2 font-medium text-gray-900">{formatDate(selectedIssue.lastSeenAt)}</p>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-white p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Occurrences</p>
                      <p className="mt-2 font-medium text-gray-900">{selectedIssue.occurrences}</p>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-white p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Response target</p>
                      <p className="mt-2 font-medium text-gray-900">
                        {getQualityIssueResponseSlaHours(selectedIssue)} hours
                      </p>
                      <p className={isQualityIssuePastResponseSla(selectedIssue) ? 'mt-1 text-xs text-red-600' : 'mt-1 text-xs text-muted-foreground'}>
                        {isQualityIssuePastResponseSla(selectedIssue) ? 'Past target' : 'Within target'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-white p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Workflow updated</p>
                      <p className="mt-2 font-medium text-gray-900">
                        {selectedIssue.workflowUpdatedAt ? formatDate(selectedIssue.workflowUpdatedAt) : 'Not updated yet'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedIssue.workflowUpdatedBy || 'No workflow owner yet'}
                      </p>
                    </div>
                    {selectedIssue.reopenedAt ? (
                      <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-amber-700">Regression signal</p>
                        <p className="mt-2 font-medium text-amber-900">
                          Reopened {formatDate(selectedIssue.reopenedAt)}
                        </p>
                        <p className="mt-1 text-xs text-amber-700">
                          {selectedIssue.regressionCount || 1} recurrence{(selectedIssue.regressionCount || 1) === 1 ? '' : 's'} after resolution
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-gray-100 bg-white p-4 text-sm">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Fingerprint</p>
                    <p className="mt-2 break-all font-mono text-xs text-gray-700">{selectedIssue.fingerprint}</p>
                  </div>

                  {selectedIssue.resolutionEvidence ? (
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4 text-sm">
                      <p className="text-xs uppercase tracking-wide text-emerald-700">Resolution evidence</p>
                      <p className="mt-2 whitespace-pre-wrap text-emerald-900">{selectedIssue.resolutionEvidence}</p>
                    </div>
                  ) : null}

                  {(selectedIssue.packageName || selectedIssue.advisoryId || selectedIssue.cve || selectedIssue.referenceUrl) ? (
                    <div className="rounded-lg border border-gray-100 bg-white p-4 text-sm text-gray-700">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Security metadata</p>
                      <div className="mt-3 space-y-2">
                        {selectedIssue.packageName ? (
                          <div>
                            <span className="font-medium text-gray-900">Package:</span>{' '}
                            {selectedIssue.packageName}
                            {selectedIssue.packageVersion ? `@${selectedIssue.packageVersion}` : ''}
                          </div>
                        ) : null}
                        {selectedIssue.vulnerableRange ? (
                          <div><span className="font-medium text-gray-900">Affected range:</span> {selectedIssue.vulnerableRange}</div>
                        ) : null}
                        {selectedIssue.fixVersion ? (
                          <div><span className="font-medium text-gray-900">Fix version:</span> {selectedIssue.fixVersion}</div>
                        ) : null}
                        {selectedIssue.advisoryId ? (
                          <div><span className="font-medium text-gray-900">Advisory:</span> {selectedIssue.advisoryId}</div>
                        ) : null}
                        {selectedIssue.cve ? (
                          <div><span className="font-medium text-gray-900">CVE:</span> {selectedIssue.cve}</div>
                        ) : null}
                        {typeof selectedIssue.cvssScore === 'number' ? (
                          <div><span className="font-medium text-gray-900">CVSS:</span> {selectedIssue.cvssScore.toFixed(1)}</div>
                        ) : null}
                        {selectedIssue.referenceUrl ? (
                          <a
                            href={selectedIssue.referenceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-purple-700 hover:text-purple-800"
                          >
                            Open advisory reference
                            <ArrowUpRight className="h-4 w-4" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
