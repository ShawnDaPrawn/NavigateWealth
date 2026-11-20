import fs from 'node:fs';
import path from 'node:path';
import {
  ARTICLE_PATH_PREFIX,
  DEFAULT_SITE_URL,
  DEFAULT_TIMEZONE,
  LLMS_DESCRIPTION_MAX,
  absoluteUrl,
  clampSeoDescription,
  createLlmsTxt,
  disallowPaths,
  escapeXml,
  normalizeSiteUrl,
  parseLlmsTxtArticles,
  publicSeoRoutes,
  requireArticles,
  resolveArticleCanonicalOverride,
  resolveImageUrl,
} from './seo-static-data.mjs';

const siteUrl = normalizeSiteUrl(
  process.env.SITE_URL || process.env.VITE_SITE_URL || DEFAULT_SITE_URL,
);
const buildDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: process.env.SITEMAP_TIMEZONE || DEFAULT_TIMEZONE,
}).format(new Date());

// Google ignores priority and changefreq. Keep sitemap entries limited to
// canonical, indexable public pages only.
const sitemapEntries = publicSeoRoutes
  .filter((entry) => entry.sitemap !== false)
  .map(({ path: routePath, lastmod, ogImage }) => ({
    path: routePath,
    lastmod,
    image: resolveImageUrl(siteUrl, ogImage),
  }));

const publicDir = path.resolve('public');
fs.mkdirSync(publicDir, { recursive: true });

main();

function generateSitemapXml() {
  const urls = sitemapEntries
    .map(
      ({ path: routePath, lastmod, image }) => `  <url>
    <loc>${escapeXml(absoluteUrl(siteUrl, routePath))}</loc>
    <lastmod>${lastmod || buildDate}</lastmod>
    <image:image>
      <image:loc>${escapeXml(image || resolveImageUrl(siteUrl))}</image:loc>
    </image:image>
  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>
`;
}

function generateRobotsTxt() {
  const rules = disallowPaths.map((routePath) => `Disallow: ${routePath}`).join('\n');

  return `User-agent: *
Allow: /
${rules}

Sitemap: ${siteUrl}/sitemap.xml
`;
}

function main() {
  Promise.resolve()
    .then(async () => {
      const articleEntries = await fetchPublishedArticleEntries();
      if (articleEntries === null) {
        // Fetch failed (not "zero articles"). Fall back to the article URLs
        // already present in the committed sitemap so a transient outage does
        // not silently drop them from the production sitemap.
        const cached = readCachedArticleEntries();
        const strict = requireArticles();
        console.error('============================================================');
        console.error('[sitemap] WARNING: could not fetch published articles.');
        console.error(
          `[sitemap] Reusing ${cached.length} article URL(s) from the existing sitemap.`,
        );
        console.error('[sitemap] These URLs may be stale until the next successful build.');
        console.error('============================================================');
        if (strict) {
          throw new Error('SEO_REQUIRE_ARTICLES is set and the article fetch failed.');
        }
        if (cached.length) {
          sitemapEntries.push(...cached);
        }
      } else if (articleEntries.length) {
        sitemapEntries.push(...articleEntries);
      }

      const seen = new Set();
      const deduped = [];
      for (const e of sitemapEntries) {
        if (!e?.path) continue;
        if (seen.has(e.path)) continue;
        seen.add(e.path);
        deduped.push(e);
      }
      sitemapEntries.length = 0;
      sitemapEntries.push(...deduped);

      assertRobotsAllowsPublicCrawl(generateRobotsTxt());

      writeGeneratedFile(path.join(publicDir, 'sitemap.xml'), generateSitemapXml());
      writeGeneratedFile(path.join(publicDir, 'robots.txt'), generateRobotsTxt());
      writeGeneratedFile(
        path.join(publicDir, 'llms.txt'),
        createLlmsTxt(siteUrl, { articles: articleEntriesForLlms(sitemapEntries) }),
      );

      console.log(
        `Generated sitemap, robots and llms.txt for ${siteUrl} (${sitemapEntries.length} URLs)`,
      );
    })
    .catch((err) => {
      console.error('Failed to generate SEO files:', err);
      process.exitCode = 1;
    });
}

function assertRobotsAllowsPublicCrawl(robotsTxt) {
  if (/^Disallow:\s*\/\s*$/im.test(robotsTxt)) {
    throw new Error('Refusing to generate production robots.txt with Disallow: /');
  }
}

function normalizeNewlines(value) {
  return value.replace(/\r\n/g, '\n');
}

function writeGeneratedFile(filePath, content) {
  try {
    const existing = fs.readFileSync(filePath, 'utf8');
    if (normalizeNewlines(existing) === normalizeNewlines(content)) {
      return;
    }
  } catch {
    // Missing files are created below.
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

function toDateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.SITEMAP_TIMEZONE || DEFAULT_TIMEZONE,
  }).format(d);
}

