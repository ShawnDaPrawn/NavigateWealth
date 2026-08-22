/**
 * Loading one article by its slug.
 *
 * Split out of `ArticleDetailPage.tsx` (1,486 lines), which held the page, its
 * loading and error states, the share menu, the fallback article set and every
 * helper in one file. Each was already a self-contained function; only its
 * address changed.
 */
import { useState, useEffect, useCallback } from 'react';
import { publicAnonKey } from '../../../utils/supabase/info';
import { API_CONFIG } from '../../../utils/api/config';
import { type ArticleDisplay } from './articleTypes';

export function useArticleBySlug(slug: string | undefined) {
  const [article, setArticle] = useState<ArticleDisplay | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArticle = useCallback(async () => {
    if (!slug) return;

    setIsLoading(true);
    setError(null);

    try {
      const url = `${API_CONFIG.BASE_URL}/publications/articles/slug/${slug}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch article (${response.status})`);
      }

      const data = await response.json();
      setArticle(data.data || data);

      // Increment view count silently
      const articleData = data.data || data;
      if (articleData?.id) {
        fetch(`${API_CONFIG.BASE_URL}/publications/articles/${articleData.id}/increment-views`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }).catch(() => {
          /* silent */
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch article';
      setError(errorMessage);
      console.error('useArticleBySlug error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  return { article, isLoading, error, refetch: fetchArticle };
}

// ---------------------------------------------------------------------------
// Demo articles fallback
// ---------------------------------------------------------------------------
