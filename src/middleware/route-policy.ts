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

const SPA_PATH_PATTERNS: RegExp[] = [
  /^\/legal\/[^/]+$/i,
  /^\/get-quote\/[^/]+$/i,
  /^\/get-quote\/[^/]+\/contact$/i,
];

const ARTICLE_PREFIX = '/resources/article/';

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

  // Unknown slug directly under /resources/article/ — fall through to the SPA
  // shell so articles published after the last deploy resolve client-side
  // instead of 404ing until the next build. Genuinely missing articles render
  // ArticleErrorState, which sets noindex. Nested paths (slug containing "/")
  // still 404 below.
  if (path.startsWith(ARTICLE_PREFIX)) {
    const slug = path.slice(ARTICLE_PREFIX.length);
    if (slug && !slug.includes('/')) return false;
  }

  return true;
}
