/**
 * newsletter-studio-publish.ts — the website surface.
 *
 * The contracts worth pinning:
 *
 *   1. **A slug is stable.** Re-publishing after an edit keeps the same slug,
 *      because links already in circulation must keep working.
 *   2. **Publishing is idempotent.** It refreshes the record and the copied
 *      PDF rather than creating a second entry.
 *   3. **Unpublish removes both** the index record and the public object, so
 *      a withdrawn newsletter is not still downloadable.
 *   4. **The public record carries no delivery internals** — that payload is
 *      served to anonymous visitors.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const storage = vi.hoisted(() => ({
  published: [] as { storagePath: string; slug: string; year: number }[],
  removed: [] as string[],
}));

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../newsletter-studio-storage.ts', () => ({
  publishNewsletterPdf: vi.fn(
    async (input: { storagePath: string; slug: string; year: number }) => {
      storage.published.push(input);
      return {
        url: `https://cdn.test/newsletters/${input.year}/${input.slug}.pdf`,
        publicPath: `${input.year}/${input.slug}.pdf`,
      };
    },
  ),
  unpublishNewsletterPdf: vi.fn(async (path: string) => {
    storage.removed.push(path);
  }),
}));

import { kvStore } from './helpers/contract-harness.ts';
import {
  currentIssueMonth,
  getPublishedNewsletter,
  listPublishedNewsletters,
  newsletterSlug,
  parseIssueMonth,
  publishCampaignToWebsite,
  refreshPublishedNewsletter,
  unpublishCampaignFromWebsite,
} from '../newsletter-studio-publish.ts';
import type { NewsletterCampaign } from '../newsletter-studio-types.ts';

const campaign = (overrides: Partial<NewsletterCampaign> = {}): NewsletterCampaign =>
  ({
    id: 'c1',
    title: 'September Market Review',
    description: 'What mattered in September.',
    fromName: 'Navigate Wealth',
    listIds: [],
    listNames: [],
    pdf: {
      storagePath: 'c1/abc.pdf',
      fileName: 'september.pdf',
      sizeBytes: 1024,
      uploadedAt: '2026-09-30T00:00:00.000Z',
    },
    source: 'admin',
    sourceRef: null,
    reviewNotifiedAt: null,
    issueMonth: '2026-09',
    publishToWebsite: true,
    website: null,
    status: 'draft',
    scheduledAt: null,
    recipientCount: 205,
    sentCount: 200,
    failedCount: 5,
    processedCount: 205,
    progressPercent: 100,
    readCount: 42,
    statsRefreshedAt: null,
    createdBy: 'admin-1',
    createdAt: '2026-09-30T00:00:00.000Z',
    updatedAt: '2026-09-30T00:00:00.000Z',
    startedAt: null,
    completedAt: null,
    lastProgressAt: null,
    lastError: null,
    lockId: null,
    lockExpiresAt: null,
    ...overrides,
  }) as NewsletterCampaign;

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  storage.published.length = 0;
  storage.removed.length = 0;
});

describe('issue months and slugs', () => {
  it('reads a YYYY-MM issue month and falls back to today for anything else', () => {
    expect(parseIssueMonth('2026-09')).toEqual({ year: 2026, month: 9 });
    expect(parseIssueMonth('2026-12')).toEqual({ year: 2026, month: 12 });
    const now = new Date();
    expect(parseIssueMonth('2026-13')).toEqual({
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    });
    expect(parseIssueMonth('')).toEqual({
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    });
  });

  it('defaults a new campaign to the current month', () => {
    expect(currentIssueMonth(new Date('2026-09-17T00:00:00Z'))).toBe('2026-09');
    expect(currentIssueMonth(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01');
  });

  it('builds a month-first slug and disambiguates a repeat title', () => {
    expect(newsletterSlug('September Market Review', '2026-09')).toBe(
      '2026-09-september-market-review',
    );
    // The same title in a different month does not collide at all.
    expect(newsletterSlug('Monthly Review', '2026-10')).toBe('2026-10-monthly-review');
    // The same title in the SAME month does, and is numbered.
    expect(newsletterSlug('Monthly Review', '2026-10', ['2026-10-monthly-review'])).toBe(
      '2026-10-monthly-review-2',
    );
  });

  it('truncates a long title on a word boundary, never mid-word', () => {
    // The real September 2026 issue: the naive 60-character cut landed inside
    // "what", giving `...compass-protect-wh` in a permanent public URL.
    const slug = newsletterSlug(
      'Navigate Wealth | September 2026 | The Wealth Compass: Protect what matters',
      '2026-09',
    );
    expect(slug).toBe('2026-09-navigate-wealth-september-2026-the-wealth-compass-protect');
    expect(slug.endsWith('-')).toBe(false);
    // Every segment after the month prefix is a whole word from the title.
    const title = 'navigate wealth september 2026 the wealth compass protect what matters';
    for (const part of slug.replace(/^\d{4}-\d{2}-/, '').split('-')) {
      expect(title.split(' ')).toContain(part);
    }
  });

  it('still produces something usable from one very long unbroken word', () => {
    const slug = newsletterSlug('A'.repeat(90), '2026-09');
    expect(slug).toBe(`2026-09-${'a'.repeat(60)}`);
  });

  it('survives a title with nothing usable in it', () => {
    expect(newsletterSlug('!!!', '2026-09')).toBe('2026-09-newsletter');
  });
});

describe('publishing', () => {
  it('copies the PDF, writes the public record and reports where it went', async () => {
    const website = await publishCampaignToWebsite(campaign());

    expect(website.slug).toBe('2026-09-september-market-review');
    expect(storage.published).toEqual([
      { storagePath: 'c1/abc.pdf', slug: website.slug, year: 2026 },
    ]);

    const record = await getPublishedNewsletter(website.slug);
    expect(record).toMatchObject({
      slug: website.slug,
      campaignId: 'c1',
      title: 'September Market Review',
      issueMonth: '2026-09',
      year: 2026,
      month: 9,
      pdfFileName: 'september.pdf',
    });
  });

  it('never puts delivery internals in the public record', async () => {
    const website = await publishCampaignToWebsite(campaign());
    const record = (await getPublishedNewsletter(website.slug)) as unknown as Record<
      string,
      unknown
    >;
    for (const leaked of [
      'listIds',
      'listNames',
      'recipientCount',
      'sentCount',
      'failedCount',
      'readCount',
      'lastError',
      'lockId',
      'createdBy',
      'status',
    ]) {
      expect(record).not.toHaveProperty(leaked);
    }
  });

  it('refuses a campaign with no PDF', async () => {
    await expect(publishCampaignToWebsite(campaign({ pdf: null }))).rejects.toThrow(
      /PDF before publishing/,
    );
  });

  it('keeps the slug and the publish date when re-published after an edit', async () => {
    const first = await publishCampaignToWebsite(campaign());
    const edited = campaign({ title: 'A Completely Different Title', website: first });

    const second = await publishCampaignToWebsite(edited);

    expect(second.slug).toBe(first.slug);
    expect(second.publishedAt).toBe(first.publishedAt);
    expect(await listPublishedNewsletters()).toHaveLength(1);
    expect((await getPublishedNewsletter(first.slug))?.title).toBe('A Completely Different Title');
  });

  it('numbers a second newsletter that lands in the same month with the same title', async () => {
    await publishCampaignToWebsite(campaign());
    const second = await publishCampaignToWebsite(campaign({ id: 'c2' }));
    expect(second.slug).toBe('2026-09-september-market-review-2');
    expect(await listPublishedNewsletters()).toHaveLength(2);
  });

  it('lists newest issue first, and breaks a tie on publish time', async () => {
    await publishCampaignToWebsite(campaign({ id: 'a', issueMonth: '2025-03' }));
    await publishCampaignToWebsite(campaign({ id: 'b', issueMonth: '2026-09' }));
    await publishCampaignToWebsite(campaign({ id: 'c', issueMonth: '2026-01' }));
    expect((await listPublishedNewsletters()).map((n) => n.issueMonth)).toEqual([
      '2026-09',
      '2026-01',
      '2025-03',
    ]);
  });
});

describe('unpublishing', () => {
  it('removes the record and the public object together', async () => {
    const website = await publishCampaignToWebsite(campaign());
    await unpublishCampaignFromWebsite(campaign({ website }));

    expect(await getPublishedNewsletter(website.slug)).toBeNull();
    expect(storage.removed).toEqual(['2026/2026-09-september-market-review.pdf']);
    expect(await listPublishedNewsletters()).toHaveLength(0);
  });

  it('does nothing for a campaign that was never on the website', async () => {
    await unpublishCampaignFromWebsite(campaign());
    expect(storage.removed).toEqual([]);
  });
});

describe('refreshing after an edit', () => {
  it('carries a new title, description and issue month across without touching the PDF', async () => {
    const website = await publishCampaignToWebsite(campaign());
    storage.published.length = 0;

    await refreshPublishedNewsletter(
      campaign({
        website,
        title: 'Corrected title',
        description: 'New blurb',
        issueMonth: '2026-08',
      }),
    );

    const record = await getPublishedNewsletter(website.slug);
    expect(record).toMatchObject({
      title: 'Corrected title',
      description: 'New blurb',
      issueMonth: '2026-08',
      year: 2026,
      month: 8,
    });
    // Same slug, and no re-upload for a metadata-only change.
    expect(record?.slug).toBe(website.slug);
    expect(storage.published).toEqual([]);
  });

  it('is a no-op for a campaign that is not on the website', async () => {
    await refreshPublishedNewsletter(campaign());
    expect(await listPublishedNewsletters()).toHaveLength(0);
  });
});
