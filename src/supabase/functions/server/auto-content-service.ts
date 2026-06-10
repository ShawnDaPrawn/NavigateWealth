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
import { assertPublicHttpUrl } from './ssrf-guard.ts';
import { generateFullArticle } from './publications-ai-service.ts';
import type { GenerateArticleBrief } from './publications-ai-service.ts';
import { createModuleLogger } from './stderr-logger.ts';
import {
  configKey,
  runKey,
  calendarKey,
  sourceKey,
  CONFIG_PREFIX,
  RUN_PREFIX,
  SOURCE_PREFIX,
  DEFAULT_NEWS_FEEDS,
  getAvailableCategoryNames,
  getRecentlyUsedImageIds,
  recordUsedImage,
  getDefaultTypeId,
  createDraftArticle,
  fetchRSSItems,
  simpleHash,
  processedKey,
  isTopicDuplicate,
  markSourceChecked,
  incrementSourceCounters,
  extractFeedTitleFromXml,
  decodeHtmlEntitiesSimple,
} from './auto-content-pipeline-helpers.ts';
import type { RSSItem } from './auto-content-pipeline-helpers.ts';
import { PIPELINE_RUNNERS, seedCalendarEvents } from './auto-content-pipelines.ts';
import type {
  CalendarEvent,
  ContentSource,
  CreateContentSourceInput,
  DiscoveredFeed,
  PipelineConfig,
  PipelineId,
  PipelineRunLog,
  PipelineTriggerResult,
} from './auto-content-types.ts';

export type {
  CalendarEvent,
  ContentSource,
  CreateContentSourceInput,
  DiscoveredFeed,
  PipelineConfig,
  PipelineId,
  PipelineRunLog,
  PipelineTriggerResult,
} from './auto-content-types.ts';

const log = createModuleLogger('auto-content');

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

    const pipelineIds: PipelineId[] = [
      'market_commentary',
      'regulatory_monitor',
      'news_commentary',
      'calendar_content',
    ];
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
      log.info('processDuePipelines: No pipelines due', {
        enabledCount: enabledConfigs.length,
        skippedCount,
      });
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

  async updateCalendarEvent(
    id: string,
    updates: Partial<CalendarEvent>,
  ): Promise<CalendarEvent | null> {
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

  async updateContentSource(
    id: string,
    updates: Partial<ContentSource>,
  ): Promise<ContentSource | null> {
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
  async triggerSource(
    sourceId: string,
  ): Promise<{ results: PipelineTriggerResult[]; totalGenerated: number; sourceName: string }> {
    const source = (await kv.get(sourceKey(sourceId))) as ContentSource | null;
    if (!source) {
      throw new Error(`Content source not found: ${sourceId}`);
    }

    log.info(`Triggering source: ${source.name}`, {
      sourceId,
      url: source.url,
      pipelines: source.pipelines,
    });

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
      const keywords = source.filterKeywords.map((k) => k.toLowerCase());
      filtered = unprocessed.filter((item) => {
        const text = `${item.title} ${item.description || ''}`.toLowerCase();
        return keywords.some((kw) => text.includes(kw));
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
    const newsContext = filtered
      .map(
        (item, i) =>
          `${i + 1}. ${item.title}\n   ${item.description?.slice(0, 200) || ''}\n   Published: ${new Date(item.pubDate).toLocaleDateString('en-ZA')}`,
      )
      .join('\n\n');

    const categoryContext = !config.categoryId
      ? await getAvailableCategoryNames()
      : { names: [], categories: [] };
    const excludeImageIds = await getRecentlyUsedImageIds();

    const brief: GenerateArticleBrief = {
      topic:
        filtered.length === 1
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
      const articleId = await createDraftArticle(
        result,
        config.categoryId || '',
        typeId,
        pipelineId,
      );
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
      summary:
        totalGenerated > 0
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

    log.info(`Source trigger completed: ${source.name}`, {
      totalGenerated,
      durationMs: pipelineResult.durationMs,
    });

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

    // SECURITY (SSRF): only fetch publicly-routable http(s) URLs. Blocks
    // loopback/private/link-local/cloud-metadata targets so this endpoint can't
    // be used to probe internal services or steal instance credentials.
    assertPublicHttpUrl(url);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html, application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
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
      const isXmlContent =
        contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom');
      const looksLikeRSS =
        body.trimStart().startsWith('<?xml') || /<rss[\s>]/i.test(body) || /<feed[\s>]/i.test(body);

      if (isXmlContent || looksLikeRSS) {
        const hasItems = /<item[\s>]/i.test(body) || /<entry[\s>]/i.test(body);
        if (hasItems) {
          const title = extractFeedTitleFromXml(body) || new URL(url).hostname;
          log.info('URL is already a valid feed', { url, title });
          return [
            {
              url,
              title,
              type: /<feed[\s>]/i.test(body) ? 'atom' : 'rss',
            },
          ];
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
        const feedTitle = titleMatch
          ? decodeHtmlEntitiesSimple(titleMatch[1])
          : new URL(feedUrl).hostname;

        feeds.push({
          url: feedUrl,
          title: feedTitle,
          type: type.includes('atom') ? 'atom' : 'rss',
        });
      }

      // ── Probe common feed URL patterns as a fallback ───────────────
      if (feeds.length === 0) {
        const commonPaths = [
          '/feed',
          '/rss',
          '/rss.xml',
          '/feed.xml',
          '/atom.xml',
          '/feeds/posts/default',
        ];
        const base = new URL(url);

        const probes = commonPaths.map(async (path) => {
          try {
            const probeUrl = `${base.protocol}//${base.host}${path}`;
            const probeResp = await fetch(probeUrl, {
              method: 'HEAD',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
              signal: AbortSignal.timeout(5000),
            });
            if (probeResp.ok) {
              const ct = probeResp.headers.get('content-type') || '';
              if (ct.includes('xml') || ct.includes('rss') || ct.includes('atom')) {
                return { url: probeUrl, title: `${base.hostname} (${path})`, type: 'rss' as const };
              }
            }
          } catch {
            /* ignore probe failures */
          }
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
      log.error('Feed discovery failed', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  },
};
