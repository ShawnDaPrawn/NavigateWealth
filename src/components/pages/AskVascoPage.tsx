/**
 * AskVascoPage — Public AI Financial Navigator
 *
 * Full-page experience for the logged-out "Ask Vasco" chatbot.
 * Vasco is Navigate Wealth's public-facing AI financial guide,
 * named after Vasco Da Gama — linking the "Navigate" brand to
 * the spirit of Portuguese exploration and financial discovery.
 *
 * Design:
 *   - Matches Navigate Wealth website UI standards (dark hero, section-white, etc.)
 *   - Nautical theme — compass rose, wave patterns, maritime motifs
 *   - FAIS compliance disclaimer
 *
 * Features:
 *   - Hero section with branding + suggested starters
 *   - Full chat UI with message bubbles + typing indicator
 *   - RAG-powered citation rendering (article pills)
 *   - Thumbs up/down feedback per message
 *   - Adviser handoff modal (lead capture)
 *   - Session-only memory with rate-limit awareness
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { Button } from '../ui/button';
import { SEO, createWebPageSchema } from '../seo/SEO';
import { getSEOData } from '../seo/seo-config';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Compass,
  Send,
  Loader2,
  Trash2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Shield,
  Target,
  TrendingUp,
  Calculator,
  Heart,
  Users,
  Briefcase,
  Sparkles,
  MessageSquare,
  Phone,
  X,
  CheckCircle,
  Anchor,
  Navigation,
  Globe,
  Star,
  Info,
} from 'lucide-react';
import { api } from '../../utils/api';
import { useQuery } from '@tanstack/react-query';
import { vascoKeys } from '../../utils/queryKeys';
import { toast } from 'sonner@2.0.3';
import { ConfirmDialog } from '../admin/modules/publications/components/ConfirmDialog';

// Shared Vasco chat components
import {
  VascoAvatar,
  VascoChatMessage,
  VascoTypingIndicator,
  VascoStreamingBubble,
  useVascoStream,
} from '../shared/vasco-chat';
import type { VascoChatMessageType, VascoCitation } from '../shared/vasco-chat';

// ============================================================================
// TYPES — re-export from shared for local use
// ============================================================================

/** Local alias for the shared message type */
type Message = VascoChatMessageType;

// ============================================================================
// NAUTICAL SVG DECORATIONS
// ============================================================================

/** Inline SVG compass rose — used as a subtle background decoration */
function CompassRoseSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer ring */}
      <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />
      <circle cx="100" cy="100" r="85" stroke="currentColor" strokeWidth="0.3" opacity="0.1" />
      <circle cx="100" cy="100" r="45" stroke="currentColor" strokeWidth="0.3" opacity="0.1" />
      {/* Cardinal points */}
      <polygon points="100,5 108,85 100,75 92,85" fill="currentColor" opacity="0.2" />
      <polygon points="100,195 108,115 100,125 92,115" fill="currentColor" opacity="0.12" />
      <polygon points="5,100 85,92 75,100 85,108" fill="currentColor" opacity="0.12" />
      <polygon points="195,100 115,92 125,100 115,108" fill="currentColor" opacity="0.12" />
      {/* Intercardinal points */}
      <polygon points="30,30 88,82 80,80 82,88" fill="currentColor" opacity="0.08" />
      <polygon points="170,30 118,82 120,80 112,88" fill="currentColor" opacity="0.08" />
      <polygon points="30,170 82,118 80,120 88,112" fill="currentColor" opacity="0.08" />
      <polygon points="170,170 118,118 120,120 112,112" fill="currentColor" opacity="0.08" />
      {/* Centre dot */}
      <circle cx="100" cy="100" r="3" fill="currentColor" opacity="0.2" />
      {/* Tick marks around ring */}
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i * 22.5 * Math.PI) / 180;
        const x1 = 100 + 90 * Math.cos(angle);
        const y1 = 100 + 90 * Math.sin(angle);
        const x2 = 100 + 95 * Math.cos(angle);
        const y2 = 100 + 95 * Math.sin(angle);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth={i % 4 === 0 ? '1' : '0.5'}
            opacity={i % 4 === 0 ? '0.2' : '0.1'}
          />
        );
      })}
    </svg>
  );
}

