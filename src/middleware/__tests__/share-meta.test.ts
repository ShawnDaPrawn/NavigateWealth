import { describe, expect, it, vi } from 'vitest';
import type { SeoRouteManifest } from '../route-policy';
import {
  FUNCTIONS_BASE_URL,
  articleShareMeta,
  injectShareMeta,
  isLinkPreviewAgent,
  newsletterShareMeta,
  pendingShareTarget,
  renderPendingShare,
  resolveShareImage,
  type ShareTarget,
} from '../share-meta';

const manifest: SeoRouteManifest = {
  generated: true,
  generatedAt: '2026-11-23T00:00:00.000Z',
  paths: ['/', '/resources/article/known', '/resources/newsletter/2026-10-known'],
  articleSlugs: ['known'],
  newsletterSlugs: ['2026-10-known'],
};

const HERO =
  'https://vpjmdsltwrnpefzcgdmz.supabase.co/storage/v1/object/public/make-91ed8379-publications/articles/hero.jpg';

const ARTICLE = {
  slug: 'deducted-but-never-paid-over',
  title: 'Deducted but never paid over: the lever government is now pulling',
  excerpt:
    "Nineteen municipalities owe close to R1.5 billion in retirement contributions deducted from employees' pay, and Treasury is now withholding grants to force payment. What every employee should check on their own benefit statement.",
  hero_image_url: HERO,
  published_at: '2026-11-23T00:11:31.275Z',
  updated_at: '2026-11-23T00:54:25.637Z',
};

/** The shell the build writes: the home page's head and snapshot. */
const SHELL = `<!doctype html><html><head>
    <script type="module" src="/assets/index.js"></script>
      <!-- static-seo:start -->
      <title>Independent Financial Advisors SA | Navigate Wealth</title>
      <meta property="og:title" content="Independent Financial Advisors SA | Navigate Wealth" />
      <!-- static-seo:end -->
    </head><body><div id="root">
      <!-- static-body:start -->
      <main id="seo-static-body" data-seo-path="/"><h1>Home</h1></main>
      <script id="seo-static-body-guard">guard()</script>
      <!-- static-body:end -->
      </div></body></html>`;

const WHATSAPP = 'WhatsApp/2.23.20.0 A';
const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

describe('pendingShareTarget', () => {
  it('picks out an article or issue the build did not prerender', () => {
    expect(pendingShareTarget('/resources/article/brand-new', manifest)).toEqual({
      kind: 'article',
      slug: 'brand-new',
      path: '/resources/article/brand-new',
    });
    expect(pendingShareTarget('/resources/newsletter/2026-11-new/', manifest)).toEqual({
      kind: 'newsletter',
      slug: '2026-11-new',
      path: '/resources/newsletter/2026-11-new',
    });
  });

  it('leaves prerendered items, other pages and nested paths alone', () => {
    expect(pendingShareTarget('/resources/article/known', manifest)).toBeNull();
    expect(pendingShareTarget('/resources/newsletter/2026-10-known', manifest)).toBeNull();
    expect(pendingShareTarget('/about', manifest)).toBeNull();
    expect(pendingShareTarget('/resources/article/', manifest)).toBeNull();
    expect(pendingShareTarget('/resources/article/a/b', manifest)).toBeNull();
  });

  it('does nothing before a build has written the manifest', () => {
    expect(
      pendingShareTarget('/resources/article/brand-new', { ...manifest, generated: false }),
    ).toBeNull();
  });

  it('treats every issue as pending when an older manifest has no issue list', () => {
    const older: SeoRouteManifest = { ...manifest, newsletterSlugs: undefined };
    expect(pendingShareTarget('/resources/newsletter/2026-10-known', older)?.kind).toBe(
      'newsletter',
    );
  });
});

describe('isLinkPreviewAgent', () => {
  it.each([
    WHATSAPP,
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'facebookexternalhit/1.1 Facebot Twitterbot/1.0', // iMessage
    'Twitterbot/1.0',
    'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
    'TelegramBot (like TwitterBot)',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (Windows NT 6.1; WOW64) SkypeUriPreview Preview/0.5',
    '',
  ])('is true for %j', (ua) => {
    expect(isLinkPreviewAgent(ua)).toBe(true);
  });

  it.each([
    CHROME,
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.1; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  ])('is false for a browser: %s', (ua) => {
    expect(isLinkPreviewAgent(ua)).toBe(false);
  });
});

describe('articleShareMeta', () => {
  const meta = articleShareMeta(ARTICLE)!;

  it('keeps the whole headline on the card and fits the search title to 60', () => {
    expect(meta.shareTitle).toBe(ARTICLE.title);
    expect(meta.title.length).toBeLessThanOrEqual(60);
    expect(meta.title.endsWith('…')).toBe(true);
  });

  it('ends the card description at a sentence, not mid-word', () => {
    expect(meta.shareDescription).toBe(
      "Nineteen municipalities owe close to R1.5 billion in retirement contributions deducted from employees' pay, and Treasury is now withholding grants to force payment.",
    );
  });

  it('sends the hero through the image endpoint at the share size', () => {
    expect(meta.image).toEqual({
      url: `${HERO.replace('/object/public/', '/render/image/public/')}?width=1200&height=630&resize=cover&quality=80&format=origin`,
      type: 'image/jpeg',
      width: 1200,
      height: 630,
    });
  });

  it('needs a slug', () => {
    expect(articleShareMeta({ ...ARTICLE, slug: '  ' })).toBeNull();
  });
});

