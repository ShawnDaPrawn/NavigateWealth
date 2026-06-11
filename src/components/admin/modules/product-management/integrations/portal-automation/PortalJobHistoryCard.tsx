import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../../ui/card';
import { ExternalLink, History, Loader2 } from 'lucide-react';
import { PortalJobHistoryEntry } from '../../types';
import { cn } from '../../../../../ui/utils';
import { statusClassNames } from './portalHelpers';

interface PortalJobHistoryCardProps {
  history: PortalJobHistoryEntry[];
  isLoading: boolean;
  // The job already rendered above as Current Job / Latest Run.
  excludeJobId?: string | null;
}

const runModeLabels: Record<string, string> = {
  run: 'Policy update',
  'dry-run': 'Dry run',
  discover: 'Discovery',
};

export function PortalJobHistoryCard({
  history,
  isLoading,
  excludeJobId,
}: PortalJobHistoryCardProps) {
  const entries = history.filter((entry) => entry.id !== excludeJobId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5 text-purple-600" />
          Previous Runs
        </CardTitle>
        <CardDescription>
          Earlier portal automations for this provider and product, newest first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading run history...
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-500">No previous runs yet.</p>
        ) : (
          <ul className="divide-y">
            {entries.map((entry) => {
              const summary = entry.queueSummary;
              const note = entry.error || entry.warning || entry.message || '';
              return (
                <li
                  key={entry.id}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn('capitalize', statusClassNames[entry.status])}
                      >
                        {entry.status.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-sm font-medium text-gray-900">
                        {runModeLabels[entry.runMode || 'run'] || entry.runMode}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {summary && summary.total > 0 && (
                      <p className="text-xs text-gray-600">
                        {summary.completed} of {summary.total} policies extracted
                        {summary.failed > 0 ? `, ${summary.failed} failed` : ''}
                        {summary.skipped > 0 ? `, ${summary.skipped} skipped` : ''}
                      </p>
                    )}
                    {note && <p className="truncate text-xs text-gray-500">{note}</p>}
                  </div>
                  {entry.actionsRunUrl && (
                    <Button asChild size="sm" variant="outline" className="shrink-0">
                      <a href={entry.actionsRunUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Run logs
                      </a>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
