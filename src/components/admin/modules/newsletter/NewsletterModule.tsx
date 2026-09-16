/**
 * Newsletter — send a finished PDF newsletter to the practice's audiences and
 * track delivery and read rate. Server counterpart: /newsletter-studio routes.
 *
 * Three screens, chosen by the `campaign` URL param so a refresh, a shared
 * link or the "draft ready for review" email lands on the right one:
 *   - no param       → the list (with the audience/delivery tiles above it)
 *   - campaign=new   → the create form
 *   - campaign=<id>  → one newsletter, from draft to sent
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { ChevronRight, Eye, MailCheck, Newspaper, Upload, Users } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Skeleton } from '../../../ui/skeleton';
import { cn } from '../../../ui/utils';
// Cross-module dependency: newsletter → personnel (public hook surface).
// Same §3.1 exception the communication module documents — capability checks
// are personnel's public API, re-implementing them would fork authz logic.
import { useCurrentUserPermissions } from '../personnel';
import { DeliveryHealthCard } from './components/DeliveryHealthCard';
import { NewsletterDetail } from './components/NewsletterDetail';
import { NewsletterEditor } from './components/NewsletterEditor';
import { NewsletterList } from './components/NewsletterList';
import { ErrorState, StatTile } from './components/shared';
import { useStudioCampaign, useStudioDashboard } from './hooks/useNewsletterStudio';
import type { NewsletterCaps } from './types';
import { formatNumber, formatRate, formatRelative, ratePercent } from './utils/format';
import { schedulerHealth } from './utils/scheduler';

const CAMPAIGN_PARAM = 'campaign';

export function NewsletterModule() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { canDo } = useCurrentUserPermissions();
  // UX gating only — the server enforces the same capabilities independently.
  const caps: NewsletterCaps = useMemo(
    () => ({
      create: canDo('newsletter', 'create'),
      send: canDo('newsletter', 'send'),
      delete: canDo('newsletter', 'delete'),
    }),
    [canDo],
  );

  const campaignParam = searchParams.get(CAMPAIGN_PARAM);
  const openId = campaignParam && campaignParam !== 'new' ? campaignParam : null;
  const openQuery = useStudioCampaign(openId);

  const setCampaignParam = useCallback(
    (value: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(CAMPAIGN_PARAM, value);
          else next.delete(CAMPAIGN_PARAM);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const goList = () => setCampaignParam(null);
  const goNew = () => setCampaignParam('new');
  const goOpen = (id: string) => setCampaignParam(id);

  const focused = Boolean(campaignParam);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6">
      {focused ? (
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-sm text-muted-foreground"
        >
          <button type="button" onClick={goList} className="hover:text-foreground">
            Newsletters
          </button>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <span className="truncate font-medium text-foreground">
            {campaignParam === 'new' ? 'New newsletter' : (openQuery.data?.title ?? 'Newsletter')}
          </span>
        </nav>
      ) : (
        <Header canCreate={caps.create} onNew={goNew} />
      )}

      {campaignParam === 'new' ? (
        <NewsletterEditor onCreated={goOpen} onCancel={goList} />
      ) : openId ? (
        openQuery.data ? (
          <NewsletterDetail campaign={openQuery.data} caps={caps} onDeleted={goList} />
        ) : openQuery.isLoading ? (
          <div className="space-y-4" data-testid="newsletter-loading">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        ) : (
          <div className="space-y-4">
            <ErrorState
              title="This newsletter could not be opened"
              description={
                openQuery.error instanceof Error
                  ? openQuery.error.message
                  : 'It may have been deleted, or the link may be wrong.'
              }
              onRetry={() => openQuery.refetch()}
              retrying={openQuery.isFetching}
            />
            <div className="flex justify-center">
              <Button variant="outline" onClick={goList}>
                Back to newsletters
              </Button>
            </div>
          </div>
        )
      ) : (
        <>
          <Overview caps={caps} />
          <NewsletterList caps={caps} onOpen={goOpen} onNew={goNew} />
        </>
      )}
    </div>
  );
}

function Header({ canCreate, onNew }: { canCreate: boolean; onNew: () => void }) {
  const { data } = useStudioDashboard();
  const health = schedulerHealth(data?.processor);
  const pillTone =
    health.level === 'live'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800'
      : health.level === 'unknown'
        ? 'bg-muted text-muted-foreground ring-border'
        : 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800';
  const dotTone =
    health.level === 'live'
      ? 'bg-emerald-500'
      : health.level === 'unknown'
        ? 'bg-slate-400'
        : 'bg-amber-500';

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-purple-50 p-2.5 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300">
          <Newspaper className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Newsletters</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Upload the finished PDF, choose an audience and send. Delivery runs in the background
            and honours every unsubscribe.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {data ? (
          <span
            className={cn(
              'inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-medium ring-1 ring-inset',
              pillTone,
            )}
            title={
              health.level === 'live' && data.processor?.lastCronRunAt
                ? `${health.detail} Last check-in ${formatRelative(data.processor.lastCronRunAt)}.`
                : health.detail
            }
          >
            <span className={cn('h-2 w-2 rounded-full', dotTone)} aria-hidden />
            {health.label}
          </span>
        ) : null}
        {canCreate ? (
          <Button onClick={onNew}>
            <Upload className="h-4 w-4" aria-hidden /> Upload newsletter
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Overview({ caps }: { caps: NewsletterCaps }) {
  const { data, isLoading } = useStudioDashboard();
  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  const reachable = data.subscribers.active;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <StatTile
          icon={Users}
          label="Reachable subscribers"
          value={formatNumber(reachable)}
          tone="purple"
          progress={ratePercent(reachable, data.subscribers.total)}
          hint={`${formatNumber(data.subscribers.total)} total · ${formatNumber(data.subscribers.unsubscribed)} opted out`}
        />
        <StatTile
          icon={MailCheck}
          label="Emails delivered"
          value={formatNumber(data.delivery.totalSent)}
          tone="emerald"
          hint={
            data.delivery.totalSent > 0
              ? `${formatNumber(data.campaigns.finished)} newsletter${data.campaigns.finished === 1 ? '' : 's'} sent`
              : 'Nothing sent yet'
          }
        />
        <StatTile
          icon={Eye}
          label="Read rate"
          value={
            data.delivery.totalSent > 0
              ? formatRate(data.delivery.totalRead, data.delivery.totalSent)
              : '—'
          }
          tone="blue"
          hint={
            data.delivery.totalSent > 0
              ? `${formatNumber(data.delivery.totalRead)} recipients opened a newsletter`
              : 'Appears once a newsletter has been sent'
          }
        />
      </div>
      <DeliveryHealthCard summary={data} canRun={caps.send} />
    </div>
  );
}
