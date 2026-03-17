/**
 * useClientKeys Hook
 * Fetch and manage client key values from KV store
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import * as api from '../api';
import { clientKeys } from './queryKeys';

export interface ClientKeyValue {
  keyId: string;
  name: string;
  value: number | string | boolean | null;
  dataType: 'currency' | 'number' | 'percentage' | 'text' | 'date' | 'boolean';
  category: string;
  isCalculated: boolean;
  lastUpdated?: string;
  contributingPolicies?: ContributingPolicy[];
}

export interface ContributingPolicy {
  policyId: string;
  policyName: string;
  provider: string;
  value: number;
  fieldName: string;
}

export interface ClientKeysResponse {
  keys: ClientKeyValue[];
  lastCalculated: string;
  totalCategories: number;
}

/**
 * Fetch client key values
 */
export function useClientKeys(clientId: string) {
  return useQuery({
    queryKey: clientKeys.clientKeys.all(clientId),
    queryFn: () => api.getClientKeys(clientId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!clientId,
  });
}

/**
 * Recalculate client key totals
 */
export function useRecalculateClientKeys() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clientId: string) => api.recalculateClientKeys(clientId),
    onSuccess: (data, clientId) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.clientKeys.all(clientId) });
      toast.success('Keys recalculated successfully', {
        description: 'All client key totals have been updated'
      });
    },
    onError: (error: Error) => {
      toast.error('Recalculation failed', {
        description: error.message || 'Failed to recalculate client keys. Please try again.'
      });
    },
  });
}

/**
 * Get key history/audit trail
 */
export function useClientKeyHistory(clientId: string, keyId: string) {
  return useQuery({
    queryKey: clientKeys.clientKeys.history(clientId, keyId),
    queryFn: () => api.getClientKeyHistory(clientId, keyId),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!clientId && !!keyId,
  });
}