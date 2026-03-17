/**
 * Social Media Module - Main Exports
 *
 * Barrel file for the Social Media module.
 * Only exports the top-level components needed by external consumers.
 * Internal imports within the module use direct relative paths.
 *
 * @module social-media
 */

// Main Module Component (used by AdminDashboardPage lazy import)
export { SocialMediaModule } from './SocialMediaModule';

// Sub-Components (used by intra-module consumers)
export { SocialMediaTab } from './SocialMediaTab';
export { PublicationsTab } from './PublicationsTab';
export { LinktreeTab } from './LinktreeTab';
export { PostComposer } from './PostComposer';
export { PostCalendar } from './PostCalendar';
export { ProfileConnector } from './ProfileConnector';
export { SocialAnalytics } from './SocialAnalytics';
