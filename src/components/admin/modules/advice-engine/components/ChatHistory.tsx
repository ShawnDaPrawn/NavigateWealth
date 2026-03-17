/**
 * ChatHistory Component
 * 
 * Container for displaying chat message history.
 * Supports auto-scroll, loading states, and empty states.
 * 
 * @module advice-engine/components/ChatHistory
 */

import React, { useRef, useEffect } from 'react';
import { Loader2, MessageSquare, Bot } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { WelcomeMessage } from './WelcomeMessage';
import { Alert, AlertDescription } from '../../../../ui/alert';
import type { ChatHistoryProps } from '../types';

/**
 * Chat history container with auto-scroll
 * 
 * @example
 * <ChatHistory
 *   messages={messages}
 *   isLoading={false}
 *   error={null}
 *   onCopy={handleCopy}
 *   autoScroll={true}
 * />
 */
export function ChatHistory({
  messages,
  isLoading = false,
  error = null,
  onCopy,
  autoScroll = true,
}: ChatHistoryProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && containerRef.current && messages.length > 0) {
      const container = containerRef.current;
      
      // Smooth scroll to bottom
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, autoScroll]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto min-h-[500px] p-6 space-y-6 scroll-smooth"
    >
      {/* Error State */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] animate-pulse">
          <div className="h-12 w-12 bg-gray-200 rounded-full mb-4"></div>
          <div className="h-4 w-48 bg-gray-200 rounded mb-2"></div>
          <div className="h-3 w-32 bg-gray-200 rounded"></div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && messages.length === 0 && (
        <div className="w-full">
           <WelcomeMessage />
        </div>
      )}

      {/* Messages */}
      {messages.map((message, index) => (
        <ChatMessage
          key={index}
          message={message}
          onCopy={onCopy}
          isLoading={isLoading && index === messages.length - 1}
        />
      ))}

      {/* Loading Indicator for New Message */}
      {isLoading && messages.length > 0 && (
        <div className="flex gap-4 mb-6">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
            <Bot className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-1.5">
            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}
    </div>
  );
}
