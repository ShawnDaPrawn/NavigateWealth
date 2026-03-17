/**
 * Vasco RAG Service — Retrieval-Augmented Generation
 *
 * Handles article chunking, embedding generation (OpenAI), KV storage,
 * and similarity-based retrieval for the public "Ask Vasco" chatbot.
 *
 * Architecture:
 *   1. Admin triggers indexing → articles are fetched, HTML-stripped, chunked
 *   2. Each chunk is embedded via OpenAI text-embedding-3-small (256 dims)
 *   3. Embeddings and chunk text are stored SEPARATELY in KV to limit memory
 *   4. At query time, only small embedding vectors are loaded for similarity
 *   5. Text is fetched only for the top-K winning chunks
 *
 * KV Key Conventions:
 *   vasco:emb:{articleId}:{chunkIndex}    — embedding vector only (number[])
 *   vasco:chunk:{articleId}:{chunkIndex}   — chunk text + article metadata (no vector)
 *   vasco:article_index                    — metadata about all indexed articles
 *
 * Memory Optimisation:
 *   - 256-dim embeddings (not 1536) → ~1 KB per vector instead of ~6 KB
 *   - Embeddings and text split across two KV entries → retrieval loads only vectors
 *   - Articles processed one-at-a-time during retrieval to avoid bulk loading
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('vasco-rag');

// ============================================================================
// TYPES
// ============================================================================

/** Stored in vasco:emb:{id}:{idx} — lightweight, loaded in bulk during search */
interface StoredEmbedding {
  articleId: string;
  chunkIndex: number;
  embedding: number[];
}

/** Stored in vasco:chunk:{id}:{idx} — only fetched for top-K results */
interface StoredChunk {
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  chunkIndex: number;
  text: string;
}

export interface IndexedArticleMeta {
  articleId: string;
  title: string;
  slug: string;
  chunkCount: number;
  indexedAt: string;
}

export interface ArticleIndex {
  articles: IndexedArticleMeta[];
  lastFullIndex: string;
  totalChunks: number;
}

export interface RetrievedContext {
  text: string;
  articleTitle: string;
  articleSlug: string;
  score: number;
}

export interface IndexResult {
  articlesIndexed: number;
  totalChunks: number;
  errors: string[];
  durationMs: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const EMBEDDING_MODEL = 'text-embedding-3-small';
/**
 * Use 256 dimensions instead of the default 1536.
 * This reduces per-vector memory from ~12 KB to ~2 KB with minimal
 * quality loss for short-document retrieval tasks.
 */
const EMBEDDING_DIMENSIONS = 256;

/** Target chunk size in characters (~500 tokens ≈ ~2000 chars) */
const CHUNK_SIZE = 1800;
/** Overlap between chunks for context continuity */
const CHUNK_OVERLAP = 200;
/** Maximum chunks to store per article */
const MAX_CHUNKS_PER_ARTICLE = 10;
/** Top-K chunks to retrieve at query time */
const TOP_K = 4;
/** Minimum similarity score to include in context */
const MIN_SIMILARITY = 0.3;

const ARTICLE_INDEX_KEY = 'vasco:article_index';
const EMB_PREFIX = 'vasco:emb:';
const CHUNK_PREFIX = 'vasco:chunk:';

// ============================================================================
// HTML STRIPPING & TEXT CLEANING
// ============================================================================

function stripHtml(html: string): string {
  return html
    .replace(/<\/?(p|div|br|h[1-6]|li|tr|blockquote)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================================================
// CHUNKING
// ============================================================================

function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) {
    return [text.trim()].filter(Boolean);
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);

    if (end < text.length) {
      const paragraphBreak = text.lastIndexOf('\n\n', end);
      if (paragraphBreak > start + CHUNK_SIZE * 0.5) {
        end = paragraphBreak;
      } else {
        const sentenceBreak = text.lastIndexOf('. ', end);
        if (sentenceBreak > start + CHUNK_SIZE * 0.5) {
          end = sentenceBreak + 1;
        }
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) {
      chunks.push(chunk);
    }

    const nextStart = end - CHUNK_OVERLAP;
    // Prevent infinite loop: always advance past current start
    start = nextStart > start ? nextStart : end;
  }

  return chunks.slice(0, MAX_CHUNKS_PER_ARTICLE);
}

// ============================================================================
// EMBEDDING GENERATION (256-dim)
// ============================================================================

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error('OpenAI embedding API error', { status: response.status, body: errorText });
    throw new Error(`Embedding generation failed: ${response.status}`);
  }

  const data = await response.json();
  const sorted = data.data.sort((a: { index: number }, b: { index: number }) => a.index - b.index);
  return sorted.map((item: { embedding: number[] }) => item.embedding);
}

