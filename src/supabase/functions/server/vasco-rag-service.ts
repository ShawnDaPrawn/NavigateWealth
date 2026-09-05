/**
 * Vasco RAG Service — Retrieval-Augmented Generation
 *
 * One knowledge index, two kinds of source:
 *
 *   article  — published Publications articles (`article:*`)
 *   kb       — "live" Knowledge Base entries written by admins in
 *              AI Management → Knowledge (`ai:kb:*`)
 *
 * Both are chunked, embedded with OpenAI `text-embedding-3-small` (256 dims)
 * and stored in KV. At query time the small vectors are scored, and the text is
 * fetched only for the winning chunks.
 *
 * Why KB entries live in the SAME index: until 2026-09 the Knowledge Base was
 * written to KV and read by nothing. Admins "seeded" entries and Vasco never
 * saw them. Every agent that retrieves context now goes through this index, so
 * a live KB entry is a retrievable source the moment it is saved.
 *
 * KV Key Conventions:
 *   vasco:emb:{articleId}:{chunkIndex}       — article embedding vector only
 *   vasco:chunk:{articleId}:{chunkIndex}     — article chunk text + metadata
 *   vasco:emb:kb:{entryId}:{chunkIndex}      — KB entry embedding vector only
 *   vasco:chunk:kb:{entryId}:{chunkIndex}    — KB entry chunk text + metadata
 *   vasco:article_index                      — metadata about every indexed source
 *
 * Memory Optimisation:
 *   - 256-dim embeddings (not 1536) → ~1 KB per vector instead of ~6 KB
 *   - Embeddings and text split across two KV entries → retrieval loads only vectors
 *   - Sources processed one-at-a-time during retrieval to avoid bulk loading
 */

import { createKvRepository } from './repositories/kv-repository.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getAllEntries, type KBEntry } from './kb-service.ts';

const log = createModuleLogger('vasco-rag');

// ============================================================================
// TYPES
// ============================================================================

export type RagSourceType = 'article' | 'kb';

/**
 * Stored in vasco:emb:* — lightweight, loaded in bulk during search.
 * `articleId` is kept as the field name for backward compatibility with data
 * indexed before KB entries joined the index; for a KB source it holds the
 * entry id.
 */
interface StoredEmbedding {
  sourceType?: RagSourceType;
  articleId: string;
  chunkIndex: number;
  embedding: number[];
}

