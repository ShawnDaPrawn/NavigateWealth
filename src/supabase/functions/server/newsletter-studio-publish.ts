/**
 * Newsletter Studio — the public-website surface.
 *
 * A campaign that has been published appears on navigatewealth.co/resources
 * under the Newsletters tab, filed by its issue month, with its own page at
 * /resources/newsletter/<slug>. Two things make that work, and both live here:
 *
 *   1. The PDF is COPIED into the public bucket, so the page can embed it and
 *      the link can be shared and indexed (newsletter-studio-storage.ts says
 *      why a signed URL cannot do that job).
 *   2. A `PublishedNewsletter` record is written to its own KV namespace —
 *      the only thing the unauthenticated endpoint reads. Recipient counts,
 *      audience names, delivery errors and lease state never leave the admin.
 *
 * Publishing is independent of sending. An admin may publish without emailing
 * anyone, email without publishing, or both; the send path calls in here when
 * a campaign finishes with `publishToWebsite` set.
 *
 * DEPENDENCY DIRECTION: this module takes campaign records as arguments and
 * never imports newsletter-studio-service.ts, so the service can call it
 * freely without a cycle.
 */

import { createModuleLogger } from './stderr-logger.ts';
import { ValidationError } from './error.middleware.ts';
import { publishNewsletterPdf, unpublishNewsletterPdf } from './newsletter-studio-storage.ts';
import { newsletterPublications } from './repositories/newsletter-studio-repository.ts';
import type {
  NewsletterCampaign,
  NewsletterWebsitePublication,
  PublishedNewsletter,
} from './newsletter-studio-types.ts';

const log = createModuleLogger('newsletter-studio-publish');

/** `2026-09` → `{ year: 2026, month: 9 }`. Invalid input falls back to today. */
export function parseIssueMonth(issueMonth: string): { year: number; month: number } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(issueMonth ?? '');
  if (!match) {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

/** The current month as `YYYY-MM`, the default issue month for a new campaign. */
export function currentIssueMonth(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Longest title stem a slug carries, before the word-boundary trim. */
const SLUG_STEM_MAX = 60;

/**
 * URL segment for a newsletter: the issue month, then the title.
 *
 * Month-first so the slug sorts and reads chronologically, and so two issues
 * that happen to share a title (\"Monthly Market Review\") never collide in the
 * first place. `taken` still disambiguates anything left over.
 */
export function newsletterSlug(title: string, issueMonth: string, taken: string[] = []): string {
  const { year, month } = parseIssueMonth(issueMonth);
  const words = (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // Truncate on a word boundary, not mid-word: this ends up in a permanent,
  // indexable, shared URL, and `...compass-protect-wh` reads like a mistake.
  let stem = words;
  if (stem.length > SLUG_STEM_MAX) {
    const cut = stem.slice(0, SLUG_STEM_MAX);
    // When the character just past the limit is the separator, `cut` already
    // ends on a whole word, and backtracking would throw that word away
    // (review finding: a 58-character word that fitted exactly was lost).
    if (words[SLUG_STEM_MAX] === '-') {
      stem = cut;
    } else {
      const lastBoundary = cut.lastIndexOf('-');
      stem = lastBoundary > 0 ? cut.slice(0, lastBoundary) : cut;
    }
  }
  stem = stem.replace(/-+$/g, '');
  const base = `${year}-${String(month).padStart(2, '0')}-${stem || 'newsletter'}`;
  if (!taken.includes(base)) return base;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/** Every newsletter live on the website, newest issue first. */
export async function listPublishedNewsletters(): Promise<PublishedNewsletter[]> {
  const { items } = await newsletterPublications.list({ limit: 1000 });
  return items.sort((a, b) => {
    if (a.issueMonth !== b.issueMonth) return a.issueMonth < b.issueMonth ? 1 : -1;
    return a.publishedAt < b.publishedAt ? 1 : -1;
  });
}

export async function getPublishedNewsletter(slug: string): Promise<PublishedNewsletter | null> {
  return (await newsletterPublications.get(slug)) ?? null;
}

/**
 * Put a campaign on the website, or refresh what is already there.
 *
 * Idempotent: re-publishing keeps the slug (links in circulation stay valid)
 * and overwrites the copied PDF and the record, so a title, description,
 * issue-month or PDF correction in the admin reaches the site.
 */
export async function publishCampaignToWebsite(
  campaign: NewsletterCampaign,
): Promise<NewsletterWebsitePublication> {
  if (!campaign.pdf) {
    throw new ValidationError('Upload the newsletter PDF before publishing it on the website');
  }

  const { year, month } = parseIssueMonth(campaign.issueMonth);
  let slug = campaign.website?.slug;
  if (!slug) {
    const existing = await listPublishedNewsletters();
    slug = newsletterSlug(
      campaign.title,
      campaign.issueMonth,
      existing.map((n) => n.slug),
    );
  }

  const { url, publicPath } = await publishNewsletterPdf({
    storagePath: campaign.pdf.storagePath,
    slug,
    year,
  });

  const publishedAt = campaign.website?.publishedAt ?? new Date().toISOString();
  const record: PublishedNewsletter = {
    slug,
    campaignId: campaign.id,
    title: campaign.title,
    description: campaign.description,
    issueMonth: campaign.issueMonth,
    year,
    month,
    pdfUrl: url,
    pdfFileName: campaign.pdf.fileName,
    pdfSizeBytes: campaign.pdf.sizeBytes,
    publishedAt,
  };
  await newsletterPublications.put(slug, record);
  log.info('Newsletter published to the website', { campaignId: campaign.id, slug });

  return {
    slug,
    publishedAt,
    pdfUrl: url,
    publicPath,
    pdfFileName: campaign.pdf.fileName,
    pdfSizeBytes: campaign.pdf.sizeBytes,
  };
}

/**
 * Take a campaign off the website. A campaign that was never live is a no-op.
 *
 * The public object goes FIRST, and a failure there propagates: the index
 * record and the campaign's `website` pointer are what a retry needs, so
 * losing them while the file is still served would strand it (review
 * finding). Removing the record after the file means the worst interleaving
 * is a listed newsletter whose file is already gone, which the next attempt
 * finishes cleanly.
 */
export async function unpublishCampaignFromWebsite(campaign: NewsletterCampaign): Promise<void> {
  const live = campaign.website;
  if (!live) return;
  await unpublishNewsletterPdf(live.publicPath);
  await newsletterPublications.remove(live.slug);
  log.info('Newsletter removed from the website', { campaignId: campaign.id, slug: live.slug });
}

/**
 * Keep a live newsletter in step with an edit. Only touches the index record,
 * so a title fix does not re-upload a PDF that has not changed.
 */
export async function refreshPublishedNewsletter(campaign: NewsletterCampaign): Promise<void> {
  const live = campaign.website;
  if (!live) return;
  const existing = await newsletterPublications.get(live.slug);
  if (!existing) return;
  const { year, month } = parseIssueMonth(campaign.issueMonth);
  await newsletterPublications.put(live.slug, {
    ...existing,
    title: campaign.title,
    description: campaign.description,
    issueMonth: campaign.issueMonth,
    year,
    month,
  });
}
