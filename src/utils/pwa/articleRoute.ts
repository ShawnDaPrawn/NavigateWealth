/**
 * Shared detection for public article ("insight") detail routes.
 *
 * Article links are the one piece of marketing content we expect to be shared
 * directly with clients (via email notifications), so the installed PWA must
 * treat them specially: rather than bouncing the client into the portal, an
 * article link should open on the public website. Centralising the path check
 * here keeps that decision consistent between the PWA escape component and the
 * standalone redirect guard.
 */

export const ARTICLE_ROUTE_PREFIX = '/resources/article/';

/**
 * True when the pathname points at a public article detail page
 * (`/resources/article/:slug`). The trailing slug segment must be non-empty so
 * the bare `/resources/article` prefix never matches.
 */
export function isArticleRoute(pathname: string): boolean {
  return pathname.startsWith(ARTICLE_ROUTE_PREFIX) && pathname.length > ARTICLE_ROUTE_PREFIX.length;
}
