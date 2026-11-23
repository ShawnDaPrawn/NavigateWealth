/**
 * Communication Centre History — campaigns and every logged email, one list.
 *
 * The History used to list only campaigns and individual messages, a dozen
 * rows, while thousands of newsletters, article notifications and automated
 * emails had gone out unseen. Pinned here:
 *   1. Both sources are merged newest first and paged across the merge.
 *   2. Filters route to the source(s) that can match them.
 *   3. A failing email log does not take History down.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const campaigns = vi.hoisted(() => ({
  filterCampaignRows: vi.fn(),
}));
const deliveryLog = vi.hoisted(() => ({
  listDeliveryGroups: vi.fn(),
  listDeliveryKinds: vi.fn(),
}));

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../communication-campaigns.ts', () => campaigns);
vi.mock('../email-delivery-log.ts', () => deliveryLog);

import {
  listUnifiedHistory,
  parseHistorySource,
  planHistorySources,
} from '../communication-history-unified.ts';

const campaign = (id: string, createdAt: string) => ({
  id,
  createdAt,
  subject: id,
  createdBy: 'admin-1',
  createdByName: 'Adviser',
});
const group = (key: string, firstAt: string, kind = 'client_birthday') => ({
  groupKey: key,
  kind,
  batchId: null,
  firstAt,
  lastAt: firstAt,
  subject: key,
  preview: null,
  recipient: 'c@example.com',
  cc: null,
  total: 1,
  sent: 1,
  failed: 0,
  status: 'sent',
  lastError: null,
  providerMessageId: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  campaigns.filterCampaignRows.mockResolvedValue({
    rows: [campaign('c-new', '2026-11-20T00:00:00Z'), campaign('c-old', '2026-11-01T00:00:00Z')],
    senderOptions: [{ userId: 'admin-1', label: 'Adviser' }],
  });
  deliveryLog.listDeliveryGroups.mockResolvedValue({
    groups: [group('d-newest', '2026-11-23T06:00:00Z'), group('d-mid', '2026-11-10T00:00:00Z')],
    total: 2,
  });
  deliveryLog.listDeliveryKinds.mockResolvedValue([
    { kind: 'newsletter', sends: 2 },
    { kind: 'client_birthday', sends: 1 },
    { kind: 'some_retired_kind', sends: 4 },
  ]);
});

describe('parseHistorySource', () => {
  it('accepts the three origins and catalogued kinds only', () => {
    expect(parseHistorySource('campaign')).toBe('campaign');
    expect(parseHistorySource(' automated ')).toBe('automated');
    expect(parseHistorySource('kind:client_birthday')).toBe('kind:client_birthday');
    expect(parseHistorySource('kind:not_a_kind')).toBeUndefined();
    expect(parseHistorySource('')).toBeUndefined();
    expect(parseHistorySource(undefined)).toBeUndefined();
  });
});

describe('planHistorySources', () => {
  it('reads both sources when nothing narrows it', () => {
    expect(planHistorySources({})).toEqual({ campaigns: true, deliveries: true });
  });

  it('an email type or "automated" reads only the log', () => {
    expect(planHistorySources({ source: 'kind:newsletter' })).toEqual({
      campaigns: false,
      deliveries: true,
    });
    expect(planHistorySources({ source: 'automated' }).campaigns).toBe(false);
  });

  it('campaign-only filters skip the log', () => {
    expect(planHistorySources({ source: 'direct' }).deliveries).toBe(false);
    expect(planHistorySources({ channel: 'whatsapp' }).deliveries).toBe(false);
    expect(planHistorySources({ createdBy: 'admin-1' }).deliveries).toBe(false);
    expect(planHistorySources({ recipientType: 'group' }).deliveries).toBe(false);
    expect(planHistorySources({ status: 'scheduled' }).deliveries).toBe(false);
  });

  it('the System sender and delivery statuses keep the log in', () => {
    expect(planHistorySources({ createdBy: 'system', status: 'partial' }).deliveries).toBe(true);
    expect(planHistorySources({ status: 'sent' })).toEqual({ campaigns: true, deliveries: true });
  });
});

describe('listUnifiedHistory', () => {
  it('merges both sources newest first and counts both', async () => {
    const result = await listUnifiedHistory({ page: 1, limit: 10 });
    expect(
      result.items.map((i) => (i.type === 'campaign' ? i.campaign.id : i.delivery.groupKey)),
    ).toEqual(['d-newest', 'c-new', 'd-mid', 'c-old']);
    expect(result.total).toBe(4);
    const birthday = result.items[0];
    expect(birthday.type === 'delivery' && birthday.delivery.kindLabel).toBe('Birthday greeting');
  });

  it('pages across the merge, asking the log for page*limit rows', async () => {
    const result = await listUnifiedHistory({ page: 2, limit: 2 });
    expect(deliveryLog.listDeliveryGroups).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 4, offset: 0 }),
    );
    expect(result.items.map((i) => i.at)).toEqual(['2026-11-10T00:00:00Z', '2026-11-01T00:00:00Z']);
  });

  it('passes an email type through to the log and drops campaign rows', async () => {
    const result = await listUnifiedHistory({ page: 1, limit: 10, source: 'kind:client_birthday' });
    expect(deliveryLog.listDeliveryGroups).toHaveBeenCalledWith(
      expect.objectContaining({ kinds: ['client_birthday'] }),
    );
    expect(result.items.every((i) => i.type === 'delivery')).toBe(true);
    expect(result.total).toBe(2);
  });

  it('maps "sent" to completed campaigns and keeps the narrower recipient types', async () => {
    await listUnifiedHistory({ page: 1, limit: 10, status: 'sent', recipientType: 'single' });
    expect(campaigns.filterCampaignRows).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', recipientType: 'single' }),
    );
    expect(deliveryLog.listDeliveryGroups).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent', recipientType: 'single' }),
    );
  });

  it('does not query the log when the filters cannot match it', async () => {
    const result = await listUnifiedHistory({ page: 1, limit: 10, source: 'direct' });
    expect(deliveryLog.listDeliveryGroups).not.toHaveBeenCalled();
    expect(result.total).toBe(2);
    expect(campaigns.filterCampaignRows).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'direct' }),
    );
  });

  it('offers the sent kinds, labelled and sorted, and a System sender', async () => {
    const result = await listUnifiedHistory({ page: 1, limit: 10 });
    expect(result.kindOptions).toEqual([
      { kind: 'client_birthday', label: 'Birthday greeting', audience: 'client', sends: 1 },
      { kind: 'newsletter', label: 'Newsletter', audience: 'client', sends: 2 },
      { kind: 'some_retired_kind', label: 'some_retired_kind', audience: 'client', sends: 4 },
    ]);
    expect(result.senderOptions).toContainEqual({ userId: 'system', label: 'System (automated)' });
  });

  it('still lists campaigns when the email log cannot be read', async () => {
    deliveryLog.listDeliveryGroups.mockRejectedValue(new Error('relation does not exist'));
    const result = await listUnifiedHistory({ page: 1, limit: 10 });
    expect(result.deliveryLogUnavailable).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.senderOptions).not.toContainEqual(expect.objectContaining({ userId: 'system' }));
  });

  it('clamps page and limit', async () => {
    const result = await listUnifiedHistory({ page: 0, limit: 500 });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(100);
  });
});
