/**
 * Route-auth classification registry (roadmap §5.5 / fitness function F3)
 * ======================================================================
 *
 * WHAT THIS IS
 * ------------
 * `quality/baselines/route-auth-baseline` used to be a bare number — 123 — and
 * a number nobody can explain is not a security control. It counted every route
 * whose guard the static analysis in `route-auth-granular.test.ts` could not
 * SEE, which is not the same thing as a route that is unguarded. Nobody could
 * say which of the 123 were public on purpose, which were guarded by a
 * mechanism the regex does not understand, and which were real holes.
 *
 * Every one of them is now classified below, with a reason.
 *
 * WHAT CLASSIFYING THEM FOUND
 * ---------------------------
 * Of the original 123: 85 are public by design, 35 are genuinely guarded by a
 * mechanism the detector cannot see, and exactly THREE were real gaps — the
 * read routes in `integrations-schema-routes.ts`, which served integration
 * field schemas and custom key definitions to unauthenticated callers while
 * `POST /schemas` beside them required admin. Those three were FIXED rather
 * than classified, which is why this registry holds 120 entries and not 123.
 *
 * WHY NOT JUST TEACH THE DETECTOR THE MISSING MARKERS
 * --------------------------------------------------
 * Because that hides routes instead of explaining them. Adding
 * `requirePrimaryAuth`, `assertClientAccess` and friends to AUTH_MARKERS drops
 * the count without anyone reading the routes — and the same widened regex then
 * silently absorbs the next genuinely unguarded route that happens to mention
 * one of those identifiers within its scan window. Tried it: it moved 123 to
 * 113 and would have masked all three real gaps. The detector stays
 * deliberately narrow and over-reports; this file carries the judgement.
 *
 * WHY THE FLOOR WENT 121 -> 122 ON 2026-08-27
 * --------------------------------------------
 * Not because a route lost its guard. The detector was letting COMMENTS count
 * as guards: it tests `AUTH_MARKERS` over the span between one registration and
 * the next, and that span includes the doc comment written above the following
 * route. `auth-routes.ts GET /security-status` was invisible for exactly that
 * reason — its own docblock says "rather than going through requireAdmin", and
 * the phrase satisfied the regex.
 *
 * `withoutCommentLines` in the detector closes that, and the newly visible
 * route is classified above as inline-guarded. The count rose because the
 * detector got stricter, which is the direction this file wants: it
 * over-reports on purpose and the judgement lives here.
 *
 * HOW IT IS ENFORCED
 * ------------------
 * `route-auth-granular.test.ts` asserts this registry and the detector's output
 * agree EXACTLY, in both directions:
 *   - a newly-unguarded route is absent from the registry -> CI fails, naming
 *     the route and demanding a classification or a guard;
 *   - a route that gains a visible guard leaves the detector's output but stays
 *     here -> CI fails as a stale entry, so this file cannot rot into fiction.
 *
 * THIS IS ALSO THE PUBLIC-SURFACE INVENTORY for the Stage E function split and
 * the `verify_jwt = true` flip (roadmap §7.2–7.3). Everything marked `public`
 * must keep working from an unauthenticated sibling function after that flip.
 * Do not flip on a hand-written list — flip on this one.
 *
 * Verified against the tree on 2026-08-24.
 */

export type RouteClassification = 'public' | 'guarded';

export interface RouteAuthGroup {
  /** Short slug for the shared mechanism or rationale. */
  kind: string;
  classification: RouteClassification;
  /** Why every route in this group is safe without a detector-visible guard. */
  reason: string;
  /** Detector output lines, formatted "<file> <METHOD> <path>". */
  routes: string[];
}

