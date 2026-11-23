/**
 * Communication Centre History — everything the platform has sent, in one list.
 *
 * Two sources, merged newest first:
 *
 *   1. Campaign rows (KV, communication-campaigns.ts): Communication Centre
 *      campaigns and individual client messages. These carry their own richer
 *      record (group, attachments, sender), so they stay as they are.
 *   2. The email delivery log (email-delivery-log.ts): every other email —
 *      newsletters, article notifications, birthday greetings, e-sign, account
 *      security, onboarding, staff digests. A bulk send is ONE row with its
 *      delivered / failed counts; a one-to-one email is one row.
 *
 * Before this the History listed source 1 only, which is why it showed a
 * dozen rows while thousands of emails had gone out.
 *
 * PAGING ACROSS TWO SOURCES. Page p of size L needs the newest p*L rows of the
 * merged list, and those can only come from the newest p*L of each source.
 * So each source is asked for its first p*L (the campaigns are already in
 * memory; the log is one SQL call), the two are merged, and the page sliced.
 * Pages are capped at MAX_DEPTH rows deep, far past any page anyone reaches.
 *
 * A failing delivery-log query does not take the History down: the campaigns
 * are still returned and `deliveryLogUnavailable` says what is missing.
 */

import { createModuleLogger } from './stderr-logger.ts';
import type { Campaign, CampaignStatus, CommunicationChannel } from './communication-types.ts';
import { filterCampaignRows, type CampaignSenderOption } from './communication-campaigns.ts';
import { listDeliveryGroups, listDeliveryKinds, type DeliveryGroup } from './email-delivery-log.ts';
import { emailKindLabel, EMAIL_KINDS, isEmailKind } from '../../../shared/email/emailKinds.ts';

const log = createModuleLogger('communication-history');

const MAX_DEPTH = 2000;

/**
 * `campaign` / `direct`: the campaign rows of that origin.
 * `automated`: every logged email that is not a campaign or individual message.
 * `kind:<kind>`: one catalogued kind, e.g. `kind:client_birthday`.
 */
export type HistorySource = 'campaign' | 'direct' | 'automated' | `kind:${string}`;

export interface UnifiedHistoryOptions {
  page: number;
  limit: number;
  search?: string;
  channel?: CommunicationChannel;
  recipientType?: 'single' | 'multiple' | 'group';
  createdBy?: string;
  status?: string;
  source?: HistorySource;
}

export type UnifiedHistoryItem =
  | { type: 'campaign'; at: string; campaign: Campaign }
  | { type: 'delivery'; at: string; delivery: DeliveryGroup & { kindLabel: string } };

export interface HistoryKindOption {
  kind: string;
  label: string;
  audience: string;
  sends: number;
}

export interface UnifiedHistoryResult {
  items: UnifiedHistoryItem[];
  total: number;
  page: number;
  limit: number;
  senderOptions: CampaignSenderOption[];
  kindOptions: HistoryKindOption[];
  deliveryLogUnavailable?: boolean;
}

/** Statuses a logged send can have; anything else matches no logged row. */
const DELIVERY_STATUSES = new Set(['completed', 'sent', 'partial', 'failed']);
const CAMPAIGN_STATUSES = new Set<CampaignStatus>([
  'draft',
  'scheduled',
  'sending',
  'completed',
  'partial',
  'failed',
  'rejected',
]);

export function parseHistorySource(raw: string | undefined): HistorySource | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (value === 'campaign' || value === 'direct' || value === 'automated') return value;
  if (value.startsWith('kind:') && isEmailKind(value.slice(5))) return value as HistorySource;
  return undefined;
}

