/**
 * VascoChat — the chat card: Vasco's name bar with the free-question counter,
 * the conversation log and the composer, as the "Ask Vasco" board draws them.
 *
 * Presentation only. The page owns the conversation and passes the log's
 * contents in as children; this card lays them out and wires the controls.
 *
 * - The log is a polite live region (role="log") that announces what is
 *   added to it, not the whole conversation again.
 * - Enter sends; Shift+Enter starts a new line (an IME composing a word keeps
 *   its Enter).
 * - Expanded, the card is a modal dialog; the page traps focus in it.
 */
import type { KeyboardEvent, MouseEvent, ReactNode, RefObject } from 'react';
import { VascoIcon } from './VascoIcons';
import '../styles/sections.css';
import '../styles/ask-vasco.css';

export interface VascoCounter {
  /** What the pill shows, e.g. "10 free". */
  short: string;
  /** The same in full, for the tooltip and screen readers. */
  long: string;
  /** No free questions left: the pill takes the danger rule. */
  exhausted: boolean;
}

interface VascoChatProps {
  chatRef: RefObject<HTMLDivElement>;
  logRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLTextAreaElement>;
  clearRef: RefObject<HTMLButtonElement>;
  expanded: boolean;
  onToggleExpand: () => void;
  onDialogKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onCollapse: () => void;
  name: string;
  status: string;
  counter: VascoCounter;
  onClear: () => void;
  clearDisabled: boolean;
  /** The log's contents: welcome, prompts and the exchanges. */
  children: ReactNode;
  /** A note above the composer (out of questions, or "want advice?"). */
  note: ReactNode;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  inputDisabled: boolean;
  sendDisabled: boolean;
  placeholder: string;
  finePrint: string;
}

export function VascoChat({
  chatRef,
  logRef,
  inputRef,
  clearRef,
  expanded,
  onToggleExpand,
  onDialogKeyDown,
  onCollapse,
  name,
  status,
  counter,
  onClear,
  clearDisabled,
  children,
  note,
  input,
  onInputChange,
  onSend,
  inputDisabled,
  sendDisabled,
  placeholder,
  finePrint,
}: VascoChatProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <>
      {expanded && <div className="nwav-backdrop" aria-hidden="true" onClick={onCollapse} />}
      <div
        ref={chatRef}
        className={`nwav-chat${expanded ? ' nwav-expanded' : ''}`}
        role={expanded ? 'dialog' : 'region'}
        aria-modal={expanded ? true : undefined}
        aria-label="Ask Vasco chat"
        onKeyDown={expanded ? onDialogKeyDown : undefined}
      >
        <div className="nwav-bar">
          <div className="nwav-id">
            <span className="nwav-av" aria-hidden="true">
              <VascoIcon name="compass" size={19} stroke="#E3D9C3" />
              <i />
            </span>
            <div className="nwav-id-text">
              <p className="nwav-name">{name}</p>
              <p className="nwav-status">{status}</p>
            </div>
          </div>
          <div className="nwav-tools">
            <span
              className="nwav-count"
              data-exhausted={counter.exhausted ? 'true' : undefined}
              title={counter.long}
            >
              <span aria-hidden="true">{counter.short}</span>
              <span className="nw-sr-only">{counter.long}</span>
            </span>
            <button
              type="button"
              className="nwav-iconbtn"
              aria-label={expanded ? 'Collapse chat' : 'Expand chat'}
              onClick={onToggleExpand}
            >
              <VascoIcon name="expand" size={16} />
            </button>
            <button
              ref={clearRef}
              type="button"
              className="nwav-iconbtn"
              aria-label="Clear conversation"
              title="Clear conversation"
              aria-haspopup="dialog"
              disabled={clearDisabled}
              onClick={onClear}
            >
              <VascoIcon name="trash" size={16} />
            </button>
          </div>
        </div>

        <div
          ref={logRef}
          className="nwav-log"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Conversation with Vasco"
          tabIndex={0}
        >
          {children}
        </div>

        <div className="nwav-foot">
          {note}
          <div className="nwav-composer" data-locked={inputDisabled ? 'true' : undefined}>
            <label htmlFor="nwav-input" className="nw-sr-only">
              Message Vasco
            </label>
            <textarea
              ref={inputRef}
              id="nwav-input"
              className="nwav-textarea"
              rows={1}
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={onKeyDown}
              disabled={inputDisabled}
              placeholder={placeholder}
            />
            <button
              type="button"
              className="nw-btn nwav-send"
              aria-label="Send message"
              disabled={sendDisabled}
              onClick={onSend}
            >
              <VascoIcon name="send" size={18} />
            </button>
          </div>
          <p className="nwav-fine">{finePrint}</p>
        </div>
      </div>
    </>
  );
}

interface VascoNoteProps {
  text: ReactNode;
  action: string;
  onAction: (event: MouseEvent<HTMLButtonElement>) => void;
  /** The out-of-questions note fades in, as on the board. */
  animate?: boolean;
  wide?: boolean;
}

/** A line above the composer with one action. Phones show only the action. */
export function VascoNote({ text, action, onAction, animate, wide }: VascoNoteProps) {
  return (
    <div className={`nwav-note${animate ? ' nw-in' : ''}`}>
      <p className={`nwav-note-text${wide ? ' nwav-note-text--wide' : ''}`}>{text}</p>
      <button
        type="button"
        className="nw-btn nwav-note-btn"
        aria-haspopup="dialog"
        onClick={onAction}
      >
        {action}
      </button>
    </div>
  );
}
