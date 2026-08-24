/**
 * Pins the notes board's pin-order rules.
 *
 * Written before converting DraggablePinnedGrid from react-dnd to
 * @hello-pangea/dnd. These rules — how a saved order is applied, and how it is
 * stored — are what an adviser actually notices, and they must come through the
 * library swap unchanged. Testing them here rather than through a simulated
 * drag means they are held by something neither library can move.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { applyCustomOrder, loadPinOrder, savePinOrder, getStorageKey } from '../pinOrder';
import type { Note } from '../types';

/** applyCustomOrder only reads `id`; the rest of Note is irrelevant here. */
const note = (id: string) => ({ id }) as Note;
const ids = (notes: Note[]) => notes.map((n) => n.id);

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('getStorageKey', () => {
  it('scopes the order to one person', () => {
    expect(getStorageKey('p-1')).toBe('nw_notes_pin_order_p-1');
    expect(getStorageKey('p-2')).not.toBe(getStorageKey('p-1'));
  });
});

describe('savePinOrder / loadPinOrder', () => {
  it('round-trips an order', () => {
    savePinOrder('p-1', ['c', 'a', 'b']);
    expect(loadPinOrder('p-1')).toEqual(['c', 'a', 'b']);
  });

  it('keeps two people’s orders apart', () => {
    savePinOrder('p-1', ['a']);
    savePinOrder('p-2', ['b']);
    expect(loadPinOrder('p-1')).toEqual(['a']);
    expect(loadPinOrder('p-2')).toEqual(['b']);
  });

  it('returns an empty order when nothing is stored', () => {
    expect(loadPinOrder('nobody')).toEqual([]);
  });

  it('returns an empty order rather than throwing on corrupt JSON', () => {
    localStorage.setItem(getStorageKey('p-1'), '{not json');
    expect(loadPinOrder('p-1')).toEqual([]);
  });

  it('swallows a write failure — a full or blocked store must not break the board', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => savePinOrder('p-1', ['a'])).not.toThrow();
  });

  it('swallows a read failure the same way', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(loadPinOrder('p-1')).toEqual([]);
  });
});

describe('applyCustomOrder', () => {
  const notes = [note('a'), note('b'), note('c')];

  it('returns the notes untouched when there is no saved order', () => {
    expect(ids(applyCustomOrder(notes, []))).toEqual(['a', 'b', 'c']);
  });

  it('applies the saved order', () => {
    expect(ids(applyCustomOrder(notes, ['c', 'a', 'b']))).toEqual(['c', 'a', 'b']);
  });

  it('puts notes with a saved position ahead of ones without', () => {
    // A newly pinned note has no stored position; it must not displace the
    // arrangement the adviser chose.
    expect(ids(applyCustomOrder([note('new'), note('a'), note('b')], ['b', 'a']))).toEqual([
      'b',
      'a',
      'new',
    ]);
  });

  it('keeps unsaved notes in their original relative order', () => {
    expect(ids(applyCustomOrder([note('x'), note('y'), note('a')], ['a']))).toEqual([
      'a',
      'x',
      'y',
    ]);
  });

  it('ignores saved ids for notes that are gone (unpinned or deleted)', () => {
    expect(ids(applyCustomOrder([note('a'), note('b')], ['deleted', 'b', 'a']))).toEqual([
      'b',
      'a',
    ]);
  });

  it('does not mutate the input array', () => {
    const input = [note('a'), note('b')];
    const before = ids(input);
    applyCustomOrder(input, ['b', 'a']);
    expect(ids(input)).toEqual(before);
  });

  it('never drops or duplicates a note', () => {
    const out = applyCustomOrder(notes, ['c']);
    expect(out).toHaveLength(3);
    expect([...ids(out)].sort()).toEqual(['a', 'b', 'c']);
  });
});
