/**
 * NavigatorNewsletterClickThroughPage — the redesigned newsletter link
 * forwarder (/newsletter/click?c=…&t=…&l=…), the "Newsletter Click" board of
 * the Website Redesign canvas.
 *
 * It does exactly what the live page (NewsletterClickThroughPage.tsx) does:
 * one POST of the campaign, recipient token and link ids to the public
 * click-tracking route — once, even when React runs the effect twice — then
 * `location.replace` to the URL in the server's answer, with a manual link in
 * case the browser does not follow. The destination comes only from the
 * server, never from the address bar, so a crafted link cannot turn this page
 * into an open redirect. Missing ids, a refusal or an answer without a URL
 * show "This link is no longer available". It emits the same SEO tags.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { SEO } from '../../components/seo/SEO';
import { NEWSLETTER_CLICK_SEO } from '../../components/pages/newsletterStatusData';
import { api } from '../../utils/api/client';
import { ICON_INK, ICON_TEXT, NewsletterStatusIcon } from '../sections/NewsletterStatusIcons';
import { NewsletterStatusBadge, NewsletterStatusShell } from '../sections/NewsletterStatusShell';
import '../styles/navigator.css';
import '../styles/newsletter-status.css';

const WORKING = 'Taking you to your link…';

export function NavigatorNewsletterClickThroughPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<'working' | 'ready' | 'error'>('working');
  const [destination, setDestination] = useState<string | null>(null);
  const startedRef = useRef(false);

  const campaignId = searchParams.get('c');
  const token = searchParams.get('t');
  const linkId = searchParams.get('l');

  // The live page's request and redirect, unchanged.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const follow = async () => {
      if (!campaignId || !token || !linkId) {
        setState('error');
        return;
      }
      try {
        const response = await api.post<{ url: string }>('newsletter-studio/track/click', {
          campaignId,
          token,
          linkId,
        });
        if (response?.url) {
          setDestination(response.url);
          setState('ready');
          window.location.replace(response.url);
        } else {
          setState('error');
        }
      } catch {
        setState('error');
      }
    };
    void follow();
  }, [campaignId, token, linkId]);

  // As on the live page: "ready" only with a destination to offer.
  const view =
    state === 'working' ? 'working' : state === 'ready' && destination ? 'ready' : 'error';

  return (
    <>
      <SEO {...NEWSLETTER_CLICK_SEO} />
      <NewsletterStatusShell
        label="Newsletter link"
        accent={view === 'working' ? 'track' : view === 'ready' ? 'ink' : 'quiet'}
        narrow
        column
      >
        <div className={`nwnl-state nwnl-state--${view}`}>
          {view === 'working' ? (
            <NewsletterStatusBadge
              icon="spinner"
              iconSize={30}
              stroke={ICON_INK}
              tone="plain"
              small
            />
          ) : view === 'ready' ? (
            <NewsletterStatusBadge
              icon="external"
              iconSize={28}
              stroke={ICON_INK}
              tone="plain"
              small
            />
          ) : (
            <NewsletterStatusBadge
              icon="mail"
              iconSize={28}
              stroke={ICON_TEXT}
              tone="quiet"
              small
            />
          )}

          <div className="nwnl-say" aria-live="polite" aria-atomic="true">
            {view === 'working' ? <h1 className="nwnl-lead">{WORKING}</h1> : null}
            {view === 'ready' ? (
              <>
                <h1 className="nw-sr-only">{WORKING}</h1>
                <p className="nwnl-click-text">If you are not redirected automatically:</p>
              </>
            ) : null}
            {view === 'error' ? (
              <>
                <h1 className="nwnl-lead">This link is no longer available</h1>
                <p className="nwnl-click-note">
                  The newsletter link may have expired or been removed.
                </p>
              </>
            ) : null}
          </div>

          {view === 'ready' && destination ? (
            <a className="nw-btn nwnl-action nwnl-go" href={destination} rel="noopener noreferrer">
              Continue to link
              <NewsletterStatusIcon name="arrowRight" size={16} />
            </a>
          ) : null}

          {view === 'error' ? (
            <div className="nwnl-actions nwnl-actions--click">
              <Link className="nw-btn nwnl-action" to="/">
                Go to Navigate Wealth
              </Link>
              <Link className="nw-outline nwnl-action" to="/resources?section=newsletters">
                Browse past newsletters
              </Link>
            </div>
          ) : null}
        </div>
      </NewsletterStatusShell>
    </>
  );
}

export default NavigatorNewsletterClickThroughPage;
