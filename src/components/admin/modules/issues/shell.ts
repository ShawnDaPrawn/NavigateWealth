/**
 * Shell entry — what the admin frame needs from this module before the
 * module itself is opened. Keep it to light, side-effect-free re-exports: see
 * the "Shell entries" note in
 * `src/components/admin/moduleLoaders.ts`.
 */
import { lazy } from 'react';

/**
 * The module owns its own code-splitting boundary. Render it inside a
 * <Suspense>; do not wrap it in a second React.lazy (React error #306).
 */
export const IssuesModule = lazy(() => import('./IssuesModule'));

export { IssuesSkeleton } from './components/IssuesSkeleton';
