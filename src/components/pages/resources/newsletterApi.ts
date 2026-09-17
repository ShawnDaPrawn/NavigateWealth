/**
 * The website's read-only client for published newsletters.
 *
 * Talks to `/newsletter-site`, the unauthenticated router
 * (newsletter-site-routes.ts), through the shared API client rather than a
 * bare `fetch`: it brings retry on a transient failure, a typed error and the
 * one data path the raw-fetch ratchet exists to converge on. The client sends
 * no Authorization header when nobody is signed in, which is exactly right
 * for a public route — the anon key was never a credential.
 */
import { api, APIError } from '../../../utils/api';
import type { PublicNewsletter } from './newsletterArchive';

const MODULE = '/newsletter-site/newsletters';

/** Every newsletter live on the website, newest issue first. */
export async function fetchPublishedNewsletters(): Promise<PublicNewsletter[]> {
  const data = await api.get<{ newsletters?: PublicNewsletter[] }>(MODULE);
  return data.newsletters ?? [];
}

/** One newsletter by slug. Returns null when there is no such newsletter. */
export async function fetchPublishedNewsletter(slug: string): Promise<PublicNewsletter | null> {
  try {
    const data = await api.get<{ newsletter?: PublicNewsletter }>(
      `${MODULE}/${encodeURIComponent(slug)}`,
    );
    return data.newsletter ?? null;
  } catch (error) {
    // A slug that does not exist is an answer, not a failure: the page shows
    // its "not found" state rather than an error banner.
    if (error instanceof APIError && error.statusCode === 404) return null;
    throw error;
  }
}
