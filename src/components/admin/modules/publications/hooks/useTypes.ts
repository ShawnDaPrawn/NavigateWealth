/**
 * Publications — useTypes Hook (React Query)
 *
 * Guidelines §6  — All server state managed by React Query.
 * Guidelines §11.2 — Deterministic query keys from centralized registry.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { PublicationsAPI } from '../api';
import type { ContentType } from '../types';
import { publicationKeys } from './queryKeys';

interface UseTypesOptions {
  activeOnly?: boolean;
  autoSort?: boolean;
}

interface UseTypesReturn {
  types: ContentType[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useTypes(options?: UseTypesOptions): UseTypesReturn {
  const { activeOnly = false, autoSort = true } = options || {};
  const queryClient = useQueryClient();

  const { data: rawTypes = [], isLoading, error } = useQuery({
    queryKey: publicationKeys.types(),
    queryFn: () => PublicationsAPI.Types.getTypes(),
    staleTime: 5 * 60 * 1000,
  });

  const types = useMemo(() => {
    let result = [...rawTypes];
    if (activeOnly) {
      result = result.filter(type => type.is_active);
    }
    if (autoSort) {
      result = result.sort((a, b) => a.sort_order - b.sort_order);
    }
    return result;
  }, [rawTypes, activeOnly, autoSort]);

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: publicationKeys.types() });
  }, [queryClient]);

  return {
    types,
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch types') : null,
    refetch,
    refresh: refetch,
  };
}
