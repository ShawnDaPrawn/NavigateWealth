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
import * as kv from './kv_store.tsx';
import { SITE_ORIGIN } from '../../../utils/siteOrigin.ts';

const app = new Hono();
const log = createModuleLogger('sitemap');

const BASE_URL = SITE_ORIGIN;
const BUCKET_NAME = 'make-91ed8379-sitemap';
const SITEMAP_FILE = 'sitemap.xml';

interface SitemapEntry {
  loc: string;
  lastmod: string;
}

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
 *
 * Google ignores <priority> and <changefreq> — only <loc> and <lastmod> matter.
 * Only canonical, indexable public pages belong here.
 * Individual published articles are included (to avoid relying on crawl discovery).
 */
const SITEMAP_URLS: SitemapEntry[] = [
  { loc: '/', lastmod: '2026-04-02' },
  { loc: '/services', lastmod: '2026-04-02' },
  { loc: '/resources', lastmod: '2026-04-02' },
  { loc: '/about', lastmod: '2026-03-01' },
  { loc: '/team', lastmod: '2026-03-01' },
  { loc: '/contact', lastmod: '2026-03-01' },
  { loc: '/why-us', lastmod: '2026-03-01' },
  { loc: '/risk-management', lastmod: '2026-03-01' },
  { loc: '/retirement-planning', lastmod: '2026-03-01' },
  { loc: '/investment-management', lastmod: '2026-03-01' },
  { loc: '/tax-planning', lastmod: '2026-03-01' },
  { loc: '/estate-planning', lastmod: '2026-03-01' },
  { loc: '/financial-planning', lastmod: '2026-03-01' },
  { loc: '/medical-aid', lastmod: '2026-03-01' },
  { loc: '/employee-benefits', lastmod: '2026-03-01' },
  { loc: '/get-quote', lastmod: '2026-03-01' },
  { loc: '/solutions/individuals', lastmod: '2026-03-01' },
  { loc: '/solutions/businesses', lastmod: '2026-03-01' },
  { loc: '/solutions/advisers', lastmod: '2026-03-01' },
  { loc: '/ask-vasco', lastmod: '2026-03-01' },
  { loc: '/careers', lastmod: '2026-03-01' },
  { loc: '/press', lastmod: '2026-03-01' },
  { loc: '/legal', lastmod: '2026-01-01' },
];

function toDateOnly(value: string | undefined | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

type ArticleKv = {
  slug?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
};

async function getArticleEntries(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];
  try {
    const articles = (await kv.getByPrefix('article:')) as ArticleKv[];
    for (const a of articles) {
      if (!a || a.status !== 'published') continue;
      const slug = typeof a.slug === 'string' ? a.slug.trim() : '';
      if (!slug) continue;
      const lastmod =
        toDateOnly(a.updated_at) ||
        toDateOnly(a.published_at) ||
        toDateOnly(a.created_at) ||
        new Date().toISOString().slice(0, 10);
      entries.push({
        loc: `/resources/article/${encodeURIComponent(slug)}`,
        lastmod,
      });
    }
  } catch {
    // Best-effort only — sitemap still works with static URLs.
  }
  return entries;
}

async function getSitemapUrls(): Promise<SitemapEntry[]> {
  const all = [...SITEMAP_URLS, ...(await getArticleEntries())];
  const seen = new Set<string>();
  const deduped: SitemapEntry[] = [];
  for (const e of all) {
    if (!e?.loc) continue;
    if (seen.has(e.loc)) continue;
    seen.add(e.loc);
    deduped.push(e);
  }
  return deduped;
}

/** Generate the full XML sitemap string — only <loc> and <lastmod>, no priority/changefreq */
async function generateSitemapXml(): Promise<string> {
  const urls = await getSitemapUrls();
  const entries = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${BASE_URL}${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
}

// Mounted at /make-server-91ed8379/sitemap
// The lazy router strips the prefix, so routes here are relative to /

/** GET /xml — returns the XML sitemap directly (requires auth) */
app.get('/xml', asyncHandler(async (c) => {
  const xml = await generateSitemapXml();

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}));

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
  const xml = await generateSitemapXml();
  const urls = await getSitemapUrls();

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
    urlCount: urls.length,
    lastmod: new Date().toISOString().split('T')[0],
    message: 'Sitemap published to public storage. Use the publicUrl in robots.txt and Google Search Console.',
  });
}));

/** Root handler — returns info about the sitemap service */
app.get('/', (c) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${SITEMAP_FILE}`;

  // Best-effort count; avoids KV reads for a simple status endpoint.
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
