/**
 * useVascoStream — Reusable SSE streaming hook for Vasco chat endpoints
 *
 * Handles the full lifecycle of sending a message to a streaming endpoint:
 *   1. POST the messages array to the endpoint
 *   2. Read SSE chunks and accumulate the response
 *   3. Parse the `done` event for session ID and citations
 *   4. Handle errors gracefully
 *
 * Works with both `/vasco/chat/stream` (public) and
 * `/ai-advisor/chat/stream` (authenticated).
 *
 * @module shared/vasco-chat/useVascoStream
 */

import { useCallback, useRef, useState } from 'react';
import type { VascoCitation } from './types';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

export interface UseVascoStreamOptions {
  /** Endpoint path relative to base URL (e.g. '/vasco/chat/stream') */
  endpoint: string;
  /** Auth token — defaults to publicAnonKey */
  authToken?: string;
}

export interface StreamResult {
  content: string;
  sessionId: string | null;
  citations: VascoCitation[];
  remaining?: number;
}

export interface UseVascoStreamReturn {
  /** Current accumulated streaming content (empty when idle) */
  streamingContent: string;
  /** Whether a stream is currently in progress */
  isStreaming: boolean;
  /** Send a message and stream the response */
  sendStream: (
    chatHistory: Array<{ role: string; content: string }>,
    sessionId: string | null
  ) => Promise<StreamResult>;
  /** Abort an in-progress stream */
  abort: () => void;
}

export function useVascoStream({
  endpoint,
  authToken,
}: UseVascoStreamOptions): UseVascoStreamReturn {
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setStreamingContent('');
  }, []);

  const sendStream = useCallback(
    async (
      chatHistory: Array<{ role: string; content: string }>,
      sessionId: string | null
    ): Promise<StreamResult> => {
      // Abort any in-progress stream
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      setStreamingContent('');

      const token = authToken || publicAnonKey;

      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: chatHistory,
          sessionId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        setIsStreaming(false);
        const errorBody = await response.json().catch(() => ({}));
        const isRateLimited = response.status === 429;
        const errorMsg = isRateLimited
          ? (errorBody as { error?: string }).error ||
            "You've reached the message limit. Please try again later."
          : 'I apologise, but I encountered a temporary issue. Please try again.';
        throw new Error(errorMsg);
      }

      // Parse X-Vasco-Remaining header
      const remainingHeader = response.headers.get('X-Vasco-Remaining');
      const remaining = remainingHeader
        ? parseInt(remainingHeader, 10)
        : undefined;

      // Process SSE stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let receivedSessionId = sessionId;
      let receivedCitations: VascoCitation[] = [];
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(trimmed.slice(6));

              if (data.type === 'chunk' && data.content) {
                accumulatedContent += data.content;
                setStreamingContent(accumulatedContent);
              } else if (data.type === 'done') {
                receivedSessionId = data.sessionId || receivedSessionId;
                receivedCitations = data.citations || [];
              } else if (data.type === 'error') {
                throw new Error(data.message || 'Stream error');
              }
            } catch (parseErr) {
              if (
                parseErr instanceof Error &&
                parseErr.message === 'Stream error'
              )
                throw parseErr;
              // Skip malformed SSE lines
            }
          }
        }
      } finally {
        setIsStreaming(false);
        setStreamingContent('');
        abortRef.current = null;
      }

      return {
        content:
          accumulatedContent ||
          'I apologise, I was unable to generate a response. Please try again.',
        sessionId: receivedSessionId,
        citations: receivedCitations,
        remaining,
      };
    },
    [endpoint, authToken]
  );

  return { streamingContent, isStreaming, sendStream, abort };
}