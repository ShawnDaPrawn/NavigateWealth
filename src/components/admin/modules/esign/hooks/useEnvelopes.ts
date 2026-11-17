/**
 * useEnvelopes Hook (React Query)
 *
 * Guidelines §6  — All server state managed by React Query.
 * Guidelines §11.2 — Deterministic query keys from centralized registry.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
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
  const { clientId, clientEmail, autoLoad = true, refreshTrigger } = options;
  const queryClient = useQueryClient();

  const listKey = useMemo(
    () => (clientId ? esignKeys.clientEnvelopes(clientId) : esignKeys.allEnvelopes()),
    [clientId],
  );
  const {
    data: envelopes = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: listKey,
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

  // Invalidate THIS list's key too: a client's list lives under
  // ['esign', 'client', id], outside esignKeys.envelopes(), so the client
  // drawer's refetch() after a send/void/delete never refreshed its own list.
  const refetch = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: esignKeys.envelopes() }),
      queryClient.invalidateQueries({ queryKey: listKey }),
    ]);
  }, [queryClient, listKey]);

  // `refreshTrigger` was accepted and ignored, so after a send, void or
  // delete the list kept showing the old status until the 2-minute stale
  // time ran out. A change of trigger now refetches.
  const lastTrigger = useRef(refreshTrigger);
  useEffect(() => {
    if (refreshTrigger === undefined || refreshTrigger === lastTrigger.current) return;
    lastTrigger.current = refreshTrigger;
    void refetch();
  }, [refreshTrigger, refetch]);

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
    error: queryError
      ? queryError instanceof Error
        ? queryError.message
        : 'Failed to load envelopes'
      : null,
    refetch,
    getEnvelope,
  };
}
