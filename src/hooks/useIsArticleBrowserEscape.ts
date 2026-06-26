import { useLocation } from 'react-router';
import { useIsStandalone } from './useIsStandalone';
import { isArticleRoute } from '../utils/pwa/articleRoute';

/**
 * True when an emailed article link has been opened inside the installed PWA and
 * should be handed off to the public website instead of rendering in the app.
 *
 * MainLayout uses this to render the article interstitial *instead of* the
 * article page, so `ArticleDetailPage` never mounts in the PWA. That matters
 * because the article page increments the view count and fires email open/read
 * engagement events on mount — rendering it behind the interstitial would
 * double-count every client click (the website records the same events once it
 * opens).
 *
 * Returns false in normal browser tabs, so the website renders articles as
 * usual.
 */
export function useIsArticleBrowserEscape(): boolean {
  const location = useLocation();
  const isStandalone = useIsStandalone();
  return isStandalone && isArticleRoute(location.pathname);
}
