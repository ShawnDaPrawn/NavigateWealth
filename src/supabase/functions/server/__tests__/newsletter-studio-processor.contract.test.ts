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
 *   2. **The retry budget is finite.** A permanently soft-failing address
 *      becomes terminal after MAX_TOTAL_ATTEMPTS instead of being retried by
 *      cron forever.
 *   3. **Admin controls win between batches.** A cancel written while the
 *      processor holds the lease stops delivery.
 *   4. **A held lease excludes a second processor.**
 *   5. **The PDF is attached to every send, downloaded once per tick**, and
 *      the batch width follows its size.
 *   6. **Finishing writes the legacy broadcast summary** the subscriber
 *      dashboard's getStats() already scans.
 *
 * Real collaborators: in-memory KV via the real repositories, the real
 * renderer (with the email barrel stubbed), real classification. The bucket
 * and the SQL intake sweep are stubbed. sleep() is neutered so in-send retry
 * pacing does not slow the suite.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const email = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => true),
  createEmailTemplate: (content: string, options?: { buttonUrl?: string }) =>
    `<w button="${options?.buttonUrl ?? ''}">${content}</w>`,
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

const storage = vi.hoisted(() => ({
  download: vi.fn(async () => new TextEncoder().encode('%PDF-1.4 stored newsletter')),
}));

const intake = vi.hoisted(() => ({
  sweepNewsletterIntake: vi.fn(async () => ({ examined: 0, processed: 0, failed: 0, errors: [] })),
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
vi.mock('../newsletter-group-service.ts', () => ({
  removeNewsletterSubscriber: vi.fn(async () => undefined),
}));
vi.mock('../newsletter-intake-service.ts', () => intake);
vi.mock('../newsletter-studio-storage.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../newsletter-studio-storage.ts')>();
  return {
    ...original,
    storeNewsletterPdf: vi.fn(
      async (input: { campaignId: string; bytes: Uint8Array; fileName: string }) => ({
        storagePath: `${input.campaignId}/one.pdf`,
        fileName: original.safePdfFileName(input.fileName),
        sizeBytes: input.bytes.length,
        uploadedAt: '2026-09-01T00:00:00.000Z',
      }),
    ),
    signedNewsletterPdfUrl: vi.fn(async (path: string) => `https://signed.test/${path}`),
    removeNewsletterPdf: vi.fn(async () => undefined),
    removeNewsletterPdfs: vi.fn(async () => undefined),
    downloadNewsletterPdf: (path: string) => storage.download(path),
    publishNewsletterPdf: vi.fn(async (input: { slug: string; year: number }) => ({
      url: `https://cdn.test/${input.year}/${input.slug}.pdf`,
      publicPath: `${input.year}/${input.slug}.pdf`,
    })),
    unpublishNewsletterPdf: vi.fn(async () => undefined),
  };
});
// Keep chunkArray/classifyDeliveryFailure real; only pacing is neutered.
vi.mock('../publications-notification-state.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  sleep: async () => undefined,
}));

import { kvStore } from './helpers/contract-harness.ts';
import * as kv from '../kv_store.tsx';
import { IDLE_HEARTBEAT_INTERVAL_MS } from '../publications-notification-state.ts';
import {
  CAMPAIGN_LOCK_SETTLE_MS,
  CAMPAIGN_LOCK_TTL_MS,
  LEASE_HEARTBEAT_MS,
  MAX_SEND_ATTEMPTS_PER_DELIVERY,
  MAX_TOTAL_ATTEMPTS,
  PROVIDER_REQUEST_TIMEOUT_MS,
  processNewsletterCampaigns,
  sendCampaignTestEmails,
} from '../newsletter-studio-processor.ts';
import { ATTACHMENT_BATCH_BUDGET_BYTES } from '../newsletter-studio-attachment.ts';
import {
  attachCampaignPdf,
  createCampaign,
  sendCampaignNow,
} from '../newsletter-studio-service.ts';
import type {
  NewsletterCampaign,
  NewsletterCampaignRecipient,
  NewsletterProcessorState,
} from '../newsletter-studio-types.ts';

const PDF = new TextEncoder().encode('%PDF-1.4\n%test\n');

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

