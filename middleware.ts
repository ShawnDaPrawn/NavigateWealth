/**
 * Vercel Routing Middleware (framework-agnostic — this is a Vite SPA, NOT Next.js).
 *
 * Returns a genuine HTTP 404 for unmatched public URLs instead of the SPA's
 * soft-404 (200 + client-side NotFound). Uses standard Web APIs only — do NOT
 * import from `next/server` here (this project has no `next` dependency, and
 * doing so breaks the Vercel Edge build; see docs/PRODUCTION-READINESS.md).
 */
import manifest from './seo-route-manifest.json';
import { shouldReturnNotFound, type SeoRouteManifest } from './src/middleware/route-policy';

export const config = {
  matcher: [
    /*
     * Run on document navigations only — skip static assets and files with
     * extensions (robots.txt, sitemap.xml, /404.html, JS/CSS/images, etc.).
     * Excluding extension paths also prevents the /404.html fetch below from
     * re-entering this middleware.
     */
    '/((?!assets/|_vercel|.*\\.[\\w-]+$).*)',
  ],
};

export default async function middleware(request: Request): Promise<Response | undefined> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return undefined; // continue to normal routing
  }

  const { pathname } = new URL(request.url);

  if (shouldReturnNotFound(pathname, manifest as SeoRouteManifest)) {
    // Serve the prerendered 404 shell with a real 404 status (not a soft 200).
    const notFound = await fetch(new URL('/404.html', request.url));
    return new Response(notFound.body, {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  return undefined; // continue to normal routing
}
