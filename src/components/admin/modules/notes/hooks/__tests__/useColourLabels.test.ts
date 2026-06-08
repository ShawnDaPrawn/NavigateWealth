/**
 * Tests for useColourLabels hook and its pure utility exports.
 *
 * The hook stores per-personnelId label customisations in localStorage.
 * Tests cover:
 *  - getColourDisplayLabel / getColourTooltipLabel pure helpers
 *  - initial load from localStorage on mount
 *  - personnel-scoped storage key isolation
 *  - setLabel (add, update, clear empty string)
 *  - setAllLabels (batch replace, strips empty/whitespace entries)
 *  - getLabel / getTooltip derived accessors
 *  - personnelId change reloads from the new storage slot
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColourLabels, getColourDisplayLabel, getColourTooltipLabel } from '../useColourLabels';
import type { NoteColor, CustomColourLabels } from '../../types';

// ── localStorage stub ─────────────────────────────────────────────────────────
// jsdom provides a real localStorage; we just clear it between tests.

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// ── Constants mirrors (matching constants.ts) ─────────────────────────────────

const STORAGE_KEY = 'nw_notes_colour_labels';
const storageKey = (personnelId: string) => `${STORAGE_KEY}_${personnelId}`;

// ── Pure helpers ──────────────────────────────────────────────────────────────

describe('getColourDisplayLabel', () => {
  it('returns the custom label when one exists', () => {
    const labels: CustomColourLabels = { green: 'New Business' };
    expect(getColourDisplayLabel('green', labels)).toBe('New Business');
  });

  it('falls back to the default colour name when no custom label exists', () => {
    expect(getColourDisplayLabel('green', {})).toBe('Green');
    expect(getColourDisplayLabel('default', {})).toBe('White');
    expect(getColourDisplayLabel('yellow', {})).toBe('Yellow');
  });

  it('falls back when the custom label is only whitespace', () => {
    const labels: CustomColourLabels = { blue: '   ' };
    expect(getColourDisplayLabel('blue', labels)).toBe('Blue');
  });

  it('trims surrounding whitespace from custom labels', () => {
    const labels: CustomColourLabels = { orange: '  Existing Policies  ' };
    expect(getColourDisplayLabel('orange', labels)).toBe('Existing Policies');
  });
});

describe('getColourTooltipLabel', () => {
  it('returns "Color — Custom" when a custom label exists', () => {
    const labels: CustomColourLabels = { green: 'New Business' };
    expect(getColourTooltipLabel('green', labels)).toBe('Green — New Business');
  });

  it('returns just the colour name when no custom label exists', () => {
    expect(getColourTooltipLabel('purple', {})).toBe('Purple');
  });

  it('returns just the colour name when the custom label is whitespace', () => {
    const labels: CustomColourLabels = { pink: '  ' };
    expect(getColourTooltipLabel('pink', labels)).toBe('Pink');
  });

  it('trims surrounding whitespace in the tooltip', () => {
    const labels: CustomColourLabels = { blue: '  Savings  ' };
    expect(getColourTooltipLabel('blue', labels)).toBe('Blue — Savings');
  });
});

// ── useColourLabels hook ──────────────────────────────────────────────────────

describe('useColourLabels — initial state', () => {
  it('starts with empty customLabels when localStorage has nothing', () => {
    const { result } = renderHook(() => useColourLabels('p-1'));
    expect(result.current.customLabels).toEqual({});
  });

  it('loads persisted labels from localStorage on mount', () => {
    const saved: CustomColourLabels = { green: 'New Business', blue: 'Savings' };
    localStorage.setItem(storageKey('p-1'), JSON.stringify(saved));

    const { result } = renderHook(() => useColourLabels('p-1'));
    expect(result.current.customLabels).toEqual(saved);
  });

  it('uses a personnel-scoped key so different personnelIds are isolated', () => {
    localStorage.setItem(storageKey('p-1'), JSON.stringify({ green: 'Biz' }));
    localStorage.setItem(storageKey('p-2'), JSON.stringify({ yellow: 'Draft' }));

    const { result: r1 } = renderHook(() => useColourLabels('p-1'));
    const { result: r2 } = renderHook(() => useColourLabels('p-2'));

    expect(r1.current.customLabels).toEqual({ green: 'Biz' });
    expect(r2.current.customLabels).toEqual({ yellow: 'Draft' });
  });

  it('returns empty object when localStorage value is invalid JSON', () => {
    localStorage.setItem(storageKey('p-bad'), 'not-json{{{');
    const { result } = renderHook(() => useColourLabels('p-bad'));
    expect(result.current.customLabels).toEqual({});
  });
});

describe('useColourLabels — setLabel', () => {
  it('adds a new label', () => {
    const { result } = renderHook(() => useColourLabels('p-1'));

    act(() => result.current.setLabel('green', 'New Business'));

    expect(result.current.customLabels.green).toBe('New Business');
  });

  it('updates an existing label', () => {
    localStorage.setItem(storageKey('p-1'), JSON.stringify({ green: 'Old' }));
    const { result } = renderHook(() => useColourLabels('p-1'));

    act(() => result.current.setLabel('green', 'Updated'));

    expect(result.current.customLabels.green).toBe('Updated');
  });

  it('removes the key when an empty string is set', () => {
    localStorage.setItem(storageKey('p-1'), JSON.stringify({ green: 'Keep', blue: 'Remove' }));
    const { result } = renderHook(() => useColourLabels('p-1'));

    act(() => result.current.setLabel('blue', ''));

    expect(result.current.customLabels).not.toHaveProperty('blue');
    expect(result.current.customLabels.green).toBe('Keep');
  });

  it('removes the key when a whitespace-only string is set', () => {
    localStorage.setItem(storageKey('p-1'), JSON.stringify({ yellow: 'Draft' }));
    const { result } = renderHook(() => useColourLabels('p-1'));

    act(() => result.current.setLabel('yellow', '   '));

    expect(result.current.customLabels).not.toHaveProperty('yellow');
  });

  it('trims the label value before storing', () => {
    const { result } = renderHook(() => useColourLabels('p-1'));

    act(() => result.current.setLabel('orange', '  Risk Cover  '));

    expect(result.current.customLabels.orange).toBe('Risk Cover');
  });

  it('persists to localStorage after setLabel', () => {
    const { result } = renderHook(() => useColourLabels('p-1'));

    act(() => result.current.setLabel('purple', 'Retirement'));

    const stored = JSON.parse(localStorage.getItem(storageKey('p-1'))!);
    expect(stored).toEqual({ purple: 'Retirement' });
  });
});

describe('useColourLabels — setAllLabels', () => {
  it('replaces all labels with the provided map', () => {
    localStorage.setItem(storageKey('p-1'), JSON.stringify({ green: 'Old' }));
    const { result } = renderHook(() => useColourLabels('p-1'));

    act(() => result.current.setAllLabels({ blue: 'Savings', pink: 'Personal' }));

    expect(result.current.customLabels).toEqual({ blue: 'Savings', pink: 'Personal' });
  });

  it('strips entries with empty/whitespace values', () => {
    const { result } = renderHook(() => useColourLabels('p-1'));

    act(() =>
      result.current.setAllLabels({
        green: 'New Business',
        blue: '',
        yellow: '   ',
        purple: 'Retirement',
      }),
    );

    expect(result.current.customLabels).toEqual({
      green: 'New Business',
      purple: 'Retirement',
    });
  });

  it('trims values in the batch save', () => {
    const { result } = renderHook(() => useColourLabels('p-1'));

    act(() => result.current.setAllLabels({ orange: '  Existing  ' }));

    expect(result.current.customLabels.orange).toBe('Existing');
  });

  it('persists to localStorage after setAllLabels', () => {
    const { result } = renderHook(() => useColourLabels('p-1'));

    act(() => result.current.setAllLabels({ green: 'New Business' }));

    const stored = JSON.parse(localStorage.getItem(storageKey('p-1'))!);
    expect(stored).toEqual({ green: 'New Business' });
  });

  it('calling setAllLabels with all-empty map clears all labels', () => {
    localStorage.setItem(storageKey('p-1'), JSON.stringify({ green: 'Old' }));
    const { result } = renderHook(() => useColourLabels('p-1'));

    act(() => result.current.setAllLabels({ green: '' }));

    expect(result.current.customLabels).toEqual({});
  });
});

describe('useColourLabels — getLabel accessor', () => {
  it('returns the custom label when set', () => {
    const { result } = renderHook(() => useColourLabels('p-1'));

    act(() => result.current.setLabel('green', 'New Business'));

    expect(result.current.getLabel('green')).toBe('New Business');
  });

  it('falls back to the default colour name when no custom label is set', () => {
    const { result } = renderHook(() => useColourLabels('p-1'));
    expect(result.current.getLabel('green')).toBe('Green');
  });
});

describe('useColourLabels — getTooltip accessor', () => {
  it('returns "Color — Custom" format when custom label is set', () => {
    const { result } = renderHook(() => useColourLabels('p-1'));

    act(() => result.current.setLabel('blue', 'Savings'));

    expect(result.current.getTooltip('blue')).toBe('Blue — Savings');
  });

  it('returns just the colour name when no custom label is set', () => {
    const { result } = renderHook(() => useColourLabels('p-1'));
    expect(result.current.getTooltip('yellow')).toBe('Yellow');
  });
});

describe('useColourLabels — personnelId change', () => {
  it('reloads labels when personnelId prop changes', () => {
    localStorage.setItem(storageKey('p-1'), JSON.stringify({ green: 'P1 label' }));
    localStorage.setItem(storageKey('p-2'), JSON.stringify({ yellow: 'P2 label' }));

    const { result, rerender } = renderHook(({ pid }: { pid: string }) => useColourLabels(pid), {
      initialProps: { pid: 'p-1' },
    });

    expect(result.current.customLabels).toEqual({ green: 'P1 label' });

    rerender({ pid: 'p-2' });

    expect(result.current.customLabels).toEqual({ yellow: 'P2 label' });
  });
});
