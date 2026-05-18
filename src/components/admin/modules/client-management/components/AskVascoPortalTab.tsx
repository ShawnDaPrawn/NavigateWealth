import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Bot,
  Eraser,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Dialog, DialogContent } from '../../../../ui/dialog';
import { ConfirmDialog } from '../../publications/components/ConfirmDialog';
import {
  VascoAvatar,
  VascoChatInput,
  VascoChatMessage,
  VascoSessionWorkspace,
  VascoStreamingBubble,
  VascoTypingIndicator,
  useVascoStream,
} from '../../../../shared/vasco-chat';
import type {
  VascoChatMessageType as ChatMessage,
  VascoChatSessionSummary,
} from '../../../../shared/vasco-chat';
import { APIError, api } from '../../../../../utils/api';
import { advisorKeys } from '../../../../../utils/queryKeys';
import type { Client } from '../types';

interface AskVascoPortalTabProps {
  selectedClient: Client;
}

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

function isWelcomeMessage(message: ChatMessage) {
  return message.role === 'assistant' && message.content === WELCOME_MESSAGE.content;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mapMessages(
  rawMessages:
    | Array<{
        role: string;
        content: string;
        timestamp: string;
        citations?: Array<{ title: string; slug: string; url: string }>;
        artifacts?: ChatMessage['artifacts'];
      }>
    | undefined,
): ChatMessage[] {
  if (!rawMessages || rawMessages.length === 0) return [WELCOME_MESSAGE];

  return rawMessages.map((message) => ({
    role: message.role as 'user' | 'assistant',
    content: message.content,
    timestamp: new Date(message.timestamp),
    citations: message.citations,
    artifacts: message.artifacts,
  }));
}

function InlineChatCard({
  clientLabel,
  activeSession,
  messages,
  input,
  error,
  isStreaming,
  streamingContent,
  apiKeyWarning,
  onInputChange,
  onSendMessage,
  onExpand,
  onMinimize,
  onClearCurrent,
  onDeleteCurrent,
  onNewChat,
}: {
  clientLabel: string;
  activeSession: VascoChatSessionSummary | null;
  messages: ChatMessage[];
  input: string;
  error: string | null;
  isStreaming: boolean;
  streamingContent: string;
  apiKeyWarning: React.ReactNode;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onExpand: () => void;
  onMinimize: () => void;
  onClearCurrent: () => void;
  onDeleteCurrent: () => void;
  onNewChat: () => void;
}) {
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
  }, [messages, isStreaming, streamingContent]);

  return (
    <div className="flex h-[min(700px,calc(100vh-21rem))] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <VascoAvatar size="md" />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-gray-900">
              {activeSession?.title || 'Ask Vasco'}
            </h3>
            <p className="truncate text-xs text-gray-500">
              {activeSession
                ? `Updated ${formatTimestamp(activeSession.updatedAt)}`
                : `${clientLabel}'s shared client portal thread`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onNewChat}
            disabled={isStreaming}
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <Plus className="mr-2 h-4 w-4" />
            New chat
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClearCurrent}
            disabled={isStreaming || !activeSession}
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <Eraser className="mr-2 h-4 w-4" />
            Clear
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDeleteCurrent}
            disabled={isStreaming || !activeSession}
            className="border-red-200 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
          <Button
            type="button"
            onClick={onMinimize}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-gray-500 hover:bg-purple-50 hover:text-[#6d28d9]"
            title="Minimize"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            onClick={onExpand}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-gray-500 hover:bg-purple-50 hover:text-[#6d28d9]"
            title="Expand"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {apiKeyWarning && <div className="border-b border-gray-100 px-4 py-3">{apiKeyWarning}</div>}

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto bg-gray-50/50 px-4 py-4"
      >
        <div className="space-y-4">
          {messages.map((message, index) => (
            <VascoChatMessage
              key={`${message.role}-${index}-${message.timestamp.getTime()}`}
              message={message}
              isWelcome={index === 0 && isWelcomeMessage(message)}
            />
          ))}
          {isStreaming && streamingContent && <VascoStreamingBubble content={streamingContent} />}
          {isStreaming && !streamingContent && <VascoTypingIndicator />}
        </div>
      </div>

      <VascoChatInput
        value={input}
        onChange={onInputChange}
        onSubmit={onSendMessage}
        isLoading={isStreaming}
        error={error}
        placeholder="Reply as Vasco in this client's thread..."
        footer={
          <p className="text-center text-[10px] text-gray-400">
            Same conversation as the client portal. Clearing or deleting here changes the client
            view too.
          </p>
        }
      />
    </div>
  );
}

