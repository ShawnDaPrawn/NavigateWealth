/**
 * useChatHistory Hook
 * 
 * Hook for managing chat history.
 * Handles loading and clearing history.
 * 
 * @module advice-engine/hooks/useChatHistory
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adviceEngineKeys } from './queryKeys';
import { aiIntelligenceApi } from '../api';
import type { Message, UseChatHistoryReturn } from '../types';

/**
 * Hook for chat history management
 * 
 * @returns History state and actions
 * 
 * @example
 * const {
 *   history,
 *   isLoading,
 *   error,
 *   loadHistory,
 *   clearHistory,
 *   hasLoaded
 * } = useChatHistory();
 * 
 * // Load history manually
 * await loadHistory();
 * 
 * // Clear history
 * await clearHistory();
 */
export function useChatHistory(): UseChatHistoryReturn {
  const queryClient = useQueryClient();

  // ============================================================================
  // History Query
  // ============================================================================

  const {
    data: historyData,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: adviceEngineKeys.ai.history(),
    queryFn: async () => {
      return await aiIntelligenceApi.getHistory();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // ============================================================================
  // Clear History Mutation
  // ============================================================================

  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      await aiIntelligenceApi.clearHistory();
    },
    onSuccess: () => {
      // Clear the query cache
      queryClient.setQueryData(adviceEngineKeys.ai.history(), { messages: [] });
    },
    onError: (error) => {
      console.error('Failed to clear history:', error);
    },
  });

  // ============================================================================
  // Parse History into Messages
  // ============================================================================

  const history: Message[] = historyData?.messages
    ? historyData.messages.flatMap((msg) => [
        {
          role: 'user' as const,
          content: msg.query,
          timestamp: new Date(msg.timestamp),
          clientId: msg.clientId,
        },
        {
          role: 'assistant' as const,
          content: msg.reply,
          timestamp: new Date(msg.timestamp),
          clientId: msg.clientId,
        },
      ])
    : [];

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Load history manually
   */
  const loadHistory = async (): Promise<void> => {
    await refetch();
  };

  /**
   * Clear history
   */
  const clearHistory = async (): Promise<void> => {
    await clearHistoryMutation.mutateAsync();
  };

  // ============================================================================
  // Return
  // ============================================================================

  return {
    history,
    isLoading,
    error: queryError ? String(queryError) : null,
    loadHistory,
    clearHistory,
    hasLoaded: historyData !== undefined,
  };
}