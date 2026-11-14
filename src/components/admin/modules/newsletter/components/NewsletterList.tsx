/**
 * Newsletter — the list.
 *
 * Every newsletter, newest first, with drafts handed over by the monthly
 * routine pinned at the top until an admin deals with them. Filtering is
 * client-side over the loaded page so the status chips can show live counts.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  ChevronRight,
  FileText,
  Globe,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Skeleton } from '../../../../ui/skeleton';
import { cn } from '../../../../ui/utils';
import { CAMPAIGN_STATUS_FILTERS } from '../constants';
import { useDeleteCampaign, useStudioCampaigns } from '../hooks/useNewsletterStudio';
import type { NewsletterCampaign, NewsletterCaps } from '../types';
import { isCampaignDeletable } from '../utils/campaign';
import { formatDateTime, formatNumber, formatRate, formatRelative } from '../utils/format';
import { CampaignProgressLine } from './CampaignProgressLine';
import { CampaignStatusBadge } from './StatusBadge';
import { EmptyState, ErrorState } from './shared';
import { Tabs } from '../../../../ui/tabs';
import {
  NavTabsList,
  NavTabsTrigger,
  Notice as SharedNotice,
  useConfirm,
  useUrlState,
} from '../../../layout/page';

const STATUS_IDS = CAMPAIGN_STATUS_FILTERS.map((option) => option.id);

export function NewsletterList({
  caps,
  onOpen,
  onNew,
}: {
  caps: NewsletterCaps;
  onOpen: (campaignId: string) => void;
  onNew: () => void;
}) {
  const [filter, setFilter] = useUrlState('status', 'all', STATUS_IDS);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const { confirm, confirmDialog } = useConfirm();

  const askDelete = async (campaign: NewsletterCampaign) => {
    const ok = await confirm({
      title: `Delete “${campaign.title}”?`,
      description:
        'This removes the newsletter, its PDF and its delivery history. Emails already delivered are unaffected. This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (ok) remove.mutate(campaign.id);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError, error, refetch, isFetching } = useStudioCampaigns({
    search: debouncedSearch || undefined,
  });
  const remove = useDeleteCampaign();

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

  const all = useMemo(() => data?.campaigns ?? [], [data]);
  const awaitingReview = all.filter((c) => c.status === 'draft' && c.source === 'routine');
  const visible = useMemo(() => {
    const option = CAMPAIGN_STATUS_FILTERS.find((o) => o.id === filter);
    if (!option?.statuses) return all;
    return all.filter((c) => option.statuses!.includes(c.status));
  }, [all, filter]);

  const hasFilters = Boolean(debouncedSearch) || filter !== 'all';

  return (
    <div className="space-y-4">
      {awaitingReview.length > 0 && filter === 'all' && !debouncedSearch ? (
        <SharedNotice kind="attention" title="Waiting for your review">
          — the monthly routine handed over{' '}
          {awaitingReview.length === 1 ? 'a draft' : `${awaitingReview.length} drafts`}:{' '}
          {awaitingReview.map((campaign, index) => (
            <span key={campaign.id}>
              {index > 0 ? ', ' : null}
              <button
                type="button"
                onClick={() => onOpen(campaign.id)}
                className="font-semibold underline underline-offset-2 hover:no-underline"
              >
                {campaign.title}
              </button>
              {campaign.pdf ? null : <span className="text-xs"> (no PDF attached)</span>}
            </span>
          ))}
        </SharedNotice>
      ) : null}

      <Tabs value={filter} onValueChange={setFilter}>
        <NavTabsList aria-label="Filter newsletters by status">
          {chipOptions.map((option) => (
            <NavTabsTrigger key={option.id} value={option.id} count={option.count}>
              {option.label}
            </NavTabsTrigger>
          ))}
        </NavTabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full min-w-56 sm:w-72">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title…"
            aria-label="Search newsletters"
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
      </div>

      {isError ? (
        <ErrorState
          title="Unable to load newsletters"
          details={error instanceof Error ? error.message : undefined}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      ) : (
        <Card className="gap-0 overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <EmptyState
                icon={hasFilters ? Search : Sparkles}
                title={hasFilters ? 'No newsletters match your filters' : 'No newsletters yet'}
                description={
                  hasFilters
                    ? 'Try another status or a different search.'
                    : 'Upload the finished PDF, add a title and a short description, choose an audience, and send. The monthly routine can also hand one over for you to approve.'
                }
                action={
                  hasFilters ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFilter('all');
                        setSearch('');
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : caps.create ? (
                    <Button onClick={onNew}>
                      <Upload className="h-4 w-4" aria-hidden /> Upload a newsletter
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {visible.map((campaign) => (
                  <li key={campaign.id}>
                    <div
                      role="link"
                      tabIndex={0}
                      onClick={() => onOpen(campaign.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onOpen(campaign.id);
                        }
                      }}
                      className={cn(
                        'flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40',
                        'focus:outline-none focus-visible:bg-muted/40',
                      )}
                    >
                      <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300 sm:flex">
                        <FileText className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium">{campaign.title}</span>
                          <CampaignStatusBadge status={campaign.status} />
                          {campaign.source === 'routine' && campaign.status === 'draft' ? (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                              <Bot className="h-3 w-3" aria-hidden /> awaiting review
                            </span>
                          ) : null}
                          {campaign.website ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300"
                              title="Live on the public website"
                            >
                              <Globe className="h-3 w-3" aria-hidden /> on the website
                            </span>
                          ) : null}
                          {campaign.stuck ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
                              title="No delivery progress for a few minutes"
                            >
                              <AlertTriangle className="h-3 w-3" aria-hidden /> stalled
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {campaign.listNames.join(', ') || 'No audience'}
                          {' · '}
                          {campaign.status === 'scheduled'
                            ? `Sends ${formatDateTime(campaign.scheduledAt)}`
                            : campaign.status === 'finished' && campaign.completedAt
                              ? `Sent ${formatRelative(campaign.completedAt)}`
                              : `Updated ${formatRelative(campaign.updatedAt)}`}
                        </p>
                        {campaign.recipientCount > 0 &&
                        (campaign.status === 'queued' ||
                          campaign.status === 'sending' ||
                          campaign.status === 'paused') ? (
                          <CampaignProgressLine campaign={campaign} className="mt-1.5" />
                        ) : null}
                      </div>
                      <div className="hidden shrink-0 text-right text-xs tabular-nums md:block">
                        {campaign.sentCount > 0 ? (
                          <>
                            <span className="block font-medium">
                              {formatNumber(campaign.sentCount)} delivered
                            </span>
                            <span className="block text-muted-foreground">
                              {formatRate(campaign.readCount, campaign.sentCount)} read
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            {campaign.pdf ? 'PDF attached' : 'No PDF yet'}
                          </span>
                        )}
                      </div>
                      {caps.delete && isCampaignDeletable(campaign) ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground"
                          aria-label={`Delete ${campaign.title}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            void askDelete(campaign);
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      ) : null}
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          {!isLoading && visible.length > 0 ? (
            <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
              <span>
                Showing {formatNumber(visible.length)} of {formatNumber(data?.total ?? 0)}{' '}
                {(data?.total ?? 0) === 1 ? 'newsletter' : 'newsletters'}
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

      {confirmDialog}
    </div>
  );
}
