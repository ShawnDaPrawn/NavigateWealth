import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import manifest from './seo-route-manifest.json';
import { shouldReturnNotFound, type SeoRouteManifest } from './src/middleware/route-policy';

export const config = {
  matcher: [
    /*
     * Run on document navigations only — skip static assets and files with extensions
     * (robots.txt, sitemap.xml, JS/CSS/images, etc.).
     */
    '/((?!assets/|_vercel|.*\\.[\\w-]+$).*)',
  ],
};

export default function middleware(request: NextRequest) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;

  if (shouldReturnNotFound(pathname, manifest as SeoRouteManifest)) {
    const url = request.nextUrl.clone();
    url.pathname = '/404.html';
    return NextResponse.rewrite(url, { status: 404 });
  }

  return NextResponse.next();
}
