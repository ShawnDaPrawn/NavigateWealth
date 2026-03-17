/**
 * useClientSearch Hook
 * 
 * Hook for client search functionality with debouncing.
 * Manages search term, results, and selection state.
 * 
 * @module advice-engine/hooks/useClientSearch
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adviceEngineKeys } from './queryKeys';
import { aiIntelligenceApi } from '../api';
import type { Client, ClientSearchResult, UseClientSearchReturn } from '../types';

/**
 * Debounce delay for search input (ms)
 */
const SEARCH_DEBOUNCE_DELAY = 300;

/**
 * Minimum search term length
 */
const MIN_SEARCH_LENGTH = 2;

/**
 * Hook for client search with debouncing
 * 
 * @returns Client search state and actions
 * 
 * @example
 * const {
 *   searchTerm,
 *   setSearchTerm,
 *   results,
 *   isSearching,
 *   selectedClient,
 *   selectClient,
 *   clearSelection
 * } = useClientSearch();
 * 
 * // Update search term (debounced)
 * setSearchTerm('John Smith');
 * 
 * // Select a client
 * selectClient(results[0]);
 */
export function useClientSearch(): UseClientSearchReturn {
  // State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  // Refs
  const debounceTimerRef = useRef<number | null>(null);

  // ============================================================================
  // Debounce Search Term
  // ============================================================================

  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, SEARCH_DEBOUNCE_DELAY);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm]);

  // ============================================================================
  // Search Query
  // ============================================================================

  const {
    data: searchResults = { clients: [], totalCount: 0 },
    isLoading: isSearching,
  } = useQuery({
    queryKey: adviceEngineKeys.ai.searchClients(debouncedSearchTerm),
    queryFn: async () => {
      if (!debouncedSearchTerm || debouncedSearchTerm.length < MIN_SEARCH_LENGTH) {
        return { clients: [], totalCount: 0 };
      }

      return await aiIntelligenceApi.searchClients(debouncedSearchTerm);
    },
    enabled: debouncedSearchTerm.length >= MIN_SEARCH_LENGTH,
    staleTime: 30 * 1000, // 30 seconds
  });

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Select a client
   */
  const selectClient = (client: Client | null) => {
    setSelectedClient(client);
    
    // If selecting a client, clear the search term
    if (client) {
      setSearchTerm('');
    }
  };

  /**
   * Clear selection
   */
  const clearSelection = () => {
    setSelectedClient(null);
  };

  // ============================================================================
  // Return
  // ============================================================================

  return {
    searchTerm,
    setSearchTerm,
    results: searchResults.clients,
    isSearching: isSearching && debouncedSearchTerm.length >= MIN_SEARCH_LENGTH,
    selectedClient,
    selectClient,
    clearSelection,
  };
}