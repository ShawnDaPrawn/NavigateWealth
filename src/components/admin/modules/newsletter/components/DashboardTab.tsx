/**
 * Newsletter Studio — overview.
 *
 * Answers four questions at a glance: how big is the audience, how much has
 * gone out, is anyone engaging, and is background delivery healthy. Below
 * that, the latest campaigns and shortcuts into the rest of the studio.
 */
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Layers,
  Loader2,
  Mail,
  MousePointerClick,
  Play,
  Plus,
  Send,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader } from '../../../../ui/card';
import { Skeleton } from '../../../../ui/skeleton';
import { cn } from '../../../../ui/utils';
import { useRunProcessorNow, useStudioDashboard } from '../hooks/useNewsletterStudio';
import type { NewsletterCampaign, NewsletterCaps, NewsletterDashboardSummary } from '../types';
import {
  formatDateTime,
  formatNumber,
  formatRate,
  formatRelative,
  pluralize,
  ratePercent,
} from '../utils/format';
import { schedulerHealth } from '../utils/scheduler';
import { CampaignProgressLine } from './CampaignProgressLine';
import { CampaignStatusBadge } from './StatusBadge';
import { DetailRow, EmptyState, ErrorState, Notice, SectionHeader, StatTile } from './shared';

export type StudioTab = 'dashboard' | 'campaigns' | 'templates' | 'audiences';

interface DashboardTabProps {
  caps: NewsletterCaps;
  onOpenCampaign: (campaignId: string) => void;
  onNewCampaign: () => void;
  onNavigate: (tab: StudioTab) => void;
}

