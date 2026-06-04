import React, { useEffect, useRef } from 'react';
import { Eraser, Maximize2, Plus } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { cn } from '../../ui/utils';
import { VascoAvatar } from './VascoAvatar';
import { VascoChatInput } from './VascoChatInput';
import { VascoChatMessage } from './VascoChatMessage';
import { VascoStreamingBubble } from './VascoStreamingBubble';
import { VascoTypingIndicator } from './VascoTypingIndicator';
import type { VascoChatMessage as ChatMessage } from './types';

export interface VascoInlineChatCardProps {
  sessionTitle?: string;
  sessionSubtitle?: string;
  messages: ChatMessage[];
  input: string;
  error: string | null;
  isLoading: boolean;
  streamingContent: string;
  apiKeyWarning?: React.ReactNode;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onNewChat?: () => void;
  onClear?: () => void;
  onExpand?: () => void;
  showNewChat?: boolean;
  showClear?: boolean;
  showExpand?: boolean;
  disableActions?: boolean;
  disableClear?: boolean;
  inputDisabled?: boolean;
  isWelcomeMessage?: (message: ChatMessage) => boolean;
  onFeedback?: (messageIndex: number, rating: 'positive' | 'negative') => void;
  headerExtra?: React.ReactNode;
  inputPlaceholder?: string;
  inputFooter?: React.ReactNode;
  beforeInput?: React.ReactNode;
  className?: string;
  shellClassName?: string;
  headerClassName?: string;
  messagesClassName?: string;
}

export function VascoInlineChatCard({
  sessionTitle = 'Ask Vasco',
  sessionSubtitle = 'AI Financial Navigator',
  messages,
  input,
  error,
  isLoading,
  streamingContent,
  apiKeyWarning,
  onInputChange,
  onSendMessage,
  onNewChat,
  onClear,
  onExpand,
  showNewChat = true,
  showClear = true,
  showExpand = true,
  disableActions = false,
  disableClear = false,
  inputDisabled = false,
  isWelcomeMessage,
  onFeedback,
  headerExtra,
  inputPlaceholder = 'Ask Vasco about your financial goals...',
  inputFooter,
  beforeInput,
  className,
  shellClassName,
  headerClassName,
  messagesClassName,
}: VascoInlineChatCardProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!messagesContainerRef.current || messages.length === 0) return;
    const container = messagesContainerRef.current;
    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: messages.length <= 1 ? 'auto' : 'smooth',
      });
    });
  }, [messages, isLoading, streamingContent]);

  return (
    <Card className={cn('overflow-hidden border-gray-200 shadow-sm', className)}>
      <div className={cn('flex h-[650px] flex-col bg-white', shellClassName)}>
        <div
          className={cn(
            'flex items-center justify-between border-b border-gray-100 px-6 py-4',
            headerClassName,
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <VascoAvatar size="md" />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-gray-900">{sessionTitle}</h3>
              <p className="truncate text-xs text-gray-500">{sessionSubtitle}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerExtra}
            {showNewChat && onNewChat && (
              <Button
                onClick={onNewChat}
                variant="outline"
                size="sm"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                disabled={disableActions}
                aria-label="New chat"
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">New chat</span>
              </Button>
            )}
            {showClear && onClear && (
              <Button
                onClick={onClear}
                variant="outline"
                size="sm"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                disabled={disableActions || disableClear}
                aria-label="Clear"
              >
                <Eraser className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            )}
            {showExpand && onExpand && (
              <Button
                onClick={onExpand}
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-gray-500 hover:bg-purple-50 hover:text-[#6d28d9]"
                title="Expand"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {apiKeyWarning && <div className="border-b border-gray-100 px-4 py-3">{apiKeyWarning}</div>}

        <div
          ref={messagesContainerRef}
          className={cn('flex-1 overflow-y-auto bg-gray-50/50 px-6 py-5', messagesClassName)}
        >
          <div className="space-y-5">
            {messages.map((message, index) => (
              <VascoChatMessage
                key={`${message.role}-${index}-${message.timestamp.getTime()}`}
                message={message}
                isWelcome={
                  isWelcomeMessage
                    ? isWelcomeMessage(message)
                    : index === 0 && message.role === 'assistant'
                }
                onFeedback={
                  onFeedback && message.role === 'assistant'
                    ? (rating) => onFeedback(index, rating)
                    : undefined
                }
              />
            ))}

            {isLoading && streamingContent && <VascoStreamingBubble content={streamingContent} />}
            {isLoading && !streamingContent && <VascoTypingIndicator />}
          </div>
        </div>

        {beforeInput}

        <VascoChatInput
          value={input}
          onChange={onInputChange}
          onSubmit={onSendMessage}
          isLoading={isLoading}
          error={error}
          placeholder={inputPlaceholder}
          disabled={inputDisabled}
          footer={inputFooter}
        />
      </div>
    </Card>
  );
}
