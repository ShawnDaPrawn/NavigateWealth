/**
 * "Stay Connected" — the newsletter sign-up the board places at the foot of
 * the article.
 *
 * The live article page has none; the site's own sign-up (the footer, live
 * and Navigator) is the one it copies: the same endpoint and `{ email }`
 * payload, no retry on a transient failure, the same hidden field for bots,
 * the same checks and the same answers. Where the footer answers in a toast,
 * the board answers in place, so success shows here and problems go to a
 * toast; a rejected address is also marked on the field, which takes focus.
 */
import { useId, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { api } from '../../utils/api/client';

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

export function ArticleSignup() {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  // Hidden from people; bots that fill every field fill this one too.
  const [trap, setTrap] = useState('');
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const reject = (message: string) => {
    setInvalid(true);
    input.current?.focus();
    toast.error(message);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (trap) {
      // Pretend it worked: telling a bot it was caught only teaches it.
      setEmail('');
      return;
    }
    if (!email) {
      reject('Please enter your email address');
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      reject('Please enter a valid email address');
      return;
    }
    setBusy(true);
    try {
      const data = await api.post<{ alreadySubscribed?: boolean; requiresConfirmation?: boolean }>(
        '/newsletter/subscribe',
        { email },
        { retryTransientFailures: false },
      );
      setEmail('');
      setOutcome(
        data?.alreadySubscribed ? 'already' : data?.requiresConfirmation ? 'confirm' : 'done',
      );
    } catch (error) {
      toast.error('Subscription failed', {
        description:
          error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const copy = outcome ? OUTCOME_COPY[outcome] : null;

  return (
    <div className="nwar-signup nwar-noprint">
      <div className="nwar-signup-copy">
        <p className="nw-h nwar-signup-t">Stay Connected</p>
        <p className="nwar-signup-p">
          Get the latest market insights and financial tips delivered to your inbox.
        </p>
      </div>
      {copy ? (
        <p className="nwar-signup-done nw-in" role="status">
          <strong>{copy.title}</strong> {copy.text}
        </p>
      ) : (
        <form className="nwar-signup-form" onSubmit={submit} noValidate>
          <label htmlFor={`${id}-email`} className="nw-sr-only">
            Email address
          </label>
          <input
            ref={input}
            id={`${id}-email`}
            className={invalid ? 'nwar-input nwar-input--invalid' : 'nwar-input'}
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Enter your email"
            value={email}
            aria-invalid={invalid || undefined}
            onChange={(event) => {
              setEmail(event.target.value);
              setInvalid(false);
            }}
            disabled={busy}
          />
          <div className="nwar-trap" aria-hidden="true">
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
          <button type="submit" className="nw-btn nwar-signup-btn" disabled={busy}>
            {busy ? 'Subscribing…' : 'Subscribe'}
          </button>
        </form>
      )}
    </div>
  );
}
