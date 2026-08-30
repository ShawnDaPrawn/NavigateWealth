import { Badge } from '../../../../ui/badge';
import { CAMPAIGN_STATUS_CONFIG, DELIVERY_STATUS_CONFIG } from '../constants';
import type { NewsletterCampaignStatus, NewsletterDeliveryStatus } from '../types';

export function CampaignStatusBadge({ status }: { status: NewsletterCampaignStatus }) {
  const config = CAMPAIGN_STATUS_CONFIG[status] ?? CAMPAIGN_STATUS_CONFIG.draft;
  return (
    <Badge variant="outline" className={`border-transparent ${config.className}`}>
      {config.label}
    </Badge>
  );
}

export function DeliveryStatusBadge({ status }: { status: NewsletterDeliveryStatus }) {
  const config = DELIVERY_STATUS_CONFIG[status] ?? DELIVERY_STATUS_CONFIG.pending;
  return (
    <Badge variant="outline" className={`border-transparent ${config.className}`}>
      {config.label}
    </Badge>
  );
}
