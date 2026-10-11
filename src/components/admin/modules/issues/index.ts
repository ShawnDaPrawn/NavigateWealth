// Main module component — lazy, defined in the shell entry so the admin frame
// can render it without importing this barrel. See ./shell.ts.
export { IssuesModule } from './shell';

// --- public API used by other modules and by code outside admin/modules ---
export { IssuesSkeleton } from './components/IssuesSkeleton';

/**
 * Warm this module's chunk before it is rendered.
 *
 * `preloadAdminModule` calls this on navigation intent so the chunk downloads
 * while the pointer is on the sidebar item rather than after the click.
 *
 * `import()` caches, so calling this repeatedly costs nothing after the first.
 */
export const preloadIssuesModule = () => import('./IssuesModule');
