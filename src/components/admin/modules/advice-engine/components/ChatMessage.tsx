/**
 * ChatMessage Component
 *
 * Displays a single chat message with role-based styling.
 * Supports user and assistant messages with avatars.
 *
 * @module advice-engine/components/ChatMessage
 */

import React from 'react';
import { Copy, Check } from 'lucide-react';
import { MessageRenderer } from '../../../../shared/MessageRenderer';
import { formatTimestamp } from '../utils';
import type { ChatMessageProps } from '../types';

/**
 * Chat message component
 *
 * @example
 * <ChatMessage
 *   message={{
 *     role: 'assistant',
 *     content: 'Hello! How can I help?',
 *     timestamp: new Date()
 *   }}
 *   onCopy={(content) => console.log('Copied:', content)}
 * />
 */
export function ChatMessage({ message, onCopy }: ChatMessageProps) {
  const [copied, setCopied] = React.useState(false);
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const handleCopy = async () => {
    if (onCopy) {
      onCopy(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`flex gap-3 mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Message Content */}
      <div className={`flex flex-col gap-1 max-w-[72%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* AE-Vasco: the board's chat bubbles (.bubble.me / .bubble.ai) */}
        <div
          className={`max-w-full rounded-[14px] px-3.5 py-2.5 text-[13.5px] leading-5 ${
            isUser
              ? 'rounded-br-[4px] bg-nw-violet text-white'
              : 'rounded-bl-[4px] border border-nw-line bg-white text-nw-ink'
          }`}
        >
          {isAssistant ? (
            <div className="leading-relaxed markdown-content">
              <MessageRenderer content={message.content} />
            </div>
          ) : (
            <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
          )}
        </div>

        {/* Timestamp and Copy Button */}
        <div className={`flex items-center gap-2 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-[10px] text-muted-foreground">
            {formatTimestamp(message.timestamp)}
          </span>

          {isAssistant && onCopy && (
            <button
              onClick={handleCopy}
              className="text-muted-foreground hover:text-violet-600 transition-colors p-1 rounded hover:bg-violet-50"
              title="Copy message"
            >
              {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
