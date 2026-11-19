/**
 * NewsletterIssueSubscribe — the "Stay Connected" panel beside the previous
 * issue.
 *
 * It subscribes exactly as the site footer and the Resources page do: the
 * same endpoint, the same `{ email }` payload, no retry on a transient
 * failure, the same hidden field for bots, the same checks and the same
 * answers. As on the Resources page, the answer replaces the form in place
 * (the board's "Check your email!" note) and only problems go to a toast; a
 * check that fails also marks the field invalid and puts focus back on it.
 */
import { useId, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { api } from '../../utils/api/client';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Outcome = 'confirm' | 'already' | 'done';

/** The footer's wording for each answer the endpoint can give. */
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

export function NewsletterIssueSubscribe() {
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
    toast.error(message);
    input.current?.focus();
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
    <section className="nwni-sub" aria-labelledby={`${id}-title`}>
      <p id={`${id}-title`} className="nw-h nwni-sub-h">
        Stay <span className="nw-accent">Connected</span>
      </p>
      <p className="nwni-sub-p">
        Get the latest market insights and financial tips delivered to your inbox.
      </p>
      {copy ? (
        <p className="nw-in nwni-sub-done" role="status">
          <strong>{copy.title}</strong> {copy.text}
        </p>
      ) : (
        <form className="nwni-sub-form" onSubmit={submit} noValidate>
          <label htmlFor={`${id}-email`} className="nw-sr-only">
            Email address
          </label>
          <input
            ref={input}
            id={`${id}-email`}
            className="nwni-input"
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
          <div className="nwni-trap" aria-hidden="true">
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
          <button type="submit" className="nw-btn nwni-sub-btn" disabled={busy}>
            {busy ? 'Subscribing…' : 'Subscribe'}
          </button>
        </form>
      )}
    </section>
  );
}
