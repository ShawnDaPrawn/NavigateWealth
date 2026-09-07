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

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Skeleton } from '../../../../ui/skeleton';
import {
  BookOpen,
  FileText,
  CheckCircle2,
  CalendarClock,
  PenLine,
  Eye,
  ArrowRight,
  Star,
} from 'lucide-react';
import { StatsAPI, useArticles } from '../../publications';
import type { ArticleStatus } from '../../publications';
import { publicationKeys } from '../../../../../utils/queryKeys';
import type { PublicationsCardProps } from '../types';

/** Status → badge styling + label (config-driven, §5.3). */
const STATUS_CONFIG: Record<ArticleStatus, { label: string; badgeClass: string }> = {
  published: { label: 'Published', badgeClass: 'text-green-700 border-green-300 bg-green-50' },
  scheduled: { label: 'Scheduled', badgeClass: 'text-blue-700 border-blue-300 bg-blue-50' },
  in_review: { label: 'In Review', badgeClass: 'text-amber-700 border-amber-300 bg-amber-50' },
  draft: { label: 'Draft', badgeClass: 'text-gray-600 border-gray-300 bg-gray-50' },
  archived: { label: 'Archived', badgeClass: 'text-gray-500 border-gray-300 bg-gray-50' },
};

function formatRelativeTime(timestamp: string): string {
  const d = new Date(timestamp);
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface StatusTile {
  label: string;
  value: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
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
  } = useQuery({
    queryKey: publicationKeys.stats(),
    queryFn: () => StatsAPI.getStats(),
    staleTime: 5 * 60 * 1000,
  });

  // The Publications module's own hook, so the article list is fetched once and
  // shared with it rather than fetched again on the way in.
  const { articles, isLoading: articlesLoading, error: articlesError } = useArticles();

  const loading = statsLoading || articlesLoading;
  const error = statsFailed && !!articlesError;

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

  const tiles: StatusTile[] = [
    {
      label: 'Published',
      value: stats?.by_status.published ?? 0,
      icon: CheckCircle2,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
    },
    {
      label: 'Drafts',
      value: stats?.by_status.draft ?? 0,
      icon: PenLine,
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-600',
    },
    {
      label: 'Scheduled',
      value: stats?.by_status.scheduled ?? 0,
      icon: CalendarClock,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'In Review',
      value: stats?.by_status.in_review ?? 0,
      icon: Eye,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
  ];

  const recentArticles = sortedArticles.slice(0, maxArticles);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 rounded-lg">
              <BookOpen className="h-4 w-4 text-indigo-600" />
            </div>
            Publications
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onModuleChange?.('publications')}
            className="h-7 text-xs gap-1.5"
          >
            Manage
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        <CardDescription>Content pipeline &amp; recent articles</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Status Tiles ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-lg bg-gray-50 p-3 text-center">
              <div className={`inline-flex p-1.5 rounded-md ${tile.iconBg} mb-2`}>
                <tile.icon className={`h-3.5 w-3.5 ${tile.iconColor}`} />
              </div>
              {loading ? (
                <Skeleton className="h-6 w-10 mx-auto mb-1" />
              ) : (
                <p className="text-xl font-bold leading-tight">{tile.value}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{tile.label}</p>
            </div>
          ))}
        </div>

        {/* ── Recent Articles ────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md px-2 py-2">
                <Skeleton className="h-4 w-4 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-6 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Publications data unavailable</p>
            <p className="text-xs text-muted-foreground mt-1">
              Open the Publications module to manage content.
            </p>
          </div>
        ) : recentArticles.length === 0 ? (
          <div className="py-6 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No articles yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first article from the Publications module.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentArticles.map((article) => {
              const statusCfg = STATUS_CONFIG[article.status] || STATUS_CONFIG.draft;
              return (
                <div
                  key={article.id}
                  className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => onModuleChange?.('publications')}
                >
                  <div className="mt-0.5 text-indigo-500">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug truncate flex items-center gap-1.5">
                      {article.title}
                      {article.is_featured && (
                        <Star className="h-3 w-3 text-amber-500 fill-amber-400 shrink-0" />
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(article.updated_at || article.created_at)}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 leading-4 ${statusCfg.badgeClass}`}
                      >
                        {statusCfg.label}
                      </Badge>
                      {article.category_name && (
                        <span className="text-xs text-muted-foreground truncate">
                          {article.category_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
