import { useCallback, useMemo, useState } from 'react';

export interface Pagination<T> {
  /** Current page, 1-based and clamped to [1, totalPages]. */
  page: number;
  /** Jump to a page (floored at 1; reads stay clamped to totalPages). */
  setPage: (page: number) => void;
  /** The slice of `items` for the current page. */
  pageItems: T[];
  /** Total number of pages (at least 1, even when empty). */
  totalPages: number;
  /** Total number of items. */
  total: number;
  next: () => void;
  prev: () => void;
  canNext: boolean;
  canPrev: boolean;
}

/**
 * Client-side pagination over an in-memory list (Phase 6c shared layer). Owns the
 * 1-based page cursor and derives the current slice; the page is clamped on read,
 * so the current page stays valid when `items` shrinks (e.g. after filtering)
 * without the caller having to reset it.
 */
export function usePagination<T>(items: T[], pageSize: number): Pagination<T> {
  const [page, setPageState] = useState(1);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);

  const pageItems = useMemo(
    () => items.slice((clampedPage - 1) * pageSize, clampedPage * pageSize),
    [items, clampedPage, pageSize],
  );

  const setPage = useCallback((p: number) => setPageState(Math.max(1, Math.floor(p))), []);
  const next = useCallback(() => setPageState((p) => p + 1), []);
  const prev = useCallback(() => setPageState((p) => Math.max(1, p - 1)), []);

  return {
    page: clampedPage,
    setPage,
    pageItems,
    totalPages,
    total,
    next,
    prev,
    canPrev: clampedPage > 1,
    canNext: clampedPage < totalPages,
  };
}
