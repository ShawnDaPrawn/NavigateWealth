/**
 * ResourcesSignup — the Resources page's newsletter sign-up, in the board's two
 * forms: a light band under the article library and a dark panel beside the
 * newsletter archive.
 *
 * It subscribes exactly as the site footer does (live and Navigator): the same
 * endpoint, the same `{ email }` payload, no retry on a transient failure, the
 * same hidden field for bots, and the same answers. Where the footer shows the
 * answer in a toast, the board shows it in place, so a success is shown here
 * and only problems go to a toast.
 */
import { useId, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { api } from '../../utils/api/client';
import { SIGNUP_NOTE } from './resourcesModel';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignupOutcome = 'confirm' | 'already' | 'done';

const OUTCOME_COPY: Record<SignupOutcome, { title: string; text: string }> = {
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

/** The page holds the outcome, so both forms agree once someone subscribes. */
export interface NewsletterSignup {
  outcome: SignupOutcome | null;
  setOutcome: (outcome: SignupOutcome) => void;
}

interface ResourcesSignupProps {
  variant: 'band' | 'panel';
  signup: NewsletterSignup;
}

export function ResourcesSignup({ variant, signup }: ResourcesSignupProps) {
  const id = useId();
  const [email, setEmail] = useState('');
  // Hidden from people; bots that fill every field fill this one too.
  const [trap, setTrap] = useState('');
  const [busy, setBusy] = useState(false);
  const dark = variant === 'panel';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (trap) {
      // Pretend it worked: telling a bot it was caught only teaches it.
      setEmail('');
      return;
    }
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      toast.error('Please enter a valid email address');
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
      signup.setOutcome(
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

  if (signup.outcome) {
    const copy = OUTCOME_COPY[signup.outcome];
    return (
      <div className={`nwrs-done nw-in${dark ? ' nwrs-done--dark' : ''}`} role="status">
        <p className="nwrs-done-t">
          <span className="nwrs-done-dot" aria-hidden="true" />
          {copy.title}
        </p>
        <p className="nwrs-done-p">{copy.text}</p>
      </div>
    );
  }

  return (
    <>
      <form
        className={dark ? 'nwrs-nlform nwrs-nlform--dark' : 'nwrs-nlform'}
        onSubmit={submit}
        noValidate
      >
        <label htmlFor={`${id}-email`} className="nw-sr-only">
          Email address
        </label>
        <input
          id={`${id}-email`}
          className={dark ? 'nwrs-input' : 'nwrs-input nwrs-input--light'}
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Enter your email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
        />
        <div className="nwrs-trap" aria-hidden="true">
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
        <button type="submit" className="nw-btn nwrs-nlbtn" disabled={busy}>
          {busy ? 'Subscribing…' : 'Subscribe'}
        </button>
      </form>
      {dark ? null : <p className="nwrs-nlnote">{SIGNUP_NOTE}</p>}
    </>
  );
}
