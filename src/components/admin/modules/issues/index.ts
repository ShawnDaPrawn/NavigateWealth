import { lazy } from 'react';

/**
 * The module owns its own code-splitting boundary: its one consumer used to
 * React.lazy the deep path, which is what forced it past this barrel. Lazying
 * it here means that consumer makes an ordinary import of this barrel while
 * the chunk still loads on demand. Render it inside a <Suspense>.
 */
export const IssuesModule = lazy(() => import('./IssuesModule'));

// --- public API used by other modules and by code outside admin/modules ---
export { IssuesSkeleton } from './components/IssuesSkeleton';

/**
 * Warm this module's chunk before it is rendered.
 *
 * This barrel is imported eagerly by AdminDashboardPage (its component is
 * already lazy here, so wrapping it again would break the lazy contract), which
 * means the barrel is in the initial bundle but `IssuesModule` is not.
 * `preloadAdminModule` calls this on navigation intent so the chunk downloads
 * while the pointer is on the sidebar item rather than after the click.
 *
 * `import()` caches, so calling this repeatedly costs nothing after the first.
 */
export const preloadIssuesModule = () => import('./IssuesModule');
