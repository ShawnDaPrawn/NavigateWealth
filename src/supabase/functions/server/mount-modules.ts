/**
 * Module Route Mounter — Lazy Loading
 * 
 * All module route handlers are dynamically imported on first request.
 * This is the largest group of routes and the primary contributor
 * to the previous deployment bundle size issue.
 */

import { lazy } from './lazy-router.ts';
import type { Hono } from 'npm:hono';

export function mountModuleRoutes(app: Hono) {
  lazy(app, '/requests',              () => import('./requests-routes.ts'));
  lazy(app, '/esign',                 () => import('./esign-routes.ts'));
  lazy(app, '/resources',             () => import('./resources-routes.ts'));
  lazy(app, '/reporting',             () => import('./reporting-routes.ts'));
  lazy(app, '/publications',          () => import('./publications-routes.ts'));
  lazy(app, '/publications-ai',      () => import('./publications-ai-routes.ts'));
  lazy(app, '/auto-content',          () => import('./auto-content-routes.ts'));
  lazy(app, '/personnel',             () => import('./client-management-personnel-routes.ts'));
  lazy(app, '/clients',               () => import('./client-management-routes.ts'));
  lazy(app, '/communication',         () => import('./communication-routes.ts'));
  lazy(app, '/product-management',    () => import('./product-management-routes.ts'));
  lazy(app, '/social-marketing',      () => import('./social-marketing-routes.ts'));
  lazy(app, '/social-media-ai',       () => import('./social-media-ai-routes.ts'));
  lazy(app, '/calendar',              () => import('./calendar-routes.ts'));
  lazy(app, '/compliance',            () => import('./compliance-routes.ts'));
  lazy(app, '/advice-engine',         () => import('./advice-engine-routes.ts'));
  lazy(app, '/applications',          () => import('./client-applications-routes.ts'));
  lazy(app, '/newsletter',            () => import('./newsletter.ts'));
  lazy(app, '/consultation',          () => import('./consultation.ts'));
  lazy(app, '/documents',             () => import('./documents.ts'));
  lazy(app, '/ai-advisor',            () => import('./ai-advisor.ts'));
  lazy(app, '/ai-intelligence',       () => import('./ai-intelligence.ts'));
  lazy(app, '/todo',                  () => import('./todo-routes.ts'));
  lazy(app, '/tasks',                 () => import('./tasks-routes.ts'));
  lazy(app, '/task-checklists',       () => import('./tasks-checklist-routes.ts'));
  lazy(app, '/task-comments',         () => import('./task-comments-routes.ts'));
  lazy(app, '/goals',                 () => import('./goal-routes.ts'));
  lazy(app, '/contact-form',          () => import('./contact-form-routes.ts'));
  lazy(app, '/quote-request',         () => import('./quote-request-routes.ts'));
  lazy(app, '/client-portal',         () => import('./client-portal-routes.ts'));
  lazy(app, '/will-chat',             () => import('./will-chat-routes.ts'));
  lazy(app, '/brand',                 () => import('./brand-routes.ts'));
  lazy(app, '/tax-agent',             () => import('./tax-agent-routes.ts'));
  lazy(app, '/submissions',           () => import('./submissions-routes.ts'));
  lazy(app, '/notes',                 () => import('./notes-routes.ts'));
  lazy(app, '/transcription',        () => import('./transcription-routes.ts'));
  lazy(app, '/tasks-digest',         () => import('./tasks-digest-routes.ts'));
  lazy(app, '/calendar-digest',      () => import('./calendar-digest-routes.ts'));
  lazy(app, '/kv-cleanup',           () => import('./kv-cleanup-routes.ts'));
  lazy(app, '/admin-audit',          () => import('./admin-audit-routes.ts'));
  lazy(app, '/quality-issues',       () => import('./quality-issues-routes.ts'));
  lazy(app, '/linktree',             () => import('./linktree-routes.ts'));
  lazy(app, '/linkedin',             () => import('./linkedin-routes.ts'));
  lazy(app, '/net-worth-snapshots',  () => import('./net-worth-snapshot-routes.ts'));
  lazy(app, '/vasco',                () => import('./vasco-routes.ts'));
  lazy(app, '/ai-management',       () => import('./ai-management-routes.ts'));
}