/** Stored in vasco:chunk:* — only fetched for top-K results */
interface StoredChunk {
  sourceType?: RagSourceType;
  articleId: string;
  articleTitle: string;
  /** Empty for KB entries — they have no public page to link to. */
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

export interface IndexedKnowledgeMeta {
  entryId: string;
  title: string;
  type: KBEntry['type'];
  category: string;
  chunkCount: number;
  indexedAt: string;
  agentScope: 'all' | string[];
  priority: number;
}

export interface ArticleIndex {
  articles: IndexedArticleMeta[];
  /** Absent on index documents written before KB entries joined the index. */
  kbEntries?: IndexedKnowledgeMeta[];
  /** When the whole index was last rebuilt. Null if it has only ever been synced incrementally. */
  lastFullIndex: string | null;
  /** When anything in the index last changed (full rebuild or incremental sync). */
  lastUpdated?: string;
  totalChunks: number;
}

export interface RetrievedContext {
  text: string;
  articleTitle: string;
  articleSlug: string;
  score: number;
  sourceType: RagSourceType;
  sourceId: string;
}

export interface IndexResult {
  articlesIndexed: number;
  kbEntriesIndexed: number;
  totalChunks: number;
  errors: string[];
  durationMs: number;
}

export interface SourceSyncResult {
  indexed: boolean;
  chunkCount: number;
}

/** What the admin UI shows on the Knowledge tab. */
export interface KnowledgeIndexStatus {
  indexed: boolean;
  articles: IndexedArticleMeta[];
  kbEntries: IndexedKnowledgeMeta[];
  totalChunks: number;
  lastFullIndex: string | null;
  lastUpdated: string | null;
  /** Published articles in Publications right now. */
  publishedArticleCount: number;
  /** KB entries whose status is `active` right now. */
  activeKbCount: number;
  /** Published articles that are NOT in the index yet. */
  pendingArticles: number;
  /** Active KB entries that are NOT in the index yet. */
  pendingKbEntries: number;
  /** Indexed sources that are no longer published / active — should be removed. */
  staleSources: number;
}

interface ArticleRecord {
  id: string;
  title: string;
  slug: string;
  status: string;
  body?: string;
  content?: string;
  excerpt?: string;
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
/** Maximum chunks to store per source */
const MAX_CHUNKS_PER_ARTICLE = 10;
/** Top-K chunks to retrieve at query time */
const TOP_K = 4;
/** Minimum similarity score to include in context */
const MIN_SIMILARITY = 0.3;
/** Articles shorter than this are skipped — there is nothing to retrieve. */
const MIN_ARTICLE_BODY_CHARS = 100;
/**
 * KB priority (1–10) nudges the similarity score: priority 10 → +15%,
 * priority 1 → −12%. Enough to break ties in favour of what the admin marked
 * as essential, not enough to surface an irrelevant entry.
 */
const PRIORITY_BOOST_PER_POINT = 0.03;
const DEFAULT_PRIORITY = 5;

const INDEX_ID = 'article_index'; // key: vasco:article_index
const KB_SOURCE_PREFIX = 'kb:';

// Typed repositories over the four namespaces this service owns/reads.
const indexRepo = createKvRepository<ArticleIndex>('vasco:');
const embRepo = createKvRepository<StoredEmbedding>('vasco:emb:');
const chunkRepo = createKvRepository<StoredChunk>('vasco:chunk:');
const articleRepo = createKvRepository<ArticleRecord>('article:');

/** The id segment used in vasco:emb:/vasco:chunk: keys for a given source. */
function sourceKey(sourceType: RagSourceType, sourceId: string): string {
  return sourceType === 'kb' ? `${KB_SOURCE_PREFIX}${sourceId}` : sourceId;
}

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

/** The text Vasco should be able to retrieve for an article. */
function articleToText(article: ArticleRecord): string | null {
  const body = article.body || article.content || '';
  if (!body || body.length < MIN_ARTICLE_BODY_CHARS) return null;
  const plainText = stripHtml(body);
  return `${article.title}\n\n${article.excerpt || ''}\n\n${plainText}`;
}

/**
 * The text Vasco should be able to retrieve for a KB entry. Q&A entries put
 * the question first so a matching visitor question scores highly against it.
 */
export function knowledgeEntryToText(entry: KBEntry): string {
  const parts: string[] = [entry.title];
  if (entry.question || entry.answer) {
    parts.push(
      [
        entry.question ? `Question: ${entry.question}` : '',
        entry.answer ? `Answer: ${entry.answer}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
  if (entry.content) parts.push(stripHtml(entry.content));
  return parts.filter(Boolean).join('\n\n').trim();
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
      Authorization: `Bearer ${openaiKey}`,
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
// INDEX DOCUMENT HELPERS
// ============================================================================

async function loadIndex(): Promise<ArticleIndex | null> {
  return await indexRepo.get(INDEX_ID);
}

function emptyIndex(): ArticleIndex {
  return { articles: [], kbEntries: [], lastFullIndex: null, totalChunks: 0 };
}

function recomputeTotals(index: ArticleIndex): ArticleIndex {
  const kbEntries = index.kbEntries ?? [];
  const totalChunks =
    index.articles.reduce((sum, a) => sum + a.chunkCount, 0) +
    kbEntries.reduce((sum, k) => sum + k.chunkCount, 0);
  return { ...index, kbEntries, totalChunks, lastUpdated: new Date().toISOString() };
}

async function saveIndex(index: ArticleIndex): Promise<void> {
  await indexRepo.put(INDEX_ID, recomputeTotals(index));
}

// ============================================================================
// SOURCE STORAGE
// ============================================================================

/**
 * Delete all stored embedding + chunk KV entries for a given source.
 */
async function deleteSourceEntries(
  sourceType: RagSourceType,
  sourceId: string,
  chunkCount: number,
): Promise<void> {
  const base = sourceKey(sourceType, sourceId);
  const ids = Array.from({ length: chunkCount }, (_, i) => `${base}:${i}`);
  await Promise.all([
    ...ids.map((id) => embRepo.remove(id)),
    ...ids.map((id) => chunkRepo.remove(id)),
  ]);
}

/**
 * Chunk, embed and store one source. Returns the number of chunks written
 * (0 when there was nothing worth indexing).
 */
async function embedAndStoreSource(
  sourceType: RagSourceType,
  sourceId: string,
  title: string,
  slug: string,
  text: string,
): Promise<number> {
  const chunks = chunkText(text);
  if (chunks.length === 0) return 0;

  // One embeddings API call per source
  const embeddings = await generateEmbeddings(chunks);
  const base = sourceKey(sourceType, sourceId);

  for (let i = 0; i < chunks.length; i++) {
    const embData: StoredEmbedding = {
      sourceType,
      articleId: sourceId,
      chunkIndex: i,
      embedding: embeddings[i],
    };
    const chunkData: StoredChunk = {
      sourceType,
      articleId: sourceId,
      articleTitle: title,
      articleSlug: slug,
      chunkIndex: i,
      text: chunks[i],
    };
    // Independent writes — fire in parallel
    await Promise.all([
      embRepo.put(`${base}:${i}`, embData),
      chunkRepo.put(`${base}:${i}`, chunkData),
    ]);
  }

  // Release reference to embeddings array before the caller moves on
  embeddings.length = 0;
  return chunks.length;
}

function knowledgeMeta(entry: KBEntry, chunkCount: number): IndexedKnowledgeMeta {
  return {
    entryId: entry.id,
    title: entry.title,
    type: entry.type,
    category: entry.category,
    chunkCount,
    indexedAt: new Date().toISOString(),
    agentScope: entry.agentScope ?? 'all',
    priority: entry.priority ?? DEFAULT_PRIORITY,
  };
}

// ============================================================================
// FULL REBUILD
// ============================================================================

/**
 * Rebuild the whole index: every published article AND every live KB entry.
 * Processes sources one-at-a-time to keep memory bounded.
 *
 * The name predates KB entries joining the index; it is what the admin route,
 * the frontend and the tests call, so it stays.
 */
export async function indexAllArticles(): Promise<IndexResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const indexedArticles: IndexedArticleMeta[] = [];
  const indexedKb: IndexedKnowledgeMeta[] = [];

  try {
    // Get current index so we can clean up old entries
    const existingIndex = await loadIndex();

    // Delete all old embeddings/chunks per-source (bounded by source count)
    if (existingIndex?.articles) {
      for (const meta of existingIndex.articles) {
        await deleteSourceEntries('article', meta.articleId, meta.chunkCount);
      }
    }
    for (const meta of existingIndex?.kbEntries ?? []) {
      await deleteSourceEntries('kb', meta.entryId, meta.chunkCount);
    }

    // ── Articles ──────────────────────────────────────────────────────────
    const allArticles = await articleRepo.listAll('vasco full re-index');
    const publishedArticles = allArticles.filter((a) => a.status === 'published');

    log.info(`Starting knowledge indexing: ${publishedArticles.length} published articles`);

    for (const article of publishedArticles) {
      try {
        const text = articleToText(article);
        if (!text) {
          log.warn(`Skipping article ${article.id}: body too short`);
          continue;
        }
        const chunkCount = await embedAndStoreSource(
          'article',
          article.id,
          article.title,
          article.slug,
          text,
        );
        if (chunkCount === 0) continue;

        indexedArticles.push({
          articleId: article.id,
          title: article.title,
          slug: article.slug,
          chunkCount,
          indexedAt: new Date().toISOString(),
        });
        log.info(`Indexed article "${article.title}": ${chunkCount} chunks`);
      } catch (err) {
        const msg = `Failed to index article "${article.title || article.id}": ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        log.error(msg);
      }
    }

    // ── Knowledge base entries ────────────────────────────────────────────
    const liveEntries = (await getAllEntries()).filter((e) => e.status === 'active');
    log.info(`Indexing ${liveEntries.length} live knowledge base entries`);

    for (const entry of liveEntries) {
      try {
        const chunkCount = await embedAndStoreSource(
          'kb',
          entry.id,
          entry.title,
          '',
          knowledgeEntryToText(entry),
        );
        if (chunkCount === 0) continue;
        indexedKb.push(knowledgeMeta(entry, chunkCount));
        log.info(`Indexed knowledge entry "${entry.title}": ${chunkCount} chunks`);
      } catch (err) {
        const msg = `Failed to index knowledge entry "${entry.title || entry.id}": ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        log.error(msg);
      }
    }

    const now = new Date().toISOString();
    const index = recomputeTotals({
      articles: indexedArticles,
      kbEntries: indexedKb,
      lastFullIndex: now,
      totalChunks: 0,
    });
    await indexRepo.put(INDEX_ID, index);

    const durationMs = Date.now() - startTime;
    log.info(
      `Indexing complete: ${indexedArticles.length} articles, ${indexedKb.length} KB entries, ${index.totalChunks} chunks in ${durationMs}ms`,
    );

    return {
      articlesIndexed: indexedArticles.length,
      kbEntriesIndexed: indexedKb.length,
      totalChunks: index.totalChunks,
      errors,
      durationMs,
    };
  } catch (err) {
    log.error('Fatal indexing error', err);
    throw err;
  }
}

export async function getArticleIndex(): Promise<ArticleIndex | null> {
  return await loadIndex();
}

/**
 * Everything the Knowledge tab needs to tell the admin whether what they see
 * in Publications / the Knowledge Base is what Vasco can actually retrieve.
 */
export async function getIndexStatus(): Promise<KnowledgeIndexStatus> {
  const [index, allArticles, allEntries] = await Promise.all([
    loadIndex(),
    articleRepo.listAll('vasco index status'),
    getAllEntries(),
  ]);

  const publishedIds = new Set(
    allArticles.filter((a) => a.status === 'published' && articleToText(a)).map((a) => a.id),
  );
  const activeIds = new Set(allEntries.filter((e) => e.status === 'active').map((e) => e.id));

  const articles = index?.articles ?? [];
  const kbEntries = index?.kbEntries ?? [];
  const indexedArticleIds = new Set(articles.map((a) => a.articleId));
  const indexedKbIds = new Set(kbEntries.map((k) => k.entryId));

  let pendingArticles = 0;
  for (const id of publishedIds) if (!indexedArticleIds.has(id)) pendingArticles++;
  let pendingKbEntries = 0;
  for (const id of activeIds) if (!indexedKbIds.has(id)) pendingKbEntries++;
  let staleSources = 0;
  for (const id of indexedArticleIds) if (!publishedIds.has(id)) staleSources++;
  for (const id of indexedKbIds) if (!activeIds.has(id)) staleSources++;

  return {
    indexed: !!index,
    articles,
    kbEntries,
    totalChunks: index?.totalChunks ?? 0,
    lastFullIndex: index?.lastFullIndex ?? null,
    lastUpdated: index?.lastUpdated ?? index?.lastFullIndex ?? null,
    publishedArticleCount: publishedIds.size,
    activeKbCount: activeIds.size,
    pendingArticles,
    pendingKbEntries,
    staleSources,
  };
}

export async function clearArticleIndex(): Promise<void> {
  const index = await loadIndex();

  if (index?.articles) {
    for (const article of index.articles) {
      await deleteSourceEntries('article', article.articleId, article.chunkCount);
    }
  }
  for (const entry of index?.kbEntries ?? []) {
    await deleteSourceEntries('kb', entry.entryId, entry.chunkCount);
  }

  await indexRepo.remove(INDEX_ID);
  log.info('Knowledge index cleared');
}

// ============================================================================
// INCREMENTAL SYNC — one source at a time
// ============================================================================

/**
 * Bring the index in line with one KB entry: a live entry is (re-)embedded, a
 * draft/archived one is removed. Called on every KB write so an admin never
 * has to press "rebuild" for their own change to reach Vasco.
 */
export async function syncKnowledgeEntry(entry: KBEntry): Promise<SourceSyncResult> {
  const index = (await loadIndex()) ?? emptyIndex();
  const kbEntries = index.kbEntries ?? [];

  const previous = kbEntries.find((k) => k.entryId === entry.id);
  if (previous) {
    await deleteSourceEntries('kb', entry.id, previous.chunkCount);
  }
  const remaining = kbEntries.filter((k) => k.entryId !== entry.id);

  if (entry.status !== 'active') {
    await saveIndex({ ...index, kbEntries: remaining });
    log.info('Knowledge entry removed from index', { id: entry.id, status: entry.status });
    return { indexed: false, chunkCount: 0 };
  }

  const chunkCount = await embedAndStoreSource(
    'kb',
    entry.id,
    entry.title,
    '',
    knowledgeEntryToText(entry),
  );
  if (chunkCount > 0) remaining.push(knowledgeMeta(entry, chunkCount));
  await saveIndex({ ...index, kbEntries: remaining });

  log.info('Knowledge entry synced to index', { id: entry.id, chunkCount });
  return { indexed: chunkCount > 0, chunkCount };
}

export async function removeKnowledgeEntryFromIndex(entryId: string): Promise<void> {
  const index = await loadIndex();
  if (!index) return;
  const kbEntries = index.kbEntries ?? [];
  const previous = kbEntries.find((k) => k.entryId === entryId);
  if (!previous) return;

  await deleteSourceEntries('kb', entryId, previous.chunkCount);
  await saveIndex({ ...index, kbEntries: kbEntries.filter((k) => k.entryId !== entryId) });
  log.info('Knowledge entry removed from index', { id: entryId });
}

/**
 * Bring the index in line with one article: published → (re-)embedded,
 * anything else (draft, scheduled, archived, deleted) → removed.
 */
export async function syncArticle(article: ArticleRecord): Promise<SourceSyncResult> {
  const index = (await loadIndex()) ?? emptyIndex();

  const previous = index.articles.find((a) => a.articleId === article.id);
  if (previous) {
    await deleteSourceEntries('article', article.id, previous.chunkCount);
  }
  const remaining = index.articles.filter((a) => a.articleId !== article.id);

  const text = article.status === 'published' ? articleToText(article) : null;
  if (!text) {
    // Nothing to (re-)index. Only write when something actually changed.
    if (previous) {
      await saveIndex({ ...index, articles: remaining });
      log.info('Article removed from index', { id: article.id, status: article.status });
    }
    return { indexed: false, chunkCount: 0 };
  }

  const chunkCount = await embedAndStoreSource(
    'article',
    article.id,
    article.title,
    article.slug,
    text,
  );
  if (chunkCount > 0) {
    remaining.push({
      articleId: article.id,
      title: article.title,
      slug: article.slug,
      chunkCount,
      indexedAt: new Date().toISOString(),
    });
  }
  await saveIndex({ ...index, articles: remaining });

  log.info('Article synced to index', { id: article.id, chunkCount });
  return { indexed: chunkCount > 0, chunkCount };
}

export async function removeArticleFromIndex(articleId: string): Promise<void> {
  const index = await loadIndex();
  if (!index) return;
  const previous = index.articles.find((a) => a.articleId === articleId);
  if (!previous) return;

  await deleteSourceEntries('article', articleId, previous.chunkCount);
  await saveIndex({ ...index, articles: index.articles.filter((a) => a.articleId !== articleId) });
  log.info('Article removed from index', { id: articleId });
}

// ============================================================================
// RETRIEVAL — Memory-bounded search
// ============================================================================

export interface RetrieveOptions {
  /**
   * The agent asking. KB entries scoped to specific agents are only returned
   * to those agents; articles and `all`-scoped entries go to everyone.
   */
  agentId?: string;
}

interface SearchSource {
  sourceType: RagSourceType;
  sourceId: string;
  chunkCount: number;
  boost: number;
}

function isVisibleToAgent(scope: 'all' | string[] | undefined, agentId?: string): boolean {
  if (!scope || scope === 'all') return true;
  if (!agentId) return true;
  return scope.includes(agentId);
}

function priorityBoost(priority: number | undefined): number {
  const p = typeof priority === 'number' ? priority : DEFAULT_PRIORITY;
  return 1 + (p - DEFAULT_PRIORITY) * PRIORITY_BOOST_PER_POINT;
}

/**
 * Retrieve the most relevant chunks for a given query, across published
 * articles and live knowledge base entries.
 *
 * Memory strategy:
 *   1. Load ONLY embedding vectors (256 floats each ≈ 2 KB) — no text
 *   2. Compute similarity, keep a bounded top-K scoring list
 *   3. Fetch full text ONLY for the top-K winners
 */
export async function retrieveContext(
  query: string,
  options: RetrieveOptions = {},
): Promise<RetrievedContext[]> {
  try {
    const index = await loadIndex();
    if (!index) return [];

    const sources: SearchSource[] = [
      ...index.articles.map((a) => ({
        sourceType: 'article' as const,
        sourceId: a.articleId,
        chunkCount: a.chunkCount,
        boost: 1,
      })),
      ...(index.kbEntries ?? [])
        .filter((k) => isVisibleToAgent(k.agentScope, options.agentId))
        .map((k) => ({
          sourceType: 'kb' as const,
          sourceId: k.entryId,
          chunkCount: k.chunkCount,
          boost: priorityBoost(k.priority),
        })),
    ];
    if (sources.length === 0) return [];

    // Generate query embedding (256-dim)
    const [queryEmbedding] = await generateEmbeddings([query]);

    // Scored candidates — bounded to keep memory flat
    const MAX_CANDIDATES = TOP_K * 3;
    let scored: Array<{ source: SearchSource; chunkIndex: number; score: number }> = [];

    // Process ONE source at a time — load its embeddings, score, release
    for (const source of sources) {
      const base = sourceKey(source.sourceType, source.sourceId);
      const ids = Array.from({ length: source.chunkCount }, (_, i) => `${base}:${i}`);
      const embeddings = await embRepo.getMany(ids);

      for (let i = 0; i < embeddings.length; i++) {
        const emb = embeddings[i];
        if (!emb?.embedding) continue;

        const score = cosineSimilarity(queryEmbedding, emb.embedding) * source.boost;
        if (score >= MIN_SIMILARITY) {
          scored.push({ source, chunkIndex: emb.chunkIndex ?? i, score });
        }
      }

      // Prune scored list after each source to keep memory bounded
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
    const chunkIds = topK.map(
      (s) => `${sourceKey(s.source.sourceType, s.source.sourceId)}:${s.chunkIndex}`,
    );
    const chunkTexts = await chunkRepo.getMany(chunkIds);

    const results: RetrievedContext[] = [];
    for (let i = 0; i < topK.length; i++) {
      const chunk = chunkTexts[i];
      if (!chunk) continue;
      results.push({
        text: chunk.text,
        articleTitle: chunk.articleTitle,
        articleSlug: chunk.articleSlug,
        score: topK[i].score,
        sourceType: topK[i].source.sourceType,
        sourceId: topK[i].source.sourceId,
      });
    }

    return results;
  } catch (err) {
    log.error('RAG retrieval error (returning empty context)', err);
    return [];
  }
}
