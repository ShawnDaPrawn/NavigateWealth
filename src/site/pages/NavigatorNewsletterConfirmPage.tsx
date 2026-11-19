/**
 * NavigatorNewsletterConfirmPage — the redesigned double opt-in confirmation
 * page (/newsletter/confirm?token=…&email=…), the "Newsletter Confirm" board of
 * the Website Redesign canvas.
 *
 * It does what the live page (NewsletterConfirmPage.tsx) does: one GET to the
 * public confirm route with the link's token and address, the same states and
 * the same words — a link missing either parameter is invalid without a
 * request, the server's "Confirmation link expired" gets the expired wording,
 * any other refusal shows the server's own message, and a request that never
 * got an answer shows the live page's generic one. It emits the same SEO tags.
 *
 * The request goes through the shared API client rather than a hand-rolled
 * fetch, which also means it no longer sends the public anon key as a bearer
 * token (the route is public; see the anon-key-bearer ratchet).
 *
 * Beyond the live page, as the board draws it: an expired link offers the
 * footer's sign-up in place (filled in with the address the link was for), a
 * failure that may be passing offers "Try again" — the same request once
 * more — and a confirmed subscription lists a few featured articles.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { SEO } from '../../components/seo/SEO';
import { NEWSLETTER_CONFIRM_SEO } from '../../components/pages/newsletterStatusData';
import { APIError, api } from '../../utils/api/client';
import {
  ICON_DANGER,
  ICON_INK,
  ICON_SUCCESS,
  ICON_WARN,
  NewsletterStatusIcon,
} from '../sections/NewsletterStatusIcons';
import { NewsletterStatusReading } from '../sections/NewsletterStatusReading';
import { ResubscribeForm } from '../sections/NewsletterStatusResubscribe';
import {
  NewsletterStatusBadge,
  NewsletterStatusHelp,
  NewsletterStatusShell,
  type NewsletterStatusAccent,
} from '../sections/NewsletterStatusShell';
import '../styles/navigator.css';
import '../styles/newsletter-status.css';

/** The live page's words. */
const MESSAGES = {
  invalid: 'Invalid confirmation link. Please check your email for the correct link.',
  expired:
    'This confirmation link has expired. Please subscribe again to receive a new confirmation email.',
  failed: 'Failed to confirm subscription. Please try again or contact support.',
  unanswered: 'An error occurred while confirming your subscription. Please try again later.',
  already: "Your subscription was already confirmed. You're all set!",
  success:
    "Thank you for confirming your subscription! You'll now receive our newsletter with financial insights and updates.",
} as const;

/** The server's answer for a link past its 48 hours, matched as the live page matches it. */
const EXPIRED_ERROR = 'Confirmation link expired';

/** APIError codes the client sets itself when no JSON answer came back. */
const UNANSWERED_CODES = new Set([
  'NETWORK_ERROR',
  'NON_JSON_ERROR',
  'CLOUDFLARE_ERROR',
  'JSON_PARSE_ERROR',
]);

type ConfirmState =
  | { status: 'loading' }
  | { status: 'success' }
  | { status: 'already' }
  | { status: 'error'; message: string; expired: boolean; retry: boolean };

/**
 * The live page reads `data.error` from any JSON answer that is not OK; the
 * API client keeps that body on the APIError it throws.
 */
function refusal(error: unknown): ConfirmState {
  const answered =
    error instanceof APIError &&
    error.statusCode > 0 &&
    !(error.code && UNANSWERED_CODES.has(error.code));
  if (!answered) {
    return { status: 'error', message: MESSAGES.unanswered, expired: false, retry: true };
  }
  const body = error.details;
  const serverError =
    body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
  if (serverError === EXPIRED_ERROR) {
    return { status: 'error', message: MESSAGES.expired, expired: true, retry: false };
  }
  const message = typeof serverError === 'string' && serverError ? serverError : MESSAGES.failed;
  // A link the server turned down (not found, wrong token) will be turned down
  // again; a server fault or an unexplained refusal may not be.
  const final = error.statusCode < 500 && message !== MESSAGES.failed;
  return { status: 'error', message, expired: false, retry: !final };
}

