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

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PublicationsAPI } from '../api';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants';
import type { Article, BulkDeleteArticlesResult } from '../types';
import { publicationKeys } from './queryKeys';

export interface DeleteArticlesVariables {
  ids: string[];
  mode: 'bulk' | 'single';
}

interface DeleteArticlesContext {
  snapshots: Array<[QueryKey, unknown]>;
  toastId: string | number;
}

/** The article caches hold both lists (arrays) and single articles; only lists are touched. */
function withoutIds(data: unknown, ids: ReadonlySet<string>): unknown {
  return Array.isArray(data) ? (data as Article[]).filter((a) => !ids.has(a.id)) : data;
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

export function useDeleteArticles() {
  const queryClient = useQueryClient();

  /**
   * Put specific articles back from the pre-delete snapshot. Restores only the
   * named ids, so a second delete that started meanwhile is not undone.
   */
  const restore = (snapshots: DeleteArticlesContext['snapshots'], ids: ReadonlySet<string>) => {
    if (ids.size === 0) return;
    for (const [key, before] of snapshots) {
      if (!Array.isArray(before)) continue;
      const returning = (before as Article[]).filter((a) => ids.has(a.id));
      if (returning.length === 0) continue;
      queryClient.setQueryData(key, (current: unknown) =>
        Array.isArray(current)
          ? [...(withoutIds(current, ids) as Article[]), ...returning]
          : current,
      );
    }
  };

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
      // Stop an in-flight list fetch from landing on top of the removal.
      await queryClient.cancelQueries({ queryKey: publicationKeys.articles() });
      const snapshots = queryClient.getQueriesData({ queryKey: publicationKeys.articles() });
      const removing = new Set(ids);
      queryClient.setQueriesData({ queryKey: publicationKeys.articles() }, (data: unknown) =>
        withoutIds(data, removing),
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
      restore(context.snapshots, new Set(ids.filter((id) => !gone.has(id))));

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
      restore(context.snapshots, new Set(ids));
      toast.error(error.message || ERROR_MESSAGES.articleDeleteFailed, { id: context.toastId });
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: publicationKeys.articles() }),
  });
}
