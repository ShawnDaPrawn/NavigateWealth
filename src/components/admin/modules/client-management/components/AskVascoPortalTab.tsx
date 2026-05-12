import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Bot, Maximize2, Minimize2, Trash2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { ConfirmDialog } from '../../publications/components/ConfirmDialog';
import {
  VascoAvatar,
  VascoChatInput,
  VascoChatMessage,
  VascoStreamingBubble,
  VascoTypingIndicator,
  useVascoStream,
} from '../../../../shared/vasco-chat';
import type { VascoChatMessageType as ChatMessage } from '../../../../shared/vasco-chat';
import { APIError, api } from '../../../../../utils/api';
import { advisorKeys } from '../../../../../utils/queryKeys';
import type { Client } from '../types';

interface AskVascoPortalTabProps {
  selectedClient: Client;
}

/** Same welcome copy as the client portal (`AIAdvisorPage`) so the thread matches what they see. */
const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: `Hello! I'm **Vasco**, your AI Financial Navigator.

I have access to your profile, policy information, portfolio overview, FNA information, communication history, and document history so I can help you understand your finances with richer context.

**I can help with:**
- Understanding your current policies and cover
- Explaining what is reflected in your profile and portfolio overview
- Drawing on available FNA insights and recent document history
- Retirement planning and savings strategies
- Tax-efficient investment approaches
- Estate planning concepts
- General financial education

Ask me anything to get started!`,
  timestamp: new Date(),
};

