/**
 * Publications — useArticles Hook (React Query)
 *
 * Guidelines §6  — All server state managed by React Query.
 * Guidelines §11.2 — Deterministic query keys from centralized registry.
 */

import { useQuery } from '@tanstack/react-query';
import { PublicationsAPI } from '../api';
import type { Article, ArticleFilters } from '../types';
import { publicationKeys } from './queryKeys';

interface UseArticlesReturn {
  articles: Article[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useArticles(params?: ArticleFilters): UseArticlesReturn {
  const { data: articles = [], isLoading, isFetching, error, refetch: queryRefetch } = useQuery({
    queryKey: publicationKeys.articleList(params),
    queryFn: () => PublicationsAPI.Articles.getArticles(params),
    staleTime: 5 * 60 * 1000,
  });

  const refetch = async () => {
    await queryRefetch();
  };

  return {
    articles,
    isLoading,
    isRefreshing: isFetching,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch articles') : null,
    refetch,
    refresh: refetch,
  };
}
