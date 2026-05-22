/**
 * AskVascoPage — Public AI Financial Navigator
 *
 * Logged-out Ask Vasco experience aligned with the client portal AI Advisor UI.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../ui/button';
import { SEO, createWebPageSchema } from '../seo/SEO';
import { getSEOData } from '../seo/seo-config';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Bot,
  Sparkles,
  Zap,
  AlertCircle,
  ChevronRight,
  Shield,
  Briefcase,
  TrendingUp,
  FileText,
  Phone,
  X,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { api } from '../../utils/api';
import { useQuery } from '@tanstack/react-query';
import { vascoKeys } from '../../utils/queryKeys';
import { toast } from 'sonner@2.0.3';
import { ConfirmDialog } from '../admin/modules/publications/components/ConfirmDialog';
import { PortalPageHeader } from '../portal/PortalPageHeader';
import { ACTIVE_THEME } from '../portal/portal-theme';
import {
  VascoAvatar,
  VascoInlineChatCard,
  useVascoStream,
} from '../shared/vasco-chat';
import type { VascoChatMessageType as Message, VascoCitation } from '../shared/vasco-chat';

const SUGGESTED_PROMPTS = [
  'How much life cover do I need?',
  'Explain retirement annuities',
  'Am I saving enough for retirement?',
  'How does estate duty work in SA?',
];

const VASCO_WELCOME: Message = {
  role: 'assistant',
  content: `Welcome aboard! I'm **Vasco**, your AI financial navigator at Navigate Wealth.

I can help you chart a course through financial concepts, retirement planning, risk management, tax strategies, and more — all tailored to the South African context.

**Here's what I can help with:**
- Explaining financial products and concepts
- General retirement and savings guidance
- Understanding tax implications
- Rough financial illustrations and calculations
- Learning about Navigate Wealth's services

Pick a topic from the sidebar or ask me anything to get started!`,
  timestamp: new Date(),
};

function isWelcomeMessage(message: Message) {
  return message.role === 'assistant' && message.content === VASCO_WELCOME.content;
}

function HandoffModal({
  open,
  onClose,
  sessionId,
  conversationSummary,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
  conversationSummary: string;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !topic.trim()) return;

    setSubmitting(true);
    try {
      await api.post('/vasco/handoff', {
        sessionId: sessionId || 'unknown',
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        topic: topic.trim(),
        conversationSummary,
      });
      setSubmitted(true);
      toast.success('Request submitted! An adviser will be in touch within 24 hours.');
    } catch (err) {
      console.error('Handoff submission error:', err);
      toast.error('Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        {submitted ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Request Submitted</h3>
            <p className="mb-6 text-sm text-gray-500">
              A Navigate Wealth adviser will be in touch within 24 hours to discuss your financial
              needs.
            </p>
            <Button onClick={onClose} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Back to Chat
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#4c1d95]">
                <Phone className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Talk to an Adviser</h3>
                <p className="text-xs text-gray-500">
                  Get personalised guidance from a qualified financial adviser
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="handoff-name" className="text-sm font-medium text-gray-700">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="handoff-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., John Smith"
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="handoff-email" className="text-sm font-medium text-gray-700">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="handoff-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g., john@example.com"
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="handoff-phone" className="text-sm font-medium text-gray-700">
                  Phone (optional)
                </Label>
                <Input
                  id="handoff-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g., 082 123 4567"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="handoff-topic" className="text-sm font-medium text-gray-700">
                  What would you like to discuss? <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="handoff-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Retirement planning review"
                  required
                  className="h-10"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting || !name.trim() || !email.trim() || !topic.trim()}
                className="h-11 w-full bg-primary font-medium text-primary-foreground hover:bg-primary/90"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Request Callback'
                )}
              </Button>

              <p className="text-center text-[10px] text-gray-400">
                Your information will be shared with Navigate Wealth&apos;s advisory team only.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export function AskVascoPage() {
  const seoData = getSEOData('ask-vasco');
  const [messages, setMessages] = useState<Message[]>([VASCO_WELCOME]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('vasco_session_id');
    } catch {
      return null;
    }
  });
  const [remaining, setRemaining] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);

  const { streamingContent, isStreaming, sendStream } = useVascoStream({
    endpoint: '/vasco/chat/stream',
  });

  const { data: vascoStatus, isLoading: statusLoading } = useQuery({
    queryKey: vascoKeys.status(),
    queryFn: () => api.get<{ enabled: boolean }>('/vasco/status'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const isEnabled = vascoStatus?.enabled ?? true;
  const isDisabled = !statusLoading && vascoStatus !== undefined && !isEnabled;

  useEffect(() => {
    try {
      const savedSession = localStorage.getItem('vasco_session_messages');
      const savedSessionId = localStorage.getItem('vasco_session_id');
      if (savedSession && savedSessionId) {
        const parsed = JSON.parse(savedSession) as Array<{
          role: 'user' | 'assistant';
          content: string;
          timestamp: string;
          citations?: VascoCitation[];
        }>;
        if (parsed.length > 0) {
          setMessages([
            VASCO_WELCOME,
            ...parsed.map((m) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            })),
          ]);
          setSessionId(savedSessionId);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    if (sessionId && messages.length > 1) {
      try {
        const toSave = messages
          .filter((m) => !isWelcomeMessage(m))
          .map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp.toISOString(),
            citations: m.citations,
          }));
        localStorage.setItem('vasco_session_messages', JSON.stringify(toSave));
        localStorage.setItem('vasco_session_id', sessionId);
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [messages, sessionId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const conversationSummary = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .slice(-5)
    .join(' | ');

  const sendMessage = useCallback(
    async (preset?: string) => {
      const content = (preset || input).trim();
      if (!content || isStreaming) return;

      setError(null);

      const userMessage: Message = {
        role: 'user',
        content,
        timestamp: new Date(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput('');

      try {
        const chatHistory = updatedMessages
          .filter((m) => !isWelcomeMessage(m))
          .map((m) => ({ role: m.role, content: m.content }));

        const result = await sendStream(chatHistory, sessionId);

        const assistantMessage: Message = {
          role: 'assistant',
          content: result.content,
          timestamp: new Date(),
          citations: result.citations.length > 0 ? result.citations : undefined,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        if (result.sessionId) {
          setSessionId(result.sessionId);
        }
        if (typeof result.remaining === 'number') {
          setRemaining(result.remaining);
        }
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : 'I apologise, but I encountered a temporary issue. Please try again.';
        setError(errorMsg);
        toast.error(errorMsg);
      }
    },
    [input, isStreaming, messages, sendStream, sessionId],
  );

  const handleFeedback = useCallback(
    async (messageIndex: number, rating: 'positive' | 'negative') => {
      const message = messages[messageIndex];
      if (!message || message.role !== 'assistant' || message.feedback || isWelcomeMessage(message)) {
        return;
      }

      setMessages((prev) =>
        prev.map((m, i) => (i === messageIndex ? { ...m, feedback: rating } : m)),
      );

      try {
        await api.post('/vasco/feedback', {
          sessionId: sessionId || 'unknown',
          messageContent: message.content,
          rating,
        });
      } catch (err) {
        console.error('Failed to submit feedback:', err);
      }
    },
    [messages, sessionId],
  );

  const performClearChat = () => {
    setMessages([VASCO_WELCOME]);
    setInput('');
    setError(null);
    setSessionId(null);
    setRemaining(null);
    setShowHandoff(false);
    try {
      localStorage.removeItem('vasco_session_messages');
      localStorage.removeItem('vasco_session_id');
    } catch {
      // Ignore localStorage errors
    }
  };

  const userMessageCount = messages.filter((m) => m.role === 'user').length;

  if (isDisabled) {
    return (
      <div className="contents">
        <SEO
          {...seoData}
          structuredData={createWebPageSchema(seoData.title, seoData.description, seoData.canonicalUrl)}
        />
        <div
          className={`flex min-h-[60vh] items-center justify-center px-4 ${
            ACTIVE_THEME === 'branded' ? 'bg-[#f8f9fb]' : 'bg-[rgb(249,249,249)]'
          }`}
        >
          <div className="max-w-md text-center">
            <div className="flex justify-center">
              <VascoAvatar size="xl" />
            </div>
            <h1 className="mb-3 mt-8 text-2xl font-extrabold tracking-tight text-gray-900">
              Vasco is Coming Soon
            </h1>
            <p className="mb-8 text-sm leading-relaxed text-gray-600">
              Our AI financial navigator is being prepared for launch. In the meantime, explore our
              services or get in touch with our team.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild className="bg-primary px-6 text-primary-foreground hover:bg-primary/90">
                <Link to="/services">Explore Services</Link>
              </Button>
              <Button asChild variant="outline" className="px-6">
                <Link to="/contact">Contact Us</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="contents">
      <SEO
        {...seoData}
        structuredData={createWebPageSchema(seoData.title, seoData.description, seoData.canonicalUrl)}
      />
      <div
        className={`min-h-screen ${
          ACTIVE_THEME === 'branded' ? 'bg-[#f8f9fb]' : 'bg-[rgb(249,249,249)]'
        }`}
      >
        <PortalPageHeader
          title="Ask Vasco"
          subtitle="Your AI-powered financial navigator — explore South African finance with no login required"
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
                    planning philosophy. Ask about retirement, tax, risk cover, estate planning, and
                    our services — no account needed.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="border-gray-200 bg-white/50 text-gray-600">
                      24/7 Support
                    </Badge>
                    <Badge variant="secondary" className="border-gray-200 bg-white/50 text-gray-600">
                      No Login
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
                        onClick={() => void sendMessage(prompt)}
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

              <Button
                onClick={() => setShowHandoff(true)}
                variant="outline"
                className="w-full border-primary/30 text-primary hover:bg-purple-50"
              >
                <Phone className="mr-2 h-4 w-4" />
                Talk to an Adviser
              </Button>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-2 flex gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  <h4 className="text-xs font-semibold text-gray-700">Disclaimer</h4>
                </div>
                <p className="text-[11px] leading-relaxed text-gray-500">
                  Vasco is an AI-powered experimental tool and is not a licensed financial adviser.
                  Nothing in this conversation constitutes formal financial advice, a recommendation,
                  or an offer to buy or sell any financial product.
                </p>
              </div>
            </div>

            <div className="lg:col-span-3">
              <VascoInlineChatCard
                sessionTitle="Ask Vasco"
                sessionSubtitle="AI Financial Navigator · No login required"
                messages={messages}
                input={input}
                error={error}
                isLoading={isStreaming}
                streamingContent={streamingContent}
                onInputChange={setInput}
                onSendMessage={() => void sendMessage()}
                onClear={() => setShowClearConfirm(true)}
                showNewChat={false}
                showExpand={false}
                disableActions={isStreaming}
                isWelcomeMessage={isWelcomeMessage}
                onFeedback={handleFeedback}
                headerExtra={
                  remaining !== null && remaining < 10 ? (
                    <span className="text-xs font-medium text-amber-600">{remaining} messages left</span>
                  ) : null
                }
                inputPlaceholder="Ask Vasco about financial planning, retirement, tax, or try a calculation..."
                inputFooter={
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-center text-[10px] text-gray-400">
                      Vasco provides general financial information only — not personal financial advice.
                    </p>
                    <Link
                      to="/signup"
                      className="flex-shrink-0 text-[10px] font-medium text-primary hover:underline"
                    >
                      Sign up for personalised guidance →
                    </Link>
                  </div>
                }
                beforeInput={
                  userMessageCount >= 4 && !showHandoff ? (
                    <div className="mx-6 mb-2 flex items-center justify-between gap-3 rounded-xl border border-purple-100 bg-gradient-to-r from-purple-50 to-purple-100/50 p-3">
                      <p className="min-w-0 truncate text-xs text-gray-700">
                        Want personalised advice?{' '}
                        <span className="font-medium text-primary">Talk to a qualified adviser.</span>
                      </p>
                      <Button
                        onClick={() => setShowHandoff(true)}
                        size="sm"
                        className="h-7 flex-shrink-0 bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
                      >
                        Get in Touch
                      </Button>
                    </div>
                  ) : undefined
                }
              />
            </div>
          </div>
        </div>
      </div>

      <HandoffModal
        open={showHandoff}
        onClose={() => setShowHandoff(false)}
        sessionId={sessionId}
        conversationSummary={conversationSummary}
      />

      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => {
          setShowClearConfirm(false);
          performClearChat();
        }}
        title="Clear conversation?"
        description="Are you sure you want to clear this Ask Vasco conversation? This will reset the session and cannot be undone."
        confirmLabel="Clear chat"
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  );
}

export default AskVascoPage;
