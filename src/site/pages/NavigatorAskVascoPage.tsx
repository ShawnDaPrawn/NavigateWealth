/**
 * NavigatorAskVascoPage — the redesigned Ask Vasco page (/ask-vasco).
 *
 * The layout is the "Ask Vasco" board of the Website Redesign canvas. The chat
 * itself is the live page's (AskVascoPage.tsx), unchanged:
 * - the same stream hook and endpoint (useVascoStream, /vasco/chat/stream)
 *   with the same anonymous visitor id; /vasco/status for the "coming soon"
 *   switch; /vasco/feedback and /vasco/handoff with the same payloads;
 * - the same suggested prompts and welcome (askVascoData.ts), the same free
 *   question counter and limit handling, the same error messages and toasts;
 * - the same conversation kept in localStorage under the same keys, so a
 *   visitor's chat carries across both designs;
 * - the same expanded mode: a modal dialog that traps focus, locks the page
 *   behind it, closes on Escape and returns focus;
 * - the same SEO tags and JSON-LD, and every disclaimer the live page shows.
 *
 * What the board adds over the live page: a failed question can be asked
 * again from the log ("Try again"), and the composer stays usable while Vasco
 * answers, so focus is never thrown out of it.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import {
  SUGGESTED_PROMPTS,
  VASCO_WELCOME,
  getOrCreateVascoVisitorId,
  isWelcomeMessage,
} from '../../components/pages/askVascoData';
import { VascoStreamError, useVascoStream } from '../../components/shared/vasco-chat';
import type {
  VascoChatMessageType as Message,
  VascoCitation,
} from '../../components/shared/vasco-chat';
import { api } from '../../utils/api';
import { vascoKeys } from '../../utils/queryKeys';
import { VascoChat, VascoNote, type VascoCounter } from '../sections/VascoChat';
import { VascoComingSoon } from '../sections/VascoComingSoon';
import { VascoClearDialog, VascoHandoffDialog } from '../sections/VascoDialogs';
import { VascoHelp } from '../sections/VascoHelp';
import { VascoHero } from '../sections/VascoHero';
import {
  VascoAnswer,
  VascoExchange,
  VascoFailure,
  VascoPrompts,
  VascoStreaming,
  VascoThinking,
  VascoWelcome,
} from '../sections/VascoMessages';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/ask-vasco.css';

/** The live page's storage keys: one conversation across both designs. */
const SESSION_MESSAGES_KEY = 'vasco_session_messages';
const SESSION_ID_KEY = 'vasco_session_id';

/**
 * The adviser nudge appears once this many questions are asked: the board
 * shows it from the first question (the live page waits for four).
 */
const ADVICE_NUDGE_AFTER = 1;

const HAND_OFF_LABEL = 'Book a Free Consultation';

/** The live page's welcome, minus its two framing lines, as the board sets it. */
const WELCOME_LINES = VASCO_WELCOME.content.split('\n');
const WELCOME = {
  intro: WELCOME_LINES[0],
  body: WELCOME_LINES[2],
  items: WELCOME_LINES.filter((line) => line.startsWith('- ')).map((line) => line.slice(2)),
};

const DISCLAIMER =
  'Vasco is an AI-powered experimental tool and is not a licensed financial adviser. Nothing in this conversation constitutes formal financial advice, a recommendation, or an offer to buy or sell any financial product.';
const FINE_PRINT =
  'Vasco provides general financial information only — not personal financial advice.';

const GENERIC_ERROR = 'I apologise, but I encountered a temporary issue. Please try again.';

/** A conversation saved by either design: welcome excluded, as the live page saves it. */
function readSavedConversation(): Message[] {
  try {
    const saved = localStorage.getItem(SESSION_MESSAGES_KEY);
    const savedId = localStorage.getItem(SESSION_ID_KEY);
    if (!saved || !savedId) return [];
    const parsed = JSON.parse(saved) as Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
      citations?: VascoCitation[];
    }>;
    return parsed
      .map((m) => ({ ...m, timestamp: new Date(m.timestamp) }))
      .filter((m) => !isWelcomeMessage(m));
  } catch {
    return [];
  }
}