export function AskVascoPortalTab({ selectedClient }: AskVascoPortalTabProps) {
  const queryClient = useQueryClient();
  const clientLabel =
    `${selectedClient.firstName} ${selectedClient.lastName}`.trim() || selectedClient.email;
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [authToken, setAuthToken] = useState<string | null>(null);
  useEffect(() => {
    async function getToken() {
      try {
        const { createClient } = await import('../../../../../utils/supabase/client');
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) setAuthToken(session.access_token);
      } catch {
        /* fall through */
      }
    }
    void getToken();
  }, [selectedClient.id]);

  const streamExtra = useMemo(
    () => ({ clientUserId: selectedClient.id }),
    [selectedClient.id],
  );

  const { streamingContent, isStreaming, sendStream } = useVascoStream({
    endpoint: '/ai-advisor/admin/chat/stream',
    authToken: authToken || undefined,
    extraBody: streamExtra,
  });

  const {
    data: historyData,
    isError: historyLoadError,
    error: historyQueryError,
  } = useQuery({
    queryKey: advisorKeys.adminClientHistory(selectedClient.id),
    queryFn: async () => {
      return await api.get<{
        messages: Array<{ role: string; content: string; timestamp: string }>;
      }>(
        `/ai-advisor/admin/history?clientUserId=${encodeURIComponent(selectedClient.id)}`,
      );
    },
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (
      historyData?.messages &&
      Array.isArray(historyData.messages) &&
      historyData.messages.length > 0
    ) {
      const parsed: ChatMessage[] = historyData.messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.timestamp),
      }));
      setMessages(parsed);
    } else if (
      historyData?.messages &&
      Array.isArray(historyData.messages) &&
      historyData.messages.length === 0
    ) {
      setMessages([WELCOME_MESSAGE]);
    }
  }, [historyData]);

  useEffect(() => {
    if (messages.length > 0 && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      requestAnimationFrame(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: messages.length <= 1 ? 'instant' : 'smooth',
        });
      });
    }
  }, [messages, isStreaming, streamingContent]);

  const { data: apiKeyStatus } = useQuery({
    queryKey: advisorKeys.status(),
    queryFn: async () => {
      return await api.get<{ configured: boolean; model?: string; keySuffix?: string }>(
        '/ai-advisor/status',
      );
    },
  });

  const showApiKeyWarning =
    apiKeyStatus &&
    (!apiKeyStatus.configured || apiKeyStatus.keySuffix === 'oBEA');

  const handleSendMessage = useCallback(
    async (text?: string) => {
      const content = text || input;
      if (!content.trim() || isStreaming) return;

      setError(null);

      const userMessage: ChatMessage = {
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput('');

      try {
        const chatHistory = updatedMessages
          .filter((m) => m !== WELCOME_MESSAGE)
          .map((m) => ({ role: m.role, content: m.content }));

        const result = await sendStream(chatHistory, null);

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: result.content,
          timestamp: new Date(),
          citations: result.citations.length > 0 ? result.citations : undefined,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : 'I apologise, but I encountered a temporary issue. Please try again.';

        setError(errorMsg);
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: `I apologise, but I'm experiencing a technical issue: ${errorMsg}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    },
    [messages, isStreaming, input, sendStream],
  );

  const clearChatMutation = useMutation({
    mutationFn: async () => {
      await api.delete(
        `/ai-advisor/admin/history?clientUserId=${encodeURIComponent(selectedClient.id)}`,
      );
    },
    onSuccess: () => {
      setMessages([WELCOME_MESSAGE]);
      queryClient.setQueryData(advisorKeys.adminClientHistory(selectedClient.id), { messages: [] });
      toast.success('Cleared this client’s Ask Vasco history');
    },
    onError: () => {
      toast.error('Failed to clear history');
    },
  });

  const chatBody = (
    <div
      className={`flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${
        isExpanded ? 'h-[min(85vh,900px)]' : 'h-[min(640px,calc(100vh-22rem))]'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <VascoAvatar size="md" />
          <div className="min-w-0">
            <h3 className="text-gray-900 font-semibold text-sm truncate">{clientLabel}</h3>
            <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
              Portal Ask Vasco (shared thread)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
            title="Clear this client’s chat history"
            disabled={isStreaming}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            onClick={() => setIsExpanded((e) => !e)}
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-[#6d28d9] hover:bg-purple-50 h-8 w-8 p-0"
            title={isExpanded ? 'Minimize' : 'Expand'}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {showApiKeyWarning && (
        <Alert className="m-3 border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-900 text-sm">
            <strong>Action Required:</strong> OpenAI API key needs to be updated.
          </AlertDescription>
        </Alert>
      )}

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 min-h-0"
      >
        {messages.map((message, index) => (
          <VascoChatMessage
            key={`${message.role}-${index}-${message.timestamp.getTime()}`}
            message={message}
            isWelcome={index === 0 && message === WELCOME_MESSAGE}
          />
        ))}
        {isStreaming && streamingContent && <VascoStreamingBubble content={streamingContent} />}
        {isStreaming && !streamingContent && <VascoTypingIndicator />}
      </div>

      <VascoChatInput
        value={input}
        onChange={setInput}
        onSubmit={() => void handleSendMessage()}
        isLoading={isStreaming}
        error={error}
        placeholder="Reply as Vasco in this client’s thread…"
        footer={
          <p className="text-[10px] text-gray-400 text-center">
            Same conversation as the client’s portal. Clearing history removes it for them too.
          </p>
        }
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <Alert className="border-purple-100 bg-purple-50/80">
        <Bot className="h-4 w-4 text-purple-700" />
        <AlertDescription className="text-sm text-gray-800">
          You are viewing <strong>{clientLabel}</strong>’s Ask Vasco conversation from their client
          portal. Any messages you send here will appear in the same conversation history they can
          see on their account.
        </AlertDescription>
      </Alert>

      {historyLoadError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {historyQueryError instanceof APIError
              ? historyQueryError.message
              : 'Could not load this client’s Ask Vasco history. Check your permissions or try again.'}
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Ask Vasco</CardTitle>
          <p className="text-sm text-muted-foreground">
            Read and continue this client’s AI navigator conversation.
          </p>
        </CardHeader>
        <CardContent>{chatBody}</CardContent>
      </Card>

      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => {
          setShowClearConfirm(false);
          clearChatMutation.mutate();
        }}
        title="Clear this client’s Ask Vasco history?"
        description="This deletes the same conversation they see in the client portal. They will start fresh the next time they open Ask Vasco."
        confirmLabel="Clear history"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={clearChatMutation.isPending}
      />
    </div>
  );
}
