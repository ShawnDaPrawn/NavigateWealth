/**
 * Publications Card
 *
 * Dashboard widget summarising the content pipeline: article counts by
 * status plus the most recently updated articles. Pulls from the
 * Publications module's API (StatsAPI / ArticlesAPI) and links through
 * to the full Publications module via the "Manage" button.
 *
 * Follows the stat card standards from Guidelines §8.3 / §8.4.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '../../../../ui/skeleton';
import { DsButton, DsCard, DsCardBody, DsCardHead, DsMeta } from '../../../layout/page';
import { StatsAPI, useArticles } from '../../publications';
import type { ArticleStatus } from '../../publications';
import { publicationKeys } from '../../../../../utils/queryKeys';
import type { PublicationsCardProps } from '../types';
import { CardError } from './CardError';

const STATUS_CONFIG: Record<ArticleStatus, { label: string }> = {
  published: { label: 'Published' },
  scheduled: { label: 'Scheduled' },
  in_review: { label: 'In review' },
  draft: { label: 'Draft' },
  archived: { label: 'Archived' },
};

function formatShortDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

export function PublicationsCard({ onModuleChange, maxArticles = 5 }: PublicationsCardProps) {
  // Both reads go through React Query so this card is cached like the rest of
  // the dashboard. It used to fetch in an effect into local state, which meant
  // a fresh pair of requests and a fresh spinner every time the dashboard was
  // mounted — including every time an admin came back from another module.
  const {
    data: stats = null,
    isLoading: statsLoading,
    isError: statsFailed,
    refetch: refetchStats,
  } = useQuery({
    queryKey: publicationKeys.stats(),
    queryFn: () => StatsAPI.getStats(),
    staleTime: 5 * 60 * 1000,
  });

  // The Publications module's own hook, so the article list is fetched once and
  // shared with it rather than fetched again on the way in.
  const {
    articles,
    isLoading: articlesLoading,
    error: articlesError,
    refetch: refetchArticles,
  } = useArticles();

  const loading = statsLoading || articlesLoading;
  // The recent-articles list needs the articles; the tiles show "—" on their own
  // when only the totals failed.
  const error = !!articlesError;

  const sortedArticles = useMemo(
    () =>
      [...articles]
        .filter((a) => a.status !== 'archived')
        .sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at).getTime() -
            new Date(a.updated_at || a.created_at).getTime(),
        ),
    [articles],
  );

  const tiles = [
    { label: 'Published', value: stats?.by_status.published ?? 0 },
    { label: 'Drafts', value: stats?.by_status.draft ?? 0 },
    { label: 'In review', value: stats?.by_status.in_review ?? 0 },
    { label: 'Scheduled', value: stats?.by_status.scheduled ?? 0 },
  ];

  const recentArticles = sortedArticles.slice(0, maxArticles);

  return (
    <DsCard aria-label="Publications">
      <DsCardHead
        as="h3"
        title="Publications"
        actions={
          <DsButton size="sm" variant="ghost" onClick={() => onModuleChange?.('publications')}>
            Manage
          </DsButton>
        }
      />
      <DsCardBody className="flex flex-col gap-3">
        <div className="ds-dl" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          {tiles.map((tile) => (
            <div key={tile.label}>
              <span>{tile.label}</span>
              {loading ? <Skeleton className="h-5 w-8" /> : statsFailed ? '—' : tile.value}
            </div>
          ))}
        </div>
        <div className="ds-divider" />
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        ) : error ? (
          <CardError
            title="Couldn't load publications"
            onRetry={() => {
              void refetchStats();
              void refetchArticles();
            }}
          />
        ) : recentArticles.length === 0 ? (
          <DsMeta>No articles yet.</DsMeta>
        ) : (
          recentArticles.map((article) => {
            const statusCfg = STATUS_CONFIG[article.status] || STATUS_CONFIG.draft;
            return (
              <button
                key={article.id}
                type="button"
                className="min-w-0 text-left hover:text-nw-violet-600"
                onClick={() => onModuleChange?.('publications')}
              >
                <b className="block truncate font-medium">{article.title}</b>
                <DsMeta>
                  {statusCfg.label} · {formatShortDate(article.updated_at || article.created_at)}
                </DsMeta>
              </button>
            );
          })
        )}
      </DsCardBody>
    </DsCard>
  );
}
