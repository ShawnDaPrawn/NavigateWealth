import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { getAuthenticatedRedirectPath } from '../auth/RouteGuards';
import { useIsArticleBrowserEscape } from '../../hooks/useIsArticleBrowserEscape';
import { SITE_ORIGIN } from '../../utils/siteOrigin';

/**
 * Builds the canonical public-website URL for the current article so the link
 * always opens on the website host, even if the PWA happens to be running on a
 * different origin (e.g. an apex vs. www variant).
 */
function buildWebsiteArticleUrl(pathname: string, search: string): string {
  return `${SITE_ORIGIN}${pathname}${search}`;
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
 * there; where that is blocked (no user gesture on launch) the tappable button
 * guarantees the article still opens in the browser.
 *
 * In a normal browser tab this renders nothing, so the website is unaffected and
 * the article page renders as usual.
 */
export function ArticleBrowserRedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  // Tracks the last article URL we auto-opened so a single article is only
  // launched once, while a second article opened later still gets its attempt.
  const lastAutoOpened = useRef<string | null>(null);

  const active = useIsArticleBrowserEscape();
  const websiteUrl = buildWebsiteArticleUrl(location.pathname, location.search);

  useEffect(() => {
    if (!active || lastAutoOpened.current === websiteUrl) return;

    lastAutoOpened.current = websiteUrl;
    // Best-effort: capable browsers open the website immediately. With noopener
    // this returns null even on success, so we never rely on the result — the
    // interstitial button below is the guaranteed path.
    try {
      window.open(websiteUrl, '_blank', 'noopener,noreferrer');
    } catch {
      // Ignore — the user can still tap the button to open the article.
    }
  }, [active, websiteUrl]);

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
          onClick={() => navigate(portalTarget, { replace: true })}
          className="mt-4 text-sm font-medium text-gray-500 underline-offset-4 hover:text-gray-700 hover:underline"
        >
          Continue to the app instead
        </button>
      </div>
    </div>
  );
}
