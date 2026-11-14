import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { usePendingCounts } from '../../../hooks/usePendingCounts';
import type { AdminModule } from '../../../layout/types';

interface NeedsAttentionCardProps {
  onModuleChange?: (module: string) => void;
  /** Tasks due today, from the Due today card's own data. */
  tasksDueToday: number;
}

interface AttentionRow {
  module: AdminModule;
  count: number;
  label: (n: number) => string;
  caption: string;
  destination: string;
}

/**
 * The sidebar's waiting counts in one place, each one click from its list
 * (design DB 1). Shares the sidebar's query, so it costs no extra request.
 */
export function NeedsAttentionCard({ onModuleChange, tasksDueToday }: NeedsAttentionCardProps) {
  const counts = usePendingCounts();

  const rows: AttentionRow[] = [
    {
      module: 'applications',
      count: counts.applications?.count ?? 0,
      label: (n) => (n === 1 ? 'Application to review' : 'Applications to review'),
      caption: 'Pending review',
      destination: 'Applications',
    },
    {
      module: 'submissions',
      count: counts.submissions?.count ?? 0,
      label: (n) => (n === 1 ? 'New submission' : 'New submissions'),
      caption: 'Not picked up yet',
      destination: 'Submissions',
    },
    {
      module: 'tasks',
      count: tasksDueToday,
      label: (n) => (n === 1 ? 'Task due today' : 'Tasks due today'),
      caption: 'Due today',
      destination: 'To-Do',
    },
    {
      module: 'issues',
      count: counts.issues?.count ?? 0,
      label: (n) => (n === 1 ? 'Open issue' : 'Open issues'),
      caption: 'Unresolved',
      destination: 'Issue Manager',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Needs your attention</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((row) => (
            <li key={row.module}>
              <button
                type="button"
                onClick={() => onModuleChange?.(row.module)}
                className="flex w-full items-center gap-3 rounded-lg border border-nw-line bg-white px-3 py-3 text-left transition-colors hover:bg-nw-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
              >
                <span
                  className={
                    row.count > 0
                      ? 'text-2xl font-semibold text-nw-ink'
                      : 'text-2xl font-semibold text-nw-text-3'
                  }
                >
                  {row.count.toLocaleString()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-nw-ink">
                    {row.label(row.count)}
                  </span>
                  <span className="block truncate text-xs text-nw-text-3">{row.caption}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-nw-text-2">
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">Open </span>
                  {row.destination}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
