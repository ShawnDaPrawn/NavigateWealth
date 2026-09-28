/**
 * The page numbers to show, with 'ellipsis' gaps: always the first and last
 * page, and the current page with one neighbour each side, in 7 slots.
 */
export function paginationRange(page: number, pageCount: number): (number | 'ellipsis')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, 'ellipsis', pageCount];
  if (page >= pageCount - 3)
    return [1, 'ellipsis', ...Array.from({ length: 5 }, (_, i) => pageCount - 4 + i)];
  return [1, 'ellipsis', page - 1, page, page + 1, 'ellipsis', pageCount];
}