interface View {
  accent: NewsletterStatusAccent;
  badge: Parameters<typeof NewsletterStatusBadge>[0];
  title: string;
  message: string;
}

function viewOf(state: ConfirmState): View {
  switch (state.status) {
    case 'loading':
      return {
        accent: 'wait',
        badge: { icon: 'spinner', iconSize: 34, stroke: ICON_INK, tone: 'plain' },
        title: 'Confirming Your Subscription',
        message: 'Please wait while we process your confirmation...',
      };
    case 'success':
      return {
        accent: 'success',
        badge: { icon: 'check', iconSize: 34, stroke: ICON_SUCCESS, tone: 'success' },
        title: "You're In!",
        message: MESSAGES.success,
      };
    case 'already':
      return {
        accent: 'ink',
        badge: { icon: 'mailCheck', iconSize: 32, stroke: ICON_INK, tone: 'ring' },
        title: 'Already Confirmed',
        message: MESSAGES.already,
      };
    case 'error':
      return {
        accent: state.expired ? 'warn' : 'danger',
        badge: state.expired
          ? { icon: 'clock', iconSize: 32, stroke: ICON_WARN, tone: 'warn' }
          : { icon: 'cross', iconSize: 32, stroke: ICON_DANGER, tone: 'danger' },
        title: 'Confirmation Failed',
        message: state.message,
      };
  }
}

export function NavigatorNewsletterConfirmPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<ConfirmState>({ status: 'loading' });

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const confirmSubscription = useCallback(async () => {
    if (!token || !email) {
      setState({ status: 'error', message: MESSAGES.invalid, expired: false, retry: false });
      return;
    }
    try {
      const data = await api.get<{ alreadyConfirmed?: boolean }>(
        `/newsletter/confirm?token=${token}&email=${encodeURIComponent(email)}`,
        // One request, as the live page makes; "Try again" is the visitor's call.
        { retryTransientFailures: false },
      );
      // A body that is not JSON is a failure to the live page, which parses it.
      if (typeof Response !== 'undefined' && data instanceof Response) {
        throw new Error('Unexpected response');
      }
      setState({ status: data.alreadyConfirmed ? 'already' : 'success' });
    } catch (error) {
      setState(refusal(error));
    }
  }, [token, email]);

  useEffect(() => {
    void confirmSubscription();
  }, [confirmSubscription]);

  const retry = () => {
    setState({ status: 'loading' });
    void confirmSubscription();
  };

  const view = viewOf(state);
  const confirmed = state.status === 'success' || state.status === 'already';

  return (
    <>
      <SEO {...NEWSLETTER_CONFIRM_SEO} />
      <NewsletterStatusShell label="Newsletter" accent={view.accent} bright>
        <NewsletterStatusBadge {...view.badge} />
        <div aria-live="polite" aria-atomic="true">
          <h1 className="nwnl-title">{view.title}</h1>
          <p className="nwnl-text">{view.message}</p>
        </div>

        {confirmed ? (
          <div className="nwnl-actions">
            <Link className="nw-btn nwnl-action nwnl-go" to="/resources">
              Explore Resources
              <NewsletterStatusIcon name="arrowRight" size={16} />
            </Link>
            <Link className="nw-outline nwnl-action" to="/">
              Return to Homepage
            </Link>
          </div>
        ) : null}

        {state.status === 'success' ? <NewsletterStatusReading /> : null}

        {state.status === 'error' ? (
          <>
            {state.expired ? (
              <div className="nwnl-box">
                <ResubscribeForm initialEmail={email ?? ''} />
              </div>
            ) : null}
            <div className="nwnl-actions nwnl-actions--failed">
              {state.retry ? (
                <button type="button" className="nw-btn nwnl-action" onClick={retry}>
                  Try again
                </button>
              ) : null}
              <Link className="nw-outline nwnl-action" to="/">
                Return to Homepage
              </Link>
            </div>
          </>
        ) : null}

        <NewsletterStatusHelp />
      </NewsletterStatusShell>
    </>
  );
}

export default NavigatorNewsletterConfirmPage;
