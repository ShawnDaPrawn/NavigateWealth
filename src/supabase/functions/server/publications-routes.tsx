/**
 * Publications API Routes — composition root (Phase 5c decomposition).
 * ====================================================================
 *
 * This file is a thin mount: every route group lives in its own
 * publications-<group>-routes.ts sub-app and is mounted below, path-preserving,
 * via `publications.route('/', xRoutes)`. Shared types/helpers live in
 * publications-route-helpers.ts. Mounted at /publications by mount-modules.ts
 * (through the publications-routes.ts proxy).
 */
import { Hono } from 'npm:hono';
import taxonomyRoutes from './publications-taxonomy-routes.ts';
import articlesRoutes from './publications-articles-routes.ts';
import notificationsRoutes from './publications-notifications-routes.ts';
import lifecycleRoutes from './publications-lifecycle-routes.ts';
import tagsSchedulingRoutes from './publications-tags-scheduling-routes.ts';
import adminRoutes from './publications-admin-routes.ts';
import siteRoutes from './publications-site-routes.ts';

// Re-export the public domain types so the publications-routes.ts proxy (and any
// external importer) keeps the same surface after the Phase 5c extraction.
export type {
  ArticleCategory,
  ArticleType,
  Article,
  ArticleTag,
  ArticleTagLink,
} from './publications-route-helpers.ts';

const publications = new Hono();

// Root handlers
publications.get('/', (c) => c.json({ service: 'publications', status: 'active' }));
publications.get('', (c) => c.json({ service: 'publications', status: 'active' }));

// --- Mounted route sub-apps (Phase 5c decomposition) ---
publications.route('/', taxonomyRoutes);
publications.route('/', articlesRoutes);
publications.route('/', notificationsRoutes);
publications.route('/', lifecycleRoutes);
publications.route('/', tagsSchedulingRoutes);
publications.route('/', adminRoutes);
publications.route('/', siteRoutes);

export default publications;
