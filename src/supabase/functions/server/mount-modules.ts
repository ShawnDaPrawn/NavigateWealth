/**
 * Module Route Mounter — Lazy Loading
 *
 * All module route handlers are dynamically imported on first request.
 * This is the largest group of routes and the primary contributor
 * to the previous deployment bundle size issue.
 */

import { lazy, type LazyOptions } from './lazy-router.ts';
import { aiUsageLimit } from './ai-usage-limit.ts';
import type { Hono } from 'npm:hono';

/**
 * Prefixes whose write endpoints spend money at an AI provider on every call.
 *
 * Metered per authenticated account (see `ai-usage-limit.ts`). Listed here
 * rather than inside each module so the set is auditable in one place: "which
 * of our routes can run up a bill" should be answerable by reading a list, not
 * by grepping 60 files for `api.openai.com`.
 *
 * Each gets its OWN bucket, keyed by the surface name. A retry loop in the
 * publications editor must not be able to exhaust the allowance that an
 * adviser needs for a client conversation.
 *
 * NOT listed, deliberately:
 *   - `/vasco` — already metered, and more tightly, by `vasco-guardrails.ts`
 *     on the public path. Adding a second limiter over the top would double
 *     the counter writes and make the effective limit the harder of two
 *     numbers to reason about.
 *   - `/ai-management` — configuration CRUD for the AI features (model ids,
 *     stored prompts), admin-only, and it calls no provider.
 *   - Mixed routers such as `/advice-engine` and `/notes`, where AI is a
 *     minority of the surface. Metering the whole prefix would throttle
 *     ordinary CRUD; those routes carry the middleware at the individual
 *     endpoint instead.
 */
const AI_METERED_PREFIXES = [
  'publications-ai',
  'social-media-ai',
  'ai-advisor',
  'ai-intelligence',
  'client-document-summaries',
  'transcription',
  'will-chat',
  'tax-agent',
  'auto-content',
] as const;

type AiMeteredPrefix = (typeof AI_METERED_PREFIXES)[number];

/**
 * One middleware instance per metered surface, built FROM the list above so
 * the list is the source of truth rather than a comment beside one. A prefix
 * that is not in it cannot be passed to `aiGuard` — the compiler rejects the
 * name — so the two cannot drift.
 */
const AI_GUARDS = Object.fromEntries(
  AI_METERED_PREFIXES.map((surface) => [surface, { middleware: [aiUsageLimit({ surface })] }]),
) as Record<AiMeteredPrefix, LazyOptions>;

/** `/publications-ai` → the middleware instance metering that surface. */
function aiGuard(surface: AiMeteredPrefix): LazyOptions {
  return AI_GUARDS[surface];
}

export function mountModuleRoutes(app: Hono) {
  lazy(app, '/requests', () => import('./requests-routes.ts'));
  lazy(app, '/esign', () => import('./esign-routes.ts'));
  lazy(app, '/resources', () => import('./resources-routes.ts'));
  lazy(app, '/reporting', () => import('./reporting-routes.ts'));
  lazy(app, '/publications', () => import('./publications-routes.ts'));
  lazy(
    app,
    '/publications-ai',
    () => import('./publications-ai-routes.ts'),
    aiGuard('publications-ai'),
  );
  lazy(app, '/auto-content', () => import('./auto-content-routes.ts'), aiGuard('auto-content'));
  lazy(app, '/personnel', () => import('./client-management-personnel-routes.ts'));
  lazy(app, '/clients', () => import('./client-management-routes.ts'));
  lazy(app, '/communication', () => import('./communication-routes.ts'));
  lazy(app, '/product-management', () => import('./product-management-routes.ts'));
  lazy(app, '/social-marketing', () => import('./social-marketing-routes.ts'));
  lazy(
    app,
    '/social-media-ai',
    () => import('./social-media-ai-routes.ts'),
    aiGuard('social-media-ai'),
  );
  lazy(app, '/calendar', () => import('./calendar-routes.ts'));
  lazy(app, '/compliance', () => import('./compliance-routes.ts'));
  lazy(app, '/advice-engine', () => import('./advice-engine-routes.ts'));
  lazy(app, '/applications', () => import('./client-applications-routes.ts'));
  lazy(app, '/newsletter', () => import('./newsletter.ts'));
  lazy(app, '/newsletter-studio', () => import('./newsletter-studio-routes.ts'));
  lazy(app, '/consultation', () => import('./consultation.ts'));
  lazy(app, '/documents', () => import('./documents.ts'));
  lazy(
    app,
    '/client-document-summaries',
    () => import('./client-document-summaries-routes.ts'),
    aiGuard('client-document-summaries'),
  );
  lazy(app, '/ai-advisor', () => import('./ai-advisor.ts'), aiGuard('ai-advisor'));
  lazy(app, '/ai-intelligence', () => import('./ai-intelligence.ts'), aiGuard('ai-intelligence'));
  lazy(app, '/todo', () => import('./todo-routes.ts'));
  lazy(app, '/tasks', () => import('./tasks-routes.ts'));
  lazy(app, '/task-checklists', () => import('./tasks-checklist-routes.ts'));
  lazy(app, '/task-comments', () => import('./task-comments-routes.ts'));
  lazy(app, '/goals', () => import('./goal-routes.ts'));
  lazy(app, '/contact-form', () => import('./contact-form-routes.ts'));
  lazy(app, '/quote-request', () => import('./quote-request-routes.ts'));
  lazy(app, '/client-portal', () => import('./client-portal-routes.ts'));
  lazy(app, '/will-chat', () => import('./will-chat-routes.ts'), aiGuard('will-chat'));
  lazy(app, '/brand', () => import('./brand-routes.ts'));
  lazy(app, '/tax-agent', () => import('./tax-agent-routes.ts'), aiGuard('tax-agent'));
  lazy(app, '/submissions', () => import('./submissions-routes.ts'));
  lazy(app, '/notes', () => import('./notes-routes.ts'));
  lazy(app, '/transcription', () => import('./transcription-routes.ts'), aiGuard('transcription'));
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