/** Which sources a set of filters can match at all. Pure; exported for tests. */
export function planHistorySources(options: Omit<UnifiedHistoryOptions, 'page' | 'limit'>): {
  campaigns: boolean;
  deliveries: boolean;
} {
  const { source, channel, createdBy, recipientType, status } = options;

  const sourceIsLog = source === 'automated' || source?.startsWith('kind:') === true;
  const campaigns =
    !sourceIsLog &&
    (status === undefined || CAMPAIGN_STATUSES.has(status as CampaignStatus) || status === 'sent');

  const deliveries =
    (source === undefined || sourceIsLog) &&
    (channel === undefined || channel === 'email') &&
    (createdBy === undefined || createdBy === 'system') &&
    recipientType !== 'group' &&
    (status === undefined || DELIVERY_STATUSES.has(status));

  return { campaigns, deliveries };
}

function campaignStatusFilter(status: string | undefined): CampaignStatus | undefined {
  if (status === 'sent') return 'completed';
  return CAMPAIGN_STATUSES.has(status as CampaignStatus) ? (status as CampaignStatus) : undefined;
}

export async function listUnifiedHistory(
  options: UnifiedHistoryOptions,
): Promise<UnifiedHistoryResult> {
  const page = Math.max(1, options.page);
  const limit = Math.min(100, Math.max(1, options.limit));
  const depth = Math.min(MAX_DEPTH, page * limit);
  const plan = planHistorySources(options);

  // ── Campaign rows ────────────────────────────────────────────────────────
  const campaignSource =
    options.source === 'campaign' || options.source === 'direct' ? options.source : undefined;
  // Always read (the sender dropdown is built from every campaign); the rows
  // are dropped when the filters can only match logged sends.
  const filteredCampaigns = await filterCampaignRows({
    search: options.search,
    channel: options.channel,
    recipientType: options.recipientType,
    createdBy: options.createdBy,
    status: campaignStatusFilter(options.status),
    origin: campaignSource,
  });
  const campaignRows = plan.campaigns ? filteredCampaigns.rows : [];
  const senderOptions = filteredCampaigns.senderOptions;

  // ── Logged sends ─────────────────────────────────────────────────────────
  let deliveryGroups: DeliveryGroup[] = [];
  let deliveryTotal = 0;
  let kindOptions: HistoryKindOption[] = [];
  let deliveryLogUnavailable = false;

  try {
    const kindsPromise = listDeliveryKinds();
    if (plan.deliveries) {
      const kinds = options.source?.startsWith('kind:') ? [options.source.slice(5)] : undefined;
      const recipientType =
        options.recipientType === 'single' || options.recipientType === 'multiple'
          ? options.recipientType
          : undefined;
      const result = await listDeliveryGroups({
        kinds,
        status: options.status,
        search: options.search,
        recipientType,
        limit: depth,
        offset: 0,
      });
      deliveryGroups = result.groups;
      deliveryTotal = result.total;
    }
    kindOptions = (await kindsPromise).map(({ kind, sends }) => ({
      kind,
      label: emailKindLabel(kind),
      audience: isEmailKind(kind) ? EMAIL_KINDS[kind].audience : 'client',
      sends,
    }));
    kindOptions.sort((a, b) => a.label.localeCompare(b.label));
  } catch (error) {
    deliveryLogUnavailable = true;
    log.error('Email delivery log unavailable for History', error as Error);
  }

  // ── Merge newest first, then slice the page ──────────────────────────────
  const merged: UnifiedHistoryItem[] = [
    ...campaignRows.slice(0, depth).map((campaign): UnifiedHistoryItem => ({
      type: 'campaign',
      at: campaign.createdAt,
      campaign,
    })),
    ...deliveryGroups.map((group): UnifiedHistoryItem => ({
      type: 'delivery',
      at: group.firstAt,
      delivery: { ...group, kindLabel: emailKindLabel(group.kind) },
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const offset = (page - 1) * limit;
  const withSystem =
    deliveryTotal > 0 && !senderOptions.some((s) => s.userId === 'system')
      ? [...senderOptions, { userId: 'system', label: 'System (automated)' }]
      : senderOptions;

  return {
    items: merged.slice(offset, offset + limit),
    total: campaignRows.length + deliveryTotal,
    page,
    limit,
    senderOptions: withSystem,
    kindOptions,
    ...(deliveryLogUnavailable ? { deliveryLogUnavailable } : {}),
  };
}
