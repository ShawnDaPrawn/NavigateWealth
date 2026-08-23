/**
 * Unsplash hero-image search and the image search-query derivation for the
 * publications AI writing service. Moved verbatim from
 * publications-ai-service.ts.
 */
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('publications-ai');

interface UnsplashImageResult {
  /** Full-size image URL suitable for hero images (w=1200) */
  heroUrl: string;
  /** Smaller image URL suitable for thumbnails (w=400) */
  thumbnailUrl: string;
  /** Unsplash attribution (photographer name) */
  photographerName: string;
  /** Unsplash attribution link */
  photographerUrl: string;
  /** Unsplash photo ID for dedup tracking */
  photoId: string;
}

/**
 * Search Unsplash for a relevant stock photo using the AI-suggested query.
 * Returns sized URLs for hero and thumbnail use.
 * Gracefully returns undefined if the key is missing or the search fails.
 *
 * @param query - Search query for Unsplash
 * @param excludeIds - Optional set of Unsplash photo IDs to skip (stale image prevention)
 */
export async function searchUnsplashImage(
  query: string,
  excludeIds?: Set<string>,
): Promise<UnsplashImageResult | undefined> {
  const accessKey = Deno.env.get('UNSPLASH_ACCESS_KEY')?.trim();
  if (!accessKey) {
    log.error(
      'UNSPLASH_ACCESS_KEY not configured — skipping image search. Set this secret for Unsplash images to work.',
    );
    return undefined;
  }

  // Reject obviously invalid keys (placeholder values the user may not have replaced)
  if (
    accessKey.length < 10 ||
    accessKey === 'your-unsplash-access-key' ||
    accessKey.startsWith('sk-')
  ) {
    log.error('UNSPLASH_ACCESS_KEY appears invalid (too short or placeholder value)', {
      keyLength: accessKey.length,
    });
    return undefined;
  }

  try {
    // Request more results when we have exclusions to increase the chance of a fresh image
    const perPage = excludeIds && excludeIds.size > 0 ? '10' : '3';

    const params = new URLSearchParams({
      query,
      per_page: perPage,
      orientation: 'landscape',
      content_filter: 'high', // Safe content only
    });

    const url = `https://api.unsplash.com/search/photos?${params.toString()}`;
    log.info('Calling Unsplash API', { url, query, perPage });

    const response = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        'Accept-Version': 'v1',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unable to read body');
      log.error('Unsplash API error — image search failed', {
        status: response.status,
        statusText: response.statusText,
        query,
        errorBody: errorBody.slice(0, 500),
        hint:
          response.status === 401
            ? 'Invalid UNSPLASH_ACCESS_KEY — check the key value in your Supabase secrets'
            : response.status === 403
              ? 'Unsplash access forbidden — the API key may lack permissions or the app may need approval'
              : response.status === 429
                ? 'Unsplash rate limit exceeded — try again later'
                : 'Unexpected error from Unsplash API',
      });
      return undefined;
    }

    const data = await response.json();
    const results = data.results || [];
    if (results.length === 0) {
      log.info('No Unsplash results for query', { query });
      return undefined;
    }

    // Pick the first result not in the exclusion set
    let photo = results[0];
    if (excludeIds && excludeIds.size > 0) {
      const fresh = results.find((p: { id: string }) => !excludeIds.has(p.id));
      if (fresh) {
        photo = fresh;
        log.info('Skipped excluded images, using fresh result', {
          photoId: photo.id,
          skipped: excludeIds.size,
        });
      } else {
        log.info('All results were in exclusion set — using first result anyway', { query });
      }
    }

    // Use Unsplash's dynamic image resizing via URL params
    // raw URL allows appending sizing params: &w=1200&fit=crop&q=80
    const rawUrl: string = photo.urls?.raw || photo.urls?.full || '';
    if (!rawUrl) {
      log.error('Unsplash photo found but has no raw/full URL', {
        photoId: photo.id,
        urls: JSON.stringify(photo.urls),
      });
      return undefined;
    }

    log.info('Unsplash image found successfully', { photoId: photo.id, query });

    return {
      heroUrl: `${rawUrl}&w=1200&h=630&fit=crop&q=80`,
      thumbnailUrl: `${rawUrl}&w=400&h=300&fit=crop&q=80`,
      photographerName: photo.user?.name || 'Unknown',
      photographerUrl: photo.user?.links?.html || 'https://unsplash.com',
      /** Unsplash photo ID for dedup tracking */
      photoId: photo.id,
    };
  } catch (err) {
    log.error('Unsplash image search failed with exception', {
      query,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Full Article Generation
// ---------------------------------------------------------------------------

/**
 * Derive an Unsplash image search query from the article title and topic.
 * This is a fallback mechanism when the AI doesn't provide a search query.
 *
 * @param title - The article title
 * @param topic - The article topic
 * @returns A search query string
 */
export function deriveImageSearchQuery(title: string, topic: string): string {
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'shall',
    'can',
    'this',
    'that',
    'these',
    'those',
    'it',
    'its',
    'not',
    'no',
    'your',
    'our',
    'their',
    'how',
    'what',
    'when',
    'where',
    'why',
    'which',
    'who',
    'whom',
    'about',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'between',
    'up',
    'down',
    'out',
    'off',
    'over',
    'under',
    'again',
    'further',
    'then',
    'once',
    'here',
    'there',
    'all',
    'each',
    'every',
    'both',
    'few',
    'more',
    'most',
    'other',
    'some',
    'such',
    'only',
    'own',
    'same',
    'so',
    'than',
    'too',
    'very',
    'just',
    'also',
    'weekly',
    'monthly',
    'insights',
    'investors',
    'guide',
    'overview',
  ]);

  // Prefer topic if it's concise (short topics are often more descriptive)
  const source = topic.length <= 60 ? topic : title;
  const keywords = source
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Take 3-4 meaningful keywords, append 'professional' for better stock photo quality
  const selected = keywords.slice(0, 3).join(' ');
  return selected || 'financial planning professional';
}
