/**
 * The four auto-content pipeline runners — contract tests
 * =======================================================
 *
 * Each runner turns a feed (or the calendar) into published-facing articles with
 * no human in the loop, so what matters is the *dedup*: every skip branch here
 * exists to stop the same story being written twice on the public site. The
 * status each runner reports also matters, because that is all an admin sees on
 * the dashboard — and one of the four reports a healthy no-op as a failure,
 * which is pinned below rather than quietly accepted.
 *
 * Only the AI service and `fetch` are stubbed; the KV store, the pipeline
 * helpers and the runners themselves are real.
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
  PROCESSED_PREFIX,
  USED_IMAGE_PREFIX,
  calendarKey,
  configKey,
  recordTopicHash,
  sourceKey,
} from '../auto-content-pipeline-helpers.ts';
import type {
  CalendarEvent,
  ContentSource,
  PipelineConfig,
  PipelineId,
} from '../auto-content-types.ts';

const aiArticle = (overrides: Record<string, unknown> = {}) => ({
  title: 'Navigate Wealth Perspective',
  excerpt: 'A short summary.',
  body: '<p>Original commentary.</p>',
  readingTimeMinutes: 4,
  suggestedSlug: 'perspective',
  suggestedMetaDescription: 'Perspective',
  unsplashPhotoId: '',
  ...overrides,
});

const rssFeed = (items: Array<{ title: string; description?: string }>) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title>${items
    .map(
      (item) =>
        `<item><title>${item.title}</title><link>https://example.co.za/a</link><pubDate>Tue, 01 Sep 2026 08:00:00 GMT</pubDate><description>${item.description ?? `About ${item.title}.`}</description></item>`,
    )
    .join('')}</channel></rss>`;

const serveFeed = (body: string) => async () =>
  new Response(body, { status: 200, headers: { 'content-type': 'application/rss+xml' } });

const storedArticles = () =>
  [...kvStore.entries()]
    .filter(([key]) => key.startsWith('article:'))
    .map(([, value]) => value as Record<string, unknown>);

const keysWithPrefix = (prefix: string) => [...kvStore.keys()].filter((k) => k.startsWith(prefix));

const seedSourceFor = (pipeline: PipelineId, overrides: Partial<ContentSource> = {}) => {
  const source = {
    id: `src-${pipeline}`,
    name: `Feed for ${pipeline}`,
    url: 'https://feeds.example.co.za/rss',
    pipelines: [pipeline],
    enabled: true,
    isActive: true,
    maxArticlesPerRun: 3,
    lastCheckedAt: '',
    articlesGeneratedToday: 0,
    articlesGeneratedThisWeek: 0,
    dailyResetDate: '',
    weeklyResetDate: '',
    totalGenerated: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as ContentSource;
  kvStore.set(sourceKey(source.id), source);
  return source;
};

const seedConfigRow = (id: PipelineId, overrides: Partial<PipelineConfig> = {}) =>
  kvStore.set(configKey(id), {
    id,
    name: id,
    enabled: true,
    audience: 'both',
    tone: 'professional',
    targetLength: 'medium',
    totalGenerated: 0,
    scheduleIntervalHours: 24,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

/**
 * A calendar event `daysAhead` days from now. The year is stamped explicitly
 * because the runner builds the date as `new Date(event.year || currentYear,
 * …)` — without it, a run in late December would read a January event as
 * eleven months in the past and this test would only fail once a year.
 */
const eventOn = (daysAhead: number, overrides: Partial<CalendarEvent> = {}): CalendarEvent => {
  const date = new Date(Date.now() + daysAhead * 86_400_000);
  const event = {
    id: `evt-${daysAhead}-${Math.abs(overrides.leadTimeDays ?? 0)}`,
    name: 'Budget Speech',
    description: 'The national budget.',
    articleTopic: 'What the national budget means for your financial plan',
    keyPoints: ['Tax changes', 'Retirement implications'],
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    isActive: true,
    ...overrides,
  } as CalendarEvent;
  kvStore.set(calendarKey(event.id), event);
  return event;
};