async function draftCampaign(recipients: string[]): Promise<NewsletterCampaign> {
  deps.getGroupById.mockImplementation(async (id: string) =>
    id === GROUP.id ? { ...GROUP, externalContacts: recipients.map(external) } : null,
  );
  const draft = await createCampaign(
    {
      title: 'Run subject',
      description: 'The short version.',
      listIds: [GROUP.id],
    },
    'admin-1',
  );
  await attachCampaignPdf(draft.id, { bytes: PDF, fileName: 'Issue 9.pdf' });
  return campaignRecord(draft.id);
}

async function queuedCampaign(recipients: string[]): Promise<NewsletterCampaign> {
  const draft = await draftCampaign(recipients);
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

type SentParams = {
  to: string;
  subject: string;
  html: string;
  attachments?: { content: string; filename: string; type: string }[];
  headers?: Record<string, string>;
  customArgs?: Record<string, string>;
  throwOnError?: boolean;
  timeoutMs?: number;
  from?: { email: string; name: string };
};
const sentCalls = () => email.sendEmail.mock.calls.map(([p]) => p as unknown as SentParams);

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  email.sendEmail.mockResolvedValue(true);
  deps.listSubscribers.mockResolvedValue([]);
  storage.download.mockResolvedValue(new TextEncoder().encode('%PDF-1.4 stored newsletter'));
  intake.sweepNewsletterIntake.mockResolvedValue({
    examined: 0,
    processed: 0,
    failed: 0,
    errors: [],
  });
});

describe('publishing a finished campaign to the website', () => {
  it('publishes it once the send completes, when the admin asked for that', async () => {
    const campaign = await queuedCampaign(['a@x.co']);
    await processNewsletterCampaigns({ mode: 'cron' });

    const finished = campaignRecord(campaign.id);
    expect(finished.status).toBe('finished');
    expect(finished.website).toMatchObject({
      pdfUrl: expect.stringContaining('https://cdn.test/'),
    });

    const published = [...kvStore.keys()].filter((k) => k.startsWith('nlstudio:published:'));
    expect(published).toHaveLength(1);
  });

  it('leaves the website alone when the admin turned publishing off', async () => {
    const campaign = await queuedCampaign(['a@x.co']);
    const record = campaignRecord(campaign.id);
    kvStore.set(`nlstudio:campaign:${campaign.id}`, { ...record, publishToWebsite: false });

    await processNewsletterCampaigns({ mode: 'cron' });

    expect(campaignRecord(campaign.id).status).toBe('finished');
    expect(campaignRecord(campaign.id).website).toBeNull();
    expect([...kvStore.keys()].filter((k) => k.startsWith('nlstudio:published:'))).toHaveLength(0);
  });

  it('still reports the send as finished when publishing fails', async () => {
    const storageModule = await import('../newsletter-studio-storage.ts');
    vi.mocked(storageModule.publishNewsletterPdf).mockRejectedValueOnce(
      new Error('bucket unreachable'),
    );

    const campaign = await queuedCampaign(['a@x.co']);
    const result = await processNewsletterCampaigns({ mode: 'cron' });

    // The delivery happened; a website fault must not rewrite that as a failure.
    expect(result.sent).toBe(1);
    expect(campaignRecord(campaign.id).status).toBe('finished');
    expect(campaignRecord(campaign.id).website).toBeNull();
  });
});

describe('delivery', () => {
  it('delivers every recipient with the PDF attached, finishes, and writes the legacy summary', async () => {
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

    const broadcast = kvStore.get(`broadcast:${campaign.id}`) as {
      sent: number;
      subject: string;
      bodySnippet: string;
    };
    expect(broadcast).toMatchObject({
      sent: 3,
      subject: 'Run subject',
      bodySnippet: 'The short version.',
    });

    // The PDF was fetched once for the tick and attached to every send.
    expect(storage.download).toHaveBeenCalledTimes(1);
    expect(email.getFooterSettings).toHaveBeenCalledTimes(1);
    const calls = sentCalls();
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.attachments).toEqual([
        expect.objectContaining({ filename: 'Issue-9.pdf', type: 'application/pdf' }),
      ]);
      expect(call.attachments![0].content).toBe(calls[0].attachments![0].content);
      expect(call.subject).toBe('Run subject');
      // The Read button is the tracked click-through for THIS recipient.
      expect(call.html).toMatch(
        /button="https:\/\/navigatewealth\.co\/newsletter\/click\?c=.*&l=pdf"/,
      );
    }

    // Envelope: newsletters@ from, one-click unsubscribe, campaign custom args.
    const call = calls[0];
    expect(call.from).toEqual({ email: 'newsletters@navigatewealth.co', name: 'Navigate Wealth' });
    expect(call.headers!['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
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
    expect(sentCalls().filter((p) => p.to === 'bad@x.co')).toHaveLength(1);
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

  it('sizes the concurrent batch from the attachment, not a fixed 20', async () => {
    // A stored PDF whose base64 is just under a third of the budget → 3 concurrent sends.
    const big = new Uint8Array(Math.floor(ATTACHMENT_BATCH_BUDGET_BYTES / 4) - 300);
    big.set(PDF.subarray(0, 5));
    storage.download.mockResolvedValue(big);
    const emails = Array.from({ length: 8 }, (_, i) => `r${i}@x.co`);
    const campaign = await queuedCampaign(emails);

    let inFlight = 0;
    let peak = 0;
    email.sendEmail.mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight--;
      return true;
    });

    await processNewsletterCampaigns({ mode: 'cron', maxBatchesPerCampaign: 5 });
    expect(peak).toBe(3);
    expect(campaignRecord(campaign.id).status).toBe('finished');
    expect(storage.download).toHaveBeenCalledTimes(1);
  });
});

