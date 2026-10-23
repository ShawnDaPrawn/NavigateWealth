/**
 * Client reviews shown on the public site.
 *
 * Only reviews that a reader can trace belong here: each one must already be
 * published on a public review platform (Google, Trustpilot, Hellopeter, …),
 * and the entry links to that review and carries the date it was posted.
 * Unattributed quotes, initials-only names and undated testimonials were the
 * reason a directory listing was declined in October 2026 — see
 * src/config/companyFacts.ts — so they are not accepted here.
 *
 * While this list is empty, the reviews section renders nothing at all.
 */
export interface PublishedReview {
  /** The review text, quoted exactly as it appears on the platform. */
  quote: string;
  /** The reviewer's name exactly as the platform displays it. */
  author: string;
  /** Where the review is published, e.g. "Google" or "Trustpilot". */
  platform: string;
  /** Public link to the review itself, so a reader can verify it. */
  url: string;
  /** Date the review was posted, as YYYY-MM-DD. */
  postedOn: string;
  /** Star rating given on the platform, if it uses one. */
  rating?: 1 | 2 | 3 | 4 | 5;
}

export const PUBLISHED_REVIEWS: readonly PublishedReview[] = [];
