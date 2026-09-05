import { cn } from '../../../../ui/utils';
import type { NewsletterCampaign } from '../types';
import { formatNumber } from '../utils/format';
import { MiniBar } from './shared';

/** Progress bar + counts for any campaign that has an audience frozen. */
export function CampaignProgressLine({
  campaign,
  className,
}: {
  campaign: NewsletterCampaign;
  className?: string;
}) {
  if (campaign.recipientCount <= 0) return null;
  const tone =
    campaign.status === 'finished'
      ? 'emerald'
      : campaign.status === 'paused' || campaign.stuck
        ? 'amber'
        : campaign.status === 'cancelled'
          ? 'slate'
          : 'purple';
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <MiniBar value={campaign.progressPercent} tone={tone} className="max-w-xs flex-1" />
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {formatNumber(campaign.sentCount)}/{formatNumber(campaign.recipientCount)} delivered
        {campaign.failedCount > 0 ? (
          <span className="text-rose-600 dark:text-rose-400"> · {campaign.failedCount} failed</span>
        ) : null}
      </span>
    </div>
  );
}