describe('sender-side faults', () => {
  // The SES sandbox — where the account sits until AWS grants production
  // access — rejects EVERY send with "not verified". Attributing that to
  // recipients would mark a whole audience failed_terminal, unretryable, and
  // the campaign would have to be rebuilt. It is our configuration, so the
  // campaign pauses and the audience is left intact.
  it('pauses the campaign and leaves every recipient unburned when SES rejects the sender', async () => {
    const campaign = await queuedCampaign(['a@x.co', 'b@x.co', 'c@x.co']);
    email.sendEmail.mockRejectedValue(
      new Error(
        'SES error (400): {"message":"Email address is not verified. The following identities failed the check in region EU-WEST-1: newsletters@navigatewealth.co"}',
      ),
    );

    const result = await processNewsletterCampaigns({ mode: 'cron' });
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);

    const paused = campaignRecord(campaign.id);
    expect(paused.status).toBe('paused');
    expect(paused.failedCount).toBe(0);
    expect(paused.lastError).toMatch(/rejected the sender/i);
    expect(paused.lastError).toMatch(/not verified/i);
    expect(paused.lockId).toBeNull();

    for (const record of recipientRecords(campaign.id)) {
      expect(record.deliveryStatus).not.toBe('failed_terminal');
      expect(record.deliveryStatus).not.toBe('failed_retryable');
      expect(record.attemptCount).toBe(0);
    }
    expect(email.sendEmail.mock.calls.length).toBeLessThanOrEqual(3);
    expect(result.errors.join(' ')).toMatch(/rejected the sender/i);
  });

  it('pauses the campaign with nothing burned when the PDF cannot be loaded', async () => {
    const campaign = await queuedCampaign(['a@x.co', 'b@x.co']);
    storage.download.mockRejectedValue(new Error('Could not read c/one.pdf: object not found'));

    const result = await processNewsletterCampaigns({ mode: 'cron' });
    expect(email.sendEmail).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);

    const paused = campaignRecord(campaign.id);
    expect(paused.status).toBe('paused');
    expect(paused.lastError).toMatch(/PDF could not be loaded/);
    expect(paused.lockId).toBeNull();
    expect(recipientRecords(campaign.id)).toHaveLength(0);
    expect(result.errors.join(' ')).toMatch(/object not found/);
  });

  it('still blames the recipient for a genuine per-address failure', async () => {
    const campaign = await queuedCampaign(['ok@x.co', 'bad@x.co']);
    email.sendEmail.mockImplementation(async (params: { to: string }) => {
      if (params.to === 'bad@x.co') throw new Error('SES error (400): invalid address');
      return true;
    });

    const result = await processNewsletterCampaigns({ mode: 'cron' });
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(campaignRecord(campaign.id).status).toBe('finished');
  });
});

