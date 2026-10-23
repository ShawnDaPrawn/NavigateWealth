/**
 * Publications — useDeleteArticles (React Query mutation)
 *
 * Deleted rows leave every cached article list the moment the delete is
 * confirmed, while the request runs; the lists are refetched ONCE when it
 * settles. The previous path awaited one `DELETE` per article and refetched
 * the whole list twice after each, so 120 drafts took 7.5 minutes to delete,
 * nothing left the screen until the end, and the refresh spinner never
 * stopped (docs/INCIDENTS.md, 2026-10-01).
 *
 * `bulk` goes through `POST /articles/bulk-delete`, which never deletes a
 * published article; any it is handed come back in `kept` and are put back in
 * the list. `single` keeps the per-article `DELETE`, which can delete a
 * published article behind its own explicit, title-naming confirmation.
 *
 * Guidelines §6 — server state through React Query; §11.2 — registry keys.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PublicationsAPI } from '../api';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants';
import type { BulkDeleteArticlesResult } from '../types';
import { publicationKeys } from './queryKeys';
import {
  editArticleLists,
  plural,
  restoreArticles,
  type ArticleListSnapshots,
} from './articleListCache';

export interface DeleteArticlesVariables {
  ids: string[];
  mode: 'bulk' | 'single';
}

interface DeleteArticlesContext {
  snapshots: ArticleListSnapshots;
  toastId: string | number;
}

export function useDeleteArticles() {
  const queryClient = useQueryClient();

  return useMutation<
    BulkDeleteArticlesResult,
    Error,
    DeleteArticlesVariables,
    DeleteArticlesContext
  >({
    mutationFn: async ({ ids, mode }) => {
      if (mode === 'single') {
        await PublicationsAPI.Articles.deleteArticle(ids[0]);
        return { deleted: [ids[0]], kept: [], notFound: [] };
      }
      return PublicationsAPI.Articles.bulkDeleteArticles(ids);
    },

    onMutate: async ({ ids, mode }) => {
      const removing = new Set(ids);
      const snapshots = await editArticleLists(queryClient, (list) =>
        list.filter((a) => !removing.has(a.id)),
      );
      const toastId = toast.loading(
        mode === 'single' ? 'Deleting article…' : `Deleting ${plural(ids.length, 'article')}…`,
      );
      return { snapshots, toastId };
    },

    onSuccess: (result, { ids, mode }, context) => {
      const gone = new Set([...result.deleted, ...result.notFound]);
      for (const id of gone) {
        queryClient.removeQueries({ queryKey: publicationKeys.article(id), exact: true });
      }
      restoreArticles(queryClient, context.snapshots, new Set(ids.filter((id) => !gone.has(id))));

      if (mode === 'single') {
        toast.success(SUCCESS_MESSAGES.articleDeleted, { id: context.toastId });
        return;
      }
      if (gone.size > 0) {
        toast.success(`Deleted ${plural(gone.size, 'article')}`, { id: context.toastId });
      } else {
        toast.dismiss(context.toastId);
      }
      if (result.kept.length > 0) {
        toast.info(
          `Kept ${plural(result.kept.length, 'published article')} — live articles are never ` +
            'bulk deleted. Delete them one at a time, or unpublish them first.',
        );
      }
    },

    onError: (error, { ids }, context) => {
      if (!context) return;
      // Put everything back; the refetch below then drops whatever a partly
      // completed request did delete.
      restoreArticles(queryClient, context.snapshots, new Set(ids));
      toast.error(error.message || ERROR_MESSAGES.articleDeleteFailed, { id: context.toastId });
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: publicationKeys.articles() }),
  });
}
