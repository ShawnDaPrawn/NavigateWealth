/**
 * The Resources page's data rules for the Navigator design, kept out of the
 * components so they can be read (and tested) on their own.
 *
 * Everything here mirrors the live page (src/components/pages/ResourcesPage.tsx
 * and the publications module's InsightsTab): the same four sections, the same
 * category matching, newest first, the same search over articles and market
 * news. Nothing is invented: counts are counted, labels come from the data.
 */
import type { Article, Category } from '../../components/admin/modules/publications';

/** The `?section=` values, in the order the tabs show them. */
export const RESOURCE_SECTIONS = [
  'insights',
  'market-watch',
  'market-updates',
  'newsletters',
] as const;
export type ResourceSection = (typeof RESOURCE_SECTIONS)[number];

export function isResourceSection(value: string | null): value is ResourceSection {
  return value !== null && (RESOURCE_SECTIONS as readonly string[]).includes(value);
}

/** The synthetic "every article" category, as the live page names it. */
export const ALL_CATEGORY_ID = '__all__';

/** The library loads this many cards at a time (the board's page size). */
export const LIBRARY_PAGE_SIZE = 9;

/**
 * The search panel lists at most this many ("Top 8 matches"), as the board
 * does; the live page lists 15.
 */
export const SEARCH_RESULT_LIMIT = 8;

/** Featured insights: one lead and two beside it. */
export const FEATURED_COUNT = 3;

/**
 * The line under each newsletter form: what a subscriber can expect. The board
 * adds "POPIA-compliant"; that is a compliance claim companyFacts.ts does not
 * list, so it is left out.
 */
export const SIGNUP_NOTE = 'Monthly · Unsubscribe any time';

/** Most recent first: published date, then created date (InsightsTab's rule). */
export function sortByRecent(a: Article, b: Article): number {
  const dateA = a.published_at || a.created_at || '';
  const dateB = b.published_at || b.created_at || '';
  if (dateA && dateB) return new Date(dateB).getTime() - new Date(dateA).getTime();
  if (dateA) return -1;
  if (dateB) return 1;
  return 0;
}

export function articleHref(article: Pick<Article, 'slug' | 'id'>): string {
  return `/resources/article/${article.slug || article.id}`;
}

export function articleCategoryName(article: Article): string {
  return article.category_name || article.category?.name || '';
}

/** A card's picture: the thumbnail the cards are cut for, else the hero. */
export function cardImage(article: Article): string {
  return article.thumbnail_image_url || article.hero_image_url || article.featured_image || '';
}

/** The lead feature's wide picture: the hero, else the thumbnail. */
export function heroImage(article: Article): string {
  return article.hero_image_url || article.thumbnail_image_url || article.featured_image || '';
}

export interface TopicFilter {
  id: string;
  name: string;
  slug: string;
}

/** "All" first, then the live categories in their saved order. */
export function buildTopics(categories: readonly Category[]): TopicFilter[] {
  if (categories.length === 0) return [];
  return [
    { id: ALL_CATEGORY_ID, name: 'All', slug: 'all' },
    ...categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
  ];
}

/**
 * Articles by topic, matched the way the live page matches them: by category
 * id, then slug, then name. Every article is also in "All".
 */
export function groupByTopic(
  articles: readonly Article[],
  topics: readonly TopicFilter[],
): Record<string, Article[]> {
  const map: Record<string, Article[]> = {};
  const nameToId: Record<string, string> = {};
  const slugToId: Record<string, string> = {};
  for (const t of topics) {
    map[t.id] = [];
    nameToId[t.name] = t.id;
    if (t.slug) slugToId[t.slug] = t.id;
  }
  for (const article of articles) {
    if (map[ALL_CATEGORY_ID]) map[ALL_CATEGORY_ID].push(article);
    const id =
      (article.category_id && map[article.category_id] ? article.category_id : '') ||
      (article.category_slug ? slugToId[article.category_slug] : '') ||
      (article.category_name ? nameToId[article.category_name] : '');
    if (id && id !== ALL_CATEGORY_ID) map[id].push(article);
  }
  for (const key of Object.keys(map)) map[key].sort(sortByRecent);
  return map;
}

/** The editors' picks (`is_featured`), newest first. */
export function featuredArticles(articles: readonly Article[]): Article[] {
  return articles
    .filter((a) => a.is_featured)
    .sort(sortByRecent)
    .slice(0, FEATURED_COUNT);
}

/** One market-news headline, as the RSS proxy returns it. */
export interface NewsItem {
  title: string;
  pubDate: string;
  author: string;
  link: string;
  image: string;
  description?: string;
  source?: string;
}

export interface NewsFeeds {
  economicNews: NewsItem[];
  forexNews: NewsItem[];
  stockMarket: NewsItem[];
  investingIdeas: NewsItem[];
}

export const EMPTY_NEWS: NewsFeeds = {
  economicNews: [],
  forexNews: [],
  stockMarket: [],
  investingIdeas: [],
};

export interface SearchResult {
  key: string;
  title: string;
  category: string;
  image: string;
  href: string;
  external: boolean;
}

/**
 * The live page's search: titles, excerpts and category names of articles,
 * then the titles of whatever market news has been fetched; at most
 * SEARCH_RESULT_LIMIT.
 */
export function searchResources(
  query: string,
  articles: readonly Article[],
  news: NewsFeeds | undefined,
): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: SearchResult[] = [];
  for (const article of articles) {
    const category = articleCategoryName(article);
    if (
      article.title.toLowerCase().includes(q) ||
      (article.excerpt && article.excerpt.toLowerCase().includes(q)) ||
      category.toLowerCase().includes(q)
    ) {
      results.push({
        key: `article-${article.id || article.slug}`,
        title: article.title,
        category,
        image: cardImage(article),
        href: articleHref(article),
        external: false,
      });
    }
  }
  const feeds = news ?? EMPTY_NEWS;
  Object.values(feeds)
    .flat()
    .forEach((item: NewsItem, i) => {
      if (item.title?.toLowerCase().includes(q)) {
        results.push({
          key: `news-${i}-${item.link}`,
          title: item.title,
          category: 'Market News',
          image: item.image,
          href: item.link || '#',
          external: Boolean(item.link),
        });
      }
    });
  return results.slice(0, SEARCH_RESULT_LIMIT);
}

/**
 * The cover line of a Wealth Compass issue: the words after "The Wealth
 * Compass:" in its title ("Make room for 2027"), or nothing.
 */
export function issueTheme(title: string): string {
  const match = /The Wealth Compass:\s*(.+)$/i.exec(title ?? '');
  return match ? match[1].trim() : '';
}