describe('scheduling, intake and admin controls', () => {
  it('promotes a due scheduled campaign and delivers it in the same tick', async () => {
    const draft = await draftCampaign(['later@x.co']);
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

  it('sweeps the SQL intake table on a cron tick only, and surfaces its errors', async () => {
    intake.sweepNewsletterIntake.mockResolvedValue({
      examined: 1,
      processed: 1,
      failed: 0,
      errors: [],
    });
    const cron = await processNewsletterCampaigns({ mode: 'cron' });
    expect(cron.intakeProcessed).toBe(1);

    intake.sweepNewsletterIntake.mockClear();
    const manual = await processNewsletterCampaigns({ mode: 'manual' });
    expect(intake.sweepNewsletterIntake).not.toHaveBeenCalled();
    expect(manual.intakeProcessed).toBe(0);

    intake.sweepNewsletterIntake.mockRejectedValue(new Error('pg down'));
    const failed = await processNewsletterCampaigns({ mode: 'cron' });
    expect(failed.errors.join(' ')).toMatch(/intake sweep: pg down/);
  });

  it('a cancel written while a batch is in flight survives the counter write and stops delivery', async () => {
    // Enough recipients for two batches. The admin cancels during batch one;
    // the post-batch counter write must not resurrect 'sending'.
    const emails = Array.from({ length: 25 }, (_, i) => `r${i}@x.co`);
    const campaign = await queuedCampaign(emails);
    let sends = 0;
    email.sendEmail.mockImplementation(async () => {
      sends++;
      if (sends === 5) {
        kvStore.set(`nlstudio:campaign:${campaign.id}`, {
          ...campaignRecord(campaign.id),
          status: 'cancelled',
        });
      }
      return true;
    });

    await processNewsletterCampaigns({ mode: 'cron' });

    const after = campaignRecord(campaign.id);
    expect(after.status).toBe('cancelled');
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
    expect(sentCalls().filter((p) => p.to === 'leaves@x.co')).toHaveLength(0);

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
    await processNewsletterCampaigns({ mode: 'manual' });
    const key = 'nlstudio:processor:state';
    expect((kvStore.get(key) as { lastCronRunAt: string | null }).lastCronRunAt).toBeNull();

    await processNewsletterCampaigns({ mode: 'cron' });
    const cronStamp = (kvStore.get(key) as { lastCronRunAt: string | null }).lastCronRunAt;
    expect(cronStamp).toBeTruthy();

    await processNewsletterCampaigns({ mode: 'manual' });
    expect((kvStore.get(key) as { lastCronRunAt: string | null }).lastCronRunAt).toBe(cronStamp);
  });

  const STATE_KEY = 'nlstudio:processor:state';
  const stateWrites = () => vi.mocked(kv.set).mock.calls.filter(([k]) => k === STATE_KEY).length;

  it('leaves the state row alone on an idle cron tick inside the heartbeat interval', async () => {
    await processNewsletterCampaigns({ mode: 'cron' });
    const first = kvStore.get(STATE_KEY);
    const writesAfterFirst = stateWrites();

    await processNewsletterCampaigns({ mode: 'cron' });

    expect(stateWrites()).toBe(writesAfterFirst);
    expect(kvStore.get(STATE_KEY)).toEqual(first);
  });

  it('refreshes a cron heartbeat whose stored lastCronRunAt is older than the idle interval', async () => {
    await processNewsletterCampaigns({ mode: 'cron' });
    const stale = new Date(Date.now() - IDLE_HEARTBEAT_INTERVAL_MS - 1_000).toISOString();
    kvStore.set(STATE_KEY, {
      ...(kvStore.get(STATE_KEY) as NewsletterProcessorState),
      lastCronRunAt: stale,
    });
    const writesBefore = stateWrites();

    await processNewsletterCampaigns({ mode: 'cron' });

    expect(stateWrites()).toBe(writesBefore + 1);
    const state = kvStore.get(STATE_KEY) as NewsletterProcessorState;
    expect(new Date(state.lastCronRunAt!).getTime()).toBeGreaterThan(new Date(stale).getTime());
  });

  it('still writes when the tick found work or the previous run had an error', async () => {
    await processNewsletterCampaigns({ mode: 'cron' });
    kvStore.set(STATE_KEY, {
      ...(kvStore.get(STATE_KEY) as NewsletterProcessorState),
      lastError: 'provider down',
    });
    const writesBefore = stateWrites();

    await processNewsletterCampaigns({ mode: 'cron' });
    expect(stateWrites()).toBe(writesBefore + 1);
    expect((kvStore.get(STATE_KEY) as NewsletterProcessorState).lastError).toBeNull();

    await queuedCampaign(['a@x.co']);
    await processNewsletterCampaigns({ mode: 'cron' });
    expect(stateWrites()).toBe(writesBefore + 2);
    expect((kvStore.get(STATE_KEY) as NewsletterProcessorState).sentInLastRun).toBe(1);
  });
});

describe('lease safety during long batches (review finding)', () => {
  it('bounds every provider call with a deadline so a batch cannot outlive its lease', async () => {
    const campaign = await queuedCampaign(['a@x.co']);
    await processNewsletterCampaigns({ mode: 'cron' });
    expect(sentCalls()[0].timeoutMs).toBe(PROVIDER_REQUEST_TIMEOUT_MS);
    const worstCase = MAX_SEND_ATTEMPTS_PER_DELIVERY * PROVIDER_REQUEST_TIMEOUT_MS;
    expect(worstCase).toBeLessThan(CAMPAIGN_LOCK_TTL_MS);
    expect(campaignRecord(campaign.id).status).toBe('finished');
  });

  it('renews the lease while a batch is in flight', async () => {
    vi.useFakeTimers();
    try {
      const campaign = await queuedCampaign(['slow@x.co']);
      const before = campaignRecord(campaign.id);

      let release!: () => void;
      email.sendEmail.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            release = () => resolve(true);
          }),
      );

      const run = processNewsletterCampaigns({ mode: 'cron' });
      await vi.advanceTimersByTimeAsync(CAMPAIGN_LOCK_SETTLE_MS + 10);
      const leased = campaignRecord(campaign.id);
      expect(leased.lockId).toBeTruthy();

      await vi.advanceTimersByTimeAsync(LEASE_HEARTBEAT_MS + 50);
      const renewed = campaignRecord(campaign.id);
      expect(renewed.lockId).toBe(leased.lockId);
      expect(new Date(renewed.lockExpiresAt!).getTime()).toBeGreaterThan(
        new Date(leased.lockExpiresAt!).getTime(),
      );
      expect(before.lockId).toBeNull();

      release();
      await vi.advanceTimersByTimeAsync(100);
      await run;
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops renewing once another worker holds the lease', async () => {
    vi.useFakeTimers();
    try {
      const campaign = await queuedCampaign(['slow@x.co']);
      let release!: () => void;
      email.sendEmail.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            release = () => resolve(true);
          }),
      );

      const run = processNewsletterCampaigns({ mode: 'cron' });
      await vi.advanceTimersByTimeAsync(CAMPAIGN_LOCK_SETTLE_MS + 10);

      const stolenExpiry = new Date(Date.now() + 5_000).toISOString();
      kvStore.set(`nlstudio:campaign:${campaign.id}`, {
        ...campaignRecord(campaign.id),
        lockId: 'other-worker',
        lockExpiresAt: stolenExpiry,
      });

      await vi.advanceTimersByTimeAsync(LEASE_HEARTBEAT_MS + 50);
      const after = campaignRecord(campaign.id);
      expect(after.lockId).toBe('other-worker');
      expect(after.lockExpiresAt).toBe(stolenExpiry);

      release();
      await vi.advanceTimersByTimeAsync(100);
      await run;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('test sends', () => {
  it('prefixes the subject, attaches the PDF, links a signed URL and reports per-address outcomes', async () => {
    const campaign = await draftCampaign(['a@x.co']);
    email.sendEmail.mockImplementation(async (params: { to: string }) => {
      if (params.to === 'broken@x.co') throw new Error('SendGrid error: bad request');
      return true;
    });

    const outcomes = await sendCampaignTestEmails(campaign.id, ['me@x.co', 'broken@x.co']);
    expect(outcomes).toEqual([
      { email: 'me@x.co', ok: true },
      { email: 'broken@x.co', ok: false, error: expect.stringMatching(/bad request/) },
    ]);

    const call = sentCalls()[0];
    expect(call.subject).toBe('[TEST] Run subject');
    expect(call.attachments).toEqual([expect.objectContaining({ filename: 'Issue-9.pdf' })]);
    // A test must never count as a read: the button bypasses the click-through.
    expect(call.html).toContain('https://signed.test/');
    expect(call.html).not.toContain('/newsletter/click');
    expect(call.customArgs).toEqual({ type: 'newsletter_campaign_test', campaign_id: campaign.id });
    expect(storage.download).toHaveBeenCalledTimes(1);
  });

  it('refuses a test before the PDF is uploaded', async () => {
    deps.getGroupById.mockResolvedValue(GROUP);
    const draft = await createCampaign(
      { title: 't', description: 'd', listIds: [GROUP.id] },
      'admin-1',
    );
    await expect(sendCampaignTestEmails(draft.id, ['me@x.co'])).rejects.toThrow(
      /Upload the newsletter PDF/,
    );
  });
});
