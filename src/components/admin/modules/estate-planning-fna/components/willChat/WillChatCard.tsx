/**
 * The conversation card of the will-chat interview: transcript, composer,
 * and status chrome. Pure view — WillChatInterface owns all state and
 * passes it down through the explicit prop list.
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Button } from '../../../../../ui/button';
import { Textarea } from '../../../../../ui/textarea';
import { Badge } from '../../../../../ui/badge';
import { Alert, AlertDescription } from '../../../../../ui/alert';
import { Scroll, Send, Loader2, Bot, Copy, Check, X } from 'lucide-react';
import { MessageRenderer } from '../../../../../shared/MessageRenderer';
import { formatTimestamp, MAX_MESSAGE_LENGTH } from './willChatModel';
import type { ChatMessage } from './willChatModel';

// ── Chat Card (extracted for clarity) ─────────────────────────────

export function ChatCard({
  messages,
  isLoading,
  error,
  onDismissError,
  input,
  onInputChange,
  onSubmit,
  onKeyDown,
  onCopy,
  copied,
  isConfigured,
  willReady,
  clientName,
  chatContainerRef,
  textareaRef,
  agentConnected,
}: {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  onDismissError: () => void;
  input: string;
  onInputChange: (val: string) => void;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCopy: (content: string, index: number) => void;
  copied: number | null;
  isConfigured: boolean;
  willReady: boolean;
  clientName: string;
  chatContainerRef: React.Ref<HTMLDivElement>;
  textareaRef: React.Ref<HTMLTextAreaElement>;
  agentConnected: boolean;
}) {
  return (
    <Card className="flex flex-col" style={{ height: '700px' }}>
      <CardHeader className="flex-none border-b bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-gray-900">
                Navigate Wealth Will Builder
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                AI-guided SA Last Will &amp; Testament interview
              </p>
            </div>
          </div>
          {agentConnected && (
            <Badge
              variant="outline"
              className="border-green-300 bg-green-50 text-green-700 text-[10px]"
              title="Connected to Navigate Wealth Will Builder Agent. Secure server-side processing."
            >
              Agent Live
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 p-0 bg-slate-50 relative overflow-hidden">
        {/* Error banner */}
        {error && (
          <div className="px-4 pt-2 pb-0 flex-none z-10">
            <Alert variant="destructive" className="shadow-sm">
              <AlertDescription className="flex items-center justify-between gap-2">
                <span className="text-xs break-all">{error}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 flex-shrink-0"
                  onClick={onDismissError}
                >
                  <X className="h-3 w-3" />
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Messages area */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center mb-4">
                <Scroll className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Will Interview Starting</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                The AI Will Builder is preparing the interview for {clientName}. The agent will
                guide you through identity confirmation, marriage regime, family details, executor
                appointment, and more.
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={`msg-${index}-${msg.timestamp.getTime()}`}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}

              <div
                className={`flex flex-col gap-1 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white rounded-br-none'
                      : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="leading-relaxed markdown-content">
                      <MessageRenderer content={msg.content} role="assistant" />
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  )}
                </div>

                <div
                  className={`flex items-center gap-2 px-1 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <span className="text-[10px] text-muted-foreground">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => onCopy(msg.content, index)}
                      className="text-muted-foreground hover:text-purple-600 transition-colors p-1 rounded hover:bg-purple-50"
                      title="Copy message"
                    >
                      {copied === index ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
                <Bot className="h-4 w-4 text-white animate-pulse" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-1.5">
                <span
                  className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="flex-none p-4 bg-white border-t">
          <div className="space-y-2">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={
                  willReady
                    ? 'Will is complete - you can still ask follow-up questions...'
                    : isConfigured
                      ? 'Type your response... (Shift+Enter for new line)'
                      : 'API key required to send messages'
                }
                disabled={!isConfigured || isLoading}
                className="min-h-[60px] max-h-[200px] resize-none pr-12"
                rows={1}
              />
              <Button
                onClick={onSubmit}
                disabled={
                  !isConfigured || isLoading || !input.trim() || input.length > MAX_MESSAGE_LENGTH
                }
                size="sm"
                className="absolute right-3 bottom-3 h-8 w-8 p-0 rounded-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>

              {input.length > MAX_MESSAGE_LENGTH * 0.8 && (
                <div
                  className={`absolute bottom-3 right-14 text-[10px] mr-2 ${
                    input.length > MAX_MESSAGE_LENGTH
                      ? 'text-red-600 font-bold'
                      : 'text-muted-foreground'
                  }`}
                >
                  {input.length}/{MAX_MESSAGE_LENGTH}
                </div>
              )}
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground px-1">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 font-sans text-[10px]">
                    Enter
                  </kbd>{' '}
                  to send
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 font-sans text-[10px]">
                    Shift + Enter
                  </kbd>{' '}
                  for new line
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
