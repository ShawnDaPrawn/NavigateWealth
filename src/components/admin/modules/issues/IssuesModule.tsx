import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { Skeleton } from '../../../ui/skeleton';
import { fetchQualityIssuesSnapshot } from './api';
import { QUALITY_ISSUE_SOURCES } from '../../../../shared/quality/qualityIssues';
import type { QualityIssue, QualityIssueSeverity, QualityIssueSnapshot, QualityIssueSource } from './types';

const severityTone: Record<QualityIssueSeverity, string> = {
  error: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
};

const sourceLabels: Record<QualityIssueSource, string> = {
  build: 'Build',
  test: 'Tests',
  audit: 'Security Audit',
  accessibility: 'Accessibility',
  'runtime-client': 'Client Runtime',
  'runtime-server': 'Server Runtime',
};

function formatDate(value?: string) {
  if (!value) return 'Not run yet';
  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function IssueLocation({ issue }: { issue: QualityIssue }) {
  if (!issue.filePath) return <span className="text-muted-foreground">Repository</span>;

  const suffix = [
    typeof issue.line === 'number' ? issue.line : null,
    typeof issue.column === 'number' ? issue.column : null,
  ].filter(Boolean).join(':');

  return (
    <code className="text-xs text-slate-700 break-all">
      {issue.filePath}{suffix ? `:${suffix}` : ''}
    </code>
  );
}

export function IssuesModule() {
  const [snapshot, setSnapshot] = useState<QualityIssueSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<'all' | QualityIssueSource>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | QualityIssueSeverity>('all');

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
      const matchesSeverity = severityFilter === 'all' || issue.severity === severityFilter;
      return matchesSource && matchesSeverity;
    });
  }, [severityFilter, snapshot?.issues, sourceFilter]);

  if (isLoading && !snapshot) {
    return <IssuesModuleLoading />;
  }

  const summary = snapshot?.summary;

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-full">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-slate-800" />
            <h1 className="text-2xl font-semibold text-slate-950">Issue Manager</h1>
          </div>
          <p className="mt-2 text-sm text-slate-600 max-w-3xl">
            Internal build, test, audit, accessibility, and runtime issue tracking. No Sentry or third-party telemetry service is required.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Latest report: {formatDate(snapshot?.generatedAt)}
            {snapshot?.branch ? ` on ${snapshot.branch}` : ''}
          </p>
        </div>
        <Button onClick={() => void loadIssues()} disabled={isLoading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard label="Open Issues" value={summary?.open ?? 0} tone="text-slate-950" />
        <SummaryCard label="Errors" value={summary?.errors ?? 0} tone="text-red-700" />
        <SummaryCard label="Warnings" value={summary?.warnings ?? 0} tone="text-amber-700" />
        <SummaryCard label="Total Tracked" value={summary?.total ?? 0} tone="text-slate-700" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-lg">Latest Findings</CardTitle>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as 'all' | QualityIssueSource)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {QUALITY_ISSUE_SOURCES.map((source) => (
                  <SelectItem key={source} value={source}>{sourceLabels[source]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={(value) => setSeverityFilter(value as 'all' | QualityIssueSeverity)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="error">Errors</SelectItem>
                <SelectItem value="warning">Warnings</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <h2 className="mt-4 text-base font-semibold text-slate-950">No issues in this view</h2>
              <p className="mt-1 text-sm text-slate-600">
                The CI publisher has not reported matching findings yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-3 pr-4 font-medium">Severity</th>
                    <th className="py-3 pr-4 font-medium">Source</th>
                    <th className="py-3 pr-4 font-medium">Issue</th>
                    <th className="py-3 pr-4 font-medium">Location</th>
                    <th className="py-3 pr-4 font-medium">Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIssues.map((issue) => (
                    <tr key={issue.id} className="border-b last:border-0 align-top">
                      <td className="py-4 pr-4">
                        <Badge variant="outline" className={severityTone[issue.severity]}>
                          {issue.severity}
                        </Badge>
                      </td>
                      <td className="py-4 pr-4 text-slate-700">{sourceLabels[issue.source]}</td>
                      <td className="py-4 pr-4 min-w-80">
                        <div className="font-medium text-slate-950">{issue.title}</div>
                        <div className="mt-1 text-slate-600">{issue.message}</div>
                        {issue.ruleId ? <div className="mt-2 text-xs text-slate-500">{issue.ruleId}</div> : null}
                      </td>
                      <td className="py-4 pr-4 min-w-48">
                        <IssueLocation issue={issue} />
                      </td>
                      <td className="py-4 pr-4 whitespace-nowrap text-slate-600">
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
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">{label}</p>
          <AlertCircle className="h-4 w-4 text-slate-400" />
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
      <Skeleton className="h-96" />
    </div>
  );
}
