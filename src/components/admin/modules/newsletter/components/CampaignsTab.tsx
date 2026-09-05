/**
 * Newsletter Studio — campaigns: the list, plus routing into the composer and
 * the drill-down. Filtering is client-side over the loaded page so the status
 * chips can show live counts.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import { Input } from '../../../../ui/input';
import { Skeleton } from '../../../../ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import { cn } from '../../../../ui/utils';
import { CAMPAIGN_STATUS_FILTERS } from '../constants';
import {
  useDeleteCampaign,
  useDuplicateCampaign,
  useStudioCampaigns,
} from '../hooks/useNewsletterStudio';
import type { NewsletterCampaign, NewsletterCaps, NewsletterStudioTemplate } from '../types';
import { isCampaignDeletable } from '../utils/campaign';
import { formatDateTime, formatNumber, formatRate, formatRelative } from '../utils/format';
import { CampaignDetail } from './CampaignDetail';
import { CampaignEditor } from './CampaignEditor';
import { CampaignProgressLine } from './CampaignProgressLine';
import { CampaignStatusBadge } from './StatusBadge';
import { EmptyState, ErrorState, FilterChips } from './shared';

export type { NewsletterCaps } from '../types';

/** Optional starting content for a brand-new campaign. */
export interface EditorSeed {
  template?: NewsletterStudioTemplate;
  listIds?: string[];
}

export type CampaignsView =
  | { kind: 'list' }
  | { kind: 'editor'; campaign: NewsletterCampaign | null; seed?: EditorSeed }
  | { kind: 'detail'; campaignId: string };

interface CampaignsTabProps {
  caps: NewsletterCaps;
  view: CampaignsView;
  onViewChange: (view: CampaignsView) => void;
}

export function CampaignsTab({ caps, view, onViewChange }: CampaignsTabProps) {
  if (view.kind === 'editor') {
    return (
      <CampaignEditor
        campaign={view.campaign}
        seed={view.seed}
        onBack={() =>
          onViewChange(
            view.campaign ? { kind: 'detail', campaignId: view.campaign.id } : { kind: 'list' },
          )
        }
        onSaved={(campaign) => onViewChange({ kind: 'detail', campaignId: campaign.id })}
      />
    );
  }

  if (view.kind === 'detail') {
    return (
      <CampaignDetail
        campaignId={view.campaignId}
        caps={caps}
        onBack={() => onViewChange({ kind: 'list' })}
        onEdit={(campaign) => onViewChange({ kind: 'editor', campaign })}
        onOpenCampaign={(campaignId) => onViewChange({ kind: 'detail', campaignId })}
        onDeleted={() => onViewChange({ kind: 'list' })}
      />
    );
  }

  return <CampaignList caps={caps} onViewChange={onViewChange} />;
}

