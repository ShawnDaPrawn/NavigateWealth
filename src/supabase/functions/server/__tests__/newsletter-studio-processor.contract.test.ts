/**
 * newsletter-studio-processor.ts — delivery engine contracts
 * ==========================================================
 *
 * What must hold when this runs unattended under cron:
 *
 *   1. **Terminal vs retryable is a real distinction.** A bounce goes
 *      failed_terminal and is never retried; a transient error stays
 *      retryable and the campaign goes back to the queue rather than
 *      finishing dishonestly.
 *   2. **The retry budget is finite.** Unlike the article engine, a
 *      permanently soft-failing address becomes terminal after
 *      MAX_TOTAL_ATTEMPTS instead of being retried by cron forever.
 *   3. **Admin controls win between batches.** A pause or cancel written
 *      while the processor holds the lease stops delivery.
 *   4. **A held lease excludes a second processor.**
 *   5. **Finishing writes the legacy broadcast summary** the subscriber
 *      dashboard's getStats() already scans.
 *
 * Real collaborators: in-memory KV via the real repositories, the real
 * renderer (with the email barrel stubbed), real classification. sleep() is
 * neutered so in-send retry pacing does not slow the suite.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const email = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => true),
  createEmailTemplate: (content: string) => `<w>${content}</w>`,
  createPlainTextEmail: (content: string) => content,
  getFooterSettings: vi.fn(async () => ({})),
}));

const deps = vi.hoisted(() => ({
  getGroupById: vi.fn(),
  getGroups: vi.fn(async () => ({ data: [], total: 0, limit: 1000, offset: 0 })),
  getAllClients: vi.fn(async () => [] as unknown[]),
  listSubscribers: vi.fn(async () => [] as unknown[]),
  getStats: vi.fn(async () => ({})),
}));

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../email-service.ts', () => email);
vi.mock('../communication-repo.ts', () => ({
  getGroupById: deps.getGroupById,
  getGroups: deps.getGroups,
}));
vi.mock('../communication-messaging.ts', () => ({ getAllClients: deps.getAllClients }));
vi.mock('../newsletter-service.ts', () => ({
  listSubscribers: deps.listSubscribers,
  getStats: deps.getStats,
}));
// Keep chunkArray/classifyDeliveryFailure real; only pacing is neutered.
vi.mock('../publications-notification-state.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  sleep: async () => undefined,
}));

import { kvStore } from './helpers/contract-harness.ts';
import {
  MAX_TOTAL_ATTEMPTS,
  processNewsletterCampaigns,
  sendCampaignTestEmails,
} from '../newsletter-studio-processor.ts';
import { createCampaign, sendCampaignNow } from '../newsletter-studio-service.ts';
import type {
  NewsletterCampaign,
  NewsletterCampaignRecipient,
} from '../newsletter-studio-types.ts';

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

const external = (emailAddr: string) => ({
  email: emailAddr,
  source: 'newsletter',
  subscribedAt: '2026-01-01T00:00:00.000Z',
});

const campaignRecord = (id: string) => kvStore.get(`nlstudio:campaign:${id}`) as NewsletterCampaign;

async function queuedCampaign(recipients: string[]): Promise<NewsletterCampaign> {
  deps.getGroupById.mockImplementation(async (id: string) =>
    id === GROUP.id ? { ...GROUP, externalContacts: recipients.map(external) } : null,
  );
  const draft = await createCampaign(
    {
      name: 'run',
      subject: 'Run subject',
      listIds: [GROUP.id],
      bodyHtml: '<p>Hi {{firstName}}</p><a href="https://a.example/one">read</a>',
    },
    'admin-1',
  );
  await sendCampaignNow(draft.id);
  return campaignRecord(draft.id);
}

function recipientRecords(campaignId: string): NewsletterCampaignRecipient[] {
  const out: NewsletterCampaignRecipient[] = [];
  kvStore.forEach((value, key) => {
    if (key.startsWith(`nlstudio:recipient:${campaignId}:`)) {
      out.push(value as NewsletterCampaignRecipient);
    }
  });
  return out;
}

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  email.sendEmail.mockResolvedValue(true);
  deps.listSubscribers.mockResolvedValue([]);
});

describe('delivery', () => {
  it('delivers every recipient, finishes the campaign and writes the legacy broadcast summary', async () => {
    const campaign = await queuedCampaign(['a@x.co', 'b@x.co', 'c@x.co']);
    const result = await processNewsletterCampaigns({ mode: 'cron' });

    expect(result.sent).toBe(3);
    expect(result.finished).toContain(campaign.id);

    const finished = campaignRecord(campaign.id);
    expect(finished.status).toBe('finished');
    expect(finished.sentCount).toBe(3);
    expect(finished.failedCount).toBe(0);
    expect(finished.progressPercent).toBe(100);
    expect(finished.lockId).toBeNull();

    const broadcast = kvStore.get(`broadcast:${campaign.id}`) as { sent: number };
    expect(broadcast.sent).toBe(3);

    // Envelope: newsletters@ from, one-click unsubscribe, campaign custom args.
    const call = email.sendEmail.mock.calls[0][0] as Record<string, unknown>;
    expect(call.from).toEqual({ email: 'newsletters@navigatewealth.co', name: 'Navigate Wealth' });
    expect((call.headers as Record<string, string>)['List-Unsubscribe-Post']).toBe(
      'List-Unsubscribe=One-Click',
    );
    expect(call.customArgs).toEqual({ type: 'newsletter_campaign', campaign_id: campaign.id });
    expect(call.throwOnError).toBe(true);
  });

  it('classifies a bounce as terminal and finishes with the failure counted', async () => {
    const campaign = await queuedCampaign(['ok@x.co', 'bad@x.co']);
    email.sendEmail.mockImplementation(async (params: { to: string }) => {
      if (params.to === 'bad@x.co') throw new Error('SendGrid error: bounce — invalid address');
      return true;
    });

    const result = await processNewsletterCampaigns({ mode: 'cron' });
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);

    const finished = campaignRecord(campaign.id);
    expect(finished.status).toBe('finished');
    expect(finished.failedCount).toBe(1);
    expect(finished.lastError).toMatch(/1 recipient/);

    const bad = recipientRecords(campaign.id).find((r) => r.email === 'bad@x.co')!;
    expect(bad.deliveryStatus).toBe('failed_terminal');
    // Terminal classification breaks out on the first provider call.
    expect(
      email.sendEmail.mock.calls.filter(([p]) => (p as { to: string }).to === 'bad@x.co'),
    ).toHaveLength(1);
  });

  it('keeps a transient failure retryable and returns the campaign to the queue', async () => {
    const campaign = await queuedCampaign(['flaky@x.co']);
    email.sendEmail.mockRejectedValue(new Error('connection reset by peer'));

    const result = await processNewsletterCampaigns({ mode: 'cron' });
    expect(result.failed).toBe(0);

    const record = recipientRecords(campaign.id)[0];
    expect(record.deliveryStatus).toBe('failed_retryable');
    expect(record.attemptCount).toBe(1);
    // In-send retry ladder ran its full budget against the transient error.
    expect(email.sendEmail).toHaveBeenCalledTimes(3);

    const requeued = campaignRecord(campaign.id);
    expect(requeued.status).toBe('queued');
    expect(requeued.lockId).toBeNull();
  });

  it('promotes an exhausted retryable to terminal without another provider call', async () => {
    const campaign = await queuedCampaign(['worn@x.co']);
    const [record] = recipientRecords(campaign.id);
    // No records exist yet — synthesize an exhausted one.
    expect(record).toBeUndefined();
    const audience = kvStore.get(`nlstudio:audience:${campaign.id}`) as {
      items: { token: string; email: string; name: string; firstName: string }[];
    };
    const item = audience.items[0];
    kvStore.set(`nlstudio:recipient:${campaign.id}:${item.token}`, {
      campaignId: campaign.id,
      token: item.token,
      email: item.email,
      name: item.name,
      firstName: item.firstName,
      deliveryStatus: 'failed_retryable',
      deliveryError: 'kept timing out',
      attemptCount: MAX_TOTAL_ATTEMPTS,
      lastAttemptedAt: '2026-08-29T00:00:00.000Z',
      sentAt: null,
      openedAt: null,
      clicks: [],
    } satisfies NewsletterCampaignRecipient);

    const result = await processNewsletterCampaigns({ mode: 'cron' });
    expect(email.sendEmail).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);

    const updated = recipientRecords(campaign.id)[0];
    expect(updated.deliveryStatus).toBe('failed_terminal');
    expect(updated.deliveryError).toMatch(/retry budget exhausted/);
    expect(campaignRecord(campaign.id).status).toBe('finished');
  });
});

describe('scheduling and admin controls', () => {
  it('promotes a due scheduled campaign and delivers it in the same tick', async () => {
    deps.getGroupById.mockImplementation(async (id: string) =>
      id === GROUP.id ? { ...GROUP, externalContacts: [external('later@x.co')] } : null,
    );
    const draft = await createCampaign(
      { name: 'later', subject: 's', listIds: [GROUP.id], bodyHtml: '<p>b</p>' },
      'admin-1',
    );
    // Write the scheduled state directly with a past due time.
    kvStore.set(`nlstudio:campaign:${draft.id}`, {
      ...campaignRecord(draft.id),
      status: 'scheduled',
      scheduledAt: '2026-08-29T00:00:00.000Z',
    });

    const result = await processNewsletterCampaigns({ mode: 'cron' });
    expect(result.promotedScheduled).toBe(1);
    expect(result.sent).toBe(1);
    expect(campaignRecord(draft.id).status).toBe('finished');
  });

  it('a pause written while a batch is in flight survives the counter write and stops delivery', async () => {
    // 25 recipients = two batches. The admin pauses during batch one; the
    // post-batch counter write must not resurrect 'sending' (review finding).
    const emails = Array.from({ length: 25 }, (_, i) => `r${i}@x.co`);
    const campaign = await queuedCampaign(emails);
    let sends = 0;
    email.sendEmail.mockImplementation(async () => {
      sends++;
      if (sends === 5) {
        kvStore.set(`nlstudio:campaign:${campaign.id}`, {
          ...campaignRecord(campaign.id),
          status: 'paused',
        });
      }
      return true;
    });

    await processNewsletterCampaigns({ mode: 'cron' });

    const after = campaignRecord(campaign.id);
    expect(after.status).toBe('paused');
    expect(after.lockId).toBeNull();
    // Only the in-flight batch completed; the second batch never started.
    expect(email.sendEmail).toHaveBeenCalledTimes(20);
    expect(after.sentCount).toBe(20);
  });

  it('skips recipients who opted out after the audience was frozen (POPIA)', async () => {
    const campaign = await queuedCampaign(['stays@x.co', 'leaves@x.co']);
    deps.listSubscribers.mockResolvedValue([{ email: 'leaves@x.co', active: false }]);

    const result = await processNewsletterCampaigns({ mode: 'cron' });
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(
      email.sendEmail.mock.calls.filter(([p]) => (p as { to: string }).to === 'leaves@x.co'),
    ).toHaveLength(0);

    const skipped = recipientRecords(campaign.id).find((r) => r.email === 'leaves@x.co')!;
    expect(skipped.deliveryStatus).toBe('failed_terminal');
    expect(skipped.deliveryError).toMatch(/opted out after the campaign was queued/);
    expect(campaignRecord(campaign.id).status).toBe('finished');
  });

  it('leaves paused campaigns untouched', async () => {
    const campaign = await queuedCampaign(['a@x.co']);
    kvStore.set(`nlstudio:campaign:${campaign.id}`, {
      ...campaignRecord(campaign.id),
      status: 'paused',
    });

    const result = await processNewsletterCampaigns({ mode: 'cron' });
    expect(result.campaignsProcessed).toBe(0);
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('skips a campaign whose lease another processor holds', async () => {
    const campaign = await queuedCampaign(['a@x.co']);
    kvStore.set(`nlstudio:campaign:${campaign.id}`, {
      ...campaignRecord(campaign.id),
      lockId: 'someone-else',
      lockExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const result = await processNewsletterCampaigns({ mode: 'cron' });
    expect(result.campaignsProcessed).toBe(0);
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('records a processor heartbeat either way', async () => {
    await processNewsletterCampaigns({ mode: 'manual' });
    const state = kvStore.get('nlstudio:processor:state') as {
      mode: string;
      lastHeartbeatAt: string;
    };
    expect(state.mode).toBe('manual');
    expect(state.lastHeartbeatAt).toBeTruthy();
  });

  it('only a real cron tick stamps lastCronRunAt, so an uninstalled job stays visible', async () => {
    // Browser-accelerator runs must not mask a missing pg_cron job — the
    // dashboard and schedule dialog warn off this exact field.
    await processNewsletterCampaigns({ mode: 'manual' });
    const key = 'nlstudio:processor:state';
    expect((kvStore.get(key) as { lastCronRunAt: string | null }).lastCronRunAt).toBeNull();

    await processNewsletterCampaigns({ mode: 'cron' });
    const cronStamp = (kvStore.get(key) as { lastCronRunAt: string | null }).lastCronRunAt;
    expect(cronStamp).toBeTruthy();

    // A later manual run preserves the cron mark rather than clearing it.
    await processNewsletterCampaigns({ mode: 'manual' });
    expect((kvStore.get(key) as { lastCronRunAt: string | null }).lastCronRunAt).toBe(cronStamp);
  });
});

describe('test sends', () => {
  it('prefixes the subject, keeps real links, and reports per-address outcomes', async () => {
    const campaign = await queuedCampaign(['a@x.co']);
    email.sendEmail.mockImplementation(async (params: { to: string }) => {
      if (params.to === 'broken@x.co') throw new Error('SendGrid error: bad request');
      return true;
    });

    const outcomes = await sendCampaignTestEmails(campaign.id, ['me@x.co', 'broken@x.co']);
    expect(outcomes).toEqual([
      { email: 'me@x.co', ok: true },
      { email: 'broken@x.co', ok: false, error: expect.stringMatching(/bad request/) },
    ]);

    const call = email.sendEmail.mock.calls[0][0] as { subject: string; html: string };
    expect(call.subject).toBe('[TEST] Run subject');
    expect(call.html).toContain('https://a.example/one');
    expect(call.html).not.toContain('/newsletter/click');
  });
});
