/**
 * Auto Content Service — Automated Article Generation Pipelines
 *
 * Four pipelines that generate draft articles without author intervention:
 *
 *  1. Market Commentary  — Weekly market updates from financial data feeds
 *  2. Regulatory Monitor — Detects SA regulatory changes and generates explainers
 *  3. News Commentary    — Original commentary from SA financial news RSS feeds
 *  4. Calendar Content   — Seasonal articles tied to SA financial calendar events
 *
 * All pipelines create draft articles via the existing publications article
 * creation flow. Articles are never auto-published.
 *
 * KV Key Convention:
 *   auto_content:config:{pipelineId}             — Pipeline config & toggle
 *   auto_content:run:{pipelineId}:{timestamp}     — Run audit log
 *   auto_content:calendar_event:{eventId}         — Calendar event definition
 *   auto_content:processed:{pipelineId}:{hash}    — Dedup: already-processed items
 *   auto_content:source:{sourceId}                — Content source config & tracking
 *
 * @module auto-content/service
 */

import * as kv from './kv_store.tsx';
import { generateFullArticle } from './publications-ai-service.ts';
import type { GenerateArticleBrief, GenerateArticleResult } from './publications-ai-service.ts';
import { searchUnsplashImage } from './publications-ai-service.ts';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('auto-content');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PipelineId = 'market_commentary' | 'regulatory_monitor' | 'news_commentary' | 'calendar_content';

export interface PipelineConfig {
  id: PipelineId;
  name: string;
  description: string;
  enabled: boolean;
  /** Default audience for generated articles */
  audience: 'advisors' | 'clients' | 'both';
  /** Default tone */
  tone: 'professional' | 'conversational' | 'authoritative' | 'friendly' | 'educational';
  /** Default article length */
  targetLength: 'short' | 'medium' | 'long';
  /** Category ID to assign to generated articles */
  categoryId?: string;
  /** Category name for AI context */
  categoryName?: string;
  /** Lead time in days for calendar events */
  leadTimeDays?: number;
  /** Custom RSS feed URLs (for news_commentary) */
  rssFeeds?: string[];
  /** Last successful run ISO timestamp */
  lastRunAt?: string;
  /** Total articles generated */
  totalGenerated: number;
  /** Hours between automatic scheduled runs (0 = manual only) */
  scheduleIntervalHours: number;
  /** When true, articles created by this pipeline are published immediately */
  autoPublish?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineRunLog {
  id: string;
  pipelineId: PipelineId;
  status: 'success' | 'partial' | 'error';
  articlesGenerated: number;
  articleIds: string[];
  /** Summary of what was produced */
  summary: string;
  /** Errors encountered (if any) */
  errors: string[];
  durationMs: number;
  tokensUsed: number;
  startedAt: string;
  completedAt: string;
}

export interface CalendarEvent {
  id: string;
  name: string;
  description: string;
  /** Month (1-12) and day (1-31) for annual recurrence */
  month: number;
  day: number;
  /** Whether this repeats yearly */
  recurring: boolean;
  /** Year for one-off events */
  year?: number;
  /** Lead time in days before the event to generate the article */
  leadTimeDays: number;
  /** Suggested article topic */
  articleTopic: string;
  /** Key points the article should cover */
  keyPoints: string[];
  /** Whether this event is active */
  isActive: boolean;
  /** Last year an article was generated for this event */
  lastGeneratedYear?: number;
}

export interface PipelineTriggerResult {
  pipelineId: PipelineId;
  status: 'success' | 'skipped' | 'error';
  articlesGenerated: number;
  articleIds: string[];
  summary: string;
  errors: string[];
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Content Source Types
// ---------------------------------------------------------------------------

export interface ContentSource {
  id: string;
  /** Human-readable name */
  name: string;
  /** RSS feed URL */
  url: string;
  /** Source type — currently only RSS */
  type: 'rss';
  /** Which pipeline(s) this source feeds into */
  pipelines: PipelineId[];
  /** Whether this source is active */
  isActive: boolean;
  // ── Frequency Controls ──
  /** Minimum hours between checks (0 = no limit) */
  checkIntervalHours: number;
  /** Max articles to generate per single pipeline run from this source */
  maxArticlesPerRun: number;
  /** Max articles to generate per calendar day from this source (0 = no limit) */
  maxArticlesPerDay: number;
  /** Max articles to generate per calendar week from this source (0 = no limit) */
  maxArticlesPerWeek: number;
  // ── Filtering ──
  /** Optional keyword filter — items must match at least one keyword */
  filterKeywords?: string[];
  // ── Tracking ──
  /** ISO timestamp of last successful check */
  lastCheckedAt?: string;
  /** Articles generated today (auto-reset) */
  articlesGeneratedToday: number;
  /** Articles generated this week (auto-reset) */
  articlesGeneratedThisWeek: number;
  /** ISO date string for daily counter reset */
  dailyResetDate?: string;
  /** ISO date string (Monday) for weekly counter reset */
  weeklyResetDate?: string;
  /** Lifetime total */
  totalGenerated: number;
  created_at: string;
  updated_at: string;
}

export type CreateContentSourceInput = Omit<ContentSource, 'id' | 'lastCheckedAt' | 'articlesGeneratedToday' | 'articlesGeneratedThisWeek' | 'dailyResetDate' | 'weeklyResetDate' | 'totalGenerated' | 'created_at' | 'updated_at'>;

// ---------------------------------------------------------------------------
// KV Key Helpers
// ---------------------------------------------------------------------------

const CONFIG_PREFIX = 'auto_content:config:';
const RUN_PREFIX = 'auto_content:run:';
const CALENDAR_PREFIX = 'auto_content:calendar_event:';
const PROCESSED_PREFIX = 'auto_content:processed:';
const SOURCE_PREFIX = 'auto_content:source:';

function configKey(id: PipelineId): string { return `${CONFIG_PREFIX}${id}`; }
function runKey(id: PipelineId, ts: string): string { return `${RUN_PREFIX}${id}:${ts}`; }
function calendarKey(id: string): string { return `${CALENDAR_PREFIX}${id}`; }
function processedKey(pipeline: PipelineId, hash: string): string { return `${PROCESSED_PREFIX}${pipeline}:${hash}`; }
function sourceKey(id: string): string { return `${SOURCE_PREFIX}${id}`; }

// Cross-pipeline dedup prefix — prevents multiple pipelines covering the same topic
const GLOBAL_TOPIC_PREFIX = 'auto_content:global_topic:';
// Recently used Unsplash photo IDs — prevents repetitive hero images
const USED_IMAGE_PREFIX = 'auto_content:used_image:';

// Simple hash for dedup
function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit int
  }
  return Math.abs(hash).toString(36);
}

// ---------------------------------------------------------------------------
// Article Creation Helper
// ---------------------------------------------------------------------------

// ── Feature 1: Auto-Category Resolution ──────────────────────────────────

/** Fetch all active article categories from KV and return their names */
async function getAvailableCategoryNames(): Promise<{ names: string[]; categories: Array<{ id: string; name: string }> }> {
  const cats = await kv.getByPrefix('article_category:') as Array<{ id: string; name: string; is_active?: boolean }>;
  const active = cats.filter(c => c.is_active !== false);
  return {
    names: active.map(c => c.name),
    categories: active.map(c => ({ id: c.id, name: c.name })),
  };
}

/** Resolve a category name (from AI suggestion) to a category ID. Case-insensitive fuzzy match. */
function resolveCategoryId(
  suggestedName: string,
  categories: Array<{ id: string; name: string }>,
): string {
  if (!suggestedName) return '';
  // Exact match first
  const exact = categories.find(c => c.name.toLowerCase() === suggestedName.toLowerCase());
  if (exact) return exact.id;
  // Partial / includes match
  const partial = categories.find(c =>
    c.name.toLowerCase().includes(suggestedName.toLowerCase()) ||
    suggestedName.toLowerCase().includes(c.name.toLowerCase())
  );
  if (partial) {
    log.info('Category fuzzy-matched', { suggested: suggestedName, matched: partial.name });
    return partial.id;
  }
  log.info('No matching category found for AI suggestion', { suggestedName });
  return '';
}

// ── Feature 2: Cross-Pipeline Deduplication ──────────────────────────────

/**
 * Normalise a topic string for cross-pipeline dedup.
 * Strips common prefixes, lowercases, and removes non-alpha characters.
 */
