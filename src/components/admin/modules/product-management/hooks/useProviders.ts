/**
 * useProviders — React Query hook for provider management.
 *
 * Guidelines §6  — All server state managed by React Query.
 * Guidelines §11.2 — Deterministic query keys from centralized registry.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner@2.0.3';
import { productManagementApi } from '../api';
import { Provider, SaveProviderRequest } from '../types';
import { productKeys } from './queryKeys';

export function useProviders() {
  const queryClient = useQueryClient();

  const { data: providers = [], isLoading, error } = useQuery({
    queryKey: productKeys.providers(),
    queryFn: () => productManagementApi.fetchProviders(),
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: productKeys.providers() }),
    [queryClient],
  );

  const addProvider = useCallback(async (providerData: SaveProviderRequest) => {
    // Client-side duplicate check
    const exists = providers.some(p => p.name.toLowerCase() === providerData.name.toLowerCase());
    if (exists) {
      throw new Error(`Provider "${providerData.name}" already exists.`);
    }

    const toastId = toast.loading('Creating provider...');
    try {
      const newProvider = await productManagementApi.createProvider(providerData);
      await invalidate();
      toast.success('Provider created', { id: toastId });
      return newProvider;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create provider';
      toast.error(msg, { id: toastId });
      throw err;
    }
  }, [providers, invalidate]);

  const updateProvider = useCallback(async (id: string, providerData: SaveProviderRequest) => {
    const exists = providers.some(
      p => p.name.toLowerCase() === providerData.name.toLowerCase() && p.id !== id,
    );
    if (exists) {
      throw new Error(`Another provider is already named "${providerData.name}".`);
    }

    const toastId = toast.loading('Updating provider...');
    try {
      await productManagementApi.updateProvider(id, providerData);
      await invalidate();
      toast.success('Provider updated', { id: toastId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update provider';
      toast.error(msg, { id: toastId });
      throw err;
    }
  }, [providers, invalidate]);

  const deleteProvider = useCallback(async (id: string) => {
    const toastId = toast.loading('Deleting provider...');
    try {
      await productManagementApi.deleteProvider(id);
      await invalidate();
      toast.success('Provider deleted', { id: toastId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete provider';
      toast.error(msg, { id: toastId });
      throw err;
    }
  }, [invalidate]);

  return {
    providers,
    isLoading,
    error,
    fetchProviders: invalidate,
    addProvider,
    updateProvider,
    deleteProvider,
  };
}