describe('newsletterShareMeta', () => {
  it('uses the newsletter card and drops the brand prefix from the search title', () => {
    const meta = newsletterShareMeta({
      slug: '2026-11-issue',
      title: 'Navigate Wealth | November 2026 | The Wealth Compass: Year end',
      description: 'The November issue.',
    })!;
    expect(meta.title).toBe('November 2026 | The Wealth Compass: Year end');
    expect(meta.shareTitle).toBe('Navigate Wealth | November 2026 | The Wealth Compass: Year end');
    expect(meta.image.url).toBe('https://www.navigatewealth.co/brand-assets/share/newsletter.png');
    expect(meta.image.width).toBe(1200);
  });
});

describe('resolveShareImage', () => {
  it('leaves a picture it knows nothing about as it is, without dimensions', () => {
    expect(resolveShareImage('https://cdn.example.com/a.png')).toEqual({
      url: 'https://cdn.example.com/a.png',
      type: 'image/png',
    });
  });
});

describe('injectShareMeta', () => {
  const meta = articleShareMeta(ARTICLE)!;

  it("replaces the home page's head and snapshot, keeping the rest of the shell", () => {
    const html = injectShareMeta(SHELL, meta)!;
    expect(html).not.toContain('Independent Financial Advisors SA');
    expect(html).not.toContain('seo-static-body-guard');
    expect(html).toContain(`<meta property="og:title" content="${ARTICLE.title}" />`);
    expect(html).toContain('data-seo-path="/resources/article/deducted-but-never-paid-over"');
    expect(html).toContain('<script type="module" src="/assets/index.js"></script>');
    expect(html).toContain('<div id="root">');
  });

  it('escapes what it writes', () => {
    const html = injectShareMeta(
      SHELL,
      articleShareMeta({ ...ARTICLE, title: 'Tax & "you": <the> rules' })!,
    )!;
    expect(html).toContain('content="Tax &amp; &quot;you&quot;: rules"');
    expect(html).toContain('<h1>Tax &amp; &quot;you&quot;: &lt;the&gt; rules</h1>');
  });

  it('declines a shell without the markers', () => {
    expect(injectShareMeta('<html><head></head><body></body></html>', meta)).toBeNull();
  });
});

describe('renderPendingShare', () => {
  const target: ShareTarget = {
    kind: 'article',
    slug: ARTICLE.slug,
    path: `/resources/article/${ARTICLE.slug}`,
  };
  const request = new Request(`https://www.navigatewealth.co${target.path}`, {
    headers: { 'user-agent': WHATSAPP },
  });

  function fakeFetch(api: () => Response, shell: () => Response = () => new Response(SHELL)) {
    return vi.fn(async (input: string | URL) =>
      String(input).startsWith(FUNCTIONS_BASE_URL) ? api() : shell(),
    );
  }

  it("answers the shell with the article's tags", async () => {
    const fetchImpl = fakeFetch(() => Response.json({ success: true, data: ARTICLE }));
    const res = await renderPendingShare(request, target, fetchImpl);
    expect(res?.status).toBe(200);
    expect(res?.headers.get('content-type')).toContain('text/html');
    expect(res?.headers.get('vary')).toBe('User-Agent');
    expect(await res?.text()).toContain(`<meta property="og:title" content="${ARTICLE.title}" />`);
    expect(fetchImpl).toHaveBeenCalledWith(
      `${FUNCTIONS_BASE_URL}/publications/articles/slug/${ARTICLE.slug}`,
      expect.anything(),
    );
    expect(String(fetchImpl.mock.calls[1][0])).toBe('https://www.navigatewealth.co/index.html');
  });

  it('reads an issue from the newsletter endpoint', async () => {
    const fetchImpl = fakeFetch(() =>
      Response.json({
        success: true,
        newsletter: { slug: '2026-11-new', title: 'November', description: 'Issue.' },
      }),
    );
    const res = await renderPendingShare(
      request,
      { kind: 'newsletter', slug: '2026-11-new', path: '/resources/newsletter/2026-11-new' },
      fetchImpl,
    );
    expect(await res?.text()).toContain('/brand-assets/share/newsletter.png');
    expect(fetchImpl).toHaveBeenCalledWith(
      `${FUNCTIONS_BASE_URL}/newsletter-site/newsletters/2026-11-new`,
      expect.anything(),
    );
  });

  it('falls through when the item is not found', async () => {
    const fetchImpl = fakeFetch(() => Response.json({ success: false }, { status: 404 }));
    expect(await renderPendingShare(request, target, fetchImpl)).toBeUndefined();
  });

  it('falls through when the shell cannot be read', async () => {
    const fetchImpl = fakeFetch(
      () => Response.json({ success: true, data: ARTICLE }),
      () => new Response('gone', { status: 500 }),
    );
    expect(await renderPendingShare(request, target, fetchImpl)).toBeUndefined();
  });

  it('falls through when the API throws', async () => {
    const fetchImpl = fakeFetch(() => {
      throw new TypeError('network down');
    });
    expect(await renderPendingShare(request, target, fetchImpl)).toBeUndefined();
  });

  it('gives up after the timeout', async () => {
    const fetchImpl = vi.fn(
      (_input: string | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    expect(await renderPendingShare(request, target, fetchImpl, 20)).toBeUndefined();
  });
});
