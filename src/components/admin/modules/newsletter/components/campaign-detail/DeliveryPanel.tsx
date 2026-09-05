/**
 * Newsletter Studio — delivery progress, engagement and link performance for
 * one campaign. Pure presentation over the campaign view + stats.
 */
import { Link2, MousePointerClick, Send } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../../../../ui/card';
import { Progress } from '../../../../../ui/progress';
import { cn } from '../../../../../ui/utils';
import type { NewsletterCampaign, NewsletterCampaignStats } from '../../types';
import { formatNumber, formatRate, ratePercent } from '../../utils/format';
import { InlineStat, MiniBar, SectionHeader } from '../shared';

export function DeliveryPanel({
  campaign,
  stats,
}: {
  campaign: NewsletterCampaign;
  stats: NewsletterCampaignStats | undefined;
}) {
  const live = campaign.status === 'queued' || campaign.status === 'sending';
  const pending = stats?.pendingCount ?? campaign.pendingCount;
  const indicator =
    campaign.status === 'finished'
      ? 'bg-emerald-500'
      : campaign.status === 'paused' || campaign.stuck
        ? 'bg-amber-500'
        : campaign.status === 'cancelled'
          ? 'bg-slate-400'
          : 'bg-purple-600';

  return (
    <Card className="gap-0">
      <CardHeader className="pb-4">
        <SectionHeader
          icon={Send}
          title="Delivery"
          description={
            live
              ? 'Updating live while the campaign sends'
              : `${formatNumber(campaign.sentCount)} of ${formatNumber(campaign.recipientCount)} recipients reached`
          }
          action={
            <span className="text-2xl font-semibold tabular-nums tracking-tight">
              {Math.round(campaign.progressPercent)}%
            </span>
          }
        />
      </CardHeader>
      <CardContent className="space-y-5">
        <Progress
          value={campaign.progressPercent}
          className={cn('h-2.5', live && 'animate-pulse')}
          indicatorClassName={indicator}
          aria-label="Delivery progress"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InlineStat label="Recipients" value={formatNumber(campaign.recipientCount)} />
          <InlineStat
            label="Delivered"
            value={formatNumber(campaign.sentCount)}
            tone={campaign.sentCount > 0 ? 'emerald' : 'default'}
            hint={formatRate(campaign.sentCount, campaign.recipientCount)}
          />
          <InlineStat
            label="Pending"
            value={formatNumber(pending)}
            tone={pending > 0 && !live ? 'amber' : 'default'}
            hint={pending > 0 && live ? 'sending in batches of 20' : undefined}
          />
          <InlineStat
            label="Failed"
            value={formatNumber(campaign.failedCount)}
            tone={campaign.failedCount > 0 ? 'rose' : 'default'}
            hint={
              campaign.failedCount > 0
                ? `${formatRate(campaign.failedCount, campaign.recipientCount)} of recipients`
                : undefined
            }
          />
        </div>

        {stats && campaign.sentCount > 0 ? (
          <div className="border-t border-border/60 pt-5">
            <SectionHeader
              icon={MousePointerClick}
              title="Engagement"
              description="No tracking pixel — an open is recorded when a recipient clicks through"
              className="mb-3"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <EngagementStat
                label="Open rate"
                value={`${stats.openRate}%`}
                bar={stats.openRate}
                hint={`${formatNumber(stats.openCount)} opened`}
              />
              <EngagementStat
                label="Click rate"
                value={`${stats.clickRate}%`}
                bar={stats.clickRate}
                hint={`${formatNumber(stats.clickCount)} clicks in total`}
              />
              <EngagementStat
                label="Unique clickers"
                value={formatNumber(stats.clickedRecipientCount)}
                bar={ratePercent(stats.clickedRecipientCount, stats.sentCount)}
                hint={`${formatRate(stats.clickedRecipientCount, stats.sentCount)} of delivered`}
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EngagementStat({
  label,
  value,
  bar,
  hint,
}: {
  label: string;
  value: string;
  bar: number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <MiniBar value={bar} tone="blue" className="mt-2" />
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function LinkPerformance({ stats }: { stats: NewsletterCampaignStats }) {
  if (stats.links.length === 0) return null;
  const top = Math.max(...stats.links.map((link) => link.clickCount), 1);
  const links = [...stats.links].sort((a, b) => b.clickCount - a.clickCount);
  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Link2}
          title="Link performance"
          description="Clicks per destination, most popular first"
        />
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {links.map((link) => (
            <li key={link.id}>
              <div className="flex items-center justify-between gap-4 text-sm">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="min-w-0 truncate font-mono text-xs text-purple-700 hover:underline dark:text-purple-300"
                  title={link.url}
                >
                  {link.url}
                </a>
                <span className="shrink-0 tabular-nums">
                  {formatNumber(link.clickCount)}{' '}
                  <span className="text-xs text-muted-foreground">
                    {link.clickCount === 1 ? 'click' : 'clicks'}
                  </span>
                </span>
              </div>
              <MiniBar value={(link.clickCount / top) * 100} tone="purple" className="mt-1.5" />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
