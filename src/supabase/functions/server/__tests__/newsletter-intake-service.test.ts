/**
 * newsletter-intake-service.ts — hand-over contracts
 * ==================================================
 *
 *   1. **One draft per hand-over.** A replayed idempotency key returns the
 *      existing draft and sends no second email.
 *   2. **No PDF-less routine draft survives.** If the PDF is rejected the
 *      draft is removed again, so the admin never sees a broken draft.
 *   3. **The admin is told once.** The review email goes out after the PDF
 *      is stored and stamps `reviewNotifiedAt`; a failed email never blocks
 *      the draft.
 *   4. **The SQL sweep** promotes pending rows, nulls the base64, marks
 *      failures, and treats a missing table as "nothing pending".
 *
 * Real collaborators: the studio service over in-memory KV. The bucket, the
 * email barrel and the Postgres client are stubbed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: (name: string) => (name === 'NW_NEWSLETTER_REVIEW_TO' ? '' : 'test') },
  };
});

const deps = vi.hoisted(() => ({
  getGroupById: vi.fn(),
  getGroups: vi.fn(async () => ({ data: [], total: 0, limit: 1000, offset: 0 })),
  getAllClients: vi.fn(async () => [] as unknown[]),
  listSubscribers: vi.fn(async () => [] as unknown[]),
  getStats: vi.fn(async () => ({})),
}));

const email = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => true),
  createEmailTemplate: (content: string, options?: { buttonUrl?: string }) =>
    `<w button="${options?.buttonUrl ?? ''}">${content}</w>`,
  createPlainTextEmail: (content: string) => content,
  getFooterSettings: vi.fn(async () => ({})),
}));

/** A tiny fake of the PostgREST builder chain the sweep uses. */
const pg = vi.hoisted(() => {
  const state = {
    rows: [] as Record<string, unknown>[],
    selectError: null as { code?: string; message: string } | null,
    updates: [] as { id: string; patch: Record<string, unknown> }[],
  };
  const from = vi.fn(() => ({
    select: () => ({
      eq: () => ({
        order: () => ({
          limit: async (n: number) =>
            state.selectError
              ? { data: null, error: state.selectError }
              : { data: state.rows.filter((r) => r.status === 'pending').slice(0, n), error: null },
        }),
      }),
    }),
    update: (patch: Record<string, unknown>) => ({
      eq: async (_col: string, id: string) => {
        state.updates.push({ id, patch });
        const row = state.rows.find((r) => r.id === id);
        if (row) Object.assign(row, patch);
        return { error: null };
      },
    }),
  }));
  return { state, from };
});

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({ from: pg.from }),
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
vi.mock('../newsletter-studio-storage.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../newsletter-studio-storage.ts')>();
  return {
    ...original,
    storeNewsletterPdf: vi.fn(
      async (input: { campaignId: string; bytes: Uint8Array; fileName: string }) => {
        original.assertValidPdf(input.bytes);
        return {
          storagePath: `${input.campaignId}/one.pdf`,
          fileName: original.safePdfFileName(input.fileName),
          sizeBytes: input.bytes.length,
          uploadedAt: '2026-09-01T00:00:00.000Z',
        };
      },
    ),
    signedNewsletterPdfUrl: vi.fn(async (path: string) => `https://signed.test/${path}`),
    removeNewsletterPdf: vi.fn(async () => undefined),
    removeNewsletterPdfs: vi.fn(async () => undefined),
    downloadNewsletterPdf: vi.fn(async () => new Uint8Array()),
  };
});

import { kvStore } from './helpers/contract-harness.ts';
import {
  createDraftFromIntake,
  resolveIntakeIssueMonth,
  sweepNewsletterIntake,
} from '../newsletter-intake-service.ts';
import { encodePdfBase64 } from '../newsletter-studio-storage.ts';
import { parseReviewRecipients, buildReviewUrl } from '../newsletter-intake-notify.ts';
import type { NewsletterCampaign } from '../newsletter-studio-types.ts';
import {
  NEWSLETTER_INTAKE_KEY_NAMESPACE,
  type NewsletterIntakeReservation,
} from '../repositories/newsletter-studio-repository.ts';

const PDF = new TextEncoder().encode('%PDF-1.4\n%routine\n');

const GROUP = {
  id: 'sys_newsletter_contacts',
  name: 'Newsletter Contacts',
  description: '',
  type: 'system',
  clientIds: [] as string[],
  externalContacts: [{ email: 'a@x.co', source: 'newsletter', subscribedAt: '2026-01-01' }],
  clientCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'system',
};

function campaigns(): NewsletterCampaign[] {
  const out: NewsletterCampaign[] = [];
  kvStore.forEach((value, key) => {
    if (key.startsWith('nlstudio:campaign:')) out.push(value as NewsletterCampaign);
  });
  return out;
}

