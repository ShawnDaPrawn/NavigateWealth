/**
 * Publications — useArticles Hook (React Query)
 *
 * Guidelines §6  — All server state managed by React Query.
 * Guidelines §11.2 — Deterministic query keys from centralized registry.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { PublicationsAPI } from '../api';
import type { Article, ArticleFilters } from '../types';
import { publicationKeys } from './queryKeys';

interface UseArticlesReturn {
  articles: Article[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useArticles(params?: ArticleFilters): UseArticlesReturn {
  const queryClient = useQueryClient();

  const { data: articles = [], isLoading, error } = useQuery({
    queryKey: publicationKeys.articleList(params),
    queryFn: () => PublicationsAPI.Articles.getArticles(params),
    staleTime: 5 * 60 * 1000,
  });

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: publicationKeys.articles(),
      refetchType: 'all',
    });
  }, [queryClient]);

  return {
    articles,
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch articles') : null,
    refetch,
    refresh: refetch,
  };
}