import React, { useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, X, Eraser, History } from 'lucide-react';
import { Alert, AlertDescription } from '../../ui/alert';
import { Button } from '../../ui/button';
import { VascoAvatar } from './VascoAvatar';
import { VascoChatInput } from './VascoChatInput';
import { VascoChatMessage } from './VascoChatMessage';
import { VascoStreamingBubble } from './VascoStreamingBubble';
import { VascoTypingIndicator } from './VascoTypingIndicator';
import type { VascoChatMessage as ChatMessage, VascoChatSessionSummary } from './types';

export interface VascoSessionWorkspaceProps {
  title: string;
  subtitle: string;
  sessions: VascoChatSessionSummary[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  streamingContent: string;
  error?: string | null;
  apiKeyWarning?: React.ReactNode;
  footer?: React.ReactNode;
  contextBanner?: React.ReactNode;
  emptyRailLabel?: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onClearSession: () => void;
  onDeleteSession: () => void;
  onClose: () => void;
  disableSessionActions?: boolean;
  newChatLabel?: string;
}

function formatSessionTime(timestamp: string) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';

  const now = new Date();
  const sameDay = now.toDateString() === date.toDateString();

  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function VascoSessionWorkspace({
  title,
  subtitle,
  sessions,
  activeSessionId,
  messages,
  input,
  isLoading,
  streamingContent,
  error,
  apiKeyWarning,
  footer,
  contextBanner,
  emptyRailLabel = 'Start a new chat to build your first Ask Vasco thread.',
  onInputChange,
  onSendMessage,
  onSelectSession,
  onCreateSession,
  onClearSession,
  onDeleteSession,
  onClose,
  disableSessionActions = false,
  newChatLabel = 'New chat',
}: VascoSessionWorkspaceProps) {
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || null,
    [sessions, activeSessionId],
  );

  useEffect(() => {
    if (!messageContainerRef.current || messages.length === 0) return;

    const container = messageContainerRef.current;
    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: messages.length <= 1 ? 'auto' : 'smooth',
      });
    });
  }, [messages, isLoading, streamingContent, activeSessionId]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f8f8f7]">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">{title}</p>
          <p className="mt-1 truncate text-sm text-gray-600">{subtitle}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-9 w-9 rounded-full p-0 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          title="Close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-gray-200 bg-[#fbfaf8] lg:w-[300px] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
              <History className="h-4 w-4 text-gray-500" />
              Other chats
            </div>
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
              {sessions.length}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {sessions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-5 text-sm text-gray-500">
                {emptyRailLabel}
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => onSelectSession(session.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                        isActive
                          ? 'border-gray-300 bg-[#eceae6] text-gray-900'
                          : 'border-transparent bg-white text-gray-700 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{session.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                            {session.lastMessagePreview || 'No messages yet'}
                          </p>
                        </div>
                        <div className="shrink-0 text-[10px] font-medium text-gray-400">
                          {formatSessionTime(session.updatedAt)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 p-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCreateSession}
              disabled={isLoading}
              className="w-full justify-between rounded-xl border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
            >
              <span>{newChatLabel}</span>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </aside>

        <section className="flex min-h-0 flex-1 flex-col">
          {contextBanner && (
            <div className="border-b border-gray-200 bg-white px-4 py-3">
              {contextBanner}
            </div>
          )}

          <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <VascoAvatar size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {activeSession?.title || 'Ask Vasco'}
                </p>
                <p className="text-xs text-gray-500">
                  {activeSession
                    ? `Updated ${formatSessionTime(activeSession.updatedAt)}`
                    : 'Open a thread to begin chatting'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearSession}
                disabled={!activeSessionId || disableSessionActions}
                className="rounded-xl border-gray-300 text-gray-700 hover:bg-gray-50"
                title="Clear current chat"
              >
                <Eraser className="mr-2 h-4 w-4" />
                Clear
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDeleteSession}
                disabled={!activeSessionId || disableSessionActions}
                className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                title="Delete current chat"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>

          {apiKeyWarning && (
            <div className="border-b border-gray-200 bg-white px-4 py-3">
              {apiKeyWarning}
            </div>
          )}

          <div
            ref={messageContainerRef}
            className="flex-1 overflow-y-auto bg-[#f8f8f7] px-4 py-4 sm:px-6"
          >
            <div className="mx-auto flex max-w-5xl flex-col gap-5">
              {messages.map((message, index) => (
                <VascoChatMessage
                  key={`${message.role}-${index}-${message.timestamp.getTime()}`}
                  message={message}
                  isWelcome={index === 0 && message.role === 'assistant' && messages.length === 1}
                />
              ))}

              {isLoading && streamingContent && <VascoStreamingBubble content={streamingContent} />}
              {isLoading && !streamingContent && <VascoTypingIndicator />}
            </div>
          </div>

          <div className="border-t border-gray-200 bg-white px-4 py-4 sm:px-6">
            {error && (
              <Alert className="mb-3 border-amber-200 bg-amber-50 py-2">
                <AlertDescription className="text-amber-800 text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <div className="mx-auto max-w-5xl">
              <VascoChatInput
                value={input}
                onChange={onInputChange}
                onSubmit={onSendMessage}
                isLoading={isLoading}
                error={null}
                placeholder="Ask anything..."
                footer={footer}
                autoFocus
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
