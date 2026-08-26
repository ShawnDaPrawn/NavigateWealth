/**
 * AutoContentService — feed discovery and single-source triggering
 * ===============================================================
 *
 * `discoverFeeds` takes a URL straight from an admin form and fetches it
 * server-side, which makes it the app's clearest SSRF surface: an attacker who
 * can reach that form can otherwise ask the Edge Function to fetch the cloud
 * metadata endpoint on their behalf. The guard is exercised for real here — it
 * is not stubbed — and every rejection is asserted to happen *before* any fetch.
 *
 * `triggerSource` is the other half: it turns one RSS feed into one article, and
 * every one of its skip conditions exists to stop a duplicate landing on the
 * public site.
 *
 * Only the AI service and `fetch` are stubbed.
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
  GLOBAL_TOPIC_PREFIX,
  PROCESSED_PREFIX,
  RUN_PREFIX,
  USED_IMAGE_PREFIX,
  configKey,
  processedKey,
  recordTopicHash,
  simpleHash,
  sourceKey,
} from '../auto-content-pipeline-helpers.ts';
import type { ContentSource, PipelineConfig, PipelineId } from '../auto-content-types.ts';

let fetchMock: ReturnType<typeof vi.fn>;

const html = (body: string) =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });

const xml = (body: string) =>
  new Response(body, { status: 200, headers: { 'content-type': 'application/rss+xml' } });

const rssFeed = (titles: string[], channelTitle = 'Moneyweb Latest') =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>${channelTitle}</title>${titles
    .map(
      (title) =>
        `<item><title>${title}</title><link>https://example.co.za/${encodeURIComponent(title)}</link><pubDate>Tue, 01 Sep 2026 08:00:00 GMT</pubDate><description>About ${title}.</description></item>`,
    )
    .join('')}</channel></rss>`;

const aiArticle = (overrides: Record<string, unknown> = {}) => ({
  title: 'Navigate Wealth Perspective on the news',
  excerpt: 'A short summary.',
  body: '<p>Original commentary.</p>',
  readingTimeMinutes: 4,
  suggestedSlug: 'perspective',
  suggestedMetaDescription: 'Perspective',
  unsplashPhotoId: '',
  ...overrides,
});

const storedArticles = () =>
  [...kvStore.entries()]
    .filter(([key]) => key.startsWith('article:'))
    .map(([, value]) => value as Record<string, unknown>);

const keysWithPrefix = (prefix: string) => [...kvStore.keys()].filter((k) => k.startsWith(prefix));

const seedSource = (overrides: Partial<ContentSource> = {}): ContentSource => {
  const source = {
    id: 'src-1',
    name: 'Moneyweb',
    url: 'https://www.moneyweb.co.za/feed/',
    pipelines: ['news_commentary'] as PipelineId[],
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

const storedSource = (id = 'src-1') => kvStore.get(sourceKey(id)) as ContentSource;

/**
 * Answers GET with `response` and every HEAD probe with a 404, so the
 * common-path probing in `discoverFeeds` stays off unless a test asks for it.
 * Response bodies are single-use, so this rebuilds one per call.
 */
const serve = (build: () => Response) => async (_url: string, init?: { method?: string }) =>
  init?.method === 'HEAD' ? new Response('', { status: 404 }) : build();

