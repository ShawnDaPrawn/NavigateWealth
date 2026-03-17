/**
 * Publications — useCategories Hook (React Query)
 *
 * Guidelines §6  — All server state managed by React Query.
 * Guidelines §11.2 — Deterministic query keys from centralized registry.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { PublicationsAPI } from '../api';
import type { Category } from '../types';
import { publicationKeys } from './queryKeys';

interface UseCategoriesOptions {
  activeOnly?: boolean;
  autoSort?: boolean;
}

interface UseCategoriesReturn {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCategories(options?: UseCategoriesOptions): UseCategoriesReturn {
  const { activeOnly = false, autoSort = true } = options || {};
  const queryClient = useQueryClient();

  const { data: rawCategories = [], isLoading, error } = useQuery({
    queryKey: publicationKeys.categories(),
    queryFn: () => PublicationsAPI.Categories.getCategories(),
    staleTime: 5 * 60 * 1000,
  });

  // Client-side filtering/sorting derived from cached data
  const categories = useMemo(() => {
    let result = [...rawCategories];
    if (activeOnly) {
      result = result.filter(cat => cat.is_active);
    }
    if (autoSort) {
      result = result.sort((a, b) => a.sort_order - b.sort_order);
    }
    return result;
  }, [rawCategories, activeOnly, autoSort]);

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: publicationKeys.categories() });
  }, [queryClient]);

  return {
    categories,
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch categories') : null,
    refetch,
    refresh: refetch,
  };
}
