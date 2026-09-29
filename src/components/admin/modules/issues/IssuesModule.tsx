import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, RefreshCw, Search, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '../../../ui/alert';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { cn } from '../../../ui/utils';
import { useSearchInputAutofillGuard } from '../../../../shared/forms/useSearchInputAutofillGuard';
import {
  QUALITY_ISSUE_PRIORITIES,
  QUALITY_ISSUE_SOURCES,
} from '../../../../shared/quality/qualityIssues';
import { pendingCountsKeys } from '../../../../utils/queryKeys';
import {
  createQualityIssueRemediationTask,
  fetchQualityIssuesSnapshot,
  runQualityIssueAutomation,
  updateQualityIssueWorkflow,
} from './api';
import {
  issueViewConfig,
  mergeWorkflowIntoSnapshot,
  pluralize,
  priorityLabels,
  sourceLabels,
} from './issuePresentation';
import {
  countIssuesBy,
  countIssueViews,
  EMPTY_ISSUE_FILTERS,
  filterIssues,
  hasActiveIssueFilters,
  matchesIssueView,
  sortIssuesByUrgency,
  summarizeIssueEscalations,
  type IssueFilters,
  type IssueView,
} from './issueViews';
import { AttentionBanner, IssueViewCards, ReportFreshness } from './components/IssueOverview';
import { IssueDetailSheet } from './components/IssueDetailSheet';
import { IssueTable } from './components/IssueTable';
import { IssuesSkeleton } from './components/IssuesSkeleton';
import type {
  QualityIssue,
  QualityIssuePriority,
  QualityIssueSnapshot,
  QualityIssueSource,
  QualityIssueWorkflowUpdate,
} from './types';