function reservations(): NewsletterIntakeReservation[] {
  const out: NewsletterIntakeReservation[] = [];
  kvStore.forEach((value, key) => {
    if (key.startsWith(NEWSLETTER_INTAKE_KEY_NAMESPACE))
      out.push(value as NewsletterIntakeReservation);
  });
  return out;
}

const baseInput = () => ({
  title: 'September issue',
  description: 'What mattered.',
  listIds: ['sys_newsletter_contacts'],
  fileName: 'Sept 2026.pdf',
  bytes: PDF,
  idempotencyKey: '2026-09',
  submittedBy: 'claude-routine',
});

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  pg.state.rows = [];
  pg.state.selectError = null;
  pg.state.updates = [];
  email.sendEmail.mockResolvedValue(true);
  deps.getGroupById.mockImplementation(async (id: string) => (id === GROUP.id ? GROUP : null));
  deps.getGroups.mockResolvedValue({ data: [GROUP], total: 1, limit: 1000, offset: 0 });
});

describe('createDraftFromIntake', () => {
  it('creates a routine draft with the PDF, emails the admin once, and stamps reviewNotifiedAt', async () => {
    const outcome = await createDraftFromIntake(baseInput());
    expect(outcome.duplicate).toBe(false);
    expect(outcome.notified).toBe(true);
    expect(outcome.reviewUrl).toBe(buildReviewUrl(outcome.campaignId));

    const [draft] = campaigns();
    expect(draft).toMatchObject({
      id: outcome.campaignId,
      status: 'draft',
      source: 'routine',
      sourceRef: '2026-09',
      createdBy: 'routine:claude-routine',
      title: 'September issue',
      listNames: ['Newsletter Contacts'],
    });
    expect(draft.pdf).toMatchObject({ fileName: 'Sept-2026.pdf', sizeBytes: PDF.length });
    expect(draft.reviewNotifiedAt).toBeTruthy();

    expect(email.sendEmail).toHaveBeenCalledTimes(1);
    const mail = email.sendEmail.mock.calls[0][0] as unknown as {
      to: string;
      subject: string;
      html: string;
      text: string;
    };
    expect(mail.to).toBe('info@navigatewealth.co');
    expect(mail.subject).toContain('September issue');
    expect(mail.html).toContain(`button="${outcome.reviewUrl}"`);
    expect(mail.html).toContain('claude-routine');
    expect(mail.text).toContain(outcome.reviewUrl);
  });

  it('escapes routine-supplied text in the admin email', async () => {
    await createDraftFromIntake({ ...baseInput(), title: '<img src=x onerror=1>' });
    const mail = email.sendEmail.mock.calls[0][0] as unknown as { html: string };
    expect(mail.html).toContain('&lt;img src=x onerror=1&gt;');
    expect(mail.html).not.toContain('<img src=x');
  });

  it('returns the existing draft on a replayed key and sends nothing', async () => {
    const first = await createDraftFromIntake(baseInput());
    const second = await createDraftFromIntake({ ...baseInput(), title: 'Different title' });
    expect(second).toMatchObject({ campaignId: first.campaignId, duplicate: true, notified: true });
    expect(campaigns()).toHaveLength(1);
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('creates exactly one draft when two hand-overs with one key overlap (review finding)', async () => {
    // Both calls pass the "does a draft exist yet?" lookup before either
    // draft is written; the reservation decides who wins.
    const [a, b] = await Promise.all([
      createDraftFromIntake(baseInput()),
      createDraftFromIntake({ ...baseInput(), title: 'Overlapping copy' }),
    ]);
    const [winner, loser] = a.duplicate ? [b, a] : [a, b];
    expect(winner.duplicate).toBe(false);
    expect(loser).toMatchObject({ campaignId: winner.campaignId, duplicate: true });
    expect(campaigns()).toHaveLength(1);
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
    expect(reservations()).toEqual([
      expect.objectContaining({ key: '2026-09', campaignId: winner.campaignId }),
    ]);
  });

  it('replays through the reservation without scanning campaigns', async () => {
    const first = await createDraftFromIntake(baseInput());
    expect(reservations()[0]).toMatchObject({ key: '2026-09', campaignId: first.campaignId });
    const second = await createDraftFromIntake(baseInput());
    expect(second).toMatchObject({ campaignId: first.campaignId, duplicate: true });
    expect(reservations()).toHaveLength(1);
  });

  it('rejects an unknown audience with the valid ids and creates nothing', async () => {
    await expect(createDraftFromIntake({ ...baseInput(), listIds: ['nope'] })).rejects.toThrow(
      /Unknown audience id\(s\): nope\. Valid ids: sys_newsletter_contacts/,
    );
    expect(campaigns()).toHaveLength(0);
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('removes the draft again when the PDF is rejected, and releases the key for a corrected hand-over', async () => {
    await expect(
      createDraftFromIntake({ ...baseInput(), bytes: new TextEncoder().encode('not a pdf') }),
    ).rejects.toThrow(/not a PDF/);
    expect(campaigns()).toHaveLength(0);
    expect(reservations()).toHaveLength(0);
    expect(email.sendEmail).not.toHaveBeenCalled();

    const retry = await createDraftFromIntake(baseInput());
    expect(retry.duplicate).toBe(false);
    expect(campaigns()).toHaveLength(1);
  });

  it('releases the key when the audience is unknown', async () => {
    await expect(createDraftFromIntake({ ...baseInput(), listIds: ['nope'] })).rejects.toThrow(
      /Unknown audience/,
    );
    expect(reservations()).toHaveLength(0);
  });

  it('keeps the draft when the review email fails, without stamping reviewNotifiedAt', async () => {
    email.sendEmail.mockRejectedValueOnce(new Error('smtp down'));
    const outcome = await createDraftFromIntake(baseInput());
    expect(outcome.notified).toBe(false);
    expect(campaigns()[0].reviewNotifiedAt).toBeNull();
  });
});

describe('the issue month a hand-over files under (review finding)', () => {
  it('reads the documented YYYY-MM idempotency key as the issue month', () => {
    expect(resolveIntakeIssueMonth({ idempotencyKey: '2026-09' })).toBe('2026-09');
    expect(resolveIntakeIssueMonth({ idempotencyKey: '2026-12' })).toBe('2026-12');
  });

  it('prefers an explicit field over the key', () => {
    expect(resolveIntakeIssueMonth({ issueMonth: '2026-08', idempotencyKey: '2026-09' })).toBe(
      '2026-08',
    );
  });

  it('falls through to the create-time default for a key that is not a month', () => {
    expect(resolveIntakeIssueMonth({ idempotencyKey: 'sept-final' })).toBeUndefined();
    expect(resolveIntakeIssueMonth({ idempotencyKey: '2026-13' })).toBeUndefined();
    expect(resolveIntakeIssueMonth({ idempotencyKey: null })).toBeUndefined();
  });

  it('files a September hand-over under September however late it is processed', async () => {
    const outcome = await createDraftFromIntake({ ...baseInput(), idempotencyKey: '2026-09' });
    const draft = campaigns().find((c) => c.id === outcome.campaignId);
    expect(draft?.issueMonth).toBe('2026-09');
  });
});

describe('parseReviewRecipients', () => {
  it('falls back to the admin inbox and de-duplicates a comma list', () => {
    expect(parseReviewRecipients(undefined)).toEqual(['info@navigatewealth.co']);
    expect(parseReviewRecipients(' A@x.co, b@x.co ,a@x.co, junk ')).toEqual(['a@x.co', 'b@x.co']);
  });
});

describe('sweepNewsletterIntake', () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'row-1',
    title: 'From SQL',
    description: 'Handed over through the connector.',
    list_ids: ['sys_newsletter_contacts'],
    file_name: 'sql.pdf',
    pdf_base64: encodePdfBase64(PDF),
    idempotency_key: '2026-10',
    submitted_by: 'chatgpt-routine',
    status: 'pending',
    error: null,
    campaign_id: null,
    created_at: '2026-10-01T04:00:00.000Z',
    processed_at: null,
    ...overrides,
  });

  it('promotes a pending row into a draft, nulls the base64 and records the campaign id', async () => {
    pg.state.rows = [row()];
    const result = await sweepNewsletterIntake();
    expect(result).toMatchObject({ examined: 1, processed: 1, failed: 0, errors: [] });

    const [draft] = campaigns();
    expect(draft).toMatchObject({ source: 'routine', sourceRef: '2026-10', title: 'From SQL' });
    expect(draft.pdf?.fileName).toBe('sql.pdf');
    expect(pg.state.updates[0]).toMatchObject({
      id: 'row-1',
      patch: { status: 'processed', campaign_id: draft.id, pdf_base64: null },
    });
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('marks a bad row failed with the reason, and still nulls its payload', async () => {
    pg.state.rows = [row({ pdf_base64: encodePdfBase64(new TextEncoder().encode('nope')) })];
    const result = await sweepNewsletterIntake();
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatch(/row-1: .*not a PDF/);
    expect(pg.state.updates[0].patch).toMatchObject({ status: 'failed', pdf_base64: null });
    expect(pg.state.updates[0].patch.error).toMatch(/not a PDF/);
    expect(campaigns()).toHaveLength(0);
  });

  it('treats a missing table as nothing pending', async () => {
    pg.state.selectError = { code: '42P01', message: 'relation does not exist' };
    const result = await sweepNewsletterIntake();
    expect(result).toEqual({ examined: 0, processed: 0, failed: 0, errors: [] });
  });

  it('surfaces any other read error', async () => {
    pg.state.selectError = { message: 'connection refused' };
    await expect(sweepNewsletterIntake()).rejects.toThrow(/connection refused/);
  });

  it('does nothing on an idle tick', async () => {
    const result = await sweepNewsletterIntake();
    expect(result.examined).toBe(0);
    expect(pg.state.updates).toHaveLength(0);
  });
});
