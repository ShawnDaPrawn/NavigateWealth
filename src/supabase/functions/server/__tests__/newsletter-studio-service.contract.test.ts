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
 *   2. **No PDF, no send.** A newsletter cannot be scheduled or sent until
 *      its PDF is stored; the PDF cannot change once delivery has begun.
 *   3. **Lifecycle gates.** Editing/sending/deleting are status-gated so a
 *      campaign mid-delivery cannot be mutated under the processor, and a
 *      cancelled/finished campaign cannot quietly restart.
 *   4. **Click-through is capability-gated.** Unknown campaign/token/link ids
 *      resolve to null (the route 404s) and the returned URL is always a
 *      signed URL for the campaign's own PDF, minted after the token resolves.
 *
 * Real collaborators: the in-memory KV (through the real repository layer)
 * and the real PDF validation. Groups, clients, subscribers, the email barrel
 * and the storage bucket are stubbed at the module seam.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

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

const storage = vi.hoisted(() => ({
  uploaded: [] as { campaignId: string; size: number }[],
  removed: [] as string[],
  removedCampaigns: [] as string[],
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
// Keep validation/encoding real; only the bucket round-trips are stubbed.
vi.mock('../newsletter-studio-storage.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../newsletter-studio-storage.ts')>();
  return {
    ...original,
    storeNewsletterPdf: vi.fn(
      async (input: { campaignId: string; bytes: Uint8Array; fileName: string }) => {
        original.assertValidPdf(input.bytes);
        storage.uploaded.push({ campaignId: input.campaignId, size: input.bytes.length });
        return {
          storagePath: `${input.campaignId}/${storage.uploaded.length}.pdf`,
          fileName: original.safePdfFileName(input.fileName),
          sizeBytes: input.bytes.length,
          uploadedAt: '2026-09-01T00:00:00.000Z',
        };
      },
    ),
    signedNewsletterPdfUrl: vi.fn(async (path: string) => `https://signed.test/${path}?sig=1`),
    removeNewsletterPdf: vi.fn(async (path: string) => {
      storage.removed.push(path);
    }),
    removeNewsletterPdfs: vi.fn(async (campaignId: string) => {
      storage.removedCampaigns.push(campaignId);
    }),
    downloadNewsletterPdf: vi.fn(async () => new TextEncoder().encode('%PDF-1.4 stored')),
  };
});

import { kvStore } from './helpers/contract-harness.ts';
import {
  attachCampaignPdf,
  cancelCampaign,
  createCampaign,
  deleteCampaign,
  findCampaignBySourceRef,
  getCampaignPdfUrl,
  getCampaignRecipients,
  getCampaignStats,
  getCampaignView,
  getDashboardSummary,
  listAudienceLists,
  listCampaigns,
  promoteDueScheduledCampaign,
  recordCampaignClick,
  resolveAudience,
  resumeCampaign,
  scheduleCampaign,
  sendCampaignNow,
  unsubscribeByRecipientToken,
  updateCampaign,
} from '../newsletter-studio-service.ts';

const PDF = new TextEncoder().encode('%PDF-1.4\n%test newsletter\n');

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

async function makeDraft(overrides: Record<string, unknown> = {}, withPdf = true) {
  seedGroup({
    externalContacts: [external('a@x.co', 'Ann A'), external('b@x.co', 'Ben B')],
  });
  const draft = await createCampaign(
    {
      title: 'August newsletter',
      description: 'The one-minute version of what mattered in August.',
      listIds: ['sys_newsletter_contacts'],
      ...overrides,
    },
    'admin-1',
  );
  if (!withPdf) return draft;
  return attachCampaignPdf(draft.id, { bytes: PDF, fileName: 'August Newsletter.pdf' });
}

function seedRecipientRecord(campaignId: string, token: string, email: string) {
  kvStore.set(`nlstudio:recipient:${campaignId}:${token}`, {
    campaignId,
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
}

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  storage.uploaded.length = 0;
  storage.removed.length = 0;
  storage.removedCampaigns.length = 0;
  deps.getGroups.mockResolvedValue({ data: [], total: 0, limit: 1000, offset: 0 });
  deps.getAllClients.mockResolvedValue([]);
  deps.listSubscribers.mockResolvedValue([]);
});

describe('campaign CRUD', () => {
  it('creates a draft snapshotting the audience list names, with no PDF yet', async () => {
    const campaign = await makeDraft({}, false);
    expect(campaign.status).toBe('draft');
    expect(campaign.listNames).toEqual(['Newsletter Contacts']);
    expect(campaign.pdf).toBeNull();
    expect(campaign.source).toBe('admin');
    expect(campaign.recipientCount).toBe(0);
  });

  it('rejects creation against an unknown list', async () => {
    deps.getGroupById.mockResolvedValue(null);
    await expect(
      createCampaign({ title: 'x', description: 'y', listIds: ['nope'] }, 'admin-1'),
    ).rejects.toThrow(/Unknown audience list/);
  });

  it('edits drafts but refuses once delivery has begun', async () => {
    const campaign = await makeDraft();
    const updated = await updateCampaign(campaign.id, { title: 'Better title' });
    expect(updated.title).toBe('Better title');

    await sendCampaignNow(campaign.id);
    await expect(updateCampaign(campaign.id, { title: 'Too late' })).rejects.toThrow(
      /no longer be edited/,
    );
  });

  it('lists newest-first with status filter and search on title/description', async () => {
    const a = await makeDraft({ title: 'Alpha news' });
    await makeDraft({ title: 'Beta brief', description: 'nothing alike' });
    const all = await listCampaigns();
    expect(all.total).toBe(2);

    const searched = await listCampaigns({ search: 'alpha' });
    expect(searched.campaigns.map((c) => c.id)).toEqual([a.id]);

    await sendCampaignNow(a.id);
    const drafts = await listCampaigns({ status: 'draft' });
    expect(drafts.total).toBe(1);
    expect(drafts.statusCounts).toMatchObject({ draft: 1, queued: 1 });
  });

  it('normalises a record written by the old studio (name/subject, no title) on every read path', async () => {
    // The namespace is shared with the pre-PDF studio, whose records carried
    // `name`/`subject`/`openCount` and no `title` — a bare `c.title.toLowerCase()`
    // would 500 the list (review finding).
    kvStore.set('nlstudio:campaign:legacy-1', {
      id: 'legacy-1',
      name: 'Old composer issue',
      subject: 'Old subject line',
      status: 'finished',
      listIds: ['sys_newsletter_contacts'],
      listNames: ['Newsletter Contacts'],
      recipientCount: 3,
      sentCount: 3,
      failedCount: 0,
      processedCount: 3,
      progressPercent: 100,
      openCount: 2,
      createdBy: 'admin-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-02T00:00:00.000Z',
    });
    const fresh = await makeDraft({ title: 'Brand new' });

    const searched = await listCampaigns({ search: 'composer' });
    expect(searched.campaigns.map((c) => c.id)).toEqual(['legacy-1']);
    expect(searched.campaigns[0]).toMatchObject({
      title: 'Old composer issue',
      description: '',
      pdf: null,
      source: 'admin',
      sourceRef: null,
      readCount: 2,
    });

    const view = await getCampaignView('legacy-1');
    expect(view.title).toBe('Old composer issue');
    expect(await findCampaignBySourceRef('nothing')).toBeNull();

    const summary = await getDashboardSummary();
    expect(summary.campaigns.total).toBe(2);
    expect(summary.delivery).toEqual({ totalSent: 3, totalFailed: 0, totalRead: 2 });
    expect(summary.recentCampaigns.map((c) => c.id)).toEqual(
      expect.arrayContaining(['legacy-1', fresh.id]),
    );
  });

  it('finds a routine draft by its idempotency key', async () => {
    seedGroup();
    const routine = await createCampaign(
      {
        title: 'Sept',
        description: 'd',
        listIds: ['sys_newsletter_contacts'],
        source: 'routine',
        sourceRef: '2026-09',
      },
      'routine:claude',
    );
    expect((await findCampaignBySourceRef('2026-09'))?.id).toBe(routine.id);
    expect(await findCampaignBySourceRef('2026-10')).toBeNull();
  });
});

describe('the PDF', () => {
  it('stores a valid PDF, then replaces it and removes the old object', async () => {
    const campaign = await makeDraft();
    expect(campaign.pdf).toMatchObject({
      fileName: 'August-Newsletter.pdf',
      sizeBytes: PDF.length,
    });
    const firstPath = campaign.pdf!.storagePath;

    const replaced = await attachCampaignPdf(campaign.id, { bytes: PDF, fileName: 'v2.pdf' });
    expect(replaced.pdf!.storagePath).not.toBe(firstPath);
    expect(storage.removed).toEqual([firstPath]);
  });

  it('rejects a file that is not a PDF, whatever it is called', async () => {
    const campaign = await makeDraft({}, false);
    await expect(
      attachCampaignPdf(campaign.id, {
        bytes: new TextEncoder().encode('MZ definitely not a pdf'),
        fileName: 'looks-like.pdf',
      }),
    ).rejects.toThrow(/not a PDF/);
    expect(storage.uploaded).toHaveLength(0);
  });

  it('refuses to schedule or send without a PDF', async () => {
    const campaign = await makeDraft({}, false);
    await expect(sendCampaignNow(campaign.id)).rejects.toThrow(/Upload the newsletter PDF/);
    await expect(
      scheduleCampaign(campaign.id, new Date(Date.now() + 3_600_000).toISOString()),
    ).rejects.toThrow(/Upload the newsletter PDF/);
  });

  it('freezes the PDF once delivery has begun', async () => {
    const campaign = await makeDraft();
    await sendCampaignNow(campaign.id);
    await expect(
      attachCampaignPdf(campaign.id, { bytes: PDF, fileName: 'late.pdf' }),
    ).rejects.toThrow(/can no longer be changed/);
  });

  it('signs a preview URL for the admin and 404s when there is no PDF', async () => {
    const campaign = await makeDraft();
    const preview = await getCampaignPdfUrl(campaign.id);
    expect(preview.url).toContain(campaign.pdf!.storagePath);
    expect(preview.fileName).toBe('August-Newsletter.pdf');

    const bare = await makeDraft({}, false);
    await expect(getCampaignPdfUrl(bare.id)).rejects.toThrow(/no PDF/);
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
      { title: 'x', description: 'y', listIds: ['sys_newsletter_contacts'] },
      'admin-1',
    );
    expect(campaign.listNames).toEqual(['Newsletter Contacts']);

    const audience = await resolveAudience(['sys_newsletter_contacts']);
    expect(audience.items.map((i) => i.email).sort()).toEqual(['sub-a@x.co', 'sub-b@x.co']);
    expect(audience.items.find((i) => i.email === 'sub-a@x.co')?.firstName).toBe('Sasha');
  });

  it('unions a lagging group record with the consent records without double counting', async () => {
    // client-1 is sub-b: the group stores subscribers who are clients under
    // clientIds, so counting them on top of the consent records would
    // inflate the reach (review finding).
    const group = seedGroup({
      externalContacts: [external('sub-a@x.co'), external('legacy@x.co')],
      clientIds: ['client-1'],
    });
    deps.getGroups.mockResolvedValue({ data: [group], total: 1, limit: 1000, offset: 0 });
    deps.getAllClients.mockResolvedValue([{ id: 'client-1', email: 'sub-b@x.co', name: 'Bo' }]);
    deps.listSubscribers.mockResolvedValue(subs);

    const [list] = await listAudienceLists();
    expect(list.id).toBe('sys_newsletter_contacts');
    expect(list.memberCount).toBe(3); // sub-a, sub-b, legacy — not 4
    expect(list.clientCount).toBe(1);

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
        { title: 'x', description: 'y', listIds: ['sys_newsletter_contacts', 'nope'] },
        'admin-1',
      ),
    ).rejects.toThrow(/Unknown audience list\(s\): nope/);
  });
});

