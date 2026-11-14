import { usePendingCounts } from '../../../hooks/usePendingCounts';
import type { AdminModule } from '../../../layout/types';
import { DsSection } from '../../../layout/page';

interface NeedsAttentionCardProps {
  onModuleChange?: (module: string) => void;
  /** Tasks due today, from the Due today card's own data. */
  tasksDueToday: number;
  /** The Due today request failed, so the count is unknown. */
  tasksDueTodayFailed?: boolean;
}

interface AttentionTile {
  module: AdminModule;
  count: number;
  /** The count could not be loaded: show "—", not a misleading 0. */
  failed?: boolean;
  label: (n: number) => string;
  caption: string;
  destination: string;
  /** Shown in red when there is anything waiting (open issues). */
  urgent?: boolean;
}

/**
 * Needs your attention (DB-Main board): the sidebar's waiting counts as four
 * tiles, each one click from its list. Shares the sidebar's query, so it costs
 * no extra request.
 */
export function NeedsAttentionCard({
  onModuleChange,
  tasksDueToday,
  tasksDueTodayFailed = false,
}: NeedsAttentionCardProps) {
  const counts = usePendingCounts();

  const tiles: AttentionTile[] = [
    {
      module: 'applications',
      count: counts.applications?.count ?? 0,
      failed: counts.applications?.failed,
      label: (n) => (n === 1 ? 'Application to review' : 'Applications to review'),
      caption: 'Pending review',
      destination: 'Applications',
    },
    {
      module: 'submissions',
      count: counts.submissions?.count ?? 0,
      failed: counts.submissions?.failed,
      label: (n) => (n === 1 ? 'New submission' : 'New submissions'),
      caption: 'Not picked up yet',
      destination: 'Submissions',
    },
    {
      module: 'tasks',
      count: tasksDueToday,
      failed: tasksDueTodayFailed,
      label: (n) => (n === 1 ? 'Task due today' : 'Tasks due today'),
      caption: 'Due today',
      destination: 'To-Do',
    },
    {
      module: 'issues',
      count: counts.issues?.count ?? 0,
      failed: counts.issues?.failed,
      label: (n) => (n === 1 ? 'Open issue' : 'Open issues'),
      caption: 'Unresolved',
      destination: 'Issue Manager',
      urgent: true,
    },
  ];

  return (
    <DsSection title="Needs your attention" titleId="needs-your-attention">
      <div className="ds-stats">
        {tiles.map((tile) => (
          <button
            key={tile.module}
            type="button"
            onClick={() => onModuleChange?.(tile.module)}
            className="ds-att"
          >
            <span
              className="v"
              style={
                tile.urgent && tile.count > 0 && !tile.failed ? { color: '#b91c1c' } : undefined
              }
            >
              {tile.failed ? '—' : tile.count.toLocaleString()}
            </span>
            <span className="k">{tile.label(tile.count)}</span>
            <span className="m">
              {tile.failed ? "Couldn't load" : tile.caption} → {tile.destination}
            </span>
          </button>
        ))}
      </div>
    </DsSection>
  );
}
