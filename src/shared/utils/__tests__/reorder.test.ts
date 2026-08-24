/**
 * Pins `moveItem`, the one operation both drag-and-drop surfaces perform.
 *
 * This is deliberately library-agnostic. It was written before converting the
 * notes board and the categories table from react-dnd to @hello-pangea/dnd, so
 * that the reordering rules are held by something the swap cannot move. The two
 * libraries disagree about WHEN a move is reported — react-dnd fires on hover,
 * @hello-pangea on drop — but both ultimately say "item at index A now belongs
 * at index B", and that is what is pinned here.
 */
import { describe, it, expect } from 'vitest';
import { moveItem } from '../reorder';

const list = ['a', 'b', 'c', 'd'];

describe('moveItem', () => {
  it('moves an item forward, shifting the ones it passes back', () => {
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item backward, shifting the ones it passes forward', () => {
    expect(moveItem(list, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('moves to the first position', () => {
    expect(moveItem(list, 2, 0)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('moves to the last position', () => {
    expect(moveItem(list, 1, 3)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('is a no-op when the indices are the same', () => {
    expect(moveItem(list, 2, 2)).toEqual(list);
  });

  it('never mutates the input', () => {
    const original = [...list];
    moveItem(list, 0, 3);
    expect(list).toEqual(original);
  });

  it('returns a new array even for a no-op, so callers can set state safely', () => {
    expect(moveItem(list, 1, 1)).not.toBe(list);
  });

  it('preserves length and membership for every pair of indices', () => {
    // Exhaustive over this list: a reorder must never drop or duplicate.
    for (let from = 0; from < list.length; from++) {
      for (let to = 0; to < list.length; to++) {
        const out = moveItem(list, from, to);
        expect(out).toHaveLength(list.length);
        expect([...out].sort()).toEqual([...list].sort());
      }
    }
  });

  it('clamps out-of-range indices instead of throwing', () => {
    // A drag library reporting an index past the end should reorder to the end,
    // not crash a live admin screen.
    expect(moveItem(list, 0, 99)).toEqual(['b', 'c', 'd', 'a']);
    expect(moveItem(list, 99, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(list, -5, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('handles empty and single-item lists', () => {
    expect(moveItem([], 0, 1)).toEqual([]);
    expect(moveItem(['only'], 0, 0)).toEqual(['only']);
  });

  it('works on objects by reference, not by copying them', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    const out = moveItem([a, b], 0, 1);
    expect(out[1]).toBe(a);
    expect(out[0]).toBe(b);
  });
});