function readSavedSessionId(): string | null {
  try {
    return localStorage.getItem(SESSION_ID_KEY);
  } catch {
    return null;
  }
}

/** Visible, focusable elements within a container — the expanded dialog's focus trap. */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => el.offsetParent !== null,
  );
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** A question and what answers it, for the log's layout. */
interface Exchange {
  key: string;
  question: Message | null;
  answer: Message | null;
  answerIndex: number;
}

function toExchanges(messages: Message[]): Exchange[] {
  const out: Exchange[] = [];
  messages.forEach((message, index) => {
    const last = out[out.length - 1];
    if (message.role === 'assistant' && last && !last.answer) {
      last.answer = message;
      last.answerIndex = index;
      return;
    }
    out.push({
      key: `${message.role}-${index}-${message.timestamp.getTime()}`,
      question: message.role === 'user' ? message : null,
      answer: message.role === 'assistant' ? message : null,
      answerIndex: message.role === 'assistant' ? index : -1,
    });
  });
  return out;
}

export function NavigatorAskVascoPage() {
  const seoData = getSEOData('ask-vasco');
  // Read synchronously, so a restored conversation is part of the first
  // render and the live region does not announce it all again.
  const [messages, setMessages] = useState<Message[]>(readSavedConversation);
  const [sessionId, setSessionId] = useState<string | null>(readSavedSessionId);
  const [input, setInput] = useState('');
  /** The last question that failed, and why. Cleared by the next send, as the live error is. */
  const [failure, setFailure] = useState<{ at: Message; message: string } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [visitorId] = useState(getOrCreateVascoVisitorId);

  const chatRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const handoffOpener = useRef<HTMLElement | null>(null);

  // While a dialog is open over the expanded chat, the chat's own focus trap
  // and Escape-to-collapse stand aside. Mirrored to a ref for the listeners.
  const childModalOpen = showHandoff || showClearConfirm;
  const childModalOpenRef = useRef(childModalOpen);
  childModalOpenRef.current = childModalOpen;

  const extraBody = useMemo(() => ({ visitorId }), [visitorId]);
  const { streamingContent, isStreaming, sendStream } = useVascoStream({
    endpoint: '/vasco/chat/stream',
    extraBody,
  });

  const { data: vascoStatus, isLoading: statusLoading } = useQuery({
    queryKey: vascoKeys.status(),
    queryFn: () => api.get<{ enabled: boolean }>('/vasco/status'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const isEnabled = vascoStatus?.enabled ?? true;
  const isDisabled = !statusLoading && vascoStatus !== undefined && !isEnabled;

  // Save the conversation as the live page does.
  useEffect(() => {
    if (!sessionId || messages.length === 0) return;
    try {
      const toSave = messages
        .filter((m) => !isWelcomeMessage(m))
        .map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
          citations: m.citations,
        }));
      localStorage.setItem(SESSION_MESSAGES_KEY, JSON.stringify(toSave));
      localStorage.setItem(SESSION_ID_KEY, sessionId);
    } catch {
      // Ignore localStorage errors
    }
  }, [messages, sessionId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Keep the newest message in view. A fresh chat opens at the welcome, as on
  // the board; a restored one opens at its latest message.
  const scrolledOnce = useRef(false);
  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    const first = !scrolledOnce.current;
    scrolledOnce.current = true;
    if (first && messages.length === 0) return;
    const smooth = !first && !prefersReducedMotion();
    const frame = requestAnimationFrame(() => {
      if (typeof log.scrollTo === 'function') {
        log.scrollTo({ top: log.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, isStreaming, streamingContent, failure, limitReached]);

  // Expanded: a modal dialog — lock the page, move focus in, Escape closes,
  // focus goes back on close.
  useEffect(() => {
    if (!isExpanded) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const raf = requestAnimationFrame(() => {
      const container = chatRef.current;
      if (!container) return;
      const target =
        container.querySelector<HTMLElement>('textarea:not([disabled])') ??
        getFocusableElements(container)[0] ??
        container;
      target.focus();
    });

    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !childModalOpenRef.current) setIsExpanded(false);
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
      previouslyFocused?.focus?.();
    };
  }, [isExpanded]);

  const handleDialogKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || childModalOpenRef.current) return;
    const container = chatRef.current;
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
    async (preset?: string, base: Message[] = messages) => {
      const content = (preset || input).trim();
      if (!content || isStreaming || limitReached) return;

      setFailure(null);

      const userMessage: Message = { role: 'user', content, timestamp: new Date() };
      const updatedMessages = [...base, userMessage];
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

        if (result.sessionId) setSessionId(result.sessionId);
        if (typeof result.remaining === 'number') {
          setRemaining(result.remaining);
          setLimitReached(result.remaining <= 0);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : GENERIC_ERROR;
        if (err instanceof VascoStreamError && err.limitReached) {
          setRemaining(err.remaining ?? 0);
          setLimitReached(true);
        }
        setFailure({ at: userMessage, message: errorMsg });
        toast.error(errorMsg);
      }
    },
    [input, isStreaming, limitReached, messages, sendStream, sessionId],
  );

  /** A prompt or "Try again" goes away once used; focus moves to the log. */
  const sendFromLog = (content: string, base?: Message[]) => {
    logRef.current?.focus({ preventScroll: true });
    void sendMessage(content, base);
  };

  const sendTyped = () => {
    void sendMessage();
    // Clicking "Send" disables it (the box empties): keep focus in the box.
    if (document.activeElement !== inputRef.current) {
      inputRef.current?.focus({ preventScroll: true });
    }
  };

  const retry = (failed: Message) => {
    sendFromLog(
      failed.content,
      messages.filter((m) => m !== failed),
    );
  };

  const handleFeedback = useCallback(
    async (messageIndex: number, rating: 'positive' | 'negative') => {
      const message = messages[messageIndex];
      if (!message || message.role !== 'assistant' || message.feedback) return;

      setMessages((prev) =>
        prev.map((m, i) => (i === messageIndex ? { ...m, feedback: rating } : m)),
      );

      try {
        await api.post('/vasco/feedback', {
          sessionId: sessionId || 'unknown',
          messageContent: message.content,
          rating,
        });
      } catch {
        // Feedback is best-effort, as on the live page.
      }
    },
    [messages, sessionId],
  );

  const performClearChat = () => {
    setMessages([]);
    setInput('');
    setFailure(null);
    setSessionId(null);
    setRemaining(null);
    setLimitReached(false);
    setShowHandoff(false);
    try {
      localStorage.removeItem(SESSION_MESSAGES_KEY);
      localStorage.removeItem(SESSION_ID_KEY);
    } catch {
      // Ignore localStorage errors
    }
  };

  const openHandoff = (event: MouseEvent<HTMLButtonElement>) => {
    handoffOpener.current = event.currentTarget;
    setShowHandoff(true);
  };

  const userMessageCount = messages.filter((m) => m.role === 'user').length;
  const counter: VascoCounter = limitReached
    ? { short: '0 left', long: 'Free questions used', exhausted: true }
    : remaining !== null
      ? { short: `${remaining} left`, long: `${remaining} free questions left`, exhausted: false }
      : { short: '10 free', long: '10 free questions daily', exhausted: false };

  const seo = (
    <SEO
      {...seoData}
      structuredData={createWebPageSchema(seoData.title, seoData.description, seoData.canonicalUrl)}
    />
  );

  const hero = (
    <VascoHero
      kicker="AI financial navigator"
      title="Ask"
      accent="Vasco"
      lead="Your AI-powered financial navigator — explore South African finance with no login required."
      facts={['10 free questions daily', 'Available 24/7', 'South African context']}
    />
  );

  if (isDisabled) {
    return (
      <div className="nw-site nwav">
        {seo}
        {hero}
        <div className="nwav-main">
          <div className="nw-wrap">
            <VascoComingSoon
              title="Vasco is"
              accent="Coming Soon"
              text="Our AI financial navigator is being prepared for launch. In the meantime, explore our services or get in touch with us."
              actions={[
                { label: 'Explore Services', to: '/services', primary: true },
                { label: 'Contact Us', to: '/contact' },
              ]}
            />
          </div>
        </div>
      </div>
    );
  }

  const exchanges = toExchanges(messages);
  const lastExchange = exchanges[exchanges.length - 1];

  let note = null;
  if (limitReached) {
    note = (
      <VascoNote
        animate
        wide
        text="You have used the free public questions for now. A Navigate Wealth adviser can help from here."
        action={HAND_OFF_LABEL}
        onAction={openHandoff}
      />
    );
  } else if (userMessageCount >= ADVICE_NUDGE_AFTER) {
    note = (
      <VascoNote
        text={
          <>
            Want personalised advice?
            <span className="nwav-hide-sm"> Talk to a qualified adviser.</span>
          </>
        }
        action={HAND_OFF_LABEL}
        onAction={openHandoff}
      />
    );
  }

  return (
    <div className="nw-site nwav">
      {seo}
      {hero}
      <div className="nwav-main">
        <div className="nw-wrap">
          <VascoChat
            chatRef={chatRef}
            logRef={logRef}
            inputRef={inputRef}
            clearRef={clearRef}
            expanded={isExpanded}
            onToggleExpand={() => setIsExpanded((v) => !v)}
            onDialogKeyDown={handleDialogKeyDown}
            onCollapse={() => setIsExpanded(false)}
            name="Vasco"
            status="Online · General information, not advice"
            counter={counter}
            onClear={() => setShowClearConfirm(true)}
            clearDisabled={isStreaming}
            note={note}
            input={input}
            onInputChange={setInput}
            onSend={sendTyped}
            inputDisabled={limitReached}
            sendDisabled={isStreaming || limitReached || !input.trim()}
            placeholder="Ask about retirement, tax, cover — or try a calculation…"
            finePrint={FINE_PRINT}
          >
            <VascoWelcome {...WELCOME} />
            {!limitReached && userMessageCount === 0 && (
              <VascoPrompts
                prompts={SUGGESTED_PROMPTS}
                disabled={isStreaming || limitReached}
                onPick={(prompt) => sendFromLog(prompt)}
              />
            )}
            {exchanges.map((exchange) => {
              const isLast = exchange === lastExchange;
              const failed =
                failure && exchange.question === failure.at && !exchange.answer ? failure : null;
              return (
                <VascoExchange key={exchange.key} question={exchange.question?.content ?? null}>
                  {exchange.answer && (
                    <VascoAnswer
                      message={exchange.answer}
                      onFeedback={(rating) => void handleFeedback(exchange.answerIndex, rating)}
                    />
                  )}
                  {isLast && isStreaming && !exchange.answer && !streamingContent && (
                    <VascoThinking />
                  )}
                  {isLast && isStreaming && !exchange.answer && streamingContent && (
                    <VascoStreaming content={streamingContent} />
                  )}
                  {failed && (
                    <VascoFailure
                      message={failed.message}
                      onRetry={limitReached ? null : () => retry(failed.at)}
                    />
                  )}
                </VascoExchange>
              );
            })}
          </VascoChat>

          <VascoHelp
            title="Prefer to speak to a person?"
            text="A qualified adviser can look at your situation — in person in Pretoria or online."
            action={HAND_OFF_LABEL}
            onAction={openHandoff}
            linkLabel="Sign up for personalised guidance"
            linkTo="/signup"
            disclaimer={DISCLAIMER}
          />
        </div>
      </div>

      <VascoHandoffDialog
        open={showHandoff}
        onOpenChange={setShowHandoff}
        returnFocusTo={handoffOpener}
        fallbackFocus={inputRef}
        sessionId={sessionId}
        conversationSummary={conversationSummary}
      />

      <VascoClearDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        returnFocusTo={clearRef}
        fallbackFocus={inputRef}
        onConfirm={() => {
          setShowClearConfirm(false);
          performClearChat();
        }}
      />
    </div>
  );
}

export default NavigatorAskVascoPage;