function normaliseTopicForDedup(topic: string): string {
  return topic
    .replace(/^(regulatory update|navigate wealth perspective|weekly market commentary|financial news round-up)[:\s—–-]*/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check whether a similar topic has already been generated by ANY pipeline
 * within the recent window. Returns true if duplicate.
 */
async function isTopicDuplicate(topic: string, currentPipeline: PipelineId): Promise<boolean> {
  const normalised = normaliseTopicForDedup(topic);
  if (!normalised || normalised.length < 10) return false; // Too short to be meaningful

  const hash = simpleHash(normalised);
  const existing = await kv.get(`${GLOBAL_TOPIC_PREFIX}${hash}`) as { pipeline: string; articleId: string; createdAt: string } | null;

  if (existing && existing.pipeline !== currentPipeline) {
    log.info('Cross-pipeline duplicate detected', {
      topic: normalised.slice(0, 60),
      existingPipeline: existing.pipeline,
      currentPipeline,
    });
    return true;
  }
  return false;
}

/** Record a topic hash after successful article creation (for cross-pipeline dedup) */
async function recordTopicHash(topic: string, pipelineId: PipelineId, articleId: string): Promise<void> {
  const normalised = normaliseTopicForDedup(topic);
  if (!normalised || normalised.length < 10) return;

  const hash = simpleHash(normalised);
  await kv.set(`${GLOBAL_TOPIC_PREFIX}${hash}`, {
    pipeline: pipelineId,
    articleId,
    createdAt: new Date().toISOString(),
  });
}

// ── Feature 3: Stale Image Prevention ────────────────────────────────────

/** Load recently used Unsplash photo IDs from KV */
async function getRecentlyUsedImageIds(): Promise<Set<string>> {
  const entries = await kv.getByPrefix(USED_IMAGE_PREFIX) as Array<{ photoId: string; usedAt: string }>;
  // Only exclude images used in the last 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentIds = new Set<string>();
  for (const entry of entries) {
    if (new Date(entry.usedAt).getTime() > thirtyDaysAgo) {
      recentIds.add(entry.photoId);
    }
  }
  return recentIds;
}

/** Record a used Unsplash photo ID for future exclusion */
async function recordUsedImage(photoId: string): Promise<void> {
  if (!photoId) return;
  await kv.set(`${USED_IMAGE_PREFIX}${photoId}`, {
    photoId,
    usedAt: new Date().toISOString(),
  });
}

// ── Enhanced Article Creator ─────────────────────────────────────────────

async function createDraftArticle(
  result: GenerateArticleResult,
  categoryId: string,
  typeId: string,
  pipelineId: PipelineId,
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // ── Auto-category: resolve AI-suggested category when none configured ──
  let resolvedCategoryId = categoryId;
  if (!resolvedCategoryId && result.suggestedCategoryName) {
    const { categories } = await getAvailableCategoryNames();
    resolvedCategoryId = resolveCategoryId(result.suggestedCategoryName, categories);
    if (resolvedCategoryId) {
      log.info('Auto-resolved category for pipeline article', {
        pipeline: pipelineId,
        suggestedName: result.suggestedCategoryName,
        resolvedId: resolvedCategoryId,
      });
    }
  }

  // ── Check pipeline config for autoPublish setting ──
  const pipelineConfig = await kv.get(`auto_content:config:${pipelineId}`);
  const shouldAutoPublish = pipelineConfig?.autoPublish === true;

  const article = {
    id,
    title: result.title,
    subtitle: '',
    slug: result.suggestedSlug || result.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    excerpt: result.excerpt,
    body: result.body,
    category_id: resolvedCategoryId,
    type_id: typeId,
    author_id: '',
    author_name: 'Navigate Wealth',
    hero_image_url: result.suggestedHeroImageUrl || '',
    thumbnail_image_url: result.suggestedThumbnailUrl || '',
    reading_time_minutes: result.readingTimeMinutes,
    status: shouldAutoPublish ? 'published' as const : 'draft' as const,
    is_featured: false,
    published_at: shouldAutoPublish ? now : null,
    scheduled_for: null,
    seo_title: result.title,
    seo_description: result.suggestedMetaDescription,
    seo_canonical_url: '',
    created_at: now,
    updated_at: now,
    last_edited_by: `auto:${pipelineId}`,
    view_count: 0,
  };

  await kv.set(`article:${id}`, article);

  // ── Record topic hash for cross-pipeline dedup ──
  await recordTopicHash(result.title, pipelineId, id);

  log.info(shouldAutoPublish ? 'Published article created (auto-publish)' : 'Draft article created', {
    id, title: result.title, pipeline: pipelineId, categoryId: resolvedCategoryId,
  });
  return id;
}

/** Resolve the "Insights & Education" type ID from KV */
async function getDefaultTypeId(): Promise<string> {
  const types = await kv.getByPrefix('article_type:');
  const insightsType = (types as Array<{ id: string; name: string }>).find(
    (t) => t.name === 'Insights & Education'
  );
  return insightsType?.id || '';
}

// ---------------------------------------------------------------------------
// RSS Fetching Helper (server-side, no proxy needed)
// ---------------------------------------------------------------------------

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
}

async function fetchRSSItems(url: string): Promise<RSSItem[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      log.error(`RSS fetch failed for ${url}: ${response.status}`);
      return [];
    }

    const xmlText = await response.text();
    const items: RSSItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const matches = xmlText.matchAll(itemRegex);

    for (const match of matches) {
      const xml = match[1];
      items.push({
        title: decodeEntities(extractTag(xml, 'title')),
        link: extractTag(xml, 'link'),
        pubDate: extractTag(xml, 'pubDate') || new Date().toISOString(),
        description: decodeEntities(extractTag(xml, 'description')),
      });
    }
    return items.slice(0, 10); // Top 10
  } catch (err) {
    log.error(`RSS fetch error for ${url}`, err);
    return [];
  }
}

function extractTag(xml: string, tagName: string): string {
  const cdataRegex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const simpleRegex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(simpleRegex);
  return match ? match[1].trim() : '';
}

function decodeEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// ---------------------------------------------------------------------------
// Content Source Helpers — rate limiting and source resolution
// ---------------------------------------------------------------------------

/** Get today's date string for daily counter reset (YYYY-MM-DD) */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Get this week's Monday date string for weekly counter reset */
function weekStartStr(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

/**
 * Check whether a source has capacity to generate more articles,
 * respecting checkIntervalHours, maxArticlesPerDay, maxArticlesPerWeek.
 * Also resets daily/weekly counters when the date rolls over.
 */
async function checkSourceCapacity(src: ContentSource): Promise<{ allowed: boolean; reason?: string; source: ContentSource }> {
  const now = new Date();
  let mutated = false;

  // Reset daily counter if the date rolled
  const today = todayStr();
  if (src.dailyResetDate !== today) {
    src.articlesGeneratedToday = 0;
    src.dailyResetDate = today;
    mutated = true;
  }

  // Reset weekly counter if the week rolled
  const weekStart = weekStartStr();
  if (src.weeklyResetDate !== weekStart) {
    src.articlesGeneratedThisWeek = 0;
    src.weeklyResetDate = weekStart;
    mutated = true;
  }

  if (mutated) {
    await kv.set(sourceKey(src.id), src);
  }

  // Check interval
  if (src.checkIntervalHours > 0 && src.lastCheckedAt) {
    const lastChecked = new Date(src.lastCheckedAt);
    const hoursSince = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60);
    if (hoursSince < src.checkIntervalHours) {
      return { allowed: false, reason: `Checked ${Math.round(hoursSince)}h ago (interval: ${src.checkIntervalHours}h)`, source: src };
    }
  }

  // Check daily cap
  if (src.maxArticlesPerDay > 0 && src.articlesGeneratedToday >= src.maxArticlesPerDay) {
    return { allowed: false, reason: `Daily cap reached (${src.articlesGeneratedToday}/${src.maxArticlesPerDay})`, source: src };
  }

  // Check weekly cap
  if (src.maxArticlesPerWeek > 0 && src.articlesGeneratedThisWeek >= src.maxArticlesPerWeek) {
    return { allowed: false, reason: `Weekly cap reached (${src.articlesGeneratedThisWeek}/${src.maxArticlesPerWeek})`, source: src };
  }

  return { allowed: true, source: src };
}

/** Increment source counters after successful article generation */
async function incrementSourceCounters(src: ContentSource, count: number): Promise<void> {
  src.articlesGeneratedToday += count;
  src.articlesGeneratedThisWeek += count;
  src.totalGenerated += count;
  src.lastCheckedAt = new Date().toISOString();
  src.updated_at = new Date().toISOString();
  await kv.set(sourceKey(src.id), src);
}

/** Mark a source as checked (even if no articles were generated) */
async function markSourceChecked(src: ContentSource): Promise<void> {
  src.lastCheckedAt = new Date().toISOString();
  src.updated_at = new Date().toISOString();
  await kv.set(sourceKey(src.id), src);
}

/** Resolve active sources for a pipeline, falling back to hardcoded defaults */
async function getSourcesForPipeline(pipelineId: PipelineId): Promise<{ urls: string[]; sources: ContentSource[]; filterKeywords: string[] }> {
  const allSources = await kv.getByPrefix(SOURCE_PREFIX) as ContentSource[];
  const pipelineSources = allSources.filter(
    (s) => s.isActive && s.pipelines.includes(pipelineId)
  );

  if (pipelineSources.length === 0) {
    // Fall back to hardcoded defaults
    const fallbackMap: Record<PipelineId, string[]> = {
      market_commentary: MARKET_RSS_FEEDS,
      regulatory_monitor: REGULATORY_RSS_FEEDS,
      news_commentary: DEFAULT_NEWS_FEEDS,
      calendar_content: [],
    };
    return { urls: fallbackMap[pipelineId] || [], sources: [], filterKeywords: [] };
  }

  // Check capacity for each source, collect eligible URLs
  const urls: string[] = [];
  const eligible: ContentSource[] = [];
  const allKeywords: string[] = [];

  for (const src of pipelineSources) {
    const { allowed, reason, source } = await checkSourceCapacity(src);
    if (allowed) {
      urls.push(source.url);
      eligible.push(source);
      if (source.filterKeywords?.length) {
        allKeywords.push(...source.filterKeywords);
      }
    } else {
      log.info(`Source "${src.name}" skipped: ${reason}`);
    }
  }

  return { urls, sources: eligible, filterKeywords: allKeywords };
}

// ---------------------------------------------------------------------------
// Pipeline 1: Market Commentary
// ---------------------------------------------------------------------------

