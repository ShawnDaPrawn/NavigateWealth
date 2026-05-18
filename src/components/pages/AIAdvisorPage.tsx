/**
 * AIAdvisorPage — Logged-in "Ask Vasco" Portal Chat
 *
 * Full-page AI chat experience for authenticated users.
 * Uses the shared vasco-chat component library and SSE streaming
 * via the `/ai-advisor/chat/stream` endpoint.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Dialog, DialogContent } from '../ui/dialog';
import { Badge } from '../ui/badge';
import {
  Bot,
  Sparkles,
  Zap,
  AlertCircle,
  ChevronRight,
  Maximize2,
  Shield,
  Briefcase,
  TrendingUp,
  FileText,
  Plus,
  Eraser,
} from 'lucide-react';
import { api } from '../../utils/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { advisorKeys } from '../../utils/queryKeys';
import { PortalPageHeader } from '../portal/PortalPageHeader';
import { ACTIVE_THEME } from '../portal/portal-theme';
import { toast } from 'sonner@2.0.3';
import { ConfirmDialog } from '../admin/modules/publications/components/ConfirmDialog';
import {
  VascoAvatar,
  VascoChatInput,
  VascoChatMessage,
  VascoSessionWorkspace,
  VascoStreamingBubble,
  VascoTypingIndicator,
  useVascoStream,
} from '../shared/vasco-chat';
import type {
  VascoChatMessageType as ChatMessage,
  VascoChatSessionSummary,
} from '../shared/vasco-chat';

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

const SUGGESTED_PROMPTS = [
  'How much should I save for retirement?',
  'Explain tax-free savings accounts',
  'Difference between RA and Pension',
  'How does estate duty work?',
];

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
  rawMessages: Array<{
    role: string;
    content: string;
    timestamp: string;
    citations?: Array<{ title: string; slug: string; url: string }>;
    artifacts?: ChatMessage['artifacts'];
  }> | undefined,
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
  onClearCurrent,
  onNewChat,
}: {
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
  onClearCurrent: () => void;
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
    <Card className="border-gray-200 shadow-sm overflow-hidden">
      <div className="flex h-[650px] flex-col bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <VascoAvatar size="md" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {activeSession?.title || 'Ask Vasco'}
              </h3>
              <p className="text-xs text-gray-500">
                {activeSession ? `Updated ${formatTimestamp(activeSession.updatedAt)}` : 'AI Financial Navigator'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={onNewChat}
              variant="outline"
              size="sm"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
              disabled={isStreaming}
            >
              <Plus className="mr-2 h-4 w-4" />
              New chat
            </Button>
            <Button
              onClick={onClearCurrent}
              variant="outline"
              size="sm"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
              disabled={isStreaming || !activeSession}
            >
              <Eraser className="mr-2 h-4 w-4" />
              Clear
            </Button>
            <Button
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
          className="flex-1 overflow-y-auto bg-gray-50/50 px-6 py-5"
        >
          <div className="space-y-5">
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
          placeholder="Ask Vasco about your financial goals..."
          footer={
            <p className="text-center text-[10px] text-gray-400">
              Vasco provides general financial information only — not personal financial advice.
            </p>
          }
        />
      </div>
    </Card>
  );
}

export function AIAdvisorPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
        const { createClient } = await import('../../utils/supabase/client');
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
  }, [user]);

  const { streamingContent, isStreaming, sendStream } = useVascoStream({
    endpoint: '/ai-advisor/chat/stream',
    authToken: authToken || undefined,
  });

  const { data: apiKeyStatus } = useQuery({
    queryKey: advisorKeys.status(),
    queryFn: async () => api.get<{ configured: boolean; model?: string; keySuffix?: string }>('/ai-advisor/status'),
  });

  const sessionsQuery = useQuery({
    queryKey: advisorKeys.sessions(user?.id),
    enabled: !!user,
    queryFn: async () =>
      api.get<{ sessions: VascoChatSessionSummary[] }>('/ai-advisor/sessions'),
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
    queryKey: advisorKeys.session(user?.id, activeSessionId),
    enabled: !!user && !!activeSessionId,
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
      }>(`/ai-advisor/sessions/${activeSessionId}`),
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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const createSessionMutation = useMutation({
    mutationFn: async () => api.post<{ session: VascoChatSessionSummary }>('/ai-advisor/sessions', {}),
    onSuccess: ({ session }) => {
      queryClient.invalidateQueries({ queryKey: advisorKeys.sessions(user?.id) });
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
      api.delete<{ success: boolean }>(`/ai-advisor/history?sessionId=${encodeURIComponent(sessionId)}`),
    onSuccess: () => {
      setMessages([WELCOME_MESSAGE]);
      queryClient.invalidateQueries({ queryKey: advisorKeys.sessions(user?.id) });
      if (activeSessionId) {
        queryClient.invalidateQueries({ queryKey: advisorKeys.session(user?.id, activeSessionId) });
      }
      toast.success('Current chat cleared');
    },
    onError: () => {
      toast.error('Failed to clear chat history');
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) =>
      api.delete<{ success: boolean }>(`/ai-advisor/sessions/${encodeURIComponent(sessionId)}`),
    onSuccess: (_, deletedSessionId) => {
      const remainingSessions = sessions.filter((session) => session.id !== deletedSessionId);
      setActiveSessionId(remainingSessions[0]?.id ?? null);
      setMessages([WELCOME_MESSAGE]);
      queryClient.invalidateQueries({ queryKey: advisorKeys.sessions(user?.id) });
      queryClient.removeQueries({ queryKey: advisorKeys.session(user?.id, deletedSessionId) });
      toast.success('Chat deleted');
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
        queryClient.invalidateQueries({ queryKey: advisorKeys.sessions(user?.id) });
        queryClient.invalidateQueries({ queryKey: advisorKeys.session(user?.id, result.sessionId || sessionId) });
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'I apologise, but I encountered a temporary issue. Please try again.';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    },
    [input, isStreaming, ensureActiveSession, messages, sendStream, queryClient, user?.id],
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

  return (
    <div
      className={`min-h-screen ${
        ACTIVE_THEME === 'branded' ? 'bg-[#f8f9fb]' : 'bg-[rgb(249,249,249)]'
      }`}
    >
      <PortalPageHeader
        title="Ask Vasco"
        subtitle="Your AI-powered financial navigator — personalised insights for your financial journey"
        icon={Sparkles}
        compact
      />

      <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="space-y-6 lg:col-span-1">
            <Card className="border-gray-200 bg-gradient-to-br from-purple-50 to-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="h-4 w-4 text-[#6d28d9]" />
                  About Vasco
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed text-gray-600">
                  Vasco is trained on South African financial regulations and Navigate Wealth&apos;s
                  planning philosophy. He has access to your full logged-in client context,
                  including profile details, policies, portfolio overview, FNA information,
                  communication history, and document history.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="border-gray-200 bg-white/50 text-gray-600">
                    24/7 Support
                  </Badge>
                  <Badge variant="secondary" className="border-gray-200 bg-white/50 text-gray-600">
                    Secure
                  </Badge>
                  <Badge variant="secondary" className="border-gray-200 bg-white/50 text-gray-600">
                    GPT-4o
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Suggested Topics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => void handleSendMessage(prompt)}
                      disabled={isStreaming}
                      className="group flex w-full items-center justify-between rounded-lg border border-transparent bg-gray-50 p-2.5 text-left text-xs text-gray-600 transition-colors hover:border-purple-100 hover:bg-purple-50 hover:text-[#6d28d9]"
                    >
                      {prompt}
                      <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Briefcase className="h-4 w-4 text-blue-500" />
                  Capabilities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: 'Retirement Planning', icon: TrendingUp },
                  { name: 'Tax Efficiency', icon: FileText },
                  { name: 'Risk Management', icon: Shield },
                ].map((capability) => (
                  <div key={capability.name} className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-50">
                      <capability.icon className="h-4 w-4 text-gray-500" />
                    </div>
                    <span>{capability.name}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-2 flex gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-gray-400" />
                <h4 className="text-xs font-semibold text-gray-700">Disclaimer</h4>
              </div>
              <p className="text-[11px] leading-relaxed text-gray-500">
                Vasco provides general financial information only. Nothing in this conversation
                constitutes formal financial advice, a recommendation, or an offer to buy or sell
                any financial product.
              </p>
            </div>
          </div>

          <div className="lg:col-span-3">
            <InlineChatCard
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
              onClearCurrent={() => setShowClearConfirm(true)}
              onNewChat={() => createSessionMutation.mutate()}
            />
          </div>
        </div>
      </div>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent
          className="h-[92vh] max-w-[96vw] w-[96vw] gap-0 overflow-hidden border-none p-0 shadow-2xl sm:rounded-[28px]"
          hideCloseButton
        >
          <VascoSessionWorkspace
            title="AI Advisor"
            subtitle="Switch between Ask Vasco chats, start a new thread, or clear the current conversation."
            sessions={sessions}
            activeSessionId={activeSessionId}
            messages={messages}
            input={input}
            isLoading={isStreaming}
            streamingContent={streamingContent}
            error={error}
            apiKeyWarning={apiKeyWarningBanner}
            footer={
              <p className="text-center text-[10px] text-gray-400">
                Vasco provides general financial information only — not personal financial advice.
              </p>
            }
            emptyRailLabel="No saved Ask Vasco chats yet. Start a new chat to begin."
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
        title="Clear current chat?"
        description="This keeps the chat in your history list but removes all messages inside it."
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
        title="Delete this chat?"
        description="This removes the current Ask Vasco thread from your chat history."
        confirmLabel="Delete chat"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleteSessionMutation.isPending}
      />
    </div>
  );
}

export default AIAdvisorPage;
