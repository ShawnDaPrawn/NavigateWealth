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
