/**
 * AutoContentService — configuration, calendar, sources and scheduling
 * ====================================================================
 *
 * The auto-content pipelines write published-facing articles on a schedule with
 * no human in the loop, so the parts that decide *whether* a pipeline runs, and
 * the parts that record *that* it ran, are the parts worth pinning. A schedule
 * check that reads "due" when it isn't produces duplicate articles on the public
 * site; one that reads "not due" when it is silently stops the content engine
 * and nothing complains.
 *
 * Real collaborators throughout — the KV store, the pipeline helpers and the
 * real pipeline runners. Only the AI service (OpenAI + Unsplash) and `fetch` are
 * stubbed, which are the two boundaries that reach the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { generateFullArticle } = vi.hoisted(() => ({
  generateFullArticle: vi.fn(),
}));

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../publications-ai-service.ts', () => ({ generateFullArticle }));

import { kvStore } from './helpers/contract-harness.ts';
import { AutoContentService } from '../auto-content-service.ts';
import {
  CALENDAR_PREFIX,
  CONFIG_PREFIX,
  RUN_PREFIX,
  SOURCE_PREFIX,
  calendarKey,
  configKey,
  runKey,
  sourceKey,
} from '../auto-content-pipeline-helpers.ts';
import type {
  CalendarEvent,
  ContentSource,
  PipelineConfig,
  PipelineId,
  PipelineRunLog,
} from '../auto-content-types.ts';

const PIPELINE_IDS: PipelineId[] = [
  'calendar_content',
  'market_commentary',
  'news_commentary',
  'regulatory_monitor',
];

/** An RSS document with no items. */
const EMPTY_FEED = '<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>';

const rssResponse = (body = EMPTY_FEED) =>
  new Response(body, { status: 200, headers: { 'content-type': 'application/rss+xml' } });

/** What the AI service returns on a successful generation. */
const aiArticle = (overrides: Record<string, unknown> = {}) => ({
  title: 'Navigate Wealth Perspective: Financial Markets Update',
  excerpt: 'A short summary.',
  body: '<p>Original commentary.</p>',
  readingTimeMinutes: 4,
  suggestedSlug: 'markets-update',
  suggestedMetaDescription: 'Markets update',
  suggestedHeroImageUrl: '',
  suggestedThumbnailUrl: '',
  unsplashPhotoId: '',
  ...overrides,
});

const storedArticles = () =>
  [...kvStore.entries()]
    .filter(([key]) => key.startsWith('article:'))
    .map(([, value]) => value as Record<string, unknown>);

const storedConfig = (id: string) => kvStore.get(configKey(id as PipelineId)) as PipelineConfig;

const runLogs = (id: string): PipelineRunLog[] =>
  [...kvStore.entries()]
    .filter(([key]) => key.startsWith(`${RUN_PREFIX}${id}:`))
    .map(([, value]) => value as PipelineRunLog);

const seedConfigRow = (config: Partial<PipelineConfig> & { id: string }) =>
  kvStore.set(configKey(config.id as PipelineId), {
    name: config.id,
    enabled: true,
    audience: 'both',
    tone: 'professional',
    targetLength: 'medium',
    totalGenerated: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...config,
  });

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

/**
 * Runs `body` with `Date` frozen, so two operations in it are guaranteed to
 * produce the same ISO timestamp. Only `Date` is faked — nothing under test
 * uses timers, and faking those would deadlock the awaits.
 */
async function withFrozenClock<T>(body: () => Promise<T>): Promise<T> {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    return await body();
  } finally {
    vi.useRealTimers();
  }
}

