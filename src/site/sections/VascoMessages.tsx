/**
 * VascoMessages — what the conversation log holds, drawn as the "Ask Vasco"
 * board draws it: Vasco's welcome, the "Try asking" prompts, and each question
 * with whatever answers it — the typing indicator, the streamed reply, the
 * finished answer with its feedback and copy actions, or the error with
 * "Try again".
 *
 * Answers are markdown, rendered by the same MessageRenderer the live page
 * uses, so they get the same formatting and never become raw HTML or links.
 * Article citations are in-site router links, as on the live page.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { MessageRenderer } from '../../components/shared/MessageRenderer';
import type { VascoChatMessageType as Message } from '../../components/shared/vasco-chat';
import { VascoIcon } from './VascoIcons';
import '../styles/sections.css';
import '../styles/ask-vasco.css';

/** **bold** spans in a line of the welcome copy. */
function withBold(text: string): ReactNode[] {
  return text
    .split(/\*\*(.+?)\*\*/)
    .map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

interface VascoWelcomeProps {
  intro: string;
  body: string;
  items: readonly string[];
}

/** Vasco's opening message. The list is dropped on phones, as on the board. */
export function VascoWelcome({ intro, body, items }: VascoWelcomeProps) {
  return (
    <div className="nwav-row">
      <span className="nwav-av-s" aria-hidden="true">
        <VascoIcon name="compass" size={14} stroke="#E3D9C3" />
      </span>
      <div className="nwav-bubble">
        <p className="nwav-p">{withBold(intro)}</p>
        <p className="nwav-p nwav-p--next">{body}</p>
        <ul className="nwav-list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface VascoPromptsProps {
  prompts: readonly string[];
  disabled: boolean;
  onPick: (prompt: string) => void;
}

export function VascoPrompts({ prompts, disabled, onPick }: VascoPromptsProps) {
  return (
    <div className="nwav-suggest">
      <p className="nwav-try-label" id="nwav-try-label">
        Try asking
      </p>
      <div className="nwav-sgrid" role="group" aria-labelledby="nwav-try-label">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="nwav-sq"
            disabled={disabled}
            onClick={() => onPick(prompt)}
          >
            <span>{prompt}</span>
            <VascoIcon name="arrowRight" size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}

function AnswerAvatar() {
  return (
    <span className="nwav-av-a" aria-hidden="true">
      <VascoIcon name="compass" size={15} stroke="#C5CAD3" />
    </span>
  );
}

function Dots() {
  return (
    <span className="nwav-dots" aria-hidden="true">
      <span className="nwav-dot" />
      <span className="nwav-dot nwav-dot2" />
      <span className="nwav-dot nwav-dot3" />
    </span>
  );
}

/** Waiting for the first words of the reply. */
export function VascoThinking() {
  return (
    <div className="nwav-think-row">
      <AnswerAvatar />
      <div className="nwav-think" role="status">
        <Dots />
        <span>Vasco is responding...</span>
      </div>
    </div>
  );
}

/**
 * The reply while it streams in. Hidden from screen readers until it is
 * whole: the finished answer replaces it as a new node in the log, which is
 * announced once, instead of every chunk being read out as it lands.
 */
export function VascoStreaming({ content }: { content: string }) {
  return (
    <div className="nwav-answer-row" aria-hidden="true">
      <AnswerAvatar />
      <div className="nwav-answer-col">
        <div className="nwav-answer">
          <MessageRenderer content={content} role="assistant" />
        </div>
        <div className="nwav-actions nwav-streaming">
          <Dots />
          <span>Vasco is responding...</span>
        </div>
      </div>
    </div>
  );
}

interface VascoAnswerProps {
  message: Message;
  onFeedback: (rating: 'positive' | 'negative') => void;
}

export function VascoAnswer({ message, onFeedback }: VascoAnswerProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success('Copied to clipboard');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const citations = message.citations ?? [];
  return (
    <div className="nwav-answer-row">
      <AnswerAvatar />
      <div className="nwav-answer-col">
        <div className="nwav-answer">
          <MessageRenderer content={message.content} role="assistant" />
        </div>
        {citations.length > 0 && (
          <ul className="nwav-cites" aria-label="Related articles">
            {citations.map((citation, i) => (
              <li key={`${citation.slug}-${i}`}>
                <Link className="nwav-cite" to={citation.url}>
                  {citation.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="nwav-actions">
          <button
            type="button"
            className="nwav-iconbtn"
            title="Helpful"
            aria-label="Helpful"
            aria-pressed={message.feedback === 'positive'}
            onClick={() => onFeedback('positive')}
          >
            <VascoIcon name="thumbsUp" size={15} />
          </button>
          <button
            type="button"
            className="nwav-iconbtn"
            title="Not helpful"
            aria-label="Not helpful"
            aria-pressed={message.feedback === 'negative'}
            onClick={() => onFeedback('negative')}
          >
            <VascoIcon name="thumbsDown" size={15} />
          </button>
          <button
            type="button"
            className="nwav-iconbtn"
            title="Copy response"
            aria-label={copied ? 'Copied' : 'Copy response'}
            onClick={() => void copy()}
          >
            <VascoIcon name={copied ? 'check' : 'copy'} size={15} />
          </button>
          {message.feedback && (
            <span className="nwav-thanks nw-in" role="status">
              Thanks for the feedback
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface VascoFailureProps {
  /** What went wrong, as the stream hook reports it. */
  message: string;
  /** Null when there is nothing to retry (no free questions left). */
  onRetry: (() => void) | null;
}

export function VascoFailure({ message, onRetry }: VascoFailureProps) {
  return (
    <div className="nwav-row" role="alert">
      <span className="nwav-av-s nwav-av-err" aria-hidden="true">
        <VascoIcon name="alert" size={14} />
      </span>
      <div className="nwav-bubble nwav-bubble--err">
        <p className="nwav-p">
          <strong>Vasco couldn&apos;t answer just now.</strong> {message}
        </p>
        {onRetry && (
          <button type="button" className="nw-outline nwav-retry" onClick={onRetry}>
            <VascoIcon name="retry" size={14} />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

/** One question, and below it whatever answers it. */
export function VascoExchange({
  question,
  children,
}: {
  question: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="nwav-group nw-in">
      {question !== null && <div className="nwav-user">{question}</div>}
      {children}
    </div>
  );
}
