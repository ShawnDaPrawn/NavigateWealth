/**
 * XML Sitemap Generator for Navigate Wealth
 *
 * This is the SINGLE SOURCE OF TRUTH for the sitemap URL list.
 *
 * Architecture:
 * - GET /xml          → returns the XML sitemap directly (requires auth via Edge Function gateway)
 * - POST /publish     → generates the XML and uploads it to a PUBLIC Supabase Storage bucket
 *
 * PLATFORM LIMITATION (Figma Make + Supabase):
 * There is no way to serve raw application/xml from the www.navigatewealth.co domain:
 *   - Figma Make serves text/html for all SPA routes (Google's sitemap parser sees HTML, not XML)
 *   - Figma Make intercepts URLs with file extensions (.xml) and returns its own 404
 *   - Supabase Edge Functions require Authorization headers, so crawlers can't fetch directly
 *   - Google Search Console requires sitemaps to be on the same domain as the verified property,
 *     so the Supabase Storage public URL can't be submitted either
 *
 * RESOLUTION: Deploy a Cloudflare Worker (or equivalent edge proxy) on the custom domain
 * that intercepts /sitemap.xml and proxies to the Supabase Storage public URL, serving
 * the response with Content-Type: application/xml. This is a ~10 line Worker.
 *
 * In the meantime: Googlebot's web rendering service DOES execute JavaScript and will
 * discover all URLs through normal crawling and internal links. The sitemap is a
 * nice-to-have, not a blocking requirement for indexing.
 */

import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from './stderr-logger.ts';
import { asyncHandler } from './error.middleware.ts';

const app = new Hono();
const log = createModuleLogger('sitemap');

const BASE_URL = 'https://www.navigatewealth.co';
const BUCKET_NAME = 'make-91ed8379-sitemap';
const SITEMAP_FILE = 'sitemap.xml';

// Lazy Supabase client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

/**
 * When adding new public pages, update BOTH:
 * 1. This SITEMAP_URLS array (the backend single source of truth)
 * 2. The FALLBACK_URLS in /components/pages/SitemapXmlPage.tsx (client-side fallback)
 * 3. Then call POST /sitemap/publish to update the public storage file
 */
const SITEMAP_URLS = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' },
  { loc: '/about', priority: '0.8', changefreq: 'monthly' },
  { loc: '/services', priority: '0.9', changefreq: 'monthly' },
  { loc: '/team', priority: '0.7', changefreq: 'monthly' },
  { loc: '/contact', priority: '0.8', changefreq: 'monthly' },
  { loc: '/resources', priority: '0.8', changefreq: 'weekly' },
  { loc: '/get-quote', priority: '0.8', changefreq: 'monthly' },
  { loc: '/risk-management', priority: '0.8', changefreq: 'monthly' },
  { loc: '/retirement-planning', priority: '0.8', changefreq: 'monthly' },
  { loc: '/investment-management', priority: '0.8', changefreq: 'monthly' },
  { loc: '/tax-planning', priority: '0.8', changefreq: 'monthly' },
  { loc: '/estate-planning', priority: '0.8', changefreq: 'monthly' },
  { loc: '/employee-benefits', priority: '0.7', changefreq: 'monthly' },
  { loc: '/medical-aid', priority: '0.7', changefreq: 'monthly' },
  { loc: '/financial-planning', priority: '0.7', changefreq: 'monthly' },
  { loc: '/solutions/individuals', priority: '0.8', changefreq: 'monthly' },
  { loc: '/solutions/businesses', priority: '0.8', changefreq: 'monthly' },
  { loc: '/solutions/advisers', priority: '0.7', changefreq: 'monthly' },
  { loc: '/why-us', priority: '0.7', changefreq: 'monthly' },
  { loc: '/careers', priority: '0.5', changefreq: 'monthly' },
  { loc: '/press', priority: '0.5', changefreq: 'monthly' },
  { loc: '/legal', priority: '0.4', changefreq: 'yearly' },
  { loc: '/sitemap', priority: '0.3', changefreq: 'monthly' },
];

/** Generate the full XML sitemap string */
function generateSitemapXml(): string {
  const today = new Date().toISOString().split('T')[0];

  const entries = SITEMAP_URLS.map(
    (u) =>
      `  <url>\n    <loc>${BASE_URL}${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
}

// Mounted at /make-server-91ed8379/sitemap
// The lazy router strips the prefix, so routes here are relative to /

/** GET /xml — returns the XML sitemap directly (requires auth) */
app.get('/xml', (c) => {
  const xml = generateSitemapXml();

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
});

/**
 * POST /publish — generates sitemap XML and uploads to a PUBLIC Supabase Storage bucket.
 * Returns the public URL that can be used in robots.txt and Google Search Console.
 *
 * This endpoint requires auth (admin action). Call it:
 * - After updating the SITEMAP_URLS list
 * - Periodically to refresh lastmod dates
 * - From the admin panel as a maintenance action
 */
app.post('/publish', asyncHandler(async (c) => {
  const supabase = getSupabase();
  const xml = generateSitemapXml();

  // Ensure the public bucket exists (idempotent)
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((b: { name: string }) => b.name === BUCKET_NAME);

  if (!bucketExists) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 1048576, // 1MB — more than enough for a sitemap
    });
    if (createError) {
      log.error('[SITEMAP] Failed to create bucket:', createError.message);
      return c.json({ error: 'Failed to create storage bucket', details: createError.message }, 500);
    }
  }

  // Upload (upsert) the sitemap XML file
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(SITEMAP_FILE, new TextEncoder().encode(xml), {
      contentType: 'application/xml',
      upsert: true,
    });

  if (uploadError) {
    log.error('[SITEMAP] Failed to upload sitemap:', uploadError.message);
    return c.json({ error: 'Failed to upload sitemap', details: uploadError.message }, 500);
  }

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(SITEMAP_FILE);

  const publicUrl = urlData?.publicUrl || '';

  return c.json({
    success: true,
    publicUrl,
    urlCount: SITEMAP_URLS.length,
    lastmod: new Date().toISOString().split('T')[0],
    message: 'Sitemap published to public storage. Use the publicUrl in robots.txt and Google Search Console.',
  });
}));

/** Root handler — returns info about the sitemap service */
app.get('/', (c) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${SITEMAP_FILE}`;

  return c.json({
    service: 'sitemap',
    status: 'active',
    endpoints: {
      xml: '/sitemap/xml (requires auth — for frontend use)',
      publish: 'POST /sitemap/publish (requires auth — uploads to public storage)',
    },
    publicStorageUrl: publicUrl,
    urlCount: SITEMAP_URLS.length,
  });
});

export default app;