/**
 * NavigatorNewsletterUnsubscribePage — the redesigned unsubscribe page
 * (/newsletter/unsubscribe?email=…), the "Newsletter Unsubscribe" board of the
 * Website Redesign canvas.
 *
 * It does what the live page (NewsletterUnsubscribePage.tsx) does: nothing
 * until the visitor presses Unsubscribe, then one GET to the public
 * unsubscribe route through the shared API client, with the live page's
 * states and words. Without an address in the link the button stays
 * disabled, as it does on the live page. It emits the same SEO tags.
 *
 * Beyond the live page, as the board draws it: after an opt-out the visitor
 * can subscribe the same address again in place, exactly as the site footer
 * subscribes (a new confirmation email, double opt-in).
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { SEO } from '../../components/seo/SEO';
import { NEWSLETTER_UNSUBSCRIBE_SEO } from '../../components/pages/newsletterStatusData';
import { api } from '../../utils/api/client';
import { ICON_DANGER, ICON_INK, ICON_SUCCESS } from '../sections/NewsletterStatusIcons';
import { ResubscribeOffer } from '../sections/NewsletterStatusResubscribe';
import {
  NewsletterStatusBadge,
  NewsletterStatusHelp,
  NewsletterStatusShell,
} from '../sections/NewsletterStatusShell';
import '../styles/navigator.css';
import '../styles/newsletter-status.css';

type Status = 'initial' | 'loading' | 'success' | 'error';

export function NavigatorNewsletterUnsubscribePage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>('initial');
  const [message, setMessage] = useState('');

  const email = searchParams.get('email');

  // The live page's handler, unchanged.
  const handleUnsubscribe = async () => {
    if (!email) {
      setStatus('error');
      setMessage('Invalid unsubscribe link. Please use the link from your email.');
      return;
    }

    setStatus('loading');

    try {
      const data = await api.get<{ notFound?: boolean }>(
        `/newsletter/unsubscribe?email=${encodeURIComponent(email)}`,
      );

      if (data.notFound) {
        setStatus('error');
        setMessage('Subscription not found. You may have already unsubscribed.');
      } else {
        setStatus('success');
        setMessage(
          "You have been successfully unsubscribed from our newsletter. We're sorry to see you go!",
        );
      }
    } catch (error) {
      console.error('Unsubscribe error:', error);
      setStatus('error');
      setMessage('An error occurred while unsubscribing. Please try again later.');
    }
  };

  return (
    <>
      <SEO {...NEWSLETTER_UNSUBSCRIBE_SEO} />
      <NewsletterStatusShell
        label="Newsletter"
        accent={
          status === 'initial'
            ? 'ink'
            : status === 'loading'
              ? 'wait'
              : status === 'success'
                ? 'success'
                : 'danger'
        }
      >
        {status === 'initial' ? (
          <NewsletterStatusBadge icon="mail" iconSize={32} stroke={ICON_INK} tone="ring" />
        ) : status === 'loading' ? (
          <NewsletterStatusBadge icon="spinner" iconSize={34} stroke={ICON_INK} tone="plain" />
        ) : status === 'success' ? (
          <NewsletterStatusBadge icon="check" iconSize={34} stroke={ICON_SUCCESS} tone="success" />
        ) : (
          <NewsletterStatusBadge icon="cross" iconSize={32} stroke={ICON_DANGER} tone="danger" />
        )}

        <div aria-live="polite" aria-atomic="true">
          {status === 'initial' ? (
            <>
              <h1 className="nwnl-title">Unsubscribe from Newsletter</h1>
              <p className="nwnl-text">
                We're sorry to see you go! Click the button below to unsubscribe from Navigate
                Wealth's newsletter.
              </p>
            </>
          ) : status === 'loading' ? (
            <>
              <h1 className="nwnl-title nwnl-title--sm">Processing Unsubscribe</h1>
              <p className="nwnl-text nwnl-text--short">Please wait...</p>
            </>
          ) : (
            <>
              <h1 className="nwnl-title nwnl-title--sm">
                {status === 'success' ? 'Unsubscribed Successfully' : 'Unsubscribe Failed'}
              </h1>
              <p className="nwnl-text">{message}</p>
            </>
          )}
        </div>

        {status === 'initial' ? (
          <>
            {email ? (
              <div className="nwnl-chip">
                Email: <strong>{email}</strong>
              </div>
            ) : null}
            <div className="nwnl-actions nwnl-actions--choose">
              <Link className="nw-btn nwnl-action" to="/">
                Keep Subscription &amp; Return Home
              </Link>
              <button
                type="button"
                className="nwnl-danger"
                onClick={handleUnsubscribe}
                disabled={!email}
              >
                Unsubscribe
              </button>
            </div>
            <p className="nwnl-aside">
              You can always resubscribe later by signing up again on our website.
            </p>
          </>
        ) : null}

        {status === 'success' && email ? (
          <>
            <Link className="nw-btn nwnl-action nwnl-action--solo" to="/">
              Return to Homepage
            </Link>
            <div className="nwnl-offer">
              <ResubscribeOffer email={email} />
            </div>
          </>
        ) : null}

        {status === 'error' ? (
          <Link className="nw-outline nwnl-action nwnl-action--solo" to="/">
            Return to Homepage
          </Link>
        ) : null}

        <NewsletterStatusHelp />
      </NewsletterStatusShell>
    </>
  );
}

export default NavigatorNewsletterUnsubscribePage;
