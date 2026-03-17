/**
 * Publications Feature - useArticle Hook
 * 
 * Hook for fetching and managing a single article.
 */

import { useState, useEffect, useCallback } from 'react';
import { ArticlesAPI } from '../api';
import type { Article } from '../types';

interface UseArticleOptions {
  id?: string;
  slug?: string;
  enabled?: boolean; // Allow conditional fetching
}

interface UseArticleReturn {
  article: Article | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useArticle(options: UseArticleOptions): UseArticleReturn {
  const { id, slug, enabled = true } = options;
  
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArticle = useCallback(async () => {
    if (!enabled || (!id && !slug)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      let data: Article;
      
      if (id) {
        data = await ArticlesAPI.getArticle(id);
      } else if (slug) {
        data = await ArticlesAPI.getArticleBySlug(slug);
      } else {
        throw new Error('Either id or slug must be provided');
      }
      
      setArticle(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch article';
      setError(errorMessage);
      console.error('useArticle error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id, slug, enabled]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  return {
    article,
    isLoading,
    error,
    refetch: fetchArticle
  };
}