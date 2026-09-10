/**
 * Module Route Mounter — Lazy Loading
 *
 * All module route handlers are dynamically imported on first request.
 * This is the largest group of routes and the primary contributor
 * to the previous deployment bundle size issue.
 */

import { lazy } from './lazy-router.ts';
import type { Hono } from 'npm:hono';

/**
 * WHERE THE AI SPEND CAPS LIVE — and why they are not here.
 *
 * An earlier version of this file carried the metering: nine prefixes, each
 * mounted with an `aiUsageLimit` guard through a `middleware` option added to
 * `lazy()`. Two things were wrong with it.
 *
 * A prefix guard charges a model-priced quota for every write under it —
 * saving a config, renaming a source, editing a summary — and, because the
 * limiter fails closed, takes that CRUD down whenever the counter service is
 * unavailable. Most of those prefixes are mostly CRUD.
 *
 * And a guard mounted here runs BEFORE the sub-router's own authentication,
 * so it had no verified principal to charge and had to work one out for
 * itself. Every attempt at that was worse than the last: an unverified `sub`
 * claim (which let a stranger drain a named user's quota), then a second auth
 * round trip plus a hand-rolled token verifier outside `auth-mw.ts`.
 *
 * The guards now sit in the route files, after each route's own auth, reading
 * the `userId` that auth already verified. `lazy()` went back to what it was.
 *
 * The inventory of what is metered is not a comment here either — a list
 * nobody recomputes is a list that is wrong, and this one had already missed
 * two endpoints that call OpenAI. `__tests__/ai-usage-limit-coverage.test.ts`
 * recomputes it from the import graph and fails when a provider-calling router
 * has no guard.
 */

export function mountModuleRoutes(app: Hono) {
  lazy(app, '/requests', () => import('./requests-routes.ts'));
  lazy(app, '/esign', () => import('./esign-routes.ts'));
  lazy(app, '/resources', () => import('./resources-routes.ts'));
  lazy(app, '/reporting', () => import('./reporting-routes.ts'));
  lazy(app, '/publications', () => import('./publications-routes.ts'));
  lazy(app, '/publications-ai', () => import('./publications-ai-routes.ts'));
  lazy(app, '/auto-content', () => import('./auto-content-routes.ts'));
  lazy(app, '/personnel', () => import('./client-management-personnel-routes.ts'));
  lazy(app, '/clients', () => import('./client-management-routes.ts'));
  lazy(app, '/communication', () => import('./communication-routes.ts'));
  lazy(app, '/product-management', () => import('./product-management-routes.ts'));
  lazy(app, '/social-marketing', () => import('./social-marketing-routes.ts'));
  lazy(app, '/social-media-ai', () => import('./social-media-ai-routes.ts'));
  lazy(app, '/calendar', () => import('./calendar-routes.ts'));
  lazy(app, '/compliance', () => import('./compliance-routes.ts'));
  lazy(app, '/advice-engine', () => import('./advice-engine-routes.ts'));
  lazy(app, '/applications', () => import('./client-applications-routes.ts'));
  lazy(app, '/newsletter', () => import('./newsletter.ts'));
  lazy(app, '/newsletter-studio', () => import('./newsletter-studio-routes.ts'));
  lazy(app, '/consultation', () => import('./consultation.ts'));
  lazy(app, '/documents', () => import('./documents.ts'));
  lazy(app, '/client-document-summaries', () => import('./client-document-summaries-routes.ts'));
  lazy(app, '/ai-advisor', () => import('./ai-advisor.ts'));
  lazy(app, '/ai-intelligence', () => import('./ai-intelligence.ts'));
  lazy(app, '/todo', () => import('./todo-routes.ts'));
  lazy(app, '/tasks', () => import('./tasks-routes.ts'));
  lazy(app, '/task-checklists', () => import('./tasks-checklist-routes.ts'));
  lazy(app, '/task-comments', () => import('./task-comments-routes.ts'));
  lazy(app, '/goals', () => import('./goal-routes.ts'));
  lazy(app, '/contact-form', () => import('./contact-form-routes.ts'));
  lazy(app, '/quote-request', () => import('./quote-request-routes.ts'));
  lazy(app, '/client-portal', () => import('./client-portal-routes.ts'));
  lazy(app, '/will-chat', () => import('./will-chat-routes.ts'));
  lazy(app, '/brand', () => import('./brand-routes.ts'));
  lazy(app, '/tax-agent', () => import('./tax-agent-routes.ts'));
  lazy(app, '/submissions', () => import('./submissions-routes.ts'));
  lazy(app, '/notes', () => import('./notes-routes.ts'));
  lazy(app, '/transcription', () => import('./transcription-routes.ts'));
  lazy(app, '/tasks-digest', () => import('./tasks-digest-routes.ts'));
  lazy(app, '/calendar-digest', () => import('./calendar-digest-routes.ts'));
  lazy(app, '/goaml-digest', () => import('./goaml-digest-routes.ts'));
  lazy(app, '/client-birthdays', () => import('./client-birthday-routes.ts'));
  lazy(app, '/kv-cleanup', () => import('./kv-cleanup-routes.ts'));
  lazy(app, '/admin-audit', () => import('./admin-audit-routes.ts'));
  lazy(app, '/quality-issues', () => import('./quality-issues-routes.ts'));
  lazy(app, '/csp-report', () => import('./csp-report-routes.ts'));
  lazy(app, '/linktree', () => import('./linktree-routes.ts'));
  lazy(app, '/linkedin', () => import('./linkedin-routes.ts'));
  lazy(app, '/buffer', () => import('./buffer-routes.ts'));
  lazy(app, '/net-worth-snapshots', () => import('./net-worth-snapshot-routes.ts'));
  lazy(app, '/vasco', () => import('./vasco-routes.ts'));
  lazy(app, '/ai-management', () => import('./ai-management-routes.ts'));
  lazy(app, '/openclaw', () => import('./openclaw-routes.ts'));
  lazy(app, '/prefill', () => import('./form-prefill-routes.ts'));
  lazy(app, '/refund-clusters', () => import('./locked/refund-clusters-routes.ts'));
  lazy(app, '/treasury', () => import('./locked/treasury-routes.ts'));
  lazy(app, '/issuing', () => import('./locked/issuing-routes.ts'));
  lazy(app, '/form-templates', () => import('./form-template-routes.ts'));
}
