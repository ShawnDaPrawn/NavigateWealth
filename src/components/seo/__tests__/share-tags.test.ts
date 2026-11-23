/**
 * The share card each public page gives WhatsApp, LinkedIn, Facebook, X and
 * iMessage: its own title and description (not the search snippet, which is
 * cut to 60/160 characters with an ellipsis), and its own 1200×630 picture
 * under 300 KB, the size past which WhatsApp drops a preview picture.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SITE_ORIGIN } from '@/utils/siteOrigin';
import {
  BRAND_SHARE_IMAGE_PATH,
  PAGE_SHARE_IMAGE_PATHS,
  SERVICE_SHARE_IMAGE_PATHS,
  pageShareImage,
} from '../shareImages';
// Plain-JS build script module (no type declarations).
import * as seoStaticData from '../../../../scripts/seo/seo-static-data.mjs';

type Route = Record<string, any>;
const {
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_SITE_URL,
  createArticleRoute,
  createStaticSeoHead,
  publicSeoRoutes,
  resolveShareImage,
  clampShareText,
} = seoStaticData as unknown as {
  DEFAULT_OG_IMAGE_PATH: string;
  DEFAULT_SITE_URL: string;
  createArticleRoute: (article: Route, siteUrl: string) => Route;
  createStaticSeoHead: (route: Route, siteUrl: string) => string;
  publicSeoRoutes: Route[];
  resolveShareImage: (siteUrl: string, value?: string) => Route;
  clampShareText: (value: string, max: number) => string;
};

const PUBLIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../public');

function pngSize(file: string) {
  const buf = readFileSync(file);
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** As the head writes attribute values. */
function escaped(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function tag(head: string, key: string) {
  return head.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))?.[1];
}

describe('every public page', () => {
  for (const route of publicSeoRoutes) {
    describe(route.path, () => {
      const head = createStaticSeoHead(route, DEFAULT_SITE_URL);

      it('has its own share title and description, whole', () => {
        expect(route.shareTitle, 'shareTitle').toBeTruthy();
        expect(route.shareDescription, 'shareDescription').toBeTruthy();
        expect(route.shareTitle.length).toBeLessThanOrEqual(70);
        expect(route.shareDescription.length).toBeLessThanOrEqual(200);
        expect(tag(head, 'og:title')).toBe(escaped(route.shareTitle));
        expect(tag(head, 'og:description')).not.toMatch(/…$/);
        expect(tag(head, 'twitter:title')).toBe(tag(head, 'og:title'));
      });

      it('names a 1200×630 picture under 300 KB, with its size declared', () => {
        const imagePath = route.ogImage || DEFAULT_OG_IMAGE_PATH;
        const file = resolve(PUBLIC_DIR, `.${imagePath}`);
        expect(existsSync(file), file).toBe(true);
        expect(pngSize(file)).toEqual({ width: 1200, height: 630 });
        expect(statSync(file).size).toBeLessThan(300 * 1024);
        expect(tag(head, 'og:image')).toBe(`${DEFAULT_SITE_URL}${imagePath}`);
        expect(tag(head, 'og:image:width')).toBe('1200');
        expect(tag(head, 'og:image:height')).toBe('630');
        expect(tag(head, 'og:image:type')).toBe('image/png');
      });
    });
  }

  it('each picture is used by one page only, apart from deliberate pairs', () => {
    const byImage = new Map<string, string[]>();
    for (const route of publicSeoRoutes) {
      const image = route.ogImage || DEFAULT_OG_IMAGE_PATH;
      byImage.set(image, [...(byImage.get(image) ?? []), route.path]);
    }
    // Only the home page uses the brand card. The two pairs are one page
    // under two addresses, and a service page with its own quote form.
    expect(byImage.get(DEFAULT_OG_IMAGE_PATH)).toEqual(['/']);
    expect(Object.fromEntries([...byImage].filter(([, paths]) => paths.length > 1))).toEqual({
      '/brand-assets/share/consultation.png': ['/schedule-consultation', '/contact/consultation'],
      '/brand-assets/share/medical-aid.png': ['/medical-aid', '/get-quote/medical-aid'],
    });
  });
});