beforeEach(() => {
  kvStore.clear();
  generateFullArticle.mockReset();
  generateFullArticle.mockResolvedValue(aiArticle());
  vi.stubGlobal('fetch', vi.fn(serveFeed(rssFeed([]))));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('market_commentary', () => {
  beforeEach(() => {
    seedSourceFor('market_commentary');
    seedConfigRow('market_commentary', { scheduleIntervalHours: 168 });
  });

  it('writes a weekly commentary from the headlines it fetched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(serveFeed(rssFeed([{ title: 'JSE Top 40 climbs' }, { title: 'Rand firms' }]))),
    );

    const result = await AutoContentService.triggerPipeline('market_commentary');

    expect(result).toMatchObject({ status: 'success', articlesGenerated: 1 });
    expect(result.summary).toContain('Generated market commentary');
    expect(generateFullArticle.mock.calls[0][0].topic).toMatch(/^Weekly Market Commentary — /);
    expect(generateFullArticle.mock.calls[0][0].additionalInstructions).toContain('JSE Top 40');
    expect(storedArticles()).toHaveLength(1);
    expect(keysWithPrefix(`${PROCESSED_PREFIX}market_commentary:`)).toHaveLength(1);
  });

  it('skips a second run against the same headlines', async () => {
    vi.stubGlobal('fetch', vi.fn(serveFeed(rssFeed([{ title: 'JSE Top 40 climbs' }]))));
    await AutoContentService.triggerPipeline('market_commentary');
    generateFullArticle.mockClear();

    const second = await AutoContentService.triggerPipeline('market_commentary');

    expect(second).toMatchObject({ status: 'skipped', articlesGenerated: 0 });
    expect(second.summary).toBe('Similar market headlines already processed recently');
    expect(generateFullArticle).not.toHaveBeenCalled();
  });

  it('writes from general knowledge when the feeds come back empty', async () => {
    // Worth knowing rather than assuming: an unreachable feed does not stop the
    // pipeline. It writes a market update from the prompt alone.
    const result = await AutoContentService.triggerPipeline('market_commentary');

    expect(result).toMatchObject({ status: 'success', articlesGenerated: 1 });
    expect(generateFullArticle.mock.calls[0][0].additionalInstructions).toContain(
      'Provide original market commentary',
    );
  });

  it('holds the general-knowledge fallback to once a week', async () => {
    await AutoContentService.triggerPipeline('market_commentary');
    generateFullArticle.mockClear();

    const second = await AutoContentService.triggerPipeline('market_commentary');

    expect(second).toMatchObject({ status: 'skipped', articlesGenerated: 0 });
    expect(second.errors).toEqual(['RSS feeds returned no items — used general market knowledge']);
    expect(generateFullArticle).not.toHaveBeenCalled();
  });

  it('marks its sources checked even when the run fails', async () => {
    // Otherwise a source that fails every run looks like it was never polled.
    generateFullArticle.mockRejectedValue(new Error('OpenAI rate limited'));

    const result = await AutoContentService.triggerPipeline('market_commentary');

    expect(result).toMatchObject({ status: 'error', articlesGenerated: 0 });
    expect(result.summary).toContain('Pipeline failed: OpenAI rate limited');
    expect(
      (kvStore.get(sourceKey('src-market_commentary')) as ContentSource).lastCheckedAt,
    ).toBeTruthy();
  });

  it('counts the article against its source', async () => {
    vi.stubGlobal('fetch', vi.fn(serveFeed(rssFeed([{ title: 'JSE Top 40 climbs' }]))));

    await AutoContentService.triggerPipeline('market_commentary');

    expect(kvStore.get(sourceKey('src-market_commentary'))).toMatchObject({
      totalGenerated: 1,
      articlesGeneratedToday: 1,
    });
  });
});