beforeEach(() => {
  kvStore.clear();
  generateFullArticle.mockReset();
  generateFullArticle.mockResolvedValue(aiArticle());
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => rssResponse()),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pipeline configuration', () => {
  it('seeds a pipeline disabled, so nothing publishes until a human turns it on', async () => {
    const config = await AutoContentService.seedConfig('market_commentary');

    expect(config).toMatchObject({
      id: 'market_commentary',
      enabled: false,
      audience: 'both',
      scheduleIntervalHours: 168,
      totalGenerated: 0,
    });
    expect(storedConfig('market_commentary')).toEqual(config);
  });

  it('gives every pipeline its own default cadence', async () => {
    const configs = await AutoContentService.seedAllConfigs();

    expect(Object.fromEntries(configs.map((c) => [c.id, c.scheduleIntervalHours]))).toEqual({
      market_commentary: 168,
      regulatory_monitor: 24,
      news_commentary: 12,
      calendar_content: 24,
    });
    expect(configs.every((c) => c.enabled === false)).toBe(true);
  });

  it('seeds all four pipelines and is idempotent on a second call', async () => {
    const first = await AutoContentService.seedAllConfigs();
    const second = await AutoContentService.seedAllConfigs();

    expect(first.map((c) => c.id)).toEqual(PIPELINE_IDS);
    expect(second.map((c) => c.id)).toEqual(PIPELINE_IDS);
    expect([...kvStore.keys()].filter((k) => k.startsWith(CONFIG_PREFIX))).toHaveLength(4);
  });

  it('backfills a cadence onto a config written before the field existed', async () => {
    // Without the backfill the config would read interval 0, which
    // processDuePipelines treats as manual-only — the pipeline would silently
    // never run again.
    seedConfigRow({ id: 'news_commentary' });

    const configs = await AutoContentService.seedAllConfigs();

    expect(configs.find((c) => c.id === 'news_commentary')?.scheduleIntervalHours).toBe(12);
    expect(storedConfig('news_commentary').scheduleIntervalHours).toBe(12);
  });

  it('returns configs sorted by id', async () => {
    await AutoContentService.seedAllConfigs();

    const configs = await AutoContentService.getConfigs();

    expect(configs.map((c) => c.id)).toEqual(PIPELINE_IDS);
  });

  it('reports nothing for a pipeline that has never been seeded', async () => {
    await expect(AutoContentService.getConfig('news_commentary')).resolves.toBeNull();
  });

  it('seeds on demand when updating a config that does not exist yet', async () => {
    const updated = await AutoContentService.updateConfig('news_commentary', { enabled: true });

    expect(updated).toMatchObject({ id: 'news_commentary', enabled: true, targetLength: 'medium' });
    expect(storedConfig('news_commentary').enabled).toBe(true);
  });

  it('treats the id as immutable', async () => {
    await AutoContentService.seedConfig('news_commentary');

    const updated = await AutoContentService.updateConfig('news_commentary', {
      id: 'market_commentary',
      enabled: true,
    } as Partial<PipelineConfig>);

    expect(updated.id).toBe('news_commentary');
    expect(kvStore.has(configKey('market_commentary'))).toBe(false);
  });

  it('stamps updated_at on every write', async () => {
    seedConfigRow({ id: 'news_commentary', updated_at: '2020-01-01T00:00:00.000Z' });

    const updated = await AutoContentService.updateConfig('news_commentary', {
      tone: 'educational',
    });

    expect(updated.updated_at).not.toBe('2020-01-01T00:00:00.000Z');
    expect(updated.tone).toBe('educational');
  });
});