export const ROUTE_AUTH_GROUPS: RouteAuthGroup[] = [
  {
    kind: 'module-descriptor',
    classification: 'public',
    reason:
      'Module index/health descriptor: returns the router’s own name, version or route list. No caller data and no per-user record is read.',
    routes: [
      'admin-audit-routes.ts GET /',
      'brand-routes.ts GET /health',
      'calendar-routes.ts GET /',
      'client-document-summaries-routes.ts GET /',
      'client-management-personnel-routes.ts GET /',
      'client-portal-routes.ts GET /',
      'estate-planning-fna-session-routes.ts GET /',
      'integrations.tsx GET /',
      'investment-ina-routes.tsx GET /',
      'kv-cleanup-routes.ts GET /',
      'medical-fna-routes.tsx GET /health',
      'net-worth-snapshot-routes.ts GET /',
      'newsletter.tsx GET /',
      'openclaw-routes.ts GET /health',
      'reporting-routes.ts GET /',
      'requests-routes.ts GET /health',
      'resources-routes.ts GET /health',
      'risk-planning-fna-routes.tsx GET /',
      'security.tsx GET /',
      'setup.ts GET /',
      'social-media-ai-routes.ts GET /',
      'submissions-routes.ts POST /',
      'tax-agent-routes.ts GET /',
      'tax-planning-fna-routes.ts GET /',
      'will-chat-routes.ts GET /',
    ],
  },
  {
    kind: 'auth-bootstrap',
    classification: 'public',
    reason:
      'Authentication bootstrap — a login/signup endpoint behind requireAuth is a bootstrap paradox. Abuse is bounded by the atomic Postgres rate limiter (migration 20260821210412), not by a guard.',
    routes: [
      'auth-routes.ts POST /login-failure',
      'auth-routes.ts POST /login-success',
      'auth-routes.ts POST /login-validate',
      'auth-routes.ts POST /logout',
      'auth-routes.ts POST /password-change',
      'auth-routes.ts POST /password-reset-request',
      'auth-routes.ts POST /signup',
      'auth-routes.ts POST /signup-validate',
      'auth-signup.ts POST /signup',
    ],
  },
  {
    kind: 'shared-secret',
    classification: 'guarded',
    reason:
      'Machine endpoint authenticated by a shared secret rather than a user session. Six of these now use the named `requireCronAuth` / `isAuthorizedCronRequest` middleware from cron-auth.ts (a Vault-backed token verified through a SECURITY DEFINER oracle, with a service-role/super-admin bearer fallback); the rest still compare an inline secret in the handler. Either way the detector cannot see the guard: it matches a fixed set of middleware identifiers, and `requireCronAuth` is not one of them. Adding it to AUTH_MARKERS would move seven routes out of the unguarded count legitimately, but that is its own change with its own blast radius — not something to fold into a feature commit.',
    routes: [
      'calendar-digest-routes.ts POST /send-birthdays',
      'calendar-digest-routes.ts POST /send-daily',
      'client-document-summaries-routes.ts POST /maintenance/weekly-scan',
      'client-management-routes.ts POST /cron/cleanup',
      'esign-ops-routes.ts POST /cron/expiry-sweep',
      'esign-ops-routes.ts POST /cron/reminder-sweep',
      'kv-cleanup-routes.ts POST /cron',
      'newsletter-studio-routes.ts POST /cron/process',
      'openclaw-routes.ts POST /events',
      'quality-issues-routes.ts POST /ingest-ci-report',
      'quality-issues-routes.ts POST /ingest-security-report',
      'tasks-digest-routes.ts POST /send-overdue',
    ],
  },
  {
    kind: 'browser-telemetry',
    classification: 'public',
    reason:
      "The endpoint named by `Reporting-Endpoints` / `report-uri` in vercel.json. It CANNOT be guarded: the browser sends these itself, on public marketing pages where the visitor has no session, and it will not attach an app token. Bounded instead by what an anonymous caller can actually do — reports are deduplicated by fingerprint and the list is hard-capped at MAX_CSP_VIOLATION_ISSUES, every field is length-limited, at most MAX_REPORTS_PER_REQUEST are taken from one body, and the response is always 204 so nothing is learned from it. Nothing sensitive is retained: every URL is reduced to origin+path before storage, because a violation on the signer page would otherwise carry `/sign?token=…` — the signer's live credential — into the KV store.",
    routes: ['csp-report-routes.ts POST /'],
  },
  {
    kind: 'lead-gen',
    classification: 'public',
    reason:
      'Anonymous lead-gen form: the public marketing site posts here with no session. Bounded by the shared public-form rate limiter; staff email render is escaped via escapeHtmlDeep (S10/S11). The newsletter-studio one-click unsubscribe is the RFC 8058 target mailbox providers POST to on a recipient’s behalf — it can never require a session, is gated by the opaque per-recipient token, and 404s unknown ids with no detail.',
    routes: [
      'consultation.ts GET /',
      'consultation.ts POST /request',
      'contact-form-routes.ts GET /',
      'contact-form-routes.ts POST /submit',
      'newsletter-studio-routes.ts POST /unsubscribe-oneclick',
      'newsletter.tsx GET /unsubscribe',
      'newsletter.tsx POST /subscribe',
      'quote-request-routes.ts GET /',
      'quote-request-routes.ts POST /submit',
    ],
  },
  {
    kind: 'platform-health',
    classification: 'public',
    reason:
      'Platform health probe. Documented as the only endpoints reachable without a bearer token, and asserted on every deploy by scripts/post-deploy-smoke.mjs.',
    routes: [
      'create-app.ts GET /make-server-91ed8379',
      'create-app.ts GET /make-server-91ed8379/health',
      'create-app.ts GET /make-server-91ed8379/health/ready',
    ],
  },
  {
    kind: 'inline-authctx',
    classification: 'guarded',
    reason:
      'Resolved through getAuthContext / signer-token validation inside the handler body, past the detector’s scan window or under an identifier it does not know.',
    routes: [
      // Verifies the bearer token itself via `supabase.auth.getUser(token)`,
      // enforces the shared account-security policy, then requires an
      // admin/super_admin role off the caller's KV profile. Guarded, but by
      // hand rather than by a middleware the detector knows.
      //
      // It only became visible once the detector stopped letting comments count
      // as guards: its own docblock reads "rather than going through
      // requireAdmin", and that phrase was masking it. A route whose protection
      // depends on the wording of a nearby comment is classified, not trusted.
      'auth-routes.ts GET /security-status',
      'esign-consent-routes.ts GET /consent/active',
      'esign-envelopes-routes.ts POST /verify-hash',
      'esign-routes.tsx GET /',
      'esign-routes.tsx GET /health',
      'esign-sender-envelope-routes.ts POST /envelopes/:envelopeId/reject',
      'esign-sender-envelope-routes.ts POST /envelopes/:envelopeId/sign',
      'esign-sender-envelope-routes.ts POST /envelopes/:envelopeId/signers/:signerId/otp/send',
      'esign-sender-envelope-routes.ts POST /envelopes/:envelopeId/signers/:signerId/verify',
      'esign-v1-routes.ts GET /v1/envelopes',
      'esign-v1-routes.ts GET /v1/envelopes/:id',
      'esign-v1-routes.ts GET /v1/envelopes/:id/audit',
      'esign-v1-routes.ts GET /v1/envelopes/:id/signed-pdf',
      'esign-v1-routes.ts GET /v1/templates',
      'esign-v1-routes.ts GET /v1/templates/:id',
      'esign-v1-routes.ts POST /v1/envelopes/from-template',
    ],
  },
  {
    kind: 'static-catalogue',
    classification: 'public',
    reason: 'Static catalogue of FNA types. No caller data, no per-user records.',
    routes: [
      'fna-routes.ts GET /',
      'fna-routes.ts GET /health',
      'fna-routes.ts GET /types',
      'fna-routes.ts GET /types/:typeId',
    ],
  },
  {
    kind: 'deprecation-stub',
    classification: 'public',
    reason: 'Returns a deprecation notice and a migration guide. Reads nothing, writes nothing.',
    routes: ['fna-routes.ts POST /submit'],
  },
  {
    kind: 'published-content',
    classification: 'public',
    reason:
      'Published website content served to anonymous visitors by design. The matching write routes in the same file carry requireAdmin.',
    routes: [
      'linktree-routes.ts GET /public',
      'linktree-routes.ts POST /click/:id',
      'publications-articles-read-routes.ts GET /articles',
      'publications-articles-read-routes.ts GET /articles/:id',
      'publications-articles-read-routes.ts GET /articles/by-slug/:slug',
      'publications-articles-read-routes.ts GET /articles/slug/:slug',
      'publications-routes.tsx GET /',
      'publications-site-routes.ts GET /careers',
      'publications-site-routes.ts GET /press/articles',
      'publications-site-routes.ts GET /press/stats',
      'publications-site-routes.ts GET /team',
      'publications-tags-scheduling-routes.ts GET /articles/:articleId/tags',
      'publications-tags-scheduling-routes.ts GET /tags',
      'publications-taxonomy-routes.ts GET /categories',
      'publications-taxonomy-routes.ts GET /categories/:id',
      'publications-taxonomy-routes.ts GET /types',
      'publications-taxonomy-routes.ts GET /types/:id',
      'resources-routes.ts GET /legal/:slug',
      'resources-routes.ts GET /rss-proxy',
      'rss-proxy.ts GET /',
      'sitemap.ts GET /',
      'sitemap.ts GET /xml',
    ],
  },
  {
    kind: 'use-loop',
    classification: 'guarded',
    reason:
      'requireAdmin IS applied, via `for (const path of [...]) lifecycleRoutes.use(path, requireAdmin)`. The detector’s USE_RE only matches a quoted string literal as the first argument, so a loop variable is invisible to it.',
    routes: [
      'publications-lifecycle-routes.ts DELETE /articles/:id',
      'publications-lifecycle-routes.ts POST /articles/:id/archive',
      'publications-lifecycle-routes.ts POST /articles/:id/duplicate',
      'publications-lifecycle-routes.ts POST /articles/:id/schedule',
      'publications-lifecycle-routes.ts POST /articles/:id/unarchive',
      'publications-lifecycle-routes.ts POST /articles/:id/unpublish',
    ],
  },
  {
    kind: 'analytics-ping',
    classification: 'public',
    reason:
      'Analytics ping from a public article page or an email tracking pixel; carries no session by construction. Append-only counter/event write. The newsletter-studio click ping additionally returns the destination URL for the redirect — but only a URL the campaign author stored server-side at queue time (never caller input, so no open redirect), gated by an opaque per-recipient token; unknown ids 404 with no detail.',
    routes: [
      'newsletter-studio-routes.ts POST /track/click',
      'publications-lifecycle-routes.ts POST /articles/:id/increment-views',
      'publications-lifecycle-routes.ts POST /articles/:id/view',
      'publications-lifecycle-routes.ts POST /email-engagement/open',
      'publications-lifecycle-routes.ts POST /email-engagement/read',
    ],
  },
  {
    kind: 'capability-url',
    classification: 'public',
    reason:
      'Fetched by the PUBLIC RequestCompletionPage, where a recipient completes a request from an emailed link with no session. The opaque request id IS the capability. Every sibling route in the file carries requireAdmin.',
    routes: [
      'requests-routes.ts GET /:id',
      'vasco-routes.ts DELETE /session/:sessionId',
      'vasco-routes.ts GET /',
      'vasco-routes.ts GET /session/:sessionId',
      'vasco-routes.ts GET /status',
      'vasco-routes.ts POST /chat',
      'vasco-routes.ts POST /chat/stream',
      'vasco-routes.ts POST /feedback',
      'vasco-routes.ts POST /handoff',
      'vasco-routes.ts POST /session',
    ],
  },
  {
    kind: 'require-primary-auth',
    classification: 'guarded',
    reason:
      'Guarded by requirePrimaryAuth, which is real auth middleware (resolveAuthUser) but is absent from the detector’s AUTH_MARKERS set.',
    routes: [
      'security-2fa-routes.ts POST /:userId/2fa/send-code',
      'security-2fa-routes.ts POST /:userId/2fa/verify-code',
      'security-password-routes.ts GET /:userId/status',
    ],
  },
  {
    kind: 'inline-gate',
    classification: 'guarded',
    reason:
      'Guarded by a file-local cron-or-admin gate that calls enforceAccountSecurity + resolveTrustedRole and returns 401 by default.',
    routes: ['tasks-digest-routes.ts GET /', 'tasks-digest-routes.ts GET /status'],
  },
];

/** Flattened "<file> <METHOD> <path>" -> its group. */
export const ROUTE_AUTH_CLASSIFICATION = new Map<string, RouteAuthGroup>(
  ROUTE_AUTH_GROUPS.flatMap((g) => g.routes.map((r) => [r, g] as const)),
);

/** The public surface. The Stage E split must keep every one of these reachable. */
export const PUBLIC_BY_DESIGN_ROUTES: string[] = ROUTE_AUTH_GROUPS.filter(
  (g) => g.classification === 'public',
).flatMap((g) => g.routes);