beforeEach(() => {
  kvStore.clear();
  generateFullArticle.mockReset();
  generateFullArticle.mockResolvedValue(aiArticle());
  fetchMock = vi.fn(serve(() => xml(rssFeed(['SARB holds the repo rate']))));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('discoverFeeds — the SSRF guard', () => {
  it.each([
    ['the AWS metadata endpoint', 'http://169.254.169.254/latest/meta-data/'],
    ['IPv4 loopback', 'http://127.0.0.1:8000/feed'],
    ['an RFC-1918 address', 'http://10.0.0.5/feed'],
    ['a home-router address', 'http://192.168.1.1/feed'],
    ['a carrier-grade NAT address', 'http://100.70.0.1/feed'],
    ['IPv6 loopback', 'http://[::1]/feed'],
    ['an IPv4-mapped IPv6 address', 'http://[::ffff:127.0.0.1]/feed'],
  ])('refuses %s', async (_label, url) => {
    await expect(AutoContentService.discoverFeeds(url)).rejects.toThrow(
      /private or reserved address/,
    );
    // The point of the guard: no request is issued at all.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['localhost by name', 'http://localhost/feed'],
    ['a .localhost subdomain', 'http://api.localhost/feed'],
    ['ip6-localhost', 'http://ip6-localhost/feed'],
  ])('refuses %s', async (_label, url) => {
    await expect(AutoContentService.discoverFeeds(url)).rejects.toThrow(/host is not allowed/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a non-http scheme', async () => {
    await expect(AutoContentService.discoverFeeds('file:///etc/passwd')).rejects.toThrow(
      /Only http\(s\) URLs are allowed/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses something that is not a URL', async () => {
    await expect(AutoContentService.discoverFeeds('moneyweb.co.za/feed')).rejects.toThrow(
      'Invalid URL',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows an ordinary public URL through to the fetch', async () => {
    fetchMock.mockImplementation(serve(() => xml(rssFeed(['An item']))));

    await AutoContentService.discoverFeeds('https://www.moneyweb.co.za/feed/');

    expect(fetchMock).toHaveBeenCalled();
  });
});

describe('discoverFeeds — recognising a feed', () => {
  it('returns the URL itself when it is already an RSS feed, titled from the channel', async () => {
    fetchMock.mockImplementation(serve(() => xml(rssFeed(['An item'], 'Moneyweb Latest'))));

    await expect(
      AutoContentService.discoverFeeds('https://www.moneyweb.co.za/feed/'),
    ).resolves.toEqual([
      { url: 'https://www.moneyweb.co.za/feed/', title: 'Moneyweb Latest', type: 'rss' },
    ]);
  });

  it('recognises an Atom feed by its entries', async () => {
    fetchMock.mockResolvedValue(
      xml('<?xml version="1.0"?><feed><title>Atom Source</title><entry></entry></feed>'),
    );

    await expect(AutoContentService.discoverFeeds('https://example.co.za/atom')).resolves.toEqual([
      { url: 'https://example.co.za/atom', title: 'Atom Source', type: 'atom' },
    ]);
  });

  it('falls back to the hostname when the feed has no title', async () => {
    fetchMock.mockImplementation(
      serve(() => xml('<?xml version="1.0"?><rss><channel><item></item></channel></rss>')),
    );

    await expect(AutoContentService.discoverFeeds('https://example.co.za/rss')).resolves.toEqual([
      { url: 'https://example.co.za/rss', title: 'example.co.za', type: 'rss' },
    ]);
  });

  it('does not accept feed-shaped XML that carries no items', async () => {
    // An empty feed is indistinguishable from a broken one, and offering it as a
    // source would add a row that never produces an article.
    fetchMock.mockImplementation(
      serve(() => xml('<?xml version="1.0"?><rss><channel></channel></rss>')),
    );

    await expect(AutoContentService.discoverFeeds('https://example.co.za/rss')).resolves.toEqual(
      [],
    );
  });
});

describe('discoverFeeds — parsing an HTML page', () => {
  it('resolves a root-relative feed link against the page origin', async () => {
    fetchMock.mockResolvedValue(
      html(
        '<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml" title="Site Feed"></head></html>',
      ),
    );

    await expect(
      AutoContentService.discoverFeeds('https://example.co.za/blog/page'),
    ).resolves.toEqual([
      { url: 'https://example.co.za/feed.xml', title: 'Site Feed', type: 'rss' },
    ]);
  });

  it('resolves a document-relative feed link against the page URL', async () => {
    fetchMock.mockResolvedValue(
      html(
        '<html><link rel="alternate" type="application/atom+xml" href="atom.xml" title="Atom"></html>',
      ),
    );

    await expect(AutoContentService.discoverFeeds('https://example.co.za/blog/')).resolves.toEqual([
      { url: 'https://example.co.za/blog/atom.xml', title: 'Atom', type: 'atom' },
    ]);
  });

  it('keeps an absolute feed link as it is, and decodes its title', async () => {
    fetchMock.mockResolvedValue(
      html(
        '<html><link rel="alternate" type="application/rss+xml" href="https://cdn.example.net/f.xml" title="News &amp; Views"></html>',
      ),
    );

    await expect(AutoContentService.discoverFeeds('https://example.co.za/')).resolves.toEqual([
      { url: 'https://cdn.example.net/f.xml', title: 'News & Views', type: 'rss' },
    ]);
  });

  it('ignores an alternate link that is not a feed', async () => {
    // `rel="alternate"` is also how sites declare language variants and print
    // stylesheets. Only the feed content types count.
    fetchMock.mockResolvedValue(
      html(
        '<html><link rel="alternate" hreflang="af" type="text/html" href="/af/"><link rel="alternate" href="/no-type"></html>',
      ),
    );

    await expect(AutoContentService.discoverFeeds('https://example.co.za/')).resolves.toEqual([]);
  });

  it('probes the common feed paths when the page declares none', async () => {
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (init?.method === 'HEAD') {
        return url.endsWith('/rss.xml')
          ? new Response('', { status: 200, headers: { 'content-type': 'application/xml' } })
          : new Response('', { status: 404 });
      }
      return html('<html><head></head></html>');
    });

    await expect(AutoContentService.discoverFeeds('https://example.co.za/blog')).resolves.toEqual([
      { url: 'https://example.co.za/rss.xml', title: 'example.co.za (/rss.xml)', type: 'rss' },
    ]);
  });

  it('ignores a probe that answers 200 with a non-feed content type', async () => {
    // Many sites answer every path with the SPA shell. Accepting those would
    // offer the admin a "feed" that is really an HTML page.
    fetchMock.mockImplementation(async (_url: string, init?: { method?: string }) =>
      init?.method === 'HEAD'
        ? new Response('', { status: 200, headers: { 'content-type': 'text/html' } })
        : html('<html></html>'),
    );

    await expect(AutoContentService.discoverFeeds('https://example.co.za/')).resolves.toEqual([]);
  });

  it('returns nothing rather than throwing when the page cannot be fetched', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));

    await expect(AutoContentService.discoverFeeds('https://example.co.za/')).resolves.toEqual([]);
  });

  it('returns nothing rather than throwing when the request itself fails', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(AutoContentService.discoverFeeds('https://example.co.za/')).resolves.toEqual([]);
  });
});