describe('run history', () => {
  const seedRun = (id: PipelineId, completedAt: string) =>
    kvStore.set(runKey(id, completedAt), {
      id: `run-${completedAt}`,
      pipelineId: id,
      status: 'success',
      articlesGenerated: 1,
      articleIds: [],
      summary: '',
      errors: [],
      durationMs: 10,
      tokensUsed: 0,
      startedAt: completedAt,
      completedAt,
    });

  it('returns the most recent runs first', async () => {
    seedRun('news_commentary', '2026-01-01T00:00:00.000Z');
    seedRun('news_commentary', '2026-06-01T00:00:00.000Z');
    seedRun('news_commentary', '2026-03-01T00:00:00.000Z');

    const history = await AutoContentService.getRunHistory('news_commentary');

    expect(history.map((r) => r.completedAt)).toEqual([
      '2026-06-01T00:00:00.000Z',
      '2026-03-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    ]);
  });

  it('honours the limit', async () => {
    for (let index = 0; index < 5; index++) {
      seedRun('news_commentary', `2026-0${index + 1}-01T00:00:00.000Z`);
    }

    await expect(AutoContentService.getRunHistory('news_commentary', 2)).resolves.toHaveLength(2);
  });

  it('keeps each pipeline history to its own pipeline', async () => {
    seedRun('news_commentary', '2026-01-01T00:00:00.000Z');
    seedRun('market_commentary', '2026-02-01T00:00:00.000Z');

    const history = await AutoContentService.getRunHistory('news_commentary');

    expect(history).toHaveLength(1);
    expect(history[0].pipelineId).toBe('news_commentary');
  });

  it('keeps both records when two runs finish in the same millisecond', async () => {
    // The key used to be pipeline + ISO timestamp, and an ISO timestamp only
    // goes to milliseconds. Both skip paths return without an AI call, so two
    // runs completing inside one millisecond is reachable — a double-clicked
    // "Run now", or the poller firing twice — and one run log silently replaced
    // the other.
    //
    // The clock is frozen so the collision is certain rather than a matter of
    // luck: without it the two runs usually land in different milliseconds and
    // the test would pass against the broken key most of the time.
    await withFrozenClock(async () => {
      await AutoContentService.triggerPipeline('news_commentary');
      await AutoContentService.triggerPipeline('news_commentary');
    });

    const history = await AutoContentService.getRunHistory('news_commentary');
    expect(history).toHaveLength(2);
    expect(new Set(history.map((r) => r.id)).size).toBe(2);
    expect(new Set(history.map((r) => r.completedAt)).size).toBe(1);
  });

  it('still reads a run log written under the old key shape', async () => {
    // Rows already in production have no id segment. The prefix scan and the
    // sort both still have to find them.
    seedRun('news_commentary', '2026-01-01T00:00:00.000Z');
    await AutoContentService.triggerPipeline('news_commentary');

    const history = await AutoContentService.getRunHistory('news_commentary');

    expect(history).toHaveLength(2);
    expect(history[history.length - 1].completedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('the financial calendar', () => {
  it('seeds the default South African calendar on first read, sorted by date', async () => {
    const events = await AutoContentService.getCalendarEvents();

    expect(events.length).toBeGreaterThan(0);
    const dates = events.map((e) => e.month * 100 + e.day);
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
    expect([...kvStore.keys()].filter((k) => k.startsWith(CALENDAR_PREFIX))).toHaveLength(
      events.length,
    );
  });

  it('does not reseed once events exist', async () => {
    const first = await AutoContentService.getCalendarEvents();

    const second = await AutoContentService.getCalendarEvents();

    expect(second.map((e) => e.id).sort()).toEqual(first.map((e) => e.id).sort());
    expect([...kvStore.keys()].filter((k) => k.startsWith(CALENDAR_PREFIX))).toHaveLength(
      first.length,
    );
  });

  it('adds, updates and deletes an event', async () => {
    const added = await AutoContentService.addCalendarEvent({
      name: 'Budget Speech',
      description: 'National Budget',
      month: 2,
      day: 21,
      isActive: true,
    } as Omit<CalendarEvent, 'id'>);

    expect(added.id).toBeTruthy();
    expect(kvStore.get(calendarKey(added.id))).toMatchObject({ name: 'Budget Speech' });

    const updated = await AutoContentService.updateCalendarEvent(added.id, {
      isActive: false,
      id: 'attempted-id-change',
    } as Partial<CalendarEvent>);
    expect(updated).toMatchObject({ id: added.id, isActive: false });

    await expect(AutoContentService.deleteCalendarEvent(added.id)).resolves.toBe(true);
    expect(kvStore.has(calendarKey(added.id))).toBe(false);
  });

  it('reports a miss rather than inventing an event', async () => {
    await expect(AutoContentService.updateCalendarEvent('nope', {})).resolves.toBeNull();
    await expect(AutoContentService.deleteCalendarEvent('nope')).resolves.toBe(false);
  });
});

describe('content sources', () => {
  const input = {
    name: 'Moneyweb',
    url: 'https://www.moneyweb.co.za/feed/',
    pipelines: ['news_commentary'] as PipelineId[],
    enabled: true,
    maxArticlesPerRun: 2,
  };

  it('starts a new source with every counter at zero', async () => {
    const source = await AutoContentService.addContentSource(input);

    expect(source).toMatchObject({
      name: 'Moneyweb',
      articlesGeneratedToday: 0,
      articlesGeneratedThisWeek: 0,
      totalGenerated: 0,
      lastCheckedAt: '',
      dailyResetDate: '',
      weeklyResetDate: '',
    });
    expect(source.created_at).toBeTruthy();
    expect(kvStore.get(sourceKey(source.id))).toMatchObject({ name: 'Moneyweb' });
  });

  it('returns sources sorted by name', async () => {
    await AutoContentService.addContentSource({ ...input, name: 'Zed Feed' });
    await AutoContentService.addContentSource({ ...input, name: 'Alpha Feed' });

    const sources = await AutoContentService.getContentSources();

    expect(sources.map((s) => s.name)).toEqual(['Alpha Feed', 'Zed Feed']);
    expect([...kvStore.keys()].filter((k) => k.startsWith(SOURCE_PREFIX))).toHaveLength(2);
  });

  it('updates a source without letting its id move', async () => {
    const source = await AutoContentService.addContentSource(input);

    const updated = await AutoContentService.updateContentSource(source.id, {
      enabled: false,
      id: 'attempted-id-change',
    } as Partial<ContentSource>);

    expect(updated).toMatchObject({ id: source.id, enabled: false });
  });

  it('reports a miss rather than inventing a source', async () => {
    await expect(AutoContentService.getContentSource('nope')).resolves.toBeNull();
    await expect(AutoContentService.updateContentSource('nope', {})).resolves.toBeNull();
    await expect(AutoContentService.deleteContentSource('nope')).resolves.toBe(false);
  });

  it('deletes a source', async () => {
    const source = await AutoContentService.addContentSource(input);

    await expect(AutoContentService.deleteContentSource(source.id)).resolves.toBe(true);
    expect(kvStore.has(sourceKey(source.id))).toBe(false);
  });
});

describe('triggerPipeline', () => {
  it('seeds a missing config, records a run and updates the stats', async () => {
    const result = await AutoContentService.triggerPipeline('news_commentary');

    expect(result).toMatchObject({ pipelineId: 'news_commentary', status: 'success' });
    const logs = runLogs('news_commentary');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      pipelineId: 'news_commentary',
      articlesGenerated: result.articlesGenerated,
      tokensUsed: 0,
    });
    expect(storedConfig('news_commentary').lastRunAt).toBe(logs[0].completedAt);
  });

  it('writes a generic article when the RSS feeds come back empty', async () => {
    // Worth knowing rather than assuming: an unreachable or empty feed does NOT
    // make the pipeline stand down. It falls back to a general "Financial
    // Markets Update" written from the prompt alone, with no source material.
    const result = await AutoContentService.triggerPipeline('news_commentary');

    expect(result).toMatchObject({ status: 'success', articlesGenerated: 1 });
    expect(generateFullArticle).toHaveBeenCalledTimes(1);
    expect(generateFullArticle.mock.calls[0][0].topic).toContain('Financial Markets Update');
    expect(storedArticles()).toHaveLength(1);
  });

  it('leaves the generated article as a draft by default', async () => {
    await AutoContentService.triggerPipeline('news_commentary');

    expect(storedArticles()[0]).toMatchObject({
      status: 'draft',
      published_at: null,
      last_edited_by: 'auto:news_commentary',
      author_name: 'Navigate Wealth',
    });
  });

  it('publishes straight to the public site when the config says autoPublish', async () => {
    // The one setting on this service that puts unreviewed AI output in front of
    // clients. Pinned so it cannot start defaulting on.
    seedConfigRow({
      id: 'news_commentary',
      enabled: true,
      scheduleIntervalHours: 12,
      autoPublish: true,
    } as Partial<PipelineConfig> & { id: string });

    await AutoContentService.triggerPipeline('news_commentary');

    expect(storedArticles()[0]).toMatchObject({ status: 'published' });
    expect(storedArticles()[0].published_at).toBeTruthy();
  });

  it('records a skipped run as a success, not a failure', async () => {
    // Second run on the same day: the day-hash dedup stops a second generic
    // article. A pipeline with nothing new to write about has not failed, and
    // logging it as an error would make a healthy feed look broken.
    const second = await withFrozenClock(async () => {
      await AutoContentService.triggerPipeline('news_commentary');
      return AutoContentService.triggerPipeline('news_commentary');
    });

    expect(second).toMatchObject({ status: 'skipped', articlesGenerated: 0 });
    expect(second.errors).toEqual(['RSS feeds returned no items']);
    expect(
      runLogs('news_commentary')
        .map((r) => r.status)
        .sort(),
    ).toEqual(['success', 'success']);
    expect(storedArticles()).toHaveLength(1);
  });

  it('adds generated articles to the running total rather than replacing it', async () => {
    seedConfigRow({ id: 'news_commentary', totalGenerated: 7, scheduleIntervalHours: 12 });

    await AutoContentService.triggerPipeline('news_commentary');

    expect(storedConfig('news_commentary').totalGenerated).toBe(8);
  });

  it('reports an error, and generates nothing, when the AI service fails', async () => {
    generateFullArticle.mockRejectedValue(new Error('OpenAI rate limited'));

    const result = await AutoContentService.triggerPipeline('news_commentary');

    expect(result).toMatchObject({ status: 'error', articlesGenerated: 0 });
    expect(storedArticles()).toHaveLength(0);
    // The failed run is still recorded, so a repeatedly failing pipeline is
    // visible on the dashboard rather than just quiet.
    expect(runLogs('news_commentary')[0].status).toBe('error');
  });

  it('refuses an unknown pipeline', async () => {
    await expect(
      AutoContentService.triggerPipeline('not_a_pipeline' as PipelineId),
    ).rejects.toThrow('Unknown pipeline: not_a_pipeline');
  });
});

describe('triggerAll', () => {
  it('does nothing when no pipeline is enabled', async () => {
    await expect(AutoContentService.triggerAll()).resolves.toEqual([]);
    expect(runLogs('news_commentary')).toHaveLength(0);
  });

  it('runs only the enabled pipelines', async () => {
    seedConfigRow({ id: 'news_commentary', enabled: true, scheduleIntervalHours: 12 });
    seedConfigRow({ id: 'market_commentary', enabled: false, scheduleIntervalHours: 168 });

    const results = await AutoContentService.triggerAll();

    expect(results.map((r) => r.pipelineId)).toEqual(['news_commentary']);
  });
});

describe('processDuePipelines', () => {
  it('does nothing when no pipeline is enabled', async () => {
    await expect(AutoContentService.processDuePipelines()).resolves.toEqual({
      processed: [],
      skippedCount: 0,
      totalArticlesGenerated: 0,
    });
  });

  it('treats a pipeline that has never run as due', async () => {
    seedConfigRow({ id: 'news_commentary', enabled: true, scheduleIntervalHours: 12 });

    const result = await AutoContentService.processDuePipelines();

    expect(result.processed.map((r) => r.pipelineId)).toEqual(['news_commentary']);
    expect(result.skippedCount).toBe(0);
  });

  it('skips a pipeline whose interval has not elapsed', async () => {
    seedConfigRow({
      id: 'news_commentary',
      enabled: true,
      scheduleIntervalHours: 12,
      lastRunAt: hoursAgo(3),
    });

    const result = await AutoContentService.processDuePipelines();

    expect(result.processed).toEqual([]);
    expect(result.skippedCount).toBe(1);
  });

  it('runs a pipeline once its interval has elapsed', async () => {
    seedConfigRow({
      id: 'news_commentary',
      enabled: true,
      scheduleIntervalHours: 12,
      lastRunAt: hoursAgo(13),
    });

    const result = await AutoContentService.processDuePipelines();

    expect(result.processed.map((r) => r.pipelineId)).toEqual(['news_commentary']);
  });

  it('treats a zero interval as manual-only', async () => {
    // Zero means "only when a human presses the button", not "run constantly".
    seedConfigRow({ id: 'news_commentary', enabled: true, scheduleIntervalHours: 0 });

    const result = await AutoContentService.processDuePipelines();

    expect(result.processed).toEqual([]);
    expect(result.skippedCount).toBe(1);
  });

  it('keeps going when one pipeline throws, and reports it as an error', async () => {
    // A config row naming a pipeline this deploy does not know about — the shape
    // a removed or renamed pipeline leaves behind.
    seedConfigRow({ id: 'retired_pipeline', enabled: true, scheduleIntervalHours: 1 });
    seedConfigRow({ id: 'news_commentary', enabled: true, scheduleIntervalHours: 12 });

    const result = await AutoContentService.processDuePipelines();

    const failed = result.processed.find((r) => r.pipelineId === 'retired_pipeline');
    expect(failed).toMatchObject({ status: 'error', articlesGenerated: 0, durationMs: 0 });
    expect(failed?.errors[0]).toContain('Unknown pipeline: retired_pipeline');
    expect(result.processed.map((r) => r.pipelineId)).toContain('news_commentary');
  });

  it('sums the articles generated across the pipelines it ran', async () => {
    seedConfigRow({ id: 'news_commentary', enabled: true, scheduleIntervalHours: 12 });

    const result = await AutoContentService.processDuePipelines();

    expect(result.totalArticlesGenerated).toBe(
      result.processed.reduce((sum, r) => sum + r.articlesGenerated, 0),
    );
  });
});
