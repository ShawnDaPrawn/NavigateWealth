/**
 * Edge middleware route policy for Navigate Wealth (Vite SPA on Vercel).
 *
 * Returns true when a GET/HEAD should receive a genuine HTTP 404 (not a 200
 * shell with client-side NotFound). Uses the build-time seo-route-manifest.json
 * for prerendered public URLs and article slugs.
 */

export interface SeoRouteManifest {
  generated: boolean;
  generatedAt: string | null;
  paths: string[];
  articleSlugs: string[];
  /** Newsletter issues the build prerendered (absent from older manifests). */
  newsletterSlugs?: string[];
}

/** SPA routes that are valid but not in the static SEO manifest. */
const SPA_EXACT_PATHS = new Set([
  '/sitemap',
  '/design-system',
  '/contact/consultation',
  '/og-preview',
  '/links',
  '/auth/callback',
  '/auth/linkedin/callback',
  '/verification-success',
  '/application/personal-client',
  '/dashboard/pending',
  '/application/declined',
  '/onboarding/choose-account',
  '/e-signatures',
  '/products-services',
  '/preview_page.html',
]);

/**
 * First path segment prefixes for authenticated / functional SPA routes.
 * Mirrors vercel.json noindex routes plus additional AppRoutes prefixes.
 */
const SPA_PREFIXES = [
  '/admin',
  '/dashboard',
  '/products-services-dashboard',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/auth',
  '/account-type',
  '/get-started',
  '/application',
  '/onboarding',
  '/profile',
  '/security',
  '/history',
  '/communication',
  '/transactions-documents',
  '/my-adviser',
  '/ai-advisor',
  '/requests',
  '/newsletter',
  '/sign',
  '/verify',
  '/verify-document',
  '/migration-helper',
];

/**
 * Legal document slugs the site publishes. Mirrors LEGAL_DOCUMENTS_REGISTRY in
 * src/shared/legal-documents-registry.ts — copied rather than imported because
 * middleware.ts must stay free of SPA-tree imports (docs/STATUS.md, "Deliberate
 * fallbacks"). route-policy.test.ts fails if the two lists drift.
 *
 * Any other /legal/<slug> answers a real 404. Before this list existed every
 * slug was let through, so a made-up address served the SPA's "not found"
 * screen with a 200 — the soft 404 Search Console reports.
 */
export const LEGAL_DOCUMENT_SLUGS: readonly string[] = [
  'legal-conditions',
  'terms-of-use',
  'website-disclaimer',
  'whistleblowing-policy',
  'privacy-notice',
  'popia-paia-manual',
  'data-protection-policy',
  'cookie-policy',
  'data-processing-agreement',
  'conflict-of-interest',
  'fais-disclosure',
  'fsp-license',
  'risk-disclosures',
  'complaints-procedure',
  'compliance-report',
  'paia-manual',
  'disclaimers',
  'cis-disclaimer',
  'third-party-services',
  'intellectual-property',
  'aml-policy',
];

/**
 * Services the quote flow accepts at /get-quote/<service> and
 * /get-quote/<service>/contact. Mirrors QUOTE_SERVICES in
 * src/components/pages/quote/constants.ts (same copy-not-import reason, same
 * drift test). Financial planning is deliberately absent: it has no quote form.
 */
export const QUOTE_SERVICE_SLUGS: readonly string[] = [
  'risk-management',
  'medical-aid',
  'retirement-planning',
  'investment-management',
  'employee-benefits',
  'tax-planning',
  'estate-planning',
];

function oneOf(slugs: readonly string[]): string {
  return slugs.map((slug) => slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
}

const SPA_PATH_PATTERNS: RegExp[] = [
  new RegExp(`^/legal/(?:${oneOf(LEGAL_DOCUMENT_SLUGS)})$`, 'i'),
  new RegExp(`^/get-quote/(?:${oneOf(QUOTE_SERVICE_SLUGS)})(?:/contact)?$`, 'i'),
];

const ARTICLE_PREFIX = '/resources/article/';

/**
 * Newsletter issues are published from the admin newsletter studio and served
 * at /resources/newsletter/<slug>. They were missing from every list here, so
 * each issue answered 404 to crawlers even though visitors saw it render.
 * Unknown slugs fall through to the SPA exactly like articles do, so an issue
 * published after the last deploy resolves at once; NewsletterDetailPage marks
 * a genuinely missing issue noindex.
 */
const NEWSLETTER_PREFIX = '/resources/newsletter/';

export function normalizePathname(pathname: string): string {
  let path: string;
  try {
    path = decodeURI(pathname);
  } catch {
    path = pathname;
  }
  if (!path || path === '') return '/';
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }
  return path;
}

function buildManifestIndex(manifest: SeoRouteManifest) {
  const paths = new Set(manifest.paths.map(normalizePathname));
  const articleSlugs = new Set(manifest.articleSlugs);
  return { paths, articleSlugs };
}

function matchesSpaPrefix(path: string): boolean {
  return SPA_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function matchesSpaPattern(path: string): boolean {
  return SPA_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

function isKnownArticlePath(path: string, articleSlugs: Set<string>): boolean {
  if (!path.startsWith(ARTICLE_PREFIX)) return false;
  const slug = path.slice(ARTICLE_PREFIX.length);
  if (!slug || slug.includes('/')) return false;
  return articleSlugs.has(slug);
}

/**
 * Whether middleware should rewrite to /404.html with status 404.
 * When manifest.generated is false (local dev before build), never enforce.
 */
export function shouldReturnNotFound(pathname: string, manifest: SeoRouteManifest): boolean {
  if (!manifest.generated) return false;

  const path = normalizePathname(pathname);
  const { paths, articleSlugs } = buildManifestIndex(manifest);

  if (paths.has(path)) return false;
  if (SPA_EXACT_PATHS.has(path)) return false;
  if (matchesSpaPrefix(path)) return false;
  if (matchesSpaPattern(path)) return false;
  if (isKnownArticlePath(path, articleSlugs)) return false;

  // Unknown slug directly under /resources/article/ or /resources/newsletter/ —
  // fall through to the SPA shell so an article or issue published after the
  // last deploy resolves client-side instead of 404ing until the next build.
  // Genuinely missing ones render a not-found state that sets noindex. Nested
  // paths (slug containing "/") still 404 below.
  for (const prefix of [ARTICLE_PREFIX, NEWSLETTER_PREFIX]) {
    if (path.startsWith(prefix)) {
      const slug = path.slice(prefix.length);
      if (slug && !slug.includes('/')) return false;
    }
  }

  return true;
}
