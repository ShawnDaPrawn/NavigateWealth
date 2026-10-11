/**
 * Social Media Module - Main Exports
 *
 * Barrel file for the Social Media module.
 * Only exports the top-level components needed by external consumers.
 * Internal imports within the module use direct relative paths.
 *
 * @module social-media
 */

// Main module component — lazy, defined in the shell entry so the admin frame
// can render it without importing this barrel. See ./shell.ts.
export { SocialMediaModule } from './shell';

// Sub-Components (used by intra-module consumers)
export { SocialMediaTab } from './SocialMediaTab';
export { PublicationsTab } from './PublicationsTab';
export { LinktreeTab } from './LinktreeTab';
export { PostComposer } from './PostComposer';
export { PostCalendar } from './PostCalendar';
export { ChannelsPanel } from './ChannelsPanel';
export { WeeklyPipelineTab } from './assets/WeeklyPipelineTab';
export { ChannelAssetsTab } from './channel-assets/ChannelAssetsTab';
export { SocialAnalytics } from './SocialAnalytics';

// --- public API used by other modules and by code outside admin/modules ---
export { linkedinApi } from './api';
export { SocialMediaSkeleton } from './components/SocialMediaSkeleton';

/**
 * Warm this module's chunk before it is rendered.
 *
 * `preloadAdminModule` calls this on navigation intent so the chunk downloads
 * while the pointer is on the sidebar item rather than after the click.
 *
 * `import()` caches, so calling this repeatedly costs nothing after the first.
 */
export const preloadSocialMediaModule = () => import('./SocialMediaModule');