// ============================================================================
// COSINE SIMILARITY
// ============================================================================

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// ============================================================================
// INDEXING
// ============================================================================

/**
 * Delete all stored embedding + chunk KV entries for a given article.
 */
async function deleteArticleEntries(articleId: string, chunkCount: number): Promise<void> {
  const embKeys = Array.from({ length: chunkCount }, (_, i) => `${EMB_PREFIX}${articleId}:${i}`);
  const chunkKeys = Array.from({ length: chunkCount }, (_, i) => `${CHUNK_PREFIX}${articleId}:${i}`);

  // Delete in parallel, small batches
  await Promise.all([
    ...embKeys.map((k) => kv.del(k)),
    ...chunkKeys.map((k) => kv.del(k)),
  ]);
}

/**
 * Index all published articles: strip HTML, chunk, embed, store.
 * Processes articles one-at-a-time to keep memory bounded.
 */
export async function indexAllArticles(): Promise<IndexResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let totalChunks = 0;
  const indexedArticles: IndexedArticleMeta[] = [];

  try {
    // Get current index so we can clean up old entries
    const existingIndex = await kv.get(ARTICLE_INDEX_KEY) as ArticleIndex | null;

    // Delete all old embeddings/chunks per-article (bounded by article count)
    if (existingIndex?.articles) {
      for (const meta of existingIndex.articles) {
        await deleteArticleEntries(meta.articleId, meta.chunkCount);
      }
    }

    // Fetch all articles from KV
    const allArticles = await kv.getByPrefix('article:');
    const publishedArticles = allArticles.filter(
      (a: { status: string }) => a.status === 'published'
    );

    log.info(`Starting article indexing: ${publishedArticles.length} published articles`);

    for (const article of publishedArticles) {
      try {
        const body = article.body || article.content || '';
        if (!body || body.length < 100) {
          log.warn(`Skipping article ${article.id}: body too short`);
          continue;
        }

        const plainText = stripHtml(body);
        const contextText = `${article.title}\n\n${article.excerpt || ''}\n\n${plainText}`;
        const chunks = chunkText(contextText);
        if (chunks.length === 0) continue;

        // Generate embeddings (one API call per article)
        const embeddings = await generateEmbeddings(chunks);

        // Store embeddings and chunks SEPARATELY
        for (let i = 0; i < chunks.length; i++) {
          const embData: StoredEmbedding = {
            articleId: article.id,
            chunkIndex: i,
            embedding: embeddings[i],
          };
          const chunkData: StoredChunk = {
            articleId: article.id,
            articleTitle: article.title,
            articleSlug: article.slug,
            chunkIndex: i,
            text: chunks[i],
          };
          // Fire in parallel — these are independent writes
          await Promise.all([
            kv.set(`${EMB_PREFIX}${article.id}:${i}`, embData),
            kv.set(`${CHUNK_PREFIX}${article.id}:${i}`, chunkData),
          ]);
        }

        totalChunks += chunks.length;
        indexedArticles.push({
          articleId: article.id,
          title: article.title,
          slug: article.slug,
          chunkCount: chunks.length,
          indexedAt: new Date().toISOString(),
        });

        // Release reference to embeddings array before processing next article
        embeddings.length = 0;

        log.info(`Indexed article "${article.title}": ${chunks.length} chunks`);
      } catch (err) {
        const msg = `Failed to index article "${article.title || article.id}": ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        log.error(msg);
      }
    }

    const index: ArticleIndex = {
      articles: indexedArticles,
      lastFullIndex: new Date().toISOString(),
      totalChunks,
    };
    await kv.set(ARTICLE_INDEX_KEY, index);

    const durationMs = Date.now() - startTime;
    log.info(`Indexing complete: ${indexedArticles.length} articles, ${totalChunks} chunks in ${durationMs}ms`);

    return { articlesIndexed: indexedArticles.length, totalChunks, errors, durationMs };
  } catch (err) {
    log.error('Fatal indexing error', err);
    throw err;
  }
}

export async function getArticleIndex(): Promise<ArticleIndex | null> {
  return await kv.get(ARTICLE_INDEX_KEY) as ArticleIndex | null;
}

export async function clearArticleIndex(): Promise<void> {
  const index = await kv.get(ARTICLE_INDEX_KEY) as ArticleIndex | null;

  if (index?.articles) {
    for (const article of index.articles) {
      await deleteArticleEntries(article.articleId, article.chunkCount);
    }
  }

  await kv.del(ARTICLE_INDEX_KEY);
  log.info('Article index cleared');
}

// ============================================================================
// RETRIEVAL — Memory-bounded search
// ============================================================================

/**
 * Retrieve the most relevant article chunks for a given query.
 *
 * Memory strategy:
 *   1. Load ONLY embedding vectors (256 floats each ≈ 2 KB) — no text
 *   2. Compute similarity, keep a bounded top-K scoring list
 *   3. Fetch full text ONLY for the top-K winners
 */
export async function retrieveContext(query: string): Promise<RetrievedContext[]> {
  try {
    const index = await kv.get(ARTICLE_INDEX_KEY) as ArticleIndex | null;
    if (!index || index.articles.length === 0) {
      return [];
    }

    // Generate query embedding (256-dim)
    const [queryEmbedding] = await generateEmbeddings([query]);

    // Scored candidates — we only keep TOP_K * 2 at most to bound memory
    const MAX_CANDIDATES = TOP_K * 3;
    let scored: Array<{ articleId: string; chunkIndex: number; score: number }> = [];

    // Process ONE article at a time — load its embeddings, score, release
    for (const articleMeta of index.articles) {
      const embKeys = Array.from(
        { length: articleMeta.chunkCount },
        (_, i) => `${EMB_PREFIX}${articleMeta.articleId}:${i}`
      );

      const embeddings = await kv.mget(embKeys) as (StoredEmbedding | null)[];

      for (const emb of embeddings) {
        if (!emb?.embedding) continue;

        const score = cosineSimilarity(queryEmbedding, emb.embedding);
        if (score >= MIN_SIMILARITY) {
          scored.push({
            articleId: emb.articleId,
            chunkIndex: emb.chunkIndex,
            score,
          });
        }
      }

      // Prune scored list after each article to keep memory bounded
      if (scored.length > MAX_CANDIDATES) {
        scored.sort((a, b) => b.score - a.score);
        scored = scored.slice(0, TOP_K);
      }
    }

    // Final sort and select top-K
    scored.sort((a, b) => b.score - a.score);
    const topK = scored.slice(0, TOP_K);

    if (topK.length === 0) return [];

    // NOW fetch only the text for the winning chunks
    const chunkKeys = topK.map(
      (s) => `${CHUNK_PREFIX}${s.articleId}:${s.chunkIndex}`
    );
    const chunkTexts = await kv.mget(chunkKeys) as (StoredChunk | null)[];

    const results: RetrievedContext[] = [];
    for (let i = 0; i < topK.length; i++) {
      const chunk = chunkTexts[i];
      if (!chunk) continue;
      results.push({
        text: chunk.text,
        articleTitle: chunk.articleTitle,
        articleSlug: chunk.articleSlug,
        score: topK[i].score,
      });
    }

    return results;
  } catch (err) {
    log.error('RAG retrieval error (returning empty context)', err);
    return [];
  }
}
