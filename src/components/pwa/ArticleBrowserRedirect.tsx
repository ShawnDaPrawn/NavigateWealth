import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { getAuthenticatedRedirectPath } from '../auth/RouteGuards';
import { useIsArticleBrowserEscape } from '../../hooks/useIsArticleBrowserEscape';
import { claimEscapeAttempt } from '../../utils/pwa/articleEscapeAttempt';
import { SITE_ORIGIN_APEX } from '../../utils/siteOrigin';

/**
 * Builds the article URL on the APEX origin — never the canonical www host.
 *
 * The www origin is INSIDE the installed PWA's scope, so opening a www URL from
 * here gets captured straight back into the app on Android and the client never
 * reaches the article. The apex is outside that scope, and it *serves* article
 * pages rather than redirecting them to www (see the `/resources/article/`
 * exclusion on the apex redirect in `vercel.json`) — which matters, because
 * Android applies link capture to server redirects too, so an apex link that
 * 301s into www would be handed back to the app exactly as a www link is.
 *
 * The query string is preserved so the `nt` engagement token still reaches the
 * website article page.
 */
function buildWebsiteArticleUrl(pathname: string, search: string): string {
  return `${SITE_ORIGIN_APEX}${pathname}${search}`;
}

/**
 * Sends a client to the public website when they open an article link from the
 * installed PWA.
 *
 * Clients receive article links by email. On some devices (notably Android with
 * "open supported links" enabled) tapping that link launches the installed PWA
 * instead of the browser. The PWA is a portal-only app, so the client would
 * otherwise be bounced to the sign-in screen and never reach the article.
 *
 * When we detect that situation — standalone display mode on an article route —
 * we surface a focused interstitial that opens the article on the website. We
 * also fire a single best-effort `window.open` so capable browsers jump straight
 * there. That attempt is claimed through `claimEscapeAttempt`, which survives a
 * relaunch of the app: if the hand-off bounces back into the PWA the second
 * mount will not fire again, so the client sees one calm screen rather than the
 * browser and the app trading the link back and forth. From there the button
 * (or, if the device insists on capturing the link, the copied URL) opens the
 * article.
 *
 * In a normal browser tab this renders nothing, so the website is unaffected and
 * the article page renders as usual.
 */
export function ArticleBrowserRedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [copied, setCopied] = useState(false);

  const active = useIsArticleBrowserEscape();
  const websiteUrl = buildWebsiteArticleUrl(location.pathname, location.search);

  useEffect(() => {
    if (!active) return;
    // Claiming records the attempt where a relaunch can still see it, so a
    // hand-off that bounces back into the app does not fire a second time.
    if (!claimEscapeAttempt(websiteUrl)) return;

    // Best-effort: capable browsers open the website immediately. With noopener
    // this returns null even on success, so we never rely on the result — the
    // interstitial button below is the guaranteed path.
    try {
      window.open(websiteUrl, '_blank', 'noopener,noreferrer');
    } catch {
      // Ignore — the user can still tap the button to open the article.
    }
  }, [active, websiteUrl]);

  const handleCopy = useCallback(() => {
    void navigator.clipboard
      ?.writeText(websiteUrl)
      .then(() => setCopied(true))
      .catch(() => {
        // Clipboard denied — the button above still opens the article.
      });
  }, [websiteUrl]);

  if (!active) return null;

  const portalTarget = isAuthenticated ? getAuthenticatedRedirectPath(user) : '/login';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Open article on the web"
      className="fixed inset-0 z-[1000] overflow-y-auto bg-gradient-to-b from-purple-50 via-white to-white"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-5 py-10 text-center">
        <img
          src="/maskable-icon-512x512.png?v=20260627"
          alt="Navigate Wealth"
          width={64}
          height={64}
          className="h-16 w-16 rounded-2xl shadow-md ring-1 ring-black/5"
        />
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-gray-900">
          Opening this article on the web
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Articles open on the Navigate Wealth website. If it doesn&apos;t open automatically, tap
          the button below.
        </p>

        <a
          href={websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-7 inline-flex w-full items-center justify-center rounded-2xl bg-purple-700 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-purple-900/10 transition-colors hover:bg-purple-800"
        >
          Read article in browser
        </a>

        <button
          type="button"
          onClick={handleCopy}
          className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          {copied ? 'Link copied — paste it in your browser' : 'Copy article link'}
        </button>

        <button
          type="button"
          onClick={() => navigate(portalTarget, { replace: true })}
          className="mt-4 text-sm font-medium text-gray-500 underline-offset-4 hover:text-gray-700 hover:underline"
        >
          Continue to the app instead
        </button>
      </div>
    </div>
  );
}
