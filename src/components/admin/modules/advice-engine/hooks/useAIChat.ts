/**
 * useAIChat Hook
 * 
 * Main hook for AI chat functionality.
 * Manages messages, sending, history, and API key status.
 * 
 * @module advice-engine/hooks/useAIChat
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { aiIntelligenceApi } from '../api';
import { buildConversationHistory } from '../utils';
import { adviceEngineKeys } from './queryKeys';
import type {
  Message,
  UseAIChatOptions,
  UseAIChatReturn,
  ApiKeyStatus,
} from '../types';

/**
 * Welcome message displayed on initial load
 */
const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content: `👋 **Welcome to Ask Vasco**

I can help with **Client Intelligence**, **Platform Operations**, and **Advisory Support**.

**Quick Start:**
1. Select a client (optional)
2. Ask a question
3. Get actionable insights`,
  timestamp: new Date(),
};

/**
 * Hook for AI chat functionality
 * 
 * @param options - Configuration options
 * @returns Chat state and actions
 * 
 * @example
 * const { messages, sendMessage, clearChat, isLoading } = useAIChat({
 *   autoLoadHistory: true,
 *   maxHistoryLength: 10
 * });
 * 
 * await sendMessage('What are the client\'s active policies?', 'client-123');
 */
export function useAIChat(options: UseAIChatOptions = {}): UseAIChatReturn {
  const {
    initialMessages = [],
    autoLoadHistory = true,
    defaultClientId,
    maxHistoryLength = 10,
  } = options;

  // State
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [error, setError] = useState<string | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  
  // Refs
  const hasLoadedHistory = useRef(false);
  const queryClient = useQueryClient();

  // Initialize with initial messages if provided
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 1) {
      setMessages([WELCOME_MESSAGE, ...initialMessages]);
    }
  }, [initialMessages]);

  // ============================================================================
  // API Key Status
  // ============================================================================

  const { data: apiKeyStatus = null } = useQuery({
    queryKey: adviceEngineKeys.ai.status(),
    queryFn: async () => {
      return await aiIntelligenceApi.getStatus();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false, // API key status is stable — only changes via admin action
  });

  // ============================================================================
  // Chat History
  // ============================================================================

  const { data: historyData } = useQuery({
    queryKey: adviceEngineKeys.ai.history(),
    queryFn: async () => {
      return await aiIntelligenceApi.getHistory();
    },
    enabled: autoLoadHistory,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Load history once on mount
  useEffect(() => {
    if (
      historyData &&
      historyData.messages &&
      historyData.messages.length > 0 &&
      !hasLoadedHistory.current
    ) {
      const parsedMessages = historyData.messages.flatMap((msg) => [
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
      ]);

      setMessages([WELCOME_MESSAGE, ...parsedMessages]);
      hasLoadedHistory.current = true;
    }
  }, [historyData]);

  // ============================================================================
  // Send Message Mutation
  // ============================================================================

  const sendMessageMutation = useMutation({
    mutationFn: async ({
      content,
      clientId,
    }: {
      content: string;
      clientId?: string;
    }) => {
      const conversationHistory = buildConversationHistory(
        messages,
        maxHistoryLength
      );

      const response = await aiIntelligenceApi.sendMessage({
        message: content,
        clientId: clientId || defaultClientId || null,
        conversationHistory: conversationHistory.messages,
      });

      return { response, clientId };
    },
    onMutate: async ({ content, clientId }) => {
      // Clear error
      setError(null);
      setShouldAutoScroll(true);

      // Add user message optimistically
      const userMessage: Message = {
        role: 'user',
        content,
        timestamp: new Date(),
        clientId,
      };

      setMessages((prev) => [...prev, userMessage]);

      return { userMessage };
    },
    onSuccess: (data) => {
      // Add assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response.reply,
        timestamp: new Date(),
        clientId: data.clientId,
        metadata: {
          tokens: data.response.tokensUsed,
          model: data.response.model,
          processingTime: data.response.processingTime,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Don't invalidate history to prevent race conditions
      // History is only loaded on initial mount
    },
    onError: (error: Error, variables, context) => {
      // Check if this is a rate limit error (429)
      const is429RateLimit = error.message.includes('rate limit') || 
                             error.message.includes('429') ||
                             error.message.includes('quota');
      
      if (is429RateLimit) {
        // Show a professional toast for rate limit errors
        toast.error('OpenAI Rate Limit Reached', {
          description: 'The OpenAI API has reached its usage limit. Please inform your administrator to add more credits to continue using the AI Intelligence features.',
          duration: 8000,
        });
      }
      
      // Set error
      setError(error.message);

      // Remove the optimistic user message
      if (context?.userMessage) {
        setMessages((prev) => prev.slice(0, -1));
      }
    },
  });

  // ============================================================================
  // Clear Chat Mutation
  // ============================================================================

  const clearChatMutation = useMutation({
    mutationFn: async () => {
      await aiIntelligenceApi.clearHistory();
    },
    onSuccess: () => {
      setMessages([WELCOME_MESSAGE]);
      setError(null);
      hasLoadedHistory.current = false;
      queryClient.setQueryData(['ai-intelligence', 'history'], { messages: [] });
    },
    onError: (error: Error) => {
      console.error('Failed to clear chat:', error);
      setError('Failed to clear chat history');
    },
  });

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Send a message to the AI
   */
  const sendMessage = useCallback(
    async (content: string, clientId?: string): Promise<void> => {
      if (!content.trim()) {
        setError('Message cannot be empty');
        return;
      }

      if (content.trim().length > 4000) {
        setError('Message is too long (max 4000 characters)');
        return;
      }

      await sendMessageMutation.mutateAsync({ content: content.trim(), clientId });
    },
    [sendMessageMutation]
  );

  /**
   * Clear chat history
   */
  const clearChat = useCallback(async (): Promise<void> => {
    await clearChatMutation.mutateAsync();
  }, [clearChatMutation]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    messages,
    isLoading: sendMessageMutation.isPending,
    error,
    sendMessage,
    clearChat,
    apiKeyStatus,
    isConfigured: apiKeyStatus?.configured ?? false,
  };
}