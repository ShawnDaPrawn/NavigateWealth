/**
 * E-Signature Query Hooks
 * Navigate Wealth Admin Dashboard
 * 
 * React Query hooks for fetching envelope data with caching and automatic refetching.
 */

import { useQuery } from '@tanstack/react-query';
import { esignApi } from '../api';
import type { EsignEnvelope } from '../types';
import { QUERY_STALE_TIME, QUERY_GC_TIME } from '../constants';

// ============================================================================
// QUERY KEY FACTORY
// ============================================================================

export const esignKeys = {
  all: ['esign'] as const,
  envelopes: () => [...esignKeys.all, 'envelopes'] as const,
  envelope: (id: string) => [...esignKeys.all, 'envelope', id] as const,
  clientEnvelopes: (clientId: string) => [...esignKeys.all, 'client', clientId] as const,
  allEnvelopes: (status?: string) => [...esignKeys.envelopes(), { status }] as const,
  auditTrail: (envelopeId: string) => [...esignKeys.envelope(envelopeId), 'audit'] as const,
};

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Hook to fetch all envelopes (admin only)
 * 
 * @param status - Optional status filter
 * @param enabled - Whether the query should run (default: true)
 * @returns React Query result with envelopes data
 * 
 * @example
 * ```tsx
 * const { data: envelopes = [], isLoading } = useAllEnvelopes();
 * const { data: draftEnvelopes = [] } = useAllEnvelopes('draft');
 * ```
 */
export function useAllEnvelopes(status?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: esignKeys.allEnvelopes(status),
    queryFn: async () => {
      console.log('📡 [E-Sign Query] Fetching all envelopes...');
      const response = await esignApi.getAllEnvelopes(status);
      console.log(`✅ [E-Sign Query] Fetched ${response.envelopes?.length || 0} envelopes`);
      return response.envelopes || [];
    },
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    retry: false,
    enabled,
  });
}

/**
 * Hook to fetch envelopes for a specific client.
 * Passes clientEmail so the server can merge client_id + signer-email indexes.
 * 
 * @param clientId - Client ID
 * @param enabled - Whether the query should run (default: true)
 * @param clientEmail - Optional client email for cross-origin envelope discovery
 * @returns React Query result with client envelopes
 * 
 * @example
 * ```tsx
 * const { data: envelopes = [], isLoading } = useClientEnvelopes('client-123', true, 'client@example.com');
 * ```
 */
export function useClientEnvelopes(clientId: string, enabled: boolean = true, clientEmail?: string) {
  return useQuery({
    queryKey: esignKeys.clientEnvelopes(clientId),
    queryFn: async () => {
      console.log('📡 [E-Sign Query] Fetching envelopes for client:', clientId);
      const response = await esignApi.getClientEnvelopes(clientId, clientEmail);
      console.log(`✅ [E-Sign Query] Fetched ${response.envelopes?.length || 0} client envelopes`);
      return response.envelopes || [];
    },
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    retry: false,
    enabled: enabled && !!clientId,
  });
}

/**
 * Hook to fetch a single envelope by ID
 * 
 * @param envelopeId - Envelope ID
 * @param enabled - Whether the query should run (default: true)
 * @returns React Query result with envelope data
 * 
 * @example
 * ```tsx
 * const { data: envelope, isLoading } = useEnvelope('envelope-123');
 * ```
 */
export function useEnvelope(envelopeId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: esignKeys.envelope(envelopeId),
    queryFn: async () => {
      console.log('📡 [E-Sign Query] Fetching envelope:', envelopeId);
      const envelope = await esignApi.getEnvelope(envelopeId);
      console.log('✅ [E-Sign Query] Fetched envelope:', envelope.title);
      return envelope;
    },
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    retry: false,
    enabled: enabled && !!envelopeId,
  });
}

/**
 * Hook to fetch audit trail for an envelope
 * 
 * @param envelopeId - Envelope ID
 * @param enabled - Whether the query should run (default: false)
 * @returns React Query result with audit events
 * 
 * @example
 * ```tsx
 * const { data: auditEvents = [], isLoading } = useAuditTrail('envelope-123', true);
 * ```
 */
export function useAuditTrail(envelopeId: string, enabled: boolean = false) {
  return useQuery({
    queryKey: esignKeys.auditTrail(envelopeId),
    queryFn: async () => {
      console.log('📡 [E-Sign Query] Fetching audit trail for envelope:', envelopeId);
      const response = await esignApi.getAuditTrail(envelopeId);
      console.log(`✅ [E-Sign Query] Fetched ${response.events?.length || 0} audit events`);
      return response.events || [];
    },
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    retry: false,
    enabled: enabled && !!envelopeId,
  });
}

/**
 * Hook to fetch and automatically refetch all envelopes
 * 
 * Unified hook that works for both admin (all envelopes) and client-specific views.
 * 
 * @param options - Configuration options
 * @returns React Query result with envelopes data
 * 
 * @example
 * ```tsx
 * // Admin view - all envelopes
 * const { data: envelopes = [], isLoading } = useEnvelopes({ autoLoad: true });
 * 
 * // Client-specific view
 * const { data: envelopes = [], isLoading } = useEnvelopes({ 
 *   clientId: 'client-123',
 *   autoLoad: true 
 * });
 * ```
 */
export function useEnvelopes(options: {
  clientId?: string;
  clientEmail?: string;
  status?: string;
  autoLoad?: boolean;
} = {}) {
  const { clientId, clientEmail, status, autoLoad = true } = options;

  // Use appropriate query based on whether clientId is provided
  const adminQuery = useAllEnvelopes(status, autoLoad && !clientId);
  const clientQuery = useClientEnvelopes(clientId!, autoLoad && !!clientId, clientEmail);

  // Return the active query
  const activeQuery = clientId ? clientQuery : adminQuery;

  return {
    envelopes: activeQuery.data || [],
    loading: activeQuery.isLoading,
    error: activeQuery.error?.message || null,
    refetch: activeQuery.refetch,
    // Legacy compatibility method
    getEnvelope: async (id: string): Promise<EsignEnvelope | null> => {
      try {
        const envelope = await esignApi.getEnvelope(id);
        return envelope;
      } catch (error) {
        console.error('❌ [E-Sign] Failed to fetch envelope:', error);
        return null;
      }
    },
  };
}