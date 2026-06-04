import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { getAuthenticatedRedirectPath } from '../auth/RouteGuards';

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone = (window.navigator as NavigatorWithStandalone).standalone === true;
  return standalone || iosStandalone;
}

// Public marketing routes. When the app runs as an installed PWA we want it to
// behave as a portal-only app, so landing on any of these bounces the user back
// into the portal. This is an explicit ALLOWLIST (not the inverse) so that any
// unknown or portal route is never redirected by accident — the safe failure
// mode is "show the page", not "wrongly redirect a portal page".
const MARKETING_EXACT = new Set([
  '/',
  '/about',
  '/team',
  '/services',
  '/contact',
  '/schedule-consultation',
  '/sitemap',
  '/design-system',
  '/ask-vasco',
  '/why-us',
  '/careers',
  '/press',
  '/links',
  '/og-preview',
  '/risk-management',
  '/retirement-planning',
  '/investment-management',
  '/employee-benefits',
  '/tax-planning',
  '/financial-planning',
  '/estate-planning',
  '/medical-aid',
]);

const MARKETING_PREFIXES = ['/resources', '/legal', '/get-quote', '/solutions/'];

function isMarketingRoute(pathname: string): boolean {
  if (MARKETING_EXACT.has(pathname)) return true;
  return MARKETING_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Keeps the installed PWA focused on the client portal.
 *
 * When running in standalone (installed) mode, navigating to a public marketing
 * route redirects the user into the portal — to their dashboard if signed in,
 * otherwise to the sign-in page. In a normal browser tab this is a no-op, so the
 * full website remains accessible on the web.
 */
export function StandaloneRedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isStandaloneDisplay()) return;
    if (!isMarketingRoute(location.pathname)) return;

    const target = isAuthenticated ? getAuthenticatedRedirectPath(user) : '/login';
    if (location.pathname !== target) {
      navigate(target, { replace: true });
    }
  }, [location.pathname, isAuthenticated, user, navigate]);

  return null;
}
