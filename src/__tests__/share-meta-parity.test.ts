/**
 * Two writers produce the share tags (og:*, twitter:*, article:*) WhatsApp and
 * the other link previews read:
 * - the build, for every article and newsletter issue that exists when it
 *   runs (scripts/seo/seo-static-data.mjs, createStaticSeoHead);
 * - the edge middleware, for one published since (src/middleware/share-meta.ts).
 *
 * The middleware cannot import the build's plain-JS module, so it carries a
 * port. This suite fails the moment the two would write different tags for
 * the same item — a card that changed look depending on when the item was
 * published.
 *
 * It lives outside src/middleware/ on purpose: `typecheck:middleware` cannot
 * type the build script import.
 */
import { describe, expect, it } from 'vitest';
import {
  SITE_URL,
  articleShareMeta,
  newsletterShareMeta,
  shareHeadHtml,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  SHARE_DESCRIPTION_MAX,
  SHARE_IMAGE_RENDER_QUERY,
  SHARE_TITLE_MAX,
  DEFAULT_SHARE_IMAGE_PATH,
  NEWSLETTER_SHARE_IMAGE_PATH,
} from '../middleware/share-meta';
// Plain-JS build script module (no type declarations).
import * as seoStaticData from '../../scripts/seo/seo-static-data.mjs';

type Route = Record<string, unknown>;
const build = seoStaticData as unknown as {
  DEFAULT_SITE_URL: string;
  DEFAULT_OG_IMAGE_PATH: string;
  NEWSLETTER_SHARE_IMAGE_PATH: string;
  SEO_TITLE_MAX: number;
  SEO_DESCRIPTION_MAX: number;
  SHARE_TITLE_MAX: number;
  SHARE_DESCRIPTION_MAX: number;
  SHARE_IMAGE_RENDER_QUERY: string;
  createArticleRoute: (article: Route, siteUrl: string) => Route | null;
  createNewsletterRoute: (newsletter: Route) => Route | null;
  createStaticSeoHead: (route: Route, siteUrl: string) => string;
};

const HERO =
  'https://vpjmdsltwrnpefzcgdmz.supabase.co/storage/v1/object/public/make-91ed8379-publications/articles/1795395265130-d007fbed.jpg';

/** The share tags in the order written, as [key, content] pairs. */
function shareTags(head: string): Array<[string, string]> {
  return [
    ...head.matchAll(/<meta (?:property|name)="((?:og|twitter|article):[^"]+)" content="([^"]*)"/g),
  ].map((m) => [m[1], m[2]]);
}

function searchTags(head: string) {
  return {
    title: head.match(/<title>([^<]*)<\/title>/)?.[1],
    description: head.match(/<meta name="description" content="([^"]*)"/)?.[1],
    canonical: head.match(/<link rel="canonical" href="([^"]*)"/)?.[1],
  };
}

const ARTICLES: Route[] = [
  {
    slug: 'deducted-but-never-paid-over-the-enforcement-lever',
    title: 'Deducted but never paid over: the lever government is now pulling',
    excerpt:
      "Nineteen municipalities owe close to R1.5 billion in retirement contributions deducted from employees' pay, and Treasury is now withholding grants to force payment. What every employee should check on their own benefit statement.",
    hero_image_url: HERO,
    published_at: '2026-11-23T00:11:31.275Z',
    updated_at: '2026-11-23T00:54:25.637Z',
  },
  {
    // Short title (keeps the brand suffix), subtitle in place of an excerpt,
    // a PNG thumbnail as its only picture.
    slug: 'nhi-update',
    title: 'NHI: what changes',
    subtitle: 'A short note.',
    thumbnail_image_url: HERO.replace('.jpg', '.png'),
    published_at: '2026-11-01T08:00:00.000Z',
  },
  {
    // No summary, no picture, an over-long headline, and markup in the title.
    slug: 'long & <odd> headline',
    title: `A ${'very '.repeat(40)}long headline with <em>markup</em> & "quotes"`,
  },
  {
    // A picture hosted elsewhere is used as given.
    slug: 'elsewhere',
    title: 'Fewer liquidations',
    excerpt: 'One sentence without a stop at the end that runs on and on '.repeat(6),
    hero_image_url: 'https://d2ol7oe51mr4n9.cloudfront.net/u/e8085bcf.jpg',
  },
];

const NEWSLETTERS: Route[] = [
  {
    slug: '2026-10-navigate-wealth-october-2026-the-wealth-compass-make-room',
    title: 'Navigate Wealth | October 2026 | The Wealth Compass: Make room for 2027',
    description:
      'The October issue connects rising household costs with investment and currency risk, retirement and tax decisions, and healthcare, income and estate protection. A worked South African household example shows how to prepare for 2027 without counting the same savings twice.',
    publishedAt: '2026-10-10T09:44:07.072Z',
  },
  { slug: 'bare', title: '', description: '' },
];

describe('edge and build share tags agree', () => {
  it('share the same constants', () => {
    expect(SITE_URL).toBe(build.DEFAULT_SITE_URL);
    expect(DEFAULT_SHARE_IMAGE_PATH).toBe(build.DEFAULT_OG_IMAGE_PATH);
    expect(NEWSLETTER_SHARE_IMAGE_PATH).toBe(build.NEWSLETTER_SHARE_IMAGE_PATH);
    expect(SEO_TITLE_MAX).toBe(build.SEO_TITLE_MAX);
    expect(SEO_DESCRIPTION_MAX).toBe(build.SEO_DESCRIPTION_MAX);
    expect(SHARE_TITLE_MAX).toBe(build.SHARE_TITLE_MAX);
    expect(SHARE_DESCRIPTION_MAX).toBe(build.SHARE_DESCRIPTION_MAX);
    expect(SHARE_IMAGE_RENDER_QUERY).toBe(build.SHARE_IMAGE_RENDER_QUERY);
  });

  for (const article of ARTICLES) {
    it(`for article "${String(article.slug)}"`, () => {
      const buildHead = build.createStaticSeoHead(
        build.createArticleRoute(article, build.DEFAULT_SITE_URL)!,
        build.DEFAULT_SITE_URL,
      );
      const edgeHead = shareHeadHtml(articleShareMeta(article)!);
      expect(shareTags(edgeHead)).toEqual(shareTags(buildHead));
      expect(searchTags(edgeHead)).toEqual(searchTags(buildHead));
      expect(shareTags(edgeHead).length).toBeGreaterThan(10);
    });
  }

  for (const newsletter of NEWSLETTERS) {
    it(`for newsletter "${String(newsletter.slug)}"`, () => {
      const buildHead = build.createStaticSeoHead(
        build.createNewsletterRoute(newsletter)!,
        build.DEFAULT_SITE_URL,
      );
      const edgeHead = shareHeadHtml(newsletterShareMeta(newsletter)!);
      expect(shareTags(edgeHead)).toEqual(shareTags(buildHead));
      expect(searchTags(edgeHead)).toEqual(searchTags(buildHead));
    });
  }
});
