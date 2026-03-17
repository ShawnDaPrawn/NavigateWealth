/**
 * useEnvelopes Hook (React Query)
 *
 * Guidelines §6  — All server state managed by React Query.
 * Guidelines §11.2 — Deterministic query keys from centralized registry.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { esignApi } from '../api';
import type { EsignEnvelope } from '../types';
import { esignKeys } from './useEnvelopesQuery';

interface UseEnvelopesOptions {
  clientId?: string;
  clientEmail?: string;
  autoLoad?: boolean;
  refreshTrigger?: number;
}

interface UseEnvelopesReturn {
  envelopes: EsignEnvelope[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getEnvelope: (id: string) => Promise<EsignEnvelope | null>;
}

export function useEnvelopes(options: UseEnvelopesOptions = {}): UseEnvelopesReturn {
  const { clientId, clientEmail, autoLoad = true } = options;
  const queryClient = useQueryClient();

  const { data: envelopes = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: clientId ? esignKeys.clientEnvelopes(clientId) : esignKeys.allEnvelopes(),
    queryFn: async () => {
      if (clientId) {
        const response = await esignApi.getClientEnvelopes(clientId, clientEmail);
        return response.envelopes || [];
      }
      const response = await esignApi.getAllEnvelopes();
      return response.envelopes || [];
    },
    enabled: autoLoad,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: esignKeys.envelopes() });
  }, [queryClient]);

  const getEnvelope = useCallback(async (id: string): Promise<EsignEnvelope | null> => {
    try {
      return await esignApi.getEnvelope(id);
    } catch (err) {
      console.error('Failed to load envelope:', err);
      return null;
    }
  }, []);

  return {
    envelopes,
    loading,
    error: queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load envelopes') : null,
    refetch,
    getEnvelope,
  };
}