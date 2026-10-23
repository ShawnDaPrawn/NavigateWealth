/**
 * Articles repository
 * ===================
 *
 * Added with the bulk article delete. Removing 120 drafts used to mean 120
 * sequential `DELETE /articles/:id` calls, each paying a CORS preflight and
 * five KV round-trips of its own, so the admin's browser sat in the loop for
 * over seven minutes. A batched delete needs batched reads and writes, and the
 * direct-access ratchet is right that those belong here rather than in another
 * hand-rolled `kv.*` loop.
 *
 * SCOPE: the existing article routes still reach `article:` directly. This
 * file owns the three namespaces the bulk delete touches and nothing else.
 */

import { createKvRepository } from './kv-repository.ts';
import type {
  Article,
  ArticleTagLink,
  DeletedArticleRecord,
} from '../publications-route-helpers.ts';

export const articles = createKvRepository<Article>('article:');

/**
 * Tombstones for deleted articles. The email-engagement reports read these so
 * a deleted article's send history still carries its title and slug.
 */
export const deletedArticles = createKvRepository<DeletedArticleRecord>('article_deleted:');

export const ARTICLE_TAG_LINK_NAMESPACE = 'article_tag_link:';

/** Keyed `<articleId>:<tagId>`, so `listWithKeys(reason, `${articleId}:`)` finds one article's links. */
export const articleTagLinks = createKvRepository<ArticleTagLink>(ARTICLE_TAG_LINK_NAMESPACE);