describe('the app and the prerender name the same pictures', () => {
  it('for every page with a card of its own', () => {
    const prerender = Object.fromEntries(
      publicSeoRoutes
        .filter((route) => route.ogImage && route.schema !== 'service')
        .map((route) => [route.path, route.ogImage]),
    );
    expect(prerender).toEqual(PAGE_SHARE_IMAGE_PATHS);
  });

  it('for every service page', () => {
    for (const route of publicSeoRoutes.filter((r) => r.schema === 'service')) {
      expect(route.ogImage).toBe(SERVICE_SHARE_IMAGE_PATHS[route.path.slice(1)]);
    }
  });

  it('pageShareImage finds a page by canonical URL or path', () => {
    expect(pageShareImage(`${SITE_ORIGIN}/about`)).toBe(
      `${SITE_ORIGIN}/brand-assets/share/about.png`,
    );
    expect(pageShareImage('/why-us/')).toBe(`${SITE_ORIGIN}/brand-assets/share/why-us.png`);
    expect(pageShareImage(`${SITE_ORIGIN}/resources/newsletter/2026-10-issue`)).toBe(
      `${SITE_ORIGIN}/brand-assets/share/newsletter.png`,
    );
    expect(pageShareImage(`${SITE_ORIGIN}/`)).toBeUndefined();
    expect(pageShareImage(undefined)).toBeUndefined();
    expect(BRAND_SHARE_IMAGE_PATH).toBe(DEFAULT_OG_IMAGE_PATH);
  });
});

describe('an article card', () => {
  const article = {
    slug: 'the-r550-000-that-is-tax-free-once-not-once-per-fund',
    title: 'The R550 000 that is tax-free once, not once per fund: what retirees should know',
    excerpt:
      'The tax-free lump sum at retirement is a lifetime allowance, not a per-fund one. Splitting savings across funds does not multiply it, and the order you draw in matters.',
    hero_image_url:
      'https://vpjmdsltwrnpefzcgdmz.supabase.co/storage/v1/object/public/make-91ed8379-publications/articles/1795395477209.jpg',
  };
  const head = createStaticSeoHead(createArticleRoute(article, DEFAULT_SITE_URL), DEFAULT_SITE_URL);

  it('carries the whole headline, while <title> keeps to 60 characters', () => {
    expect(tag(head, 'og:title')).toBe(article.title);
    expect(head.match(/<title>([^<]*)<\/title>/)?.[1].length).toBeLessThanOrEqual(60);
  });

  it('carries the whole excerpt when it fits', () => {
    expect(tag(head, 'og:description')).toBe(article.excerpt);
  });

  it('asks Supabase for the hero at 1200×630 as a JPEG', () => {
    expect(tag(head, 'og:image')).toBe(
      `${article.hero_image_url.replace('/object/public/', '/render/image/public/')}?width=1200&amp;height=630&amp;resize=cover&amp;quality=80&amp;format=origin`,
    );
    expect(tag(head, 'og:image:type')).toBe('image/jpeg');
    expect(tag(head, 'og:image:width')).toBe('1200');
  });

  it('marks the article with its dates', () => {
    const dated = createStaticSeoHead(
      createArticleRoute(
        {
          ...article,
          published_at: '2026-11-21T18:53:11.660Z',
          updated_at: '2026-11-22T08:00:00Z',
        },
        DEFAULT_SITE_URL,
      ),
      DEFAULT_SITE_URL,
    );
    expect(tag(dated, 'og:type')).toBe('article');
    expect(tag(dated, 'article:published_time')).toBe('2026-11-21T18:53:11.660Z');
    expect(tag(dated, 'article:modified_time')).toBe('2026-11-22T08:00:00Z');
  });
});

describe('clampShareText', () => {
  it('ends at a sentence when one falls in the back half', () => {
    expect(clampShareText('One two three four. Five six seven eight nine ten.', 30)).toBe(
      'One two three four.',
    );
  });

  it('else ends at a word, with an ellipsis', () => {
    expect(clampShareText('alpha beta gamma delta epsilon zeta eta theta', 30)).toBe(
      'alpha beta gamma delta…',
    );
  });

  it('strips markup and runs of whitespace', () => {
    expect(clampShareText(' <b>Hello</b>\n\n world ', 50)).toBe('Hello world');
  });
});

describe('resolveShareImage', () => {
  it('claims no size for a picture it does not control', () => {
    expect(resolveShareImage(DEFAULT_SITE_URL, 'https://cdn.example.com/x.jpg')).toEqual({
      url: 'https://cdn.example.com/x.jpg',
      type: 'image/jpeg',
    });
  });
});