describe('lifecycle transitions', () => {
  it('send-now freezes the audience and queues', async () => {
    const campaign = await makeDraft();
    const queued = await sendCampaignNow(campaign.id);
    expect(queued.status).toBe('queued');
    expect(queued.recipientCount).toBe(2);
    expect(kvStore.get(`nlstudio:audience:${campaign.id}`)).toMatchObject({
      campaignId: campaign.id,
    });
  });

  it('finishes immediately when no one is eligible', async () => {
    seedGroup({ externalContacts: [] });
    const draft = await createCampaign(
      { title: 'empty', description: 'd', listIds: ['sys_newsletter_contacts'] },
      'admin-1',
    );
    await attachCampaignPdf(draft.id, { bytes: PDF, fileName: 'e.pdf' });
    const done = await sendCampaignNow(draft.id);
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

  it('retry (resume) only applies to a stopped campaign; cancel drives the terminal state', async () => {
    const campaign = await makeDraft();
    await expect(resumeCampaign(campaign.id)).rejects.toThrow(/Only a stopped/);

    await sendCampaignNow(campaign.id);
    // The processor parks a campaign here on a sender fault.
    kvStore.set(`nlstudio:campaign:${campaign.id}`, {
      ...(kvStore.get(`nlstudio:campaign:${campaign.id}`) as Record<string, unknown>),
      status: 'paused',
    });
    const resumed = await resumeCampaign(campaign.id);
    expect(resumed.status).toBe('queued');

    const cancelled = await cancelCampaign(campaign.id);
    expect(cancelled.status).toBe('cancelled');
    await expect(resumeCampaign(campaign.id)).rejects.toThrow(/Only a stopped/);
  });

  it('refuses to delete an active campaign, then deletes (and its PDFs) after cancel', async () => {
    const campaign = await makeDraft();
    await sendCampaignNow(campaign.id);
    await expect(deleteCampaign(campaign.id)).rejects.toThrow(/Stop the newsletter/);

    await cancelCampaign(campaign.id);
    await deleteCampaign(campaign.id);
    await expect(getCampaignView(campaign.id)).rejects.toThrow(/not found/);
    expect(storage.removedCampaigns).toEqual([campaign.id]);
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

    deps.listSubscribers.mockImplementation(async () => {
      kvStore.set(`nlstudio:campaign:${campaign.id}`, {
        ...(kvStore.get(`nlstudio:campaign:${campaign.id}`) as Record<string, unknown>),
        title: 'Edited after send was clicked',
        updatedAt: new Date(Date.now() + 1000).toISOString(),
      });
      return [];
    });

    const result = await sendCampaignNow(campaign.id);

    // Pre-edit content is never queued against a pre-edit audience.
    expect(result.status).toBe('draft');
    expect(result.title).toBe('Edited after send was clicked');
    expect(kvStore.get(`nlstudio:audience:${campaign.id}`)).toBeUndefined();
  });
});

describe('recipients, reads and stats', () => {
  it('reports queued members as pending before any delivery record exists', async () => {
    const campaign = await makeDraft();
    await sendCampaignNow(campaign.id);
    const page = await getCampaignRecipients(campaign.id);
    expect(page.total).toBe(2);
    expect(page.recipients.every((r) => r.deliveryStatus === 'pending')).toBe(true);
  });

  it('records a read and returns a signed URL for the PDF only once the token resolves', async () => {
    const campaign = await makeDraft();
    await sendCampaignNow(campaign.id);
    const page = await getCampaignRecipients(campaign.id);
    const token = page.recipients[0].token;
    const { signedNewsletterPdfUrl } = await import('../newsletter-studio-storage.ts');

    // Unknown ids resolve to null — the route 404s, nothing leaks, no URL minted.
    expect(await recordCampaignClick(campaign.id, token, 'wrong-link')).toBeNull();
    expect(await recordCampaignClick(campaign.id, 'wrong-token', 'pdf')).toBeNull();
    expect(await recordCampaignClick('wrong-campaign', token, 'pdf')).toBeNull();
    // No delivery record yet — the token is not live until first attempt.
    expect(await recordCampaignClick(campaign.id, token, 'pdf')).toBeNull();
    expect(signedNewsletterPdfUrl).not.toHaveBeenCalled();

    seedRecipientRecord(campaign.id, token, page.recipients[0].email);

    const outcome = await recordCampaignClick(campaign.id, token, 'pdf');
    expect(outcome?.url).toBe(`https://signed.test/${campaign.pdf!.storagePath}?sig=1`);

    // A second click is another click, not another read.
    await recordCampaignClick(campaign.id, token, 'pdf');
    const stats = await getCampaignStats(campaign.id);
    expect(stats).toMatchObject({
      recipientCount: 2,
      sentCount: 1,
      pendingCount: 1,
      readCount: 1,
      readRate: 100,
    });
  });
});

describe('one-click unsubscribe (RFC 8058)', () => {
  it('resolves the token, upserts an inactive consent record and syncs the group', async () => {
    const campaign = await makeDraft();
    await sendCampaignNow(campaign.id);
    const page = await getCampaignRecipients(campaign.id);
    const { token, email } = page.recipients[0];
    seedRecipientRecord(campaign.id, token, email);

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
    seedRecipientRecord(campaign.id, token, email);
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

describe('dashboard', () => {
  it('aggregates subscribers, campaign states, routine drafts and delivery totals', async () => {
    const campaign = await makeDraft();
    await sendCampaignNow(campaign.id);
    await createCampaign(
      {
        title: 'From the routine',
        description: 'd',
        listIds: ['sys_newsletter_contacts'],
        source: 'routine',
        sourceRef: '2026-09',
      },
      'routine:claude',
    );
    const summary = await getDashboardSummary();
    expect(summary.subscribers).toEqual({ total: 10, active: 6, pending: 2, unsubscribed: 2 });
    expect(summary.campaigns).toMatchObject({
      total: 2,
      active: 1,
      draft: 1,
      awaitingReview: 1,
    });
    expect(summary.delivery).toEqual({ totalSent: 0, totalFailed: 0, totalRead: 0 });
    expect(summary.recentCampaigns.map((c) => c.id)).toContain(campaign.id);
  });
});
