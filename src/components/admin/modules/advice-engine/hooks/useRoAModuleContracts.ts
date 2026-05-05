import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { roaApi } from '../api';
import { adviceEngineKeys } from './queryKeys';
import type { RoAContractStatus, RoAModuleContract } from '../types';

interface UseRoAModuleContractsOptions {
  status?: RoAContractStatus;
  includeArchived?: boolean;
}

export function useRoAModuleContracts(options: UseRoAModuleContractsOptions = {}) {
  const queryClient = useQueryClient();
  const filters = {
    status: options.status,
    includeArchived: options.includeArchived,
  };

  const contractsQuery = useQuery({
    queryKey: adviceEngineKeys.roa.moduleContracts(filters),
    queryFn: () => roaApi.getModuleContracts(filters),
    staleTime: 5 * 60 * 1000,
  });

  const schemaQuery = useQuery({
    queryKey: adviceEngineKeys.roa.moduleContractSchema(),
    queryFn: () => roaApi.getModuleContractSchemaFormat(),
    staleTime: 30 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: (contract: RoAModuleContract) => roaApi.saveModuleContract(contract),
    onSuccess: (contract) => {
      queryClient.setQueryData(adviceEngineKeys.roa.moduleContract(contract.id), contract);
      queryClient.invalidateQueries({ queryKey: adviceEngineKeys.roa.moduleContracts() });
      queryClient.invalidateQueries({ queryKey: adviceEngineKeys.roa.modules() });
    },
  });

  const publishMutation = useMutation({
    mutationFn: (moduleId: string) => roaApi.publishModuleContract(moduleId),
    onSuccess: (contract) => {
      queryClient.setQueryData(adviceEngineKeys.roa.moduleContract(contract.id), contract);
      queryClient.invalidateQueries({ queryKey: adviceEngineKeys.roa.moduleContracts() });
      queryClient.invalidateQueries({ queryKey: adviceEngineKeys.roa.modules() });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (moduleId: string) => roaApi.archiveModuleContract(moduleId),
    onSuccess: (contract) => {
      queryClient.setQueryData(adviceEngineKeys.roa.moduleContract(contract.id), contract);
      queryClient.invalidateQueries({ queryKey: adviceEngineKeys.roa.moduleContracts() });
      queryClient.invalidateQueries({ queryKey: adviceEngineKeys.roa.modules() });
    },
  });

  return {
    contracts: contractsQuery.data || [],
    schemaFormat: schemaQuery.data,
    isLoading: contractsQuery.isLoading || schemaQuery.isLoading,
    error: contractsQuery.error || schemaQuery.error,
    saveContract: saveMutation.mutateAsync,
    publishContract: publishMutation.mutateAsync,
    archiveContract: archiveMutation.mutateAsync,
    isSaving: saveMutation.isPending || publishMutation.isPending || archiveMutation.isPending,
  };
}