export function IssuesModule() {
  const queryClient = useQueryClient();
  const [snapshot, setSnapshot] = useState<QualityIssueSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<IssueView>('unresolved');
  const [filters, setFilters] = useState<IssueFilters>(EMPTY_ISSUE_FILTERS);
  const [selectedFingerprint, setSelectedFingerprint] = useState<string | null>(null);
  const [isRunningAutomation, setIsRunningAutomation] = useState(false);
  const searchInputGuard = useSearchInputAutofillGuard({ id: 'issues-module-search' });

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

  const issues = useMemo(() => snapshot?.issues ?? [], [snapshot]);
  const viewCounts = useMemo(() => countIssueViews(issues), [issues]);
  const escalations = useMemo(() => summarizeIssueEscalations(issues), [issues]);
  const issuesInView = useMemo(
    () => issues.filter((issue) => matchesIssueView(issue, view)),
    [issues, view],
  );
  const visibleIssues = useMemo(
    () => sortIssuesByUrgency(filterIssues(issuesInView, filters)),
    [filters, issuesInView],
  );
  const sourceCounts = useMemo(
    () => countIssuesBy(filterIssues(issuesInView, filters, 'source'), 'source'),
    [filters, issuesInView],
  );
  const priorityCounts = useMemo(
    () => countIssuesBy(filterIssues(issuesInView, filters, 'priority'), 'priority'),
    [filters, issuesInView],
  );
  const selectedIssue = useMemo(
    () => issues.find((issue) => issue.fingerprint === selectedFingerprint) ?? null,
    [issues, selectedFingerprint],
  );
  const filtersActive = hasActiveIssueFilters(filters);

  async function refreshPendingCounts() {
    await queryClient.invalidateQueries({ queryKey: pendingCountsKeys.all });
  }

  async function handleSaveWorkflow(update: QualityIssueWorkflowUpdate) {
    try {
      const workflow = await updateQualityIssueWorkflow(update);
      setSnapshot((current) => mergeWorkflowIntoSnapshot(current, workflow));
      await refreshPendingCounts();
      toast.success('Issue updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update issue');
    }
  }

  async function handleCreateTask(issue: QualityIssue) {
    try {
      const result = await createQualityIssueRemediationTask(issue);
      setSnapshot((current) => mergeWorkflowIntoSnapshot(current, result.workflow));
      await refreshPendingCounts();
      toast.success('Remediation task created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create remediation task');
    }
  }

  async function handleRunAutomation() {
    try {
      setIsRunningAutomation(true);
      const result = await runQualityIssueAutomation();
      setSnapshot(result.snapshot);
      await refreshPendingCounts();
      const created = result.automation.tasksCreated;
      toast.success(
        created > 0
          ? `Created ${pluralize(created, 'remediation task')}`
          : 'Every flagged issue already has a task',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create remediation tasks');
    } finally {
      setIsRunningAutomation(false);
    }
  }

  if (isLoading && !snapshot) {
    return <IssuesSkeleton />;
  }

  const viewConfig = issueViewConfig[view];

  return (
    <div className="min-h-screen bg-gray-50/30 pb-10">
      <div className="mx-auto max-w-[1800px] space-y-6 p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-gray-200/60 pb-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Issue Manager</h1>
            <p className="mt-1 text-lg text-muted-foreground">
              Errors and failed checks across the platform, and who is fixing them
            </p>
            {snapshot ? <ReportFreshness snapshot={snapshot} /> : null}
          </div>
          <Button
            variant="outline"
            onClick={() => void loadIssues()}
            disabled={isLoading}
            className="h-10 border-gray-200 px-4 shadow-sm hover:border-gray-300 hover:bg-white hover:text-gray-700"
          >
            <RefreshCw
              className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </div>

        {error ? (
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>Couldn&apos;t load issues</AlertTitle>
            <AlertDescription>
              <p className="text-sm">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadIssues()}
                disabled={isLoading}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {snapshot ? (
          <>
            <IssueViewCards counts={viewCounts} activeView={view} onSelect={setView} />

            <AttentionBanner
              summary={escalations}
              isRunning={isRunningAutomation}
              onCreateTasks={() => void handleRunAutomation()}
            />

            <section
              aria-labelledby="issue-list-heading"
              className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
            >
              <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-4 xl:flex-row xl:items-center xl:justify-between">
                <h2 id="issue-list-heading" className="text-base font-semibold text-gray-900">
                  {viewConfig.listTitle}
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    {filtersActive
                      ? `${visibleIssues.length} of ${issuesInView.length}`
                      : issuesInView.length}
                  </span>
                </h2>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative sm:w-72">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                      aria-hidden="true"
                    />
                    <Input
                      {...searchInputGuard}
                      aria-label="Search issues"
                      placeholder="Search issues…"
                      value={filters.search}
                      onChange={(event) =>
                        setFilters((current) => ({ ...current, search: event.target.value }))
                      }
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={filters.source}
                    onValueChange={(value) =>
                      setFilters((current) => ({
                        ...current,
                        source: value as 'all' | QualityIssueSource,
                      }))
                    }
                  >
                    <SelectTrigger className="sm:w-44" aria-label="Filter by source">
                      <SelectValue>
                        {filters.source === 'all' ? 'All sources' : sourceLabels[filters.source]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sources</SelectItem>
                      {QUALITY_ISSUE_SOURCES.map((source) => (
                        <SelectItem key={source} value={source}>
                          {sourceLabels[source]}
                          <span className="text-gray-400 tabular-nums">
                            {sourceCounts[source] ?? 0}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filters.priority}
                    onValueChange={(value) =>
                      setFilters((current) => ({
                        ...current,
                        priority: value as 'all' | QualityIssuePriority,
                      }))
                    }
                  >
                    <SelectTrigger className="sm:w-40" aria-label="Filter by priority">
                      <SelectValue>
                        {filters.priority === 'all'
                          ? 'All priorities'
                          : priorityLabels[filters.priority]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All priorities</SelectItem>
                      {QUALITY_ISSUE_PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priorityLabels[priority]}
                          <span className="text-gray-400 tabular-nums">
                            {priorityCounts[priority] ?? 0}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filtersActive ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilters(EMPTY_ISSUE_FILTERS)}
                      className="text-gray-600"
                    >
                      Clear filters
                    </Button>
                  ) : null}
                </div>
              </div>

              {visibleIssues.length > 0 ? (
                <IssueTable issues={visibleIssues} onSelect={setSelectedFingerprint} />
              ) : (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  {filtersActive ? (
                    <>
                      <SearchX className="h-10 w-10 text-gray-300" aria-hidden="true" />
                      <h3 className="mt-4 text-base font-semibold text-gray-900">
                        No issues match your filters
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Try a different search, or clear the filters to see every{' '}
                        {viewConfig.label.toLowerCase()} issue.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => setFilters(EMPTY_ISSUE_FILTERS)}
                      >
                        Clear filters
                      </Button>
                    </>
                  ) : (
                    <>
                      <CheckCircle2
                        className={cn(
                          'h-10 w-10',
                          view === 'resolved' ? 'text-gray-300' : 'text-emerald-500',
                        )}
                        aria-hidden="true"
                      />
                      <h3 className="mt-4 text-base font-semibold text-gray-900">
                        {viewConfig.emptyTitle}
                      </h3>
                      <p className="mt-1 max-w-md text-sm text-muted-foreground">
                        {viewConfig.emptyText}
                      </p>
                    </>
                  )}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>

      <IssueDetailSheet
        issue={selectedIssue}
        onClose={() => setSelectedFingerprint(null)}
        onSave={handleSaveWorkflow}
        onCreateTask={handleCreateTask}
      />
    </div>
  );
}

export default IssuesModule;
