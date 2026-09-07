/**
 * Social Media Module - Main Exports
 *
 * Barrel file for the Social Media module.
 * Only exports the top-level components needed by external consumers.
 * Internal imports within the module use direct relative paths.
 *
 * @module social-media
 */

import { lazy } from 'react';

/**
 * Main module component. The module owns its own code-splitting boundary:
 * AdminDashboardPage used to React.lazy the deep path, which is what forced it
 * past this barrel. Lazying it here means the dashboard makes an ordinary
 * import of this barrel while the chunk still loads on demand.
 */
export const SocialMediaModule = lazy(() =>
  import('./SocialMediaModule').then((m) => ({ default: m.SocialMediaModule })),
);

// Sub-Components (used by intra-module consumers)
export { SocialMediaTab } from './SocialMediaTab';
export { PublicationsTab } from './PublicationsTab';
export { LinktreeTab } from './LinktreeTab';
export { PostComposer } from './PostComposer';
export { PostCalendar } from './PostCalendar';
export { ProfileConnector } from './ProfileConnector';
export { SocialAnalytics } from './SocialAnalytics';

// --- public API used by other modules and by code outside admin/modules ---
export { linkedinApi } from './api';
export { SocialMediaSkeleton } from './components/SocialMediaSkeleton';

/**
 * Warm this module's chunk before it is rendered.
 *
 * This barrel is imported eagerly by AdminDashboardPage (its component is
 * already lazy here, so wrapping it again would break the lazy contract), which
 * means the barrel is in the initial bundle but `SocialMediaModule` is not.
 * `preloadAdminModule` calls this on navigation intent so the chunk downloads
 * while the pointer is on the sidebar item rather than after the click.
 *
 * `import()` caches, so calling this repeatedly costs nothing after the first.
 */
export const preloadSocialMediaModule = () => import('./SocialMediaModule');