export function DashboardTab({
  caps,
  onOpenCampaign,
  onNewCampaign,
  onNavigate,
}: DashboardTabProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useStudioDashboard();

  if (isLoading) return <DashboardSkeleton />;
  if (isError && !data) {
    return (
      <ErrorState
        title="The dashboard could not be loaded"
        description={error instanceof Error ? error.message : 'Please try again in a moment.'}
        onRetry={() => refetch()}
        retrying={isFetching}
      />
    );
  }
  if (!data) return <DashboardSkeleton />;

  const { subscribers, campaigns, delivery } = data;
  const failureRate = formatRate(delivery.totalFailed, delivery.totalSent + delivery.totalFailed);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={Users}
          tone="purple"
          label="Reachable subscribers"
          value={formatNumber(subscribers.active)}
          progress={ratePercent(subscribers.active, subscribers.total)}
          hint={
            <>
              {formatNumber(subscribers.total)} total
              {subscribers.unsubscribed > 0
                ? ` · ${formatNumber(subscribers.unsubscribed)} opted out`
                : ''}
              {subscribers.pending > 0 ? ` · ${formatNumber(subscribers.pending)} unconfirmed` : ''}
            </>
          }
        />
        <StatTile
          icon={Send}
          tone="emerald"
          label="Emails delivered"
          value={formatNumber(delivery.totalSent)}
          hint={
            delivery.totalFailed > 0
              ? `${formatNumber(delivery.totalFailed)} failed (${failureRate})`
              : delivery.totalSent > 0
                ? 'No delivery failures'
                : 'Nothing sent yet'
          }
        />
        <StatTile
          icon={MousePointerClick}
          tone="blue"
          label="Click rate"
          value={formatRate(delivery.totalClicks, delivery.totalSent)}
          hint={
            delivery.totalSent > 0
              ? `${formatNumber(delivery.totalClicks)} clicks · ${formatNumber(delivery.totalOpens)} opens (${formatRate(delivery.totalOpens, delivery.totalSent)})`
              : 'Engagement appears once a campaign has been sent'
          }
        />
        <StatTile
          icon={Layers}
          tone="slate"
          label="Campaigns"
          value={formatNumber(campaigns.total)}
          hint={
            campaigns.total > 0
              ? [
                  campaigns.active > 0 ? `${campaigns.active} in flight` : null,
                  campaigns.scheduled > 0 ? `${campaigns.scheduled} scheduled` : null,
                  campaigns.draft > 0 ? `${campaigns.draft} draft` : null,
                  campaigns.finished > 0 ? `${campaigns.finished} sent` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Create your first campaign to get started'
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {campaigns.total === 0 ? (
            <GettingStarted
              summary={data}
              canCreate={caps.create}
              onNewCampaign={onNewCampaign}
              onNavigate={onNavigate}
            />
          ) : (
            <RecentCampaigns
              campaigns={data.recentCampaigns}
              canCreate={caps.create}
              onOpenCampaign={onOpenCampaign}
              onNewCampaign={onNewCampaign}
              onViewAll={() => onNavigate('campaigns')}
            />
          )}
        </div>

        <div className="space-y-6">
          <DeliveryHealthCard summary={data} canRun={caps.send} />
          <ShortcutsCard summary={data} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

// ── Recent campaigns ─────────────────────────────────────────────────────────

function RecentCampaigns({
  campaigns,
  canCreate,
  onOpenCampaign,
  onNewCampaign,
  onViewAll,
}: {
  campaigns: NewsletterCampaign[];
  canCreate: boolean;
  onOpenCampaign: (id: string) => void;
  onNewCampaign: () => void;
  onViewAll: () => void;
}) {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-4">
        <SectionHeader
          title="Recent campaigns"
          description="The five most recently updated"
          action={
            <>
              <Button variant="ghost" size="sm" onClick={onViewAll}>
                View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
              {canCreate ? (
                <Button size="sm" onClick={onNewCampaign}>
                  <Plus className="h-4 w-4" aria-hidden /> New campaign
                </Button>
              ) : null}
            </>
          }
        />
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {campaigns.length === 0 ? (
          <EmptyState
            compact
            icon={Mail}
            title="No campaigns yet"
            description="Create your first newsletter campaign to see it here."
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {campaigns.map((campaign) => (
              <li key={campaign.id}>
                <button
                  type="button"
                  onClick={() => onOpenCampaign(campaign.id)}
                  className="group flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{campaign.name}</p>
                      <CampaignStatusBadge status={campaign.status} />
                      {campaign.stuck ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" aria-hidden /> stalled
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {campaign.subject}
                    </p>
                    <CampaignProgressLine campaign={campaign} className="mt-2" />
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-xs text-muted-foreground">
                      {campaign.status === 'scheduled'
                        ? `Sends ${formatRelative(campaign.scheduledAt)}`
                        : `Updated ${formatRelative(campaign.updatedAt)}`}
                    </p>
                    {campaign.sentCount > 0 ? (
                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                        {formatRate(campaign.clickCount, campaign.sentCount)} clicks
                      </p>
                    ) : null}
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Getting started (no campaigns yet) ───────────────────────────────────────

function GettingStarted({
  summary,
  canCreate,
  onNewCampaign,
  onNavigate,
}: {
  summary: NewsletterDashboardSummary;
  canCreate: boolean;
  onNewCampaign: () => void;
  onNavigate: (tab: StudioTab) => void;
}) {
  const audienceReady = summary.subscribers.active > 0;
  const steps = [
    {
      done: audienceReady,
      title: audienceReady
        ? `${pluralize(summary.subscribers.active, 'subscriber')} ready to receive your newsletter`
        : 'Grow your audience',
      description: audienceReady
        ? 'Opted-out addresses are always excluded automatically.'
        : 'Import or confirm subscribers, or target a communication group.',
      action: (
        <Button variant="ghost" size="sm" onClick={() => onNavigate('audiences')}>
          View audiences <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      ),
    },
    {
      done: summary.templateCount > 0,
      title:
        summary.templateCount > 0
          ? `${pluralize(summary.templateCount, 'template')} saved`
          : 'Optional: save a reusable template',
      description: 'Start every issue from the same layout so campaigns take minutes, not hours.',
      action: (
        <Button variant="ghost" size="sm" onClick={() => onNavigate('templates')}>
          Templates <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      ),
    },
    {
      done: false,
      title: 'Compose your first campaign',
      description:
        'Write it, send yourself a test, then send now or schedule it. Delivery runs in the background.',
      action: canCreate ? (
        <Button size="sm" onClick={onNewCampaign}>
          <Plus className="h-4 w-4" aria-hidden /> New campaign
        </Button>
      ) : null,
    },
  ];

  return (
    <Card className="gap-0 overflow-hidden">
      <div className="border-b border-border/60 bg-gradient-to-br from-purple-50 via-white to-white px-6 py-6 dark:from-purple-950/30 dark:via-card dark:to-card">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-purple-600 p-2.5 text-white shadow-sm">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h3 className="text-lg font-semibold">Send your first newsletter</h3>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              Three short steps. Every campaign personalises merge fields per recipient, adds an
              unsubscribe link, and honours every opt-out.
            </p>
          </div>
        </div>
      </div>
      <CardContent className="p-0">
        <ol className="divide-y divide-border/60">
          {steps.map((step, index) => (
            <li key={step.title} className="flex items-start gap-4 px-6 py-4">
              <span
                className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  step.done
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground',
                )}
                aria-hidden
              >
                {step.done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-medium', step.done && 'text-muted-foreground')}>
                  {step.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
              </div>
              <div className="shrink-0">{step.action}</div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ── Delivery health ──────────────────────────────────────────────────────────

export function DeliveryHealthCard({
  summary,
  canRun,
}: {
  summary: NewsletterDashboardSummary;
  canRun: boolean;
}) {
  const processor = summary.processor;
  const health = schedulerHealth(processor);
  const runNow = useRunProcessorNow();
  const attention = health.level !== 'live' || Boolean(processor?.lastError);

  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Activity}
          title="Background delivery"
          description="Runs every 30 seconds, whether or not anyone is signed in"
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5',
            attention ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-emerald-50 dark:bg-emerald-950/30',
          )}
        >
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              attention
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
            )}
          >
            {attention ? (
              <AlertTriangle className="h-4 w-4" aria-hidden />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {processor?.lastError ? 'Needs attention' : health.label}
            </p>
            <p className="text-xs text-muted-foreground">
              {health.level === 'live' && processor?.lastCronRunAt
                ? `Last check-in ${formatRelative(processor.lastCronRunAt)}`
                : health.detail}
            </p>
          </div>
        </div>

        {processor ? (
          <dl className="divide-y divide-border/60">
            <DetailRow label="Last run">
              {formatRelative(processor.lastRunAt)}
              <span className="ml-1 font-normal text-muted-foreground">
                ({processor.mode === 'cron' ? 'scheduler' : 'admin browser'})
              </span>
            </DetailRow>
            <DetailRow label="Last successful run">
              {formatDateTime(processor.lastSuccessAt)}
            </DetailRow>
            <DetailRow label="Sent in last run">{formatNumber(processor.sentInLastRun)}</DetailRow>
            {processor.failedInLastRun > 0 ? (
              <DetailRow label="Failed in last run">
                <span className="text-rose-600 dark:text-rose-400">
                  {formatNumber(processor.failedInLastRun)}
                </span>
              </DetailRow>
            ) : null}
            <DetailRow label="Campaigns in flight">
              {formatNumber(summary.campaigns.active)}
            </DetailRow>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            No delivery pass has run yet. The first one starts as soon as a campaign is queued.
          </p>
        )}

        {processor?.lastError ? (
          <Notice tone="warn" icon={AlertTriangle} title="Last run reported a problem">
            <span className="break-words">{processor.lastError}</span>
          </Notice>
        ) : null}

        {health.level === 'missing' ? (
          <Notice tone="warn" icon={Clock} title="Scheduled sends need the delivery job">
            Campaigns still send while an admin has the studio open. For unattended delivery an
            operator installs the job from{' '}
            <code className="rounded bg-black/5 px-1 py-0.5 text-[11px] dark:bg-white/10">
              supabase/cron/newsletter-studio-jobs.sql
            </code>
            .
          </Notice>
        ) : null}

        {canRun ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => runNow.mutate()}
            disabled={runNow.isPending}
          >
            {runNow.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Play className="h-4 w-4" aria-hidden />
            )}
            Run a delivery pass now
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ── Shortcuts ────────────────────────────────────────────────────────────────

function ShortcutsCard({
  summary,
  onNavigate,
}: {
  summary: NewsletterDashboardSummary;
  onNavigate: (tab: StudioTab) => void;
}) {
  const items = [
    {
      icon: Layers,
      label: 'Campaigns',
      hint: pluralize(summary.campaigns.total, 'campaign'),
      tab: 'campaigns' as const,
    },
    {
      icon: FileText,
      label: 'Templates',
      hint: pluralize(summary.templateCount, 'template'),
      tab: 'templates' as const,
    },
    {
      icon: Users,
      label: 'Audiences',
      hint: pluralize(summary.listCount, 'list'),
      tab: 'audiences' as const,
    },
  ];
  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <SectionHeader title="Jump to" />
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.tab}>
              <button
                type="button"
                onClick={() => onNavigate(item.tab)}
                className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
              >
                <span className="rounded-lg bg-gray-50 p-1.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  <item.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.hint}</span>
                </span>
                <ChevronRight
                  className="h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6" data-testid="newsletter-dashboard-skeleton">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="gap-0">
            <CardContent className="p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-3 h-8 w-20" />
              <Skeleton className="mt-3 h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="gap-0 lg:col-span-2">
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card className="gap-0">
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
