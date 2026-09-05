/**
 * Newsletter Studio — campaign lifecycle predicates mirrored from the server
 * so the UI only offers actions the API will accept.
 */
import type { NewsletterCampaign } from '../types';

const DELETABLE_STATUSES: NewsletterCampaign['status'][] = ['draft', 'finished', 'cancelled'];

export function isCampaignDeletable(campaign: NewsletterCampaign): boolean {
  return DELETABLE_STATUSES.includes(campaign.status);
}
