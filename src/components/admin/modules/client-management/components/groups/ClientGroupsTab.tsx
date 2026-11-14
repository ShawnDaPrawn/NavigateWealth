import { useState } from 'react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router';
import { MoreHorizontal, Plus, RefreshCw, Search, Trash2, Users } from 'lucide-react';
import { Button } from '../../../../../ui/button';
import { Input } from '../../../../../ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../../ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../../ui/dropdown-menu';
import { ErrorState, useConfirm, useUrlState } from '../../../../layout/page';
import { communicationApi, type ClientGroup } from '../../../communication';
import { FilterChipMenu } from '../ListFilters';
import {
  GROUP_KIND_LABELS,
  GROUP_SORTS,
  GROUP_SORT_LABELS,
  GROUP_TYPE_FILTERS,
  GROUP_TYPE_LABELS,
  activeFilterLabels,
  filterAndSortGroups,
  formatGroupDate,
  groupKind,
  NEWSLETTER_GROUP_ID,
  type GroupSort,
  type GroupTypeFilter,
} from './groupModel';
import { useClientGroups } from './useClientGroups';

interface ClientGroupsTabProps {
  /** Opens the group editor page (an id, or 'new'). */
  onOpenGroup: (id: string) => void;
}

/** Client Management › Groups (design: CM 2, CM 19–20). */
export function ClientGroupsTab({ onOpenGroup }: ClientGroupsTabProps) {
  const { groups, loading, error, refresh } = useClientGroups();
  const { confirm, confirmDialog } = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('gq') ?? '';
  const setSearch = (next: string) =>
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (next) params.set('gq', next);
        else params.delete('gq');
        return params;
      },
      { replace: true },
    );
  const [type, setType] = useUrlState<GroupTypeFilter>('gtype', 'all', GROUP_TYPE_FILTERS);
  const [sort, setSort] = useUrlState<GroupSort>('gsort', 'updated', GROUP_SORTS);
  const [recalculating, setRecalculating] = useState(false);

  const visible = filterAndSortGroups(groups, { search, type, sort });

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await communicationApi.recalculateGroupMemberships();
      await refresh();
      toast.success('Group memberships updated');
    } catch (error) {
      console.error('Failed to recalculate group memberships:', error);
      toast.error('Could not recalculate group memberships');
    } finally {
      setRecalculating(false);
    }
  };

  // Auto-generated groups have no editor, so their delete stays on the row.
  const handleDeleteAuto = async (group: ClientGroup) => {
    const ok = await confirm({
      title: 'Delete group?',
      description: `You are about to permanently delete “${group.name}”. All client associations will be removed, but the clients themselves are not affected. This action cannot be undone.`,
      confirmLabel: 'Delete group',
      destructive: true,
    });
    if (!ok) return;
    try {
      await communicationApi.deleteGroup(group.id);
      await refresh();
      toast.success('Group deleted');
    } catch (error) {
      console.error('Failed to delete group:', error);
      toast.error('Could not delete the group');
    }
  };

  // A failed load is an error, never "No groups yet".
  if (error && !loading && groups.length === 0) {
    return (
      <ErrorState
        title="Couldn't load groups"
        description="The groups could not be loaded. Nothing has changed on the server."
        onRetry={() => void refresh()}
        details={error instanceof Error ? error.message : String(error)}
      />
    );
  }

  if (!loading && groups.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-nw-line bg-white px-6 py-14 text-center">
        <Users className="mb-3 h-10 w-10 text-nw-text-3" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-nw-ink">No groups yet</h2>
        <p className="mt-1 max-w-sm text-sm text-nw-text-3">
          Create your first group to organise clients for communication and newsletters.
        </p>
        <Button className="mt-5" onClick={() => onOpenGroup('new')}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create group
        </Button>
      </div>
    );
  }

  return (
    <section
      aria-label="Groups"
      className="overflow-hidden rounded-xl border border-nw-line bg-white"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-nw-line-2 px-4 py-3">
        <div className="relative w-full max-w-xs">
          <Search
            className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Search groups"
            placeholder="Search groups"
            className="pl-8"
            value={search}
            autoComplete="off"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <FilterChipMenu field="Type" value={type} labels={GROUP_TYPE_LABELS} onChange={setType} />
        <SortMenu value={sort} onChange={setSort} />
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleRecalculate()}
            disabled={recalculating || loading}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${recalculating ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Recalculate members
          </Button>
          <Button size="sm" onClick={() => onOpenGroup('new')}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Create group
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 p-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm font-medium text-nw-ink">No groups match</p>
          <p className="text-sm text-nw-text-3">Try another search or type.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Group</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Members</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-28 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((group) => {
              const kind = groupKind(group);
              const filters = activeFilterLabels(group.filterConfig);
              const externals = group.externalContacts?.length ?? 0;
              const summary =
                group.description ||
                (filters.length > 0
                  ? filters.join(' · ')
                  : group.id === NEWSLETTER_GROUP_ID
                    ? 'Newsletter audience'
                    : 'Hand-picked') +
                  (externals > 0 ? `, plus ${externals} external contacts` : '');
              return (
                <TableRow key={group.id}>
                  <TableCell>
                    <div className="font-medium text-nw-ink">{group.name}</div>
                    <div className="max-w-md truncate text-xs text-nw-text-3">{summary}</div>
                  </TableCell>
                  <TableCell className="text-sm text-nw-text-2">
                    {GROUP_KIND_LABELS[kind]}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {group.clientCount || 0}
                  </TableCell>
                  <TableCell className="text-sm text-nw-text-2">
                    {formatGroupDate(group.updatedAt || group.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {kind === 'auto' ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`More: ${group.name}`}>
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-red-700 focus:text-red-700"
                            onClick={() => void handleDeleteAuto(group)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                            Delete group…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenGroup(group.id)}
                        aria-label={`Edit ${group.name}`}
                      >
                        Edit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {!loading && groups.length > 0 && (
        <p className="border-t border-nw-line-2 px-4 py-3 text-sm text-nw-text-3">
          Showing {visible.length} of {groups.length} groups
        </p>
      )}
      {confirmDialog}
    </section>
  );
}

function SortMenu({ value, onChange }: { value: GroupSort; onChange: (v: GroupSort) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 text-[13px] text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
        >
          Sort: {GROUP_SORT_LABELS[value]}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {GROUP_SORTS.map((s) => (
          <DropdownMenuItem key={s} onClick={() => onChange(s)}>
            {GROUP_SORT_LABELS[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
