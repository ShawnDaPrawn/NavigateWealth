/**
 * VascoDialogs — Ask Vasco's two dialogs, as the "Ask Vasco" board draws them:
 *
 * - VascoHandoffDialog: "Book a Free Consultation", the live page's adviser
 *   call-back form. Same fields, same required ones, same POST to
 *   /vasco/handoff with the same payload and the same messages.
 * - VascoClearDialog: the live page's "Clear conversation?" confirmation.
 *
 * Both are Radix: focus is trapped while open, Escape closes, and focus goes
 * back to the control that opened them (the page passes it in, as there is no
 * Radix trigger). Radix portals them to <body>, outside the page's `.nw-site`
 * wrapper, so each portal carries its own wrapper for the scoped styles.
 */
import { useState, type FormEvent, type RefObject } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { api } from '../../utils/api';
import { VascoIcon } from './VascoIcons';
import '../styles/ask-vasco.css';

/** Focus the opener when it is still on the page, else the fallback. */
function restoreFocus(
  event: Event,
  opener: RefObject<HTMLElement | null>,
  fallback?: RefObject<HTMLElement | null>,
) {
  event.preventDefault();
  const target = opener.current?.isConnected ? opener.current : fallback?.current;
  target?.focus();
}

interface VascoHandoffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusTo: RefObject<HTMLElement | null>;
  fallbackFocus: RefObject<HTMLElement | null>;
  sessionId: string | null;
  conversationSummary: string;
}

export function VascoHandoffDialog({
  open,
  onOpenChange,
  returnFocusTo,
  fallbackFocus,
  sessionId,
  conversationSummary,
}: VascoHandoffDialogProps) {
  // Held outside the dialog's content, so they survive closing it, as the
  // live page's do: a sent request still reads "Request Submitted" if the
  // dialog is opened again.
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
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
    } catch {
      toast.error('Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <div className="nw-site nwav">
          <Dialog.Overlay className="nwav-overlay">
            <Dialog.Content
              className="nwav-dialog nwav-dialog--handoff nw-in"
              onCloseAutoFocus={(event) => restoreFocus(event, returnFocusTo, fallbackFocus)}
            >
              <Dialog.Close className="nwav-iconbtn nwav-close" aria-label="Close">
                <VascoIcon name="close" size={18} />
              </Dialog.Close>
              {submitted ? (
                <div className="nwav-done">
                  <span className="nwav-done-mark" aria-hidden="true">
                    <VascoIcon name="check" size={24} />
                  </span>
                  <Dialog.Title className="nwav-done-title">Request Submitted</Dialog.Title>
                  <Dialog.Description className="nwav-dialog-text">
                    A Navigate Wealth adviser will be in touch within 24 hours to discuss your
                    financial needs.
                  </Dialog.Description>
                  <Dialog.Close className="nw-btn nwav-done-btn">Back to Chat</Dialog.Close>
                </div>
              ) : (
                <>
                  <div className="nwav-ho-head">
                    <span className="nwav-ho-mark" aria-hidden="true">
                      <VascoIcon name="phone" size={19} stroke="#0D1626" />
                    </span>
                    <div>
                      <Dialog.Title className="nwav-dialog-title">
                        Book a Free Consultation
                      </Dialog.Title>
                      <Dialog.Description className="nwav-ho-sub">
                        Get personalised guidance from a qualified financial adviser
                      </Dialog.Description>
                    </div>
                  </div>
                  <form className="nwav-form" onSubmit={(event) => void handleSubmit(event)}>
                    <div className="nwav-field">
                      <label htmlFor="nwav-ho-name">
                        Full Name <span className="nwav-req">*</span>
                      </label>
                      <input
                        id="nwav-ho-name"
                        className="nwav-input"
                        type="text"
                        autoComplete="name"
                        placeholder="e.g., John Smith"
                        required
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </div>
                    <div className="nwav-field">
                      <label htmlFor="nwav-ho-email">
                        Email <span className="nwav-req">*</span>
                      </label>
                      <input
                        id="nwav-ho-email"
                        className="nwav-input"
                        type="email"
                        autoComplete="email"
                        placeholder="e.g., john@example.com"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </div>
                    <div className="nwav-field">
                      <label htmlFor="nwav-ho-phone">Phone (optional)</label>
                      <input
                        id="nwav-ho-phone"
                        className="nwav-input"
                        type="tel"
                        autoComplete="tel"
                        placeholder="e.g., 082 123 4567"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                      />
                    </div>
                    <div className="nwav-field">
                      <label htmlFor="nwav-ho-topic">
                        What would you like to discuss? <span className="nwav-req">*</span>
                      </label>
                      <input
                        id="nwav-ho-topic"
                        className="nwav-input"
                        type="text"
                        placeholder="e.g., Retirement planning review"
                        required
                        value={topic}
                        onChange={(event) => setTopic(event.target.value)}
                      />
                    </div>
                    <button type="submit" className="nw-btn nwav-submit" disabled={submitting}>
                      {submitting ? 'Submitting...' : 'Request Callback'}
                    </button>
                    <p className="nwav-ho-note">
                      Your information will be shared with Navigate Wealth only.
                    </p>
                  </form>
                </>
              )}
            </Dialog.Content>
          </Dialog.Overlay>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface VascoClearDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusTo: RefObject<HTMLElement | null>;
  fallbackFocus: RefObject<HTMLElement | null>;
  onConfirm: () => void;
}

export function VascoClearDialog({
  open,
  onOpenChange,
  returnFocusTo,
  fallbackFocus,
  onConfirm,
}: VascoClearDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <div className="nw-site nwav">
          <AlertDialog.Overlay className="nwav-overlay">
            <AlertDialog.Content
              className="nwav-dialog nwav-dialog--clear nw-in"
              onCloseAutoFocus={(event) => restoreFocus(event, returnFocusTo, fallbackFocus)}
            >
              <AlertDialog.Title className="nwav-dialog-title">
                Clear conversation?
              </AlertDialog.Title>
              <AlertDialog.Description className="nwav-dialog-text">
                Are you sure you want to clear this Ask Vasco conversation? This will reset the
                session and cannot be undone.
              </AlertDialog.Description>
              <div className="nwav-clear-actions">
                <AlertDialog.Cancel className="nw-outline nwav-cancel">Cancel</AlertDialog.Cancel>
                <AlertDialog.Action className="nwav-danger" onClick={onConfirm}>
                  Clear chat
                </AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Overlay>
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
