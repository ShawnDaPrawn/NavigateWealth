/**
 * The newsletter issue page's data rules for the Navigator design, kept out of
 * the components so they can be read (and tested) on their own.
 *
 * Nothing here invents content: the headline, the byline, the file line and
 * the previous issue all come from the published records the public route
 * serves (newsletterArchive.ts's PublicNewsletter).
 */
import {
  formatPdfSize,
  type PublicNewsletter,
} from '../../components/pages/resources/newsletterArchive';

/** Where "All newsletters" goes: the live page's archive link. */
export const ARCHIVE_PATH = '/resources?section=newsletters';

/**
 * The reader's zoom, as the board draws it: the page is 540px wide at 100%,
 * and the controls step it by 10% between 70% and 150%.
 */
export const ZOOM = { base: 540, min: 70, max: 150, step: 10, start: 100 } as const;

export function pageWidth(zoom: number): number {
  return Math.round((ZOOM.base * zoom) / 100);
}

/**
 * The issue's own headline. Issues are titled the way the email subject reads
 * — "Navigate Wealth | October 2026 | The Wealth Compass: Make room for 2027"
 * — and the board heads the page with the last part alone, the full title
 * standing under it as the byline. A title without "|" is its own headline.
 */
export function issueHeadline(title: string): string {
  const parts = (title ?? '')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : '';
}

/**
 * The byline under the headline: the full title, when it says more than the
 * headline does. Otherwise nothing, so the page never prints a line twice.
 */
export function issueByline(title: string): string {
  const full = (title ?? '').trim();
  return full && full !== issueHeadline(full) ? full : '';
}

/**
 * The headline split where the board sets its italic: everything after the
 * first colon ("The Wealth Compass: *Make room for 2027*"). No colon, no
 * italic.
 */
export function splitHeadline(headline: string): { lead: string; accent: string } {
  const at = headline.indexOf(':');
  const accent = at >= 0 ? headline.slice(at + 1).trim() : '';
  if (!accent) return { lead: headline, accent: '' };
  return { lead: headline.slice(0, at + 1), accent };
}

/**
 * "Navigate_Wealth_Newsletter_2026-10.pdf · 1.8 MB": the file's real name and
 * size, each only when the record has it. Empty when it has neither.
 */
export function fileLine(newsletter: Pick<PublicNewsletter, 'pdfFileName' | 'pdfSizeBytes'>) {
  return [newsletter.pdfFileName?.trim(), formatPdfSize(newsletter.pdfSizeBytes)]
    .filter(Boolean)
    .join(' · ');
}

/** Older than `issue`: an earlier issue month, or the same month published earlier. */
function isOlder(candidate: PublicNewsletter, issue: PublicNewsletter): boolean {
  if (candidate.issueMonth !== issue.issueMonth) return candidate.issueMonth < issue.issueMonth;
  return candidate.publishedAt < issue.publishedAt;
}

/**
 * The issue before this one, from the archive the public route serves (newest
 * first, by issue month and then publication date). Null for the first issue,
 * or while the archive has not loaded.
 */
export function previousIssue(
  archive: readonly PublicNewsletter[] | undefined,
  issue: PublicNewsletter,
): PublicNewsletter | null {
  if (!archive) return null;
  const older = archive.filter((n) => n.slug !== issue.slug && isOlder(n, issue));
  if (older.length === 0) return null;
  return older.reduce((best, n) => (isOlder(best, n) ? n : best));
}