// ── List ─────────────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function CampaignList({
  caps,
  onViewChange,
}: {
  caps: NewsletterCaps;
  onViewChange: (view: CampaignsView) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const debouncedSearch = useDebounced(search.trim(), 250);
  // The status filter is applied server-side, before pagination, so a chip
  // shows every matching campaign however many exist; the server also returns
  // per-status counts over the whole set for the chip badges.
  const selectedStatuses = useMemo(
    () => CAMPAIGN_STATUS_FILTERS.find((o) => o.id === filter)?.statuses ?? null,
    [filter],
  );
  const { data, isLoading, isError, error, refetch, isFetching } = useStudioCampaigns(
    useMemo(
      () => ({
        search: debouncedSearch || undefined,
        status: selectedStatuses ? selectedStatuses.join(',') : 'all',
      }),
      [debouncedSearch, selectedStatuses],
    ),
  );
  const duplicate = useDuplicateCampaign();
  const deleteCampaign = useDeleteCampaign();
  const [pendingDelete, setPendingDelete] = useState<NewsletterCampaign | null>(null);

  const visible = useMemo(() => data?.campaigns ?? [], [data]);

  const chipOptions = useMemo(() => {
    const counts = data?.statusCounts;
    return CAMPAIGN_STATUS_FILTERS.map((option) => ({
      id: option.id,
      label: option.label,
      count: counts
        ? option.statuses
          ? option.statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0)
          : Object.values(counts).reduce((sum, n) => sum + n, 0)
        : undefined,
    }));
  }, [data]);

  const openDetail = (campaignId: string) => onViewChange({ kind: 'detail', campaignId });
  const hasFilters = Boolean(debouncedSearch) || filter !== 'all';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips
          ariaLabel="Filter campaigns by status"
          options={chipOptions}
          value={filter}
          onChange={setFilter}
        />
        <div className="flex items-center gap-2">
          <div className="relative w-full min-w-56 lg:w-72">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or subject…"
              aria-label="Search campaigns"
              className="h-9 pl-8 pr-8"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
          {caps.create ? (
            <Button
              onClick={() => onViewChange({ kind: 'editor', campaign: null })}
              className="h-9"
            >
              <Plus className="h-4 w-4" aria-hidden /> New campaign
            </Button>
          ) : null}
        </div>
      </div>

      {isError && !data ? (
        <ErrorState
          title="Campaigns could not be loaded"
          description={error instanceof Error ? error.message : undefined}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      ) : (
        <Card className="gap-0 overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <ListSkeleton />
            ) : visible.length === 0 ? (
              hasFilters ? (
                <EmptyState
                  icon={Search}
                  title="No campaigns match"
                  description="Try a different search term or clear the status filter."
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearch('');
                        setFilter('all');
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Mail}
                  title="No campaigns yet"
                  description="Compose a newsletter, send yourself a test, then send it now or schedule it for later."
                  action={
                    caps.create ? (
                      <Button onClick={() => onViewChange({ kind: 'editor', campaign: null })}>
                        <Plus className="h-4 w-4" aria-hidden /> Create your first campaign
                      </Button>
                    ) : null
                  }
                />
              )
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-64">Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Audience</TableHead>
                      <TableHead className="min-w-52">Delivery</TableHead>
                      <TableHead className="hidden xl:table-cell">Engagement</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((campaign) => (
                      <TableRow
                        key={campaign.id}
                        className="cursor-pointer"
                        onClick={() => openDetail(campaign.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') openDetail(campaign.id);
                        }}
                        tabIndex={0}
                        aria-label={`Open campaign ${campaign.name}`}
                      >
                        <TableCell>
                          <span className="block max-w-72 truncate font-medium">
                            {campaign.name}
                          </span>
                          <span className="block max-w-72 truncate text-xs text-muted-foreground">
                            {campaign.subject}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <CampaignStatusBadge status={campaign.status} />
                            {campaign.stuck ? (
                              <span
                                className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
                                title="No delivery progress for a few minutes"
                              >
                                <AlertTriangle className="h-3 w-3" aria-hidden /> stalled
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <AudienceChips names={campaign.listNames} />
                        </TableCell>
                        <TableCell>
                          {campaign.recipientCount > 0 ? (
                            <CampaignProgressLine campaign={campaign} />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {campaign.status === 'scheduled'
                                ? `Sends ${formatDateTime(campaign.scheduledAt)}`
                                : campaign.status === 'draft'
                                  ? 'Not sent yet'
                                  : '—'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          {campaign.sentCount > 0 ? (
                            <div className="text-xs tabular-nums">
                              <span className="font-medium">
                                {formatRate(campaign.clickCount, campaign.sentCount)}
                              </span>
                              <span className="text-muted-foreground"> click rate</span>
                              <span className="block text-muted-foreground">
                                {formatNumber(campaign.openCount)} opens ·{' '}
                                {formatNumber(campaign.clickCount)} clicks
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          <span title={formatDateTime(campaign.updatedAt)}>
                            {formatRelative(campaign.updatedAt)}
                          </span>
                        </TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label={`Actions for ${campaign.name}`}
                              >
                                <MoreHorizontal className="h-4 w-4" aria-hidden />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onSelect={() => openDetail(campaign.id)}>
                                <ExternalLink className="h-4 w-4" aria-hidden /> Open
                              </DropdownMenuItem>
                              {caps.create ? (
                                <DropdownMenuItem
                                  disabled={duplicate.isPending}
                                  onSelect={() =>
                                    duplicate.mutate(campaign.id, {
                                      onSuccess: (copy) => openDetail(copy.id),
                                    })
                                  }
                                >
                                  <Copy className="h-4 w-4" aria-hidden /> Duplicate
                                </DropdownMenuItem>
                              ) : null}
                              {caps.delete && isCampaignDeletable(campaign) ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() => setPendingDelete(campaign)}
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden /> Delete
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          {!isLoading && visible.length > 0 ? (
            <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
              <span>
                Showing {formatNumber(visible.length)} of {formatNumber(data?.total ?? 0)}{' '}
                {(data?.total ?? 0) === 1 ? 'campaign' : 'campaigns'}
              </span>
              {isFetching ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Refreshing
                </span>
              ) : null}
            </div>
          ) : null}
        </Card>
      )}

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The campaign and its delivery records are removed permanently. Emails already
              delivered are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                if (pendingDelete) deleteCampaign.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function AudienceChips({ names, max = 2 }: { names: string[]; max?: number }) {
  if (names.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1" title={names.join(', ')}>
      {shown.map((name) => (
        <span
          key={name}
          className={cn(
            'inline-flex max-w-40 items-center truncate rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground/80',
          )}
        >
          {name}
        </span>
      ))}
      {rest > 0 ? <span className="text-xs text-muted-foreground">+{rest}</span> : null}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-border/60" data-testid="campaign-list-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="hidden h-3 w-32 lg:block" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
