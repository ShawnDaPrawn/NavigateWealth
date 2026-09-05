import { Badge } from '../../../../ui/badge';
import { cn } from '../../../../ui/utils';
import { CAMPAIGN_STATUS_CONFIG, DELIVERY_STATUS_CONFIG } from '../constants';
import type { NewsletterCampaignStatus, NewsletterDeliveryStatus } from '../types';

export function CampaignStatusBadge({
  status,
  className,
}: {
  status: NewsletterCampaignStatus;
  className?: string;
}) {
  const config = CAMPAIGN_STATUS_CONFIG[status] ?? CAMPAIGN_STATUS_CONFIG.draft;
  return (
    <Badge
      variant="outline"
      title={config.description}
      className={cn('gap-1.5 border-transparent font-medium', config.className, className)}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} aria-hidden />
      {config.label}
    </Badge>
  );
}

export function DeliveryStatusBadge({
  status,
  className,
}: {
  status: NewsletterDeliveryStatus;
  className?: string;
}) {
  const config = DELIVERY_STATUS_CONFIG[status] ?? DELIVERY_STATUS_CONFIG.pending;
  return (
    <Badge
      variant="outline"
      title={config.description}
      className={cn('gap-1.5 border-transparent font-medium', config.className, className)}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} aria-hidden />
      {config.label}
    </Badge>
  );
}
