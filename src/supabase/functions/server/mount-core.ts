/**
 * Core Route Mounter — Lazy Loading
 * 
 * All route modules are dynamically imported on first request
 * to reduce boot time and deployment bundle pressure.
 * 
 * ORDERING: More specific paths must be registered before less specific ones
 * sharing the same prefix (e.g. /admin/onboarding before /admin).
 * 
 * Updated: 2026-02-21 — .tsx extension proxies installed for all modules
 */

import { lazy } from './lazy-router.ts';
import type { Hono } from 'npm:hono';

export function mountCoreRoutes(app: Hono) {
  // Mount more-specific /admin/onboarding BEFORE /admin to avoid prefix collision
  lazy(app, '/admin/onboarding', () => import('./admin-client-onboarding-routes.ts'));
  lazy(app, '/admin',            () => import('./applications-routes.ts'));
  lazy(app, '/auth-signup',      () => import('./auth-signup.ts'));
  lazy(app, '/auth',             () => import('./auth-routes.ts'));
  lazy(app, '/profile',          () => import('./client-management-profile-routes.ts'));
  lazy(app, '/security',         () => import('./security.ts'));
  lazy(app, '/setup',            () => import('./setup.ts'));
  lazy(app, '/sitemap',          () => import('./sitemap.ts'));
  lazy(app, '/rss-proxy',        () => import('./rss-proxy.ts'));

  // Mount /integrations/honeycomb BEFORE generic /integrations
  lazy(app, '/integrations/honeycomb', () => import('./honeycomb-routes.ts'));
  lazy(app, '/integrations',          () => import('./integrations.ts'));

  lazy(app, '/kv-store',         () => import('./kv-routes.ts'));
}
