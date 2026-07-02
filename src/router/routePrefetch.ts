/**
 * Route-chunk prefetching for the authenticated client app.
 *
 * Every page in AppRoutes is `React.lazy()`, so navigating to a page blocks on
 * downloading that page's JS chunk — and while it downloads, the full-screen
 * BrandPageLoader replaces the entire app shell. That per-click network
 * round-trip is what makes in-app navigation feel like it "loads for a few
 * seconds" every time.
 *
 * Calling a route's dynamic-import factory ahead of time downloads and evaluates
 * the exact same chunk React.lazy will use (Vite/Rollup dedupe dynamic imports
 * by resolved module, not by the literal import string), so by the time the user
 * clicks the link the module is already cached and the navigation is instant with
 * no loader flash.
 *
 * Prefetching is gated to the client app (driven by DashboardNavigation) so we
 * never spend an anonymous visitor's bandwidth on dashboard chunks they will
 * never see.
 */

type RouteLoader = () => Promise<unknown>;

// Path → dynamic import. These mirror the lazy imports in AppRoutes.tsx; keeping
// them in sync warms the same chunks the router loads on navigation.
const CLIENT_ROUTE_LOADERS: Record<string, RouteLoader> = {
  '/dashboard': () => import('../components/pages/HomeDashboardPage'),
  '/products-services-dashboard': () => import('../components/pages/ProductsServicesDashboardPage'),
  '/ai-advisor': () => import('../components/pages/AIAdvisorPage'),
  '/communication': () => import('../components/client/communication/CommunicationPage'),
  '/e-signatures': () => import('../components/client/e-sign/ClientEsignHistoryPage'),
  '/history': () => import('../components/pages/HistoryPage'),
  '/profile': () => import('../components/pages/ProfilePage'),
  '/security': () => import('../components/pages/SecuritySettingsPage'),
};

const prefetched = new Set<string>();

/**
 * Warm a single route's JS chunk. Safe to call repeatedly (e.g. on every hover) —
 * each path is fetched at most once.
 */
export function prefetchRoute(path: string): void {
  const loader = CLIENT_ROUTE_LOADERS[path];
  if (!loader || prefetched.has(path)) return;
  prefetched.add(path);
  // A prefetch failure must never surface to the user — drop it from the set so
  // the real navigation can retry and surface any genuine error itself.
  void loader().catch(() => {
    prefetched.delete(path);
  });
}

/**
 * Prefetch every primary client route during browser idle time. Returns a
 * cleanup function that cancels the scheduled work if the caller unmounts before
 * it runs. Uses requestIdleCallback (when available) so warming never competes
 * with rendering or data fetching on the page the user is currently looking at.
 */
export function prefetchClientRoutesWhenIdle(): () => void {
  const run = () => {
    for (const path of Object.keys(CLIENT_ROUTE_LOADERS)) {
      prefetchRoute(path);
    }
  };

  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(run, { timeout: 2000 });
    return () => window.cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(run, 1500);
  return () => window.clearTimeout(handle);
}
