/**
 * Featured articles for the home page — the one client for the published,
 * featured publications request, and the helpers both home page designs use
 * to show the result.
 *
 * Guidelines §3.2 — the frontend never accesses Supabase directly; it calls
 * the server API.
 */
import { projectId, publicAnonKey } from '../../utils/supabase/info';

export interface FeaturedArticle {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  author_name?: string;
  category_name?: string;
  published_at?: string;
  reading_time_minutes?: number;
  hero_image_url?: string;
  thumbnail_image_url?: string;
  featured_image_url?: string;
  view_count?: number;
}

export function formatArticleDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export function resolveArticleImage(article: FeaturedArticle): string {
  return article.hero_image_url || article.thumbnail_image_url || article.featured_image_url || '';
}

export function articlePath(slug: string): string {
  return `/resources/article/${slug}`;
}

/**
 * Sorts up to 4 featured articles so the one with the highest view_count is
 * first (hero position). Ties are broken by published_at descending (most
 * recent first), which is the most contextually logical ordering for a wealth
 * management platform.
 */
export function sortFeaturedArticles(articles: FeaturedArticle[]): FeaturedArticle[] {
  return [...articles].sort((a, b) => {
    const viewDiff = (b.view_count ?? 0) - (a.view_count ?? 0);
    if (viewDiff !== 0) return viewDiff;
    // Tiebreaker: most recently published first
    const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
    const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
    return bTime - aTime;
  });
}

/**
 * Up to four published, featured articles, most-read first. Rejects on an
 * HTTP or network error; callers treat that as "nothing to show".
 */
export async function fetchFeaturedArticles(): Promise<FeaturedArticle[]> {
  const url = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications/articles?status=published&is_featured=true&limit=4`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${publicAnonKey}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const raw: FeaturedArticle[] = Array.isArray(json?.data) ? json.data : [];
  return sortFeaturedArticles(raw.slice(0, 4));
}
