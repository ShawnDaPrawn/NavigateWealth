import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  MIN_FIELD_PT,
  fitWidthZoom,
  mmToPct,
  mmToPt,
  pctToMm,
  ptToMm,
  resizeRect,
} from '../placementMath';
import { preflightIssues } from '../studioPreflight';
import { useFieldHistory } from '../useFieldHistory';
import type { EsignField, SignerFormData } from '../../types';

const PAGE = { width: 595, height: 842 };
const rect = { left: 100, top: 200, width: 120, height: 30 };

describe('resizeRect', () => {
  it('moves only the dragged edge, from any of the eight handles', () => {
    // East: right edge moves, left stays.
    expect(resizeRect(rect, 'e', 10, 0, PAGE)).toEqual({ ...rect, width: 130 });
    // West: left edge moves, right stays where it was.
    expect(resizeRect(rect, 'w', 10, 0, PAGE)).toEqual({ ...rect, left: 110, width: 110 });
    // North-west corner: top and left move together.
    expect(resizeRect(rect, 'nw', -5, -4, PAGE)).toEqual({
      left: 95,
      top: 196,
      width: 125,
      height: 34,
    });
    // South: height only.
    expect(resizeRect(rect, 's', 50, -16, PAGE)).toEqual({ ...rect, height: 14 });
  });

  it('can shrink to a small form box, but not below the minimum', () => {
    // The old 20pt minimum (24pt with snapping) made 14pt boxes impossible.
    expect(resizeRect(rect, 's', 0, -16, PAGE).height).toBe(14);
    expect(resizeRect(rect, 's', 0, -1000, PAGE).height).toBe(MIN_FIELD_PT);
    expect(resizeRect(rect, 'w', 1000, 0, PAGE).width).toBe(MIN_FIELD_PT);
  });

  it('never leaves the page', () => {
    const r = resizeRect(rect, 'se', 10_000, 10_000, PAGE);
    expect(r.left + r.width).toBe(PAGE.width);
    expect(r.top + r.height).toBe(PAGE.height);
    expect(resizeRect(rect, 'nw', -10_000, -10_000, PAGE)).toMatchObject({ left: 0, top: 0 });
  });

  it('snaps only the moving edge to the grid', () => {
    const r = resizeRect({ left: 101, top: 203, width: 50, height: 20 }, 'e', 3, 0, PAGE, 8);
    expect(r.left).toBe(101); // fixed edge untouched
    expect((r.left + r.width) % 8).toBe(0);
  });
});

describe('unit conversions and fit', () => {
  it('round-trips millimetres', () => {
    expect(ptToMm(72)).toBeCloseTo(25.4, 5);
    expect(mmToPt(25.4)).toBeCloseTo(72, 5);
    expect(mmToPct(pctToMm(37.5, 595), 595)).toBeCloseTo(37.5, 6);
    expect(mmToPct(10, 0)).toBe(0);
  });

  it('fits the widest page to the available width, within range', () => {
    expect(fitWidthZoom(595, 595)).toBe(100);
    expect(fitWidthZoom(297, 595)).toBe(49);
    expect(fitWidthZoom(100, 595)).toBe(25);
    expect(fitWidthZoom(10_000, 595)).toBe(300);
    expect(fitWidthZoom(0, 595)).toBe(100);
  });
});

const signer = (over: Partial<SignerFormData>): SignerFormData => ({
  name: 'S',
  email: 's@x.co',
  otpRequired: false,
  ...over,
});
const field = (over: Partial<EsignField>): EsignField =>
  ({
    id: 'f',
    envelope_id: 'e',
    type: 'signature',
    page: 1,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    required: true,
    created_at: '',
    updated_at: '',
    ...over,
  }) as EsignField;

describe('preflightIssues', () => {
  const a = signer({ recipientKey: 'r_a', name: 'Alex' });
  const b = signer({ recipientKey: 'r_b', name: 'Blake', email: 'b@x.co' });
  const cc = signer({ recipientKey: 'r_cc', name: 'Copy', email: 'c@x.co', kind: 'cc' });

  it('passes a complete envelope', () => {
    const r = preflightIssues(
      [
        field({ id: '1', signer_id: 'r_a' }),
        field({ id: '2', signer_id: 'r_b', type: 'initials' }),
      ],
      [a, b, cc],
    );
    expect(r).toEqual({ blocking: [], warnings: [], unassignedFieldIds: [] });
  });

  it('blocks fields that point at nobody, or at a copy-only recipient', () => {
    const r = preflightIssues(
      [
        field({ id: '1', signer_id: 'removed' }),
        field({ id: '2', signer_id: 'r_cc' }),
        field({ id: '3', signer_id: 'r_a' }),
      ],
      [a, cc],
    );
    expect(r.unassignedFieldIds).toEqual(['1', '2']);
    expect(r.blocking[0]).toMatch(/2 fields are not assigned/);
  });

  it('blocks a dropdown with fewer than two options', () => {
    const r = preflightIssues(
      [
        field({ id: '1', signer_id: 'r_a' }),
        field({
          id: '2',
          signer_id: 'r_a',
          type: 'dropdown',
          metadata: { options: ['Only', ' '] },
        }),
      ],
      [a],
    );
    expect(r.blocking.join(' ')).toMatch(/fewer than two options/);
  });

  it('warns (but does not block) about a recipient with nothing to sign', () => {
    const r = preflightIssues([field({ id: '1', signer_id: 'r_a', type: 'text' })], [a, b]);
    expect(r.blocking).toEqual([]);
    expect(r.warnings).toEqual([
      'Alex has no signature or initials field.',
      'Blake has no fields, so they will have nothing to sign.',
    ]);
    // Templates have recipient slots, not people: no such warnings.
    expect(
      preflightIssues([field({ id: '1', signer_id: 'r_a', type: 'text' })], [a, b], {
        isTemplate: true,
      }).warnings,
    ).toEqual([]);
  });

  it('blocks an empty envelope', () => {
    expect(preflightIssues([], [a]).blocking).toEqual(['Place at least one field.']);
  });
});

describe('useFieldHistory — moves and resizes are undoable', () => {
  const f = (id: string, x = 0): EsignField => field({ id, x });

  it('checkpoints a finished gesture as one undo step', () => {
    let current = [f('a', 0)];
    const setFields = (next: EsignField[]) => {
      current = next;
    };
    const { result, rerender } = renderHook(
      ({ cur }) => useFieldHistory([f('a', 0)], setFields, () => {}, cur),
      {
        initialProps: { cur: current },
      },
    );
    // A drag streams updates without history, then ends.
    current = [f('a', 40)];
    rerender({ cur: current });
    act(() => result.current.checkpoint());
    rerender({ cur: current });
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    rerender({ cur: current });
    expect(current[0].x).toBe(0);
    act(() => result.current.redo());
    expect(current[0].x).toBe(40);
  });

  it('undo rolls back an edit that was never checkpointed', () => {
    const initial = [f('a', 0)];
    let current = initial;
    const setFields = (next: EsignField[]) => {
      current = next;
    };
    const { result, rerender } = renderHook(
      ({ cur }) => useFieldHistory(initial, setFields, () => {}, cur),
      {
        initialProps: { cur: current },
      },
    );
    current = [f('a', 25)];
    rerender({ cur: current });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    act(() => result.current.undo());
    expect(current).toBe(initial);
  });
});
