import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PublicationsAPI } from '../api';
import type { InitializePublicationsInput } from '../types';
import { publicationsKeys } from '../../../../../utils/queryKeys';

export function usePublicationsInit() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: publicationsKeys.initialization(),
    queryFn: PublicationsAPI.Init.checkStatus,
    staleTime: 0,
    retry: 1
  });

  const { mutateAsync: initialize, isPending: isInitializing, error: initError } = useMutation({
    mutationFn: (input: InitializePublicationsInput = {}) => PublicationsAPI.Init.initialize(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: publicationsKeys.initialization() });
    }
  });

  return {
    isInitialized: data?.is_initialized ?? null,
    hasCategories: data?.has_categories ?? false,
    hasTypes: data?.has_types ?? false,
    isLoading,
    isInitializing,
    error: error || initError,
    checkInitialization: refetch,
    initialize
  };
}