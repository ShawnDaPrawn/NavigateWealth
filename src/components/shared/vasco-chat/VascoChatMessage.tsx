/**
 * VascoChatMessage — Unified chat message bubble
 *
 * Renders a single user or assistant message with:
 *   - Role-based styling (user = purple, assistant = white card)
 *   - Vasco compass avatar for assistant messages
 *   - User avatar for user messages
 *   - Copy-to-clipboard button on assistant messages
 *   - Optional thumbs up/down feedback buttons
 *   - Optional citation pills linking to articles
 *   - Timestamp
 *
 * Shared between AskVascoPage (public) and AIAdvisorPage (portal).
 *
 * @module shared/vasco-chat/VascoChatMessage
 */

import React, { useState } from 'react';
import { Link } from 'react-router';
import {
  User,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { MessageRenderer } from '../MessageRenderer';
import { VascoAvatar } from './VascoAvatar';
import type { VascoChatMessage as ChatMessageType } from './types';

export interface VascoChatMessageProps {
  message: ChatMessageType;
  /** Whether this is a welcome message (hides action buttons) */
  isWelcome?: boolean;
  /** Callback when user gives feedback — omit to hide feedback buttons */
  onFeedback?: (rating: 'positive' | 'negative') => void;
  /** Whether to show citation pills (default: true) */
  showCitations?: boolean;
}

export function VascoChatMessage({
  message,
  isWelcome = false,
  onFeedback,
  showCitations = true,
}: VascoChatMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <VascoAvatar size="sm" />}

      <div className="max-w-[85%] flex flex-col gap-1.5">
        {/* Message bubble */}
        <div
          className={`rounded-2xl px-5 py-3.5 shadow-sm ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-none'
              : 'bg-white border border-gray-200 text-gray-900 rounded-bl-none shadow-xs'
          }`}
        >
          <div className="text-sm leading-relaxed">
            {isUser ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              <div className="markdown-content">
                <MessageRenderer content={message.content} role="assistant" />
              </div>
            )}
          </div>
          <p
            className={`text-[10px] mt-2 opacity-60 ${
              isUser ? 'text-purple-200' : 'text-gray-400'
            }`}
          >
            {message.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        {/* Citations */}
        {showCitations &&
          !isUser &&
          message.citations &&
          message.citations.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pl-1">
              {message.citations.map((citation, i) => (
                <Link
                  key={`${citation.slug}-${i}`}
                  to={citation.url}
                  className="inline-flex items-center gap-1 text-[11px] text-primary bg-purple-50 hover:bg-purple-100 border border-purple-100 rounded-lg px-2.5 py-1 transition-colors group"
                >
                  <Sparkles className="h-3 w-3 text-primary/60 group-hover:text-primary flex-shrink-0" />
                  <span className="truncate max-w-[200px]">
                    {citation.title}
                  </span>
                  <ChevronRight className="h-3 w-3 text-primary/40 flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}

        {/* Action buttons: copy + feedback */}
        {!isUser && !isWelcome && (
          <div className="flex items-center gap-1 pl-1">
            {/* Copy */}
            <button
              onClick={handleCopy}
              className={`p-1 rounded transition-colors ${
                copied
                  ? 'text-green-600 bg-green-50'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              title="Copy response"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>

            {/* Feedback */}
            {onFeedback && (
              <>
                <button
                  onClick={() => onFeedback('positive')}
                  disabled={
                    message.feedback !== undefined && message.feedback !== null
                  }
                  className={`p-1 rounded transition-colors ${
                    message.feedback === 'positive'
                      ? 'text-green-600 bg-green-50'
                      : message.feedback === 'negative'
                      ? 'text-gray-300 cursor-default'
                      : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                  }`}
                  title="Helpful"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onFeedback('negative')}
                  disabled={
                    message.feedback !== undefined && message.feedback !== null
                  }
                  className={`p-1 rounded transition-colors ${
                    message.feedback === 'negative'
                      ? 'text-red-500 bg-red-50'
                      : message.feedback === 'positive'
                      ? 'text-gray-300 cursor-default'
                      : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                  }`}
                  title="Not helpful"
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
                {message.feedback && (
                  <span className="text-[10px] text-gray-400 ml-1">
                    Thanks for the feedback
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-1">
          <User className="h-4 w-4 text-gray-500" />
        </div>
      )}
    </div>
  );
}