/** Wave pattern SVG — used as section divider */
function WaveDivider({ className, flip }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 1440 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={flip ? { transform: 'scaleY(-1)' } : undefined}
    >
      <path
        d="M0,30 C240,60 480,0 720,30 C960,60 1200,0 1440,30 L1440,60 L0,60 Z"
        fill="currentColor"
        opacity="0.5"
      />
      <path
        d="M0,40 C320,60 640,20 960,40 C1280,60 1360,30 1440,40 L1440,60 L0,60 Z"
        fill="currentColor"
        opacity="0.3"
      />
    </svg>
  );
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SUGGESTED_STARTERS = [
  {
    label: 'How much life cover do I need?',
    icon: Shield,
    category: 'Risk',
  },
  {
    label: 'Explain retirement annuities',
    icon: Target,
    category: 'Retirement',
  },
  {
    label: 'Am I saving enough for retirement?',
    icon: TrendingUp,
    category: 'Savings',
  },
  {
    label: 'How does estate duty work in SA?',
    icon: Users,
    category: 'Estate',
  },
  {
    label: 'What are the tax benefits of an RA?',
    icon: Calculator,
    category: 'Tax',
  },
  {
    label: 'What does Navigate Wealth offer?',
    icon: Briefcase,
    category: 'Services',
  },
  {
    label: 'Difference between living and life annuity',
    icon: Heart,
    category: 'Retirement',
  },
  {
    label: 'If I invest R5,000/month for 25 years at 10%, what could I accumulate?',
    icon: Calculator,
    category: 'Calculator',
  },
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

Pick a heading below or ask me anything to set sail!`,
  timestamp: new Date(),
};

// VascoAvatar is imported from shared/vasco-chat

// VascoChatMessage (with copy + feedback) is imported from shared/vasco-chat

// VascoTypingIndicator is imported from shared/vasco-chat

// ============================================================================
// HANDOFF MODAL — Adviser callback request (lead capture)
// ============================================================================

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
      toast.success(
        'Request submitted! An adviser will be in touch within 24 hours.'
      );
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1"
        >
          <X className="h-5 w-5" />
        </button>

        {submitted ? (
          <div className="text-center py-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Request Submitted
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              A Navigate Wealth adviser will be in touch within 24 hours to
              discuss your financial needs.
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
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-[#4c1d95] flex items-center justify-center">
                <Phone className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Talk to an Adviser
                </h3>
                <p className="text-xs text-gray-500">
                  Get personalised guidance from a qualified financial adviser
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="handoff-name"
                  className="text-sm font-medium text-gray-700"
                >
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
                <Label
                  htmlFor="handoff-email"
                  className="text-sm font-medium text-gray-700"
                >
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
                <Label
                  htmlFor="handoff-phone"
                  className="text-sm font-medium text-gray-700"
                >
                  Phone (optional)
                </Label>
                <Input
                  id="handoff-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g., 082 123 4567"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="handoff-topic"
                  className="text-sm font-medium text-gray-700"
                >
                  What would you like to discuss?{' '}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="handoff-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Retirement planning, life cover review"
                  required
                  className="h-10"
                />
              </div>

              <Button
                type="submit"
                disabled={
                  submitting ||
                  !name.trim() ||
                  !email.trim() ||
                  !topic.trim()
                }
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 font-medium"
              >
                {submitting ? (
                  <div className="contents">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </div>
                ) : (
                  'Request Callback'
                )}
              </Button>

              <p className="text-[10px] text-gray-400 text-center">
                Your information will be shared with Navigate Wealth's advisory
                team only.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export function AskVascoPage() {
  const seoData = getSEOData('ask-vasco');
  const [messages, setMessages] = useState<Message[]>([VASCO_WELCOME]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    // Restore session ID from localStorage if available
    try {
      return localStorage.getItem('vasco_session_id');
    } catch {
      return null;
    }
  });
  const [remaining, setRemaining] = useState<number | null>(null);
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  // SSE streaming hook
  const { streamingContent, isStreaming, sendStream } = useVascoStream({
    endpoint: '/vasco/chat/stream',
  });

  // Derive loading state from streaming
  const isLoading = isStreaming;

  // Check if Vasco is enabled
  const { data: vascoStatus, isLoading: statusLoading } = useQuery({
    queryKey: vascoKeys.status(),
    queryFn: () => api.get<{ enabled: boolean }>('/vasco/status'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const isEnabled = vascoStatus?.enabled ?? true;
  const isDisabled = !statusLoading && vascoStatus !== undefined && !isEnabled;

  // Restore session from localStorage on mount
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
          const restored: Message[] = [
            VASCO_WELCOME,
            ...parsed.map((m) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            })),
          ];
          setMessages(restored);
          setSessionId(savedSessionId);
          setHasStartedChat(true);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (sessionId && messages.length > 1) {
      try {
        const toSave = messages
          .filter((m) => m !== VASCO_WELCOME)
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

  // Scroll to bottom when messages change or streaming content updates
  useEffect(() => {
    if (hasStartedChat && chatContainerRef.current) {
      const container = chatContainerRef.current;
      requestAnimationFrame(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: messages.length <= 1 ? 'instant' : 'smooth',
        });
      });
    }
  }, [messages, isLoading, hasStartedChat, streamingContent]);

  // Build conversation summary for handoff
  const conversationSummary = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .slice(-5)
    .join(' | ');

  // Send message handler — uses shared useVascoStream hook for SSE streaming
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      setError(null);
      setHasStartedChat(true);

      const userMessage: Message = {
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput('');

      try {
        const chatHistory = updatedMessages
          .filter((m) => m !== VASCO_WELCOME)
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
        const errorMessage: Message = {
          role: 'assistant',
          content: errorMsg,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    },
    [messages, isLoading, sessionId, sendStream]
  );

  // Feedback handler
  const handleFeedback = useCallback(
    async (messageIndex: number, rating: 'positive' | 'negative') => {
      const message = messages[messageIndex];
      if (!message || message.role !== 'assistant' || message.feedback) return;

      setMessages((prev) =>
        prev.map((m, i) =>
          i === messageIndex ? { ...m, feedback: rating } : m
        )
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
    [messages, sessionId]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const performClearChat = () => {
    setMessages([VASCO_WELCOME]);
    setInput('');
    setError(null);
    setSessionId(null);
    setRemaining(null);
    // Keep user in the conversation view; clearing should reset messages/session only.
    setHasStartedChat(true);
    setShowHandoff(false);
    // Clear persisted session
    try {
      localStorage.removeItem('vasco_session_messages');
      localStorage.removeItem('vasco_session_id');
    } catch {
      // Ignore localStorage errors
    }
  };
  const handleClearChat = () => {
    setShowClearConfirm(true);
  };

  // ── Disabled state ─────────────────────────────────────────────
  if (isDisabled) {
    return (
      <div className="contents">
        <SEO
          {...seoData}
          structuredData={createWebPageSchema(seoData.title, seoData.description, seoData.canonicalUrl)}
        />
        <div className="min-h-screen bg-[#111827] flex items-center justify-center px-4 relative overflow-hidden">
          {/* Nautical background */}
          <CompassRoseSvg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] text-white pointer-events-none" />
          <div className="text-center max-w-md relative z-10">
            <div className="flex justify-center">
              <VascoAvatar size="xl" />
            </div>
            <h1 className="!text-2xl !font-extrabold text-white mt-8 mb-3 tracking-tight">
              Vasco is Coming Soon
            </h1>
            <p className="text-sm text-gray-400 mb-8 leading-relaxed">
              Our AI financial navigator is being prepared for launch. In the
              meantime, explore our services or get in touch with our team.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                asChild
                className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 shadow-lg shadow-purple-600/20"
              >
                <Link to="/services">Explore Services</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-purple-400/30 bg-transparent text-purple-300 hover:bg-purple-500/15 hover:border-purple-400/50 hover:text-purple-200 px-6"
              >
                <Link to="/contact">Contact Us</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────
  return (
    <div className="contents">
      <SEO
        {...seoData}
        structuredData={createWebPageSchema(seoData.title, seoData.description, seoData.canonicalUrl)}
      />
      <div className="min-h-screen">
        {/* ════════════════════════════════════════════════════════════
            HERO SECTION — Nautical-themed, NW design standard
            ════════════════════════════════════════════════════════════ */}
        {!hasStartedChat && (
          <>
            <section
              className="relative overflow-hidden bg-[#111827]"
              aria-label="Ask Vasco hero"
            >
              {/* Background layers */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#111827] via-[#161b33] to-[#111827] pointer-events-none" />
              <div
                className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-25 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle, rgba(109,40,217,0.35) 0%, transparent 70%)',
                }}
              />
              <div
                className="absolute -bottom-48 -left-32 w-[450px] h-[450px] rounded-full opacity-15 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)',
                }}
              />
              {/* Nautical grid overlay */}
              <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
                  backgroundSize: '64px 64px',
                }}
              />
              {/* Compass rose decoration */}
              <CompassRoseSvg className="absolute -right-20 top-1/2 -translate-y-1/2 w-[450px] h-[450px] text-white pointer-events-none hidden lg:block" />

              <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
                <div className="max-w-3xl mx-auto text-center space-y-6">
                  {/* Badge pill */}
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08]">
                    <Compass className="h-3.5 w-3.5 text-purple-400" />
                    <span className="text-[12px] font-medium text-gray-400 tracking-wide">
                      AI Financial Navigator · Powered by Navigate Wealth
                    </span>
                  </div>

                  {/* Heading */}
                  <h1 className="!text-[clamp(2rem,5vw,3.5rem)] !font-extrabold !leading-[1.1] text-white tracking-tight">
                    Meet{' '}
                    <span className="bg-gradient-to-r from-purple-400 via-violet-300 to-indigo-400 bg-clip-text text-transparent">
                      Vasco
                    </span>
                  </h1>

                  <p className="text-gray-400 text-base lg:text-lg max-w-2xl mx-auto leading-relaxed">
                    Vasco helps you navigate the world of South African finance
                    — from retirement planning and tax strategies to risk
                    management and estate planning.
                  </p>

                  {/* Feature badges */}
                  <div className="flex flex-wrap justify-center gap-3 pt-1">
                    {[
                      {
                        icon: Anchor,
                        text: 'SA Financial Expertise',
                      },
                      {
                        icon: Navigation,
                        text: 'Available 24/7',
                      },
                      {
                        icon: Globe,
                        text: 'No Login Required',
                      },
                    ].map(({ icon: Icon, text }) => (
                      <div
                        key={text}
                        className="flex items-center gap-1.5 text-gray-500"
                      >
                        <Icon className="h-3.5 w-3.5 text-purple-400/70 flex-shrink-0" />
                        <span className="text-[11px] sm:text-xs font-medium whitespace-nowrap">
                          {text}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                    <Button
                      onClick={() => {
                        setHasStartedChat(true);
                        setTimeout(
                          () => textareaRef.current?.focus(),
                          300
                        );
                      }}
                      size="lg"
                      className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200 px-8 h-12 shadow-lg shadow-purple-600/20"
                    >
                      <MessageSquare className="h-5 w-5 mr-2" />
                      Start a Conversation
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-purple-400/30 bg-transparent text-purple-300 hover:bg-purple-500/15 hover:border-purple-400/50 hover:text-purple-200 transition-colors duration-200 px-8 h-12"
                      asChild
                    >
                      <Link to="/services">Our Services</Link>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Stats strip */}
              <div className="relative z-10 border-t border-white/[0.06]">
                <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/[0.06]">
                    {[
                      {
                        icon: Star,
                        value: '15+',
                        label: 'Years Experience',
                      },
                      {
                        icon: Globe,
                        value: '12+',
                        label: 'Product Partners',
                      },
                      {
                        icon: Heart,
                        value: '100+',
                        label: 'Happy Clients',
                      },
                      {
                        icon: TrendingUp,
                        value: 'R500M+',
                        label: 'Assets Under Advice',
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="flex items-center gap-3 py-6 lg:py-7 justify-center group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-purple-500/[0.08] flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/[0.14] transition-colors">
                          <stat.icon className="h-[18px] w-[18px] text-purple-400/80" />
                        </div>
                        <div>
                          <div className="text-lg sm:text-xl font-bold text-white tracking-tight leading-none">
                            {stat.value}
                          </div>
                          <div className="text-[11px] text-gray-500 font-medium mt-0.5">
                            {stat.label}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Wave transition from hero to white section */}
            <div className="relative -mt-px">
              <WaveDivider className="w-full h-[40px] text-[#111827] relative z-10" flip />
            </div>

            {/* ══════════════════════════════════════════════════════
                SUGGESTED STARTERS — White section, NW card pattern
                ══════════════════════════════════════════════════════ */}
            <section className="py-16 lg:py-20 section-white" aria-label="Topics">
              <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12 lg:mb-14">
                  <h2 className="text-black mb-4">
                    What can Vasco help with?
                  </h2>
                  <p className="text-gray-600 max-w-2xl mx-auto text-base lg:text-lg">
                    Select a topic to begin, or ask anything about South African
                    finance.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
                  {SUGGESTED_STARTERS.map((starter, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setHasStartedChat(true);
                        setTimeout(() => sendMessage(starter.label), 100);
                      }}
                      className="group flex flex-col p-5 rounded-xl border border-gray-200 bg-white hover:shadow-xl hover:border-primary/30 transition-all duration-300 text-left relative overflow-hidden"
                    >
                      {/* Subtle compass corner decoration */}
                      <Compass className="absolute -bottom-3 -right-3 h-16 w-16 text-gray-100 group-hover:text-purple-50 transition-colors pointer-events-none" />
                      <div className="relative z-10 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-100 transition-colors">
                            <starter.icon className="h-4 w-4 text-primary" />
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 text-gray-400 border-gray-200 font-medium"
                          >
                            {starter.category}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-gray-700 group-hover:text-primary transition-colors leading-snug pr-4">
                          {starter.label}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-primary transition-colors">
                          <span>Ask Vasco</span>
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                CTA SECTION — Dark, matches NW pattern
                ══════════════════════════════════════════════════════ */}
            <section className="relative overflow-hidden bg-[#111827]" aria-label="Get started">
              {/* Nautical decoration */}
              <CompassRoseSvg className="absolute left-8 top-1/2 -translate-y-1/2 w-[250px] h-[250px] text-white pointer-events-none hidden lg:block" />
              <div
                className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full opacity-15 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle, rgba(109,40,217,0.3) 0%, transparent 70%)',
                }}
              />

              <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 text-center">
                <Anchor className="h-6 w-6 text-purple-400/60 mx-auto mb-4" />
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs font-medium text-gray-300">Free initial consultation</span>
                  </div>
                  <h2 className="!text-[28px] sm:!text-[32px] !font-bold !leading-tight text-white">
                    Ready for personalised guidance?
                  </h2>
                  <p className="text-gray-400 text-base max-w-xl mx-auto leading-relaxed">
                    Sign up to unlock Vasco's full potential — with access to your
                    financial data, personalised recommendations, and a complete
                    Financial Needs Analysis.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
                  <Button
                    asChild
                    size="lg"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 h-12 shadow-lg shadow-purple-600/20"
                  >
                    <Link to="/signup">
                      Get Started
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="border-purple-400/30 bg-transparent text-purple-300 hover:bg-purple-500/15 hover:border-purple-400/50 hover:text-purple-200 px-8 h-12"
                  >
                    <Link to="/about">Learn More About Us</Link>
                  </Button>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════
            CHAT INTERFACE
            ════════════════════════════════════════════════════════════ */}
        {hasStartedChat && (
          <div
            className="max-w-screen-2xl mx-auto flex flex-col px-4 sm:px-6 lg:px-8 xl:px-12"
            style={{ height: 'calc(100vh - 64px)' }}
          >
            {/* Experimental Disclaimer Banner */}
            {showDisclaimer && (
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl mt-3 mb-0">
                <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <span className="font-semibold">Experimental Tool Disclaimer:</span>{' '}
                    Vasco is an AI-powered experimental tool and is not a licensed financial adviser.
                    Nothing in this conversation constitutes formal financial advice, a recommendation,
                    or an offer to buy or sell any financial product. Always consult a qualified,
                    FAIS-accredited financial adviser before making financial decisions.
                  </p>
                </div>
                <button
                  onClick={() => setShowDisclaimer(false)}
                  className="text-amber-400 hover:text-amber-600 p-0.5 flex-shrink-0"
                  aria-label="Dismiss disclaimer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Chat Header — nautical-themed */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200 bg-white mt-1">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClearChat}
                  className="flex items-center gap-1.5 text-gray-500 hover:text-primary transition-colors group"
                  title="Back to Meet Vasco"
                >
                  <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                </button>
                <VascoAvatar size="sm" />
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Vasco
                  </h2>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    AI Financial Navigator
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {remaining !== null && remaining < 10 && (
                  <span className="text-xs text-amber-600 font-medium">
                    {remaining} messages remaining
                  </span>
                )}
                <Button
                  onClick={() => setShowHandoff(true)}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 border-primary/30 text-primary hover:bg-purple-50 hover:border-primary hidden sm:inline-flex"
                >
                  <Phone className="h-3.5 w-3.5 mr-1.5" />
                  Talk to an Adviser
                </Button>
                <Button
                  onClick={() => setShowHandoff(true)}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 w-8 p-0 border-primary/30 text-primary hover:bg-purple-50 hover:border-primary sm:hidden"
                  title="Talk to an Adviser"
                >
                  <Phone className="h-3.5 w-3.5" />
                </Button>
                <Button
                  onClick={handleClearChat}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                  title="Clear conversation"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages Area — light gray bg for contrast */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto py-6 space-y-5 bg-gray-50/50"
            >
              {messages.map((message, index) => (
                <VascoChatMessage
                  key={index}
                  message={message}
                  isWelcome={message === VASCO_WELCOME}
                  onFeedback={
                    message.role === 'assistant' &&
                    message !== VASCO_WELCOME
                      ? (rating) => handleFeedback(index, rating)
                      : undefined
                  }
                />
              ))}
              {/* Streaming response — shows real-time content as it arrives */}
              {isLoading && streamingContent && (
                <VascoStreamingBubble content={streamingContent} />
              )}
              {/* Typing indicator — shown before streaming starts */}
              {isLoading && !streamingContent && <VascoTypingIndicator />}
            </div>

            {/* Suggested Starter Pills (compact — shown in chat view) */}
            {messages.length <= 1 && (
              <div className="px-4 sm:px-6 pb-2 bg-gray-50/50">
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_STARTERS.slice(0, 4).map((starter, index) => (
                    <button
                      key={index}
                      onClick={() => sendMessage(starter.label)}
                      disabled={isLoading}
                      className="text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary hover:bg-purple-50 transition-colors shadow-xs"
                    >
                      {starter.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Handoff CTA banner — shows after 4+ messages */}
            {messages.filter((m) => m.role === 'user').length >= 4 &&
              !showHandoff && (
                <div className="mx-4 sm:mx-6 mb-2 p-3 rounded-xl bg-gradient-to-r from-purple-50 to-purple-100/50 border border-purple-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Anchor className="h-4 w-4 text-primary flex-shrink-0" />
                    <p className="text-xs text-gray-700 truncate">
                      Want personalised advice?{' '}
                      <span className="font-medium text-primary">
                        Drop anchor and talk to a qualified adviser.
                      </span>
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowHandoff(true)}
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-7 px-3 flex-shrink-0"
                  >
                    Get in Touch
                  </Button>
                </div>
              )}

            {/* Input Area */}
            <div className="px-4 sm:px-6 py-4 border-t border-gray-200 bg-white">
              {error && (
                <Alert className="mb-3 border-amber-200 bg-amber-50 py-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 text-xs">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Vasco about financial planning, retirement, tax, or try a calculation..."
                  className="min-h-[55px] max-h-[120px] pr-14 resize-none py-3.5 px-4 rounded-xl border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary bg-gray-50 text-sm"
                  disabled={isLoading}
                />
                <Button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 bottom-2 h-9 w-9 p-0 rounded-lg bg-primary hover:bg-primary/90 shadow-sm transition-all"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <Send className="h-4 w-4 text-white ml-0.5" />
                  )}
                </Button>
              </div>

              {/* Disclaimer + CTA footer */}
              <div className="flex items-center justify-between mt-2 px-1">
                <p className="text-[10px] text-gray-400">
                  Vasco provides general financial information only — not
                  personal financial advice.
                </p>
                <Link
                  to="/signup"
                  className="text-[10px] text-primary hover:underline font-medium flex-shrink-0 ml-4"
                >
                  Sign up for personalised guidance →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Handoff Modal */}
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
