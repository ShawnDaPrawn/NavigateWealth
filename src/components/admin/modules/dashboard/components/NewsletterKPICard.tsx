/**
 * Newsletter KPI Card — Dashboard widget.
 *
 * Shows subscriber count, broadcast activity, and last-send recency.
 * Redesigned to match the established card header pattern (§8.3, §8.4):
 *   - White card background with consistent CardHeader + CardDescription
 *   - bg-gray-50 icon container with rounded corners
 *   - Large bold number, small muted description text
 *   - Status indicator for "last broadcast" recency
 */

import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '../../../../ui/skeleton';
import { DsButton, DsCard, DsCardBody, DsCardHead, DsMeta } from '../../../layout/page';
import { CAMPAIGN_STATUS_CONFIG, useStudioDashboard } from '../../newsletter';
import { CardError } from './CardError';
import { api } from '../../../../../utils/api';
import { newsletterKeys } from '../../../../../utils/queryKeys';

interface NewsletterStats {
  activeSubscribers: number;
  totalBroadcasts: number;
  broadcastsThisMonth: number;
  lastBroadcastAt: string | null;
}

/** Throws when the stats can't be read, so the card can offer Try again. */
async function fetchNewsletterStats(): Promise<NewsletterStats | null> {
  const json = await api.get<{ success?: boolean; data?: NewsletterStats; error?: string }>(
    '/newsletter/admin/stats',
  );
  if (!json.success) throw new Error(json.error || 'Newsletter stats unavailable');
  return json.data ?? null;
}

interface NewsletterKPICardProps {
  onModuleChange?: (module: string) => void;
}

export function NewsletterKPICard({ onModuleChange }: NewsletterKPICardProps = {}) {
  // React Query rather than an effect into local state, so this card is cached
  // with the rest of the dashboard instead of re-requesting and re-spinning on
  // every mount — which included every return from another admin module.
  const {
    data: stats = null,
    isLoading: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: newsletterKeys.stats(),
    queryFn: fetchNewsletterStats,
    staleTime: 5 * 60 * 1000,
  });

  // The newsletter module's own dashboard read, for the two latest broadcasts.
  const { data: studio, isLoading: studioLoading } = useStudioDashboard();
  const recent = (studio?.recentCampaigns ?? []).slice(0, 2);

  const figures = [
    { label: 'Subscribers', value: stats?.activeSubscribers ?? 0 },
    { label: 'Total sent', value: stats?.totalBroadcasts ?? 0 },
    { label: 'This month', value: stats?.broadcastsThisMonth ?? 0 },
  ];

  return (
    <DsCard aria-label="Newsletter">
      <DsCardHead
        as="h3"
        title="Newsletter"
        actions={
          <DsButton size="sm" variant="ghost" onClick={() => onModuleChange?.('newsletter')}>
            Open
          </DsButton>
        }
      />
      <DsCardBody className="flex flex-col gap-3">
        {isError ? (
          <CardError title="Couldn't load newsletter figures" onRetry={() => void refetch()} />
        ) : (
          <div
            className="ds-dl"
            style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}
          >
            {figures.map((f) => (
              <div key={f.label}>
                <span>{f.label}</span>
                {loading ? <Skeleton className="h-5 w-8" /> : f.value.toLocaleString()}
              </div>
            ))}
          </div>
        )}
        <div className="ds-divider" />
        <span className="ds-lbl">Recent broadcasts</span>
        {studioLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : recent.length === 0 ? (
          <DsMeta>No broadcasts yet.</DsMeta>
        ) : (
          recent.map((c) => (
            <button
              key={c.id}
              type="button"
              className="min-w-0 text-left hover:text-nw-violet-600"
              onClick={() => onModuleChange?.('newsletter')}
            >
              <b className="block truncate font-medium">{c.title}</b>
              <DsMeta>
                {CAMPAIGN_STATUS_CONFIG[c.status]?.label ?? c.status}
                {c.status === 'draft' && c.reviewNotifiedAt ? ' · waiting for review' : ''}
              </DsMeta>
            </button>
          ))
        )}
      </DsCardBody>
    </DsCard>
  );
}
