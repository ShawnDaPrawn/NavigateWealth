import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFieldSelection } from '../useFieldSelection';

/** Snapshot the selection Set as a sorted array for stable assertions. */
const ids = (s: Set<string>) => [...s].sort();

describe('useFieldSelection', () => {
  it('selectOnly replaces the selection and makes the field primary', () => {
    const { result } = renderHook(() => useFieldSelection());
    act(() => result.current.selectMany(['a', 'b']));
    act(() => result.current.selectOnly('c'));
    expect(ids(result.current.selectedFieldIds)).toEqual(['c']);
    expect(result.current.primarySelectedId).toBe('c');
  });

  describe('toggleInSelection', () => {
    it('adds an absent field and makes it primary', () => {
      const { result } = renderHook(() => useFieldSelection());
      act(() => result.current.selectOnly('a'));
      act(() => result.current.toggleInSelection('b'));
      expect(ids(result.current.selectedFieldIds)).toEqual(['a', 'b']);
      expect(result.current.primarySelectedId).toBe('b');
    });

    it('removes a present field but STILL makes it primary (the deselect quirk)', () => {
      const { result } = renderHook(() => useFieldSelection());
      act(() => result.current.selectMany(['a', 'b']));
      act(() => result.current.toggleInSelection('a'));
      expect(ids(result.current.selectedFieldIds)).toEqual(['b']);
      // primary tracks the last-touched id even though it was just removed
      expect(result.current.primarySelectedId).toBe('a');
    });
  });

  describe('removeFromSelection', () => {
    it('drops the field and clears primary when it was the removed field', () => {
      const { result } = renderHook(() => useFieldSelection());
      act(() => result.current.selectMany(['a', 'b'])); // primary = 'b'
      act(() => result.current.removeFromSelection('b'));
      expect(ids(result.current.selectedFieldIds)).toEqual(['a']);
      expect(result.current.primarySelectedId).toBeUndefined();
    });

    it('drops the field but preserves a different primary', () => {
      const { result } = renderHook(() => useFieldSelection());
      act(() => result.current.selectMany(['a', 'b'])); // primary = 'b'
      act(() => result.current.removeFromSelection('a'));
      expect(ids(result.current.selectedFieldIds)).toEqual(['b']);
      expect(result.current.primarySelectedId).toBe('b');
    });
  });

  describe('selectMany', () => {
    it('replaces by default and makes the last id primary', () => {
      const { result } = renderHook(() => useFieldSelection());
      act(() => result.current.selectOnly('z'));
      act(() => result.current.selectMany(['a', 'b', 'c']));
      expect(ids(result.current.selectedFieldIds)).toEqual(['a', 'b', 'c']);
      expect(result.current.primarySelectedId).toBe('c');
    });

    it('unions with the current selection when additive', () => {
      const { result } = renderHook(() => useFieldSelection());
      act(() => result.current.selectMany(['a', 'b']));
      act(() => result.current.selectMany(['b', 'c'], { additive: true }));
      expect(ids(result.current.selectedFieldIds)).toEqual(['a', 'b', 'c']);
      expect(result.current.primarySelectedId).toBe('c');
    });

    it('an empty additive select keeps the set but clears primary', () => {
      const { result } = renderHook(() => useFieldSelection());
      act(() => result.current.selectMany(['a', 'b']));
      act(() => result.current.selectMany([], { additive: true }));
      expect(ids(result.current.selectedFieldIds)).toEqual(['a', 'b']);
      expect(result.current.primarySelectedId).toBeUndefined();
    });
  });

  it('clearSelection empties the set and primary', () => {
    const { result } = renderHook(() => useFieldSelection());
    act(() => result.current.selectMany(['a', 'b']));
    act(() => result.current.clearSelection());
    expect(ids(result.current.selectedFieldIds)).toEqual([]);
    expect(result.current.primarySelectedId).toBeUndefined();
  });

  describe('signer-filter cycle', () => {
    it('off → filter-to-one → off when the same lone signer is toggled', () => {
      const { result } = renderHook(() => useFieldSelection());
      expect(result.current.visibleSignerIds).toBeNull();
      act(() => result.current.toggleSignerFilter('x@a.co'));
      expect([...result.current.visibleSignerIds!]).toEqual(['x@a.co']);
      act(() => result.current.toggleSignerFilter('x@a.co'));
      expect(result.current.visibleSignerIds).toBeNull();
    });

    it('adds a second signer, then dropping one leaves the other', () => {
      const { result } = renderHook(() => useFieldSelection());
      act(() => result.current.toggleSignerFilter('x@a.co'));
      act(() => result.current.toggleSignerFilter('y@b.co'));
      expect([...result.current.visibleSignerIds!].sort()).toEqual(['x@a.co', 'y@b.co']);
      act(() => result.current.toggleSignerFilter('x@a.co'));
      expect([...result.current.visibleSignerIds!]).toEqual(['y@b.co']);
    });

    it('clearSignerFilter resets to show-everyone', () => {
      const { result } = renderHook(() => useFieldSelection());
      act(() => result.current.toggleSignerFilter('x@a.co'));
      act(() => result.current.clearSignerFilter());
      expect(result.current.visibleSignerIds).toBeNull();
    });
  });
});
