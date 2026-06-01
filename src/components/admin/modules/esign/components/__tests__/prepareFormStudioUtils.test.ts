import { describe, expect, it } from 'vitest';
import {
  isEditableTarget,
  createFieldsFromCandidates,
  buildPageReplicas,
} from '../prepareFormStudioUtils';
import type { EsignEnvelope, EsignField } from '../../types';

describe('isEditableTarget', () => {
  it('is true for input/textarea/select and contentEditable elements', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true);
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true);
    expect(isEditableTarget(document.createElement('select'))).toBe(true);
    // jsdom doesn't derive isContentEditable from the attribute, so force it.
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(isEditableTarget(editable)).toBe(true);
  });

  it('is false for non-editable elements and null', () => {
    expect(isEditableTarget(document.createElement('div'))).toBe(false);
    expect(isEditableTarget(document.createElement('button'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('createFieldsFromCandidates', () => {
  const candidates = [
    {
      page: 1,
      type: 'signature',
      x: 10,
      y: 20,
      width: 100,
      height: 40,
      required: true,
      source: 'auto',
      label: 'Sign',
    },
  ] as unknown as NonNullable<EsignEnvelope['field_candidates']>;

  it('creates a field per candidate stamped with the target signer + envelope id', () => {
    const out = createFieldsFromCandidates(candidates, 'signer1', [], 'env1');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      envelope_id: 'env1',
      signer_id: 'signer1',
      type: 'signature',
      page: 1,
      x: 10,
      y: 20,
      width: 100,
      height: 40,
      required: true,
    });
    expect(out[0].metadata).toMatchObject({ source: 'auto', label: 'Sign' });
  });

  it('skips a candidate that near-duplicates an existing field (same page/type within 1.5px)', () => {
    const existing = [{ page: 1, type: 'signature', x: 10.5, y: 20.5 } as unknown as EsignField];
    expect(createFieldsFromCandidates(candidates, 'signer1', existing, 'env1')).toHaveLength(0);
  });

  it('keeps a candidate far enough from any existing field', () => {
    const existing = [{ page: 1, type: 'signature', x: 200, y: 200 } as unknown as EsignField];
    expect(createFieldsFromCandidates(candidates, 'signer1', existing, 'env1')).toHaveLength(1);
  });
});

describe('buildPageReplicas', () => {
  const seed = {
    id: 's1',
    envelope_id: 'e1',
    signer_id: 'sig1',
    type: 'signature',
    page: 1,
    x: 10,
    y: 20,
    width: 50,
    height: 20,
    required: true,
  } as unknown as EsignField;

  it('replicates a seed onto every other page, preserving geometry', () => {
    const out = buildPageReplicas([seed], [seed], 3);
    expect(out.map((f) => f.page).sort()).toEqual([2, 3]);
    expect(out[0]).toMatchObject({
      signer_id: 'sig1',
      type: 'signature',
      x: 10,
      y: 20,
      width: 50,
      height: 20,
    });
  });

  it('skips a page that already holds a near-duplicate', () => {
    const existing = [seed, { ...seed, id: 'x', page: 2 } as EsignField];
    expect(buildPageReplicas([seed], existing, 3).map((f) => f.page)).toEqual([3]);
  });

  it('produces nothing for a single-page document', () => {
    expect(buildPageReplicas([seed], [seed], 1)).toEqual([]);
  });
});
