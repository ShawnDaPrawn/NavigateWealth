/**
 * Newsletter click-through — records a campaign link click (which is also the
 * "open" on this pixel-free platform) and forwards to the author-stored
 * destination. The destination comes only from the server, so a crafted URL
 * cannot turn this page into an open redirect.
 */
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ExternalLink, Loader2, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { api } from '../../utils/api/client';
import { SEO } from '../seo/SEO';
import { SITE_DESIGN } from '../../site/design';
import { NEWSLETTER_CLICK_SEO as seoProps } from './newsletterStatusData';

const NavigatorNewsletterClickThroughPage = React.lazy(() =>
  import('../../site/pages/NavigatorNewsletterClickThroughPage').then((m) => ({
    default: m.NavigatorNewsletterClickThroughPage,
  })),
);

/**
 * The build's design switch picks the layout; both record the click and
 * forward to the server-issued destination in exactly the same way.
 */
export function NewsletterClickThroughPage() {
  if (SITE_DESIGN === 'navigator') {
    return (
      <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
        <NavigatorNewsletterClickThroughPage />
      </Suspense>
    );
  }
  return <LegacyNewsletterClickThroughPage />;
}

function LegacyNewsletterClickThroughPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<'working' | 'ready' | 'error'>('working');
  const [destination, setDestination] = useState<string | null>(null);
  const startedRef = useRef(false);

  const campaignId = searchParams.get('c');
  const token = searchParams.get('t');
  const linkId = searchParams.get('l');

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

  return (
    <>
      <SEO {...seoProps} />
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            {state === 'working' ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">Taking you to your link…</p>
              </>
            ) : state === 'ready' && destination ? (
              <>
                <ExternalLink className="h-8 w-8 text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  If you are not redirected automatically:
                </p>
                <Button asChild>
                  <a href={destination} rel="noopener noreferrer">
                    Continue to link
                  </a>
                </Button>
              </>
            ) : (
              <>
                <Mail className="h-8 w-8 text-muted-foreground" aria-hidden />
                <p className="font-medium">This link is no longer available</p>
                <p className="text-sm text-muted-foreground">
                  The newsletter link may have expired or been removed.
                </p>
                <Button asChild variant="outline">
                  <Link to="/">Go to Navigate Wealth</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default NewsletterClickThroughPage;
