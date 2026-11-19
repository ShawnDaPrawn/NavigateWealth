/**
 * Published articles marked `is_featured`, for the home page's Featured
 * Insights in both website designs.
 *
 * Read through the server's public publications route (Guidelines §3.2: the
 * frontend never reads Supabase directly). Errors resolve to an empty list,
 * because the section hides itself when there is nothing to show.
 */
import { useEffect, useState } from 'react';
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

/** At most this many are fetched; a layout may show fewer. */
export const FEATURED_ARTICLE_LIMIT = 4;

export function formatArticleDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function articleImage(article: FeaturedArticle): string {
  return article.hero_image_url || article.thumbnail_image_url || article.featured_image_url || '';
}

export function articlePath(slug: string): string {
  return `/resources/article/${slug}`;
}

/**
 * Most-read first, so the lead card is the one readers chose. Ties go to the
 * most recently published.
 */
export function sortFeaturedArticles(articles: FeaturedArticle[]): FeaturedArticle[] {
  return [...articles].sort((a, b) => {
    const viewDiff = (b.view_count ?? 0) - (a.view_count ?? 0);
    if (viewDiff !== 0) return viewDiff;
    const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
    const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
    return bTime - aTime;
  });
}

export function useFeaturedArticles(): { articles: FeaturedArticle[]; loading: boolean } {
  const [articles, setArticles] = useState<FeaturedArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const url = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications/articles?status=published&is_featured=true&limit=${FEATURED_ARTICLE_LIMIT}`;

    fetch(url, { headers: { Authorization: `Bearer ${publicAnonKey}` } })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        const raw: FeaturedArticle[] = Array.isArray(json?.data) ? json.data : [];
        setArticles(sortFeaturedArticles(raw.slice(0, FEATURED_ARTICLE_LIMIT)));
      })
      .catch(() => {
        if (!cancelled) setArticles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { articles, loading };
}
