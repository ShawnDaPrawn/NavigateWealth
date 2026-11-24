import { FolderPlus } from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '../../ui/utils';
import {
  BROKERAGE_COLLECTION_ID,
  type Collection,
  type VaultSummary,
} from '../../../shared/password-manager';
import { collectionOf, inScope, viewLabels, type VaultScope, type VaultView } from './vaultFilters';

export default function VaultRail({
  items,
  collections,
  scope,
  onScope,
  onNewCollection,
}: {
  items: VaultSummary[];
  collections: Collection[];
  scope: VaultScope;
  onScope: (scope: VaultScope) => void;
  onNewCollection: () => void;
}) {
  // The Brokerage collection always shows, even before the server lists it.
  const rows = collections.some((c) => c.id === BROKERAGE_COLLECTION_ID)
    ? collections
    : [
        {
          id: BROKERAGE_COLLECTION_ID,
          name: 'Brokerage',
          kind: 'brokerage' as const,
          ownerUserId: null,
          ownerName: '',
          createdAt: '',
        },
        ...collections,
      ];
  const entry = (value: VaultScope, label: string, count: number, meta?: string) => (
    <li key={value}>
      <button
        type="button"
        aria-current={scope === value ? 'true' : undefined}
        onClick={() => onScope(value)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm',
          scope === value ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-black/5',
        )}
      >
        <span className="min-w-0">
          <span className="block truncate">{label}</span>
          {meta && <span className="block truncate text-xs text-muted-foreground">{meta}</span>}
        </span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </button>
    </li>
  );
  return (
    <nav aria-label="Collections and views" className="grid content-start gap-4">
      <div>
        <h3 className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Collections
        </h3>
        <ul className="grid gap-0.5">
          {entry('all', 'All items', items.length)}
          {rows.map((c) =>
            entry(
              `c:${c.id}`,
              c.name,
              items.filter((item) => collectionOf(item) === c.id).length,
              c.kind === 'person' ? c.ownerName || 'Personal' : undefined,
            ),
          )}
        </ul>
        <Button variant="ghost" size="sm" className="mt-1" onClick={onNewCollection}>
          <FolderPlus aria-hidden="true" />
          New collection
        </Button>
      </div>
      <div>
        <h3 className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Views
        </h3>
        <ul className="grid gap-0.5">
          {(Object.keys(viewLabels) as VaultView[]).map((view) =>
            entry(
              `v:${view}`,
              viewLabels[view],
              items.filter((item) => inScope(item, `v:${view}`)).length,
            ),
          )}
        </ul>
      </div>
    </nav>
  );
}
