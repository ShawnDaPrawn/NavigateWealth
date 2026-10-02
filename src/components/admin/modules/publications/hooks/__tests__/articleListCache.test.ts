/**
 * articleListCache.ts — putting articles back after a failed bulk action.
 *
 * Delete and archive share this helper, and a second action can edit the same
 * lists while the first request is still running. Restoring the first action
 * must put back only its own ids: a later archive, a row that arrived since
 * the snapshot, and a cached single article stay as they are.
 */
import { describe, expect, it, vi } from 'vitest';
import { makeTestQueryClient } from '@/test/utils';
import type { Article, ArticleStatus } from '../../types';
import { editArticleLists, restoreArticles } from '../articleListCache';
import { publicationKeys } from '../queryKeys';

function article(id: string, status: ArticleStatus = 'draft'): Article {
  return {
    id,
    title: id,
    slug: id,
    excerpt: '',
    category_id: 'cat',
    type_id: 'type',
    status,
    is_featured: false,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
  };
}

describe('restoreArticles', () => {
  it('puts only the named articles back, and leaves a later edit where it is', async () => {
    const queryClient = makeTestQueryClient();
    const allKey = publicationKeys.articleList(undefined);
    const draftsKey = publicationKeys.articleList({ status: 'draft' });
    const detailKey = publicationKeys.article('d1');
    queryClient.setQueryData(allKey, [article('d1'), article('p1', 'published')]);
    queryClient.setQueryData(draftsKey, [article('d1')]);
    queryClient.setQueryData(detailKey, article('d1'));

    const snapshots = await editArticleLists(queryClient, (list) =>
      list.filter((row) => row.id !== 'd1'),
    );
    // While the delete is in flight, another action archives p1 and a new draft arrives.
    queryClient.setQueryData(allKey, [article('p1', 'archived'), article('n1')]);

    restoreArticles(queryClient, snapshots, new Set(['d1']));

    expect(queryClient.getQueryData(allKey)).toEqual([
      article('p1', 'archived'),
      article('n1'),
      article('d1'),
    ]);
    expect(queryClient.getQueryData(draftsKey)).toEqual([article('d1')]);
    // The detail cache is not a list. Restoring must not rewrite it.
    expect(queryClient.getQueryData(detailKey)).toEqual(article('d1'));
  });

  it('does nothing when there is nothing to put back', () => {
    const queryClient = makeTestQueryClient();
    const key = publicationKeys.articleList(undefined);
    const list = [article('d1')];
    queryClient.setQueryData(key, list);
    const setQueryData = vi.spyOn(queryClient, 'setQueryData');

    restoreArticles(queryClient, [[key, list]], new Set());

    expect(setQueryData).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(key)).toEqual(list);
  });
});