const MARKET_RSS_FEEDS = [
  'https://www.investing.com/rss/news_14.rss',  // Economic news
  'https://www.investing.com/rss/news_25.rss',  // Stock market
];

async function runMarketCommentary(config: PipelineConfig): Promise<PipelineTriggerResult> {
  const start = Date.now();
  const errors: string[] = [];
  const articleIds: string[] = [];
  let tokensUsed = 0;
  let sources: ContentSource[] = [];

  try {
    // Resolve sources for this pipeline
    const resolved = await getSourcesForPipeline('market_commentary');
    const feedUrls = resolved.urls;
    sources = resolved.sources;

    // Fetch latest market news headlines
    const allItems: RSSItem[] = [];
    for (const feedUrl of feedUrls) {
      const items = await fetchRSSItems(feedUrl);
      allItems.push(...items);
    }

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });

    // Build headlines context — may be empty if RSS feeds are unreachable
    let headlinesContext = '';
    if (allItems.length > 0) {
      // Dedup — check if we've recently generated from similar headlines
      const headlinesSummary = allItems.slice(0, 5).map(i => i.title).join(' | ');
      const hash = simpleHash(headlinesSummary);
      const alreadyProcessed = await kv.get(processedKey('market_commentary', hash));
      if (alreadyProcessed) {
        return {
          pipelineId: 'market_commentary',
          status: 'skipped',
          articlesGenerated: 0,
          articleIds: [],
          summary: 'Similar market headlines already processed recently',
          errors: [],
          durationMs: Date.now() - start,
        };
      }

      headlinesContext = allItems.slice(0, 8).map((item, i) =>
        `${i + 1}. ${item.title} (${new Date(item.pubDate).toLocaleDateString('en-ZA')})`
      ).join('\n');
    } else {
      // No RSS items — check weekly dedup using date-based hash instead
      const weekNum = Math.ceil((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
      const weekHash = simpleHash(`market_commentary_weekly_${today.getFullYear()}_${weekNum}`);
      const alreadyProcessed = await kv.get(processedKey('market_commentary', weekHash));
      if (alreadyProcessed) {
        return {
          pipelineId: 'market_commentary',
          status: 'skipped',
          articlesGenerated: 0,
          articleIds: [],
          summary: 'Weekly market commentary already generated (RSS feeds unavailable)',
          errors: ['RSS feeds returned no items — used general market knowledge'],
          durationMs: Date.now() - start,
        };
      }

      log.info('RSS feeds returned no items — generating market commentary from general knowledge');
    }

    // Auto-category: pass available categories when no explicit category configured
    const categoryContext = !config.categoryId ? await getAvailableCategoryNames() : { names: [], categories: [] };

    const brief: GenerateArticleBrief = {
      topic: `Weekly Market Commentary — ${dateStr}`,
      audience: config.audience,
      tone: config.tone,
      targetLength: config.targetLength,
      categoryName: config.categoryName || 'Market Updates',
      keyPoints: [
        'South African market performance (JSE All Share, Top 40)',
        'Rand exchange rate movements against major currencies',
        'Key economic indicators (inflation, interest rates, GDP)',
        'Global market context and how it affects SA investors',
        'Outlook and what investors should watch for next week',
      ],
      additionalInstructions: headlinesContext
        ? `Use these recent headlines as context for your commentary — transform all source material into entirely original Navigate Wealth content. Never mention, cite, or attribute the original publications. Preserve all numerical data (percentages, rand values, dates, thresholds) precisely with no omissions.\n\n${headlinesContext}\n\nToday's date is ${dateStr}. Write as a regular weekly market update for Navigate Wealth clients. Conclude with a decisive strategic advisory takeaway that positions Navigate Wealth as the trusted partner for navigating market complexity.`
        : `Today's date is ${dateStr}. Write a weekly market update for Navigate Wealth clients. Provide original market commentary covering SA and global markets, key economic indicators, and outlook. Include specific numerical context where possible (index levels, rand exchange rates, inflation figures). Conclude with a decisive strategic advisory takeaway that reinforces the value of working with a Navigate Wealth financial adviser.`,
      ...(categoryContext.names.length > 0 ? { availableCategories: categoryContext.names } : {}),
    };

    // Stale image prevention: load recently used image IDs
    const excludeImageIds = await getRecentlyUsedImageIds();
    const result = await generateFullArticle(brief, { excludeImageIds });
    tokensUsed = result.tokensUsed;

    // Track used image
    if (result.unsplashPhotoId) await recordUsedImage(result.unsplashPhotoId);

    const typeId = await getDefaultTypeId();
    const articleId = await createDraftArticle(result, config.categoryId || '', typeId, 'market_commentary');
    articleIds.push(articleId);

    // Mark as processed — use headline hash if available, otherwise week-based hash
    const dedupHash = allItems.length > 0
      ? simpleHash(allItems.slice(0, 5).map(i => i.title).join(' | '))
      : simpleHash(`market_commentary_weekly_${today.getFullYear()}_${Math.ceil((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`);
    await kv.set(processedKey('market_commentary', dedupHash), { processedAt: new Date().toISOString(), articleId });

    // Update source counters
    for (const src of sources) {
      await incrementSourceCounters(src, 1);
    }

    return {
      pipelineId: 'market_commentary',
      status: 'success',
      articlesGenerated: 1,
      articleIds,
      summary: `Generated market commentary: "${result.title}"`,
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    errors.push(msg);
    log.error('Market commentary pipeline failed', err);

    // Mark sources as checked even on failure
    for (const src of sources) {
      await markSourceChecked(src);
    }

    return {
      pipelineId: 'market_commentary',
      status: 'error',
      articlesGenerated: 0,
      articleIds,
      summary: `Pipeline failed: ${msg}`,
      errors,
      durationMs: Date.now() - start,
    };
  }
}

// ---------------------------------------------------------------------------
// Pipeline 2: Regulatory Change Monitor
// ---------------------------------------------------------------------------

const REGULATORY_RSS_FEEDS = [
  'https://www.investing.com/rss/news_14.rss', // Economic/regulatory news
];

// SA regulatory bodies to watch for in headlines
const REGULATORY_KEYWORDS = [
  'FSCA', 'SARB', 'National Treasury', 'FAIS', 'FICA', 'POPIA',
  'Reserve Bank', 'Financial Sector', 'regulation', 'regulatory',
  'compliance', 'pension fund', 'retirement', 'tax amendment',
  'exchange control', 'crypto regulation', 'insurance act',
  'financial advisory', 'conduct authority', 'prudential',
];

async function runRegulatoryMonitor(config: PipelineConfig): Promise<PipelineTriggerResult> {
  const start = Date.now();
  const errors: string[] = [];
  const articleIds: string[] = [];
  let tokensUsed = 0;

  try {
    // Resolve sources for this pipeline
    const { urls: feedUrls, sources, filterKeywords: sourceKeywords } = await getSourcesForPipeline('regulatory_monitor');

    // Merge source-level keywords with the global defaults
    const effectiveKeywords = sourceKeywords.length > 0 ? sourceKeywords : REGULATORY_KEYWORDS;

    // Fetch news and filter for regulatory content
    const allItems: RSSItem[] = [];
    for (const feedUrl of feedUrls) {
      const items = await fetchRSSItems(feedUrl);
      allItems.push(...items);
    }

    // Filter for regulatory-relevant items
    const regulatoryItems = allItems.filter((item) => {
      const text = `${item.title} ${item.description}`.toLowerCase();
      return effectiveKeywords.some((kw) => text.includes(kw.toLowerCase()));
    });

    if (regulatoryItems.length === 0) {
      return {
        pipelineId: 'regulatory_monitor',
        status: 'skipped',
        articlesGenerated: 0,
        articleIds: [],
        summary: 'No regulatory-relevant news items detected',
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    // Auto-category + stale image prevention
    const categoryContext = !config.categoryId ? await getAvailableCategoryNames() : { names: [], categories: [] };
    const excludeImageIds = await getRecentlyUsedImageIds();

    // Dedup
    for (const item of regulatoryItems.slice(0, 3)) {
      const hash = simpleHash(item.title);
      const alreadyProcessed = await kv.get(processedKey('regulatory_monitor', hash));
      if (alreadyProcessed) continue;

      // Cross-pipeline dedup: skip if another pipeline already covered this topic
      if (await isTopicDuplicate(item.title, 'regulatory_monitor')) {
        log.info('Skipping regulatory item — already covered by another pipeline', { title: item.title });
        continue;
      }

      try {
        const brief: GenerateArticleBrief = {
          topic: `Regulatory Update: ${item.title}`,
          audience: config.audience,
          tone: config.tone || 'authoritative',
          targetLength: config.targetLength || 'medium',
          categoryName: config.categoryName || 'Regulatory Updates',
          keyPoints: [
            'What changed or was announced',
            'Which financial services professionals and clients are affected',
            'What advisors need to do in response',
            'Timeline for compliance or implementation',
            'Practical next steps and recommendations',
          ],
          additionalInstructions: `Transform the following regulatory news into an entirely original Navigate Wealth article. Never mention, cite, or attribute the original source publication in any way. Preserve ALL numerical data — exact percentages, rand amounts, thresholds, effective dates, and limits — with absolutely no omissions or generalisations.\n\nSource context:\nTitle: ${item.title}\nSummary: ${item.description}\nDate: ${item.pubDate}\n\nWrite an original explanatory article that translates this regulatory development into clear, actionable guidance for Navigate Wealth clients. Reference the relevant legislation (FAIS Act, FICA, POPIA, etc.) where applicable. Explain the long-term wealth implications and conclude with a decisive strategic advisory takeaway that positions Navigate Wealth as the trusted adviser for navigating regulatory complexity.`,
          ...(categoryContext.names.length > 0 ? { availableCategories: categoryContext.names } : {}),
        };

        const result = await generateFullArticle(brief, { excludeImageIds });
        tokensUsed += result.tokensUsed;

        if (result.unsplashPhotoId) {
          await recordUsedImage(result.unsplashPhotoId);
          excludeImageIds.add(result.unsplashPhotoId); // Also exclude within this run
        }

        const typeId = await getDefaultTypeId();
        const articleId = await createDraftArticle(result, config.categoryId || '', typeId, 'regulatory_monitor');
        articleIds.push(articleId);

        await kv.set(processedKey('regulatory_monitor', hash), {
          processedAt: new Date().toISOString(),
          articleId,
          sourceTitle: item.title,
        });

        // Update source counters
        for (const src of sources) {
          await incrementSourceCounters(src, 1);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Generation failed';
        errors.push(`Failed to generate article for "${item.title}": ${msg}`);
        log.error('Regulatory article generation failed', { title: item.title, error: msg });
      }
    }

    return {
      pipelineId: 'regulatory_monitor',
      status: articleIds.length > 0 ? (errors.length > 0 ? 'partial' : 'success') : 'error',
      articlesGenerated: articleIds.length,
      articleIds,
      summary: articleIds.length > 0
        ? `Generated ${articleIds.length} regulatory update article(s)`
        : 'No articles generated — all items were previously processed or failed',
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    errors.push(msg);
    log.error('Regulatory monitor pipeline failed', err);
    return {
      pipelineId: 'regulatory_monitor',
      status: 'error',
      articlesGenerated: 0,
      articleIds,
      summary: `Pipeline failed: ${msg}`,
      errors,
      durationMs: Date.now() - start,
    };
  }
}

// ---------------------------------------------------------------------------
// Pipeline 3: News Commentary
// ---------------------------------------------------------------------------

const DEFAULT_NEWS_FEEDS = [
  'https://www.investing.com/rss/news_14.rss',   // Economic
  'https://www.investing.com/rss/news_25.rss',    // Stock market
  'https://www.investing.com/rss/news_1.rss',     // Forex
];

async function runNewsCommentary(config: PipelineConfig): Promise<PipelineTriggerResult> {
  const start = Date.now();
  const errors: string[] = [];
  const articleIds: string[] = [];
  let tokensUsed = 0;

  try {
    // Resolve sources for this pipeline
    const { urls: feedUrls, sources } = await getSourcesForPipeline('news_commentary');

    // If no managed sources returned URLs, also check the legacy config.rssFeeds
    const effectiveFeeds = feedUrls.length > 0 ? feedUrls : (config.rssFeeds?.length ? config.rssFeeds : DEFAULT_NEWS_FEEDS);

    const allItems: RSSItem[] = [];
    for (const feedUrl of effectiveFeeds) {
      const items = await fetchRSSItems(feedUrl);
      allItems.push(...items);
    }

    // When RSS feeds return nothing, generate a general financial commentary
    if (allItems.length === 0) {
      // Check dedup for general commentary
      const today = new Date();
      const dayHash = simpleHash(`news_commentary_general_${today.toISOString().slice(0, 10)}`);
      const alreadyDone = await kv.get(processedKey('news_commentary', dayHash));
      if (alreadyDone) {
        return {
          pipelineId: 'news_commentary',
          status: 'skipped',
          articlesGenerated: 0,
          articleIds: [],
          summary: 'General commentary already generated today (RSS feeds unavailable)',
          errors: ['RSS feeds returned no items'],
          durationMs: Date.now() - start,
        };
      }

      log.info('News RSS feeds returned no items — generating general financial commentary');

      const categoryContext = !config.categoryId ? await getAvailableCategoryNames() : { names: [], categories: [] };
      const excludeImageIds = await getRecentlyUsedImageIds();
      const dateStr = today.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });

      const brief: GenerateArticleBrief = {
        topic: `Navigate Wealth Perspective: Financial Markets Update — ${dateStr}`,
        audience: config.audience,
        tone: config.tone || 'professional',
        targetLength: config.targetLength || 'medium',
        categoryName: config.categoryName || 'Market Insights',
        keyPoints: [
          'Current South African economic landscape and key themes — include specific numerical data where possible',
          'Global market developments reframed for SA investors — rand exposure, offshore allocation implications',
          'Practical investment guidance interpreted through SA financial planning lens (Regulation 28, RAs, TFSAs)',
          'Key risks and opportunities — with decisive strategic advisory takeaway',
        ],
        additionalInstructions: `Today's date is ${dateStr}. Write an original thought-leadership commentary on current financial market themes and investment considerations for Navigate Wealth clients. Focus on South African market analysis, economic trends, and practical guidance interpreted through an SA financial planning lens — incorporate SARS implications, Regulation 28, retirement annuities, TFSAs, rand versus offshore allocation, and JSE dynamics where relevant. Include specific numerical context where possible. Conclude with a decisive strategic advisory takeaway that reinforces the value of working with a Navigate Wealth financial adviser.`,
        ...(categoryContext.names.length > 0 ? { availableCategories: categoryContext.names } : {}),
      };

      const result = await generateFullArticle(brief, { excludeImageIds });
      tokensUsed = result.tokensUsed;

      if (result.unsplashPhotoId) await recordUsedImage(result.unsplashPhotoId);

      const typeId = await getDefaultTypeId();
      const articleId = await createDraftArticle(result, config.categoryId || '', typeId, 'news_commentary');

      await kv.set(processedKey('news_commentary', dayHash), { processedAt: new Date().toISOString(), articleId });

      for (const src of sources) {
        await incrementSourceCounters(src, 1);
      }

      return {
        pipelineId: 'news_commentary',
        status: 'success',
        articlesGenerated: 1,
        articleIds: [articleId],
        summary: `Generated general financial commentary: "${result.title}" (RSS feeds unavailable)`,
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    // Pick the most interesting/relevant items not yet processed
    const unprocessed: RSSItem[] = [];
    for (const item of allItems) {
      const hash = simpleHash(item.title);
      const exists = await kv.get(processedKey('news_commentary', hash));
      if (!exists) {
        unprocessed.push(item);
      }
      if (unprocessed.length >= 3) break; // Max 3 per run
    }

    if (unprocessed.length === 0) {
      return {
        pipelineId: 'news_commentary',
        status: 'skipped',
        articlesGenerated: 0,
        articleIds: [],
        summary: 'All recent news items have already been processed',
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    // Cross-pipeline dedup: check if main topic already covered
    const mainTopic = unprocessed[0].title;
    if (await isTopicDuplicate(mainTopic, 'news_commentary')) {
      return {
        pipelineId: 'news_commentary',
        status: 'skipped',
        articlesGenerated: 0,
        articleIds: [],
        summary: 'Topic already covered by another pipeline — skipping to avoid duplicate',
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    // Generate one consolidated commentary from the top items
    const newsContext = unprocessed.map((item, i) =>
      `${i + 1}. ${item.title}\n   ${item.description?.slice(0, 200) || ''}\n   Published: ${new Date(item.pubDate).toLocaleDateString('en-ZA')}`
    ).join('\n\n');

    // Auto-category + stale image prevention
    const categoryContext = !config.categoryId ? await getAvailableCategoryNames() : { names: [], categories: [] };
    const excludeImageIds = await getRecentlyUsedImageIds();

    const brief: GenerateArticleBrief = {
      topic: unprocessed.length === 1
        ? `Navigate Wealth Perspective: ${unprocessed[0].title}`
        : 'Financial News Round-Up: Navigate Wealth Perspective',
      audience: config.audience,
      tone: config.tone || 'professional',
      targetLength: config.targetLength || 'medium',
      categoryName: config.categoryName || 'Market Insights',
      keyPoints: [
        'Fully rewrite all source material into entirely original Navigate Wealth content — never reference or attribute original sources',
        'Preserve ALL numerical data precisely — percentages, rand values, dates, thresholds, limits — with absolutely no omissions',
        'South African investor perspective — interpret through SA tax law, SARS, Regulation 28, RAs, TFSAs, rand/offshore allocation, JSE',
        'Practical, actionable takeaways for Navigate Wealth clients',
        'How this affects long-term financial planning decisions',
      ],
      additionalInstructions: `Transform these recent financial news stories into an entirely original Navigate Wealth thought-leadership article. Never mention, cite, or attribute the original source publications in any way — no phrases such as "according to" or "a recent report." Preserve ALL numerical data (percentages, rand values, dates, thresholds, limits) precisely with absolutely no omissions or generalisations.\n\n${newsContext}\n\nThe article must read as entirely original Navigate Wealth content, not a news summary or paraphrase. Interpret all material through a South African financial planning lens — incorporate SARS implications, Regulation 28, RAs, TFSAs, rand exposure, and JSE dynamics where relevant. Conclude with a decisive strategic advisory takeaway that reinforces the value of working with a Navigate Wealth financial adviser.`,
      ...(categoryContext.names.length > 0 ? { availableCategories: categoryContext.names } : {}),
    };

    const result = await generateFullArticle(brief, { excludeImageIds });
    tokensUsed = result.tokensUsed;

    if (result.unsplashPhotoId) await recordUsedImage(result.unsplashPhotoId);

    const typeId = await getDefaultTypeId();
    const articleId = await createDraftArticle(result, config.categoryId || '', typeId, 'news_commentary');
    articleIds.push(articleId);

    // Mark all processed items
    for (const item of unprocessed) {
      const hash = simpleHash(item.title);
      await kv.set(processedKey('news_commentary', hash), {
        processedAt: new Date().toISOString(),
        articleId,
        sourceTitle: item.title,
      });
    }

    // Update source counters
    for (const src of sources) {
      await incrementSourceCounters(src, 1);
    }

    return {
      pipelineId: 'news_commentary',
      status: 'success',
      articlesGenerated: 1,
      articleIds,
      summary: `Generated news commentary: "${result.title}" (from ${unprocessed.length} source items)`,
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    errors.push(msg);
    log.error('News commentary pipeline failed', err);
    return {
      pipelineId: 'news_commentary',
      status: 'error',
      articlesGenerated: 0,
      articleIds,
      summary: `Pipeline failed: ${msg}`,
      errors,
      durationMs: Date.now() - start,
    };
  }
}

// ---------------------------------------------------------------------------
// Pipeline 4: Calendar-Driven Content
// ---------------------------------------------------------------------------

/**
 * Default SA financial calendar events.
 * Seeded on first use; admins can add/remove via the UI.
 */
const DEFAULT_CALENDAR_EVENTS: Omit<CalendarEvent, 'id'>[] = [
  {
    name: 'Tax Season Opens',
    description: 'SARS tax filing season opens for individual taxpayers',
    month: 7,
    day: 1,
    recurring: true,
    leadTimeDays: 14,
    articleTopic: 'Tax Season Preparation Guide for South African Investors',
    keyPoints: [
      'Key dates and deadlines for the current tax year',
      'Tax-efficient investment strategies (RA contributions, TFSA)',
      'Common tax deductions financial advisors should remind clients about',
      'Section 11F retirement fund deductions',
      'Capital gains tax considerations for investment portfolios',
    ],
    isActive: true,
  },
  {
    name: 'National Budget Speech',
    description: 'Annual National Budget Speech by the Minister of Finance',
    month: 2,
    day: 19,
    recurring: true,
    leadTimeDays: 7,
    articleTopic: 'What to Expect from the National Budget Speech: Key Areas for Financial Advisors',
    keyPoints: [
      'Expected changes to personal income tax brackets',
      'Potential adjustments to retirement fund contribution limits',
      'Capital gains tax and estate duty expectations',
      'Impact on the Rand and investment markets',
      'What clients should discuss with their financial advisor',
    ],
    isActive: true,
  },
  {
    name: 'Tax Year End',
    description: 'South African tax year ends on 28/29 February',
    month: 2,
    day: 28,
    recurring: true,
    leadTimeDays: 30,
    articleTopic: 'Year-End Tax Planning: Maximise Your Tax Benefits Before the Deadline',
    keyPoints: [
      'Retirement annuity top-up strategies before year-end',
      'Tax-free savings account (TFSA) contribution maximisation',
      'Charitable donation deductions (Section 18A)',
      'Medical scheme fee tax credits review',
      'Capital gains tax harvesting opportunities',
    ],
    isActive: true,
  },
  {
    name: 'MPC Interest Rate Decision — January',
    description: 'SA Reserve Bank Monetary Policy Committee interest rate announcement',
    month: 1,
    day: 25,
    recurring: true,
    leadTimeDays: 7,
    articleTopic: 'MPC Interest Rate Decision: What It Means for Your Financial Plan',
    keyPoints: [
      'Current inflation trends and their impact on interest rates',
      'How rate changes affect bond portfolios and property investments',
      'Impact on variable-rate home loans and credit',
      'What the decision signals about the economic outlook',
      'Strategies for investors in the current rate environment',
    ],
    isActive: true,
  },
  {
    name: 'MPC Interest Rate Decision — March',
    description: 'SA Reserve Bank MPC interest rate announcement',
    month: 3,
    day: 27,
    recurring: true,
    leadTimeDays: 7,
    articleTopic: 'MPC Rate Decision: Navigating the Interest Rate Cycle',
    keyPoints: [
      'Rate decision context and economic indicators',
      'Impact on fixed income and money market investments',
      'Implications for clients with home loans',
      'How to position portfolios based on rate direction',
      'Guidance for clients concerned about rate changes',
    ],
    isActive: true,
  },
  {
    name: 'MPC Interest Rate Decision — May',
    description: 'SA Reserve Bank MPC interest rate announcement',
    month: 5,
    day: 22,
    recurring: true,
    leadTimeDays: 7,
    articleTopic: 'Mid-Year Rate Decision: Interest Rate Outlook for SA Investors',
    keyPoints: [
      'Rate decision and its impact on investment strategy',
      'Fixed vs variable rate considerations',
      'Impact on retirement fund returns',
      'Global rate environment comparison',
      'Advisor talking points for client conversations',
    ],
    isActive: true,
  },
  {
    name: 'MPC Interest Rate Decision — July',
    description: 'SA Reserve Bank MPC interest rate announcement',
    month: 7,
    day: 17,
    recurring: true,
    leadTimeDays: 7,
    articleTopic: 'July MPC Decision: Rates, Inflation, and Your Investment Strategy',
    keyPoints: [
      'Mid-year economic assessment',
      'Inflation trajectory and rate implications',
      'Portfolio positioning guidance',
      'Impact on income-generating investments',
      'Long-term planning considerations',
    ],
    isActive: true,
  },
  {
    name: 'MPC Interest Rate Decision — September',
    description: 'SA Reserve Bank MPC interest rate announcement',
    month: 9,
    day: 18,
    recurring: true,
    leadTimeDays: 7,
    articleTopic: 'September MPC Rate Decision: Building Towards Year-End',
    keyPoints: [
      'Rate decision and Q3 economic outlook',
      'Year-end portfolio review considerations',
      'Impact on annual financial planning',
      'Client communication strategies',
    ],
    isActive: true,
  },
  {
    name: 'MPC Interest Rate Decision — November',
    description: 'SA Reserve Bank MPC interest rate announcement',
    month: 11,
    day: 20,
    recurring: true,
    leadTimeDays: 7,
    articleTopic: 'Final MPC Decision of the Year: Setting Up for Success',
    keyPoints: [
      'Final rate decision and year-in-review',
      'How the rate cycle has evolved during the year',
      'Positioning for the new year',
      'Tax year-end planning in context of rates',
    ],
    isActive: true,
  },
  {
    name: 'Retirement Fund Contribution Deadline',
    description: 'Deadline for additional RA contributions to count against current tax year',
    month: 2,
    day: 28,
    recurring: true,
    leadTimeDays: 45,
    articleTopic: 'Retirement Annuity Contributions: Your Last Chance to Save Tax This Year',
    keyPoints: [
      'Maximum deductible RA contribution limits (27.5% of taxable income, capped at R350,000)',
      'Benefits of topping up before tax year-end',
      'How to calculate optimal contribution amounts',
      'Comparison of RA vs TFSA for tax-efficient savings',
      'Steps to arrange a top-up with your financial advisor',
    ],
    isActive: true,
  },
  {
    name: 'Medium-Term Budget Policy Statement',
    description: 'Finance Minister delivers the Medium-Term Budget Policy Statement',
    month: 10,
    day: 30,
    recurring: true,
    leadTimeDays: 7,
    articleTopic: 'Medium-Term Budget: What the Revised Outlook Means for Your Finances',
    keyPoints: [
      'Key fiscal revisions and what they signal',
      'Impact on government bond yields and investor confidence',
      'Revenue collection performance and tax implications',
      'SOE funding and fiscal risk assessment',
      'What advisors should discuss with clients',
    ],
    isActive: true,
  },
  {
    name: 'Annual TFSA Contribution Reset',
    description: 'Tax-Free Savings Account annual contribution limit resets on 1 March',
    month: 3,
    day: 1,
    recurring: true,
    leadTimeDays: 14,
    articleTopic: 'New Tax Year, New TFSA Opportunity: Maximise Your R36,000 Allowance',
    keyPoints: [
      'Annual R36,000 and lifetime R500,000 contribution limits',
      'Benefits of contributing early in the tax year (compound growth)',
      'Choosing the right TFSA investment (ETFs, unit trusts, fixed deposits)',
      'TFSA vs RA comparison for different investor profiles',
      'Common TFSA mistakes to avoid',
    ],
    isActive: true,
  },
];

async function seedCalendarEvents(): Promise<CalendarEvent[]> {
  const existing = await kv.getByPrefix(CALENDAR_PREFIX);
  if ((existing as CalendarEvent[]).length > 0) {
    log.info('Calendar events already seeded');
    return existing as CalendarEvent[];
  }

  const events: CalendarEvent[] = [];
  for (const def of DEFAULT_CALENDAR_EVENTS) {
    const id = crypto.randomUUID();
    const event: CalendarEvent = { id, ...def };
    await kv.set(calendarKey(id), event);
    events.push(event);
  }

  log.info(`Seeded ${events.length} default calendar events`);
  return events;
}

async function runCalendarContent(config: PipelineConfig): Promise<PipelineTriggerResult> {
  const start = Date.now();
  const errors: string[] = [];
  const articleIds: string[] = [];
  let tokensUsed = 0;

  try {
    // Ensure calendar events exist
    const events = await seedCalendarEvents();
    const activeEvents = events.filter((e) => e.isActive);

    const now = new Date();
    const currentYear = now.getFullYear();
    const leadDays = config.leadTimeDays || 14;

    // Find events that are upcoming within the lead time
    const upcomingEvents: CalendarEvent[] = [];
    for (const event of activeEvents) {
      if (event.lastGeneratedYear === currentYear) continue;

      const eventDate = new Date(event.year || currentYear, event.month - 1, event.day);
      const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const effectiveLeadTime = event.leadTimeDays || leadDays;
      if (daysUntil >= 0 && daysUntil <= effectiveLeadTime) {
        upcomingEvents.push(event);
      }
    }

    if (upcomingEvents.length === 0) {
      return {
        pipelineId: 'calendar_content',
        status: 'skipped',
        articlesGenerated: 0,
        articleIds: [],
        summary: 'No upcoming calendar events within the lead time window',
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    // Auto-category + stale image prevention
    const categoryContext = !config.categoryId ? await getAvailableCategoryNames() : { names: [], categories: [] };
    const excludeImageIds = await getRecentlyUsedImageIds();

    // Generate an article for each upcoming event
    for (const event of upcomingEvents) {
      try {
        // Cross-pipeline dedup
        if (await isTopicDuplicate(event.articleTopic, 'calendar_content')) {
          log.info('Skipping calendar event — topic already covered', { event: event.name });
          continue;
        }

        const eventDate = new Date(event.year || currentYear, event.month - 1, event.day);
        const eventDateStr = eventDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });

        const brief: GenerateArticleBrief = {
          topic: event.articleTopic,
          audience: config.audience,
          tone: config.tone || 'educational',
          targetLength: config.targetLength || 'medium',
          categoryName: config.categoryName || 'Financial Planning',
          keyPoints: event.keyPoints,
          additionalInstructions: `This article is being generated ahead of "${event.name}" on ${eventDateStr}.\n\n${event.description}\n\nWrite a timely, forward-looking article that helps Navigate Wealth clients prepare for this event. Include ALL relevant numerical data — exact percentages, rand amounts, thresholds, contribution limits, tax brackets, and effective dates — with absolutely no omissions or generalisations. Interpret through a South African financial planning lens, incorporating SARS implications, Regulation 28, RAs, TFSAs, and relevant tax legislation. Conclude with a decisive strategic advisory takeaway that positions Navigate Wealth as the trusted partner for proactive financial planning.`,
          ...(categoryContext.names.length > 0 ? { availableCategories: categoryContext.names } : {}),
        };

        const result = await generateFullArticle(brief, { excludeImageIds });
        tokensUsed += result.tokensUsed;

        if (result.unsplashPhotoId) {
          await recordUsedImage(result.unsplashPhotoId);
          excludeImageIds.add(result.unsplashPhotoId);
        }

        const typeId = await getDefaultTypeId();
        const articleId = await createDraftArticle(result, config.categoryId || '', typeId, 'calendar_content');
        articleIds.push(articleId);

        // Mark event as generated for this year
        const updated: CalendarEvent = { ...event, lastGeneratedYear: currentYear };
        await kv.set(calendarKey(event.id), updated);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Generation failed';
        errors.push(`Failed for event "${event.name}": ${msg}`);
        log.error('Calendar content generation failed', { event: event.name, error: msg });
      }
    }

    return {
      pipelineId: 'calendar_content',
      status: articleIds.length > 0 ? (errors.length > 0 ? 'partial' : 'success') : 'error',
      articlesGenerated: articleIds.length,
      articleIds,
      summary: articleIds.length > 0
        ? `Generated ${articleIds.length} calendar-driven article(s) for: ${upcomingEvents.filter((_, i) => articleIds[i]).map(e => e.name).join(', ')}`
        : 'No articles generated',
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    errors.push(msg);
    log.error('Calendar content pipeline failed', err);
    return {
      pipelineId: 'calendar_content',
      status: 'error',
      articlesGenerated: 0,
      articleIds,
      summary: `Pipeline failed: ${msg}`,
      errors,
      durationMs: Date.now() - start,
    };
  }
}

// ---------------------------------------------------------------------------
// Pipeline Orchestrator
// ---------------------------------------------------------------------------

const PIPELINE_RUNNERS: Record<PipelineId, (config: PipelineConfig) => Promise<PipelineTriggerResult>> = {
  market_commentary: runMarketCommentary,
  regulatory_monitor: runRegulatoryMonitor,
  news_commentary: runNewsCommentary,
  calendar_content: runCalendarContent,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const AutoContentService = {
  // ── Config Management ─────────────────────────────────────────────

  async getConfigs(): Promise<PipelineConfig[]> {
    const configs = await kv.getByPrefix(CONFIG_PREFIX);
    return (configs as PipelineConfig[]).sort((a, b) => a.id.localeCompare(b.id));
  },

  async getConfig(id: PipelineId): Promise<PipelineConfig | null> {
    return (await kv.get(configKey(id))) as PipelineConfig | null;
  },

  async updateConfig(id: PipelineId, updates: Partial<PipelineConfig>): Promise<PipelineConfig> {
    let existing = (await kv.get(configKey(id))) as PipelineConfig | null;
    if (!existing) {
      existing = await this.seedConfig(id);
    }

    const updated: PipelineConfig = {
      ...existing,
      ...updates,
      id, // immutable
      updated_at: new Date().toISOString(),
    };

    await kv.set(configKey(id), updated);
    log.info('Pipeline config updated', { id });
    return updated;
  },

  async seedConfig(id: PipelineId): Promise<PipelineConfig> {
    const now = new Date().toISOString();
    const defaults: Record<PipelineId, PipelineConfig> = {
      market_commentary: {
        id: 'market_commentary',
        name: 'Market Commentary',
        description: 'Generates weekly market update articles from financial data feeds',
        enabled: false,
        audience: 'both',
        tone: 'professional',
        targetLength: 'medium',
        categoryName: 'Market Updates',
        totalGenerated: 0,
        scheduleIntervalHours: 168, // Weekly
        created_at: now,
        updated_at: now,
      },
      regulatory_monitor: {
        id: 'regulatory_monitor',
        name: 'Regulatory Monitor',
        description: 'Detects SA regulatory changes and generates explanatory articles',
        enabled: false,
        audience: 'advisors',
        tone: 'authoritative',
        targetLength: 'medium',
        categoryName: 'Regulatory Updates',
        totalGenerated: 0,
        scheduleIntervalHours: 24, // Daily
        created_at: now,
        updated_at: now,
      },
      news_commentary: {
        id: 'news_commentary',
        name: 'News Commentary',
        description: 'Generates original commentary from trending SA financial news',
        enabled: false,
        audience: 'both',
        tone: 'professional',
        targetLength: 'medium',
        categoryName: 'Market Insights',
        rssFeeds: DEFAULT_NEWS_FEEDS,
        totalGenerated: 0,
        scheduleIntervalHours: 12, // Twice daily
        created_at: now,
        updated_at: now,
      },
      calendar_content: {
        id: 'calendar_content',
        name: 'Calendar Content',
        description: 'Auto-generates articles ahead of SA financial calendar events',
        enabled: false,
        audience: 'both',
        tone: 'educational',
        targetLength: 'medium',
        categoryName: 'Financial Planning',
        leadTimeDays: 14,
        totalGenerated: 0,
        scheduleIntervalHours: 24, // Daily
        created_at: now,
        updated_at: now,
      },
    };

    const config = defaults[id];
    await kv.set(configKey(id), config);
    return config;
  },

  async seedAllConfigs(): Promise<PipelineConfig[]> {
    const existing = await kv.getByPrefix(CONFIG_PREFIX);
    const existingIds = new Set((existing as PipelineConfig[]).map((c) => c.id));

    const pipelineIds: PipelineId[] = ['market_commentary', 'regulatory_monitor', 'news_commentary', 'calendar_content'];
    const configs: PipelineConfig[] = existing as PipelineConfig[];

    // Backfill scheduleIntervalHours for existing configs that pre-date the field
    const defaultIntervals: Record<PipelineId, number> = {
      market_commentary: 168,
      regulatory_monitor: 24,
      news_commentary: 12,
      calendar_content: 24,
    };
    for (const config of configs) {
      if (config.scheduleIntervalHours === undefined || config.scheduleIntervalHours === null) {
        (config as PipelineConfig).scheduleIntervalHours = defaultIntervals[config.id] ?? 24;
        await kv.set(configKey(config.id), config);
      }
    }

    for (const id of pipelineIds) {
      if (!existingIds.has(id)) {
        const config = await this.seedConfig(id);
        configs.push(config);
      }
    }

    return configs.sort((a, b) => a.id.localeCompare(b.id));
  },

  // ── Pipeline Execution ────────────────────────────────────────────

  async triggerPipeline(id: PipelineId): Promise<PipelineTriggerResult> {
    let config = await this.getConfig(id);
    if (!config) {
      config = await this.seedConfig(id);
    }

    log.info(`Triggering pipeline: ${id}`);
    const runner = PIPELINE_RUNNERS[id];
    if (!runner) {
      throw new Error(`Unknown pipeline: ${id}`);
    }

    const result = await runner(config);

    // Save run log
    const runLog: PipelineRunLog = {
      id: crypto.randomUUID(),
      pipelineId: id,
      status: result.status === 'skipped' ? 'success' : result.status,
      articlesGenerated: result.articlesGenerated,
      articleIds: result.articleIds,
      summary: result.summary,
      errors: result.errors,
      durationMs: result.durationMs,
      tokensUsed: 0,
      startedAt: new Date(Date.now() - result.durationMs).toISOString(),
      completedAt: new Date().toISOString(),
    };

    await kv.set(runKey(id, runLog.completedAt), runLog);

    // Update config stats
    const updatedConfig: PipelineConfig = {
      ...config,
      lastRunAt: runLog.completedAt,
      totalGenerated: (config.totalGenerated || 0) + result.articlesGenerated,
      updated_at: runLog.completedAt,
    };
    await kv.set(configKey(id), updatedConfig);

    log.info(`Pipeline ${id} completed`, {
      status: result.status,
      articlesGenerated: result.articlesGenerated,
      durationMs: result.durationMs,
    });

    return result;
  },

  async triggerAll(): Promise<PipelineTriggerResult[]> {
    const configs = await this.seedAllConfigs();
    const enabledConfigs = configs.filter((c) => c.enabled);

    if (enabledConfigs.length === 0) {
      log.info('No pipelines enabled — skipping triggerAll');
      return [];
    }

    const results: PipelineTriggerResult[] = [];
    for (const config of enabledConfigs) {
      const result = await this.triggerPipeline(config.id);
      results.push(result);
    }

    return results;
  },

  /**
   * Process only pipelines that are due based on their scheduleIntervalHours.
   * Called by the client-side poller (similar to process-scheduled for articles).
   * Idempotent — safe to call repeatedly; no-op when nothing is due.
   */
  async processDuePipelines(): Promise<{
    processed: PipelineTriggerResult[];
    skippedCount: number;
    totalArticlesGenerated: number;
  }> {
    const configs = await this.seedAllConfigs();
    const enabledConfigs = configs.filter((c) => c.enabled);

    if (enabledConfigs.length === 0) {
      log.info('processDuePipelines: No pipelines enabled');
      return { processed: [], skippedCount: 0, totalArticlesGenerated: 0 };
    }

    const now = Date.now();
    const dueConfigs: PipelineConfig[] = [];
    let skippedCount = 0;

    for (const config of enabledConfigs) {
      // scheduleIntervalHours of 0 means manual-only
      const interval = config.scheduleIntervalHours || 0;
      if (interval <= 0) {
        skippedCount++;
        continue;
      }

      if (!config.lastRunAt) {
        // Never run before — it's due
        dueConfigs.push(config);
        continue;
      }

      const lastRun = new Date(config.lastRunAt).getTime();
      const intervalMs = interval * 60 * 60 * 1000;
      if (now - lastRun >= intervalMs) {
        dueConfigs.push(config);
      } else {
        skippedCount++;
      }
    }

    if (dueConfigs.length === 0) {
      log.info('processDuePipelines: No pipelines due', { enabledCount: enabledConfigs.length, skippedCount });
      return { processed: [], skippedCount, totalArticlesGenerated: 0 };
    }

    log.info(`processDuePipelines: ${dueConfigs.length} pipeline(s) due`, {
      due: dueConfigs.map((c) => c.id),
    });

    const processed: PipelineTriggerResult[] = [];
    for (const config of dueConfigs) {
      try {
        const result = await this.triggerPipeline(config.id);
        processed.push(result);
      } catch (err) {
        log.error(`processDuePipelines: Pipeline ${config.id} failed`, err);
        processed.push({
          pipelineId: config.id,
          status: 'error',
          articlesGenerated: 0,
          articleIds: [],
          summary: `Error: ${err instanceof Error ? err.message : String(err)}`,
          errors: [err instanceof Error ? err.message : String(err)],
          durationMs: 0,
        });
      }
    }

    const totalArticlesGenerated = processed.reduce((sum, r) => sum + r.articlesGenerated, 0);
    log.info('processDuePipelines: Complete', {
      pipelinesRun: processed.length,
      totalArticlesGenerated,
      skippedCount,
    });

    return { processed, skippedCount, totalArticlesGenerated };
  },

  // ── Run History ───────────────────────────────────────────────────

  async getRunHistory(id: PipelineId, limit: number = 20): Promise<PipelineRunLog[]> {
    const runs = await kv.getByPrefix(`${RUN_PREFIX}${id}:`);
    return (runs as PipelineRunLog[])
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .slice(0, limit);
  },

  // ── Calendar Events ───────────────────────────────────────────────

  async getCalendarEvents(): Promise<CalendarEvent[]> {
    const events = await seedCalendarEvents();
    return events.sort((a, b) => {
      if (a.month !== b.month) return a.month - b.month;
      return a.day - b.day;
    });
  },

  async updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | null> {
    const existing = (await kv.get(calendarKey(id))) as CalendarEvent | null;
    if (!existing) return null;

    const updated: CalendarEvent = { ...existing, ...updates, id };
    await kv.set(calendarKey(id), updated);
    return updated;
  },

  async addCalendarEvent(input: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    const id = crypto.randomUUID();
    const event: CalendarEvent = { id, ...input };
    await kv.set(calendarKey(id), event);
    log.info('Calendar event added', { id, name: input.name });
    return event;
  },

  async deleteCalendarEvent(id: string): Promise<boolean> {
    const existing = await kv.get(calendarKey(id));
    if (!existing) return false;
    await kv.del(calendarKey(id));
    log.info('Calendar event deleted', { id });
    return true;
  },

  // ── Content Sources ───────────────────────────────────────────────

  async getContentSources(): Promise<ContentSource[]> {
    const sources = await kv.getByPrefix(SOURCE_PREFIX);
    return (sources as ContentSource[]).sort((a, b) => a.name.localeCompare(b.name));
  },

  async getContentSource(id: string): Promise<ContentSource | null> {
    return (await kv.get(sourceKey(id))) as ContentSource | null;
  },

  async updateContentSource(id: string, updates: Partial<ContentSource>): Promise<ContentSource | null> {
    const existing = (await kv.get(sourceKey(id))) as ContentSource | null;
    if (!existing) return null;

    const updated: ContentSource = { ...existing, ...updates, id };
    await kv.set(sourceKey(id), updated);
    return updated;
  },

  async addContentSource(input: CreateContentSourceInput): Promise<ContentSource> {
    const id = crypto.randomUUID();
    const source: ContentSource = {
      id,
      ...input,
      lastCheckedAt: '',
      articlesGeneratedToday: 0,
      articlesGeneratedThisWeek: 0,
      dailyResetDate: '',
      weeklyResetDate: '',
      totalGenerated: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await kv.set(sourceKey(id), source);
    log.info('Content source added', { id, name: input.name });
    return source;
  },

  async deleteContentSource(id: string): Promise<boolean> {
    const existing = await kv.get(sourceKey(id));
    if (!existing) return false;
    await kv.del(sourceKey(id));
    log.info('Content source deleted', { id });
    return true;
  },

  // ── Trigger Source (run article generation from a single source) ───

  /**
   * Trigger article generation for a specific content source.
   * Fetches the source's RSS feed, deduplicates, and generates articles
   * using the first pipeline associated with the source.
   */
  async triggerSource(sourceId: string): Promise<{ results: PipelineTriggerResult[]; totalGenerated: number; sourceName: string }> {
    const source = (await kv.get(sourceKey(sourceId))) as ContentSource | null;
    if (!source) {
      throw new Error(`Content source not found: ${sourceId}`);
    }

    log.info(`Triggering source: ${source.name}`, { sourceId, url: source.url, pipelines: source.pipelines });

    const start = Date.now();
    const results: PipelineTriggerResult[] = [];
    let totalGenerated = 0;

    // Fetch RSS items from this single source
    const items = await fetchRSSItems(source.url);

    if (items.length === 0) {
      const skipped: PipelineTriggerResult = {
        pipelineId: source.pipelines[0] || 'news_commentary',
        status: 'skipped',
        articlesGenerated: 0,
        articleIds: [],
        summary: `No items found in RSS feed for "${source.name}"`,
        errors: [],
        durationMs: Date.now() - start,
      };
      results.push(skipped);
      await markSourceChecked(source);
      return { results, totalGenerated: 0, sourceName: source.name };
    }

    // Use the first pipeline this source is configured for
    const pipelineId = source.pipelines[0] || 'news_commentary';

    // Get pipeline config for settings
    let config = await this.getConfig(pipelineId);
    if (!config) {
      config = await this.seedConfig(pipelineId);
    }

    // Filter to unprocessed items only
    const unprocessed: RSSItem[] = [];
    for (const item of items) {
      const hash = simpleHash(item.title);
      const exists = await kv.get(processedKey(pipelineId, hash));
      if (!exists) {
        unprocessed.push(item);
      }
      if (unprocessed.length >= (source.maxArticlesPerRun || 3)) break;
    }

    if (unprocessed.length === 0) {
      const skipped: PipelineTriggerResult = {
        pipelineId,
        status: 'skipped',
        articlesGenerated: 0,
        articleIds: [],
        summary: `All recent items from "${source.name}" have already been processed`,
        errors: [],
        durationMs: Date.now() - start,
      };
      results.push(skipped);
      await markSourceChecked(source);
      return { results, totalGenerated: 0, sourceName: source.name };
    }

    // Apply keyword filtering if configured
    let filtered = unprocessed;
    if (source.filterKeywords?.length) {
      const keywords = source.filterKeywords.map(k => k.toLowerCase());
      filtered = unprocessed.filter(item => {
        const text = `${item.title} ${item.description || ''}`.toLowerCase();
        return keywords.some(kw => text.includes(kw));
      });

      if (filtered.length === 0) {
        const skipped: PipelineTriggerResult = {
          pipelineId,
          status: 'skipped',
          articlesGenerated: 0,
          articleIds: [],
          summary: `No items from "${source.name}" matched keyword filters`,
          errors: [],
          durationMs: Date.now() - start,
        };
        results.push(skipped);
        await markSourceChecked(source);
        return { results, totalGenerated: 0, sourceName: source.name };
      }
    }

    // Cross-pipeline dedup
    const mainTopic = filtered[0].title;
    if (await isTopicDuplicate(mainTopic, pipelineId)) {
      const skipped: PipelineTriggerResult = {
        pipelineId,
        status: 'skipped',
        articlesGenerated: 0,
        articleIds: [],
        summary: `Topic from "${source.name}" already covered by another pipeline`,
        errors: [],
        durationMs: Date.now() - start,
      };
      results.push(skipped);
      await markSourceChecked(source);
      return { results, totalGenerated: 0, sourceName: source.name };
    }

    // Build the article brief
    const newsContext = filtered.map((item, i) =>
      `${i + 1}. ${item.title}\n   ${item.description?.slice(0, 200) || ''}\n   Published: ${new Date(item.pubDate).toLocaleDateString('en-ZA')}`
    ).join('\n\n');

    const categoryContext = !config.categoryId ? await getAvailableCategoryNames() : { names: [], categories: [] };
    const excludeImageIds = await getRecentlyUsedImageIds();

    const brief: GenerateArticleBrief = {
      topic: filtered.length === 1
        ? `Navigate Wealth Perspective: ${filtered[0].title}`
        : `${source.name}: Navigate Wealth Perspective`,
      audience: config.audience,
      tone: config.tone || 'professional',
      targetLength: config.targetLength || 'medium',
      categoryName: config.categoryName || 'Market Insights',
      keyPoints: [
        'Original analysis — do NOT copy news content verbatim',
        'South African investor perspective and implications',
        'Practical takeaways for advisors and clients',
        'How this affects financial planning decisions',
      ],
      additionalInstructions: `Generate an original commentary article based on these recent items from the "${source.name}" feed. Provide Navigate Wealth's independent perspective — never copy content directly.\n\n${newsContext}\n\nThe article should read as an original thought-leadership piece, not a news summary. Add value through analysis, context, and practical guidance for a South African audience.`,
      ...(categoryContext.names.length > 0 ? { availableCategories: categoryContext.names } : {}),
    };

    const errors: string[] = [];
    const articleIds: string[] = [];

    try {
      const result = await generateFullArticle(brief, { excludeImageIds });

      if (result.unsplashPhotoId) await recordUsedImage(result.unsplashPhotoId);

      const typeId = await getDefaultTypeId();
      const articleId = await createDraftArticle(result, config.categoryId || '', typeId, pipelineId);
      articleIds.push(articleId);
      totalGenerated = 1;

      // Mark all filtered items as processed
      for (const item of filtered) {
        const hash = simpleHash(item.title);
        await kv.set(processedKey(pipelineId, hash), {
          processedAt: new Date().toISOString(),
          articleId,
          sourceTitle: item.title,
          sourceId,
        });
      }

      // Update source counters
      await incrementSourceCounters(source, 1);

      // Update pipeline config stats
      const updatedConfig: PipelineConfig = {
        ...config,
        lastRunAt: new Date().toISOString(),
        totalGenerated: (config.totalGenerated || 0) + 1,
        updated_at: new Date().toISOString(),
      };
      await kv.set(configKey(pipelineId), updatedConfig);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      log.error(`Error generating article from source "${source.name}":`, err);
    }

    const pipelineResult: PipelineTriggerResult = {
      pipelineId,
      status: errors.length > 0 ? 'error' : 'success',
      articlesGenerated: totalGenerated,
      articleIds,
      summary: totalGenerated > 0
        ? `Generated ${totalGenerated} article(s) from "${source.name}"`
        : `Failed to generate articles from "${source.name}"`,
      errors,
      durationMs: Date.now() - start,
    };
    results.push(pipelineResult);

    // Save run log
    const runLog: PipelineRunLog = {
      id: crypto.randomUUID(),
      pipelineId,
      status: pipelineResult.status === 'skipped' ? 'success' : pipelineResult.status,
      articlesGenerated: totalGenerated,
      articleIds,
      summary: pipelineResult.summary,
      errors,
      durationMs: pipelineResult.durationMs,
      tokensUsed: 0,
      startedAt: new Date(Date.now() - pipelineResult.durationMs).toISOString(),
      completedAt: new Date().toISOString(),
    };
    await kv.set(runKey(pipelineId, runLog.completedAt), runLog);

    log.info(`Source trigger completed: ${source.name}`, { totalGenerated, durationMs: pipelineResult.durationMs });

    return { results, totalGenerated, sourceName: source.name };
  },

  // ── Feed Discovery ─────────────────────────────────────────────────

  /**
   * Discover RSS/Atom feeds from a given URL.
   *
   * Strategy:
   *  1. Fetch the URL
   *  2. If the response is valid RSS/Atom XML → return it as the single feed
   *  3. Otherwise parse as HTML and look for <link rel="alternate"> feed tags
   *  4. Also probe common feed paths (/feed, /rss, /rss.xml, etc.) as fallback
   *  5. Return all discovered feeds (may be empty)
   */
  async discoverFeeds(url: string): Promise<DiscoveredFeed[]> {
    log.info('Discovering feeds for URL', { url });

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html, application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        log.error(`Feed discovery fetch failed: ${response.status}`, { url });
        return [];
      }

      const contentType = response.headers.get('content-type') || '';
      const body = await response.text();

      // ── Check if this IS an RSS/Atom feed already ──────────────────
      const isXmlContent = contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom');
      const looksLikeRSS = body.trimStart().startsWith('<?xml') || /<rss[\s>]/i.test(body) || /<feed[\s>]/i.test(body);

      if (isXmlContent || looksLikeRSS) {
        const hasItems = /<item[\s>]/i.test(body) || /<entry[\s>]/i.test(body);
        if (hasItems) {
          const title = extractFeedTitleFromXml(body) || new URL(url).hostname;
          log.info('URL is already a valid feed', { url, title });
          return [{
            url,
            title,
            type: /<feed[\s>]/i.test(body) ? 'atom' : 'rss',
          }];
        }
      }

      // ── Parse HTML for <link rel="alternate"> feed links ───────────
      const feeds: DiscoveredFeed[] = [];
      const linkRegex = /<link\s+[^>]*rel\s*=\s*["']alternate["'][^>]*>/gi;
      const linkMatches = body.matchAll(linkRegex);

      for (const match of linkMatches) {
        const tag = match[0];

        const typeMatch = tag.match(/type\s*=\s*["']([^"']+)["']/i);
        if (!typeMatch) continue;
        const type = typeMatch[1].toLowerCase();
        if (!type.includes('rss') && !type.includes('atom') && !type.includes('xml')) continue;

        const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
        if (!hrefMatch) continue;

        let feedUrl = hrefMatch[1];

        // Resolve relative URLs
        if (feedUrl.startsWith('/')) {
          const base = new URL(url);
          feedUrl = `${base.protocol}//${base.host}${feedUrl}`;
        } else if (!feedUrl.startsWith('http')) {
          try {
            feedUrl = new URL(feedUrl, url).toString();
          } catch {
            continue;
          }
        }

        const titleMatch = tag.match(/title\s*=\s*["']([^"']+)["']/i);
        const feedTitle = titleMatch ? decodeHtmlEntitiesSimple(titleMatch[1]) : new URL(feedUrl).hostname;

        feeds.push({
          url: feedUrl,
          title: feedTitle,
          type: type.includes('atom') ? 'atom' : 'rss',
        });
      }

      // ── Probe common feed URL patterns as a fallback ───────────────
      if (feeds.length === 0) {
        const commonPaths = ['/feed', '/rss', '/rss.xml', '/feed.xml', '/atom.xml', '/feeds/posts/default'];
        const base = new URL(url);

        const probes = commonPaths.map(async (path) => {
          try {
            const probeUrl = `${base.protocol}//${base.host}${path}`;
            const probeResp = await fetch(probeUrl, {
              method: 'HEAD',
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
              signal: AbortSignal.timeout(5000),
            });
            if (probeResp.ok) {
              const ct = probeResp.headers.get('content-type') || '';
              if (ct.includes('xml') || ct.includes('rss') || ct.includes('atom')) {
                return { url: probeUrl, title: `${base.hostname} (${path})`, type: 'rss' as const };
              }
            }
          } catch { /* ignore probe failures */ }
          return null;
        });

        const probeResults = await Promise.all(probes);
        for (const result of probeResults) {
          if (result) feeds.push(result);
        }
      }

      log.info(`Feed discovery complete: found ${feeds.length} feed(s)`, { url });
      return feeds;
    } catch (error) {
      log.error('Feed discovery failed', { url, error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  },
};

// ---------------------------------------------------------------------------
// Feed Discovery Helpers
// ---------------------------------------------------------------------------

export interface DiscoveredFeed {
  url: string;
  title: string;
  type: 'rss' | 'atom';
}

function extractFeedTitleFromXml(xml: string): string {
  const channelMatch = xml.match(/<channel[\s>][\s\S]*?<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
  if (channelMatch) return decodeHtmlEntitiesSimple(channelMatch[1].trim());

  const feedMatch = xml.match(/<feed[\s>][\s\S]*?<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
  if (feedMatch) return decodeHtmlEntitiesSimple(feedMatch[1].trim());

  return '';
}

function decodeHtmlEntitiesSimple(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}