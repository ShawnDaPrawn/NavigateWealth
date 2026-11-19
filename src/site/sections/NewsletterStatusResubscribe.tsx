/**
 * Subscribing again from a newsletter status page: the "Subscribe again" form
 * the confirm board draws under an expired link, and the "resubscribe … now"
 * link the unsubscribe board draws after an opt-out.
 *
 * Both subscribe exactly as the site footer does (live and Navigator): the
 * same endpoint, the same `{ email }` payload, no retry on a transient failure,
 * the same checks on the address and the same answers, word for word. A new
 * subscription is double opt-in, so the usual answer is the board's "Check
 * your email!". Where the footer shows answers in a toast, these pages show
 * them in place.
 */
import { useId, useRef, useState, type FormEvent } from 'react';
import { api } from '../../utils/api/client';
import { ICON_SUCCESS, NewsletterStatusIcon } from './NewsletterStatusIcons';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Outcome = 'confirm' | 'already' | 'done';

const OUTCOME_COPY: Record<Outcome, { title: string; text: string }> = {
  confirm: {
    title: 'Check your email!',
    text: "We've sent you a confirmation link. Please click it to complete your subscription.",
  },
  already: {
    title: 'Already subscribed',
    text: "You're already on our mailing list. We'll keep sending you great content!",
  },
  done: {
    title: 'Successfully subscribed!',
    text: 'Thank you for subscribing to our newsletter.',
  },
};

function useResubscribe() {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const subscribe = async (email: string) => {
    setBusy(true);
    setFailure(null);
    try {
      const data = await api.post<{ alreadySubscribed?: boolean; requiresConfirmation?: boolean }>(
        '/newsletter/subscribe',
        { email },
        { retryTransientFailures: false },
      );
      setOutcome(
        data?.alreadySubscribed ? 'already' : data?.requiresConfirmation ? 'confirm' : 'done',
      );
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return { busy, outcome, failure, subscribe };
}

function ResubscribeDone({ outcome }: { outcome: Outcome }) {
  const copy = OUTCOME_COPY[outcome];
  return (
    <div className="nwnl-note" role="status">
      <NewsletterStatusIcon name="mail" size={20} stroke={ICON_SUCCESS} />
      <div>
        <div className="nwnl-note-t">{copy.title}</div>
        <div className="nwnl-note-p">{copy.text}</div>
      </div>
    </div>
  );
}

function ResubscribeFailure({ message }: { message: string }) {
  return (
    <div className="nwnl-alert" role="alert">
      <NewsletterStatusIcon name="alert" size={16} />
      <div>
        <strong>Subscription failed</strong> {message}
      </div>
    </div>
  );
}

/** The confirm board's form, filled in with the address the link was sent to. */
export function ResubscribeForm({ initialEmail }: { initialEmail: string }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(initialEmail);
  // Hidden from people; bots that fill every field fill this one too.
  const [trap, setTrap] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { busy, outcome, failure, subscribe } = useResubscribe();

  if (outcome) return <ResubscribeDone outcome={outcome} />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (trap) {
      // Pretend it worked: telling a bot it was caught only teaches it.
      setEmail('');
      return;
    }
    const problem = !email
      ? 'Please enter your email address'
      : !EMAIL_PATTERN.test(email)
        ? 'Please enter a valid email address'
        : null;
    setError(problem);
    if (problem) {
      inputRef.current?.focus();
      return;
    }
    await subscribe(email);
  };

  return (
    <form className="nwnl-form" onSubmit={submit} noValidate>
      <label htmlFor={`${id}-email`} className="nwnl-form-label">
        Subscribe again
      </label>
      <div className="nwnl-form-row">
        <input
          ref={inputRef}
          id={`${id}-email`}
          className="nwnl-input"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Enter your email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button type="submit" className="nw-btn nwnl-submit" disabled={busy}>
          {busy ? 'Subscribing…' : 'Subscribe'}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="nwnl-field-error">
          <NewsletterStatusIcon name="alert" size={14} />
          {error}
        </p>
      ) : null}
      {failure ? <ResubscribeFailure message={failure} /> : null}
      <div className="nwnl-trap" aria-hidden="true">
        <label htmlFor={`${id}-website`}>Website</label>
        <input
          id={`${id}-website`}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={trap}
          onChange={(event) => setTrap(event.target.value)}
        />
      </div>
    </form>
  );
}

/** The unsubscribe board's offer, for the address that has just opted out. */
export function ResubscribeOffer({ email }: { email: string }) {
  const { busy, outcome, failure, subscribe } = useResubscribe();

  if (outcome) return <ResubscribeDone outcome={outcome} />;

  return (
    <>
      <p className="nwnl-offer-p">
        Changed your mind? You can always resubscribe from our website footer — or{' '}
        <button
          type="button"
          className="nwnl-linkbtn"
          aria-disabled={busy || undefined}
          onClick={() => {
            if (!busy) void subscribe(email);
          }}
        >
          resubscribe {email} now
        </button>
        .
      </p>
      {failure ? <ResubscribeFailure message={failure} /> : null}
    </>
  );
}
