import { describe, expect, it, vi } from 'vitest';
import { reindexKnowledge } from '../reindexKnowledge';

describe('reindexKnowledge', () => {
  it('stops after one call when the server does not ask to continue', async () => {
    const post = vi.fn().mockResolvedValue({
      articlesIndexed: 3,
      totalChunks: 3,
      durationMs: 4,
    });
    const result = await reindexKnowledge(post);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(null);
    expect(result.articlesIndexed).toBe(3);
    expect(result.errors).toEqual([]);
  });

  it('sums every page and posts the cursor back', async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce({
        articlesIndexed: 8,
        totalChunks: 8,
        durationMs: 2,
        done: false,
        nextCursor: 'k:',
      })
      .mockResolvedValueOnce({
        kbEntriesIndexed: 2,
        totalChunks: 2,
        durationMs: 1,
        errors: ['kb failed'],
        done: true,
        nextCursor: null,
      });
    const result = await reindexKnowledge(post);
    expect(post).toHaveBeenNthCalledWith(2, 'k:');
    expect(result).toMatchObject({
      articlesIndexed: 8,
      kbEntriesIndexed: 2,
      totalChunks: 10,
      durationMs: 3,
      errors: ['kb failed'],
    });
  });
});
