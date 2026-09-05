/**
 * newsletter-studio-service.ts — campaign lifecycle contracts
 * ===========================================================
 *
 * The invariants worth pinning, in order of blast radius:
 *
 *   1. **POPIA: an opt-out sticks.** Audience resolution must drop anyone
 *      whose newsletter record says `active: false`, whatever group they sit
 *      in — a custom group edited by hand is exactly where a stale member
 *      lingers.
 *   2. **Lifecycle gates.** Editing/sending/deleting are status-gated so a
 *      campaign mid-delivery cannot be mutated under the processor, and a
 *      cancelled/finished campaign cannot quietly restart.
 *   3. **Click-through is capability-gated.** Unknown campaign/token/link ids
 *      resolve to null (the route 404s) and the returned URL is always the
 *      author-stored one.
 *
 * Real collaborators: the in-memory KV (through the real repository layer)
 * and the real link extractor. Groups, clients, subscribers and the email
 * barrel are stubbed at the module seam.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const deps = vi.hoisted(() => ({
  getGroupById: vi.fn(),
  getGroups: vi.fn(async () => ({ data: [], total: 0, limit: 1000, offset: 0 })),
  getAllClients: vi.fn(async () => [] as unknown[]),
  listSubscribers: vi.fn(async () => [] as { email: string; active?: boolean }[]),
  removeNewsletterSubscriber: vi.fn(async () => undefined),
  getStats: vi.fn(async () => ({
    totalSubscribers: 10,
    confirmedSubscribers: 8,
    activeSubscribers: 6,
    totalBroadcasts: 2,
    broadcastsThisMonth: 1,
    lastBroadcastAt: null,
    lastBroadcastSubject: null,
  })),
}));

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../communication-repo.ts', () => ({
  getGroupById: deps.getGroupById,
  getGroups: deps.getGroups,
}));
vi.mock('../communication-messaging.ts', () => ({ getAllClients: deps.getAllClients }));
vi.mock('../newsletter-service.ts', () => ({
  listSubscribers: deps.listSubscribers,
  getStats: deps.getStats,
}));
vi.mock('../newsletter-group-service.ts', () => ({
  removeNewsletterSubscriber: deps.removeNewsletterSubscriber,
}));
vi.mock('../email-service.ts', () => ({
  createEmailTemplate: (content: string) => `<w>${content}</w>`,
  createPlainTextEmail: (content: string) => content,
  getFooterSettings: async () => ({}),
  sendEmail: vi.fn(),
}));

import { kvStore } from './helpers/contract-harness.ts';
import {
  cancelCampaign,
  createCampaign,
  createTemplate,
  deleteCampaign,
  deleteTemplate,
  duplicateCampaign,
  getCampaignRecipients,
  getCampaignStats,
  getCampaignView,
  getDashboardSummary,
  listAudienceLists,
  listCampaigns,
  listTemplates,
  pauseCampaign,
  promoteDueScheduledCampaign,
  recordCampaignClick,
  resolveAudience,
  resumeCampaign,
  scheduleCampaign,
  sendCampaignNow,
  unsubscribeByRecipientToken,
  updateCampaign,
  updateTemplate,
} from '../newsletter-studio-service.ts';

const GROUP = {
  id: 'sys_newsletter_contacts',
  name: 'Newsletter Contacts',
  description: '',
  type: 'system',
  clientIds: [] as string[],
  externalContacts: [] as { email: string; name?: string; source: string; subscribedAt: string }[],
  clientCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'system',
};

const external = (email: string, name?: string) => ({
  email,
  name,
  source: 'newsletter',
  subscribedAt: '2026-01-01T00:00:00.000Z',
});

function seedGroup(overrides: Partial<typeof GROUP> = {}) {
  const group = { ...GROUP, ...overrides };
  deps.getGroupById.mockImplementation(async (id: string) => (id === group.id ? group : null));
  return group;
}

async function makeDraft(overrides: Record<string, unknown> = {}) {
  seedGroup({
    externalContacts: [external('a@x.co', 'Ann A'), external('b@x.co', 'Ben B')],
  });
  return createCampaign(
    {
      name: 'August newsletter',
      subject: 'August update',
      listIds: ['sys_newsletter_contacts'],
      bodyHtml: '<p>Hi {{firstName}}</p><a href="https://a.example/one">read</a>',
      ...overrides,
    },
    'admin-1',
  );
}

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  deps.getGroups.mockResolvedValue({ data: [], total: 0, limit: 1000, offset: 0 });
  deps.getAllClients.mockResolvedValue([]);
  deps.listSubscribers.mockResolvedValue([]);
});

describe('campaign CRUD', () => {
  it('creates a draft snapshotting the audience list names', async () => {
    const campaign = await makeDraft();
    expect(campaign.status).toBe('draft');
    expect(campaign.listNames).toEqual(['Newsletter Contacts']);
    expect(campaign.trackClicks).toBe(true);
    expect(campaign.recipientCount).toBe(0);
  });

  it('rejects creation against an unknown list', async () => {
    deps.getGroupById.mockResolvedValue(null);
    await expect(
      createCampaign(
        { name: 'x', subject: 'y', listIds: ['nope'], bodyHtml: '<p>b</p>' },
        'admin-1',
      ),
    ).rejects.toThrow(/Unknown audience list/);
  });

  it('edits drafts but refuses once delivery has begun', async () => {
    const campaign = await makeDraft();
    const updated = await updateCampaign(campaign.id, { subject: 'Better subject' });
    expect(updated.subject).toBe('Better subject');

    await sendCampaignNow(campaign.id);
    await expect(updateCampaign(campaign.id, { subject: 'Too late' })).rejects.toThrow(
      /no longer be edited/,
    );
  });

  it('duplicates content into a fresh draft', async () => {
    const campaign = await makeDraft();
    const copy = await duplicateCampaign(campaign.id, 'admin-2');
    expect(copy.id).not.toBe(campaign.id);
    expect(copy.name).toBe('August newsletter (copy)');
    expect(copy.status).toBe('draft');
    expect(copy.createdBy).toBe('admin-2');
  });

  it('lists newest-first with status filter and search', async () => {
    const a = await makeDraft({ name: 'Alpha news' });
    await makeDraft({ name: 'Beta brief' });
    const all = await listCampaigns();
    expect(all.total).toBe(2);

    const searched = await listCampaigns({ search: 'alpha' });
    expect(searched.campaigns.map((c) => c.id)).toEqual([a.id]);

    await sendCampaignNow(a.id);
    const drafts = await listCampaigns({ status: 'draft' });
    expect(drafts.total).toBe(1);
  });
});

describe('audience resolution (POPIA)', () => {
  it('drops explicit opt-outs whatever group they sit in', async () => {
    seedGroup({ externalContacts: [external('keep@x.co'), external('optout@x.co')] });
    deps.listSubscribers.mockResolvedValue([
      { email: 'optout@x.co', active: false },
      { email: 'keep@x.co', active: true },
    ]);
    const audience = await resolveAudience(['sys_newsletter_contacts']);
    expect(audience.items.map((i) => i.email)).toEqual(['keep@x.co']);
    expect(audience.excludedUnsubscribed).toBe(1);
  });

  it('resolves client members through the communication client list and dedupes by email', async () => {
    seedGroup({
      externalContacts: [external('shared@x.co', 'External Copy')],
      clientIds: ['client-1', 'client-2', 'client-gone'],
    });
    deps.getAllClients.mockResolvedValue([
      { id: 'client-1', email: 'shared@x.co', name: 'Client Copy' },
      { id: 'client-2', email: 'unique@x.co', name: 'Uma Unique' },
    ]);
    const audience = await resolveAudience(['sys_newsletter_contacts']);
    expect(audience.items.map((i) => i.email).sort()).toEqual(['shared@x.co', 'unique@x.co']);
    const uma = audience.items.find((i) => i.email === 'unique@x.co')!;
    expect(uma.firstName).toBe('Uma');
    expect(uma.token).toMatch(/^[0-9a-f]{32}$/);
  });

  it('counts invalid addresses instead of queueing them', async () => {
    seedGroup({ externalContacts: [external('not-an-email'), external('ok@x.co')] });
    const audience = await resolveAudience(['sys_newsletter_contacts']);
    expect(audience.items.map((i) => i.email)).toEqual(['ok@x.co']);
    expect(audience.excludedInvalid).toBe(1);
  });
});

describe('subscriber base as a first-class audience', () => {
  const subs = [
    { email: 'sub-a@x.co', name: 'Sasha Able', confirmed: true, active: true },
    { email: 'sub-b@x.co', name: 'Bo Baker', confirmed: true, active: true },
    { email: 'pending@x.co', name: 'Pat Pending', confirmed: false, active: false },
    { email: 'gone@x.co', name: 'Gone Guest', confirmed: true, active: false },
  ];

  it('lists and resolves confirmed active subscribers even when the group record is missing', async () => {
    deps.getGroupById.mockResolvedValue(null);
    deps.listSubscribers.mockResolvedValue(subs);

    const lists = await listAudienceLists();
    expect(lists[0]).toMatchObject({
      id: 'sys_newsletter_contacts',
      type: 'system',
      memberCount: 2,
      externalContactCount: 2,
    });

    const campaign = await createCampaign(
      { name: 'x', subject: 'y', listIds: ['sys_newsletter_contacts'], bodyHtml: '<p>b</p>' },
      'admin-1',
    );
    expect(campaign.listNames).toEqual(['Newsletter Contacts']);

    const audience = await resolveAudience(['sys_newsletter_contacts']);
    expect(audience.items.map((i) => i.email).sort()).toEqual(['sub-a@x.co', 'sub-b@x.co']);
    expect(audience.items.find((i) => i.email === 'sub-a@x.co')?.firstName).toBe('Sasha');
  });

  it('unions a lagging group record with the consent records without double counting', async () => {
    const group = seedGroup({
      externalContacts: [external('sub-a@x.co'), external('legacy@x.co')],
    });
    deps.getGroups.mockResolvedValue({ data: [group], total: 1, limit: 1000, offset: 0 });
    deps.listSubscribers.mockResolvedValue(subs);

    const [list] = await listAudienceLists();
    expect(list.id).toBe('sys_newsletter_contacts');
    expect(list.memberCount).toBe(3); // sub-a, sub-b, legacy

    const audience = await resolveAudience(['sys_newsletter_contacts']);
    expect(audience.items.map((i) => i.email).sort()).toEqual([
      'legacy@x.co',
      'sub-a@x.co',
      'sub-b@x.co',
    ]);
  });

  it('still rejects genuinely unknown lists', async () => {
    deps.getGroupById.mockResolvedValue(null);
    await expect(
      createCampaign(
        { name: 'x', subject: 'y', listIds: ['sys_newsletter_contacts', 'nope'], bodyHtml: 'b' },
        'admin-1',
      ),
    ).rejects.toThrow(/Unknown audience list\(s\): nope/);
  });
});

describe('lifecycle transitions', () => {
  it('send-now freezes the audience, extracts links and queues', async () => {
    const campaign = await makeDraft();
    const queued = await sendCampaignNow(campaign.id);
    expect(queued.status).toBe('queued');
    expect(queued.recipientCount).toBe(2);
    expect(queued.links).toEqual([{ id: 'l1', url: 'https://a.example/one' }]);
  });

  it('finishes immediately when no one is eligible', async () => {
    seedGroup({ externalContacts: [] });
    const campaign = await createCampaign(
      { name: 'empty', subject: 's', listIds: ['sys_newsletter_contacts'], bodyHtml: '<p>b</p>' },
      'admin-1',
    );
    const done = await sendCampaignNow(campaign.id);
    expect(done.status).toBe('finished');
    expect(done.lastError).toMatch(/No eligible recipients/);
  });

  it('schedules only into the future', async () => {
    const campaign = await makeDraft();
    await expect(scheduleCampaign(campaign.id, '2020-01-01T00:00:00.000Z')).rejects.toThrow(
      /future/,
    );
    const scheduled = await scheduleCampaign(
      campaign.id,
      new Date(Date.now() + 3_600_000).toISOString(),
    );
    expect(scheduled.status).toBe('scheduled');
  });

  it('pause → resume → cancel drive the expected states and reject nonsense', async () => {
    const campaign = await makeDraft();
    await expect(pauseCampaign(campaign.id)).rejects.toThrow(/cannot be paused/);

    await sendCampaignNow(campaign.id);
    const paused = await pauseCampaign(campaign.id);
    expect(paused.status).toBe('paused');

    const resumed = await resumeCampaign(campaign.id);
    expect(resumed.status).toBe('queued');

    const cancelled = await cancelCampaign(campaign.id);
    expect(cancelled.status).toBe('cancelled');
    await expect(resumeCampaign(campaign.id)).rejects.toThrow(/Only paused/);
  });

  it('refuses to delete an active campaign, then deletes after cancel', async () => {
    const campaign = await makeDraft();
    await sendCampaignNow(campaign.id);
    await expect(deleteCampaign(campaign.id)).rejects.toThrow(/Cancel the campaign/);

    await cancelCampaign(campaign.id);
    await deleteCampaign(campaign.id);
    await expect(getCampaignView(campaign.id)).rejects.toThrow(/not found/);
  });
});

describe('audience resolution races (review finding)', () => {
  it('abandons the queue write when the campaign is cancelled mid-resolve', async () => {
    const campaign = await makeDraft();
    const scheduledAt = new Date(Date.now() + 3_600_000).toISOString();
    await scheduleCampaign(campaign.id, scheduledAt);
    const scheduled = kvStore.get(`nlstudio:campaign:${campaign.id}`) as Record<string, unknown>;

    // Cancel lands while resolveAudience is awaiting its reads.
    deps.listSubscribers.mockImplementation(async () => {
      kvStore.set(`nlstudio:campaign:${campaign.id}`, {
        ...(kvStore.get(`nlstudio:campaign:${campaign.id}`) as Record<string, unknown>),
        status: 'cancelled',
        updatedAt: new Date(Date.now() + 1000).toISOString(),
      });
      return [];
    });

    const result = await promoteDueScheduledCampaign(scheduled as never);

    // The cancel stands — no resurrection to 'queued', no audience written.
    expect(result.status).toBe('cancelled');
    const stored = kvStore.get(`nlstudio:campaign:${campaign.id}`) as { status: string };
    expect(stored.status).toBe('cancelled');
    expect(kvStore.get(`nlstudio:audience:${campaign.id}`)).toBeUndefined();
  });

  it('abandons the queue write when the campaign is edited mid-resolve', async () => {
    const campaign = await makeDraft();
    const before = kvStore.get(`nlstudio:campaign:${campaign.id}`) as Record<string, unknown>;

    deps.listSubscribers.mockImplementation(async () => {
      kvStore.set(`nlstudio:campaign:${campaign.id}`, {
        ...(kvStore.get(`nlstudio:campaign:${campaign.id}`) as Record<string, unknown>),
        subject: 'Edited after send was clicked',
        updatedAt: new Date(Date.now() + 1000).toISOString(),
      });
      return [];
    });

    const result = await sendCampaignNow(campaign.id);

    // Pre-edit content is never queued against a pre-edit audience.
    expect(result.status).toBe('draft');
    expect(result.subject).toBe('Edited after send was clicked');
    expect(kvStore.get(`nlstudio:audience:${campaign.id}`)).toBeUndefined();
    expect(before.subject).toBe('August update');
  });

  it('still queues normally when nothing changes underneath it', async () => {
    const campaign = await makeDraft();
    const queued = await sendCampaignNow(campaign.id);
    expect(queued.status).toBe('queued');
    expect(queued.recipientCount).toBe(2);
  });
});

describe('recipients, clicks and stats', () => {
  it('reports queued members as pending before any delivery record exists', async () => {
    const campaign = await makeDraft();
    await sendCampaignNow(campaign.id);
    const page = await getCampaignRecipients(campaign.id);
    expect(page.total).toBe(2);
    expect(page.recipients.every((r) => r.deliveryStatus === 'pending')).toBe(true);
  });

  it('records clicks as engagement and returns only the stored destination', async () => {
    const campaign = await makeDraft();
    const queued = await sendCampaignNow(campaign.id);
    const page = await getCampaignRecipients(campaign.id);
    const token = page.recipients[0].token;

    // Unknown ids resolve to null — the route 404s, nothing leaks.
    expect(await recordCampaignClick(campaign.id, token, 'wrong-link')).toBeNull();
    expect(await recordCampaignClick(campaign.id, 'wrong-token', 'l1')).toBeNull();
    expect(await recordCampaignClick('wrong-campaign', token, 'l1')).toBeNull();
    // No delivery record yet — the token is not live until first attempt.
    expect(await recordCampaignClick(campaign.id, token, 'l1')).toBeNull();

    // Simulate the processor having written the recipient record.
    kvStore.set(`nlstudio:recipient:${campaign.id}:${token}`, {
      campaignId: campaign.id,
      token,
      email: page.recipients[0].email,
      name: page.recipients[0].name,
      firstName: page.recipients[0].firstName,
      deliveryStatus: 'sent',
      deliveryError: null,
      attemptCount: 1,
      lastAttemptedAt: '2026-08-29T10:00:00.000Z',
      sentAt: '2026-08-29T10:00:00.000Z',
      openedAt: null,
      clicks: [],
    });

    const outcome = await recordCampaignClick(campaign.id, token, 'l1');
    expect(outcome).toEqual({ url: 'https://a.example/one' });

    const stats = await getCampaignStats(campaign.id);
    expect(stats.sentCount).toBe(1);
    expect(stats.openCount).toBe(1); // click-derived open
    expect(stats.clickCount).toBe(1);
    expect(stats.links).toEqual([{ id: 'l1', url: 'https://a.example/one', clickCount: 1 }]);
    expect(queued.recipientCount).toBe(2);
  });
});

describe('one-click unsubscribe (RFC 8058)', () => {
  it('resolves the token, upserts an inactive consent record and syncs the group', async () => {
    const campaign = await makeDraft();
    await sendCampaignNow(campaign.id);
    const page = await getCampaignRecipients(campaign.id);
    const { token, email } = page.recipients[0];

    // The recipient record exists once delivery has started.
    kvStore.set(`nlstudio:recipient:${campaign.id}:${token}`, {
      campaignId: campaign.id,
      token,
      email,
      name: 'Ann A',
      firstName: 'Ann',
      deliveryStatus: 'sent',
      deliveryError: null,
      attemptCount: 1,
      lastAttemptedAt: '2026-08-29T10:00:00.000Z',
      sentAt: '2026-08-29T10:00:00.000Z',
      openedAt: null,
      clicks: [],
    });

    const outcome = await unsubscribeByRecipientToken(campaign.id, token);
    expect(outcome).toEqual({ email });

    // Even a member with no prior newsletter record ends up with an
    // explicit opt-out — the thing audience resolution excludes on.
    const consent = kvStore.get(`newsletter:${email}`) as { active: boolean; removedBy: string };
    expect(consent.active).toBe(false);
    expect(consent.removedBy).toBe('one-click');
    expect(deps.removeNewsletterSubscriber).toHaveBeenCalledWith(email);
  });

  it('preserves an existing consent record while deactivating it', async () => {
    const campaign = await makeDraft();
    await sendCampaignNow(campaign.id);
    const page = await getCampaignRecipients(campaign.id);
    const { token, email } = page.recipients[0];
    kvStore.set(`nlstudio:recipient:${campaign.id}:${token}`, {
      campaignId: campaign.id,
      token,
      email,
      name: 'Ann A',
      firstName: 'Ann',
      deliveryStatus: 'sent',
      deliveryError: null,
      attemptCount: 1,
      lastAttemptedAt: null,
      sentAt: null,
      openedAt: null,
      clicks: [],
    });
    kvStore.set(`newsletter:${email}`, {
      email,
      firstName: 'Ann',
      source: 'Footer Newsletter',
      confirmed: true,
      active: true,
      subscribedAt: '2026-01-01T00:00:00.000Z',
    });

    await unsubscribeByRecipientToken(campaign.id, token);
    const consent = kvStore.get(`newsletter:${email}`) as Record<string, unknown>;
    expect(consent.active).toBe(false);
    expect(consent.firstName).toBe('Ann');
    expect(consent.source).toBe('Footer Newsletter');
  });

  it('returns null for unknown ids without writing anything', async () => {
    expect(await unsubscribeByRecipientToken('no-campaign', 'no-token')).toBeNull();
    expect(deps.removeNewsletterSubscriber).not.toHaveBeenCalled();
  });
});

describe('templates', () => {
  it('rounds a template through create/update/delete', async () => {
    const template = await createTemplate(
      { name: 'Monthly wrap', bodyHtml: '<p>{{firstName}}</p>' },
      'admin-1',
    );
    expect((await listTemplates()).map((t) => t.id)).toContain(template.id);

    const updated = await updateTemplate(template.id, {
      name: 'Monthly wrap v2',
      bodyHtml: '<p>hi</p>',
    });
    expect(updated.name).toBe('Monthly wrap v2');

    await deleteTemplate(template.id);
    expect((await listTemplates()).length).toBe(0);
    await expect(deleteTemplate(template.id)).rejects.toThrow(/not found/);
  });
});

describe('dashboard', () => {
  it('aggregates subscribers, campaign states and delivery totals', async () => {
    const campaign = await makeDraft();
    await sendCampaignNow(campaign.id);
    const summary = await getDashboardSummary();
    expect(summary.subscribers).toEqual({ total: 10, active: 6, pending: 2, unsubscribed: 2 });
    expect(summary.campaigns.total).toBe(1);
    expect(summary.campaigns.active).toBe(1);
    expect(summary.recentCampaigns[0].id).toBe(campaign.id);
  });
});