describe('regulatory_monitor', () => {
  beforeEach(() => {
    seedSourceFor('regulatory_monitor');
    seedConfigRow('regulatory_monitor');
  });

  it('picks up an item that names a regulator and writes an update', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(serveFeed(rssFeed([{ title: 'FSCA tightens adviser conduct rules' }]))),
    );

    const result = await AutoContentService.triggerPipeline('regulatory_monitor');

    expect(result).toMatchObject({ status: 'success', articlesGenerated: 1 });
    expect(generateFullArticle.mock.calls[0][0].topic).toBe(
      'Regulatory Update: FSCA tightens adviser conduct rules',
    );
    expect(generateFullArticle.mock.calls[0][0].categoryName).toBe('Regulatory Updates');
  });

  it('ignores news with nothing regulatory in it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(serveFeed(rssFeed([{ title: 'Local football results', description: 'Sport.' }]))),
    );

    const result = await AutoContentService.triggerPipeline('regulatory_monitor');

    expect(result).toMatchObject({ status: 'skipped', articlesGenerated: 0 });
    expect(result.summary).toBe('No regulatory-relevant news items detected');
    expect(generateFullArticle).not.toHaveBeenCalled();
  });

  it('matches a keyword in the description as well as the title', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        serveFeed(
          rssFeed([{ title: 'Treasury update', description: 'Changes to the FAIS Act follow.' }]),
        ),
      ),
    );

    const result = await AutoContentService.triggerPipeline('regulatory_monitor');

    expect(result.articlesGenerated).toBe(1);
  });

  it('lets a source override the global keyword list', async () => {
    seedSourceFor('regulatory_monitor', { filterKeywords: ['two-pot'] });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        serveFeed(
          // The first would match the global defaults; only the second matches
          // the source's own list.
          rssFeed([{ title: 'FSCA notice' }, { title: 'Two-pot withdrawal rules confirmed' }]),
        ),
      ),
    );

    const result = await AutoContentService.triggerPipeline('regulatory_monitor');

    expect(result.articlesGenerated).toBe(1);
    expect(generateFullArticle.mock.calls[0][0].topic).toContain('Two-pot');
  });

  it('writes at most three articles in one run', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        serveFeed(
          rssFeed(
            ['one', 'two', 'three', 'four', 'five'].map((n) => ({
              title: `FSCA regulation change ${n}`,
            })),
          ),
        ),
      ),
    );

    const result = await AutoContentService.triggerPipeline('regulatory_monitor');

    expect(result.articlesGenerated).toBe(3);
  });

  it('does not reuse the same photo twice within one run', async () => {
    generateFullArticle
      .mockResolvedValueOnce(aiArticle({ unsplashPhotoId: 'photo-a' }))
      .mockResolvedValueOnce(aiArticle({ unsplashPhotoId: 'photo-b' }));
    vi.stubGlobal(
      'fetch',
      vi.fn(serveFeed(rssFeed([{ title: 'FSCA notice one' }, { title: 'SARB notice two' }]))),
    );

    await AutoContentService.triggerPipeline('regulatory_monitor');

    expect([...generateFullArticle.mock.calls[1][1].excludeImageIds]).toContain('photo-a');
    expect(kvStore.get(`${USED_IMAGE_PREFIX}photo-a`)).toBeDefined();
  });

  it('skips an item another pipeline has already covered', async () => {
    await recordTopicHash('FSCA tightens adviser conduct rules', 'news_commentary', 'earlier');
    vi.stubGlobal(
      'fetch',
      vi.fn(serveFeed(rssFeed([{ title: 'FSCA tightens adviser conduct rules' }]))),
    );

    const result = await AutoContentService.triggerPipeline('regulatory_monitor');

    expect(result.articlesGenerated).toBe(0);
    expect(generateFullArticle).not.toHaveBeenCalled();
  });

  it('reports a partial run when one of two items fails to generate', async () => {
    generateFullArticle
      .mockResolvedValueOnce(aiArticle())
      .mockRejectedValueOnce(new Error('OpenAI rate limited'));
    vi.stubGlobal(
      'fetch',
      vi.fn(serveFeed(rssFeed([{ title: 'FSCA notice one' }, { title: 'SARB notice two' }]))),
    );

    const result = await AutoContentService.triggerPipeline('regulatory_monitor');

    expect(result).toMatchObject({ status: 'partial', articlesGenerated: 1 });
    expect(result.errors[0]).toContain('Failed to generate article for "SARB notice two"');
  });

  it('reports a healthy dedup no-op as an ERROR, which is wrong but is what it does', async () => {
    // Every candidate was already processed, so there was nothing to write and
    // nothing went wrong — but the runner reports `error` because it only looks
    // at whether any article came out. `news_commentary` returns `skipped` for
    // the same situation. Pinned so the inconsistency is visible and so fixing
    // it is a deliberate change rather than an accident.
    vi.stubGlobal('fetch', vi.fn(serveFeed(rssFeed([{ title: 'FSCA notice one' }]))));
    await AutoContentService.triggerPipeline('regulatory_monitor');
    generateFullArticle.mockClear();

    const second = await AutoContentService.triggerPipeline('regulatory_monitor');

    expect(second).toMatchObject({ status: 'error', articlesGenerated: 0 });
    expect(second.summary).toBe(
      'No articles generated — all items were previously processed or failed',
    );
    expect(second.errors).toEqual([]);
    expect(generateFullArticle).not.toHaveBeenCalled();
  });
});

