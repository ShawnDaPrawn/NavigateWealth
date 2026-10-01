/**
 * Publications — useArchiveArticles (React Query mutation)
 *
 * The archive counterpart of useDeleteArticles. Archived rows switch to
 * `archived` in every cached article list the moment the archive is
 * confirmed (so they leave a Drafts or Published view at once), and the lists
 * are refetched ONCE when the request settles. "Archive selected" used to loop
 * one `POST /articles/:id/archive` per article and refetch the whole list after
 * each (docs/INCIDENTS.md, 2026-10-01).
 *
 * `bulk` goes through `POST /articles/bulk-archive`; `single` keeps the
 * per-article route. Both take published articles off the live site, which the
 * list's confirm dialog says before either runs.
 *
 * Guidelines §6 — server state through React Query; §11.2 — registry keys.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PublicationsAPI } from '../api';
import type { BulkArchiveArticlesResult } from '../types';
import { publicationKeys } from './queryKeys';
import {
  editArticleLists,
  plural,
  restoreArticles,
  type ArticleListSnapshots,
} from './articleListCache';

export interface ArchiveArticlesVariables {
  ids: string[];
  mode: 'bulk' | 'single';
}

interface ArchiveArticlesContext {
  snapshots: ArticleListSnapshots;
  toastId: string | number;
}

export function useArchiveArticles() {
  const queryClient = useQueryClient();

  return useMutation<
    BulkArchiveArticlesResult,
    Error,
    ArchiveArticlesVariables,
    ArchiveArticlesContext
  >({
    mutationFn: async ({ ids, mode }) => {
      if (mode === 'single') {
        await PublicationsAPI.Articles.archiveArticle(ids[0]);
        return { archived: [ids[0]], notFound: [] };
      }
      return PublicationsAPI.Articles.bulkArchiveArticles(ids);
    },

    onMutate: async ({ ids, mode }) => {
      const archiving = new Set(ids);
      const now = new Date().toISOString();
      const snapshots = await editArticleLists(queryClient, (list) =>
        list.map((a) =>
          archiving.has(a.id) ? { ...a, status: 'archived' as const, updated_at: now } : a,
        ),
      );
      const toastId = toast.loading(
        mode === 'single' ? 'Archiving article…' : `Archiving ${plural(ids.length, 'article')}…`,
      );
      return { snapshots, toastId };
    },

    onSuccess: (result, { ids, mode }, context) => {
      // A `notFound` id was deleted elsewhere; the refetch below drops it.
      const settled = new Set([...result.archived, ...result.notFound]);
      restoreArticles(
        queryClient,
        context.snapshots,
        new Set(ids.filter((id) => !settled.has(id))),
      );

      toast.success(
        mode === 'single'
          ? 'Article archived successfully'
          : `Archived ${plural(result.archived.length, 'article')}`,
        { id: context.toastId },
      );
    },

    onError: (error, { ids }, context) => {
      if (!context) return;
      // Put everything back; the refetch below then shows whatever a partly
      // completed request did archive.
      restoreArticles(queryClient, context.snapshots, new Set(ids));
      toast.error(error.message || 'Failed to archive articles', { id: context.toastId });
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: publicationKeys.articles() }),
  });
}
