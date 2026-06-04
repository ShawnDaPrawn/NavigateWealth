/**
 * AskVascoPage — Public AI Financial Navigator
 *
 * Logged-out Ask Vasco experience aligned with the client portal AI Advisor UI.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../ui/button';
import { SEO, createWebPageSchema } from '../seo/SEO';
import { getSEOData } from '../seo/seo-config';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
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
  Compass,
} from 'lucide-react';
import { api } from '../../utils/api';
import { useQuery } from '@tanstack/react-query';
import { vascoKeys } from '../../utils/queryKeys';
import { toast } from 'sonner';
import { ConfirmDialog } from '../admin/modules/publications/components/ConfirmDialog';
import { PortalPageHeader } from '../portal/PortalPageHeader';
import { ACTIVE_THEME } from '../portal/portal-theme';
import {
  VascoAvatar,
  VascoInlineChatCard,
  VascoStreamError,
  useVascoStream,
} from '../shared/vasco-chat';
import type { VascoChatMessageType as Message, VascoCitation } from '../shared/vasco-chat';

const SUGGESTED_PROMPTS = [
  'How much life cover do I need?',
  'Explain retirement annuities',
  'Am I saving enough for retirement?',
  'How does estate duty work in SA?',
];

const VASCO_VISITOR_ID_KEY = 'vasco_visitor_id';

function getOrCreateVascoVisitorId() {
  try {
    const existing = localStorage.getItem(VASCO_VISITOR_ID_KEY);
    if (existing) return existing;

    const generated =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(VASCO_VISITOR_ID_KEY, generated);
    return generated;
  } catch {
    return 'anonymous';
  }
}

const VASCO_WELCOME: Message = {
  role: 'assistant',
  content: `Welcome! I'm **Vasco**, your AI financial navigator at Navigate Wealth.

I can help you explore financial concepts, retirement planning, risk management, tax strategies, and more — all tailored to the South African context.

**Here's what I can help with:**
- Explaining financial products and concepts
- General retirement and savings guidance
- Understanding tax implications
- Rough financial illustrations and calculations
- Learning about Navigate Wealth's services

Tap a suggested topic or ask me anything to get started!`,
  timestamp: new Date(),
};

function isWelcomeMessage(message: Message) {
  return message.role === 'assistant' && message.content === VASCO_WELCOME.content;
}

/** Visible, focusable elements within a container — used to trap focus in the expanded chat dialog. */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => el.offsetParent !== null,
  );
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
            <Button
              onClick={onClose}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
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
  const [limitReached, setLimitReached] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const expandedChatRef = useRef<HTMLDivElement>(null);
  const [visitorId] = useState(getOrCreateVascoVisitorId);

  // When a child modal (adviser handoff / clear-confirm) is open over the
  // expanded chat, suspend the dialog focus trap and Escape-to-collapse so the
  // modal can own keyboard focus. Mirrored to a ref for use inside listeners.
  const childModalOpen = showHandoff || showClearConfirm;
  const childModalOpenRef = useRef(childModalOpen);
  childModalOpenRef.current = childModalOpen;
  const vascoExtraBody = useMemo(() => ({ visitorId }), [visitorId]);

  const { streamingContent, isStreaming, sendStream } = useVascoStream({
    endpoint: '/vasco/chat/stream',
    extraBody: vascoExtraBody,
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

  // Focused (expanded) mode: behave like a modal dialog — lock background
  // scroll, move focus into the dialog, restore it on close, and allow Escape.
  useEffect(() => {
    if (!isExpanded) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog (prefer the message input).
    const raf = requestAnimationFrame(() => {
      const container = expandedChatRef.current;
      if (!container) return;
      const target =
        container.querySelector<HTMLElement>('textarea:not([disabled])') ??
        getFocusableElements(container)[0] ??
        container;
      target.focus();
    });

    const handleKey = (e: KeyboardEvent) => {
      // Let an open child modal handle Escape itself rather than collapsing the chat.
      if (e.key === 'Escape' && !childModalOpenRef.current) setIsExpanded(false);
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
      // Return focus to the control that opened the dialog.
      previouslyFocused?.focus?.();
    };
  }, [isExpanded]);

  // Keep keyboard focus within the expanded chat dialog (Tab / Shift+Tab wrap).
  const handleDialogKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    // A child modal is open over the chat — let it manage its own focus.
    if (childModalOpenRef.current) return;
    const container = expandedChatRef.current;
    if (!container) return;
    const focusables = getFocusableElements(container);
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !container.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !container.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const conversationSummary = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .slice(-5)
    .join(' | ');

  const sendMessage = useCallback(
    async (preset?: string) => {
      const content = (preset || input).trim();
      if (!content || isStreaming || limitReached) return;

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
          setLimitReached(result.remaining <= 0);
        }
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : 'I apologise, but I encountered a temporary issue. Please try again.';
        if (err instanceof VascoStreamError && err.limitReached) {
          setRemaining(err.remaining ?? 0);
          setLimitReached(true);
        }
        setError(errorMsg);
        toast.error(errorMsg);
      }
    },
    [input, isStreaming, limitReached, messages, sendStream, sessionId],
  );

  const handleFeedback = useCallback(
    async (messageIndex: number, rating: 'positive' | 'negative') => {
      const message = messages[messageIndex];
      if (
        !message ||
        message.role !== 'assistant' ||
        message.feedback ||
        isWelcomeMessage(message)
      ) {
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
    setLimitReached(false);
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
          structuredData={createWebPageSchema(
            seoData.title,
            seoData.description,
            seoData.canonicalUrl,
          )}
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
              <Button
                asChild
                className="bg-primary px-6 text-primary-foreground hover:bg-primary/90"
              >
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
        structuredData={createWebPageSchema(
          seoData.title,
          seoData.description,
          seoData.canonicalUrl,
        )}
      />
      <div
        className={`relative min-h-screen overflow-hidden ${
          ACTIVE_THEME === 'branded' ? 'bg-[#f8f9fb]' : 'bg-[rgb(249,249,249)]'
        }`}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_28%_12%,rgba(109,40,217,0.10),transparent_34%),radial-gradient(circle_at_72%_0%,rgba(14,165,233,0.08),transparent_32%)]" />
          <div className="absolute right-[-90px] top-28 h-72 w-72 rounded-full border border-[#c4b5fd]/30" />
          <div className="absolute right-[-42px] top-40 h-48 w-48 rounded-full border border-[#6d28d9]/10" />
          <div className="absolute left-4 top-64 h-px w-80 rotate-[-12deg] bg-gradient-to-r from-transparent via-[#8b5cf6]/25 to-transparent" />
          <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(26,30,54,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(26,30,54,0.8)_1px,transparent_1px)] [background-size:48px_48px]" />
        </div>

        <PortalPageHeader
          title="Ask Vasco"
          subtitle="Your AI-powered financial navigator — explore South African finance with no login required"
          icon={Sparkles}
          compact
        />

        <div className="relative z-10 mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            <div className="order-2 space-y-6 lg:order-1 lg:col-span-1">
              <Card className="relative hidden overflow-hidden border-[#ddd6fe]/80 bg-gradient-to-br from-white via-[#f5f3ff] to-white shadow-sm lg:block">
                <div
                  aria-hidden="true"
                  className="absolute -right-10 -top-10 h-28 w-28 rounded-full border border-[#c4b5fd]/40"
                />
                <div
                  aria-hidden="true"
                  className="absolute -right-4 top-6 h-16 w-16 rounded-full border border-[#6d28d9]/10"
                />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Compass className="h-4 w-4 text-[#6d28d9]" />
                    About Vasco
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-relaxed text-gray-600">
                    Vasco is trained on South African financial regulations and Navigate
                    Wealth&apos;s planning philosophy. Ask about retirement, tax, risk cover, estate
                    planning, and our services — no account needed.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="secondary"
                      className="border-[#ddd6fe]/80 bg-white/70 text-gray-600"
                    >
                      24/7 Support
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="border-[#ddd6fe]/80 bg-white/70 text-gray-600"
                    >
                      No Login
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="border-[#ddd6fe]/80 bg-white/70 text-gray-600"
                    >
                      Focused Scope
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="hidden border-gray-200/80 bg-white/90 shadow-sm backdrop-blur lg:block">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Zap className="h-4 w-4 text-[#6d28d9]" />
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
                        className="group flex w-full items-center justify-between rounded-lg border border-gray-100 bg-white p-2.5 text-left text-xs text-gray-600 shadow-sm transition-colors hover:border-[#c4b5fd] hover:bg-[#f5f3ff] hover:text-[#1a1e36]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#6d28d9]" />
                          <span className="truncate">{prompt}</span>
                        </span>
                        <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="hidden border-gray-200/80 bg-white/90 shadow-sm backdrop-blur lg:block">
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
                    <div
                      key={capability.name}
                      className="flex items-center gap-3 text-sm text-gray-600"
                    >
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[#ddd6fe]/80 bg-[#f5f3ff]">
                        <capability.icon className="h-4 w-4 text-[#6d28d9]" />
                      </div>
                      <span>{capability.name}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Button
                onClick={() => setShowHandoff(true)}
                variant="outline"
                className="w-full border-primary/25 bg-white/80 text-primary shadow-sm hover:bg-purple-50"
              >
                <Phone className="mr-2 h-4 w-4" />
                Talk to an Adviser
              </Button>

              <div className="rounded-lg border border-gray-200/80 bg-white/75 p-4 shadow-sm backdrop-blur">
                <div className="mb-2 flex gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  <h4 className="text-xs font-semibold text-gray-700">Disclaimer</h4>
                </div>
                <p className="text-[11px] leading-relaxed text-gray-500">
                  Vasco is an AI-powered experimental tool and is not a licensed financial adviser.
                  Nothing in this conversation constitutes formal financial advice, a
                  recommendation, or an offer to buy or sell any financial product.
                </p>
              </div>
            </div>

            <div className="order-1 lg:order-2 lg:col-span-3">
              {isExpanded && (
                <div
                  className="fixed inset-0 z-40 bg-[#1a1e36]/40 backdrop-blur-sm"
                  onClick={() => setIsExpanded(false)}
                  aria-hidden="true"
                />
              )}
              <div
                ref={expandedChatRef}
                role={isExpanded ? 'dialog' : undefined}
                aria-modal={isExpanded ? true : undefined}
                aria-label={isExpanded ? 'Ask Vasco chat' : undefined}
                onKeyDown={isExpanded ? handleDialogKeyDown : undefined}
                className={
                  isExpanded
                    ? 'fixed inset-0 z-50 sm:inset-6 lg:inset-x-24 xl:inset-x-44'
                    : undefined
                }
              >
                <VascoInlineChatCard
                  className={
                    isExpanded
                      ? 'h-full w-full rounded-none border-0 bg-white shadow-2xl sm:rounded-2xl sm:border'
                      : 'border-[#ddd6fe]/80 bg-white/95 shadow-[0_24px_70px_-48px_rgba(26,30,54,0.7)]'
                  }
                  shellClassName={isExpanded ? 'h-full' : undefined}
                  headerClassName="border-[#ddd6fe]/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,243,255,0.92))]"
                  messagesClassName="bg-[#f8f9fb] [background-image:linear-gradient(rgba(26,30,54,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(109,40,217,0.055)_1px,transparent_1px)] [background-size:42px_42px]"
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
                  showExpand
                  isExpanded={isExpanded}
                  onExpand={() => setIsExpanded((v) => !v)}
                  disableActions={isStreaming}
                  inputDisabled={limitReached}
                  isWelcomeMessage={isWelcomeMessage}
                  onFeedback={handleFeedback}
                  headerExtra={
                    <span className="whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      <span className="sm:hidden">
                        {limitReached
                          ? '0 left'
                          : remaining !== null
                            ? `${remaining} left`
                            : '10 free'}
                      </span>
                      <span className="hidden sm:inline">
                        {limitReached
                          ? 'Free questions used'
                          : remaining !== null
                            ? `${remaining} free questions left`
                            : '10 free questions daily'}
                      </span>
                    </span>
                  }
                  inputPlaceholder="Ask Vasco about financial planning, retirement, tax, or try a calculation..."
                  inputFooter={
                    <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-between sm:gap-4">
                      <p className="text-center text-[10px] text-gray-400 sm:text-left">
                        Vasco provides general financial information only — not personal financial
                        advice.
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
                    limitReached ? (
                      <div className="mx-6 mb-2 flex items-center justify-between gap-3 rounded-xl border border-[#ddd6fe]/80 bg-gradient-to-r from-[#f5f3ff] to-purple-50/70 p-3">
                        <p className="min-w-0 text-xs text-gray-700">
                          You have used the free public questions for now.{' '}
                          <span className="font-medium text-primary">
                            A Navigate Wealth adviser can help from here.
                          </span>
                        </p>
                        <Button
                          onClick={() => setShowHandoff(true)}
                          size="sm"
                          className="h-7 flex-shrink-0 bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
                        >
                          Get in Touch
                        </Button>
                      </div>
                    ) : userMessageCount === 0 ? (
                      <div className="px-4 pb-1 lg:hidden">
                        <p className="mb-2 px-1 text-[11px] font-medium text-gray-400">
                          Try asking
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {SUGGESTED_PROMPTS.map((prompt) => (
                            <button
                              key={prompt}
                              onClick={() => void sendMessage(prompt)}
                              disabled={isStreaming}
                              className="flex-shrink-0 whitespace-nowrap rounded-full border border-[#ddd6fe] bg-[#f5f3ff] px-3 py-1.5 text-xs font-medium text-[#6d28d9] transition-colors hover:bg-[#ede9fe] disabled:opacity-50"
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : userMessageCount >= 4 && !showHandoff ? (
                      <div className="mx-6 mb-2 flex items-center justify-between gap-3 rounded-xl border border-[#ddd6fe]/80 bg-gradient-to-r from-[#f5f3ff] to-purple-50/70 p-3">
                        <p className="min-w-0 truncate text-xs text-gray-700">
                          Want personalised advice?{' '}
                          <span className="font-medium text-primary">
                            Talk to a qualified adviser.
                          </span>
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