describe('triggerSource', () => {
  it('refuses an unknown source', async () => {
    await expect(AutoContentService.triggerSource('no-such-source')).rejects.toThrow(
      'Content source not found: no-such-source',
    );
  });

  it('generates one article and records everything that went with it', async () => {
    seedSource();
    fetchMock.mockImplementation(
      serve(() => xml(rssFeed(['SARB holds the repo rate', 'Rand firms on data']))),
    );

    const result = await AutoContentService.triggerSource('src-1');

    expect(result).toMatchObject({ totalGenerated: 1, sourceName: 'Moneyweb' });
    expect(result.results[0]).toMatchObject({
      pipelineId: 'news_commentary',
      status: 'success',
      articlesGenerated: 1,
      errors: [],
    });
    expect(storedArticles()).toHaveLength(1);

    // Both feed items are marked processed, not just the one that named the
    // article — otherwise the next run writes a near-duplicate off item two.
    expect(keysWithPrefix(`${PROCESSED_PREFIX}news_commentary:`)).toHaveLength(2);

    expect(storedSource()).toMatchObject({
      articlesGeneratedToday: 1,
      articlesGeneratedThisWeek: 1,
      totalGenerated: 1,
    });
    expect(storedSource().lastCheckedAt).toBeTruthy();

    const config = kvStore.get(configKey('news_commentary')) as PipelineConfig;
    expect(config).toMatchObject({ totalGenerated: 1 });
    expect(config.lastRunAt).toBeTruthy();
    expect(keysWithPrefix(`${RUN_PREFIX}news_commentary:`)).toHaveLength(1);
  });

  it('names the article after the single item when there is only one', async () => {
    seedSource();
    fetchMock.mockImplementation(serve(() => xml(rssFeed(['SARB holds the repo rate']))));

    await AutoContentService.triggerSource('src-1');

    expect(generateFullArticle.mock.calls[0][0].topic).toBe(
      'Navigate Wealth Perspective: SARB holds the repo rate',
    );
  });

  it('names the article after the source when several items feed it', async () => {
    seedSource();
    fetchMock.mockImplementation(serve(() => xml(rssFeed(['One', 'Two', 'Three']))));

    await AutoContentService.triggerSource('src-1');

    expect(generateFullArticle.mock.calls[0][0].topic).toBe(
      'Moneyweb: Navigate Wealth Perspective',
    );
  });

  it('caps the items it considers at maxArticlesPerRun', async () => {
    seedSource({ maxArticlesPerRun: 2 });
    fetchMock.mockImplementation(serve(() => xml(rssFeed(['One', 'Two', 'Three', 'Four']))));

    await AutoContentService.triggerSource('src-1');

    expect(keysWithPrefix(`${PROCESSED_PREFIX}news_commentary:`)).toHaveLength(2);
  });

  it('excludes images used recently, so consecutive articles do not share a photo', async () => {
    seedSource();
    kvStore.set(`${USED_IMAGE_PREFIX}photo-1`, {
      photoId: 'photo-1',
      usedAt: new Date().toISOString(),
    });

    await AutoContentService.triggerSource('src-1');

    expect([...generateFullArticle.mock.calls[0][1].excludeImageIds]).toContain('photo-1');
  });

  it('records the photo it used so the next run avoids it', async () => {
    seedSource();
    generateFullArticle.mockResolvedValue(aiArticle({ unsplashPhotoId: 'photo-9' }));

    await AutoContentService.triggerSource('src-1');

    expect(kvStore.get(`${USED_IMAGE_PREFIX}photo-9`)).toMatchObject({ photoId: 'photo-9' });
  });

  it('skips, and still stamps the check, when the feed has no items', async () => {
    seedSource();
    fetchMock.mockImplementation(serve(() => xml(rssFeed([]))));

    const result = await AutoContentService.triggerSource('src-1');

    expect(result.results[0]).toMatchObject({ status: 'skipped', articlesGenerated: 0 });
    expect(result.results[0].summary).toContain('No items found in RSS feed');
    // The stamp matters even on a skip: without it a dead feed looks unchecked.
    expect(storedSource().lastCheckedAt).toBeTruthy();
    expect(generateFullArticle).not.toHaveBeenCalled();
  });

  it('skips when every item has already been processed', async () => {
    seedSource();
    fetchMock.mockImplementation(serve(() => xml(rssFeed(['Already seen']))));
    kvStore.set(processedKey('news_commentary', simpleHash('Already seen')), {
      processedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await AutoContentService.triggerSource('src-1');

    expect(result.results[0].summary).toContain('already been processed');
    expect(generateFullArticle).not.toHaveBeenCalled();
  });

  it('skips when nothing matches the configured keywords', async () => {
    seedSource({ filterKeywords: ['retirement', 'annuity'] });
    fetchMock.mockImplementation(serve(() => xml(rssFeed(['Mining output rises']))));

    const result = await AutoContentService.triggerSource('src-1');

    expect(result.results[0].summary).toContain('matched keyword filters');
    expect(storedSource().lastCheckedAt).toBeTruthy();
    expect(generateFullArticle).not.toHaveBeenCalled();
  });

  it('matches a keyword against the description as well as the title', async () => {
    seedSource({ filterKeywords: ['annuity'] });
    fetchMock.mockResolvedValue(
      xml(
        '<rss><channel><item><title>Two-pot reform</title><description>What it means for your annuity.</description><link>https://x</link></item></channel></rss>',
      ),
    );

    const result = await AutoContentService.triggerSource('src-1');

    expect(result.totalGenerated).toBe(1);
  });

  it('skips a topic another pipeline has already covered', async () => {
    seedSource();
    fetchMock.mockImplementation(
      serve(() => xml(rssFeed(['SARB holds the repo rate steady again']))),
    );
    await recordTopicHash(
      'SARB holds the repo rate steady again',
      'market_commentary',
      'article-earlier',
    );

    const result = await AutoContentService.triggerSource('src-1');

    expect(result.results[0].summary).toContain('already covered by another pipeline');
    expect(generateFullArticle).not.toHaveBeenCalled();
    expect(keysWithPrefix(GLOBAL_TOPIC_PREFIX)).toHaveLength(1);
  });

  it('does not treat its own pipeline as a duplicate', async () => {
    seedSource();
    fetchMock.mockImplementation(
      serve(() => xml(rssFeed(['SARB holds the repo rate steady again']))),
    );
    await recordTopicHash(
      'SARB holds the repo rate steady again',
      'news_commentary',
      'article-earlier',
    );

    const result = await AutoContentService.triggerSource('src-1');

    expect(result.totalGenerated).toBe(1);
  });

  it('reports an AI failure without losing the run record', async () => {
    seedSource();
    generateFullArticle.mockRejectedValue(new Error('OpenAI rate limited'));

    const result = await AutoContentService.triggerSource('src-1');

    expect(result.totalGenerated).toBe(0);
    expect(result.results[0]).toMatchObject({ status: 'error', articlesGenerated: 0 });
    expect(result.results[0].errors).toEqual(['OpenAI rate limited']);
    expect(storedArticles()).toHaveLength(0);
    // Nothing is marked processed, so a later run can retry the same items.
    expect(keysWithPrefix(`${PROCESSED_PREFIX}news_commentary:`)).toHaveLength(0);
    expect(keysWithPrefix(`${RUN_PREFIX}news_commentary:`)).toHaveLength(1);
  });

  it('falls back to news_commentary for a source with no pipelines configured', async () => {
    seedSource({ pipelines: [] });

    const result = await AutoContentService.triggerSource('src-1');

    expect(result.results[0].pipelineId).toBe('news_commentary');
  });
});