describe('calendar_content', () => {
  beforeEach(() => {
    seedConfigRow('calendar_content', { leadTimeDays: 14 });
  });

  it('writes an article ahead of an event inside the lead time', async () => {
    const event = eventOn(5);

    const result = await AutoContentService.triggerPipeline('calendar_content');

    expect(result).toMatchObject({ status: 'success', articlesGenerated: 1 });
    expect(result.summary).toContain('Budget Speech');
    expect(generateFullArticle.mock.calls[0][0]).toMatchObject({
      topic: event.articleTopic,
      keyPoints: event.keyPoints,
      categoryName: 'Financial Planning',
    });
    // Stamped so next year's run writes a fresh article and this year's does not
    // write a second one.
    expect(kvStore.get(calendarKey(event.id))).toMatchObject({
      lastGeneratedYear: new Date().getFullYear(),
    });
  });

  it('ignores an event beyond the lead time', async () => {
    eventOn(60);

    const result = await AutoContentService.triggerPipeline('calendar_content');

    expect(result).toMatchObject({ status: 'skipped', articlesGenerated: 0 });
    expect(result.summary).toBe('No upcoming calendar events within the lead time window');
  });

  it('honours a per-event lead time over the pipeline default', async () => {
    eventOn(30, { leadTimeDays: 45 });

    const result = await AutoContentService.triggerPipeline('calendar_content');

    expect(result.articlesGenerated).toBe(1);
  });

  it('ignores an event that is switched off', async () => {
    eventOn(5, { isActive: false });

    const result = await AutoContentService.triggerPipeline('calendar_content');

    expect(result).toMatchObject({ status: 'skipped' });
    expect(generateFullArticle).not.toHaveBeenCalled();
  });

  it('ignores an event already written about this year', async () => {
    eventOn(5, { lastGeneratedYear: new Date().getFullYear() });

    const result = await AutoContentService.triggerPipeline('calendar_content');

    expect(result).toMatchObject({ status: 'skipped' });
    expect(generateFullArticle).not.toHaveBeenCalled();
  });

  it('writes about an event again next year', async () => {
    eventOn(5, { lastGeneratedYear: new Date().getFullYear() - 1 });

    const result = await AutoContentService.triggerPipeline('calendar_content');

    expect(result.articlesGenerated).toBe(1);
  });

  it('skips an event whose topic another pipeline already covered', async () => {
    const event = eventOn(5);
    await recordTopicHash(event.articleTopic, 'news_commentary', 'earlier');

    const result = await AutoContentService.triggerPipeline('calendar_content');

    expect(result.articlesGenerated).toBe(0);
    expect(generateFullArticle).not.toHaveBeenCalled();
    // Not stamped, so it becomes eligible again if the duplicate is removed.
    expect(kvStore.get(calendarKey(event.id))).not.toHaveProperty('lastGeneratedYear');
  });

  it('reports a partial run when one of two events fails', async () => {
    eventOn(3, { id: 'evt-a', name: 'Budget Speech' });
    eventOn(6, { id: 'evt-b', name: 'Tax Season Opens', articleTopic: 'Getting ready to file' });
    generateFullArticle
      .mockResolvedValueOnce(aiArticle())
      .mockRejectedValueOnce(new Error('OpenAI rate limited'));

    const result = await AutoContentService.triggerPipeline('calendar_content');

    expect(result).toMatchObject({ status: 'partial', articlesGenerated: 1 });
    expect(result.errors[0]).toMatch(/^Failed for event "/);
  });

  it('seeds the default calendar when none exists, and acts on exactly what is due', async () => {
    const result = await AutoContentService.triggerPipeline('calendar_content');

    const seeded = keysWithPrefix('auto_content:calendar_event:').map(
      (key) => kvStore.get(key) as CalendarEvent,
    );
    expect(seeded.length).toBeGreaterThan(0);

    // How many of the seeded defaults fall inside the window is a function of
    // today's date, so derive the expectation rather than hard-coding it — and
    // assert the runner generated exactly that many, no more and no fewer.
    const now = new Date();
    const dueCount = seeded.filter((event) => {
      if (!event.isActive || event.lastGeneratedYear === now.getFullYear()) return false;
      const date = new Date(event.year || now.getFullYear(), event.month - 1, event.day);
      const daysUntil = Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
      return daysUntil >= 0 && daysUntil <= (event.leadTimeDays || 14);
    }).length;

    expect(result.articlesGenerated).toBe(dueCount);
    expect(generateFullArticle).toHaveBeenCalledTimes(dueCount);
  });
});
