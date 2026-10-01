/**
 * Optimistic edits to the cached article lists, shared by the delete and
 * archive mutations (useDeleteArticles, useArchiveArticles).
 *
 * Every article cache lives under `publicationKeys.articles()`: the lists
 * (arrays, one per filter set) and single articles (objects). Only the lists
 * are edited here; single articles are left for the settle-time invalidation.
 */

import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { Article } from '../types';
import { publicationKeys } from './queryKeys';

export type ArticleListSnapshots = Array<[QueryKey, unknown]>;

/**
 * Stop in-flight list fetches (so one cannot land on top of the edit), take a
 * snapshot of every article cache, then apply `edit` to each cached list.
 */
export async function editArticleLists(
  queryClient: QueryClient,
  edit: (list: Article[]) => Article[],
): Promise<ArticleListSnapshots> {
  await queryClient.cancelQueries({ queryKey: publicationKeys.articles() });
  const snapshots = queryClient.getQueriesData({ queryKey: publicationKeys.articles() });
  queryClient.setQueriesData({ queryKey: publicationKeys.articles() }, (data: unknown) =>
    Array.isArray(data) ? edit(data as Article[]) : data,
  );
  return snapshots;
}

/**
 * Put the named articles back as they were in `snapshots`. Only those ids are
 * touched, so a second action that started meanwhile is not undone.
 */
export function restoreArticles(
  queryClient: QueryClient,
  snapshots: ArticleListSnapshots,
  ids: ReadonlySet<string>,
): void {
  if (ids.size === 0) return;
  for (const [key, before] of snapshots) {
    if (!Array.isArray(before)) continue;
    const returning = (before as Article[]).filter((a) => ids.has(a.id));
    if (returning.length === 0) continue;
    queryClient.setQueryData(key, (current: unknown) =>
      Array.isArray(current)
        ? [...(current as Article[]).filter((a) => !ids.has(a.id)), ...returning]
        : current,
    );
  }
}

export function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
