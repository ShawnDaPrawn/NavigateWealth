/**
 * Shell entry — what the admin frame needs from this module before the
 * module itself is opened. Keep it to light, side-effect-free re-exports: see
 * the "Shell entries" note in
 * `src/components/admin/moduleLoaders.ts`.
 */
import { lazy } from 'react';

/**
 * Main module component. The module owns its own code-splitting boundary, so
 * the admin frame renders it inside <Suspense> without a second React.lazy
 * (wrapping a lazy component in lazy() again is React error #306).
 */
export const SocialMediaModule = lazy(() =>
  import('./SocialMediaModule').then((m) => ({ default: m.SocialMediaModule })),
);

export { SocialMediaSkeleton } from './components/SocialMediaSkeleton';
