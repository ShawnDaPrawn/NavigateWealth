/**
 * Move one item within a list.
 *
 * The single operation both drag-and-drop surfaces perform. It lived twice as
 * an inline splice pair — once in DraggablePinnedGrid, once in
 * CategoriesManager — and each copy was entangled with a drag library's
 * callback shape. Pulled out here it is ordinary array logic that can be
 * tested exhaustively and does not care which library moved the item.
 *
 * Returns a new array; the input is not mutated. Out-of-range indices are
 * clamped rather than throwing, because a drag library reporting an index past
 * the end should reorder to the end, not crash a live admin screen.
 */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (next.length === 0) return next;

  const clamp = (i: number) => Math.min(Math.max(i, 0), next.length - 1);
  const fromIndex = clamp(from);
  const toIndex = clamp(to);
  if (fromIndex === toIndex) return next;

  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