function readCachedArticleEntries() {
  try {
    const xml = fs.readFileSync(path.join(publicDir, 'sitemap.xml'), 'utf8');
    const entries = [];
    const blocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
    for (const block of blocks) {
      const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1] || '';
      const image = block.match(/<image:loc>([^<]+)<\/image:loc>/)?.[1];
      const idx = loc.indexOf('/resources/article/');
      if (idx === -1) continue;
      entries.push({ path: loc.slice(idx), image });
    }
    return entries;
  } catch {
    return [];
  }
}

async function fetchPublishedArticleEntries() {
  const projectRef = process.env.SUPABASE_PROJECT_REF || 'vpjmdsltwrnpefzcgdmz';
  const fnBase =
    process.env.SUPABASE_FUNCTIONS_BASE_URL ||
    `https://${projectRef}.supabase.co/functions/v1/make-server-91ed8379`;

  const url = `${fnBase}/publications/articles?status=published&limit=1000`;
  try {
    const anonKey = readSupabaseAnonKey();
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) {
      if (res.status === 401 && anonKey) {
        const retry = await fetch(url, {
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${anonKey}`,
          },
        });
        if (!retry.ok) {
          console.warn(`[sitemap] Article fetch failed (HTTP ${retry.status})`);
          return null;
        }
        const json = await retry.json();
        const rows = Array.isArray(json?.data) ? json.data : [];
        return rowsToArticleEntries(rows);
      }

      console.warn(`[sitemap] Article fetch failed (HTTP ${res.status})`);
      return null;
    }

    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : [];
    return rowsToArticleEntries(rows);
  } catch (e) {
    console.warn('[sitemap] Article fetch failed', e?.message || e);
    return null;
  }
}

function rowsToArticleEntries(rows) {
  const entries = [];
  for (const a of rows) {
    const slug = typeof a?.slug === 'string' ? a.slug.trim() : '';
    if (!slug) continue;

    // A duplicate that canonicalises to another page must not appear in the
    // sitemap — otherwise Google sees a self-referential canonical in the
    // sitemap conflicting with the page's override. Matches the prerenderer.
    if (resolveArticleCanonicalOverride(a, siteUrl)) continue;

    const lastmod =
      toDateOnly(a.updated_at) ||
      toDateOnly(a.published_at) ||
      toDateOnly(a.created_at) ||
      buildDate;

    entries.push({
      path: `${ARTICLE_PATH_PREFIX}${encodeURIComponent(slug)}`,
      lastmod,
      image: articleImageUrl(a),
      // Read by llms.txt only; the sitemap ignores them.
      title: typeof a.title === 'string' ? a.title.trim() : '',
      description: clampSeoDescription(a.excerpt || a.subtitle || '', LLMS_DESCRIPTION_MAX),
      published: toDateOnly(a.published_at) || '',
    });
  }
  return entries;
}

/**
 * The articles llms.txt lists: exactly the article URLs in the sitemap. A fresh
 * fetch carries each one's title. When the fetch failed and the URLs came from
 * the cached sitemap instead, the title, date and excerpt are recovered from
 * the previous llms.txt, or failing that the title is spelled out from the slug.
 */
function articleEntriesForLlms(entries) {
  const articles = entries.filter((entry) => entry.path.startsWith(ARTICLE_PATH_PREFIX));
  if (articles.every((entry) => entry.title)) return articles;

  const cached = new Map(readCachedLlmsArticles().map((entry) => [entry.path, entry]));
  return articles.map(
    (entry) =>
      (entry.title && entry) ||
      cached.get(entry.path) || { path: entry.path, title: titleFromArticlePath(entry.path) },
  );
}

function readCachedLlmsArticles() {
  try {
    return parseLlmsTxtArticles(fs.readFileSync(path.join(publicDir, 'llms.txt'), 'utf8'), siteUrl);
  } catch {
    return [];
  }
}

/** "/resources/article/why-tfsa-matters" → "Why tfsa matters". */
function titleFromArticlePath(articlePath) {
  const slug = articlePath.slice(ARTICLE_PATH_PREFIX.length);
  let words;
  try {
    words = decodeURIComponent(slug).replace(/-+/g, ' ').trim();
  } catch {
    words = slug;
  }
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function articleImageUrl(article) {
  return resolveImageUrl(
    siteUrl,
    article.hero_image_url ||
      article.featured_image_url ||
      article.feature_image_url ||
      article.featured_image ||
      article.thumbnail_image_url,
  );
}

function readSupabaseAnonKey() {
  const envKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.PUBLIC_SUPABASE_ANON_KEY;
  if (envKey && String(envKey).trim()) return String(envKey).trim();

  try {
    const p = path.resolve('src/utils/supabase/info.tsx');
    const src = fs.readFileSync(p, 'utf8');
    const m = src.match(/export\s+const\s+publicAnonKey\s*=\s*"([^"]+)"/);
    return m?.[1] ? m[1].trim() : null;
  } catch {
    return null;
  }
}
