/**
 * AIAdvisorPage — Logged-in "Ask Vasco" Portal Chat
 *
 * Full-page AI chat experience for authenticated users.
 * Uses the shared vasco-chat component library and SSE streaming
 * via the `/ai-advisor/chat/stream` endpoint.
 *
 * Features:
 *   - Streaming responses (SSE) with real-time token rendering
 *   - Server-side conversation history (KV-persisted per user)
 *   - Copy-to-clipboard on assistant messages
 *   - Suggested prompts sidebar
 *   - Expand-to-fullscreen mode
 *   - API key status check
 *
 * @module pages/AIAdvisorPage
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Maximize2,
  Minimize2,
  Trash2,
  ChevronRight,
  Shield,
  Briefcase,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { api } from '../../utils/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { advisorKeys } from '../../utils/queryKeys';
import { PortalPageHeader } from '../portal/PortalPageHeader';
import { ACTIVE_THEME } from '../portal/portal-theme';
import { toast } from 'sonner@2.0.3';
import { ConfirmDialog } from '../admin/modules/publications/components/ConfirmDialog';

// Shared Vasco chat components
import {
  VascoAvatar,
  VascoChatMessage,
  VascoTypingIndicator,
  VascoStreamingBubble,
  VascoChatInput,
  useVascoStream,
} from '../shared/vasco-chat';
import type { VascoChatMessageType as ChatMessage } from '../shared/vasco-chat';

// ============================================================================
// CONSTANTS
// ============================================================================

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

// ============================================================================
// CHAT INTERFACE (used in both card and fullscreen modes)
// ============================================================================

function PortalChatInterface({
  isExpanded,
  onToggleExpand,
  messages,
  input,
  setInput,
  isLoading,
  error,
  onSendMessage,
  onClearChat,
  streamingContent,
}: {
  isExpanded: boolean;
  onToggleExpand: () => void;
  messages: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  isLoading: boolean;
  error: string | null;
  onSendMessage: () => void;
  onClearChat: () => void;
  streamingContent: string;
}) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Check API key status
  const { data: apiKeyStatus } = useQuery({
    queryKey: advisorKeys.status(),
    queryFn: async () => {
      return await api.get<{ configured: boolean; model?: string }>(
        '/ai-advisor/status'
      );
    },
  });

  // Scroll to bottom when messages change or streaming content updates
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
  }, [messages, isLoading, streamingContent]);

  const showApiKeyWarning =
    apiKeyStatus &&
    (!apiKeyStatus.configured ||
      (apiKeyStatus as { keySuffix?: string }).keySuffix === 'oBEA');

  const chatHeight = isExpanded
    ? 'h-[calc(100vh-120px)]'
    : 'h-[650px]';

  return (
    <div
      className={`flex flex-col ${chatHeight} bg-white rounded-lg transition-all duration-300`}
    >
      {/* Chat Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <VascoAvatar size="md" />
          <div>
            <h3 className="text-gray-900 font-semibold text-sm">Vasco</h3>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              AI Financial Navigator
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            onClick={onClearChat}
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
            title="Clear chat history"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            onClick={onToggleExpand}
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-[#6d28d9] hover:bg-purple-50 h-8 w-8 p-0"
            title={isExpanded ? 'Minimize' : 'Expand'}
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* API Key Warning Banner */}
      {showApiKeyWarning && (
        <Alert className="m-4 border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-900 text-sm">
            <strong>Action Required:</strong> OpenAI API key needs to be
            updated.
          </AlertDescription>
        </Alert>
      )}

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-6 space-y-5 bg-gray-50/50"
      >
        {messages.map((message, index) => (
          <VascoChatMessage
            key={index}
            message={message}
            isWelcome={index === 0 && message === WELCOME_MESSAGE}
          />
        ))}

        {/* Streaming bubble — shows real-time content as it arrives */}
        {isLoading && streamingContent && (
          <VascoStreamingBubble content={streamingContent} />
        )}

        {/* Typing indicator — shown before streaming starts */}
        {isLoading && !streamingContent && <VascoTypingIndicator />}
      </div>

      {/* Input Area */}
      <VascoChatInput
        value={input}
        onChange={setInput}
        onSubmit={onSendMessage}
        isLoading={isLoading}
        error={error}
        placeholder="Ask Vasco about your financial goals..."
        footer={
          <p className="text-[10px] text-gray-400 text-center">
            Vasco provides general financial information only — not personal
            financial advice.
          </p>
        }
      />
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export function AIAdvisorPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Get auth token for streaming
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
        // Fall back to non-streaming if token unavailable
      }
    }
    getToken();
  }, [user]);

  // SSE streaming hook
  const { streamingContent, isStreaming, sendStream } = useVascoStream({
    endpoint: '/ai-advisor/chat/stream',
    authToken: authToken || undefined,
  });

  // Fetch history
  const { data: historyData } = useQuery({
    queryKey: advisorKeys.history(user?.id),
    enabled: !!user,
    queryFn: async () => {
      return await api.get<{
        messages: Array<{
          role: string;
          content: string;
          timestamp: string;
        }>;
      }>('/ai-advisor/history');
    },
    staleTime: 5 * 60 * 1000,
  });

  // Sync history to local state on load
  useEffect(() => {
    if (
      historyData &&
      historyData.messages &&
      Array.isArray(historyData.messages) &&
      historyData.messages.length > 0
    ) {
      const parsedMessages: ChatMessage[] = historyData.messages.map(
        (msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: new Date(msg.timestamp),
        })
      );
      setMessages(parsedMessages);
    }
  }, [historyData]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  // Send message handler — uses SSE streaming
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
        // Build chat history for the streaming endpoint
        const chatHistory = updatedMessages
          .filter((m) => m !== WELCOME_MESSAGE)
          .map((m) => ({ role: m.role, content: m.content }));

        const result = await sendStream(chatHistory, null);

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: result.content,
          timestamp: new Date(),
          citations:
            result.citations.length > 0 ? result.citations : undefined,
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
    [messages, isStreaming, input, sendStream]
  );

  // Clear chat
  const clearChatMutation = useMutation({
    mutationFn: async () => {
      if (user) await api.delete('/ai-advisor/history');
    },
    onSuccess: () => {
      setMessages([WELCOME_MESSAGE]);
      queryClient.setQueryData(['advisor', 'history', user?.id], {
        messages: [],
      });
      toast.success('Chat history cleared');
    },
    onError: () => {
      toast.error('Failed to clear chat history');
    },
  });

  const handleClearChat = () => {
    setShowClearConfirm(true);
  };

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
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* About Card */}
            <Card className="border-gray-200 shadow-sm bg-gradient-to-br from-purple-50 to-white">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="h-4 w-4 text-[#6d28d9]" />
                  About Vasco
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Vasco is trained on South African financial regulations and
                  Navigate Wealth's planning philosophy. He has access to your
                  full logged-in client context, including profile details,
                  policies, portfolio overview, FNA information, communication
                  history, and document history.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-white/50 text-gray-600 border-gray-200"
                  >
                    24/7 Support
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-white/50 text-gray-600 border-gray-200"
                  >
                    Secure
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-white/50 text-gray-600 border-gray-200"
                  >
                    GPT-4o
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Suggested Prompts */}
            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Suggested Topics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {SUGGESTED_PROMPTS.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendMessage(prompt)}
                      disabled={isStreaming}
                      className="w-full text-left p-2.5 text-xs text-gray-600 bg-gray-50 hover:bg-purple-50 hover:text-[#6d28d9] rounded-lg transition-colors border border-transparent hover:border-purple-100 flex items-center justify-between group"
                    >
                      {prompt}
                      <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Capabilities */}
            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-blue-500" />
                  Capabilities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: 'Retirement Planning', icon: TrendingUp },
                  { name: 'Tax Efficiency', icon: FileText },
                  { name: 'Risk Management', icon: Shield },
                ].map((cap, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-sm text-gray-600"
                  >
                    <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <cap.icon className="h-4 w-4 text-gray-500" />
                    </div>
                    <span>{cap.name}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Disclaimer */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <h4 className="text-xs font-semibold text-gray-700">
                  Disclaimer
                </h4>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Vasco provides general financial information only. Nothing in
                this conversation constitutes formal financial advice, a
                recommendation, or an offer to buy or sell any financial
                product.
              </p>
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="lg:col-span-3">
            {!isExpanded ? (
              <Card className="border-gray-200 shadow-sm overflow-hidden">
                <PortalChatInterface
                  isExpanded={false}
                  onToggleExpand={() => setIsExpanded(true)}
                  messages={messages}
                  input={input}
                  setInput={setInput}
                  isLoading={isStreaming}
                  error={error}
                  onSendMessage={() => handleSendMessage()}
                  onClearChat={handleClearChat}
                  streamingContent={streamingContent}
                />
              </Card>
            ) : (
              <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
                <DialogContent
                  className="max-w-[95vw] w-[95vw] h-[90vh] p-0 gap-0 border-none sm:rounded-xl overflow-hidden shadow-2xl"
                  hideCloseButton
                >
                  <PortalChatInterface
                    isExpanded={true}
                    onToggleExpand={() => setIsExpanded(false)}
                    messages={messages}
                    input={input}
                    setInput={setInput}
                    isLoading={isStreaming}
                    error={error}
                    onSendMessage={() => handleSendMessage()}
                    onClearChat={handleClearChat}
                    streamingContent={streamingContent}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => {
          setShowClearConfirm(false);
          clearChatMutation.mutate();
        }}
        title="Clear chat history?"
        description="Are you sure you want to clear your Ask Vasco chat history? This action cannot be undone."
        confirmLabel="Clear chat"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={clearChatMutation.isPending}
      />
    </div>
  );
}

export default AIAdvisorPage;