export function AskVascoPortalTab({ selectedClient }: AskVascoPortalTabProps) {
  const queryClient = useQueryClient();
  const clientLabel =
    `${selectedClient.firstName} ${selectedClient.lastName}`.trim() || selectedClient.email;

  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    async function getToken() {
      try {
        const { createClient } = await import('../../../../../utils/supabase/client');
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          setAuthToken(session.access_token);
        }
      } catch {
        // Fall back to anon auth inside useVascoStream.
      }
    }

    void getToken();
  }, []);

  useEffect(() => {
    setInput('');
    setError(null);
    setMessages([WELCOME_MESSAGE]);
    setActiveSessionId(null);
    setShowClearConfirm(false);
    setShowDeleteConfirm(false);
  }, [selectedClient.id]);

  const { streamingContent, isStreaming, sendStream } = useVascoStream({
    endpoint: '/ai-advisor/admin/chat/stream',
    authToken: authToken || undefined,
    extraBody: { clientUserId: selectedClient.id },
  });

  const { data: apiKeyStatus } = useQuery({
    queryKey: advisorKeys.status(),
    queryFn: async () =>
      api.get<{ configured: boolean; model?: string; keySuffix?: string }>('/ai-advisor/status'),
  });

  const sessionsQuery = useQuery({
    queryKey: advisorKeys.adminClientSessions(selectedClient.id),
    queryFn: async () =>
      api.get<{ sessions: VascoChatSessionSummary[] }>(
        `/ai-advisor/admin/sessions?clientUserId=${encodeURIComponent(selectedClient.id)}`,
      ),
    staleTime: 60 * 1000,
  });

  const sessions = sessionsQuery.data?.sessions ?? [];
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || null,
    [sessions, activeSessionId],
  );

  useEffect(() => {
    if (sessions.length === 0) {
      setActiveSessionId(null);
      setMessages([WELCOME_MESSAGE]);
      return;
    }

    if (!activeSessionId || !sessions.some((session) => session.id === activeSessionId)) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  const sessionDetailQuery = useQuery({
    queryKey: advisorKeys.adminClientSession(selectedClient.id, activeSessionId),
    enabled: !!activeSessionId,
    queryFn: async () =>
      api.get<{
        session: VascoChatSessionSummary;
        messages: Array<{
          role: string;
          content: string;
          timestamp: string;
          citations?: Array<{ title: string; slug: string; url: string }>;
          artifacts?: ChatMessage['artifacts'];
        }>;
      }>(
        `/ai-advisor/admin/sessions/${encodeURIComponent(activeSessionId || '')}?clientUserId=${encodeURIComponent(selectedClient.id)}`,
      ),
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (!activeSessionId) {
      setMessages([WELCOME_MESSAGE]);
      return;
    }

    if (sessionDetailQuery.data) {
      setMessages(mapMessages(sessionDetailQuery.data.messages));
      setError(null);
    }
  }, [activeSessionId, sessionDetailQuery.data]);

  const createSessionMutation = useMutation({
    mutationFn: async () =>
      api.post<{ session: VascoChatSessionSummary }>('/ai-advisor/admin/sessions', {
        clientUserId: selectedClient.id,
      }),
    onSuccess: ({ session }) => {
      queryClient.invalidateQueries({
        queryKey: advisorKeys.adminClientSessions(selectedClient.id),
      });
      setActiveSessionId(session.id);
      setMessages([WELCOME_MESSAGE]);
      setError(null);
      setInput('');
    },
    onError: () => {
      toast.error('Failed to create a new chat');
    },
  });

  const clearChatMutation = useMutation({
    mutationFn: async (sessionId: string) =>
      api.delete<{ success: boolean }>(
        `/ai-advisor/admin/history?clientUserId=${encodeURIComponent(selectedClient.id)}&sessionId=${encodeURIComponent(sessionId)}`,
      ),
    onSuccess: () => {
      setMessages([WELCOME_MESSAGE]);
      queryClient.invalidateQueries({
        queryKey: advisorKeys.adminClientSessions(selectedClient.id),
      });
      if (activeSessionId) {
        queryClient.invalidateQueries({
          queryKey: advisorKeys.adminClientSession(selectedClient.id, activeSessionId),
        });
      }
      toast.success("Cleared this client's current Ask Vasco chat");
    },
    onError: () => {
      toast.error('Failed to clear chat');
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) =>
      api.delete<{ success: boolean }>(
        `/ai-advisor/admin/sessions/${encodeURIComponent(sessionId)}?clientUserId=${encodeURIComponent(selectedClient.id)}`,
      ),
    onSuccess: (_, deletedSessionId) => {
      const remainingSessions = sessions.filter((session) => session.id !== deletedSessionId);
      setActiveSessionId(remainingSessions[0]?.id ?? null);
      setMessages([WELCOME_MESSAGE]);
      queryClient.invalidateQueries({
        queryKey: advisorKeys.adminClientSessions(selectedClient.id),
      });
      queryClient.removeQueries({
        queryKey: advisorKeys.adminClientSession(selectedClient.id, deletedSessionId),
      });
      toast.success("Deleted this client's Ask Vasco chat");
    },
    onError: () => {
      toast.error('Failed to delete chat');
    },
  });

  const ensureActiveSession = useCallback(async () => {
    if (activeSessionId) return activeSessionId;
    const created = await createSessionMutation.mutateAsync();
    return created.session.id;
  }, [activeSessionId, createSessionMutation]);

  const handleSendMessage = useCallback(
    async (preset?: string) => {
      const content = (preset || input).trim();
      if (!content || isStreaming) return;

      setError(null);

      const sessionId = await ensureActiveSession();
      const userMessage: ChatMessage = {
        role: 'user',
        content,
        timestamp: new Date(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput('');

      try {
        const chatHistory = updatedMessages
          .filter((message) => !isWelcomeMessage(message))
          .map((message) => ({ role: message.role, content: message.content }));

        const result = await sendStream(chatHistory, sessionId);

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: result.content,
          timestamp: new Date(),
          citations: result.citations.length > 0 ? result.citations : undefined,
          artifacts: result.artifacts.length > 0 ? result.artifacts : undefined,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setActiveSessionId(result.sessionId || sessionId);
        queryClient.invalidateQueries({
          queryKey: advisorKeys.adminClientSessions(selectedClient.id),
        });
        queryClient.invalidateQueries({
          queryKey: advisorKeys.adminClientSession(
            selectedClient.id,
            result.sessionId || sessionId,
          ),
        });
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'I apologise, but I encountered a temporary issue. Please try again.';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    },
    [
      input,
      isStreaming,
      ensureActiveSession,
      messages,
      sendStream,
      queryClient,
      selectedClient.id,
    ],
  );

  const showApiKeyWarning =
    apiKeyStatus &&
    (!apiKeyStatus.configured || apiKeyStatus.keySuffix === 'oBEA');

  const apiKeyWarningBanner = showApiKeyWarning ? (
    <Alert className="border-amber-200 bg-amber-50">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-sm text-amber-900">
        <strong>Action Required:</strong> OpenAI API key needs to be updated.
      </AlertDescription>
    </Alert>
  ) : null;

  const loadError = sessionsQuery.error || sessionDetailQuery.error;

  return (
    <div className="space-y-4">
      <Alert className="border-purple-100 bg-purple-50/80">
        <Bot className="h-4 w-4 text-purple-700" />
        <AlertDescription className="text-sm text-gray-800">
          You are viewing <strong>{clientLabel}</strong>&apos;s Ask Vasco workspace from the client
          portal. Messages, clears, and deletions here affect the same conversations visible to the
          client.
        </AlertDescription>
      </Alert>

      {loadError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {loadError instanceof APIError
              ? loadError.message
              : "Could not load this client's Ask Vasco chats. Check your permissions or try again."}
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Ask Vasco</CardTitle>
          <p className="text-sm text-muted-foreground">
            Review, continue, clear, or remove chats from this client&apos;s shared portal
            workspace.
          </p>
        </CardHeader>
        <CardContent>
          <InlineChatCard
            clientLabel={clientLabel}
            activeSession={activeSession}
            messages={messages}
            input={input}
            error={error}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            apiKeyWarning={apiKeyWarningBanner}
            onInputChange={setInput}
            onSendMessage={() => void handleSendMessage()}
            onExpand={() => setIsExpanded(true)}
            onMinimize={() => setIsExpanded(false)}
            onClearCurrent={() => setShowClearConfirm(true)}
            onDeleteCurrent={() => setShowDeleteConfirm(true)}
            onNewChat={() => createSessionMutation.mutate()}
          />
        </CardContent>
      </Card>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent
          className="h-[92vh] max-w-[96vw] w-[96vw] gap-0 overflow-hidden border-none p-0 shadow-2xl sm:rounded-[28px]"
          hideCloseButton
        >
          <VascoSessionWorkspace
            title="AI Advisor"
            subtitle={`Manage ${clientLabel}'s Ask Vasco chats, start new threads, or clean up the current conversation.`}
            sessions={sessions}
            activeSessionId={activeSessionId}
            messages={messages}
            input={input}
            isLoading={isStreaming}
            streamingContent={streamingContent}
            error={error}
            apiKeyWarning={apiKeyWarningBanner}
            contextBanner={
              <p className="text-sm text-gray-700">
                You are acting inside the shared client portal workspace for{' '}
                <strong>{clientLabel}</strong>. Anything you send or remove here will appear the
                same way for the client.
              </p>
            }
            footer={
              <p className="text-center text-[10px] text-gray-400">
                Shared client portal chat. Use clear to empty a thread or delete to remove it from
                the client&apos;s list.
              </p>
            }
            emptyRailLabel="No saved Ask Vasco chats yet. Start a new chat to create the client's first thread."
            onInputChange={setInput}
            onSendMessage={() => void handleSendMessage()}
            onSelectSession={setActiveSessionId}
            onCreateSession={() => createSessionMutation.mutate()}
            onClearSession={() => setShowClearConfirm(true)}
            onDeleteSession={() => setShowDeleteConfirm(true)}
            onClose={() => setIsExpanded(false)}
            disableSessionActions={isStreaming}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => {
          if (!activeSessionId) return;
          setShowClearConfirm(false);
          clearChatMutation.mutate(activeSessionId);
        }}
        title="Clear this client's current chat?"
        description="This keeps the chat in the history list but removes every message inside it for both you and the client."
        confirmLabel="Clear chat"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={clearChatMutation.isPending}
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          if (!activeSessionId) return;
          setShowDeleteConfirm(false);
          deleteSessionMutation.mutate(activeSessionId);
        }}
        title="Delete this client's chat?"
        description="This removes the full Ask Vasco thread from the client's chat list."
        confirmLabel="Delete chat"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleteSessionMutation.isPending}
      />
    </div>
  );
}
