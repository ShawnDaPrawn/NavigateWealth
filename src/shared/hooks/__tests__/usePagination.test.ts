import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from '../usePagination';

const items = Array.from({ length: 23 }, (_, i) => i + 1); // 1..23

describe('usePagination', () => {
  it('slices the current page and reports totals', () => {
    const { result } = renderHook(() => usePagination(items, 10));
    expect(result.current.total).toBe(23);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.page).toBe(1);
    expect(result.current.pageItems).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.current.canPrev).toBe(false);
    expect(result.current.canNext).toBe(true);
  });

  it('navigates with next/prev and exposes the last partial page', () => {
    const { result } = renderHook(() => usePagination(items, 10));
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.page).toBe(3);
    expect(result.current.pageItems).toEqual([21, 22, 23]);
    expect(result.current.canNext).toBe(false);
    act(() => result.current.prev());
    expect(result.current.page).toBe(2);
  });

  it('floors setPage at 1 and clamps reads to totalPages', () => {
    const { result } = renderHook(() => usePagination(items, 10));
    act(() => result.current.setPage(0));
    expect(result.current.page).toBe(1);
    act(() => result.current.setPage(99));
    expect(result.current.page).toBe(3); // clamped on read
  });

  it('keeps the page valid when the list shrinks', () => {
    const { result, rerender } = renderHook(({ list }) => usePagination(list, 10), {
      initialProps: { list: items },
    });
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);
    rerender({ list: items.slice(0, 5) }); // now 1 page
    expect(result.current.page).toBe(1);
    expect(result.current.pageItems).toEqual([1, 2, 3, 4, 5]);
  });

  it('reports a single empty page for an empty list', () => {
    const { result } = renderHook(() => usePagination([] as number[], 10));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.pageItems).toEqual([]);
    expect(result.current.canNext).toBe(false);
  });
});
