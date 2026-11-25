/**
 * Vercel Routing Middleware (framework-agnostic — this is a Vite SPA, NOT Next.js).
 *
 * Two jobs, both reading the build's seo-route-manifest.json:
 * - a genuine HTTP 404 for unmatched public URLs instead of the SPA's
 *   soft-404 (200 + client-side NotFound);
 * - share tags for an article or newsletter issue published after the last
 *   build, for link-preview fetchers such as WhatsApp's, which would
 *   otherwise be shown the home page's (src/middleware/share-meta.ts).
 *
 * Uses standard Web APIs only — do NOT import from `next/server` here (this
 * project has no `next` dependency, and doing so breaks the Vercel Edge build;
 * see docs/archive/production-readiness-ledger-2026.md).
 */
import manifest from './seo-route-manifest.json';
import { shouldReturnNotFound, type SeoRouteManifest } from './src/middleware/route-policy';
import {
  isLinkPreviewAgent,
  pendingShareTarget,
  renderPendingShare,
} from './src/middleware/share-meta';

export const config = {
  matcher: [
    /*
     * Run on document navigations only — skip static assets and files with
     * extensions (robots.txt, sitemap.xml, /404.html, JS/CSS/images, etc.).
     * Excluding extension paths also prevents the /404.html fetch below from
     * re-entering this middleware.
     *
     * /design-system-library/ is the separately built component library that
     * the /design-system page embeds (see design-system/README.md). It is a
     * static folder with its own index.html, not an SPA route, so it must reach
     * Vercel's filesystem instead of being answered with a 404 here.
     */
    '/((?!assets/|_vercel|design-system-library/|design-system-library$|.*\\.[\\w-]+$).*)',
  ],
};

/**
 * MCP servers and their OAuth discovery documents, which vercel.json rewrites
 * to the edge function or a static JSON file. They are not pages, so the 404
 * check below must never answer them. MCP clients send GETs here (the
 * discovery documents, and the server's event stream), so a page-style 404
 * breaks the connection.
 *
 * Matched by prefix, not by an exact list: on 2026-11-25 the exact list named
 * only broker-operations, so every GET for the then-new password-vault server
 * got the 404 page and Claude's connector failed straight after signing in.
 */
export function isMcpOrOAuthPath(pathname: string): boolean {
  return pathname.startsWith('/mcp/') || pathname.startsWith('/.well-known/oauth-');
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return undefined; // continue to normal routing
  }

  const { pathname } = new URL(request.url);

  if (isMcpOrOAuthPath(pathname)) return undefined;

  if (shouldReturnNotFound(pathname, manifest as SeoRouteManifest)) {
    // Serve the prerendered 404 shell with a real 404 status (not a soft 200).
    const notFound = await fetch(new URL('/404.html', request.url));
    return new Response(notFound.body, {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  // Published since the last build: give link previews this item's tags, not
  // the home page's. Browsers skip this and get the SPA as before; any failure
  // falls through to normal routing.
  if (request.method === 'GET') {
    const target = pendingShareTarget(pathname, manifest as SeoRouteManifest);
    if (target && isLinkPreviewAgent(request.headers.get('user-agent'))) {
      const shared = await renderPendingShare(request, target);
      if (shared) return shared;
    }
  }

  return undefined; // continue to normal routing
}
